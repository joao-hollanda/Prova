import { USE_MOCK } from './config.js'
import { apiFetch, delay } from './client.js'
import { montarBanco } from '../data/questoes.js'
import { getCarreira } from '../data/carreiras.js'
import { salvarResultadoLocal } from './admin.js'

const NOTA_DE_CORTE = 60 // % de acerto nas questões objetivas (classificação preliminar)

/**
 * Busca a prova de uma carreira.
 * O gabarito NUNCA é enviado ao candidato (espelha a API real).
 * @returns {Promise<{ carreira, duracaoMinutos, questoes }>}
 */
export async function getProva(carreiraId) {
  if (USE_MOCK) {
    await delay()
    const carreira = getCarreira(carreiraId)
    const banco = montarBanco(carreiraId)
    const questoes = banco.map(({ gabarito, ...publica }) => publica) // remove o gabarito
    return {
      carreira: carreira?.nome ?? carreiraId,
      carreiraId,
      duracaoMinutos: carreira?.duracaoMinutos ?? 90,
      totalQuestoes: questoes.length,
      questoes,
    }
  }

  // Integração real:  GET /api/provas/{carreiraId}
  return apiFetch(`/provas/${carreiraId}`)
}

/**
 * Envia as respostas e devolve o resultado.
 * Questões fechadas são corrigidas automaticamente; abertas ficam "em análise".
 * @param {{ inscricaoId, carreiraId, respostas, tempoGastoSegundos }} payload
 */
export async function enviarProva(payload) {
  if (USE_MOCK) {
    await delay()
    const resultado = corrigirMock(payload)
    registrarRanking(payload, resultado) // alimenta o painel administrativo
    return resultado
  }

  // Integração real:  POST /api/provas/{carreiraId}/respostas
  return apiFetch(`/provas/${payload.carreiraId}/respostas`, {
    method: 'POST',
    body: payload,
  })
}

/**
 * Busca a sessão de prova salva no SERVIDOR (backup do progresso).
 * Retorna null se não houver (ou em modo mock / falha de rede) — a prova
 * continua funcionando só com a sessão local.
 * @returns {Promise<{ inicio, respostas, pausada, extraMinutos } | null>}
 */
export async function getSessaoServidor(inscricaoId) {
  if (USE_MOCK) return null
  try {
    return await apiFetch(`/provas/sessao/${inscricaoId}`)
  } catch {
    return null
  }
}

/**
 * Salva o progresso da prova no SERVIDOR (melhor esforço — nunca atrapalha a prova).
 * A resposta traz pausada/extraMinutos/inicio atualizados pela administração.
 */
export async function salvarSessaoServidor(inscricaoId, inicio, respostas) {
  if (USE_MOCK) return null
  try {
    return await apiFetch('/provas/sessao', {
      method: 'POST',
      body: { inscricaoId, inicio, respostas },
    })
  } catch {
    return null
  }
}

/** Persiste o resultado para o ranking do painel (apenas no modo mock). */
function registrarRanking(payload, resultado) {
  const cand = payload.candidato || {}
  const carreira = getCarreira(payload.carreiraId)
  salvarResultadoLocal({
    inscricaoId: payload.inscricaoId,
    nome: cand.nome || '—',
    email: cand.email || '',
    idade: cand.idade ?? null,
    cpf: cand.cpf || '',
    carreiraId: payload.carreiraId,
    carreiraNome: carreira?.nome || payload.carreiraId,
    percentual: resultado.objetivas.percentual,
    acertos: resultado.objetivas.acertos,
    total: resultado.objetivas.total,
    aprovadoPreliminar: resultado.objetivas.aprovadoPreliminar,
    tempoGastoSegundos: payload.tempoGastoSegundos ?? null,
    enviadoEm: resultado.corrigidoEm,
  })
}

// ----------------------------------------------------------------------------
// Correção simulada (no backend C# isso aconteceria no servidor)
// ----------------------------------------------------------------------------
function corrigirMock({ carreiraId, respostas = {} }) {
  const banco = montarBanco(carreiraId)

  const fechadas = banco.filter((q) => q.tipo === 'fechada')
  const abertas = banco.filter((q) => q.tipo === 'aberta')

  // Conta apenas os acertos. O gabarito NÃO é exposto ao candidato (evita cola).
  let acertos = 0
  for (const q of fechadas) {
    if ((respostas[q.id] ?? null) === q.gabarito) acertos += 1
  }

  const totalFechadas = fechadas.length
  const percentual = totalFechadas ? Math.round((acertos / totalFechadas) * 100) : 0

  const discursivas = abertas.map((q) => ({
    questaoId: q.id,
    area: q.area,
    resposta: (respostas[q.id] || '').trim(),
    status: 'EM_ANALISE',
  }))

  return {
    carreiraId,
    corrigidoEm: new Date().toISOString(),
    objetivas: {
      total: totalFechadas,
      acertos,
      erros: totalFechadas - acertos,
      percentual,
      notaDeCorte: NOTA_DE_CORTE,
      aprovadoPreliminar: percentual >= NOTA_DE_CORTE,
    },
    discursivas,
  }
}
