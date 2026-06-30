import { useEffect, useRef, useState } from 'react'

/**
 * Cronômetro regressivo da prova. Conta pelo HORÁRIO-LIMITE absoluto (fimEm, epoch ms),
 * e não por decremento de 1 em 1 segundo — assim recarregar a página ou deixar a aba em
 * segundo plano não reseta nem distorce o tempo. Chama onExpirar() ao chegar a zero.
 */
export default function Timer({ fimEm, onExpirar }) {
  const restanteDe = () => Math.max(0, Math.round((fimEm - Date.now()) / 1000))
  const [restante, setRestante] = useState(restanteDe)
  const expirouRef = useRef(false)

  useEffect(() => {
    const tick = () => setRestante(Math.max(0, Math.round((fimEm - Date.now()) / 1000)))
    tick() // sincroniza na hora (ex.: logo após um reload)
    const intervalo = setInterval(tick, 1000)
    return () => clearInterval(intervalo)
  }, [fimEm])

  useEffect(() => {
    if (restante === 0 && !expirouRef.current) {
      expirouRef.current = true
      onExpirar?.()
    }
  }, [restante, onExpirar])

  const min = String(Math.floor(restante / 60)).padStart(2, '0')
  const seg = String(restante % 60).padStart(2, '0')
  const critico = restante <= 300 // últimos 5 minutos

  return (
    <div className={`timer ${critico ? 'timer--critico' : ''}`} role="timer" aria-live="polite">
      <span className="timer__label">Tempo restante</span>
      <span className="timer__valor">
        {min}:{seg}
      </span>
    </div>
  )
}
