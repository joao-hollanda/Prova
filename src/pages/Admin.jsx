import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  isAdminAutenticado,
  loginAdmin,
  logoutAdmin,
  KEY_RESULTADOS,
  KEY_STATUS,
  getStatusProva,
  listarResultados,
  setStatusProva,
  getConfigProva,
  salvarConfigProva,
  sortearProva,
  listarDiscursivas,
  corrigirDiscursiva,
} from '../api/admin.js'
import { CARREIRAS } from '../data/carreiras.js'

const INTERVALO_MS = 4000 // atualização do ranking

function formatarTempo(seg) {
  if (seg == null) return '—'
  const m = String(Math.floor(seg / 60)).padStart(2, '0')
  const s = String(seg % 60).padStart(2, '0')
  return `${m}:${s}`
}

function formatarHora(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '—'
  }
}

export default function Admin() {
  const [autenticado, setAutenticado] = useState(() => isAdminAutenticado())

  async function sair() {
    await logoutAdmin()
    setAutenticado(false)
  }

  if (!autenticado) return <Login onEntrar={() => setAutenticado(true)} />
  return <Painel onSair={sair} />
}

// ----------------------------------------------------------------------------
// Tela de login (autenticação no backend — a senha não fica no front)
// ----------------------------------------------------------------------------
function Login({ onEntrar }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [entrando, setEntrando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro(null)
    setEntrando(true)
    try {
      await loginAdmin(senha)
      onEntrar()
    } catch (err) {
      setErro(err.status === 401 ? 'Senha incorreta.' : err.message || 'Não foi possível entrar.')
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className="pagina pagina--estreita">
      <h1 className="pagina__titulo">Painel Administrativo</h1>
      <p className="pagina__sub">Acesso restrito à organização do certame.</p>
      {erro && <div className="alerta alerta--erro">{erro}</div>}
      <form className="formulario" onSubmit={entrar} noValidate>
        <div className="campo">
          <label htmlFor="senha">Senha de acesso</label>
          <input
            id="senha"
            type="password"
            value={senha}
            autoFocus
            placeholder="Digite a senha do painel"
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn--primario btn--lg btn--bloco" disabled={entrando}>
          {entrando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Painel principal (com abas)
// ----------------------------------------------------------------------------
function Painel({ onSair }) {
  const [aba, setAba] = useState('ranking')
  const [status, setStatus] = useState({ fechada: false })
  const [alterando, setAlterando] = useState(false)

  const carregarStatus = useCallback(async () => {
    try {
      setStatus((await getStatusProva()) || { fechada: false })
    } catch {
      /* mantém o último status conhecido */
    }
  }, [])

  useEffect(() => {
    carregarStatus()
    const i = setInterval(carregarStatus, INTERVALO_MS)
    return () => clearInterval(i)
  }, [carregarStatus])

  async function alternarProva() {
    const fechar = !status.fechada
    const msg = fechar
      ? 'Tem certeza que deseja FECHAR a prova? Novos candidatos não poderão iniciá-la.'
      : 'Deseja REABRIR a prova para novos candidatos?'
    if (!window.confirm(msg)) return
    try {
      setAlterando(true)
      setStatus(await setStatusProva(fechar))
    } finally {
      setAlterando(false)
    }
  }

  const abas = [
    { id: 'ranking', rotulo: 'Ranking' },
    { id: 'config', rotulo: 'Configuração' },
    { id: 'discursivas', rotulo: 'Correção discursivas' },
  ]

  return (
    <div className="admin">
      <div className="admin__topo">
        <div>
          <h1>Painel Administrativo</h1>
          <p className="admin__sub">Organização do certame · Ilha em São Paulo</p>
        </div>
        <div className="admin__statusbox">
          <span className={`badge-status ${status.fechada ? 'is-fechada' : 'is-aberta'}`}>
            {status.fechada ? 'Prova ENCERRADA' : 'Prova ABERTA'}
          </span>
          <button
            className={`btn btn--lg ${status.fechada ? 'btn--primario' : 'btn--perigo'}`}
            onClick={alternarProva}
            disabled={alterando}
          >
            {alterando ? 'Aguarde...' : status.fechada ? 'Reabrir prova' : 'Fechar prova'}
          </button>
          <button className="btn btn--ghost btn--lg" onClick={onSair}>
            Sair
          </button>
        </div>
      </div>

      <nav className="abas">
        {abas.map((a) => (
          <button
            key={a.id}
            className={`abas__item ${aba === a.id ? 'is-ativa' : ''}`}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>

      {aba === 'ranking' && <Ranking />}
      {aba === 'config' && <Configuracao />}
      {aba === 'discursivas' && <Discursivas />}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Aba: Ranking (tempo real)
// ----------------------------------------------------------------------------
function Ranking() {
  const [resultados, setResultados] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [carregando, setCarregando] = useState(true)
  const [atualizadoEm, setAtualizadoEm] = useState(null)
  const montadoRef = useRef(true)

  const carregar = useCallback(async () => {
    try {
      const lista = await listarResultados()
      if (!montadoRef.current) return
      setResultados(Array.isArray(lista) ? lista : [])
      setAtualizadoEm(new Date())
    } finally {
      if (montadoRef.current) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    montadoRef.current = true
    carregar()
    const intervalo = setInterval(carregar, INTERVALO_MS)
    const onStorage = (e) => {
      if (!e.key || e.key === KEY_RESULTADOS || e.key === KEY_STATUS) carregar()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      montadoRef.current = false
      clearInterval(intervalo)
      window.removeEventListener('storage', onStorage)
    }
  }, [carregar])

  const ranking = useMemo(() => {
    const lista = filtro === 'todos' ? resultados : resultados.filter((r) => r.carreiraId === filtro)
    return [...lista].sort((a, b) => {
      if (b.percentual !== a.percentual) return b.percentual - a.percentual
      return (a.tempoGastoSegundos ?? Infinity) - (b.tempoGastoSegundos ?? Infinity)
    })
  }, [resultados, filtro])

  const kpis = useMemo(() => {
    const total = ranking.length
    const aprovados = ranking.filter((r) => r.aprovadoPreliminar).length
    const media = total ? Math.round(ranking.reduce((s, r) => s + r.percentual, 0) / total) : 0
    return { total, aprovados, reprovados: total - aprovados, media }
  }, [ranking])

  const medalhas = ['🥇', '🥈', '🥉']

  return (
    <div className="painel-secao">
      <p className="admin__sub">
        Ranking em tempo real · atualizado às {atualizadoEm ? formatarHora(atualizadoEm.toISOString()) : '—'}
        <span className="admin__live" title="Atualização automática">● ao vivo</span>
      </p>

      <section className="admin__kpis">
        <div className="kpi"><strong>{kpis.total}</strong><span>Provas enviadas</span></div>
        <div className="kpi"><strong>{kpis.aprovados}</strong><span>Aptos (prelim.)</span></div>
        <div className="kpi"><strong>{kpis.reprovados}</strong><span>Não aptos</span></div>
        <div className="kpi"><strong>{kpis.media}%</strong><span>Média de acerto</span></div>
      </section>

      <div className="admin__filtros">
        <label htmlFor="filtroCargo">Filtrar por cargo:</label>
        <select id="filtroCargo" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos os cargos</option>
          {CARREIRAS.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>

      <div className="admin__tabela-wrap">
        {carregando ? (
          <div className="estado-carregando"><div className="spinner" /><p>Carregando ranking...</p></div>
        ) : ranking.length === 0 ? (
          <div className="alerta alerta--info">Nenhuma prova enviada ainda.</div>
        ) : (
          <table className="ranking">
            <thead>
              <tr>
                <th>#</th>
                <th>Candidato</th>
                <th>Cargo</th>
                <th className="ta-c">Acertos</th>
                <th className="ta-c">Aproveit.</th>
                <th className="ta-c">Tempo</th>
                <th className="ta-c">Situação</th>
                <th>Enviado</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.inscricaoId} className={i < 3 ? 'ranking__top' : ''}>
                  <td className="ranking__pos">{medalhas[i] || i + 1}</td>
                  <td>
                    <div className="ranking__nome">{r.nome}</div>
                    <div className="ranking__email">{r.email}</div>
                  </td>
                  <td>{r.carreiraNome}</td>
                  <td className="ta-c">{r.acertos}/{r.total}</td>
                  <td className="ta-c"><strong>{r.percentual}%</strong></td>
                  <td className="ta-c">{formatarTempo(r.tempoGastoSegundos)}</td>
                  <td className="ta-c">
                    <span className={`badge ${r.aprovadoPreliminar ? 'badge--apto' : 'badge--inapto'}`}>
                      {r.aprovadoPreliminar ? 'Apto' : 'Não apto'}
                    </span>
                  </td>
                  <td>{formatarHora(r.enviadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Aba: Configuração (vagas, qtd. questões, nota de corte, duração, sorteio)
// ----------------------------------------------------------------------------
function Configuracao() {
  const [cfg, setCfg] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sorteando, setSorteando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [sugestao, setSugestao] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setCfg(await getConfigProva())
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  function alterarCampo(campo, valor) {
    setCfg((c) => ({ ...c, [campo]: valor }))
  }
  function alterarCarreira(id, campo, valor) {
    setCfg((c) => ({
      ...c,
      carreiras: c.carreiras.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)),
    }))
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {
        notaDeCorte: Number(cfg.notaDeCorte),
        quantidadeObjetivas: Number(cfg.quantidadeObjetivas),
        quantidadeDiscursivas: Number(cfg.quantidadeDiscursivas),
        carreiras: cfg.carreiras.map((c) => ({
          id: c.id,
          vagas: Number(c.vagas),
          duracaoMinutos: Number(c.duracaoMinutos),
        })),
      }
      setCfg(await salvarConfigProva(payload))
      setMsg({ tipo: 'ok', texto: 'Configuração salva.' })
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message || 'Erro ao salvar a configuração.' })
    } finally {
      setSalvando(false)
    }
  }

  async function sortear() {
    if (
      !window.confirm(
        'Sortear a prova agora? Define UMA prova (a mesma para todos os candidatos) e substitui o sorteio atual.',
      )
    )
      return
    setSorteando(true)
    setMsg(null)
    try {
      const r = await sortearProva()
      const fresh = await getConfigProva()
      // Pré-preenche a nota de corte com a sugestão (aplica ao clicar em Salvar).
      setCfg({ ...fresh, notaDeCorte: r.notaDeCorteSugerida })
      setSugestao(r)
      setMsg({
        tipo: 'ok',
        texto: `Prova sorteada! Sugestão de nota de corte: ${r.notaDeCorteSugerida}% — clique em "Salvar configuração" para aplicar.`,
      })
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message || 'Erro ao sortear a prova.' })
    } finally {
      setSorteando(false)
    }
  }

  if (carregando || !cfg) {
    return (
      <div className="painel-secao estado-carregando">
        <div className="spinner" />
        <p>Carregando configuração...</p>
      </div>
    )
  }

  return (
    <div className="painel-secao">
      {msg && (
        <div className={`alerta ${msg.tipo === 'ok' ? 'alerta--ok' : 'alerta--erro'}`}>{msg.texto}</div>
      )}

      <form className="config-form" onSubmit={salvar}>
        <h2 className="config-titulo">Parâmetros gerais</h2>
        <div className="config-grid">
          <div className="campo">
            <label htmlFor="notaCorte">Nota de corte (% objetivas)</label>
            <input
              id="notaCorte"
              type="number"
              min="0"
              max="100"
              value={cfg.notaDeCorte}
              onChange={(e) => alterarCampo('notaDeCorte', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="qtdObj">Qtd. de questões objetivas</label>
            <input
              id="qtdObj"
              type="number"
              min="1"
              max="100"
              value={cfg.quantidadeObjetivas}
              onChange={(e) => alterarCampo('quantidadeObjetivas', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="qtdDisc">Qtd. de questões discursivas</label>
            <input
              id="qtdDisc"
              type="number"
              min="0"
              max="20"
              value={cfg.quantidadeDiscursivas}
              onChange={(e) => alterarCampo('quantidadeDiscursivas', e.target.value)}
            />
          </div>
          <div className="campo">
            <label>Total de vagas</label>
            <input type="text" value={cfg.totalVagas} disabled />
          </div>
        </div>

        <h2 className="config-titulo">Por cargo</h2>
        <div className="admin__tabela-wrap">
          <table className="ranking">
            <thead>
              <tr>
                <th>Cargo</th>
                <th className="ta-c">Vagas</th>
                <th className="ta-c">Duração (min)</th>
                <th className="ta-c">Objetivas (banco)</th>
                <th className="ta-c">Discursivas (banco)</th>
                <th className="ta-c">Sorteadas</th>
              </tr>
            </thead>
            <tbody>
              {cfg.carreiras.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td className="ta-c">
                    <input
                      className="mini-input"
                      type="number"
                      min="0"
                      value={c.vagas}
                      onChange={(e) => alterarCarreira(c.id, 'vagas', e.target.value)}
                    />
                  </td>
                  <td className="ta-c">
                    <input
                      className="mini-input"
                      type="number"
                      min="1"
                      max="600"
                      value={c.duracaoMinutos}
                      onChange={(e) => alterarCarreira(c.id, 'duracaoMinutos', e.target.value)}
                    />
                  </td>
                  <td className="ta-c">{c.objetivasDisponiveis}</td>
                  <td className="ta-c">{c.discursivasDisponiveis}</td>
                  <td className="ta-c">
                    {c.objetivasSorteadas != null
                      ? `${c.objetivasSorteadas} + ${c.discursivasSorteadas ?? 0} disc.`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="config-acoes">
          <button type="submit" className="btn btn--primario btn--lg" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </form>

      <section className="sorteio-box">
        <div>
          <h2 className="config-titulo">Sorteio da prova</h2>
          <p className="admin__sub">
            {cfg.sorteada
              ? `Prova sorteada em ${formatarHora(cfg.sorteadaEm)} (a mesma para todos os candidatos).`
              : 'Nenhum sorteio ativo — todos os candidatos recebem o banco completo de questões.'}
            {cfg.notaDeCorteSugerida != null && ` · Sugestão de corte: ${cfg.notaDeCorteSugerida}%`}
          </p>
        </div>
        <button className="btn btn--ouro btn--lg" onClick={sortear} disabled={sorteando}>
          {sorteando ? 'Sorteando...' : cfg.sorteada ? 'Sortear novamente' : 'Sortear questões'}
        </button>
      </section>

      {sugestao && (
        <div className="sugestao-box">
          <strong>Resultado do sorteio</strong> — sugestão de nota de corte:{' '}
          <strong>{sugestao.notaDeCorteSugerida}%</strong>
          <table className="ranking ranking--compacta">
            <thead>
              <tr>
                <th>Cargo</th>
                <th className="ta-c">Objetivas</th>
                <th className="ta-c">Discursivas</th>
                <th className="ta-c">Fácil</th>
                <th className="ta-c">Média</th>
                <th className="ta-c">Difícil</th>
              </tr>
            </thead>
            <tbody>
              {sugestao.carreiras.map((c) => (
                <tr key={c.carreiraId}>
                  <td>{c.nome}</td>
                  <td className="ta-c">{c.objetivas}</td>
                  <td className="ta-c">{c.discursivas}</td>
                  <td className="ta-c">{c.faceis}</td>
                  <td className="ta-c">{c.medias}</td>
                  <td className="ta-c">{c.dificeis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Aba: Correção das questões discursivas
// ----------------------------------------------------------------------------
function Discursivas() {
  const [subs, setSubs] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [notas, setNotas] = useState({}) // `${inscricaoId}|${questaoId}` -> valor digitado
  const [salvando, setSalvando] = useState(null)
  const [msg, setMsg] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const lista = await listarDiscursivas()
      setSubs(Array.isArray(lista) ? lista : [])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const chave = (inscricaoId, questaoId) => `${inscricaoId}|${questaoId}`

  async function salvar(sub, disc) {
    const k = chave(sub.inscricaoId, disc.questaoId)
    const valor = notas[k] !== undefined ? notas[k] : disc.nota ?? ''
    const nota = Number(valor)
    if (valor === '' || Number.isNaN(nota) || nota < 0 || nota > disc.notaMaxima) {
      setMsg({ tipo: 'erro', texto: `A nota deve estar entre 0 e ${disc.notaMaxima}.` })
      return
    }
    setSalvando(k)
    setMsg(null)
    try {
      await corrigirDiscursiva({
        inscricaoId: sub.inscricaoId,
        questaoId: disc.questaoId,
        nota,
        status: 'CORRIGIDA',
      })
      await carregar()
      setMsg({ tipo: 'ok', texto: 'Correção registrada.' })
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message || 'Erro ao registrar a correção.' })
    } finally {
      setSalvando(null)
    }
  }

  if (carregando) {
    return (
      <div className="painel-secao estado-carregando">
        <div className="spinner" />
        <p>Carregando respostas discursivas...</p>
      </div>
    )
  }

  return (
    <div className="painel-secao">
      {msg && (
        <div className={`alerta ${msg.tipo === 'ok' ? 'alerta--ok' : 'alerta--erro'}`}>{msg.texto}</div>
      )}

      {subs.length === 0 ? (
        <div className="alerta alerta--info">Nenhuma prova com questões discursivas enviada ainda.</div>
      ) : (
        subs.map((sub) => (
          <article key={sub.inscricaoId} className="discursiva-sub">
            <header className="discursiva-sub__cab">
              <div>
                <strong>{sub.nome}</strong> · {sub.carreiraNome}
                <span className="discursiva-sub__email"> · {sub.email}</span>
              </div>
              <span className="discursiva-sub__hora">Enviado às {formatarHora(sub.enviadoEm)}</span>
            </header>

            {sub.discursivas.map((d) => {
              const k = chave(sub.inscricaoId, d.questaoId)
              const corrigida = d.status === 'CORRIGIDA'
              const valorAtual = notas[k] !== undefined ? notas[k] : d.nota ?? ''
              return (
                <div key={d.questaoId} className="discursiva-item">
                  <div className="discursiva-item__cab">
                    <span className="discursiva-item__area">{d.area}</span>
                    <span className={`badge ${corrigida ? 'badge--apto' : 'badge--analise'}`}>
                      {corrigida ? `Corrigida · ${d.nota}/${d.notaMaxima}` : 'Em análise'}
                    </span>
                  </div>
                  <p className="discursiva-item__enunciado">{d.enunciado}</p>
                  <div className="discursiva-item__resposta">
                    {d.resposta ? d.resposta : <em>Não respondida.</em>}
                  </div>
                  <div className="discursiva-item__nota">
                    <label>
                      Nota (0–{d.notaMaxima}):
                      <input
                        className="mini-input"
                        type="number"
                        min="0"
                        max={d.notaMaxima}
                        step="0.5"
                        value={valorAtual}
                        onChange={(e) => setNotas((n) => ({ ...n, [k]: e.target.value }))}
                      />
                    </label>
                    <button
                      className="btn btn--primario"
                      onClick={() => salvar(sub, d)}
                      disabled={salvando === k}
                    >
                      {salvando === k ? 'Salvando...' : 'Lançar nota'}
                    </button>
                  </div>
                </div>
              )
            })}
          </article>
        ))
      )}
    </div>
  )
}
