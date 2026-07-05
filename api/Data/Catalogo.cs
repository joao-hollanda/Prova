namespace Pf.Api;

/// <summary>Carreiras do certame (espelha src/data/carreiras.js — apenas o que a API expõe).</summary>
public static class Carreiras
{
    private static readonly Dictionary<string, Carreira> _porId = new(StringComparer.OrdinalIgnoreCase)
    {
        ["agente"]   = new("agente", "Agente de Polícia Federal", 90, 5),
        ["escrivao"] = new("escrivao", "Escrivão de Polícia Federal", 90, 3),
        ["perito"]   = new("perito", "Perito Criminal Federal", 100, 1),
        ["delegado"] = new("delegado", "Delegado de Polícia Federal", 120, 1),
    };

    public static IReadOnlyCollection<Carreira> Todas => _porId.Values;

    public static Carreira? Get(string? id) =>
        id is not null && _porId.TryGetValue(id, out var c) ? c : null;

    public static bool Existe(string? id) => id is not null && _porId.ContainsKey(id);
}

/// <summary>
/// Banco de questões (espelha src/data/questoes.js). O gabarito vive somente aqui e
/// é usado apenas pela correção no servidor — nunca trafega para o candidato.
/// </summary>
public static class Questoes
{
    private static Alternativa A(string id, string texto) => new(id, texto);

    private static readonly List<Questao> COMUM = new()
    {
        new("pt-01", "Língua Portuguesa", "fechada",
            "Assinale a alternativa em que o uso da CRASE está CORRETO.", 1,
            new() {
                A("a", "Entreguei o relatório à os escrivães."),
                A("b", "Refiro-me à reunião marcada para ontem."),
                A("c", "O suspeito saiu à pé da delegacia."),
                A("d", "Estou disposto a ir à qualquer lugar."),
                A("e", "Cheguei à uma hora qualquer."),
            }, "b"),
        new("pt-02", "Língua Portuguesa", "fechada",
            "Assinale a alternativa em que a CONCORDÂNCIA VERBAL está correta.", 1,
            new() {
                A("a", "Houveram vários crimes na região."),
                A("b", "Fazem dez anos que ele é policial."),
                A("c", "Existem muitas provas no processo."),
                A("d", "Tratam-se de casos complexos."),
                A("e", "Aluga-se casas no centro da cidade."),
            }, "c"),
        new("pt-03", "Língua Portuguesa", "fechada",
            "Complete corretamente: \"Não sei ____ ele não compareceu, mas o ____ de sua ausência será investigado.\"", 1,
            new() {
                A("a", "porque / por que"),
                A("b", "por que / porquê"),
                A("c", "porquê / por que"),
                A("d", "por quê / porque"),
                A("e", "por que / porque"),
            }, "b"),
        new("pt-04", "Língua Portuguesa", "fechada",
            "Na frase \"O policial é um leão na defesa da lei\", a figura de linguagem empregada é:", 1,
            new() {
                A("a", "metáfora"),
                A("b", "metonímia"),
                A("c", "hipérbole"),
                A("d", "eufemismo"),
                A("e", "ironia"),
            }, "a"),
        new("mat-01", "Matemática e Raciocínio Lógico", "fechada",
            "Um produto de R$ 200,00 teve aumento de 15% e, em seguida, um desconto de 10% sobre o novo preço. O preço final é:", 1,
            new() {
                A("a", "R$ 205,00"),
                A("b", "R$ 207,00"),
                A("c", "R$ 210,00"),
                A("d", "R$ 215,00"),
                A("e", "R$ 230,00"),
            }, "b"),
        new("mat-02", "Matemática e Raciocínio Lógico", "fechada",
            "Se 5 policiais revistam 20 veículos em 2 horas, mantendo o mesmo ritmo, quantos veículos 8 policiais revistam em 3 horas?", 1,
            new() {
                A("a", "36"),
                A("b", "40"),
                A("c", "44"),
                A("d", "48"),
                A("e", "52"),
            }, "d"),
        new("mat-03", "Matemática e Raciocínio Lógico", "fechada",
            "Em uma operação, o número de agentes é o triplo do número de delegados. Juntos somam 48 pessoas. Quantos são os delegados?", 1,
            new() {
                A("a", "8"),
                A("b", "12"),
                A("c", "16"),
                A("d", "24"),
                A("e", "36"),
            }, "b"),
        new("log-01", "Raciocínio Lógico", "fechada",
            "Observe a sequência: 2, 3, 5, 8, 12, ... Qual é o próximo número?", 1,
            new() {
                A("a", "15"),
                A("b", "16"),
                A("c", "17"),
                A("d", "18"),
                A("e", "20"),
            }, "c"),
        new("log-02", "Raciocínio Lógico", "fechada",
            "A negação lógica da afirmação \"Todos os suspeitos mentiram\" é:", 1,
            new() {
                A("a", "Nenhum suspeito mentiu."),
                A("b", "Todos os suspeitos falaram a verdade."),
                A("c", "Pelo menos um suspeito não mentiu."),
                A("d", "Alguns suspeitos mentiram."),
                A("e", "Nenhum suspeito falou a verdade."),
            }, "c"),
        new("cg-01", "Conhecimentos Gerais e Atualidades", "fechada",
            "A Polícia Federal exerce, entre outras, a função de polícia judiciária da União. Isso significa que ela atua principalmente:", 1,
            new() {
                A("a", "no patrulhamento ostensivo das ruas"),
                A("b", "na apuração de infrações penais, por meio de investigação e inquérito"),
                A("c", "na fiscalização de tributos municipais"),
                A("d", "na administração dos presídios federais"),
                A("e", "no controle do tráfego aéreo"),
            }, "b"),
        new("cg-02", "Conhecimentos Gerais e Atualidades", "fechada",
            "O Brasil é uma República Federativa. Uma das características desse modelo é que:", 1,
            new() {
                A("a", "o poder é exercido por um rei"),
                A("b", "estados e municípios possuem autonomia dentro da federação"),
                A("c", "não há divisão entre os Poderes"),
                A("d", "o país é governado pelas Forças Armadas"),
                A("e", "cada cidade é um país independente"),
            }, "b"),
        new("inf-01", "Informática", "fechada",
            "A autenticação em dois fatores (2FA) tem como principal objetivo:", 1,
            new() {
                A("a", "deixar o computador mais rápido"),
                A("b", "adicionar uma camada extra de segurança, exigindo uma segunda comprovação de identidade"),
                A("c", "aumentar o espaço de armazenamento"),
                A("d", "substituir totalmente o antivírus"),
                A("e", "bloquear o acesso à internet"),
            }, "b"),
        new("inf-02", "Informática", "fechada",
            "Qual das opções representa um endereço de IP (IPv4) VÁLIDO?", 1,
            new() {
                A("a", "256.300.1.1"),
                A("b", "192.168.0.1"),
                A("c", "www.policia.gov.br"),
                A("d", "192-168-0-1"),
                A("e", "192.168.0"),
            }, "b"),
        new("cid-01", "Cidadania e Noções de Direito", "fechada",
            "Segundo a Constituição Federal, são exemplos de crimes INAFIANÇÁVEIS e IMPRESCRITÍVEIS:", 1,
            new() {
                A("a", "o furto e o roubo"),
                A("b", "o racismo e a ação de grupos armados contra a ordem constitucional"),
                A("c", "os crimes de trânsito"),
                A("d", "as infrações administrativas"),
                A("e", "os crimes culposos em geral"),
            }, "b"),
        new("cid-02", "Cidadania e Noções de Direito", "fechada",
            "O princípio da presunção de inocência estabelece que ninguém será considerado culpado até:", 1,
            new() {
                A("a", "o registro do boletim de ocorrência"),
                A("b", "o indiciamento pela autoridade policial"),
                A("c", "o trânsito em julgado de sentença penal condenatória"),
                A("d", "o oferecimento da denúncia pelo Ministério Público"),
                A("e", "a prisão em flagrante"),
            }, "c"),
        new("disc-comum-01", "Questão Discursiva", "aberta",
            "Disserte sobre a importância da ética e da imparcialidade na atuação do policial federal, citando ao menos uma consequência negativa do abuso de autoridade para a sociedade.",
            10, Alternativas: null, Gabarito: null, LinhasSugeridas: 12),
    };

    private static readonly List<Questao> AGENTE = new()
    {
        new("ag-01", "Noções de Direito Penal", "fechada",
            "Considera-se em estado de FLAGRANTE DELITO o indivíduo que:", 1,
            new() {
                A("a", "é apenas suspeito, sem qualquer prova"),
                A("b", "está cometendo a infração penal ou acaba de cometê-la"),
                A("c", "foi condenado há vários anos"),
                A("d", "cometeu o crime há mais de uma semana"),
                A("e", "confessou o crime perante o juiz"),
            }, "b"),
        new("ag-02", "Noções de Direito Penal", "fechada",
            "A principal diferença entre a prisão em flagrante e a prisão preventiva é que:", 1,
            new() {
                A("a", "ambas são decretadas pelo próprio agente"),
                A("b", "o flagrante ocorre no momento do crime, enquanto a preventiva é determinada pela Justiça durante a investigação ou o processo"),
                A("c", "não existe diferença entre elas"),
                A("d", "a preventiva só ocorre após a condenação definitiva"),
                A("e", "o flagrante depende de mandado judicial prévio"),
            }, "b"),
        new("ag-03", "Noções de Direito Penal", "fechada",
            "Para realizar uma busca pessoal (revista), o agente deve:", 1,
            new() {
                A("a", "agir sem qualquer critério"),
                A("b", "ter fundada suspeita e respeitar a dignidade da pessoa abordada"),
                A("c", "revistar apenas pessoas conhecidas"),
                A("d", "divulgar o resultado nas redes sociais"),
                A("e", "cobrar uma taxa pela revista"),
            }, "b"),
        new("ag-04", "Noções de Direito Penal", "fechada",
            "A cadeia de custódia das provas tem como finalidade:", 1,
            new() {
                A("a", "acelerar o arquivamento do caso"),
                A("b", "garantir a integridade e a rastreabilidade das provas, do recolhimento até a análise"),
                A("c", "esconder evidências da defesa"),
                A("d", "substituir o trabalho do perito"),
                A("e", "definir a pena do réu"),
            }, "b"),
        new("disc-ag-01", "Questão Discursiva", "aberta",
            "Descreva os cuidados que um agente deve adotar para preservar o local de um crime até a chegada da perícia e explique por que esses cuidados são fundamentais para a investigação.",
            10, Alternativas: null, Gabarito: null, LinhasSugeridas: 12),
    };

    private static readonly List<Questao> ESCRIVAO = new()
    {
        new("es-01", "Direito e Processo Penal", "fechada",
            "No auto de prisão em flagrante, cabe ao escrivão de polícia:", 1,
            new() {
                A("a", "decretar a prisão preventiva do conduzido"),
                A("b", "reduzir a termo as declarações e lavrar o auto, garantindo a formalização do ato"),
                A("c", "definir a pena aplicável ao crime"),
                A("d", "julgar a legalidade da prisão"),
                A("e", "dispensar a presença de testemunhas"),
            }, "b"),
        new("es-02", "Direito e Processo Penal", "fechada",
            "Os atos lavrados pelo escrivão de polícia gozam de fé pública. Isso significa que:", 1,
            new() {
                A("a", "não podem jamais ser questionados"),
                A("b", "presumem-se verdadeiros até prova em contrário"),
                A("c", "têm valor de sentença judicial"),
                A("d", "dispensam a assinatura da autoridade policial"),
                A("e", "só valem se registrados em cartório extrajudicial"),
            }, "b"),
        new("es-03", "Raciocínio Lógico", "fechada",
            "Em um cartório policial, os inquéritos são autuados seguindo a sequência 3, 6, 11, 18, 27, ... Qual é o próximo número da sequência?", 1,
            new() {
                A("a", "34"),
                A("b", "36"),
                A("c", "38"),
                A("d", "40"),
                A("e", "41"),
            }, "c"),
        new("es-04", "Direito e Processo Penal", "fechada",
            "Ao formalizar o depoimento de uma testemunha durante o inquérito, o documento produzido pelo escrivão denomina-se:", 1,
            new() {
                A("a", "sentença"),
                A("b", "termo de declarações"),
                A("c", "denúncia"),
                A("d", "acórdão"),
                A("e", "habeas corpus"),
            }, "b"),
        new("disc-es-01", "Questão Discursiva", "aberta",
            "Explique a função do escrivão de polícia na formalização do inquérito policial e discorra sobre a importância da correta documentação dos atos para a validade da prova e o exercício da ampla defesa.",
            10, Alternativas: null, Gabarito: null, LinhasSugeridas: 12),
    };

    private static readonly List<Questao> PERITO = new()
    {
        new("pe-01", "Criminalística", "fechada",
            "O exame de corpo de delito é indispensável nas infrações que:", 1,
            new() {
                A("a", "são confessadas pelo autor"),
                A("b", "deixam vestígios (delitos não transeuntes)"),
                A("c", "ocorrem durante a noite"),
                A("d", "envolvem valores em dinheiro"),
                A("e", "nenhuma, pois o exame foi abolido"),
            }, "b"),
        new("pe-02", "Ciências da Natureza", "fechada",
            "Na combustão COMPLETA do metano (CH₄), os produtos formados são:", 1,
            new() {
                A("a", "CO e H₂"),
                A("b", "CO₂ e H₂O"),
                A("c", "C e O₂"),
                A("d", "NaCl e H₂O"),
                A("e", "apenas O₂"),
            }, "b"),
        new("pe-03", "Ciências da Natureza", "fechada",
            "Um corpo de massa 10 kg sofre a ação de uma força resultante de 20 N. Pela 2ª Lei de Newton (F = m · a), sua aceleração é:", 1,
            new() {
                A("a", "0,5 m/s²"),
                A("b", "2 m/s²"),
                A("c", "10 m/s²"),
                A("d", "200 m/s²"),
                A("e", "30 m/s²"),
            }, "b"),
        new("pe-04", "Criminalística", "fechada",
            "A balística forense que estuda o movimento do projétil DENTRO do cano da arma de fogo é a balística:", 1,
            new() {
                A("a", "externa"),
                A("b", "interna"),
                A("c", "terminal"),
                A("d", "digital"),
                A("e", "química"),
            }, "b"),
        new("pe-05", "Criminalística", "fechada",
            "A análise de DNA é amplamente usada na identificação humana porque o DNA:", 1,
            new() {
                A("a", "é igual entre todas as pessoas"),
                A("b", "é praticamente único em cada indivíduo (salvo gêmeos univitelinos)"),
                A("c", "desaparece logo após a morte"),
                A("d", "existe apenas nos fios de cabelo"),
                A("e", "muda completamente todos os dias"),
            }, "b"),
        new("disc-pe-01", "Questão Discursiva", "aberta",
            "Explique o conceito de cadeia de custódia da prova e descreva as consequências de sua quebra para a validade de um laudo pericial.",
            10, Alternativas: null, Gabarito: null, LinhasSugeridas: 12),
    };

    private static readonly List<Questao> DELEGADO = new()
    {
        new("de-01", "Direito Processual Penal", "fechada",
            "A decretação da prisão preventiva é de competência:", 1,
            new() {
                A("a", "do delegado de polícia"),
                A("b", "do Ministério Público"),
                A("c", "da autoridade judiciária (juiz)"),
                A("d", "do agente de polícia"),
                A("e", "do governador do estado"),
            }, "c"),
        new("de-02", "Direito Constitucional", "fechada",
            "O habeas corpus é o remédio constitucional cabível para proteger:", 1,
            new() {
                A("a", "o direito de propriedade"),
                A("b", "a liberdade de locomoção ameaçada por ilegalidade ou abuso de poder"),
                A("c", "a correção de dados pessoais incorretos"),
                A("d", "o direito ao voto"),
                A("e", "o pagamento de salários atrasados"),
            }, "b"),
        new("de-03", "Direito Processual Penal", "fechada",
            "A ação penal pública incondicionada é promovida:", 1,
            new() {
                A("a", "pela vítima, por meio de queixa-crime"),
                A("b", "pelo Ministério Público, independentemente de representação da vítima"),
                A("c", "pelo juiz, de ofício"),
                A("d", "pelo delegado de polícia"),
                A("e", "por qualquer cidadão interessado"),
            }, "b"),
        new("de-04", "Direito Constitucional", "fechada",
            "Os crimes DOLOSOS contra a vida são julgados pelo:", 1,
            new() {
                A("a", "juiz singular"),
                A("b", "Tribunal do Júri"),
                A("c", "Supremo Tribunal Federal"),
                A("d", "delegado de polícia"),
                A("e", "Tribunal de Contas"),
            }, "b"),
        new("de-05", "Direito Processual Penal", "fechada",
            "Quanto à sua natureza, o inquérito policial é um procedimento:", 1,
            new() {
                A("a", "judicial e contraditório"),
                A("b", "administrativo, inquisitivo e prévio à ação penal"),
                A("c", "legislativo"),
                A("d", "facultativo e sem qualquer valor probatório"),
                A("e", "definitivo quanto à culpa do investigado"),
            }, "b"),
        new("disc-de-01", "Questão Discursiva", "aberta",
            "Disserte sobre a importância da fundamentação das decisões da autoridade policial no inquérito e sua relação com o devido processo legal e a ampla defesa.",
            10, Alternativas: null, Gabarito: null, LinhasSugeridas: 15),
    };

    private static readonly Dictionary<string, List<Questao>> ESPECIFICAS = new(StringComparer.OrdinalIgnoreCase)
    {
        ["agente"]   = AGENTE,
        ["escrivao"] = ESCRIVAO,
        ["perito"]   = PERITO,
        ["delegado"] = DELEGADO,
    };

    // Nível de dificuldade por questão (facil=1, medio=2, dificil=3). Toda questão tem um nível;
    // ele alimenta a sugestão de nota de corte após o sorteio.
    private static readonly Dictionary<string, string> DIFICULDADES = new(StringComparer.OrdinalIgnoreCase)
    {
        // COMUM
        ["pt-01"] = "medio",  ["pt-02"] = "medio",  ["pt-03"] = "dificil", ["pt-04"] = "facil",
        ["mat-01"] = "medio", ["mat-02"] = "dificil", ["mat-03"] = "facil",
        ["log-01"] = "medio", ["log-02"] = "dificil",
        ["cg-01"] = "facil",  ["cg-02"] = "facil",
        ["inf-01"] = "facil", ["inf-02"] = "medio",
        ["cid-01"] = "dificil", ["cid-02"] = "medio",
        ["disc-comum-01"] = "medio",
        // AGENTE
        ["ag-01"] = "facil", ["ag-02"] = "medio", ["ag-03"] = "medio", ["ag-04"] = "dificil",
        ["disc-ag-01"] = "medio",
        // ESCRIVAO
        ["es-01"] = "medio", ["es-02"] = "medio", ["es-03"] = "dificil", ["es-04"] = "medio",
        ["disc-es-01"] = "medio",
        // PERITO
        ["pe-01"] = "medio", ["pe-02"] = "medio", ["pe-03"] = "facil", ["pe-04"] = "medio", ["pe-05"] = "facil",
        ["disc-pe-01"] = "medio",
        // DELEGADO
        ["de-01"] = "medio", ["de-02"] = "facil", ["de-03"] = "dificil", ["de-04"] = "facil", ["de-05"] = "dificil",
        ["disc-de-01"] = "medio",
    };

    /// <summary>Banco completo (com gabarito + dificuldade) — uso interno do servidor.</summary>
    public static List<Questao> MontarBanco(string carreiraId)
    {
        var especificas = ESPECIFICAS.TryGetValue(carreiraId, out var lista) ? lista : new List<Questao>();
        return COMUM.Concat(especificas)
            .Select(q => q with { Dificuldade = DIFICULDADES.GetValueOrDefault(q.Id, "medio") })
            .ToList();
    }

    public static double PesoDificuldade(string dificuldade) => dificuldade switch
    {
        "facil" => 1.0,
        "dificil" => 3.0,
        _ => 2.0,
    };

    /// <summary>
    /// Sugere a nota de corte (%) a partir da dificuldade das objetivas sorteadas:
    /// prova mais fácil → corte mais alto; mais difícil → corte mais baixo. Arredonda a 5 e limita a [40, 90].
    /// </summary>
    public static int SugerirNotaDeCorte(IEnumerable<Questao> objetivas)
    {
        var pesos = objetivas.Select(q => PesoDificuldade(q.Dificuldade)).ToList();
        if (pesos.Count == 0) return 60;
        var media = pesos.Average();                 // [1..3]
        var sugerido = 80.0 - (media - 1.0) * 15.0;  // 1→80, 2→65, 3→50
        var arredondado = (int)(Math.Round(sugerido / 5.0) * 5);
        return Math.Clamp(arredondado, 40, 90);
    }
}

/// <summary>Correção no servidor — usa o banco ATIVO (sorteado) e a nota de corte configurada.</summary>
public static class Correcao
{
    public static CorrecaoResponse Corrigir(
        string carreiraId,
        IReadOnlyList<Questao> banco,
        int notaDeCorte,
        IReadOnlyDictionary<string, string?> respostas)
    {
        var fechadas = banco.Where(q => q.Tipo == "fechada").ToList();
        var abertas = banco.Where(q => q.Tipo == "aberta").ToList();

        // Conta apenas os acertos. O gabarito NÃO é exposto ao candidato (evita cola).
        var acertos = 0;
        foreach (var q in fechadas)
        {
            respostas.TryGetValue(q.Id, out var marcada);
            if (marcada is not null && marcada == q.Gabarito) acertos++;
        }

        var total = fechadas.Count;
        // Math.round do JS (meio para cima); percentuais são sempre >= 0.
        var percentual = total > 0
            ? (int)Math.Round((double)acertos / total * 100, MidpointRounding.AwayFromZero)
            : 0;

        var discursivas = abertas.Select(q =>
        {
            respostas.TryGetValue(q.Id, out var texto);
            return new DiscursivaDto(q.Id, q.Area, (texto ?? "").Trim(), "EM_ANALISE");
        }).ToList();

        var objetivas = new ObjetivasDto(
            Total: total,
            Acertos: acertos,
            Erros: total - acertos,
            Percentual: percentual,
            NotaDeCorte: notaDeCorte,
            AprovadoPreliminar: percentual >= notaDeCorte);

        return new CorrecaoResponse(carreiraId, DateTimeOffset.UtcNow, objetivas, discursivas);
    }
}
