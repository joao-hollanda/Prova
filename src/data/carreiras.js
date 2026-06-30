// Carreiras disponíveis no certame (contexto de RP).

export const CARREIRAS = [
  {
    id: 'agente',
    nome: 'Agente de Polícia',
    escolaridade: 'Ensino Superior Completo',
    descricao:
      'Atua no apoio às investigações, cumprimento de mandados, diligências de campo e segurança das operações policiais.',
    vagas: 5,
    duracaoMinutos: 90,
    areas: ['Língua Portuguesa', 'Matemática e Raciocínio Lógico', 'Conhecimentos Gerais', 'Informática', 'Noções de Direito Penal'],
  },
  {
    id: 'investigador',
    nome: 'Investigador de Polícia',
    escolaridade: 'Ensino Superior Completo',
    descricao:
      'Responsável pela coleta de informações, levantamento de provas, campanas e identificação de autoria de delitos.',
    vagas: 3,
    duracaoMinutos: 90,
    areas: ['Língua Portuguesa', 'Matemática e Raciocínio Lógico', 'Conhecimentos Gerais', 'Direito e Investigação', 'Informática'],
  },
  {
    id: 'perito',
    nome: 'Perito Criminal',
    escolaridade: 'Ensino Superior Completo (área técnica)',
    descricao:
      'Realiza exames periciais em locais de crime, análise de vestígios, balística, química e produção de laudos técnicos.',
    vagas: 1,
    duracaoMinutos: 100,
    areas: ['Língua Portuguesa', 'Ciências da Natureza', 'Criminalística', 'Matemática e Raciocínio Lógico', 'Informática'],
  },
  {
    id: 'delegado',
    nome: 'Delegado de Polícia',
    escolaridade: 'Bacharelado em Direito',
    descricao:
      'Autoridade policial que preside o inquérito, dirige a unidade policial e conduz juridicamente as investigações.',
    vagas: 1,
    duracaoMinutos: 120,
    areas: ['Língua Portuguesa', 'Direito Constitucional', 'Direito Processual Penal', 'Conhecimentos Gerais', 'Raciocínio Lógico'],
  },
]

export function getCarreira(id) {
  return CARREIRAS.find((c) => c.id === id) || null
}
