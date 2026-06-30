import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useInscricao } from '../context/InscricaoContext.jsx'

export default function Resultado() {
  const { inscricao, resultado, encerrarSessao } = useInscricao()
  const navigate = useNavigate()
  const [gerandoPdf, setGerandoPdf] = useState(false)

  if (!resultado) return <Navigate to="/" replace />

  async function baixarComprovante() {
    try {
      setGerandoPdf(true)
      // Import dinâmico: o jsPDF só é carregado quando o candidato pede o PDF.
      const { gerarComprovantePDF } = await import('../utils/comprovante.js')
      await gerarComprovantePDF(inscricao, resultado)
    } catch {
      alert('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setGerandoPdf(false)
    }
  }

  const { objetivas, discursivas } = resultado
  const aprovado = objetivas.aprovadoPreliminar

  function novaSessao() {
    encerrarSessao()
    navigate('/')
  }

  return (
    <div className="pagina resultado">
      <div className={`resultado__banner ${aprovado ? 'is-aprovado' : 'is-reprovado'}`}>
        <div className="resultado__nota">
          <span className="resultado__perc">{objetivas.percentual}%</span>
          <span className="resultado__perc-label">de acerto (objetivas)</span>
        </div>
        <div className="resultado__status">
          <h1>{aprovado ? 'Classificação preliminar: APTO' : 'Classificação preliminar: NÃO APTO'}</h1>
          <p>
            {inscricao.nome} · {resultado.carreiraId && resultado.carreiraId.toUpperCase()} ·
            Protocolo {inscricao.protocolo}
          </p>
          <p className="resultado__obs">
            {aprovado
              ? `Você atingiu a nota de corte preliminar de ${objetivas.notaDeCorte}% nas questões objetivas.`
              : `A nota de corte preliminar é de ${objetivas.notaDeCorte}% nas questões objetivas.`}
            {' '}As questões discursivas ainda serão avaliadas pela banca.
          </p>
        </div>
      </div>

      <section className="resultado__resumo">
        <div className="kpi"><strong>{objetivas.acertos}</strong><span>Acertos</span></div>
        <div className="kpi"><strong>{objetivas.erros}</strong><span>Erros</span></div>
        <div className="kpi"><strong>{objetivas.total}</strong><span>Objetivas</span></div>
        <div className="kpi"><strong>{discursivas.length}</strong><span>Discursivas</span></div>
      </section>

      <section className="resultado__bloco">
        <h2>Questões objetivas</h2>
        <div className="alerta alerta--info">
          Por questões de segurança do certame, o <strong>gabarito não é divulgado</strong> e as
          respostas individuais não são exibidas. Acima está apenas o seu desempenho geral nas
          questões objetivas.
        </div>
      </section>

      <section className="resultado__bloco">
        <h2>Questões discursivas</h2>
        <div className="alerta alerta--info">
          As respostas discursivas foram registradas e estão <strong>em análise</strong> pela banca
          examinadora. O resultado definitivo considerará a nota das questões objetivas e discursivas.
        </div>
        <ul className="discursivas-lista">
          {discursivas.map((d, i) => (
            <li key={d.questaoId} className="discursivas-lista__item">
              <div className="discursivas-lista__cab">
                <span>{d.area}</span>
                <span className="badge badge--analise">Em análise</span>
              </div>
              <p className="discursivas-lista__texto">
                {d.resposta ? d.resposta : <em>Não respondida.</em>}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="resultado__acoes">
        <button className="btn btn--ghost btn--lg" onClick={baixarComprovante} disabled={gerandoPdf}>
          {gerandoPdf ? 'Gerando PDF...' : 'Baixar comprovante (PDF)'}
        </button>
        <button className="btn btn--primario btn--lg" onClick={novaSessao}>
          Encerrar sessão
        </button>
      </div>
    </div>
  )
}
