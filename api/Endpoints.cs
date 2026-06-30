namespace Pcsp.Api;

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
                return Erro(404, "Inscrição não encontrada. Refaça a inscrição.");

            // A prova corrigida é SEMPRE a da inscrição (não confiamos no carreiraId do cliente).
            if (!string.Equals(inscricao.Carreira, carreiraId, StringComparison.OrdinalIgnoreCase))
                return Erro(400, "A prova enviada não corresponde à carreira da sua inscrição.");

            var respostas = Validacoes.SanitizarRespostas(req.Respostas);
            var tempo = Validacoes.SanitizarTempo(req.TempoGastoSegundos);

            var (erro, resultado) = store.RegistrarResultado(inscricao, respostas, tempo);
            return erro switch
            {
                AppStore.EnvioErro.EditalFechado =>
                    Erro(403, "A prova foi encerrada pela administração do certame."),
                AppStore.EnvioErro.EditalDiferente =>
                    Erro(409, "Esta inscrição pertence a um edital anterior. Faça uma nova inscrição."),
                AppStore.EnvioErro.JaConcluiu =>
                    Erro(409, "Você já enviou a prova neste edital. Não é permitido reenviar."),
                _ => Results.Ok(resultado),
            };
        })
        .RequireRateLimiting("escrita");
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
