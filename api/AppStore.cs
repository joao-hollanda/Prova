using System.Text.Json;

namespace Pcsp.Api;

/// <summary>
/// Repositório em memória com persistência atômica em JSON (data/state.json).
/// Simples e suficiente para o contexto de RP — sem dependências de banco.
/// Todas as operações que leem+escrevem (regra de tentativa única, status) são
/// serializadas por um lock, evitando corridas mesmo sob requisições simultâneas.
/// </summary>
public sealed class AppStore
{
    private readonly object _lock = new();
    private readonly string _arquivo;
    private readonly ILogger<AppStore> _log;
    private EstadoPersistente _estado;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    public AppStore(IConfiguration cfg, IHostEnvironment env, ILogger<AppStore> log)
    {
        _log = log;
        // Em produção (PaaS), aponte para um volume persistente via Data:Dir ou env DATA_DIR.
        // Local: "App_Data" (não usar "data" — em FS case-insensitive colidiria com a pasta-fonte "Data/").
        var dir = cfg["Data:Dir"];
        if (string.IsNullOrWhiteSpace(dir)) dir = Environment.GetEnvironmentVariable("DATA_DIR");
        if (string.IsNullOrWhiteSpace(dir)) dir = Path.Combine(env.ContentRootPath, "App_Data");
        Directory.CreateDirectory(dir);
        _arquivo = Path.Combine(dir, "state.json");
        _estado = Carregar(cfg);
    }

    // ------------------------------------------------------------------ leitura

    public StatusDto Status()
    {
        lock (_lock)
            return new StatusDto(_estado.Edital.Fechada, _estado.Edital.AtualizadoEm);
    }

    public string EditalId
    {
        get { lock (_lock) return _estado.Edital.Id; }
    }

    public InscricaoRecord? GetInscricao(string id)
    {
        lock (_lock)
            return _estado.Inscricoes.FirstOrDefault(i =>
                string.Equals(i.Id, id, StringComparison.Ordinal));
    }

    public List<ResultadoAdminDto> ResultadosDoEditalAtual()
    {
        lock (_lock)
        {
            var editalId = _estado.Edital.Id;
            return _estado.Resultados
                .Where(r => r.EditalId == editalId)
                .Select(r => r.ToAdminDto())
                .ToList();
        }
    }

    // --------------------------------------------------------------- inscrição

    public enum Bloqueio { Nenhum, EditalFechado, JaConcluiu }

    /// <summary>
    /// Cria a inscrição, recusando se o edital está fechado ou se o candidato
    /// (ID do Discord OU nome) já concluiu a prova neste edital.
    /// </summary>
    public (Bloqueio bloqueio, InscricaoRecord? inscricao) CriarInscricao(InscricaoRequest req)
    {
        var nome = (req.Nome ?? "").Trim();
        var cpf = (req.Cpf ?? "").Trim();
        var nomeNorm = Validacoes.NormalizarNome(nome);

        lock (_lock)
        {
            if (_estado.Edital.Fechada)
                return (Bloqueio.EditalFechado, null);

            if (JaConcluiuSemLock(cpf, nomeNorm))
                return (Bloqueio.JaConcluiu, null);

            var rec = new InscricaoRecord
            {
                Id = Guid.NewGuid().ToString(),
                Nome = nome,
                Email = (req.Email ?? "").Trim(),
                Idade = req.Idade ?? 0,
                Cpf = cpf,
                Carreira = (req.Carreira ?? "").Trim().ToLowerInvariant(),
                Protocolo = GerarProtocolo(),
                CriadoEm = DateTimeOffset.UtcNow,
                EditalId = _estado.Edital.Id,
            };
            _estado.Inscricoes.Add(rec);
            Salvar();
            return (Bloqueio.Nenhum, rec);
        }
    }

    // ---------------------------------------------------------------- correção

    public enum EnvioErro { Nenhum, EditalFechado, EditalDiferente, JaConcluiu }

    /// <summary>
    /// Corrige e registra o resultado de forma atômica. Recusa um segundo envio do
    /// mesmo candidato (ID do Discord OU nome) dentro do edital. A identidade vem
    /// SEMPRE da inscrição armazenada — o bloco "candidato" do cliente é ignorado.
    /// </summary>
    public (EnvioErro erro, CorrecaoResponse? resultado) RegistrarResultado(
        InscricaoRecord inscricao,
        IReadOnlyDictionary<string, string?> respostas,
        int? tempoGastoSegundos)
    {
        lock (_lock)
        {
            if (_estado.Edital.Fechada)
                return (EnvioErro.EditalFechado, null);

            if (inscricao.EditalId != _estado.Edital.Id)
                return (EnvioErro.EditalDiferente, null);

            var nomeNorm = Validacoes.NormalizarNome(inscricao.Nome);
            if (JaConcluiuSemLock(inscricao.Cpf, nomeNorm))
                return (EnvioErro.JaConcluiu, null);

            var carreira = Carreiras.Get(inscricao.Carreira);
            var banco = BancoAtivoSemLock(inscricao.Carreira);
            var correcao = Correcao.Corrigir(inscricao.Carreira, banco, _estado.Config.NotaDeCorte, respostas);

            // Guarda as respostas discursivas para a correção da banca.
            var discursivas = banco.Where(q => q.Tipo == "aberta").Select(q =>
            {
                respostas.TryGetValue(q.Id, out var txt);
                return new DiscursivaRespostaRecord
                {
                    QuestaoId = q.Id,
                    Area = q.Area,
                    Resposta = (txt ?? "").Trim(),
                    NotaMaxima = q.Pontos,
                    Status = "EM_ANALISE",
                };
            }).ToList();

            _estado.Resultados.Add(new ResultadoRecord
            {
                InscricaoId = inscricao.Id,
                Nome = inscricao.Nome,
                Email = inscricao.Email,
                Idade = inscricao.Idade,
                Cpf = inscricao.Cpf,
                CarreiraId = inscricao.Carreira,
                CarreiraNome = carreira?.Nome ?? inscricao.Carreira,
                Percentual = correcao.Objetivas.Percentual,
                Acertos = correcao.Objetivas.Acertos,
                Total = correcao.Objetivas.Total,
                AprovadoPreliminar = correcao.Objetivas.AprovadoPreliminar,
                TempoGastoSegundos = tempoGastoSegundos,
                EnviadoEm = correcao.CorrigidoEm,
                EditalId = _estado.Edital.Id,
                NomeNormalizado = nomeNorm,
                Discursivas = discursivas,
            });
            Salvar();
            return (EnvioErro.Nenhum, correcao);
        }
    }

    // -------------------------------------------------------------------- admin

    public StatusDto DefinirStatus(bool fechada)
    {
        lock (_lock)
        {
            _estado.Edital.Fechada = fechada;
            _estado.Edital.AtualizadoEm = DateTimeOffset.UtcNow;
            Salvar();
            return new StatusDto(_estado.Edital.Fechada, _estado.Edital.AtualizadoEm);
        }
    }

    /// <summary>
    /// Inicia um novo edital (zera a regra de tentativa única para o próximo ciclo).
    /// Resultados anteriores permanecem no histórico, mas saem do ranking atual.
    /// </summary>
    public EditalState IniciarNovoEdital(string? id)
    {
        lock (_lock)
        {
            var novoId = string.IsNullOrWhiteSpace(id)
                ? $"PCSP-{DateTime.UtcNow:yyyyMMdd-HHmmss}"
                : id.Trim();

            _estado.Edital = new EditalState
            {
                Id = novoId,
                Fechada = false,
                AtualizadoEm = DateTimeOffset.UtcNow,
            };
            Salvar();
            return _estado.Edital;
        }
    }

    // ------------------------------------------------------------- prova ativa

    /// <summary>Banco ATIVO de uma carreira: o conjunto sorteado (se houver) ou o banco completo.</summary>
    public List<Questao> BancoAtivo(string carreiraId)
    {
        lock (_lock) return BancoAtivoSemLock(carreiraId);
    }

    public int DuracaoMinutos(string carreiraId)
    {
        lock (_lock)
            return _estado.Config.Carreiras.TryGetValue(carreiraId, out var c) && c.DuracaoMinutos > 0
                ? c.DuracaoMinutos
                : Carreiras.Get(carreiraId)?.DuracaoMinutos ?? 90;
    }

    private List<Questao> BancoAtivoSemLock(string carreiraId)
    {
        var todo = Questoes.MontarBanco(carreiraId);
        if (_estado.Selecao is { } sel &&
            sel.PorCarreira.TryGetValue(carreiraId, out var ids) && ids.Count > 0)
        {
            var porId = todo.ToDictionary(q => q.Id, StringComparer.OrdinalIgnoreCase);
            var selecionadas = ids.Where(porId.ContainsKey).Select(id => porId[id]).ToList();
            if (selecionadas.Count > 0) return selecionadas; // ordem fixa = mesma prova p/ todos
        }
        return todo;
    }

    // ------------------------------------------------------------- configuração

    public ConfigDto GetConfig()
    {
        lock (_lock) return GetConfigSemLock();
    }

    private ConfigDto GetConfigSemLock()
    {
        var carreiras = Carreiras.Todas.Select(c =>
        {
            var cfg = _estado.Config.Carreiras.GetValueOrDefault(c.Id);
            var banco = Questoes.MontarBanco(c.Id);
            var objDisp = banco.Count(q => q.Tipo == "fechada");
            var discDisp = banco.Count(q => q.Tipo == "aberta");

            int? objSort = null, discSort = null;
            if (_estado.Selecao?.PorCarreira.TryGetValue(c.Id, out var ids) == true)
            {
                var sel = banco.Where(q => ids.Contains(q.Id)).ToList();
                objSort = sel.Count(q => q.Tipo == "fechada");
                discSort = sel.Count(q => q.Tipo == "aberta");
            }

            return new ConfigCarreiraDto(
                c.Id, c.Nome,
                cfg?.Vagas ?? c.VagasPadrao,
                cfg?.DuracaoMinutos ?? c.DuracaoMinutos,
                objDisp, discDisp, objSort, discSort);
        }).ToList();

        return new ConfigDto(
            _estado.Config.NotaDeCorte,
            _estado.Config.QuantidadeObjetivas,
            _estado.Config.QuantidadeDiscursivas,
            carreiras.Sum(c => c.Vagas),
            _estado.Selecao is not null,
            _estado.Selecao?.SorteadaEm,
            _estado.Selecao?.NotaDeCorteSugerida,
            carreiras);
    }

    public ConfigDto SetConfig(ConfigUpdateRequest req)
    {
        lock (_lock)
        {
            if (req.NotaDeCorte is int nc) _estado.Config.NotaDeCorte = Math.Clamp(nc, 0, 100);
            if (req.QuantidadeObjetivas is int qo) _estado.Config.QuantidadeObjetivas = Math.Clamp(qo, 1, 100);
            if (req.QuantidadeDiscursivas is int qd) _estado.Config.QuantidadeDiscursivas = Math.Clamp(qd, 0, 20);

            if (req.Carreiras is not null)
            {
                foreach (var c in req.Carreiras)
                {
                    if (!Carreiras.Existe(c.Id)) continue;
                    var alvo = _estado.Config.Carreiras.TryGetValue(c.Id!, out var ex) ? ex : new ConfigCarreira();
                    if (c.Vagas is int v) alvo.Vagas = Math.Clamp(v, 0, 100000);
                    if (c.DuracaoMinutos is int d) alvo.DuracaoMinutos = Math.Clamp(d, 1, 600);
                    _estado.Config.Carreiras[c.Id!] = alvo;
                }
            }

            Salvar();
            return GetConfigSemLock();
        }
    }

    // ------------------------------------------------------------------ sorteio

    /// <summary>
    /// Sorteia a prova (a MESMA para todos): por carreira, escolhe N objetivas e M discursivas
    /// do banco e fixa a seleção. Sugere a nota de corte com base na dificuldade das objetivas.
    /// </summary>
    public SortearResponse Sortear()
    {
        lock (_lock)
        {
            var qtdObj = Math.Max(1, _estado.Config.QuantidadeObjetivas);
            var qtdDisc = Math.Max(0, _estado.Config.QuantidadeDiscursivas);

            var selecao = new ProvaSelecionada { SorteadaEm = DateTimeOffset.UtcNow };
            var resumo = new List<SortearCarreiraDto>();
            var objetivasSorteadas = new List<Questao>();

            foreach (var carreira in Carreiras.Todas)
            {
                var banco = Questoes.MontarBanco(carreira.Id);
                var fechadas = banco.Where(q => q.Tipo == "fechada")
                    .OrderBy(_ => Random.Shared.Next()).Take(qtdObj).ToList();
                var abertas = banco.Where(q => q.Tipo == "aberta")
                    .OrderBy(_ => Random.Shared.Next()).Take(qtdDisc).ToList();

                selecao.PorCarreira[carreira.Id] = fechadas.Concat(abertas).Select(q => q.Id).ToList();
                objetivasSorteadas.AddRange(fechadas);

                resumo.Add(new SortearCarreiraDto(
                    carreira.Id, carreira.Nome, fechadas.Count, abertas.Count,
                    fechadas.Count(q => q.Dificuldade == "facil"),
                    fechadas.Count(q => q.Dificuldade == "medio"),
                    fechadas.Count(q => q.Dificuldade == "dificil")));
            }

            var sugerida = Questoes.SugerirNotaDeCorte(objetivasSorteadas);
            selecao.NotaDeCorteSugerida = sugerida;
            _estado.Selecao = selecao;
            Salvar();

            return new SortearResponse(selecao.SorteadaEm, sugerida, resumo);
        }
    }

    // ------------------------------------------------------- discursivas (banca)

    public List<DiscursivaSubmissaoDto> ListarDiscursivas()
    {
        lock (_lock)
        {
            var editalId = _estado.Edital.Id;
            var lista = new List<DiscursivaSubmissaoDto>();

            foreach (var r in _estado.Resultados.Where(r => r.EditalId == editalId))
            {
                if (r.Discursivas is null || r.Discursivas.Count == 0) continue;
                var banco = Questoes.MontarBanco(r.CarreiraId)
                    .ToDictionary(q => q.Id, StringComparer.OrdinalIgnoreCase);

                var itens = r.Discursivas.Select(d => new DiscursivaItemDto(
                    d.QuestaoId, d.Area,
                    banco.TryGetValue(d.QuestaoId, out var q) ? q.Enunciado : "",
                    d.Resposta, d.Nota, d.NotaMaxima, d.Status)).ToList();

                lista.Add(new DiscursivaSubmissaoDto(
                    r.InscricaoId, r.Nome, r.Email, r.CarreiraId, r.CarreiraNome, r.EnviadoEm, itens));
            }
            return lista;
        }
    }

    public bool CorrigirDiscursiva(string inscricaoId, string questaoId, double? nota, string? status)
    {
        lock (_lock)
        {
            var editalId = _estado.Edital.Id;
            var r = _estado.Resultados.FirstOrDefault(x =>
                x.EditalId == editalId && x.InscricaoId == inscricaoId);
            var d = r?.Discursivas.FirstOrDefault(x => x.QuestaoId == questaoId);
            if (d is null) return false;

            if (nota is double n) d.Nota = Math.Clamp(n, 0, d.NotaMaxima);
            d.Status = status == "EM_ANALISE" ? "EM_ANALISE" : "CORRIGIDA";
            d.CorrigidaEm = DateTimeOffset.UtcNow;
            Salvar();
            return true;
        }
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>Já existe um resultado (tentativa concluída) deste candidato no edital atual?</summary>
    private bool JaConcluiuSemLock(string cpf, string nomeNormalizado)
    {
        var editalId = _estado.Edital.Id;
        return _estado.Resultados.Any(r =>
            r.EditalId == editalId &&
            (string.Equals(r.Cpf, cpf, StringComparison.Ordinal) ||
             string.Equals(r.NomeNormalizado, nomeNormalizado, StringComparison.Ordinal)));
    }

    private static string GerarProtocolo()
    {
        var ano = DateTime.UtcNow.Year;
        var seq = Random.Shared.Next(100000, 1000000);
        return $"PCSP-{ano}-{seq}";
    }

    private EstadoPersistente Carregar(IConfiguration cfg)
    {
        if (File.Exists(_arquivo))
        {
            try
            {
                var json = File.ReadAllText(_arquivo);
                var e = JsonSerializer.Deserialize<EstadoPersistente>(json, JsonOpts);
                if (e?.Edital is not null && !string.IsNullOrWhiteSpace(e.Edital.Id))
                {
                    SeedConfig(e);
                    return e;
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Estado persistido inválido em {Arquivo}; reiniciando.", _arquivo);
            }
        }

        var editalId = cfg["Edital:Id"];
        if (string.IsNullOrWhiteSpace(editalId)) editalId = $"PCSP-{DateTime.UtcNow.Year}";

        var novo = new EstadoPersistente
        {
            Edital = new EditalState { Id = editalId, Fechada = false, AtualizadoEm = null },
            Inscricoes = new(),
            Resultados = new(),
        };
        SeedConfig(novo);
        return novo;
    }

    /// <summary>Garante valores padrão de configuração por carreira (vagas/duração).</summary>
    private static void SeedConfig(EstadoPersistente e)
    {
        e.Config ??= new ProvaConfig();
        e.Config.Carreiras ??= new();
        foreach (var c in Carreiras.Todas)
        {
            if (!e.Config.Carreiras.ContainsKey(c.Id))
                e.Config.Carreiras[c.Id] = new ConfigCarreira { Vagas = c.VagasPadrao, DuracaoMinutos = c.DuracaoMinutos };
        }
    }

    /// <summary>Grava o estado de forma atômica (escreve em .tmp e renomeia).</summary>
    private void Salvar()
    {
        try
        {
            var tmp = _arquivo + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(_estado, JsonOpts));
            File.Move(tmp, _arquivo, overwrite: true);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Falha ao persistir o estado em {Arquivo}.", _arquivo);
        }
    }
}
