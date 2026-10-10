import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareMaterial } from './mediaShare'
import type { MediaItem } from './media'

const item = { path: '/midia/teste.png', originalName: 'teste.png', title: 'Teste', mime: 'image/png' } as MediaItem
const url = 'https://exemplo.org/midias?midia=teste'

describe('compartilhamento', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('usa o arquivo quando o navegador aceita arquivos', async () => {
    const share = vi.fn(async () => undefined)
    vi.stubGlobal('File', class { name: string; constructor(_parts: unknown[], name: string) { this.name = name } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2]), { status: 200 })))
    vi.stubGlobal('navigator', { share, canShare: () => true })
    expect(await shareMaterial(item, url)).toBe('file')
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.objectContaining({ name: 'teste.png' })] }))
  })
  it('usa o link quando compartilhar arquivos não é suportado', async () => {
    const share = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { share })
    expect(await shareMaterial(item, url)).toBe('link')
    expect(share).toHaveBeenCalledWith({ title: 'Teste', url })
  })
  it('distingue cancelamento de falta de suporte', async () => {
    vi.stubGlobal('navigator', {})
    expect(await shareMaterial(item, url)).toBe('unavailable')
    vi.stubGlobal('navigator', { share: async () => { throw new DOMException('Cancelado', 'AbortError') } })
    expect(await shareMaterial(item, url)).toBe('cancelled')
  })
})
