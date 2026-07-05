namespace Pf.Api;

// ============================================================================
// Modelos de domínio (catálogo de questões/carreiras)
// ============================================================================

/// <summary>Alternativa de uma questão fechada.</summary>
public sealed record Alternativa(string Id, string Texto);

/// <summary>
/// Questão do banco. O campo <see cref="Gabarito"/> é de uso EXCLUSIVO do servidor
/// (correção) e nunca é serializado para o candidato — veja <see cref="ToPublica"/>.
/// </summary>
public sealed record Questao(
    string Id,
    string Area,
    string Tipo, // "fechada" | "aberta"
    string Enunciado,
    int Pontos,
    List<Alternativa>? Alternativas = null,
    string? Gabarito = null,
    int? LinhasSugeridas = null,
    string Dificuldade = "medio") // "facil" | "medio" | "dificil" — usado p/ sugerir nota de corte
{
    /// <summary>Versão pública (sem gabarito) enviada na prova.</summary>
    public QuestaoPublicaDto ToPublica() => new(
        Id, Area, Tipo, Enunciado, Pontos,
        Alternativas?.Select(a => new AlternativaDto(a.Id, a.Texto)).ToList(),
        LinhasSugeridas);
}

public sealed record Carreira(string Id, string Nome, int DuracaoMinutos, int VagasPadrao);

// ============================================================================
// Registros persistidos (estado em disco)
// ============================================================================

public sealed class EditalState
{
    public string Id { get; set; } = "";
    public bool Fechada { get; set; }
    public DateTimeOffset? AtualizadoEm { get; set; }
}

/// <summary>Configuração editável da prova (controlada pelo painel admin).</summary>
public sealed class ConfigCarreira
{
    public int Vagas { get; set; }
    public int DuracaoMinutos { get; set; }
}

public sealed class ProvaConfig
{
    public int NotaDeCorte { get; set; } = 60;          // % de acerto nas objetivas
    public int QuantidadeObjetivas { get; set; } = 10;  // quantas objetivas sortear por prova
    public int QuantidadeDiscursivas { get; set; } = 1; // quantas discursivas sortear por prova
    public Dictionary<string, ConfigCarreira> Carreiras { get; set; } = new();
}

/// <summary>Prova sorteada vigente — MESMA para todos os candidatos do edital.</summary>
public sealed class ProvaSelecionada
{
    public Dictionary<string, List<string>> PorCarreira { get; set; } = new(); // carreiraId -> ids (ordem fixa)
    public DateTimeOffset SorteadaEm { get; set; }
    public int NotaDeCorteSugerida { get; set; }
}

/// <summary>Resposta discursiva armazenada para correção pela banca.</summary>
public sealed class DiscursivaRespostaRecord
{
    public string QuestaoId { get; set; } = "";
    public string Area { get; set; } = "";
    public string Resposta { get; set; } = "";
    public double? Nota { get; set; }       // atribuída pela banca (0..NotaMaxima)
    public int NotaMaxima { get; set; }     // pontos da questão
    public string Status { get; set; } = "EM_ANALISE"; // EM_ANALISE | CORRIGIDA
    public DateTimeOffset? CorrigidaEm { get; set; }
}

public sealed class InscricaoRecord
{
    public string Id { get; set; } = "";
    public string Nome { get; set; } = "";
    public string Email { get; set; } = "";
    public int Idade { get; set; }
    public string Cpf { get; set; } = ""; // ID do Discord (RP)
    public string Carreira { get; set; } = "";
    public string Protocolo { get; set; } = "";
    public DateTimeOffset CriadoEm { get; set; }
    public string EditalId { get; set; } = "";

    /// <summary>Minutos extras de prova concedidos pela administração (compensação).</summary>
    public int ExtraMinutos { get; set; }

    public InscricaoResponse ToResponse() =>
        new(Id, Nome, Email, Idade, Cpf, Carreira, Protocolo, CriadoEm);
}

public sealed class ResultadoRecord
{
    public string InscricaoId { get; set; } = "";
    public string Nome { get; set; } = "";
    public string Email { get; set; } = "";
    public int Idade { get; set; }
    public string Cpf { get; set; } = "";
    public string CarreiraId { get; set; } = "";
    public string CarreiraNome { get; set; } = "";
    public int Percentual { get; set; }
    public int Acertos { get; set; }
    public int Total { get; set; }
    public bool AprovadoPreliminar { get; set; }
    public int? TempoGastoSegundos { get; set; }
    public DateTimeOffset EnviadoEm { get; set; }
    public string EditalId { get; set; } = "";

    /// <summary>Nome normalizado (sem acentos, minúsculo) usado na regra de tentativa única.</summary>
    public string NomeNormalizado { get; set; } = "";

    /// <summary>Respostas discursivas enviadas (para correção pela banca).</summary>
    public List<DiscursivaRespostaRecord> Discursivas { get; set; } = new();

    public ResultadoAdminDto ToAdminDto() =>
        new(InscricaoId, Nome, Email, Idade, Cpf, CarreiraId, CarreiraNome,
            Percentual, Acertos, Total, AprovadoPreliminar, TempoGastoSegundos, EnviadoEm);
}

/// <summary>
/// Sessão de prova em andamento, salva no SERVIDOR (backup do progresso do candidato).
/// Permite retomar a prova após perda do navegador/dispositivo e dá visibilidade
/// ao painel admin (quem está em prova, pausar, conceder tempo extra).
/// </summary>
public sealed class SessaoRecord
{
    public string InscricaoId { get; set; } = "";
    public long Inicio { get; set; } // epoch ms (mesmo formato usado pelo front)
    public Dictionary<string, string?> Respostas { get; set; } = new();
    public DateTimeOffset AtualizadoEm { get; set; }

    /// <summary>Quando pausada pela administração (o relógio "congela": ao retomar, o Inicio é deslocado).</summary>
    public DateTimeOffset? PausadaEm { get; set; }
}

public sealed class EstadoPersistente
{
    public EditalState Edital { get; set; } = new();
    public ProvaConfig Config { get; set; } = new();
    public ProvaSelecionada? Selecao { get; set; }
    public List<InscricaoRecord> Inscricoes { get; set; } = new();
    public List<ResultadoRecord> Resultados { get; set; } = new();
    public List<SessaoRecord> Sessoes { get; set; } = new();
}

// ============================================================================
// DTOs de requisição/resposta (contrato com o front — camelCase no JSON)
// ============================================================================

// --- Inscrição ---
public sealed record InscricaoRequest(
    string? Nome, string? Email, int? Idade, string? Cpf, string? Carreira);

public sealed record InscricaoResponse(
    string Id, string Nome, string Email, int Idade, string Cpf,
    string Carreira, string Protocolo, DateTimeOffset CriadoEm);

// --- Prova ---
public sealed record AlternativaDto(string Id, string Texto);

public sealed record QuestaoPublicaDto(
    string Id, string Area, string Tipo, string Enunciado, int Pontos,
    List<AlternativaDto>? Alternativas, int? LinhasSugeridas);

public sealed record ProvaResponse(
    string Carreira, string CarreiraId, int DuracaoMinutos,
    int TotalQuestoes, List<QuestaoPublicaDto> Questoes);

// --- Envio de respostas / correção ---
public sealed record CandidatoDto(string? Nome, string? Email, int? Idade, string? Cpf);

public sealed record RespostasRequest(
    string? InscricaoId,
    string? CarreiraId,
    Dictionary<string, string?>? Respostas,
    int? TempoGastoSegundos,
    string? FinalizadaPor,
    CandidatoDto? Candidato);

public sealed record ObjetivasDto(
    int Total, int Acertos, int Erros, int Percentual, int NotaDeCorte, bool AprovadoPreliminar);

public sealed record DiscursivaDto(string QuestaoId, string Area, string Resposta, string Status);

public sealed record CorrecaoResponse(
    string CarreiraId, DateTimeOffset CorrigidoEm, ObjetivasDto Objetivas, List<DiscursivaDto> Discursivas);

// --- Sessão de prova (backup no servidor / retomada) ---
public sealed record SessaoSalvarRequest(
    string? InscricaoId, long? Inicio, Dictionary<string, string?>? Respostas);

public sealed record SessaoDto(
    long Inicio, Dictionary<string, string?> Respostas, bool Pausada,
    int ExtraMinutos, DateTimeOffset AtualizadoEm);

// --- Admin: gestão de candidatos ---
public sealed record AdminSessaoDto(
    long Inicio, int QtdRespostas, bool Pausada, DateTimeOffset AtualizadoEm);

public sealed record AdminInscricaoDto(
    string Id, string Nome, string Email, int Idade, string Cpf,
    string CarreiraId, string CarreiraNome, string Protocolo, DateTimeOffset CriadoEm,
    int ExtraMinutos, bool Enviada, DateTimeOffset? EnviadaEm, int? Percentual,
    AdminSessaoDto? Sessao);

public sealed record InscricaoAcaoRequest(string? InscricaoId);

public sealed record TempoExtraRequest(string? InscricaoId, int? AdicionarMinutos);

public sealed record PausarRequest(string? InscricaoId, bool Pausar);

// --- Admin ---
public sealed record ResultadoAdminDto(
    string InscricaoId, string Nome, string Email, int Idade, string Cpf,
    string CarreiraId, string CarreiraNome, int Percentual, int Acertos, int Total,
    bool AprovadoPreliminar, int? TempoGastoSegundos, DateTimeOffset EnviadoEm);

public sealed record StatusDto(bool Fechada, DateTimeOffset? AtualizadoEm);

public sealed record StatusRequest(bool Fechada);

public sealed record NovoEditalRequest(string? Id);

// --- Configuração da prova ---
public sealed record ConfigCarreiraDto(
    string Id, string Nome, int Vagas, int DuracaoMinutos,
    int ObjetivasDisponiveis, int DiscursivasDisponiveis,
    int? ObjetivasSorteadas, int? DiscursivasSorteadas);

public sealed record ConfigDto(
    int NotaDeCorte, int QuantidadeObjetivas, int QuantidadeDiscursivas,
    int TotalVagas, bool Sorteada, DateTimeOffset? SorteadaEm, int? NotaDeCorteSugerida,
    List<ConfigCarreiraDto> Carreiras);

public sealed record ConfigCarreiraUpdate(string? Id, int? Vagas, int? DuracaoMinutos);

public sealed record ConfigUpdateRequest(
    int? NotaDeCorte, int? QuantidadeObjetivas, int? QuantidadeDiscursivas,
    List<ConfigCarreiraUpdate>? Carreiras);

// --- Sorteio da prova ---
public sealed record SortearCarreiraDto(
    string CarreiraId, string Nome, int Objetivas, int Discursivas,
    int Faceis, int Medias, int Dificeis);

public sealed record SortearResponse(
    DateTimeOffset SorteadaEm, int NotaDeCorteSugerida, List<SortearCarreiraDto> Carreiras);

// --- Correção de discursivas ---
public sealed record DiscursivaItemDto(
    string QuestaoId, string Area, string Enunciado, string Resposta,
    double? Nota, int NotaMaxima, string Status);

public sealed record DiscursivaSubmissaoDto(
    string InscricaoId, string Nome, string Email, string CarreiraId, string CarreiraNome,
    DateTimeOffset EnviadoEm, List<DiscursivaItemDto> Discursivas);

public sealed record CorrigirDiscursivaRequest(
    string? InscricaoId, string? QuestaoId, double? Nota, string? Status);

// --- Login do painel ---
public sealed record LoginRequest(string? Senha);
