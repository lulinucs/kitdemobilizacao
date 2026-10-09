import { describe, expect, it } from 'vitest'
import rawProfiles from '../data/perfis.json'
import type { ProfilesData } from '../types'
import { filterProfiles, getPopulatedGroups, groupProfiles, validateProfiles } from './profiles'

const data = rawProfiles as ProfilesData

describe('perfis para acompanhar', () => {
  it('valida os perfis sem IDs, usuários ou URLs duplicados', () => {
    expect(validateProfiles(data)).toEqual([])
    expect(new Set(data.perfis.map((profile) => profile.id)).size).toBe(data.perfis.length)
    expect(new Set(data.perfis.map((profile) => profile.usuario)).size).toBe(data.perfis.length)
    expect(new Set(data.perfis.map((profile) => profile.url)).size).toBe(data.perfis.length)
  })

  it('busca por nome, usuário e assunto sem diferenciar acentos', () => {
    expect(filterProfiles(data.perfis, 'trabalhadores').map((item) => item.id)).toEqual(['pt-brasil', 'cut'])
    expect(filterProfiles(data.perfis, '@uee.rs').map((item) => item.id)).toEqual(['uee-rs'])
    expect(filterProfiles(data.perfis, 'entidade estudantil').map((item) => item.id)).toEqual(['une', 'uee-rs', 'uep-na-rede'])
    expect(filterProfiles(data.perfis, 'MIDIANINJA').map((item) => item.id)).toEqual(['midia-ninja'])
  })

  it('filtra movimento estudantil e mantém a busca dentro do grupo', () => {
    expect(filterProfiles(data.perfis, '', 'movimento-estudantil').map((item) => item.id)).toEqual([
      'une',
      'uee-rs',
      'ueb',
      'estudantes-com-lula-pb',
      'uce-nas-ruas',
      'apg-ufsc',
      'ufsc-com-lula',
      'uep-na-rede',
      'dce-odijas-ufrpe',
      'estudantes-com-lula-pe',
      'upe-com-lula',
      'dce-ufpe',
    ])
    expect(filterProfiles(data.perfis, '@uee.rs', 'movimento-estudantil').map((item) => item.id)).toEqual(['uee-rs'])
    expect(filterProfiles(data.perfis, 'midianinja', 'movimento-estudantil')).toEqual([])
  })

  it('oferece todos os grupos que agora possuem perfis ativos', () => {
    const groups = getPopulatedGroups(data)
    expect(groups.map((group) => group.id)).toEqual([
      'partidos-liderancas',
      'movimento-estudantil',
      'comunicacao-midia',
      'mobilizacao-digital',
      'coletivos-movimentos',
      'movimentos-juventude',
      'outros',
    ])
  })

  it('agrupa a visualização Todos pela ordem centralizada', () => {
    const sections = groupProfiles(data, filterProfiles(data.perfis, ''))
    expect(sections.map((section) => section.group.id)).toEqual([
      'partidos-liderancas',
      'movimento-estudantil',
      'comunicacao-midia',
      'mobilizacao-digital',
      'coletivos-movimentos',
      'movimentos-juventude',
      'outros',
    ])
    expect(sections[0].profiles.map((profile) => profile.id)).toEqual([
      'lula',
      'pt-brasil',
      'pcdob',
      'andre-janones',
      'psol',
      'erika-hilton',
      'guilherme-boulos',
      'taliria-petrone',
      'samia-bomfim',
      'bernardo-moreira',
      'dani-portela',
    ])
    expect(sections.find((section) => section.group.id === 'coletivos-movimentos')?.profiles.map((profile) => profile.id)).toEqual(['mst', 'mtst', 'cut', 'coletivo-cria-rj'])
    expect(sections.find((section) => section.group.id === 'movimentos-juventude')?.profiles.map((profile) => profile.id)).toEqual([
      'levante-popular-juventude',
      'juventude-do-lula',
      'ujs-sc',
      'a-coluna-35',
    ])
  })

  it('oculta registros inativos e respeita a ordem configurada', () => {
    const profiles = [
      { ...data.perfis[0], id: 'ultimo', usuario: 'ultimo', ordem: 20 },
      { ...data.perfis[1], id: 'oculto', usuario: 'oculto', ativo: false, ordem: 1 },
      { ...data.perfis[2], id: 'primeiro', usuario: 'primeiro', ordem: 2 },
    ]

    expect(filterProfiles(profiles, '').map((item) => item.id)).toEqual(['primeiro', 'ultimo'])
  })
})
