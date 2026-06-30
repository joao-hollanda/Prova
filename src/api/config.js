// Configuração central da integração com a API.
//
// Por padrão a aplicação roda com dados MOCKADOS (VITE_USE_MOCK=true).
// Para consumir a API C# real, crie um arquivo .env com:
//   VITE_USE_MOCK=false
//   VITE_API_URL=http://localhost:5000/api

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Aceita "false" (string) ou false para desligar o mock; qualquer outra coisa = mock ligado.
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

// Simula latência de rede no modo mock (ms).
export const MOCK_DELAY = 600
