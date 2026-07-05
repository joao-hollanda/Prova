import { createContext, useContext, useEffect, useState } from 'react'

const InscricaoContext = createContext(null)

const STORAGE_KEY = 'pf_inscricao'
const STORAGE_RESULTADO = 'pf_resultado'

function carregar(chave) {
  try {
    const raw = localStorage.getItem(chave)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function InscricaoProvider({ children }) {
  const [inscricao, setInscricaoState] = useState(() => carregar(STORAGE_KEY))
  const [resultado, setResultadoState] = useState(() => carregar(STORAGE_RESULTADO))

  // Persiste a inscrição entre reloads para manter o candidato "logado".
  useEffect(() => {
    if (inscricao) localStorage.setItem(STORAGE_KEY, JSON.stringify(inscricao))
    else localStorage.removeItem(STORAGE_KEY)
  }, [inscricao])

  useEffect(() => {
    if (resultado) localStorage.setItem(STORAGE_RESULTADO, JSON.stringify(resultado))
    else localStorage.removeItem(STORAGE_RESULTADO)
  }, [resultado])

  function setInscricao(dados) {
    setInscricaoState(dados)
  }

  function setResultado(dados) {
    setResultadoState(dados)
  }

  function encerrarSessao() {
    setInscricaoState(null)
    setResultadoState(null)
  }

  return (
    <InscricaoContext.Provider
      value={{ inscricao, setInscricao, resultado, setResultado, encerrarSessao }}
    >
      {children}
    </InscricaoContext.Provider>
  )
}

export function useInscricao() {
  const ctx = useContext(InscricaoContext)
  if (!ctx) throw new Error('useInscricao deve ser usado dentro de <InscricaoProvider>')
  return ctx
}
