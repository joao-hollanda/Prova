import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useInscricao } from '../context/InscricaoContext.jsx'
import { getProva, enviarProva, getSessaoServidor, salvarSessaoServidor } from '../api/provas.js'
import { validarInscricao } from '../api/inscricoes.js'
import { getStatusProva } from '../api/admin.js'
import { getCarreira } from '../data/carreiras.js'
import Questao from '../components/Questao.jsx'
import Timer from '../components/Timer.jsx'
import {
  carregarSessaoProva,
  salvarSessaoProva,
  limparSessaoProva,
} from '../utils/sessaoProva.js'

export default function Prova() {
  const navigate = useNavigate()
  const { inscricao, resultado, setResultado, encerrarSessao } = useInscricao()

  const [prova, setProva] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [provaFechada, setProvaFechada] = useState(false)
  const [inscricaoInvalida, setInscricaoInvalida] = useState(null)
  const [pausada, setPausada] = useState(false)
  const [respostas, setRespostas] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [fimEm, setFimEm] = useState(null) // horário-limite (estado: re-renderiza o Timer se mudar)

  const respostasRef = useRef({})
  const enviadoRef = useRef(false)
  const inicioRef = useRef(Date.now()) // instante de início (persistido)
  const fimRef = useRef(null) // horário-limite absoluto (epoch ms)
  const duracaoRef = useRef(90) // duração base da prova (min), sem o tempo extra
  const backupTimerRef = useRef(null) // debounce do backup no servidor

  // Carrega a prova da carreira escolhida (e verifica se a prova está aberta).
  // Também valida no servidor a inscrição salva no navegador ANTES de começar —
  // assim ninguém faz a prova inteira para descobrir no envio que ela não existe mais.
  useEffect(() => {
    let ativo = true
    setCarregando(true)
    Promise.all([
      getProva(inscricao.carreira),
      getStatusProva(),
      validarInscricao(inscricao.id),
      getSessaoServidor(inscricao.id),
    ])
      .then(([p, status, valida, servidor]) => {
        if (!ativo) return

        // Prova pausada pela administração: o progresso está salvo; não entra agora.
        if (servidor?.pausada) {
          setPausada(true)
          return
        }

        // Restaura a sessão local (reload/reabertura) e/ou a salva no servidor
        // (retomada em outro navegador/dispositivo). Cronômetro e respostas não resetam.
        const local = carregarSessaoProva(inscricao.id)
        const temServidor = !!servidor && servidor.inicio > 0
        const existente = local || temServidor

        // Uma sessão EM ANDAMENTO tem prioridade sobre os bloqueios abaixo: mesmo
        // que a inscrição tenha sumido do servidor (o envio a recria) ou o certame
        // tenha fechado (só impede INICIAR), o candidato pode concluir e enviar.
        if (!valida.ok && !existente) {
          setInscricaoInvalida(valida.mensagem || 'Inscrição não encontrada. Refaça a inscrição.')
          return
        }
        if (status?.fechada && !existente) {
          setProvaFechada(true)
          return
        }

        // O início do SERVIDOR é o oficial (impede "ganhar tempo" limpando o navegador);
        // as respostas locais prevalecem por chave (são as mais recentes deste aparelho).
        const inicio = temServidor ? servidor.inicio : (local?.inicio ?? Date.now())
        const respostasIniciais = { ...(servidor?.respostas || {}), ...(local?.respostas || {}) }
        const sessao = { inicio, respostas: respostasIniciais }
        salvarSessaoProva(inscricao.id, sessao)

        duracaoRef.current = p.duracaoMinutos ?? 90
        inicioRef.current = inicio
        const fim = inicio + (duracaoRef.current + (servidor?.extraMinutos || 0)) * 60000
        fimRef.current = fim
        setFimEm(fim)
        respostasRef.current = respostasIniciais
        setRespostas(respostasIniciais)
        setProva(p)

        // Primeiro backup imediato: registra a sessão no servidor (o painel admin
        // passa a ver o candidato "em prova") e sincroniza pausa/tempo extra.
        salvarSessaoServidor(inscricao.id, inicio, respostasIniciais).then(
          (s) => ativo && aplicarSessaoServidor(s),
        )
      })
      .catch((e) => ativo && setErro(e.message || 'Erro ao carregar a prova.'))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [inscricao.carreira, inscricao.id])

  /**
   * Aplica o retorno do servidor sobre a sessão: pausa administrativa, tempo extra
   * concedido e deslocamento do início (após uma retomada) valem imediatamente.
   */
  function aplicarSessaoServidor(s) {
    if (!s || enviadoRef.current) return
    if (s.pausada) setPausada(true)
    if (s.inicio > 0) inicioRef.current = s.inicio
    const novoFim = inicioRef.current + (duracaoRef.current + (s.extraMinutos || 0)) * 60000
    if (novoFim !== fimRef.current) {
      fimRef.current = novoFim
      setFimEm(novoFim)
    }
  }

  /** Backup do progresso no servidor (melhor esforço, com debounce). */
  function agendarBackup() {
    if (backupTimerRef.current) return
    backupTimerRef.current = setTimeout(() => {
      backupTimerRef.current = null
      if (enviadoRef.current) return
      salvarSessaoServidor(inscricao.id, inicioRef.current, respostasRef.current).then(
        aplicarSessaoServidor,
      )
    }, 10000)
  }

  // Heartbeat: mesmo sem novas respostas, sincroniza com o servidor a cada 30s —
  // é por aqui que pausa e tempo extra chegam a um candidato parado na prova.
  useEffect(() => {
    if (!prova) return undefined
    const i = setInterval(() => {
      if (enviadoRef.current || pausada) return
      salvarSessaoServidor(inscricao.id, inicioRef.current, respostasRef.current).then(
        aplicarSessaoServidor,
      )
    }, 30000)
    return () => {
      clearInterval(i)
      if (backupTimerRef.current) {
        clearTimeout(backupTimerRef.current)
        backupTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prova, pausada, inscricao.id])

  // Sessão inválida (inscrição sumiu do servidor): limpa tudo e volta à inscrição.
  function refazerInscricao() {
    limparSessaoProva(inscricao.id)
    encerrarSessao()
    navigate('/inscricao', { replace: true })
  }

  function responder(questaoId, valor) {
    setRespostas((r) => {
      const novo = { ...r, [questaoId]: valor }
      respostasRef.current = novo
      // Persiste a cada marcação para sobreviver a reload/queda de conexão.
      salvarSessaoProva(inscricao.id, { inicio: inicioRef.current, respostas: novo })
      return novo
    })
    agendarBackup() // backup no servidor (debounce) — permite retomar em outro aparelho
  }

  const finalizar = useCallback(
    async (motivo = 'manual') => {
      if (enviadoRef.current) return
      enviadoRef.current = true
      setConfirmar(false)
      setEnviando(true)
      try {
        // Tempo real decorrido (resistente a reload), limitado à duração da prova.
        const decorrido = Math.round((Date.now() - inicioRef.current) / 1000)
        const limite = fimRef.current
          ? Math.round((fimRef.current - inicioRef.current) / 1000)
          : decorrido
        const payload = {
          inscricaoId: inscricao.id,
          carreiraId: inscricao.carreira,
          respostas: respostasRef.current,
          tempoGastoSegundos: Math.max(0, Math.min(decorrido, limite)),
          finalizadaPor: motivo,
          candidato: {
            nome: inscricao.nome,
            email: inscricao.email,
            idade: inscricao.idade,
            cpf: inscricao.cpf,
          },
        }
        const resultado = await enviarProva(payload)
        limparSessaoProva(inscricao.id) // prova enviada: descarta a sessão salva
        setResultado(resultado)
        navigate('/resultado')
      } catch (e) {
        enviadoRef.current = false
        setErro(e.message || 'Erro ao enviar a prova.')
        setEnviando(false)
      }
    },
    [inscricao.id, inscricao.carreira, navigate, setResultado],
  )

  // Avisa o candidato se tentar fechar/recarregar a aba durante a prova.
  const pausadaRef = useRef(false)
  pausadaRef.current = pausada
  useEffect(() => {
    function aviso(e) {
      if (enviadoRef.current || pausadaRef.current) return // pausada: progresso já está salvo
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [])

  const carreira = getCarreira(inscricao.carreira)
  const totalQuestoes = prova?.questoes.length ?? 0
  const respondidas = useMemo(
    () => (prova ? prova.questoes.filter((q) => !!respostas[q.id]).length : 0),
    [prova, respostas],
  )

  // Quem já enviou a prova não pode refazê-la — vai direto ao resultado.
  if (resultado) return <Navigate to="/resultado" replace />

  if (carregando) {
    return (
      <div className="pagina estado-carregando">
        <div className="spinner" />
        <p>Carregando a prova de {carreira?.nome}...</p>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="pagina">
        <div className="alerta alerta--erro">{erro}</div>
        <button className="btn btn--ghost" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (inscricaoInvalida) {
    return (
      <div className="pagina estado-carregando">
        <div className="bloqueio-icone" aria-hidden>⚠️</div>
        <h1>Inscrição não localizada</h1>
        <p>
          {inscricaoInvalida} A sessão salva neste navegador não é mais válida no servidor —
          é preciso refazer a inscrição antes de iniciar a prova.
        </p>
        <button className="btn btn--primario" onClick={refazerInscricao}>
          Refazer inscrição
        </button>
      </div>
    )
  }

  if (pausada) {
    return (
      <div className="pagina estado-carregando">
        <div className="bloqueio-icone" aria-hidden>⏸️</div>
        <h1>Prova pausada</h1>
        <p>
          Sua prova foi pausada pela administração do certame. <strong>Todo o seu progresso está
          salvo</strong> e o cronômetro está congelado — nenhum tempo será perdido. Quando a
          administração retomar, recarregue esta página para continuar de onde parou.
        </p>
        <button className="btn btn--primario" onClick={() => window.location.reload()}>
          Verificar novamente
        </button>
      </div>
    )
  }

  if (provaFechada) {
    return (
      <div className="pagina estado-carregando">
        <div className="bloqueio-icone" aria-hidden>🔒</div>
        <h1>Prova encerrada</h1>
        <p>
          As inscrições e a aplicação da prova foram encerradas pela administração do certame.
          Não é possível iniciar a prova neste momento.
        </p>
        <Link to="/" className="btn btn--primario">Voltar ao início</Link>
      </div>
    )
  }

  return (
    <div className="prova">
      <div className="prova__topo">
        <div className="prova__identificacao">
          <h1>Prova · {prova.carreira}</h1>
          <p>
            Candidato: <strong>{inscricao.nome}</strong> · Protocolo:{' '}
            <strong>{inscricao.protocolo}</strong>
          </p>
        </div>
        <Timer fimEm={fimEm} onExpirar={() => finalizar('tempo_esgotado')} />
      </div>

      <div className="prova__progresso">
        <div className="barra">
          <div
            className="barra__preenchida"
            style={{ width: `${totalQuestoes ? (respondidas / totalQuestoes) * 100 : 0}%` }}
          />
        </div>
        <span>
          {respondidas} de {totalQuestoes} respondidas
        </span>
      </div>

      <div className="prova__instrucoes alerta alerta--info">
        Leia atentamente cada questão. As questões objetivas têm apenas uma alternativa correta.
        As questões discursivas serão avaliadas pela banca. Ao finalizar, suas respostas não poderão
        ser alteradas.
      </div>

      <div className="prova__questoes">
        {prova.questoes.map((q, i) => (
          <Questao
            key={q.id}
            numero={i + 1}
            questao={q}
            resposta={respostas[q.id]}
            onResponder={responder}
          />
        ))}
      </div>

      <div className="prova__acoes">
        <span>
          {respondidas < totalQuestoes
            ? `Você ainda não respondeu ${totalQuestoes - respondidas} questão(ões).`
            : 'Todas as questões foram respondidas.'}
        </span>
        <button
          className="btn btn--primario btn--lg"
          onClick={() => setConfirmar(true)}
          disabled={enviando}
        >
          {enviando ? 'Enviando...' : 'Finalizar e enviar prova'}
        </button>
      </div>

      {confirmar && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__caixa">
            <h2>Confirmar envio</h2>
            <p>
              Você respondeu <strong>{respondidas}</strong> de <strong>{totalQuestoes}</strong>{' '}
              questões. Após o envio não será possível alterar as respostas. Deseja finalizar?
            </p>
            <div className="modal__acoes">
              <button className="btn btn--ghost" onClick={() => setConfirmar(false)}>
                Voltar à prova
              </button>
              <button className="btn btn--primario" onClick={() => finalizar('manual')}>
                Confirmar envio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
