import { afterEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import catalog from '../data/midias.generated.json'
import { copies, createPrintPdf, sheetLayout, type MediaItem } from './media'

const items = catalog as MediaItem[]

describe('catálogo de mídias', () => {
  it('usa IDs e caminhos únicos, categorias das pastas e miniaturas separadas', () => {
    expect(items.length).toBeGreaterThan(250)
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length)
    expect(new Set(items.map((item) => item.path)).size).toBe(items.length)
    for (const item of items) {
      expect(item.path).toMatch(/^\/midia\//)
      expect(item.thumbnail).toMatch(/^\/midia-miniaturas\//)
      expect(item.category).toBe(decodeURIComponent(item.path.split('/')[2]))
      expect(item.bytes).toBeLessThanOrEqual(25 * 1024 * 1024)
      expect(item.width).toBeGreaterThan(0)
      expect(item.height).toBeGreaterThan(0)
      if (item.mime === 'application/pdf') expect(item.pages).toBeGreaterThan(0)
    }
    expect(items.some((item) => /%20|%40|%C3/i.test(item.path))).toBe(true)
  })
})

describe('folha A4', () => {
  afterEach(() => vi.unstubAllGlobals())
  it.each(['portrait', 'landscape'] as const)('mantém todas as cópias dentro da folha em %s', (orientation) => {
    for (const count of copies) {
      const result = sheetLayout(count, orientation, .72, 8, 3)
      expect(result.columns * result.rows).toBe(count)
      expect(result.artWidth).toBeLessThanOrEqual(result.cellWidth + 0.00001)
      expect(result.artHeight).toBeLessThanOrEqual(result.cellHeight + 0.00001)
      expect(result.marginMm * 2 + result.columns * result.cellWidth + (result.columns - 1) * result.gapMm).toBeCloseTo(result.sheetWidth)
      expect(result.marginMm * 2 + result.rows * result.cellHeight + (result.rows - 1) * result.gapMm).toBeCloseTo(result.sheetHeight)
    }
  })

  it('gera PDF A4 para imagens em todas as quantidades e orientações', async () => {
    const png = await sharp({ create: { width: 20, height: 30, channels: 4, background: '#ffcc00' } }).png().toBuffer()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(png), { status: 200 })))
    const item = { mime: 'image/png', path: '/teste.png', width: 20, height: 30 } as MediaItem
    for (const orientation of ['portrait', 'landscape'] as const) for (const count of copies) {
      const result = await createPrintPdf(item, 0, count, orientation, 8, 3)
      const pdf = await PDFDocument.load(result.bytes)
      expect(pdf.getPageCount()).toBe(1)
      const { width, height } = pdf.getPage(0).getSize()
      expect(width).toBeCloseTo((orientation === 'portrait' ? 210 : 297) * 72 / 25.4)
      expect(height).toBeCloseTo((orientation === 'portrait' ? 297 : 210) * 72 / 25.4)
      expect(result.layout.columns * result.layout.rows).toBe(count)
    }
  })

  it('repete a página escolhida de um PDF multipágina', async () => {
    const source = await PDFDocument.create()
    source.addPage([400, 600]).drawRectangle({ x: 10, y: 10, width: 30, height: 30 })
    source.addPage([600, 400]).drawRectangle({ x: 10, y: 10, width: 30, height: 30 })
    const bytes = await source.save()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(bytes), { status: 200 })))
    const item = { mime: 'application/pdf', path: '/teste.pdf', width: 400, height: 600 } as MediaItem
    const result = await createPrintPdf(item, 1, 8, 'landscape', 8, 3)
    const pdf = await PDFDocument.load(result.bytes)
    expect(pdf.getPageCount()).toBe(1)
    expect(result.layout.artWidth / result.layout.artHeight).toBeCloseTo(1.5)
  })

  it('incorpora sem rasterização uma página de PDF real do acervo', async () => {
    const item = items.filter((entry) => entry.mime === 'application/pdf').sort((a, b) => a.bytes - b.bytes)[0]
    const original = readFileSync(join('public', decodeURIComponent(item.path).slice(1)))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(original), { status: 200 })))
    const result = await createPrintPdf(item, 0, 4, 'portrait', 8, 3)
    const pdf = await PDFDocument.load(result.bytes)
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(210 * 72 / 25.4)
  })
})
