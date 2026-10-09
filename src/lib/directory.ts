import type { DirectoryData, Filters, Initiative } from '../types'

export const normalizeText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

export function filterInitiatives(data: DirectoryData, filters: Filters): Initiative[] {
  const categoryOrder = new Map(data.categorias.map((category) => [category.id, category.ordem]))
  const query = normalizeText(filters.query.trim())

  return data.iniciativas
    .filter((initiative) => initiative.ativo)
    .filter((initiative) => !filters.category || initiative.categoriaPrincipal === filters.category)
    .filter((initiative) => !filters.activity || initiative.atividades.includes(filters.activity))
    .filter((initiative) => {
      if (!query) return true
      const category = data.categorias.find((item) => item.id === initiative.categoriaPrincipal)
      const haystack = [
        initiative.nome,
        initiative.descricao,
        ...initiative.tags,
        category?.nome ?? '',
        ...initiative.links.map((link) => link.rotulo),
      ].join(' ')
      return normalizeText(haystack).includes(query)
    })
    .sort((a, b) => {
      const byCategory = (categoryOrder.get(a.categoriaPrincipal) ?? 999) - (categoryOrder.get(b.categoriaPrincipal) ?? 999)
      return byCategory || a.nome.localeCompare(b.nome, 'pt-BR')
    })
}

export function validateDirectory(data: DirectoryData): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const categoryIds = new Set(data.categorias.map((item) => item.id))
  const activityIds = new Set(data.atividades.map((item) => item.id))

  if (data.iniciativas.length !== 11) errors.push(`Esperadas 11 iniciativas; encontradas ${data.iniciativas.length}.`)
  for (const initiative of data.iniciativas) {
    if (ids.has(initiative.id)) errors.push(`ID duplicado: ${initiative.id}`)
    ids.add(initiative.id)
    if (!categoryIds.has(initiative.categoriaPrincipal)) errors.push(`Categoria inválida em ${initiative.id}.`)
    for (const activity of initiative.atividades) {
      if (!activityIds.has(activity)) errors.push(`Atividade inválida em ${initiative.id}: ${activity}`)
    }
    for (const link of initiative.links) {
      try {
        if (new URL(link.url).protocol !== 'https:') errors.push(`URL sem HTTPS em ${initiative.id}.`)
      } catch {
        errors.push(`URL inválida em ${initiative.id}.`)
      }
    }
  }
  return errors
}
