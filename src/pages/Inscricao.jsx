import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CARREIRAS } from '../data/carreiras.js'
import { validarInscricao } from '../utils/validators.js'
import { criarInscricao } from '../api/inscricoes.js'
import { getStatusProva } from '../api/admin.js'
import { useInscricao } from '../context/InscricaoContext.jsx'

const VAZIO = { nome: '', email: '', idade: '', cpf: '', carreira: '' }
const CONSENTIMENTO_ERRO = 'É necessário concordar para prosseguir.'

export default function Inscricao() {
  const navigate = useNavigate()
  const { inscricao, setInscricao } = useInscricao()
  const [form, setForm] = useState(inscricao ? { ...VAZIO, ...inscricao } : VAZIO)
  const [erros, setErros] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [erroApi, setErroApi] = useState(null)
  const [provaFechada, setProvaFechada] = useState(false)
  const [consentimento, setConsentimento] = useState(false)

  // Verifica se o certame está aberto.
  useEffect(() => {
    let ativo = true
    getStatusProva()
      .then((s) => ativo && setProvaFechada(!!s?.fechada))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: null }))
  }

  async function enviar(e) {
    e.preventDefault()
    setErroApi(null)
    if (provaFechada) {
      setErroApi('As inscrições estão encerradas pela administração do certame.')
      return
    }
    const novosErros = validarInscricao(form)
    if (!consentimento) novosErros.consentimento = CONSENTIMENTO_ERRO
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) {
      // foca o primeiro campo com erro
      const primeiro = document.querySelector('.campo--erro input, .campo--erro select')
      primeiro?.focus()
      return
    }

    try {
      setEnviando(true)
      const dados = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        idade: Number(form.idade),
        cpf: form.cpf.trim(),
        carreira: form.carreira,
      }
      const criada = await criarInscricao(dados)
      setInscricao(criada)
      navigate('/prova')
    } catch (err) {
      setErroApi(err.message || 'Não foi possível concluir a inscrição. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pagina pagina--estreita">
      <h1 className="pagina__titulo">Ficha de Inscrição</h1>
      <p className="pagina__sub">
        Preencha os dados abaixo. O <strong>e-mail deve ser real</strong> — ele será usado para
        contato sobre o resultado. Os demais dados referem-se ao seu personagem no RP.
      </p>

      {provaFechada && (
        <div className="alerta alerta--erro">
          <strong>Inscrições encerradas.</strong> A administração do certame fechou a prova. Não é
          possível realizar novas inscrições no momento.
        </div>
      )}
      {erroApi && <div className="alerta alerta--erro">{erroApi}</div>}

      <form className="formulario" onSubmit={enviar} noValidate>
        <div className={`campo ${erros.nome ? 'campo--erro' : ''}`}>
          <label htmlFor="nome">Nome completo</label>
          <input
            id="nome"
            type="text"
            value={form.nome}
            placeholder="Ex.: João da Silva"
            autoComplete="name"
            onChange={(e) => atualizar('nome', e.target.value)}
          />
          {erros.nome && <span className="campo__erro">{erros.nome}</span>}
        </div>

        <div className={`campo ${erros.email ? 'campo--erro' : ''}`}>
          <label htmlFor="email">E-mail (real)</label>
          <input
            id="email"
            type="email"
            value={form.email}
            placeholder="seu.email@exemplo.com"
            autoComplete="email"
            onChange={(e) => atualizar('email', e.target.value)}
          />
          {erros.email && <span className="campo__erro">{erros.email}</span>}
        </div>

        <div className="campo-linha">
          <div className={`campo ${erros.idade ? 'campo--erro' : ''}`}>
            <label htmlFor="idade">Idade (RP)</label>
            <input
              id="idade"
              type="number"
              min="18"
              max="70"
              value={form.idade}
              placeholder="Ex.: 25"
              onChange={(e) => atualizar('idade', e.target.value)}
            />
            {erros.idade && <span className="campo__erro">{erros.idade}</span>}
          </div>

          <div className={`campo ${erros.cpf ? 'campo--erro' : ''}`}>
            <label htmlFor="idDiscord">ID do Discord</label>
            <input
              id="idDiscord"
              type="text"
              inputMode="numeric"
              value={form.cpf}
              placeholder="Ex.: 123456789012345678"
              onChange={(e) => atualizar('cpf', e.target.value.replace(/\D/g, ''))}
            />
            {erros.cpf && <span className="campo__erro">{erros.cpf}</span>}
          </div>
        </div>

        <fieldset className={`campo ${erros.carreira ? 'campo--erro' : ''}`}>
          <legend>Escolha o cargo da prova</legend>
          <div className="opcoes-carreira">
            {CARREIRAS.map((c) => (
              <label
                key={c.id}
                className={`opcao-carreira ${form.carreira === c.id ? 'is-ativa' : ''}`}
              >
                <input
                  type="radio"
                  name="carreira"
                  value={c.id}
                  checked={form.carreira === c.id}
                  onChange={() => atualizar('carreira', c.id)}
                />
                <span className="opcao-carreira__nome">{c.nome}</span>
                <span className="opcao-carreira__dur">{c.duracaoMinutos} min</span>
              </label>
            ))}
          </div>
          {erros.carreira && <span className="campo__erro">{erros.carreira}</span>}
        </fieldset>

        <div className={`campo campo--consentimento ${erros.consentimento ? 'campo--erro' : ''}`}>
          <label className="consentimento">
            <input
              type="checkbox"
              checked={consentimento}
              onChange={(e) => {
                setConsentimento(e.target.checked)
                if (e.target.checked && erros.consentimento) {
                  setErros((prev) => ({ ...prev, consentimento: null }))
                }
              }}
            />
            <span>
              Entendo que este é um <strong>concurso fictício de roleplay (RP)</strong> do servidor
              Ilha em São Paulo, <strong>sem qualquer vínculo</strong> com a Polícia Civil de São
              Paulo ou órgãos públicos reais. Concordo que meus dados (nome, e-mail e ID do Discord)
              sejam usados <strong>apenas</strong> para fins do RP e possam ser removidos a meu pedido.
              <strong> Não informo dados sensíveis reais (como CPF).</strong>
            </span>
          </label>
          {erros.consentimento && <span className="campo__erro">{erros.consentimento}</span>}
        </div>

        <button
          type="submit"
          className="btn btn--primario btn--lg btn--bloco"
          disabled={enviando || provaFechada}
        >
          {provaFechada
            ? 'Inscrições encerradas'
            : enviando
              ? 'Enviando inscrição...'
              : 'Confirmar inscrição e iniciar prova'}
        </button>
      </form>
    </div>
  )
}
