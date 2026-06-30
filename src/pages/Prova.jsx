import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInscricao } from '../context/InscricaoContext.jsx'
import { getProva, enviarProva } from '../api/provas.js'
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
  const { inscricao, setResultado } = useInscricao()

  const [prova, setProva] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [provaFechada, setProvaFechada] = useState(false)
  const [respostas, setRespostas] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  const respostasRef = useRef({})
  const enviadoRef = useRef(false)
  const inicioRef = useRef(Date.now()) // instante de início (persistido)
  const fimRef = useRef(null) // horário-limite absoluto (epoch ms)

  // Carrega a prova da carreira escolhida (e verifica se a prova está aberta).
  useEffect(() => {
    let ativo = true
    setCarregando(true)
    Promise.all([getProva(inscricao.carreira), getStatusProva()])
      .then(([p, status]) => {
        if (!ativo) return
        if (status?.fechada) {
          setProvaFechada(true)
          return
        }

        // Restaura a sessão se já existir (reload/reabertura) ou cria uma nova.
        // Assim cronômetro e respostas NÃO resetam ao recarregar a página.
        const existente = carregarSessaoProva(inscricao.id)
        const sessao = existente ?? { inicio: Date.now(), respostas: {} }
        if (!existente) salvarSessaoProva(inscricao.id, sessao)

        inicioRef.current = sessao.inicio
        fimRef.current = sessao.inicio + (p.duracaoMinutos ?? 90) * 60000
        respostasRef.current = sessao.respostas || {}
        setRespostas(sessao.respostas || {})
        setProva(p)
      })
      .catch((e) => ativo && setErro(e.message || 'Erro ao carregar a prova.'))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [inscricao.carreira])

  function responder(questaoId, valor) {
    setRespostas((r) => {
      const novo = { ...r, [questaoId]: valor }
      respostasRef.current = novo
      // Persiste a cada marcação para sobreviver a reload/queda de conexão.
      salvarSessaoProva(inscricao.id, { inicio: inicioRef.current, respostas: novo })
      return novo
    })
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
  useEffect(() => {
    function aviso(e) {
      if (enviadoRef.current) return
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
        <Timer fimEm={fimRef.current} onExpirar={() => finalizar('tempo_esgotado')} />
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
