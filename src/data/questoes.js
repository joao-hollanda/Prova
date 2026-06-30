// Banco de questões do certame — nível médio/concurso (questões mais difíceis).
//
// Estrutura de cada questão:
//   { id, area, tipo: 'fechada' | 'aberta', enunciado,
//     alternativas?: [{ id, texto }], gabarito?, pontos, linhasSugeridas? }
//
// Observação: o campo `gabarito` NUNCA é enviado ao candidato pela função getProva().
// Ele é usado apenas pelo serviço de correção (mock) — assim espelhamos uma API real,
// em que a correção acontece no servidor C#.

// ----------------------------------------------------------------------------
// QUESTÕES COMUNS A TODAS AS CARREIRAS
// ----------------------------------------------------------------------------
const COMUM = [
  {
    id: 'pt-01',
    area: 'Língua Portuguesa',
    tipo: 'fechada',
    enunciado: 'Assinale a alternativa em que o uso da CRASE está CORRETO.',
    alternativas: [
      { id: 'a', texto: 'Entreguei o relatório à os investigadores.' },
      { id: 'b', texto: 'Refiro-me à reunião marcada para ontem.' },
      { id: 'c', texto: 'O suspeito saiu à pé da delegacia.' },
      { id: 'd', texto: 'Estou disposto a ir à qualquer lugar.' },
      { id: 'e', texto: 'Cheguei à uma hora qualquer.' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'pt-02',
    area: 'Língua Portuguesa',
    tipo: 'fechada',
    enunciado: 'Assinale a alternativa em que a CONCORDÂNCIA VERBAL está correta.',
    alternativas: [
      { id: 'a', texto: 'Houveram vários crimes na região.' },
      { id: 'b', texto: 'Fazem dez anos que ele é policial.' },
      { id: 'c', texto: 'Existem muitas provas no processo.' },
      { id: 'd', texto: 'Tratam-se de casos complexos.' },
      { id: 'e', texto: 'Aluga-se casas no centro da cidade.' },
    ],
    gabarito: 'c',
    pontos: 1,
  },
  {
    id: 'pt-03',
    area: 'Língua Portuguesa',
    tipo: 'fechada',
    enunciado:
      'Complete corretamente: "Não sei ____ ele não compareceu, mas o ____ de sua ausência será investigado."',
    alternativas: [
      { id: 'a', texto: 'porque / por que' },
      { id: 'b', texto: 'por que / porquê' },
      { id: 'c', texto: 'porquê / por que' },
      { id: 'd', texto: 'por quê / porque' },
      { id: 'e', texto: 'por que / porque' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'pt-04',
    area: 'Língua Portuguesa',
    tipo: 'fechada',
    enunciado: 'Na frase "O policial é um leão na defesa da lei", a figura de linguagem empregada é:',
    alternativas: [
      { id: 'a', texto: 'metáfora' },
      { id: 'b', texto: 'metonímia' },
      { id: 'c', texto: 'hipérbole' },
      { id: 'd', texto: 'eufemismo' },
      { id: 'e', texto: 'ironia' },
    ],
    gabarito: 'a',
    pontos: 1,
  },
  {
    id: 'mat-01',
    area: 'Matemática e Raciocínio Lógico',
    tipo: 'fechada',
    enunciado:
      'Um produto de R$ 200,00 teve aumento de 15% e, em seguida, um desconto de 10% sobre o novo preço. O preço final é:',
    alternativas: [
      { id: 'a', texto: 'R$ 205,00' },
      { id: 'b', texto: 'R$ 207,00' },
      { id: 'c', texto: 'R$ 210,00' },
      { id: 'd', texto: 'R$ 215,00' },
      { id: 'e', texto: 'R$ 230,00' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'mat-02',
    area: 'Matemática e Raciocínio Lógico',
    tipo: 'fechada',
    enunciado:
      'Se 5 policiais revistam 20 veículos em 2 horas, mantendo o mesmo ritmo, quantos veículos 8 policiais revistam em 3 horas?',
    alternativas: [
      { id: 'a', texto: '36' },
      { id: 'b', texto: '40' },
      { id: 'c', texto: '44' },
      { id: 'd', texto: '48' },
      { id: 'e', texto: '52' },
    ],
    gabarito: 'd',
    pontos: 1,
  },
  {
    id: 'mat-03',
    area: 'Matemática e Raciocínio Lógico',
    tipo: 'fechada',
    enunciado:
      'Em uma operação, o número de agentes é o triplo do número de delegados. Juntos somam 48 pessoas. Quantos são os delegados?',
    alternativas: [
      { id: 'a', texto: '8' },
      { id: 'b', texto: '12' },
      { id: 'c', texto: '16' },
      { id: 'd', texto: '24' },
      { id: 'e', texto: '36' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'log-01',
    area: 'Raciocínio Lógico',
    tipo: 'fechada',
    enunciado: 'Observe a sequência: 2, 3, 5, 8, 12, ... Qual é o próximo número?',
    alternativas: [
      { id: 'a', texto: '15' },
      { id: 'b', texto: '16' },
      { id: 'c', texto: '17' },
      { id: 'd', texto: '18' },
      { id: 'e', texto: '20' },
    ],
    gabarito: 'c',
    pontos: 1,
  },
  {
    id: 'log-02',
    area: 'Raciocínio Lógico',
    tipo: 'fechada',
    enunciado: 'A negação lógica da afirmação "Todos os suspeitos mentiram" é:',
    alternativas: [
      { id: 'a', texto: 'Nenhum suspeito mentiu.' },
      { id: 'b', texto: 'Todos os suspeitos falaram a verdade.' },
      { id: 'c', texto: 'Pelo menos um suspeito não mentiu.' },
      { id: 'd', texto: 'Alguns suspeitos mentiram.' },
      { id: 'e', texto: 'Nenhum suspeito falou a verdade.' },
    ],
    gabarito: 'c',
    pontos: 1,
  },
  {
    id: 'cg-01',
    area: 'Conhecimentos Gerais e Atualidades',
    tipo: 'fechada',
    enunciado:
      'A Polícia Civil exerce a função de polícia judiciária. Isso significa que ela atua principalmente:',
    alternativas: [
      { id: 'a', texto: 'no patrulhamento ostensivo das ruas' },
      { id: 'b', texto: 'na apuração de infrações penais, por meio de investigação e inquérito' },
      { id: 'c', texto: 'na fiscalização de tributos' },
      { id: 'd', texto: 'na guarda das fronteiras do país' },
      { id: 'e', texto: 'no controle do tráfego aéreo' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'cg-02',
    area: 'Conhecimentos Gerais e Atualidades',
    tipo: 'fechada',
    enunciado: 'O Brasil é uma República Federativa. Uma das características desse modelo é que:',
    alternativas: [
      { id: 'a', texto: 'o poder é exercido por um rei' },
      { id: 'b', texto: 'estados e municípios possuem autonomia dentro da federação' },
      { id: 'c', texto: 'não há divisão entre os Poderes' },
      { id: 'd', texto: 'o país é governado pelas Forças Armadas' },
      { id: 'e', texto: 'cada cidade é um país independente' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'inf-01',
    area: 'Informática',
    tipo: 'fechada',
    enunciado: 'A autenticação em dois fatores (2FA) tem como principal objetivo:',
    alternativas: [
      { id: 'a', texto: 'deixar o computador mais rápido' },
      { id: 'b', texto: 'adicionar uma camada extra de segurança, exigindo uma segunda comprovação de identidade' },
      { id: 'c', texto: 'aumentar o espaço de armazenamento' },
      { id: 'd', texto: 'substituir totalmente o antivírus' },
      { id: 'e', texto: 'bloquear o acesso à internet' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'inf-02',
    area: 'Informática',
    tipo: 'fechada',
    enunciado: 'Qual das opções representa um endereço de IP (IPv4) VÁLIDO?',
    alternativas: [
      { id: 'a', texto: '256.300.1.1' },
      { id: 'b', texto: '192.168.0.1' },
      { id: 'c', texto: 'www.policia.gov.br' },
      { id: 'd', texto: '192-168-0-1' },
      { id: 'e', texto: '192.168.0' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'cid-01',
    area: 'Cidadania e Noções de Direito',
    tipo: 'fechada',
    enunciado: 'Segundo a Constituição Federal, são exemplos de crimes INAFIANÇÁVEIS e IMPRESCRITÍVEIS:',
    alternativas: [
      { id: 'a', texto: 'o furto e o roubo' },
      { id: 'b', texto: 'o racismo e a ação de grupos armados contra a ordem constitucional' },
      { id: 'c', texto: 'os crimes de trânsito' },
      { id: 'd', texto: 'as infrações administrativas' },
      { id: 'e', texto: 'os crimes culposos em geral' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'cid-02',
    area: 'Cidadania e Noções de Direito',
    tipo: 'fechada',
    enunciado: 'O princípio da presunção de inocência estabelece que ninguém será considerado culpado até:',
    alternativas: [
      { id: 'a', texto: 'o registro do boletim de ocorrência' },
      { id: 'b', texto: 'o indiciamento pela autoridade policial' },
      { id: 'c', texto: 'o trânsito em julgado de sentença penal condenatória' },
      { id: 'd', texto: 'o oferecimento da denúncia pelo Ministério Público' },
      { id: 'e', texto: 'a prisão em flagrante' },
    ],
    gabarito: 'c',
    pontos: 1,
  },
  {
    id: 'disc-comum-01',
    area: 'Questão Discursiva',
    tipo: 'aberta',
    enunciado:
      'Disserte sobre a importância da ética e da imparcialidade na atuação do policial civil, citando ao menos uma consequência negativa do abuso de autoridade para a sociedade.',
    pontos: 10,
    linhasSugeridas: 12,
  },
]

// ----------------------------------------------------------------------------
// QUESTÕES ESPECÍFICAS POR CARREIRA
// ----------------------------------------------------------------------------
const AGENTE = [
  {
    id: 'ag-01',
    area: 'Noções de Direito Penal',
    tipo: 'fechada',
    enunciado: 'Considera-se em estado de FLAGRANTE DELITO o indivíduo que:',
    alternativas: [
      { id: 'a', texto: 'é apenas suspeito, sem qualquer prova' },
      { id: 'b', texto: 'está cometendo a infração penal ou acaba de cometê-la' },
      { id: 'c', texto: 'foi condenado há vários anos' },
      { id: 'd', texto: 'cometeu o crime há mais de uma semana' },
      { id: 'e', texto: 'confessou o crime perante o juiz' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'ag-02',
    area: 'Noções de Direito Penal',
    tipo: 'fechada',
    enunciado: 'A principal diferença entre a prisão em flagrante e a prisão preventiva é que:',
    alternativas: [
      { id: 'a', texto: 'ambas são decretadas pelo próprio agente' },
      { id: 'b', texto: 'o flagrante ocorre no momento do crime, enquanto a preventiva é determinada pela Justiça durante a investigação ou o processo' },
      { id: 'c', texto: 'não existe diferença entre elas' },
      { id: 'd', texto: 'a preventiva só ocorre após a condenação definitiva' },
      { id: 'e', texto: 'o flagrante depende de mandado judicial prévio' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'ag-03',
    area: 'Noções de Direito Penal',
    tipo: 'fechada',
    enunciado: 'Para realizar uma busca pessoal (revista), o agente deve:',
    alternativas: [
      { id: 'a', texto: 'agir sem qualquer critério' },
      { id: 'b', texto: 'ter fundada suspeita e respeitar a dignidade da pessoa abordada' },
      { id: 'c', texto: 'revistar apenas pessoas conhecidas' },
      { id: 'd', texto: 'divulgar o resultado nas redes sociais' },
      { id: 'e', texto: 'cobrar uma taxa pela revista' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'ag-04',
    area: 'Noções de Direito Penal',
    tipo: 'fechada',
    enunciado: 'A cadeia de custódia das provas tem como finalidade:',
    alternativas: [
      { id: 'a', texto: 'acelerar o arquivamento do caso' },
      { id: 'b', texto: 'garantir a integridade e a rastreabilidade das provas, do recolhimento até a análise' },
      { id: 'c', texto: 'esconder evidências da defesa' },
      { id: 'd', texto: 'substituir o trabalho do perito' },
      { id: 'e', texto: 'definir a pena do réu' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'disc-ag-01',
    area: 'Questão Discursiva',
    tipo: 'aberta',
    enunciado:
      'Descreva os cuidados que um agente deve adotar para preservar o local de um crime até a chegada da perícia e explique por que esses cuidados são fundamentais para a investigação.',
    pontos: 10,
    linhasSugeridas: 12,
  },
]

const INVESTIGADOR = [
  {
    id: 'in-01',
    area: 'Direito e Investigação',
    tipo: 'fechada',
    enunciado: 'A interceptação telefônica para fins de investigação criminal só é válida quando:',
    alternativas: [
      { id: 'a', texto: 'o delegado decide sozinho realizá-la' },
      { id: 'b', texto: 'há autorização judicial, nos termos da lei' },
      { id: 'c', texto: 'a vítima pede verbalmente' },
      { id: 'd', texto: 'qualquer agente julgar necessário' },
      { id: 'e', texto: 'é feita em sigilo, sem qualquer regra' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'in-02',
    area: 'Direito e Investigação',
    tipo: 'fechada',
    enunciado: 'No processo penal, o "indício" é definido como:',
    alternativas: [
      { id: 'a', texto: 'uma prova plena e definitiva da culpa' },
      { id: 'b', texto: 'a circunstância conhecida e provada que, tendo relação com o fato, autoriza concluir a existência de outra' },
      { id: 'c', texto: 'um simples boato sem comprovação' },
      { id: 'd', texto: 'a confissão espontânea do réu' },
      { id: 'e', texto: 'a sentença proferida pelo juiz' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'in-03',
    area: 'Raciocínio Lógico',
    tipo: 'fechada',
    enunciado:
      'Três suspeitos foram ouvidos. A afirma: "Fui eu". B afirma: "A está mentindo". C afirma: "Não fui eu". Sabendo que APENAS UM falou a verdade, quem necessariamente disse a verdade?',
    alternativas: [
      { id: 'a', texto: 'A' },
      { id: 'b', texto: 'B' },
      { id: 'c', texto: 'C' },
      { id: 'd', texto: 'É impossível determinar' },
      { id: 'e', texto: 'Todos disseram a verdade' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'in-04',
    area: 'Direito e Investigação',
    tipo: 'fechada',
    enunciado: 'A colaboração premiada é um instrumento de investigação no qual:',
    alternativas: [
      { id: 'a', texto: 'o investigado é obrigado a confessar' },
      { id: 'b', texto: 'o colaborador recebe benefícios legais ao auxiliar de forma efetiva a investigação ou o processo' },
      { id: 'c', texto: 'o juiz interroga apenas a vítima' },
      { id: 'd', texto: 'a polícia produz provas falsas' },
      { id: 'e', texto: 'o caso é automaticamente arquivado' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'disc-in-01',
    area: 'Questão Discursiva',
    tipo: 'aberta',
    enunciado:
      'Explique como o investigador pode utilizar provas testemunhais e materiais para identificar a autoria de um crime, sempre respeitando os direitos fundamentais do investigado.',
    pontos: 10,
    linhasSugeridas: 12,
  },
]

const PERITO = [
  {
    id: 'pe-01',
    area: 'Criminalística',
    tipo: 'fechada',
    enunciado: 'O exame de corpo de delito é indispensável nas infrações que:',
    alternativas: [
      { id: 'a', texto: 'são confessadas pelo autor' },
      { id: 'b', texto: 'deixam vestígios (delitos não transeuntes)' },
      { id: 'c', texto: 'ocorrem durante a noite' },
      { id: 'd', texto: 'envolvem valores em dinheiro' },
      { id: 'e', texto: 'nenhuma, pois o exame foi abolido' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'pe-02',
    area: 'Ciências da Natureza',
    tipo: 'fechada',
    enunciado: 'Na combustão COMPLETA do metano (CH₄), os produtos formados são:',
    alternativas: [
      { id: 'a', texto: 'CO e H₂' },
      { id: 'b', texto: 'CO₂ e H₂O' },
      { id: 'c', texto: 'C e O₂' },
      { id: 'd', texto: 'NaCl e H₂O' },
      { id: 'e', texto: 'apenas O₂' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'pe-03',
    area: 'Ciências da Natureza',
    tipo: 'fechada',
    enunciado:
      'Um corpo de massa 10 kg sofre a ação de uma força resultante de 20 N. Pela 2ª Lei de Newton (F = m · a), sua aceleração é:',
    alternativas: [
      { id: 'a', texto: '0,5 m/s²' },
      { id: 'b', texto: '2 m/s²' },
      { id: 'c', texto: '10 m/s²' },
      { id: 'd', texto: '200 m/s²' },
      { id: 'e', texto: '30 m/s²' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'pe-04',
    area: 'Criminalística',
    tipo: 'fechada',
    enunciado: 'A balística forense que estuda o movimento do projétil DENTRO do cano da arma de fogo é a balística:',
    alternativas: [
      { id: 'a', texto: 'externa' },
      { id: 'b', texto: 'interna' },
      { id: 'c', texto: 'terminal' },
      { id: 'd', texto: 'digital' },
      { id: 'e', texto: 'química' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'pe-05',
    area: 'Criminalística',
    tipo: 'fechada',
    enunciado: 'A análise de DNA é amplamente usada na identificação humana porque o DNA:',
    alternativas: [
      { id: 'a', texto: 'é igual entre todas as pessoas' },
      { id: 'b', texto: 'é praticamente único em cada indivíduo (salvo gêmeos univitelinos)' },
      { id: 'c', texto: 'desaparece logo após a morte' },
      { id: 'd', texto: 'existe apenas nos fios de cabelo' },
      { id: 'e', texto: 'muda completamente todos os dias' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'disc-pe-01',
    area: 'Questão Discursiva',
    tipo: 'aberta',
    enunciado:
      'Explique o conceito de cadeia de custódia da prova e descreva as consequências de sua quebra para a validade de um laudo pericial.',
    pontos: 10,
    linhasSugeridas: 12,
  },
]

const DELEGADO = [
  {
    id: 'de-01',
    area: 'Direito Processual Penal',
    tipo: 'fechada',
    enunciado: 'A decretação da prisão preventiva é de competência:',
    alternativas: [
      { id: 'a', texto: 'do delegado de polícia' },
      { id: 'b', texto: 'do Ministério Público' },
      { id: 'c', texto: 'da autoridade judiciária (juiz)' },
      { id: 'd', texto: 'do agente de polícia' },
      { id: 'e', texto: 'do governador do estado' },
    ],
    gabarito: 'c',
    pontos: 1,
  },
  {
    id: 'de-02',
    area: 'Direito Constitucional',
    tipo: 'fechada',
    enunciado: 'O habeas corpus é o remédio constitucional cabível para proteger:',
    alternativas: [
      { id: 'a', texto: 'o direito de propriedade' },
      { id: 'b', texto: 'a liberdade de locomoção ameaçada por ilegalidade ou abuso de poder' },
      { id: 'c', texto: 'a correção de dados pessoais incorretos' },
      { id: 'd', texto: 'o direito ao voto' },
      { id: 'e', texto: 'o pagamento de salários atrasados' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'de-03',
    area: 'Direito Processual Penal',
    tipo: 'fechada',
    enunciado: 'A ação penal pública incondicionada é promovida:',
    alternativas: [
      { id: 'a', texto: 'pela vítima, por meio de queixa-crime' },
      { id: 'b', texto: 'pelo Ministério Público, independentemente de representação da vítima' },
      { id: 'c', texto: 'pelo juiz, de ofício' },
      { id: 'd', texto: 'pelo delegado de polícia' },
      { id: 'e', texto: 'por qualquer cidadão interessado' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'de-04',
    area: 'Direito Constitucional',
    tipo: 'fechada',
    enunciado: 'Os crimes DOLOSOS contra a vida são julgados pelo:',
    alternativas: [
      { id: 'a', texto: 'juiz singular' },
      { id: 'b', texto: 'Tribunal do Júri' },
      { id: 'c', texto: 'Supremo Tribunal Federal' },
      { id: 'd', texto: 'delegado de polícia' },
      { id: 'e', texto: 'Tribunal de Contas' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'de-05',
    area: 'Direito Processual Penal',
    tipo: 'fechada',
    enunciado: 'Quanto à sua natureza, o inquérito policial é um procedimento:',
    alternativas: [
      { id: 'a', texto: 'judicial e contraditório' },
      { id: 'b', texto: 'administrativo, inquisitivo e prévio à ação penal' },
      { id: 'c', texto: 'legislativo' },
      { id: 'd', texto: 'facultativo e sem qualquer valor probatório' },
      { id: 'e', texto: 'definitivo quanto à culpa do investigado' },
    ],
    gabarito: 'b',
    pontos: 1,
  },
  {
    id: 'disc-de-01',
    area: 'Questão Discursiva',
    tipo: 'aberta',
    enunciado:
      'Disserte sobre a importância da fundamentação das decisões da autoridade policial no inquérito e sua relação com o devido processo legal e a ampla defesa.',
    pontos: 10,
    linhasSugeridas: 15,
  },
]

const ESPECIFICAS = {
  agente: AGENTE,
  investigador: INVESTIGADOR,
  perito: PERITO,
  delegado: DELEGADO,
}

/** Banco completo (com gabarito) — uso interno do serviço de correção. */
export function montarBanco(carreiraId) {
  const especificas = ESPECIFICAS[carreiraId] || []
  return [...COMUM, ...especificas]
}
