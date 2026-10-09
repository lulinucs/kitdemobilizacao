import type { FollowProfile, ProfileGroup, ProfilesData } from '../types'
import { normalizeText } from './directory'

const byConfiguredOrder = <T extends { ordem?: number; nome: string }>(a: T, b: T) =>
  (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER)
  || a.nome.localeCompare(b.nome, 'pt-BR')

export function filterProfiles(profiles: FollowProfile[], query: string, group = ''): FollowProfile[] {
  const normalizedQuery = normalizeText(query.trim())
  return profiles
    .filter((profile) => profile.ativo)
    .filter((profile) => !group || profile.grupo === group)
    .filter((profile) => {
      if (!normalizedQuery) return true
      return normalizeText([
        profile.nome,
        profile.usuario,
        `@${profile.usuario}`,
        profile.descricao ?? '',
        ...(profile.assuntos ?? []),
      ].join(' ')).includes(normalizedQuery)
    })
    .sort(byConfiguredOrder)
}

export function getPopulatedGroups(data: ProfilesData): ProfileGroup[] {
  const activeGroups = new Set(data.perfis.filter((profile) => profile.ativo).map((profile) => profile.grupo))
  return data.grupos.filter((group) => activeGroups.has(group.id)).sort(byConfiguredOrder)
}

export function groupProfiles(data: ProfilesData, profiles: FollowProfile[]): Array<{ group: ProfileGroup; profiles: FollowProfile[] }> {
  return data.grupos
    .map((group) => ({ group, profiles: profiles.filter((profile) => profile.grupo === group.id).sort(byConfiguredOrder) }))
    .filter((section) => section.profiles.length > 0)
    .sort((a, b) => byConfiguredOrder(a.group, b.group))
}

export function validateProfiles(data: ProfilesData): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const users = new Set<string>()
  const groupIds = new Set<string>()

  for (const group of data.grupos) {
    if (!group.id || groupIds.has(group.id)) errors.push(`Grupo ausente ou duplicado: ${group.id || '(vazio)'}.`)
    if (!group.nome.trim()) errors.push(`Nome ausente no grupo ${group.id}.`)
    groupIds.add(group.id)
  }

  for (const profile of data.perfis) {
    const user = profile.usuario.toLocaleLowerCase('pt-BR')
    if (!profile.id || ids.has(profile.id)) errors.push(`ID ausente ou duplicado: ${profile.id || '(vazio)'}.`)
    if (!profile.nome.trim()) errors.push(`Nome ausente em ${profile.id}.`)
    if (!profile.usuario.trim() || users.has(user)) errors.push(`Usuário ausente ou duplicado em ${profile.id}.`)
    if (!groupIds.has(profile.grupo)) errors.push(`Grupo inválido em ${profile.id}: ${profile.grupo}.`)
    ids.add(profile.id)
    users.add(user)

    try {
      const url = new URL(profile.url)
      if (url.protocol !== 'https:' || url.hostname !== 'www.instagram.com') errors.push(`URL do Instagram inválida em ${profile.id}.`)
    } catch {
      errors.push(`URL inválida em ${profile.id}.`)
    }
  }
  return errors
}
