import { describe, expect, it } from 'vitest'
import rawData from '../data/iniciativas.json'
import type { DirectoryData } from '../types'
import { createCatalogSearch, filterInitiatives, normalizeText, readCatalogFilters, validateDirectory } from './directory'

const data = rawData as DirectoryData

describe('busca e filtros', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(normalizeText('MOBILIZAÇÃO')).toBe('mobilizacao')
    expect(filterInitiatives(data, { query: 'geracao', category: '', activity: '' }).map((item) => item.id)).toContain('geracao-lula')
  })

  it('trata categoria e atividade como índices alternativos', () => {
    const categoryResult = filterInitiatives(data, { query: '', category: 'materiais', activity: 'acompanhar' })
    const activityResult = filterInitiatives(data, { query: '', category: '', activity: 'acompanhar' })

    expect(categoryResult.every((item) => item.categoriaPrincipal === 'materiais')).toBe(true)
    expect(activityResult.every((item) => item.atividades.includes('acompanhar'))).toBe(true)
    expect(categoryResult.length).toBeGreaterThan(1)
    expect(activityResult.length).toBeGreaterThan(1)
  })

  it('mantém a busca textual sobre a seleção ativa', () => {
    const result = filterInitiatives(data, { query: 'cartazes', category: 'materiais', activity: '' })
    expect(result.map((item) => item.id)).toEqual(['lambe-brasil'])
  })

  it('encontra os dois acervos nas buscas e nos filtros correspondentes', () => {
    const din = 'drivezao-eleitoral-dinamichi'
    const gab = 'drive-materiais-gabefelds'
    const ids = [din, gab]
    const filterIds = (query: string, category: string, activity: string) =>
      filterInitiatives(data, { query, category, activity }).map((item) => item.id)

    expect(filterIds('', '', '')).toEqual(expect.arrayContaining(ids))
    expect(filterIds('', 'materiais', '')).toEqual(expect.arrayContaining(ids))
    expect(filterIds('', '', 'imprimir')).toEqual(expect.arrayContaining(ids))
    expect(filterIds('', '', 'compartilhar')).toEqual(expect.arrayContaining(ids))
    expect(filterIds('', '', 'aprender')).toContain(din)
    expect(filterIds('', '', 'aprender')).not.toContain(gab)
    expect(filterIds('dinamichi', '', '')).toContain(din)
    expect(filterIds('gabefelds', '', '')).toContain(gab)

    expect(data.iniciativas.filter((item) => ids.includes(item.id))).toHaveLength(2)
    expect(data.iniciativas.find((item) => item.id === din)?.links).toEqual([{
      rotulo: 'Acessar materiais', url: 'https://drive.google.com/drive/folders/1LbYfXCnnI7-APqRltwTfp7GbAxsdbCnz', principal: true,
    }])
    expect(data.iniciativas.find((item) => item.id === gab)?.links).toEqual([{
      rotulo: 'Acessar materiais', url: 'https://drive.google.com/drive/folders/1x5SOQOa8Ey47W3WRGj5PbAEWaMSKJcu0', principal: true,
    }])
  })

  it('normaliza URLs antigas com precedência para categoria', () => {
    const filters = readCatalogFilters('?categoria=materiais&atividade=acompanhar&q=cartazes')

    expect(filters).toEqual({ query: 'cartazes', category: 'materiais', activity: '' })
    expect(createCatalogSearch(filters)).toBe('categoria=materiais&q=cartazes')
  })

  it('não duplica iniciativas com várias atividades', () => {
    const result = filterInitiatives(data, { query: '', category: '', activity: 'organizar' })
    expect(new Set(result.map((item) => item.id)).size).toBe(result.length)
  })
})

describe('integridade dos dados', () => {
  it('mantém IDs únicos e URLs externas HTTPS', () => {
    expect(validateDirectory(data)).toEqual([])
    expect(new Set(data.iniciativas.map((item) => item.id)).size).toBe(data.iniciativas.length)
  })

  it('inclui Perfis para acompanhar nos dois índices independentes', () => {
    const all = filterInitiatives(data, { query: '', category: '', activity: '' })
    const byCategory = filterInitiatives(data, { query: '', category: 'nas-redes', activity: '' })
    const byActivity = filterInitiatives(data, { query: '', category: '', activity: 'compartilhar' })
    const initiative = data.iniciativas.find((item) => item.id === 'perfis-para-acompanhar')

    expect(all.map((item) => item.id)).toContain('perfis-para-acompanhar')
    expect(byCategory.map((item) => item.id)).toContain('perfis-para-acompanhar')
    expect(byActivity.map((item) => item.id)).toContain('perfis-para-acompanhar')
    expect(initiative?.ativo).toBe(true)
    expect(initiative?.links).toContainEqual({ rotulo: 'Conhecer perfis', url: '/perfis', principal: true })
  })
})
