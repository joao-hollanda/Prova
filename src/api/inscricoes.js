import { USE_MOCK } from './config.js'
import { apiFetch, delay } from './client.js'

/**
 * Cria uma inscrição para o candidato.
 * @param {{ nome, email, idade, cpf, carreira }} dados
 * @returns {Promise<object>} inscrição criada (com id e protocolo)
 */
export async function criarInscricao(dados) {
  if (USE_MOCK) {
    await delay()
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now())
    return {
      id,
      ...dados,
      protocolo: gerarProtocolo(),
      criadoEm: new Date().toISOString(),
    }
  }

  // Integração real com a API C#:  POST /api/inscricoes
  return apiFetch('/inscricoes', { method: 'POST', body: dados })
}

/**
 * Confere no servidor se a inscrição salva no navegador ainda é válida.
 * Usada ANTES de iniciar a prova, para o candidato não descobrir só no envio
 * que a inscrição não existe mais (ex.: banco resetado no servidor).
 * @returns {Promise<{ ok: boolean, mensagem?: string }>}
 */
export async function validarInscricao(id) {
  if (USE_MOCK) {
    await delay(60)
    return { ok: true } // no modo mock a inscrição vive só no navegador
  }

  try {
    await apiFetch(`/inscricoes/${id}`)
    return { ok: true }
  } catch (e) {
    // 404 = inscrição não existe; 409 = pertence a um edital anterior.
    if (e.status === 404 || e.status === 409) return { ok: false, mensagem: e.message }
    throw e // falha de rede/servidor: deixa o chamador tratar como erro comum
  }
}

function gerarProtocolo() {
  const ano = new Date().getFullYear()
  const seq = Math.floor(100000 + Math.random() * 900000)
  return `PCSP-${ano}-${seq}`
}
