import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import rawCatalog from '../../public/videos_kit.json'
import { filterVideos, prepareVideoFile, validateVideoCatalog, VideoFileError, type VideoItem } from './videos'

class TestFile extends Blob implements File { name: string; lastModified = 0; webkitRelativePath = ''; constructor(parts: BlobPart[], name: string, options?: FilePropertyBag) { super(parts, options); this.name = name } }
const sample = rawCatalog.videos[0] as VideoItem

describe('catálogo de vídeos', () => {
  it('usa as URLs do JSON e verifica todas as miniaturas', () => {
    const { videos, errors } = validateVideoCatalog(rawCatalog)
    expect(errors).toEqual([])
    expect(videos).toHaveLength(125)
    const withThumbnail = videos.filter((video) => existsSync(join('public', video.thumbnail.slice(1))))
    expect(withThumbnail).toHaveLength(videos.length)
    expect(videos.filter((video) => video.format === 'mov')).toHaveLength(1)
    expect(videos[0].url).toBe(rawCatalog.videos[0].url)
  })

  it('busca por título, nome original e autoria sem inventar metadados', () => {
    const videos = [sample, { ...sample, id: 'outro', title: 'Arte', filename: 'outro.mp4', profile: 'Pessoa Teste' }]
    expect(filterVideos(videos, 'FLAVIO')).toEqual([sample])
    expect(filterVideos(videos, 'VICE DE')).toEqual([sample])
    expect(filterVideos(videos, 'pessoa teste')).toEqual([videos[1]])
  })

  it('rejeita IDs duplicados e formato inválido', () => {
    const result = validateVideoCatalog({ videos: [sample, sample, { ...sample, id: 'terceiro', format: 'avi' }] })
    expect(result.videos).toHaveLength(1)
    expect(result.errors).toHaveLength(2)
  })
})

describe('preparação do compartilhamento de vídeos', () => {
  beforeEach(() => vi.stubGlobal('File', TestFile))
  afterEach(() => vi.unstubAllGlobals())

  it('preserva URL, bytes, nome Unicode e MIME antes de compartilhar', async () => {
    const item = { ...sample, filename: 'vídeo (ação)!.mp4' }
    const bytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109])
    const fetcher = vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) } })) as unknown as typeof fetch
    const progress = vi.fn()
    const file = await prepareVideoFile(item, new AbortController().signal, progress, fetcher)
    expect(fetcher).toHaveBeenCalledWith(item.url, { signal: expect.any(AbortSignal), mode: 'cors' })
    expect(file.name).toBe(item.filename)
    expect(file.type).toBe('video/mp4')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes)
    expect(progress).toHaveBeenCalledWith(bytes.length, bytes.length)
  })

  it('explica falha de CORS e impede arquivos grandes antes do download', async () => {
    await expect(prepareVideoFile(sample, new AbortController().signal, vi.fn(), vi.fn(async () => { throw new TypeError('CORS') }) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'cors' })
    const fetcher = vi.fn(async () => new Response('x', { headers: { 'content-length': String(101 * 1024 * 1024) } })) as unknown as typeof fetch
    await expect(prepareVideoFile(sample, new AbortController().signal, vi.fn(), fetcher)).rejects.toEqual(new VideoFileError('too-large'))
  })

  it('não aceita HTML nem URLs ausentes como vídeo', async () => {
    const html = vi.fn(async () => new Response('<html/>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch
    await expect(prepareVideoFile(sample, new AbortController().signal, vi.fn(), html)).rejects.toMatchObject({ code: 'invalid' })
    const missing = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch
    await expect(prepareVideoFile(sample, new AbortController().signal, vi.fn(), missing)).rejects.toMatchObject({ code: 'not-found' })
  })
})
