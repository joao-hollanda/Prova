import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useInscricao } from '../context/InscricaoContext.jsx'

export default function Header() {
  const { inscricao, encerrarSessao } = useInscricao()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function sair() {
    // Durante a prova, um clique acidental em "Sair" descartaria a inscrição
    // (e, com ela, as respostas já marcadas). Pede confirmação explícita.
    if (
      pathname === '/prova' &&
      !window.confirm(
        'Você está com uma prova em andamento. Sair encerra a sessão e descarta a inscrição atual. Deseja mesmo sair?',
      )
    ) {
      return
    }
    encerrarSessao()
    navigate('/')
  }

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="header__brand">
          <img src="/Logo.png" alt="Logo Polícia Federal" className="header__brasao" />
          <div className="header__titulo">
            <strong>Polícia Federal</strong>
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
