import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CARREIRAS } from '../data/carreiras.js'
import { getConfigProva } from '../api/admin.js'
import { useInscricao } from '../context/InscricaoContext.jsx'

export default function Home() {
  const { inscricao, resultado } = useInscricao()
  const [config, setConfig] = useState(null)

  // Sobrepõe vagas/duração com os valores configurados no painel (fallback: estáticos).
  useEffect(() => {
    let ativo = true
    getConfigProva()
      .then((c) => ativo && setConfig(c))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  const carreiras = useMemo(() => {
    const porId = new Map((config?.carreiras ?? []).map((c) => [c.id, c]))
    return CARREIRAS.map((c) => {
      const cfg = porId.get(c.id)
      return {
        ...c,
        vagas: cfg?.vagas ?? c.vagas,
        duracaoMinutos: cfg?.duracaoMinutos ?? c.duracaoMinutos,
      }
    })
  }, [config])

  const totalVagas = useMemo(
    () => config?.totalVagas ?? carreiras.reduce((s, c) => s + c.vagas, 0),
    [config, carreiras],
  )

  return (
    <div className="home">
      <p className="aviso-rp">
        🎭 <strong>Simulação de roleplay (RP)</strong> — este site é fictício e faz parte do
        servidor <strong>Ilha em São Paulo</strong>. Não tem <strong>qualquer vínculo</strong> com
        a Polícia Federal ou órgãos públicos reais, e nada aqui possui validade
        oficial.
      </p>

      <section className="hero">
        <div className="hero__conteudo">
          <span className="hero__selo">Concurso Público · Ilha em São Paulo</span>
          <h1>
            Polícia <span>Federal</span>
          </h1>
          <p>
            Estão abertas as inscrições para o concurso de ingresso na carreira policial federal.
            Preencha sua inscrição, escolha o cargo desejado e realize a prova objetiva e discursiva.
          </p>
          <div className="hero__acoes">
            {inscricao && resultado ? (
              <Link to="/resultado" className="btn btn--primario btn--lg">
                Ver resultado
              </Link>
            ) : inscricao ? (
              <>
                <Link to="/prova" className="btn btn--primario btn--lg">
                  Iniciar / continuar prova
                </Link>
                <Link to="/inscricao" className="btn btn--ghost btn--lg">
                  Revisar inscrição
                </Link>
              </>
            ) : (
              <Link to="/inscricao" className="btn btn--primario btn--lg">
                Fazer inscrição
              </Link>
            )}
          </div>
          <ul className="hero__infos">
            <li><strong>{carreiras.length}</strong> cargos disponíveis</li>
            <li><strong>{totalVagas}</strong> vagas</li>
            <li>Prova de nível <strong>médio</strong></li>
          </ul>
        </div>
        <div className="hero__brasao">
          <img src="/Logo.png" alt="Logo da Polícia Federal" />
        </div>
      </section>

      <section className="carreiras">
        <h2>Cargos do certame</h2>
        <p className="secao__sub">
          Cada cargo possui uma prova específica, além do conteúdo comum (Português, Matemática e
          Raciocínio Lógico, Conhecimentos Gerais, Informática e Noções de Direito).
        </p>
        <div className="carreiras__grid">
          {carreiras.map((c) => (
            <div key={c.id} className="card-carreira">
              <h3>{c.nome}</h3>
              <p className="card-carreira__desc">{c.descricao}</p>
              <dl className="card-carreira__meta">
                <div><dt>Escolaridade</dt><dd>{c.escolaridade}</dd></div>
                <div><dt>Vagas</dt><dd>{c.vagas}</dd></div>
                <div><dt>Duração</dt><dd>{c.duracaoMinutos} min</dd></div>
              </dl>
              <div className="card-carreira__areas">
                {c.areas.map((a) => (
                  <span key={a} className="chip">{a}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="passos">
        <h2>Como funciona</h2>
        <ol className="passos__lista">
          <li><strong>Inscreva-se</strong> com seus dados (e-mail real obrigatório) e escolha o cargo.</li>
          <li><strong>Realize a prova</strong> objetiva e discursiva dentro do tempo cronometrado.</li>
          <li><strong>Receba o resultado preliminar</strong> das questões objetivas na hora.</li>
        </ol>
      </section>
    </div>
  )
}
