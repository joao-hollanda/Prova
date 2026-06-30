import { API_URL, MOCK_DELAY } from './config.js'

/**
 * Pequeno wrapper sobre o fetch para falar com a API C#.
 * Centraliza URL base, headers e tratamento de erro.
 */
export async function apiFetch(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let detalhe
    try {
      detalhe = await res.json()
    } catch {
      detalhe = await res.text().catch(() => '')
    }
    const erro = new Error(
      (detalhe && (detalhe.mensagem || detalhe.message)) ||
        `Erro ${res.status} ao chamar ${path}`,
    )
    erro.status = res.status
    erro.detalhe = detalhe
    throw erro
  }

  if (res.status === 204) return null
  return res.json()
}

/** Simula latência de rede no modo mock. */
export function delay(ms = MOCK_DELAY) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
