import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canShareFile, prepareShareFile, sharePreparedFile } from './mediaShare'
import type { MediaItem } from './media'
import catalog from '../data/midias.generated.json'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const image = { path: '/midia/WEB/@a%C3%A7%C3%A3o,%20arte.png', originalName: 'ação, arte.png', mime: 'image/png' } as MediaItem
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
const webp = new TextEncoder().encode('RIFF0000WEBP')
const pdfBytes = new TextEncoder().encode('%PDF-1.7')
class TestFile extends Blob implements File { name: string; lastModified = 0; webkitRelativePath = ''; constructor(parts: BlobPart[], name: string, options?: FilePropertyBag) { super(parts, options); this.name = name } }
const response = (bytes: Uint8Array, status = 200, headers?: HeadersInit) => new Response(new Uint8Array(bytes), { status, headers })

describe('preparação do arquivo', () => {
  beforeEach(() => vi.stubGlobal('File', TestFile))
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['foto.jpg', 'image/jpeg', jpeg], ['foto.jpeg', 'image/jpeg', jpeg],
    ['arte.png', 'image/png', png], ['arte.webp', 'image/webp', webp],
  ])('preserva o original %s com MIME correto', async (name, mime, bytes) => {
    const item = { ...image, originalName: name, mime }
    const fetcher = vi.fn(async () => response(bytes)) as unknown as typeof fetch
    const file = await prepareShareFile(item, 1, undefined, fetcher)
    expect(file.name).toBe(name)
    expect(file.type).toBe(mime)
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes)
    expect(fetcher).toHaveBeenCalledWith(item.path, { signal: undefined })
  })

  it('preserva nome Unicode e caminho especial', async () => {
    const fetcher = vi.fn(async () => response(png)) as unknown as typeof fetch
    const file = await prepareShareFile(image, 1, undefined, fetcher)
    expect(file.name).toBe('ação, arte.png')
    expect(fetcher).toHaveBeenCalledWith(image.path, { signal: undefined })
  })

  it.each(['image/jpeg', 'image/png', 'image/webp'])('prepara bytes reais do acervo em %s', async (mime) => {
    const item = (catalog as MediaItem[]).filter((entry) => entry.mime === mime).sort((a, b) => a.bytes - b.bytes)[0]
    const bytes = readFileSync(join('public', decodeURIComponent(item.path).slice(1)))
    const file = await prepareShareFile(item, 1, undefined, vi.fn(async () => response(new Uint8Array(bytes))) as unknown as typeof fetch)
    expect(file.name).toBe(item.originalName)
    expect(file.type).toBe(mime)
    expect(file.size).toBe(bytes.length)
  })

  it('prepara a página escolhida de um PDF como imagem', async () => {
    const item = { ...image, path: '/midia/GUIAS-MANUAIS/guia.pdf', originalName: 'guia.pdf', mime: 'application/pdf' }
    const renderer = vi.fn(async (_blob: Blob, name: string, page: number) => new TestFile([jpeg], `${name}-${page}.jpg`, { type: 'image/jpeg' }))
    const file = await prepareShareFile(item, 2, undefined, vi.fn(async () => response(pdfBytes)) as unknown as typeof fetch, renderer)
    expect(renderer).toHaveBeenCalledWith(expect.any(Blob), 'guia.pdf', 2, undefined)
    expect(file.type).toBe('image/jpeg')
  })

  it.each([[404, 'not-found'], [500, 'network']])('distingue resposta HTTP %i', async (status, code) => {
    await expect(prepareShareFile(image, 1, undefined, vi.fn(async () => response(png, status)) as unknown as typeof fetch)).rejects.toMatchObject({ code })
  })

  it('rejeita HTML do fallback e arquivo grande', async () => {
    await expect(prepareShareFile(image, 1, undefined, vi.fn(async () => response(new TextEncoder().encode('<html>'))) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'invalid-file' })
    await expect(prepareShareFile(image, 1, undefined, vi.fn(async () => response(png, 200, { 'content-length': String(26 * 1024 * 1024) })) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'too-large' })
  })

  it('distingue falha de rede e cancelamento da preparação', async () => {
    await expect(prepareShareFile(image, 1, undefined, vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'network' })
    const controller = new AbortController(); controller.abort()
    await expect(prepareShareFile(image, 1, controller.signal, vi.fn(async () => { throw new DOMException('Cancelado', 'AbortError') }) as unknown as typeof fetch)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('envio nativo', () => {
  const file = new TestFile([png], 'arte.png', { type: 'image/png' }) as File
  it('envia somente files imediatamente, antes de qualquer await', async () => {
    const share = vi.fn(() => Promise.resolve())
    const browser = { share, canShare: vi.fn(() => true) } as unknown as Pick<Navigator, 'share' | 'canShare'>
    const attempt = sharePreparedFile(file, browser)
    expect(share).toHaveBeenCalledWith({ files: [file] })
    expect(await attempt).toBe('shared')
  })
  it('não envia URL em navegador sem suporte a arquivos', async () => {
    const share = vi.fn(() => Promise.resolve())
    const browser = { share, canShare: vi.fn(() => false) } as unknown as Pick<Navigator, 'share' | 'canShare'>
    expect(canShareFile(file, browser)).toBe(false)
    expect(await sharePreparedFile(file, browser)).toBe('unsupported')
    expect(share).not.toHaveBeenCalled()
    expect(canShareFile(file, { share } as unknown as Pick<Navigator, 'share' | 'canShare'>)).toBe(false)
  })
  it.each([
    [new DOMException('cancelado', 'AbortError'), 'cancelled'],
    [new DOMException('bloqueado', 'NotAllowedError'), 'blocked'],
    [new TypeError('inválido'), 'invalid'],
  ])('classifica erro %s sem enviar link', async (error, result) => {
    const share = vi.fn(() => Promise.reject(error))
    const browser = { share, canShare: () => true } as unknown as Pick<Navigator, 'share' | 'canShare'>
    expect(await sharePreparedFile(file, browser)).toBe(result)
    expect(share).toHaveBeenCalledWith({ files: [file] })
  })
})
