import { Link, useNavigate } from 'react-router-dom'
import { useInscricao } from '../context/InscricaoContext.jsx'

export default function Header() {
  const { inscricao, encerrarSessao } = useInscricao()
  const navigate = useNavigate()

  function sair() {
    encerrarSessao()
    navigate('/')
  }

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="header__brand">
          <img src="/Logo.png" alt="Logo PCSP" className="header__brasao" />
          <div className="header__titulo">
            <strong>Polícia Civil do Estado de São Paulo</strong>
            <span>Concurso Público · Ilha em São Paulo</span>
          </div>
        </Link>

        <nav className="header__nav">
          <Link to="/">Início</Link>
          {!inscricao && <Link to="/inscricao">Inscrição</Link>}
          <Link to="/admin" className="header__admin">Painel</Link>
          {inscricao && (
            <>
              <span className="header__candidato" title={inscricao.email}>
                {inscricao.nome.split(' ')[0]}
              </span>
              <button className="btn btn--ghost btn--sm" onClick={sair}>
                Sair
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
