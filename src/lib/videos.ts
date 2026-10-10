export interface VideoItem {
  id: string
  filename: string
  title: string
  url: string
  thumbnail: string
  format: string
  profile?: string
  author?: string
  duration?: number
}

export interface VideoCatalog { baseUrl: string; videos: VideoItem[] }
export type VideoPrepareError = 'not-found' | 'network' | 'cors' | 'invalid' | 'too-large' | 'unsupported'

export class VideoFileError extends Error {
  constructor(public code: VideoPrepareError) { super(code) }
}

const maxShareBytes = 100 * 1024 * 1024
const mimeByFormat: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime' }

export function validateVideoCatalog(value: unknown): { videos: VideoItem[]; errors: string[] } {
  const errors: string[] = []
  if (!value || typeof value !== 'object' || !('videos' in value) || !Array.isArray(value.videos)) return { videos: [], errors: ['Catálogo de vídeos inválido'] }
  const ids = new Set<string>()
  const videos: VideoItem[] = []
  for (const video of value.videos) {
    if (!video || typeof video !== 'object') { errors.push('Registro de vídeo inválido'); continue }
    const item = video as VideoItem
    let valid = typeof item.id === 'string' && item.id.length > 0 && !ids.has(item.id)
      && typeof item.filename === 'string' && item.filename.length > 0
      && typeof item.title === 'string' && item.title.length > 0
      && typeof item.thumbnail === 'string' && item.thumbnail.startsWith('/thumbs/')
      && typeof item.url === 'string' && /^https:\/\//.test(item.url)
      && typeof item.format === 'string' && Object.hasOwn(mimeByFormat, item.format.toLowerCase())
    if (valid) {
      try { valid = new URL(item.url).pathname.toLowerCase().endsWith(`.${item.format.toLowerCase()}`) }
      catch { valid = false }
    }
    if (!valid) { errors.push(`Vídeo inválido ou repetido: ${String(item.id || '(sem ID)')}`); continue }
    ids.add(item.id)
    videos.push(item)
  }
  return { videos, errors }
}

export function filterVideos(videos: VideoItem[], query: string): VideoItem[] {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const term = normalize(query.trim())
  if (!term) return videos
  return videos.filter((item) => normalize([item.title, item.filename, item.profile, item.author].filter(Boolean).join(' ')).includes(term))
}

export function videoMime(item: VideoItem): string { return mimeByFormat[item.format.toLowerCase()] || '' }

export async function prepareVideoFile(item: VideoItem, signal: AbortSignal, onProgress: (received: number, total?: number) => void, fetcher: typeof fetch = fetch): Promise<File> {
  const mime = videoMime(item)
  if (!mime) throw new VideoFileError('unsupported')
  let response: Response
  try { response = await fetcher(item.url, { signal, mode: 'cors' }) }
  catch (error) {
    if (signal.aborted) throw error
    throw new VideoFileError(error instanceof TypeError ? 'cors' : 'network')
  }
  if (response.status === 404) throw new VideoFileError('not-found')
  if (!response.ok) throw new VideoFileError('network')
  const contentType = response.headers.get('content-type')?.toLowerCase() || ''
  if (contentType.includes('text/html') || contentType.includes('application/json')) throw new VideoFileError('invalid')
  const total = Number(response.headers.get('content-length')) || undefined
  if (total && total > maxShareBytes) { await response.body?.cancel(); throw new VideoFileError('too-large') }
  if (!response.body) throw new VideoFileError('network')
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > maxShareBytes) throw new VideoFileError('too-large')
      chunks.push(new Uint8Array(value))
      onProgress(received, total)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
  if (!received) throw new VideoFileError('invalid')
  return new File(chunks, item.filename, { type: mime })
}
