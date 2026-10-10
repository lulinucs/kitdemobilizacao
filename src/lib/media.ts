import type { PDFEmbeddedPage, PDFImage } from 'pdf-lib'

export interface MediaItem {
  id: string
  path: string
  originalName: string
  title: string
  category: string
  categoryName: string
  mime: string
  format: string
  bytes: number
  width: number
  height: number
  pages: number | null
  thumbnail: string
  printable: boolean
}

export const copies = [1, 2, 4, 8, 16, 32] as const
export type CopyCount = typeof copies[number]
export type Orientation = 'portrait' | 'landscape'
export const mmToPt = (mm: number) => mm * 72 / 25.4

export function sheetLayout(count: CopyCount, orientation: Orientation, artRatio: number, marginMm: number, gapMm: number) {
  const sheetWidth = orientation === 'portrait' ? 210 : 297
  const sheetHeight = orientation === 'portrait' ? 297 : 210
  const options = copies.filter((value) => value === count).flatMap(() => {
    const result = []
    for (let columns = 1; columns <= count; columns++) {
      if (count % columns) continue
      const rows = count / columns
      const cellWidth = (sheetWidth - 2 * marginMm - (columns - 1) * gapMm) / columns
      const cellHeight = (sheetHeight - 2 * marginMm - (rows - 1) * gapMm) / rows
      if (cellWidth <= 0 || cellHeight <= 0) continue
      const artWidth = Math.min(cellWidth, cellHeight * artRatio)
      const artHeight = artWidth / artRatio
      result.push({ columns, rows, cellWidth, cellHeight, artWidth, artHeight, score: artWidth * artHeight })
    }
    return result
  })
  const best = options.sort((a, b) => b.score - a.score)[0]
  if (!best) throw new Error('Margens ou espaçamento grandes demais para esta folha.')
  return { ...best, sheetWidth, sheetHeight, marginMm, gapMm }
}

export function mediaUrl(id: string) {
  return `${window.location.origin}/midias?midia=${encodeURIComponent(id)}`
}

export async function createPrintPdf(item: MediaItem, pageIndex: number, count: CopyCount, orientation: Orientation, marginMm: number, gapMm: number) {
  const { PDFDocument } = await import('pdf-lib')
  const response = await fetch(item.path)
  if (!response.ok) throw new Error('Não foi possível carregar o arquivo original.')
  const original = await response.arrayBuffer()
  const pdf = await PDFDocument.create()
  let embedded: PDFEmbeddedPage | PDFImage
  if (item.mime === 'application/pdf') {
    const source = await PDFDocument.load(original)
    if (pageIndex < 0 || pageIndex >= source.getPageCount()) throw new Error('Página inválida.')
    ;[embedded] = await pdf.embedPdf(original, [pageIndex])
  } else if (item.mime === 'image/jpeg') {
    embedded = await pdf.embedJpg(original)
  } else if (item.mime === 'image/png') {
    embedded = await pdf.embedPng(original)
  } else {
    const bitmap = await createImageBitmap(new Blob([original], { type: item.mime }))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
    bitmap.close()
    embedded = await pdf.embedPng(await new Promise<ArrayBuffer>((resolve, reject) => canvas.toBlob((blob) => blob ? blob.arrayBuffer().then(resolve) : reject(new Error('Imagem inválida.')), 'image/png')))
  }
  const ratio = embedded.width / embedded.height
  const layout = sheetLayout(count, orientation, ratio, marginMm, gapMm)
  const page = pdf.addPage([mmToPt(layout.sheetWidth), mmToPt(layout.sheetHeight)])
  for (let index = 0; index < count; index++) {
    const col = index % layout.columns
    const row = Math.floor(index / layout.columns)
    const x = layout.marginMm + col * (layout.cellWidth + gapMm) + (layout.cellWidth - layout.artWidth) / 2
    const top = layout.marginMm + row * (layout.cellHeight + gapMm) + (layout.cellHeight - layout.artHeight) / 2
    const placement = { x: mmToPt(x), y: mmToPt(layout.sheetHeight - top - layout.artHeight), width: mmToPt(layout.artWidth), height: mmToPt(layout.artHeight) }
    if (item.mime === 'application/pdf') page.drawPage(embedded as PDFEmbeddedPage, placement)
    else page.drawImage(embedded as PDFImage, placement)
  }
  return { bytes: await pdf.save(), layout }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
