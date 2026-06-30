import { USE_MOCK } from '../api/config.js'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <span>
          © {new Date().getFullYear()} Polícia Civil do Estado de São Paulo — Ilha em São Paulo.
        </span>
        <span className={`footer__modo ${USE_MOCK ? 'is-mock' : 'is-api'}`}>
          {USE_MOCK ? 'Dados mockados (offline)' : 'Conectado à API'}
        </span>
      </div>
    </footer>
  )
}
