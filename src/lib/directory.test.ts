import { describe, expect, it } from 'vitest'
import rawData from '../data/iniciativas.json'
import type { DirectoryData } from '../types'
import { filterInitiatives, normalizeText, validateDirectory } from './directory'

const data = rawData as DirectoryData

describe('busca e filtros', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(normalizeText('MOBILIZAÇÃO')).toBe('mobilizacao')
    expect(filterInitiatives(data, { query: 'geracao', category: '', activity: '' }).map((item) => item.id)).toContain('geracao-lula')
  })

  it('combina categoria, atividade e texto', () => {
    const result = filterInitiatives(data, { query: 'cartazes', category: 'materiais', activity: 'imprimir' })
    expect(result.map((item) => item.id)).toEqual(['lambe-brasil'])
  })

  it('não duplica iniciativas com várias atividades', () => {
    const result = filterInitiatives(data, { query: '', category: '', activity: 'organizar' })
    expect(new Set(result.map((item) => item.id)).size).toBe(result.length)
  })
})

describe('integridade dos dados', () => {
  it('mantém 11 IDs únicos e URLs HTTPS', () => {
    expect(validateDirectory(data)).toEqual([])
  })
})
