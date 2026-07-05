import { jsPDF } from 'jspdf'
import { getCarreira } from '../data/carreiras.js'

const AZUL = [11, 31, 77]
const DOURADO = [212, 175, 55]
const CINZA_ROTULO = [80, 96, 122]
const CINZA_TEXTO = [28, 36, 51]
const VERDE = [31, 157, 87]
const VERMELHO = [194, 57, 43]

/**
 * Carrega a logo e a "achata" sobre um fundo da cor informada (RGB).
 * Isso evita que a transparência do PNG apareça como fundo preto no PDF.
 * Retorna um data URL pronto para o addImage (ou null se falhar).
 */
function carregarLogoComFundo(src, [r, g, b]) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width || 256
        canvas.height = img.naturalHeight || img.height || 256
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function formatarData(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

/**
 * Gera e baixa um PDF de comprovante com os dados do candidato e o resultado
 * preliminar, para ser apresentado na ANP (Academia Nacional de Polícia).
 */
export async function gerarComprovantePDF(inscricao, resultado) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const margem = 16

  const carreira = getCarreira(inscricao.carreira)
  const nomeCargo = carreira?.nome ?? resultado?.carreiraId ?? '—'

  // ---- Cabeçalho ----
  doc.setFillColor(...AZUL)
  doc.rect(0, 0, W, 34, 'F')
  doc.setFillColor(...DOURADO)
  doc.rect(0, 34, W, 1.5, 'F')

  const logo = await carregarLogoComFundo('/Logo.png', AZUL)
  if (logo) doc.addImage(logo, 'PNG', margem, 7, 20, 20)

  const textoX = margem + (logo ? 26 : 0)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('POLÍCIA FEDERAL', textoX, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Concurso Público · Ilha em São Paulo', textoX, 22)
  doc.setFontSize(9)
  doc.text('Comprovante de Inscrição e Resultado Preliminar', textoX, 28)

  // ---- Seção: dados do candidato ----
  let y = 50
  tituloSecao(doc, 'DADOS DO CANDIDATO', margem, W, y)
  y += 12

  const dados = [
    ['Nome', inscricao.nome],
    ['E-mail', inscricao.email],
    ['Idade', `${inscricao.idade} anos`],
    ['ID do Discord', inscricao.cpf],
    ['Cargo pretendido', nomeCargo],
    ['Protocolo', inscricao.protocolo || '—'],
    ['Data da inscrição', formatarData(inscricao.criadoEm)],
  ]
  doc.setFontSize(11)
  for (const [rotulo, valor] of dados) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...CINZA_ROTULO)
    doc.text(`${rotulo}:`, margem, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...CINZA_TEXTO)
    doc.text(String(valor ?? '—'), margem + 52, y)
    y += 8
  }

  // ---- Seção: resultado ----
  const obj = resultado?.objetivas
  if (obj) {
    y += 4
    tituloSecao(doc, 'RESULTADO PRELIMINAR (questões objetivas)', margem, W, y)
    y += 12

    const aprovado = obj.aprovadoPreliminar
    const linhas = [
      ['Acertos', `${obj.acertos} de ${obj.total}`],
      ['Aproveitamento', `${obj.percentual}%`],
      ['Nota de corte', `${obj.notaDeCorte}%`],
    ]
    doc.setFontSize(11)
    for (const [rotulo, valor] of linhas) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...CINZA_ROTULO)
      doc.text(`${rotulo}:`, margem, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...CINZA_TEXTO)
      doc.text(String(valor), margem + 52, y)
      y += 8
    }
    // Situação em destaque
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...CINZA_ROTULO)
    doc.text('Situação:', margem, y)
    doc.setTextColor(...(aprovado ? VERDE : VERMELHO))
    doc.text(
      aprovado ? 'APTO (classificação preliminar)' : 'NÃO APTO (classificação preliminar)',
      margem + 52,
      y,
    )
    y += 9

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...CINZA_ROTULO)
    doc.text('As questões discursivas ainda serão avaliadas pela banca examinadora.', margem, y)
    y += 10
  }

  // ---- Caixa: apresentação na ANP ----
  const boxH = 26
  doc.setFillColor(239, 243, 255)
  doc.setDrawColor(...AZUL)
  doc.setLineWidth(0.3)
  doc.roundedRect(margem, y, W - margem * 2, boxH, 2, 2, 'FD')
  doc.setTextColor(...AZUL)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('APRESENTAÇÃO NA ANP', margem + 4, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...CINZA_TEXTO)
  const aviso =
    'Apresente este comprovante no momento da sua apresentação na Academia Nacional de Polícia (ANP), ' +
    'junto com seu documento de identificação do roleplay.'
  doc.text(doc.splitTextToSize(aviso, W - margem * 2 - 8), margem + 4, y + 14)

  // ---- Rodapé ----
  doc.setDrawColor(...DOURADO)
  doc.setLineWidth(0.4)
  doc.line(margem, H - 18, W - margem, H - 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 130, 150)
  doc.text(`Documento gerado em ${formatarData(new Date().toISOString())}`, margem, H - 12)
  doc.text('Polícia Federal — Ilha em São Paulo', W - margem, H - 12, {
    align: 'right',
  })

  const base = inscricao.protocolo || inscricao.nome || 'comprovante'
  const nomeArquivo = `comprovante-${String(base).replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`
  doc.save(nomeArquivo)
}

function tituloSecao(doc, texto, margem, W, y) {
  doc.setTextColor(...AZUL)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(texto, margem, y)
  doc.setDrawColor(...DOURADO)
  doc.setLineWidth(0.5)
  doc.line(margem, y + 2, W - margem, y + 2)
}
