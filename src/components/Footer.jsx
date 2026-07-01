import { USE_MOCK } from '../api/config.js'

export default function Footer() {
  return (
    <footer className="footer">
      <p className="footer__aviso">
        ⚠️ Conteúdo fictício para fins de <strong>roleplay (RP)</strong> do servidor
        <strong> Ilha em São Paulo</strong>. Esta é uma simulação e <strong>não possui qualquer
        vínculo</strong> com a Polícia Civil do Estado de São Paulo, a ACADEPOL ou qualquer órgão
        público real. Nomes, cargos, provas e resultados não têm validade oficial.
      </p>
      <div className="footer__inner">
        <span>
          © {new Date().getFullYear()} Polícia Civil do Estado de São Paulo — Ilha em São Paulo (RP).
        </span>
        <span className={`footer__modo ${USE_MOCK ? 'is-mock' : 'is-api'}`}>
          {USE_MOCK ? 'Dados mockados (offline)' : 'Conectado à API'}
        </span>
      </div>
    </footer>
  )
}
