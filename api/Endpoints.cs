namespace Pf.Api;

public static class Endpoints
{
    /// <summary>Resposta de erro padronizada: { "mensagem": "..." } — o front lê `mensagem`.</summary>
    private static IResult Erro(int status, string mensagem) =>
        Results.Json(new { mensagem }, statusCode: status);

    public static void MapApi(this WebApplication app)
    {
        var api = app.MapGroup("/api");

        // Configuração pública (vagas/duração/nota de corte) — usada pela Home e pela inscrição.
        api.MapGet("/config", (AppStore store) => Results.Ok(store.GetConfig()));

        MapInscricoes(api);
        MapProvas(api);
        MapAdmin(api);
    }

    // ----------------------------------------------------------- /api/inscricoes
    private static void MapInscricoes(RouteGroupBuilder api)
    {
        api.MapPost("/inscricoes", (InscricaoRequest req, AppStore store) =>
        {
            var erros = Validacoes.ValidarInscricao(req);
            if (erros.Count > 0)
                return Results.Json(new { mensagem = erros.Values.First(), erros }, statusCode: 400);

            var (bloqueio, inscricao) = store.CriarInscricao(req);
            return bloqueio switch
            {
                AppStore.Bloqueio.EditalFechado =>
                    Erro(403, "As inscrições estão encerradas pela administração do certame."),
                AppStore.Bloqueio.JaConcluiu =>
                    Erro(409, "Você já realizou a prova neste edital. Cada candidato pode participar apenas uma vez."),
                _ => Results.Json(inscricao!.ToResponse(), statusCode: 201),
            };
        })
        .RequireRateLimiting("escrita");

        // Consulta uma inscrição pelo id — o front usa para validar a sessão salva
        // ANTES de iniciar a prova, evitando que o candidato descubra só no envio
        // que a inscrição não existe mais (ex.: banco resetado/trocado).
        api.MapGet("/inscricoes/{id}", (string id, AppStore store) =>
        {
            var inscricao = store.GetInscricao(id);
            if (inscricao is null)
                return Erro(404, "Inscrição não encontrada. Refaça a inscrição.");
            if (inscricao.EditalId != store.EditalId)
                return Erro(409, "Esta inscrição pertence a um edital anterior. Faça uma nova inscrição.");
            return Results.Ok(inscricao.ToResponse());
        });
    }

    // -------------------------------------------------------------- /api/provas
    private static void MapProvas(RouteGroupBuilder api)
    {
        // Busca a prova ATIVA (sorteada, se houver) — SEM gabarito.
        api.MapGet("/provas/{carreiraId}", (string carreiraId, AppStore store) =>
        {
            var carreira = Carreiras.Get(carreiraId);
            if (carreira is null) return Erro(404, "Carreira não encontrada.");

            var questoes = store.BancoAtivo(carreira.Id).Select(q => q.ToPublica()).ToList();
            return Results.Ok(new ProvaResponse(
                carreira.Nome, carreira.Id, store.DuracaoMinutos(carreira.Id), questoes.Count, questoes));
        });

        // Envia respostas → correção no servidor. Aplica a regra de tentativa única.
        api.MapPost("/provas/{carreiraId}/respostas", (string carreiraId, RespostasRequest req, AppStore store) =>
        {
            if (string.IsNullOrWhiteSpace(req.InscricaoId))
                return Erro(400, "Inscrição inválida. Refaça a inscrição.");

            var inscricao = store.GetInscricao(req.InscricaoId);
            if (inscricao is null)
            {
                // A inscrição pode ter se perdido no servidor (reset/troca de banco) com a
                // sessão ainda ativa no navegador. Para o candidato não perder a prova já
                // feita, recria a inscrição com os dados do payload — sujeitos às MESMAS
                // validações e regras (edital aberto, tentativa única) da inscrição normal.
                var recuperada = RecuperarInscricao(req, carreiraId, store, out var falha);
                if (falha is not null) return falha;
                inscricao = recuperada!;
            }

            // A prova corrigida é SEMPRE a da inscrição (não confiamos no carreiraId do cliente).
            if (!string.Equals(inscricao.Carreira, carreiraId, StringComparison.OrdinalIgnoreCase))
                return Erro(400, "A prova enviada não corresponde à carreira da sua inscrição.");

            var respostas = Validacoes.SanitizarRespostas(req.Respostas);
            var tempo = Validacoes.SanitizarTempo(req.TempoGastoSegundos);

            var (erro, resultado) = store.RegistrarResultado(inscricao, respostas, tempo);
            return erro switch
            {
                AppStore.EnvioErro.EditalDiferente =>
                    Erro(409, "Esta inscrição pertence a um edital anterior. Faça uma nova inscrição."),
                AppStore.EnvioErro.JaConcluiu =>
                    Erro(409, "Você já enviou a prova neste edital. Não é permitido reenviar."),
                _ => Results.Ok(resultado),
            };
        })
        .RequireRateLimiting("escrita");

        // Sessão de prova no SERVIDOR (backup do progresso): permite retomar a prova
        // em outro navegador/dispositivo e dá visibilidade ao painel admin.
        // Sem política "escrita" (o front salva com throttle); vale o limite global.
        api.MapGet("/provas/sessao/{inscricaoId}", (string inscricaoId, AppStore store) =>
        {
            var sessao = store.GetSessao(inscricaoId);
            return sessao is null
                ? Erro(404, "Inscrição não encontrada.")
                : Results.Ok(sessao);
        });

        api.MapPost("/provas/sessao", (SessaoSalvarRequest req, AppStore store) =>
        {
            if (string.IsNullOrWhiteSpace(req.InscricaoId))
                return Erro(400, "Inscrição inválida.");

            var respostas = Validacoes.SanitizarRespostas(req.Respostas);
            var (erro, sessao) = store.SalvarSessao(req.InscricaoId!, req.Inicio, respostas);
            return erro switch
            {
                AppStore.SessaoErro.InscricaoNaoEncontrada => Erro(404, "Inscrição não encontrada."),
                AppStore.SessaoErro.JaEnviada => Erro(409, "A prova desta inscrição já foi enviada."),
                _ => Results.Ok(sessao),
            };
        });
    }

    // --------------------------------------------------------------- /api/admin
    private static void MapAdmin(RouteGroupBuilder api)
    {
        var admin = api.MapGroup("/admin");

        // Login do painel: confere a senha (segredo do servidor) e emite um token de sessão.
        admin.MapPost("/login", (LoginRequest req, AdminAuth auth) =>
        {
            var (ok, token, expiraEm) = auth.Login(req?.Senha);
            return ok
                ? Results.Ok(new { token, expiraEm })
                : Erro(401, "Senha incorreta.");
        })
        .RequireRateLimiting("escrita"); // freia tentativas de força bruta

        // Logout: invalida a sessão atual.
        admin.MapPost("/logout", (HttpContext ctx, AdminAuth auth) =>
        {
            auth.Logout(ctx.Request.Headers["X-Admin-Token"].ToString());
            return Results.Ok(new { mensagem = "Sessão encerrada." });
        });

        // Status da prova — PÚBLICO (consultado por candidatos para saber se está aberta).
        admin.MapGet("/prova/status", (AppStore store) => Results.Ok(store.Status()));

        // Ranking/resultados — PROTEGIDO (contém PII: nome, e-mail, ID do Discord).
        admin.MapGet("/resultados", (HttpContext ctx, AppStore store, AdminAuth auth) =>
            GuardaAdmin(ctx, auth) ?? Results.Ok(store.ResultadosDoEditalAtual()));

        // Abrir/fechar a prova — PROTEGIDO (mutação).
        admin.MapPost("/prova/status", (HttpContext ctx, StatusRequest req, AppStore store, AdminAuth auth) =>
            GuardaAdmin(ctx, auth) ?? Results.Ok(store.DefinirStatus(req.Fechada)));

        // Iniciar um novo edital (zera a tentativa única) — PROTEGIDO.
        admin.MapPost("/edital/novo", (HttpContext ctx, NovoEditalRequest? req, AppStore store, AdminAuth auth) =>
            GuardaAdmin(ctx, auth) ?? Results.Ok(store.IniciarNovoEdital(req?.Id)));

        // Atualizar configuração da prova (vagas, qtd. questões, nota de corte, duração) — PROTEGIDO.
        admin.MapPost("/config", (HttpContext ctx, ConfigUpdateRequest req, AppStore store, AdminAuth auth) =>
            GuardaAdmin(ctx, auth) ?? Results.Ok(store.SetConfig(req)));

        // Sortear a prova (mesma para todos) + sugerir nota de corte — PROTEGIDO.
        admin.MapPost("/prova/sortear", (HttpContext ctx, AppStore store, AdminAuth auth) =>
            GuardaAdmin(ctx, auth) ?? Results.Ok(store.Sortear()));

        // ------- Gestão de candidatos (ferramentas de contingência) — PROTEGIDO -------

        // Lista as inscrições do edital atual com situação (não iniciou/em prova/pausada/enviada).
        admin.MapGet("/inscricoes", (HttpContext ctx, AppStore store, AdminAuth auth) =>
            GuardaAdmin(ctx, auth) ?? Results.Ok(store.ListarInscricoesAdmin()));

        // Exclui inscrição + resultado + sessão (libera a tentativa única do candidato).
        admin.MapPost("/inscricoes/excluir", (HttpContext ctx, InscricaoAcaoRequest req, AppStore store, AdminAuth auth) =>
        {
            var guarda = GuardaAdmin(ctx, auth);
            if (guarda is not null) return guarda;
            if (string.IsNullOrWhiteSpace(req.InscricaoId)) return Erro(400, "Informe a inscrição.");
            return store.ExcluirInscricao(req.InscricaoId!)
                ? Results.Ok(new { mensagem = "Inscrição excluída." })
                : Erro(404, "Inscrição não encontrada.");
        });

        // Exclui só o resultado (e a sessão), mantendo a inscrição — o candidato refaz a prova.
        admin.MapPost("/resultados/excluir", (HttpContext ctx, InscricaoAcaoRequest req, AppStore store, AdminAuth auth) =>
        {
            var guarda = GuardaAdmin(ctx, auth);
            if (guarda is not null) return guarda;
            if (string.IsNullOrWhiteSpace(req.InscricaoId)) return Erro(400, "Informe a inscrição.");
            return store.ExcluirResultado(req.InscricaoId!)
                ? Results.Ok(new { mensagem = "Resultado excluído — o candidato pode refazer a prova." })
                : Erro(404, "Resultado não encontrado.");
        });

        // Concede tempo extra (minutos; negativo reduz) a um candidato.
        admin.MapPost("/inscricoes/tempo", (HttpContext ctx, TempoExtraRequest req, AppStore store, AdminAuth auth) =>
        {
            var guarda = GuardaAdmin(ctx, auth);
            if (guarda is not null) return guarda;
            if (string.IsNullOrWhiteSpace(req.InscricaoId) || req.AdicionarMinutos is null or 0)
                return Erro(400, "Informe a inscrição e os minutos a adicionar.");
            var total = store.AdicionarTempoExtra(req.InscricaoId!, Math.Clamp(req.AdicionarMinutos.Value, -600, 600));
            return total is null
                ? Erro(404, "Inscrição não encontrada.")
                : Results.Ok(new { mensagem = $"Tempo extra atual: {total} min.", extraMinutos = total });
        });

        // Pausa/retoma a prova de um candidato (o relógio congela e nada se perde).
        admin.MapPost("/sessao/pausar", (HttpContext ctx, PausarRequest req, AppStore store, AdminAuth auth) =>
        {
            var guarda = GuardaAdmin(ctx, auth);
            if (guarda is not null) return guarda;
            if (string.IsNullOrWhiteSpace(req.InscricaoId)) return Erro(400, "Informe a inscrição.");
            var (ok, erro) = store.PausarSessao(req.InscricaoId!, req.Pausar);
            return ok
                ? Results.Ok(new { mensagem = req.Pausar ? "Prova pausada." : "Prova retomada." })
                : Erro(409, erro ?? "Não foi possível alterar a sessão.");
        });

        // Listar respostas discursivas para correção da banca — PROTEGIDO.
        admin.MapGet("/discursivas", (HttpContext ctx, AppStore store, AdminAuth auth) =>
            GuardaAdmin(ctx, auth) ?? Results.Ok(store.ListarDiscursivas()));

        // Lançar a nota de uma resposta discursiva — PROTEGIDO.
        admin.MapPost("/discursivas/corrigir", (HttpContext ctx, CorrigirDiscursivaRequest req, AppStore store, AdminAuth auth) =>
        {
            var guarda = GuardaAdmin(ctx, auth);
            if (guarda is not null) return guarda;
            if (string.IsNullOrWhiteSpace(req.InscricaoId) || string.IsNullOrWhiteSpace(req.QuestaoId))
                return Erro(400, "Informe a inscrição e a questão.");

            var ok = store.CorrigirDiscursiva(req.InscricaoId!, req.QuestaoId!, req.Nota, req.Status);
            return ok
                ? Results.Ok(new { mensagem = "Correção registrada." })
                : Erro(404, "Resposta discursiva não encontrada.");
        });
    }

    /// <summary>
    /// Recria a inscrição a partir do bloco "candidato" do envio, quando o id salvo no
    /// navegador não existe mais no servidor. Não abre brecha: os dados passam pela mesma
    /// validação da inscrição normal e pelas mesmas regras de bloqueio (edital fechado /
    /// tentativa única) — equivale a inscrever-se e enviar em seguida.
    /// </summary>
    private static InscricaoRecord? RecuperarInscricao(
        RespostasRequest req, string carreiraId, AppStore store, out IResult? falha)
    {
        var dados = new InscricaoRequest(
            req.Candidato?.Nome, req.Candidato?.Email, req.Candidato?.Idade, req.Candidato?.Cpf, carreiraId);

        if (Validacoes.ValidarInscricao(dados).Count > 0)
        {
            falha = Erro(404, "Inscrição não encontrada. Refaça a inscrição.");
            return null;
        }

        var (bloqueio, inscricao) = store.CriarInscricao(dados);
        falha = bloqueio switch
        {
            AppStore.Bloqueio.EditalFechado =>
                Erro(403, "A prova foi encerrada pela administração do certame."),
            AppStore.Bloqueio.JaConcluiu =>
                Erro(409, "Você já enviou a prova neste edital. Não é permitido reenviar."),
            _ => null,
        };
        return inscricao;
    }

    // ----------------------------------------------------------------- segurança
    /// <summary>
    /// Exige um token de SESSÃO válido (header X-Admin-Token), emitido pelo /admin/login.
    /// Retorna null quando autorizado, ou um IResult de erro.
    /// </summary>
    private static IResult? GuardaAdmin(HttpContext ctx, AdminAuth auth)
    {
        var token = ctx.Request.Headers["X-Admin-Token"].ToString();
        return auth.Validar(token)
            ? null
            : Erro(401, "Acesso não autorizado. Faça login no painel.");
    }
}
