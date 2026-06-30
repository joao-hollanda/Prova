using Npgsql;

namespace Pcsp.Api;

/// <summary>
/// Repositório com persistência em PostgreSQL.
/// A conexão vem de Data:ConnectionString, POSTGRES_CONNECTION_STRING ou DATABASE_URL.
/// Todas as operações que leem+escrevem são serializadas por um lock.
/// </summary>
public sealed class AppStore
{
    private readonly object _lock = new();
    private readonly NpgsqlConnection _connection;
    private readonly string _database;
    private readonly ILogger<AppStore> _log;
    private EstadoPersistente _estado;


    public AppStore(IConfiguration cfg, IHostEnvironment env, ILogger<AppStore> log)
    {
        _log = log;

        var connectionString = cfg["Data:ConnectionString"];
        if (string.IsNullOrWhiteSpace(connectionString))
            connectionString = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString))
            connectionString = Environment.GetEnvironmentVariable("DATABASE_URL");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Configure Data:ConnectionString, POSTGRES_CONNECTION_STRING ou DATABASE_URL com a conexão do PostgreSQL.");
        }

        connectionString = NormalizePostgresConnectionString(connectionString);
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            Timeout = 15,
            CommandTimeout = 30,
            Pooling = true,
        };

        _database = builder.Database ?? "PostgreSQL";
        _connection = new NpgsqlConnection(builder.ConnectionString);
        _connection.Open();
        InitializeDatabase();
        _estado = Carregar(cfg);
        SeedConfig(_estado);
        Salvar();
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
        var e = new EstadoPersistente
        {
            Edital = new EditalState(),
            Config = new ProvaConfig(),
            Inscricoes = new(),
            Resultados = new(),
        };

        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = "SELECT Id, Fechada, AtualizadoEm FROM Edital LIMIT 1";
            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                e.Edital.Id = reader.GetString(0);
                e.Edital.Fechada = reader.GetInt32(1) == 1;
                e.Edital.AtualizadoEm = reader.IsDBNull(2) ? null : DateTimeOffset.Parse(reader.GetString(2));
            }
            else
            {
                var editalId = cfg["Edital:Id"];
                if (string.IsNullOrWhiteSpace(editalId)) editalId = $"PCSP-{DateTime.UtcNow.Year}";
                e.Edital = new EditalState { Id = editalId, Fechada = false, AtualizadoEm = null };
                return e;
            }
        }

        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = "SELECT NotaDeCorte, QuantidadeObjetivas, QuantidadeDiscursivas FROM ConfigGlobal WHERE Id = 1 LIMIT 1";
            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                e.Config.NotaDeCorte = reader.GetInt32(0);
                e.Config.QuantidadeObjetivas = reader.GetInt32(1);
                e.Config.QuantidadeDiscursivas = reader.GetInt32(2);
            }
        }

        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = "SELECT CarreiraId, Vagas, DuracaoMinutos FROM ConfigCarreira";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                e.Config.Carreiras[reader.GetString(0)] = new ConfigCarreira
                {
                    Vagas = reader.GetInt32(1),
                    DuracaoMinutos = reader.GetInt32(2),
                };
            }
        }

        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = "SELECT SorteadaEm, NotaDeCorteSugerida FROM Selecao WHERE Id = 1 LIMIT 1";
            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                var selecao = new ProvaSelecionada
                {
                    SorteadaEm = reader.IsDBNull(0) ? DateTimeOffset.MinValue : DateTimeOffset.Parse(reader.GetString(0)),
                    NotaDeCorteSugerida = reader.GetInt32(1),
                };
                e.Selecao = selecao;
            }
        }

        if (e.Selecao is not null)
        {
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = @"SELECT CarreiraId, QuestaoId FROM SelecaoItem ORDER BY CarreiraId, Ordem";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                var carreiraId = reader.GetString(0);
                var questaoId = reader.GetString(1);
                if (!e.Selecao.PorCarreira.TryGetValue(carreiraId, out var lista))
                {
                    lista = new List<string>();
                    e.Selecao.PorCarreira[carreiraId] = lista;
                }
                lista.Add(questaoId);
            }
        }

        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = @"SELECT Id, Nome, Email, Idade, Cpf, Carreira, Protocolo, CriadoEm, EditalId
                                FROM Inscricoes";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                e.Inscricoes.Add(new InscricaoRecord
                {
                    Id = reader.GetString(0),
                    Nome = reader.GetString(1),
                    Email = reader.GetString(2),
                    Idade = reader.GetInt32(3),
                    Cpf = reader.GetString(4),
                    Carreira = reader.GetString(5),
                    Protocolo = reader.GetString(6),
                    CriadoEm = DateTimeOffset.Parse(reader.GetString(7)),
                    EditalId = reader.GetString(8),
                });
            }
        }

        var discursivasPorInscricao = new Dictionary<string, List<DiscursivaRespostaRecord>>(StringComparer.Ordinal);
        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = @"SELECT InscricaoId, QuestaoId, Area, Resposta, Nota, NotaMaxima, Status, CorrigidaEm
                                FROM Discursivas";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                var inscricaoId = reader.GetString(0);
                if (!discursivasPorInscricao.TryGetValue(inscricaoId, out var lista))
                {
                    lista = new List<DiscursivaRespostaRecord>();
                    discursivasPorInscricao[inscricaoId] = lista;
                }
                lista.Add(new DiscursivaRespostaRecord
                {
                    QuestaoId = reader.GetString(1),
                    Area = reader.GetString(2),
                    Resposta = reader.GetString(3),
                    Nota = reader.IsDBNull(4) ? null : reader.GetDouble(4),
                    NotaMaxima = reader.GetInt32(5),
                    Status = reader.GetString(6),
                    CorrigidaEm = reader.IsDBNull(7) ? null : DateTimeOffset.Parse(reader.GetString(7)),
                });
            }
        }

        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = @"SELECT InscricaoId, Nome, Email, Idade, Cpf, CarreiraId, CarreiraNome,
                                       Percentual, Acertos, Total, AprovadoPreliminar, TempoGastoSegundos,
                                       EnviadoEm, EditalId, NomeNormalizado
                                FROM Resultados";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                var inscricaoId = reader.GetString(0);
                var resultado = new ResultadoRecord
                {
                    InscricaoId = inscricaoId,
                    Nome = reader.GetString(1),
                    Email = reader.GetString(2),
                    Idade = reader.GetInt32(3),
                    Cpf = reader.GetString(4),
                    CarreiraId = reader.GetString(5),
                    CarreiraNome = reader.GetString(6),
                    Percentual = reader.GetInt32(7),
                    Acertos = reader.GetInt32(8),
                    Total = reader.GetInt32(9),
                    AprovadoPreliminar = reader.GetInt32(10) == 1,
                    TempoGastoSegundos = reader.IsDBNull(11) ? null : reader.GetInt32(11),
                    EnviadoEm = DateTimeOffset.Parse(reader.GetString(12)),
                    EditalId = reader.GetString(13),
                    NomeNormalizado = reader.GetString(14),
                };
                if (discursivasPorInscricao.TryGetValue(inscricaoId, out var lista))
                    resultado.Discursivas = lista;
                e.Resultados.Add(resultado);
            }
        }

        return e;
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

    private void InitializeDatabase()
    {
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS Edital (
                Id TEXT PRIMARY KEY,
                Fechada INTEGER NOT NULL,
                AtualizadoEm TEXT
            );
            CREATE TABLE IF NOT EXISTS ConfigGlobal (
                Id INTEGER PRIMARY KEY CHECK(Id = 1),
                NotaDeCorte INTEGER NOT NULL,
                QuantidadeObjetivas INTEGER NOT NULL,
                QuantidadeDiscursivas INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ConfigCarreira (
                CarreiraId TEXT PRIMARY KEY,
                Vagas INTEGER NOT NULL,
                DuracaoMinutos INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS Selecao (
                Id INTEGER PRIMARY KEY CHECK(Id = 1),
                SorteadaEm TEXT,
                NotaDeCorteSugerida INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS SelecaoItem (
                CarreiraId TEXT NOT NULL,
                QuestaoId TEXT NOT NULL,
                Ordem INTEGER NOT NULL,
                PRIMARY KEY (CarreiraId, Ordem)
            );
            CREATE TABLE IF NOT EXISTS Inscricoes (
                Id TEXT PRIMARY KEY,
                Nome TEXT NOT NULL,
                Email TEXT NOT NULL,
                Idade INTEGER NOT NULL,
                Cpf TEXT NOT NULL,
                Carreira TEXT NOT NULL,
                Protocolo TEXT NOT NULL,
                CriadoEm TEXT NOT NULL,
                EditalId TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS Resultados (
                InscricaoId TEXT PRIMARY KEY,
                Nome TEXT NOT NULL,
                Email TEXT NOT NULL,
                Idade INTEGER NOT NULL,
                Cpf TEXT NOT NULL,
                CarreiraId TEXT NOT NULL,
                CarreiraNome TEXT NOT NULL,
                Percentual INTEGER NOT NULL,
                Acertos INTEGER NOT NULL,
                Total INTEGER NOT NULL,
                AprovadoPreliminar INTEGER NOT NULL,
                TempoGastoSegundos INTEGER,
                EnviadoEm TEXT NOT NULL,
                EditalId TEXT NOT NULL,
                NomeNormalizado TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS Discursivas (
                InscricaoId TEXT NOT NULL,
                QuestaoId TEXT NOT NULL,
                Area TEXT NOT NULL,
                Resposta TEXT NOT NULL,
                Nota DOUBLE PRECISION,
                NotaMaxima INTEGER NOT NULL,
                Status TEXT NOT NULL,
                CorrigidaEm TEXT,
                PRIMARY KEY (InscricaoId, QuestaoId)
            );
        ";
        cmd.ExecuteNonQuery();
    }

    /// <summary>Grava o estado de forma atômica em PostgreSQL.</summary>
    private void Salvar()
    {
        try
        {
            using var tx = _connection.BeginTransaction();
            ExecuteNonQuery(@"INSERT INTO Edital (Id, Fechada, AtualizadoEm)
                               VALUES (@Id, @Fechada, @AtualizadoEm)
                               ON CONFLICT (Id) DO UPDATE SET
                                   Fechada = EXCLUDED.Fechada,
                                   AtualizadoEm = EXCLUDED.AtualizadoEm",
                new Dictionary<string, object?>
                {
                    ["@Id"] = _estado.Edital.Id,
                    ["@Fechada"] = BoolToInt(_estado.Edital.Fechada),
                    ["@AtualizadoEm"] = _estado.Edital.AtualizadoEm?.ToString("o"),
                }, tx);

            ExecuteNonQuery(@"INSERT INTO ConfigGlobal (Id, NotaDeCorte, QuantidadeObjetivas, QuantidadeDiscursivas)
                               VALUES (1, @NotaDeCorte, @QuantidadeObjetivas, @QuantidadeDiscursivas)
                               ON CONFLICT (Id) DO UPDATE SET
                                   NotaDeCorte = EXCLUDED.NotaDeCorte,
                                   QuantidadeObjetivas = EXCLUDED.QuantidadeObjetivas,
                                   QuantidadeDiscursivas = EXCLUDED.QuantidadeDiscursivas",
                new Dictionary<string, object?>
                {
                    ["@NotaDeCorte"] = _estado.Config.NotaDeCorte,
                    ["@QuantidadeObjetivas"] = _estado.Config.QuantidadeObjetivas,
                    ["@QuantidadeDiscursivas"] = _estado.Config.QuantidadeDiscursivas,
                }, tx);

            ExecuteNonQuery("DELETE FROM ConfigCarreira", null, tx);
            foreach (var kv in _estado.Config.Carreiras)
            {
                ExecuteNonQuery(@"INSERT INTO ConfigCarreira (CarreiraId, Vagas, DuracaoMinutos)
                                   VALUES (@CarreiraId, @Vagas, @DuracaoMinutos)",
                    new Dictionary<string, object?>
                    {
                        ["@CarreiraId"] = kv.Key,
                        ["@Vagas"] = kv.Value.Vagas,
                        ["@DuracaoMinutos"] = kv.Value.DuracaoMinutos,
                    }, tx);
            }

            ExecuteNonQuery("DELETE FROM SelecaoItem", null, tx);
            ExecuteNonQuery("DELETE FROM Selecao", null, tx);
            if (_estado.Selecao is not null)
            {
                ExecuteNonQuery(@"INSERT INTO Selecao (Id, SorteadaEm, NotaDeCorteSugerida)
                                   VALUES (1, @SorteadaEm, @NotaDeCorteSugerida)",
                    new Dictionary<string, object?>
                    {
                        ["@SorteadaEm"] = _estado.Selecao.SorteadaEm.ToString("o"),
                        ["@NotaDeCorteSugerida"] = _estado.Selecao.NotaDeCorteSugerida,
                    }, tx);

                foreach (var kv in _estado.Selecao.PorCarreira)
                {
                    for (var index = 0; index < kv.Value.Count; index++)
                    {
                        ExecuteNonQuery(@"INSERT INTO SelecaoItem (CarreiraId, QuestaoId, Ordem)
                                           VALUES (@CarreiraId, @QuestaoId, @Ordem)",
                            new Dictionary<string, object?>
                            {
                                ["@CarreiraId"] = kv.Key,
                                ["@QuestaoId"] = kv.Value[index],
                                ["@Ordem"] = index,
                            }, tx);
                    }
                }
            }

            ExecuteNonQuery("DELETE FROM Discursivas", null, tx);
            ExecuteNonQuery("DELETE FROM Resultados", null, tx);
            ExecuteNonQuery("DELETE FROM Inscricoes", null, tx);

            foreach (var inscricao in _estado.Inscricoes)
            {
                ExecuteNonQuery(@"INSERT INTO Inscricoes (Id, Nome, Email, Idade, Cpf, Carreira, Protocolo, CriadoEm, EditalId)
                                   VALUES (@Id, @Nome, @Email, @Idade, @Cpf, @Carreira, @Protocolo, @CriadoEm, @EditalId)",
                    new Dictionary<string, object?>
                    {
                        ["@Id"] = inscricao.Id,
                        ["@Nome"] = inscricao.Nome,
                        ["@Email"] = inscricao.Email,
                        ["@Idade"] = inscricao.Idade,
                        ["@Cpf"] = inscricao.Cpf,
                        ["@Carreira"] = inscricao.Carreira,
                        ["@Protocolo"] = inscricao.Protocolo,
                        ["@CriadoEm"] = inscricao.CriadoEm.ToString("o"),
                        ["@EditalId"] = inscricao.EditalId,
                    }, tx);
            }

            foreach (var resultado in _estado.Resultados)
            {
                ExecuteNonQuery(@"INSERT INTO Resultados (InscricaoId, Nome, Email, Idade, Cpf, CarreiraId, CarreiraNome,
                                                         Percentual, Acertos, Total, AprovadoPreliminar, TempoGastoSegundos,
                                                         EnviadoEm, EditalId, NomeNormalizado)
                                   VALUES (@InscricaoId, @Nome, @Email, @Idade, @Cpf, @CarreiraId, @CarreiraNome,
                                           @Percentual, @Acertos, @Total, @AprovadoPreliminar, @TempoGastoSegundos,
                                           @EnviadoEm, @EditalId, @NomeNormalizado)",
                    new Dictionary<string, object?>
                    {
                        ["@InscricaoId"] = resultado.InscricaoId,
                        ["@Nome"] = resultado.Nome,
                        ["@Email"] = resultado.Email,
                        ["@Idade"] = resultado.Idade,
                        ["@Cpf"] = resultado.Cpf,
                        ["@CarreiraId"] = resultado.CarreiraId,
                        ["@CarreiraNome"] = resultado.CarreiraNome,
                        ["@Percentual"] = resultado.Percentual,
                        ["@Acertos"] = resultado.Acertos,
                        ["@Total"] = resultado.Total,
                        ["@AprovadoPreliminar"] = BoolToInt(resultado.AprovadoPreliminar),
                        ["@TempoGastoSegundos"] = resultado.TempoGastoSegundos,
                        ["@EnviadoEm"] = resultado.EnviadoEm.ToString("o"),
                        ["@EditalId"] = resultado.EditalId,
                        ["@NomeNormalizado"] = resultado.NomeNormalizado,
                    }, tx);

                if (resultado.Discursivas is not null)
                {
                    foreach (var discursiva in resultado.Discursivas)
                    {
                        ExecuteNonQuery(@"INSERT INTO Discursivas (InscricaoId, QuestaoId, Area, Resposta, Nota, NotaMaxima, Status, CorrigidaEm)
                                           VALUES (@InscricaoId, @QuestaoId, @Area, @Resposta, @Nota, @NotaMaxima, @Status, @CorrigidaEm)",
                            new Dictionary<string, object?>
                            {
                                ["@InscricaoId"] = resultado.InscricaoId,
                                ["@QuestaoId"] = discursiva.QuestaoId,
                                ["@Area"] = discursiva.Area,
                                ["@Resposta"] = discursiva.Resposta,
                                ["@Nota"] = discursiva.Nota,
                                ["@NotaMaxima"] = discursiva.NotaMaxima,
                                ["@Status"] = discursiva.Status,
                                ["@CorrigidaEm"] = discursiva.CorrigidaEm?.ToString("o"),
                            }, tx);
                    }
                }
            }

            tx.Commit();
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Falha ao persistir o estado no banco {Database}.", _database);
        }
    }

    private static string NormalizePostgresConnectionString(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "postgres" && uri.Scheme != "postgresql"))
        {
            return value;
        }

        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(0) ?? ""),
            Password = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(1) ?? ""),
            SslMode = SslMode.Require,
            TrustServerCertificate = true,
        };

        return builder.ConnectionString;
    }

    private static int BoolToInt(bool value) => value ? 1 : 0;

    private void ExecuteNonQuery(string sql, Dictionary<string, object?>? parameters, NpgsqlTransaction? tx)
    {
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = sql;
        if (tx is not null) cmd.Transaction = tx;
        if (parameters is not null)
        {
            foreach (var kv in parameters)
            {
                var param = cmd.CreateParameter();
                param.ParameterName = kv.Key;
                param.Value = kv.Value ?? DBNull.Value;
                cmd.Parameters.Add(param);
            }
        }
        cmd.ExecuteNonQuery();
    }
}
