import { USE_MOCK } from './config.js'
import { apiFetch, delay } from './client.js'
import { CARREIRAS } from '../data/carreiras.js'
import { montarBanco } from '../data/questoes.js'

// Chaves usadas no modo mock (localStorage).
export const KEY_RESULTADOS = 'pf_resultados'
export const KEY_STATUS = 'pf_prova_status'
export const KEY_CONFIG = 'pf_config'
const KEY_TOKEN = 'pf_admin_token'

// ----------------------------------------------------------------------------
// Sessão do painel — a senha NUNCA fica no front. O login é feito no backend,
// que devolve um token de sessão; as chamadas protegidas enviam X-Admin-Token.
// ----------------------------------------------------------------------------
let adminToken = (() => {
  try {
    return sessionStorage.getItem(KEY_TOKEN) || null
  } catch {
    return null
  }
})()

function definirToken(t) {
  adminToken = t || null
  try {
    if (t) sessionStorage.setItem(KEY_TOKEN, t)
    else sessionStorage.removeItem(KEY_TOKEN)
  } catch {
    /* ignora indisponibilidade de storage */
  }
}

export function isAdminAutenticado() {
  return !!adminToken
}

const adminHeaders = () => (adminToken ? { 'X-Admin-Token': adminToken } : {})

/** Faz login no painel. Lança erro (status 401) se a senha estiver incorreta. */
export async function loginAdmin(senha) {
  if (USE_MOCK) {
    await delay(120)
    if (!senha) {
      const e = new Error('Informe a senha.')
      e.status = 401
      throw e
    }
    definirToken('mock-' + Date.now()) // modo mock não valida senha (uso local sem backend)
    return true
  }
  const r = await apiFetch('/admin/login', { method: 'POST', body: { senha } })
  definirToken(r.token)
  return true
}

/** Encerra a sessão do painel. */
export async function logoutAdmin() {
  if (!USE_MOCK && adminToken) {
    try {
      await apiFetch('/admin/logout', { method: 'POST', headers: adminHeaders() })
    } catch {
      /* mesmo que falhe no servidor, limpamos localmente */
    }
  }
  definirToken(null)
}

/** Wrapper das chamadas administrativas: injeta o token e desloga em caso de 401. */
async function adminFetch(path, opts = {}) {
  try {
    return await apiFetch(path, { ...opts, headers: { ...(opts.headers || {}), ...adminHeaders() } })
  } catch (err) {
    if (err.status === 401) definirToken(null)
    throw err
  }
}

// ----------------------------------------------------------------------------
// Helpers de armazenamento local (modo mock)
// ----------------------------------------------------------------------------
export function lerResultadosLocal() {
  try {
    const raw = localStorage.getItem(KEY_RESULTADOS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Salva (ou atualiza, por inscricaoId) um registro de resultado no ranking. */
export function salvarResultadoLocal(registro) {
  const lista = lerResultadosLocal()
  const idx = lista.findIndex((r) => r.inscricaoId === registro.inscricaoId)
  if (idx >= 0) lista[idx] = registro
  else lista.push(registro)
  localStorage.setItem(KEY_RESULTADOS, JSON.stringify(lista))
  return registro
}

function lerStatusLocal() {
  try {
    const raw = localStorage.getItem(KEY_STATUS)
    return raw ? JSON.parse(raw) : { fechada: false, atualizadoEm: null }
  } catch {
    return { fechada: false, atualizadoEm: null }
  }
}

function configPadraoMock() {
  const carreiras = CARREIRAS.map((c) => {
    const banco = montarBanco(c.id)
    return {
      id: c.id,
      nome: c.nome,
      vagas: c.vagas,
      duracaoMinutos: c.duracaoMinutos,
      objetivasDisponiveis: banco.filter((q) => q.tipo === 'fechada').length,
      discursivasDisponiveis: banco.filter((q) => q.tipo === 'aberta').length,
      objetivasSorteadas: null,
      discursivasSorteadas: null,
    }
  })
  return {
    notaDeCorte: 60,
    quantidadeObjetivas: 10,
    quantidadeDiscursivas: 1,
    totalVagas: carreiras.reduce((s, c) => s + c.vagas, 0),
    sorteada: false,
    sorteadaEm: null,
    notaDeCorteSugerida: null,
    carreiras,
  }
}

function lerConfigLocal() {
  try {
    const raw = localStorage.getItem(KEY_CONFIG)
    return raw ? JSON.parse(raw) : configPadraoMock()
  } catch {
    return configPadraoMock()
  }
}

// ----------------------------------------------------------------------------
// Ranking / status da prova
// ----------------------------------------------------------------------------

/** Lista todos os resultados enviados (para o ranking). */
export async function listarResultados() {
  if (USE_MOCK) {
    await delay(120)
    return lerResultadosLocal()
  }
  return adminFetch('/admin/resultados')
}

/** Retorna o status da prova: { fechada, atualizadoEm }. */
export async function getStatusProva() {
  if (USE_MOCK) {
    await delay(80)
    return lerStatusLocal()
  }
  return apiFetch('/admin/prova/status')
}

/** Abre/fecha a prova para novos candidatos. */
export async function setStatusProva(fechada) {
  if (USE_MOCK) {
    await delay(120)
    const status = { fechada: !!fechada, atualizadoEm: new Date().toISOString() }
    localStorage.setItem(KEY_STATUS, JSON.stringify(status))
    return status
  }
  return adminFetch('/admin/prova/status', {
    method: 'POST',
    body: { fechada: !!fechada },
  })
}

// ----------------------------------------------------------------------------
// Gestão de candidatos (ferramentas de contingência)
// ----------------------------------------------------------------------------

/** Lista as inscrições do edital atual com a situação de cada candidato (protegido). */
export async function listarInscricoes() {
  if (USE_MOCK) {
    await delay(100)
    return [] // no modo mock as inscrições vivem só no navegador de cada candidato
  }
  return adminFetch('/admin/inscricoes')
}

/** Exclui inscrição + resultado + sessão (libera a tentativa única) (protegido). */
export async function excluirInscricao(inscricaoId) {
  if (USE_MOCK) {
    await delay(80)
    return { mensagem: 'Exclusão indisponível no modo mock.' }
  }
  return adminFetch('/admin/inscricoes/excluir', { method: 'POST', body: { inscricaoId } })
}

/** Exclui só o resultado, mantendo a inscrição — o candidato refaz a prova (protegido). */
export async function excluirResultado(inscricaoId) {
  if (USE_MOCK) {
    await delay(80)
    const lista = lerResultadosLocal().filter((r) => r.inscricaoId !== inscricaoId)
    localStorage.setItem(KEY_RESULTADOS, JSON.stringify(lista))
    return { mensagem: 'Resultado excluído.' }
  }
  return adminFetch('/admin/resultados/excluir', { method: 'POST', body: { inscricaoId } })
}

/** Concede tempo extra em minutos (negativo reduz) a um candidato (protegido). */
export async function adicionarTempoExtra(inscricaoId, adicionarMinutos) {
  if (USE_MOCK) {
    await delay(80)
    return { mensagem: 'Tempo extra indisponível no modo mock.', extraMinutos: 0 }
  }
  return adminFetch('/admin/inscricoes/tempo', {
    method: 'POST',
    body: { inscricaoId, adicionarMinutos },
  })
}

/** Pausa/retoma a prova de um candidato (protegido). */
export async function pausarSessao(inscricaoId, pausar) {
  if (USE_MOCK) {
    await delay(80)
    return { mensagem: 'Pausa indisponível no modo mock.' }
  }
  return adminFetch('/admin/sessao/pausar', { method: 'POST', body: { inscricaoId, pausar } })
}

// ----------------------------------------------------------------------------
// Configuração da prova (vagas, qtd. questões, nota de corte, duração)
// ----------------------------------------------------------------------------

/** Configuração efetiva (também pública, usada pela Home). */
export async function getConfigProva() {
  if (USE_MOCK) {
    await delay(80)
    return lerConfigLocal()
  }
  return apiFetch('/config')
}

/** Salva a configuração (protegido). */
export async function salvarConfigProva(payload) {
  if (USE_MOCK) {
    await delay(120)
    const atual = lerConfigLocal()
    const novo = { ...atual }
    if (payload.notaDeCorte != null) novo.notaDeCorte = payload.notaDeCorte
    if (payload.quantidadeObjetivas != null) novo.quantidadeObjetivas = payload.quantidadeObjetivas
    if (payload.quantidadeDiscursivas != null) novo.quantidadeDiscursivas = payload.quantidadeDiscursivas
    if (Array.isArray(payload.carreiras)) {
      novo.carreiras = novo.carreiras.map((c) => {
        const up = payload.carreiras.find((x) => x.id === c.id)
        return up ? { ...c, vagas: up.vagas ?? c.vagas, duracaoMinutos: up.duracaoMinutos ?? c.duracaoMinutos } : c
      })
      novo.totalVagas = novo.carreiras.reduce((s, c) => s + (Number(c.vagas) || 0), 0)
    }
    localStorage.setItem(KEY_CONFIG, JSON.stringify(novo))
    return novo
  }
  return adminFetch('/admin/config', { method: 'POST', body: payload })
}

/** Sorteia a prova (mesma para todos) e devolve a sugestão de nota de corte (protegido). */
export async function sortearProva() {
  if (USE_MOCK) {
    await delay(150)
    const cfg = lerConfigLocal()
    cfg.sorteada = true
    cfg.sorteadaEm = new Date().toISOString()
    cfg.notaDeCorteSugerida = 60
    cfg.carreiras = cfg.carreiras.map((c) => ({
      ...c,
      objetivasSorteadas: Math.min(cfg.quantidadeObjetivas, c.objetivasDisponiveis),
      discursivasSorteadas: Math.min(cfg.quantidadeDiscursivas, c.discursivasDisponiveis),
    }))
    localStorage.setItem(KEY_CONFIG, JSON.stringify(cfg))
    return {
      sorteadaEm: cfg.sorteadaEm,
      notaDeCorteSugerida: 60,
      carreiras: cfg.carreiras.map((c) => ({
        carreiraId: c.id,
        nome: c.nome,
        objetivas: c.objetivasSorteadas,
        discursivas: c.discursivasSorteadas,
        faceis: 0,
        medias: 0,
        dificeis: 0,
      })),
    }
  }
  return adminFetch('/admin/prova/sortear', { method: 'POST' })
}

// ----------------------------------------------------------------------------
// Correção das questões discursivas (banca)
// ----------------------------------------------------------------------------

/** Lista as submissões com respostas discursivas para correção (protegido). */
export async function listarDiscursivas() {
  if (USE_MOCK) {
    await delay(100)
    return [] // no modo mock as discursivas não são persistidas
  }
  return adminFetch('/admin/discursivas')
}

/** Lança a nota de uma resposta discursiva (protegido). */
export async function corrigirDiscursiva(payload) {
  if (USE_MOCK) {
    await delay(80)
    return { mensagem: 'Correção registrada (mock).' }
  }
  return adminFetch('/admin/discursivas/corrigir', { method: 'POST', body: payload })
}
