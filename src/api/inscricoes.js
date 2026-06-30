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

function gerarProtocolo() {
  const ano = new Date().getFullYear()
  const seq = Math.floor(100000 + Math.random() * 900000)
  return `PCSP-${ano}-${seq}`
}
