// Validações do formulário de inscrição.
// Observação de RP: o único identificador do jogador é o ID do Discord.

export function validarNome(nome) {
  const v = (nome || '').trim()
  if (v.length < 3) return 'Informe o nome completo (mínimo 3 caracteres).'
  if (!/^[A-Za-zÀ-ÿ'’.\s]+$/.test(v)) return 'O nome deve conter apenas letras.'
  if (v.split(/\s+/).length < 2) return 'Informe nome e sobrenome.'
  return null
}

export function validarEmail(email) {
  const v = (email || '').trim()
  if (!v) return 'Informe seu e-mail real.'
  // Validação de e-mail razoável (não exige perfeição de RFC).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'E-mail inválido. Use um e-mail real e válido.'
  return null
}

export function validarIdade(idade) {
  const n = Number(idade)
  if (!idade && idade !== 0) return 'Informe sua idade.'
  if (!Number.isInteger(n)) return 'A idade deve ser um número inteiro.'
  if (n < 18) return 'É necessário ter no mínimo 18 anos para o cargo.'
  if (n > 70) return 'Idade fora do limite permitido para o certame.'
  return null
}

/**
 * Identificador do jogador = ID do Discord (snowflake).
 * IDs do Discord são numéricos, normalmente com 17 a 20 dígitos.
 */
export function validarIdDiscord(idDiscord) {
  const v = (idDiscord || '').trim()
  if (!v) return 'Informe seu ID do Discord.'
  if (!/^\d+$/.test(v)) return 'O ID do Discord deve conter apenas números.'
  if (v.length < 17 || v.length > 20) return 'ID do Discord inválido (deve ter entre 17 e 20 dígitos).'
  return null
}

export function validarCarreira(carreira) {
  if (!carreira) return 'Selecione uma carreira.'
  return null
}

/** Valida o formulário inteiro e devolve um objeto de erros (vazio = válido). */
export function validarInscricao(dados) {
  const erros = {}
  const checks = {
    nome: validarNome(dados.nome),
    email: validarEmail(dados.email),
    idade: validarIdade(dados.idade),
    // chave interna mantida como `cpf` (contrato da API), mas representa o ID do Discord.
    cpf: validarIdDiscord(dados.cpf),
    carreira: validarCarreira(dados.carreira),
  }
  for (const [campo, erro] of Object.entries(checks)) {
    if (erro) erros[campo] = erro
  }
  return erros
}
