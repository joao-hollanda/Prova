// Persistência da sessão de prova (sobrevive a reload/fechamento de aba).
//
// Guarda, por inscrição, o INSTANTE DE INÍCIO (epoch ms) e as RESPOSTAS já marcadas.
// Com o início persistido, o cronômetro é recalculado pelo horário-limite real —
// recarregar a página não "ganha tempo" nem reseta o relógio.
//
// Formato: { inicio: <ms>, respostas: { [questaoId]: valor } }

const PREFIXO = 'pcsp_sessao_prova_'

const chave = (inscricaoId) => `${PREFIXO}${inscricaoId}`

export function carregarSessaoProva(inscricaoId) {
  if (!inscricaoId) return null
  try {
    const raw = localStorage.getItem(chave(inscricaoId))
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || typeof s.inicio !== 'number') return null
    return { inicio: s.inicio, respostas: s.respostas && typeof s.respostas === 'object' ? s.respostas : {} }
  } catch {
    return null
  }
}

export function salvarSessaoProva(inscricaoId, sessao) {
  if (!inscricaoId || !sessao) return
  try {
    localStorage.setItem(chave(inscricaoId), JSON.stringify(sessao))
  } catch {
    // Ignora erros de cota/privacidade — a prova continua funcionando em memória.
  }
}

export function limparSessaoProva(inscricaoId) {
  if (!inscricaoId) return
  try {
    localStorage.removeItem(chave(inscricaoId))
  } catch {
    /* noop */
  }
}
