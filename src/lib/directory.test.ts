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
