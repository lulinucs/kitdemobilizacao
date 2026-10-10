import type { MediaItem } from './media'

type Fetcher = typeof fetch
type PdfRenderer = (blob: Blob, name: string, page: number, signal?: AbortSignal) => Promise<File>
export type ShareResult = 'shared' | 'cancelled' | 'blocked' | 'invalid' | 'unsupported' | 'error'
export type PreparationError = 'not-found' | 'network' | 'invalid-file' | 'too-large' | 'pdf-render'

export class SharePreparationError extends Error {
  constructor(public code: PreparationError) { super(code) }
}

const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
}
const maxOriginalBytes = 25 * 1024 * 1024

function validSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/png') return bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === 'PNG'
  if (mime === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (mime === 'application/pdf') return String.fromCharCode(...bytes.slice(0, 4)) === '%PDF'
  return false
}

async function renderPdfPage(blob: Blob, name: string, page: number, signal?: AbortSignal): Promise<File> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
  const loading = pdfjs.getDocument({ data: await blob.arrayBuffer() })
  const abort = () => { void loading.destroy() }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const document = await loading.promise
    if (page < 1 || page > document.numPages) throw new SharePreparationError('invalid-file')
    const source = await document.getPage(page)
    const original = source.getViewport({ scale: 1 })
    const scale = Math.min(1800 / Math.max(original.width, original.height), 2)
    const viewport = source.getViewport({ scale })
    const canvas = window.document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new SharePreparationError('pdf-render')
    await source.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
    const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new SharePreparationError('pdf-render')), 'image/jpeg', .9))
    const stem = name.replace(/\.pdf$/i, '')
    return new File([image], `${stem}-pagina-${page}.jpg`, { type: 'image/jpeg' })
  } catch (error) {
    if (error instanceof SharePreparationError || (error instanceof DOMException && error.name === 'AbortError')) throw error
    throw new SharePreparationError('pdf-render')
  } finally {
    signal?.removeEventListener('abort', abort)
    await loading.destroy()
  }
}

export async function prepareShareFile(item: MediaItem, page = 1, signal?: AbortSignal, fetcher: Fetcher = fetch, renderPdf: PdfRenderer = renderPdfPage): Promise<File> {
  const extension = item.originalName.split('.').at(-1)?.toLowerCase() || ''
  const mime = mimeByExtension[extension]
  if (!mime || mime !== item.mime) throw new SharePreparationError('invalid-file')
  let response: Response
  try { response = await fetcher(item.path, { signal }) }
  catch (error) {
    if (signal?.aborted) throw error
    throw new SharePreparationError('network')
  }
  if (response.status === 404) throw new SharePreparationError('not-found')
  if (!response.ok) throw new SharePreparationError('network')
  const reportedSize = Number(response.headers.get('content-length'))
  if (reportedSize > maxOriginalBytes) throw new SharePreparationError('too-large')
  const blob = await response.blob()
  if (blob.size > maxOriginalBytes) throw new SharePreparationError('too-large')
  const signature = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  if (!validSignature(signature, mime)) throw new SharePreparationError('invalid-file')
  if (mime === 'application/pdf') return renderPdf(blob, item.originalName, page, signal)
  return new File([blob], item.originalName, { type: mime })
}

export function canShareFile(file: File, browser: Pick<Navigator, 'share' | 'canShare'> = navigator): boolean {
  if (typeof browser.share !== 'function' || typeof browser.canShare !== 'function') return false
  try { return browser.canShare({ files: [file] }) }
  catch { return false }
}

// Chame diretamente do evento de clique. Não há await antes de navigator.share().
export function sharePreparedFile(file: File, browser: Pick<Navigator, 'share' | 'canShare'> = navigator): Promise<ShareResult> {
  if (!canShareFile(file, browser)) return Promise.resolve('unsupported')
  try {
    return browser.share({ files: [file] }).then(() => 'shared' as const, (error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      if (error instanceof DOMException && error.name === 'NotAllowedError') return 'blocked'
      if (error instanceof TypeError) return 'invalid'
      return 'error'
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return Promise.resolve('cancelled')
    if (error instanceof DOMException && error.name === 'NotAllowedError') return Promise.resolve('blocked')
    if (error instanceof TypeError) return Promise.resolve('invalid')
    return Promise.resolve('error')
  }
}
