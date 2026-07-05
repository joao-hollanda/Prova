// Carreiras disponíveis no certame (contexto de RP).

export const CARREIRAS = [
  {
    id: 'agente',
    nome: 'Agente de Polícia Federal',
    escolaridade: 'Ensino Superior Completo',
    descricao:
      'Atua no apoio às investigações, cumprimento de mandados, diligências de campo e segurança das operações policiais.',
    vagas: 5,
    duracaoMinutos: 90,
    areas: ['Língua Portuguesa', 'Matemática e Raciocínio Lógico', 'Conhecimentos Gerais', 'Informática', 'Noções de Direito Penal'],
  },
  {
    id: 'escrivao',
    nome: 'Escrivão de Polícia Federal',
    escolaridade: 'Ensino Superior Completo',
    descricao:
      'Responsável por documentar e formalizar os atos do inquérito policial: lavra autos, termos e mandados, dando fé pública aos procedimentos e organizando o cartório da unidade.',
    vagas: 3,
    duracaoMinutos: 90,
    areas: ['Língua Portuguesa', 'Matemática e Raciocínio Lógico', 'Conhecimentos Gerais', 'Direito e Processo Penal', 'Informática'],
  },
  {
    id: 'perito',
    nome: 'Perito Criminal Federal',
    escolaridade: 'Ensino Superior Completo (área técnica)',
    descricao:
      'Realiza exames periciais em locais de crime, análise de vestígios, balística, química e produção de laudos técnicos.',
    vagas: 1,
    duracaoMinutos: 100,
    areas: ['Língua Portuguesa', 'Ciências da Natureza', 'Criminalística', 'Matemática e Raciocínio Lógico', 'Informática'],
  },
  {
    id: 'delegado',
    nome: 'Delegado de Polícia Federal',
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
