import type { InitiativeLink } from '../types'

export type LinkPlatform = 'whatsapp' | 'telegram' | 'google-drive' | 'instagram' | 'youtube' | 'github' | 'internal' | 'website'
export type LinkKind = 'group' | 'channel' | 'folder' | 'profile' | 'video' | 'site'

export interface InitiativeLinkPresentation {
  platform: LinkPlatform
  kind: LinkKind
  descriptor: string
}

const platformLabels: Record<LinkPlatform, string> = {
  whatsapp: 'WhatsApp', telegram: 'Telegram', 'google-drive': 'Google Drive', instagram: 'Instagram',
  youtube: 'YouTube', github: 'GitHub', internal: 'Kit de Mobilização', website: 'Site',
}
const kindLabels: Record<LinkKind, string> = { group: 'Grupo', channel: 'Canal', folder: 'Pasta', profile: 'Perfil', video: 'Vídeo', site: 'Site' }

function hostname(url: string): string {
  if (url.startsWith('/')) return ''
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

export function identifyLinkPlatform(url: string): LinkPlatform {
  if (url.startsWith('/')) return 'internal'
  const host = hostname(url)
  if (host === 'wa.me' || host.endsWith('whatsapp.com')) return 'whatsapp'
  if (host === 't.me' || host.endsWith('telegram.me') || host.endsWith('telegram.org')) return 'telegram'
  if (host === 'drive.google.com') return 'google-drive'
  if (host.endsWith('instagram.com')) return 'instagram'
  if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'youtube'
  if (host.endsWith('github.com')) return 'github'
  return 'website'
}

export function identifyLinkKind(link: InitiativeLink, platform = identifyLinkPlatform(link.url)): LinkKind {
  const text = link.rotulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const host = hostname(link.url)
  let path = ''
  try { path = link.url.startsWith('/') ? link.url.toLowerCase() : new URL(link.url).pathname.toLowerCase() } catch { /* Malformed links are reported by directory validation. */ }
  if (/\bgrupo\b/.test(text) || host === 'chat.whatsapp.com' || (platform === 'telegram' && path.includes('/joinchat/'))) return 'group'
  if (/\bcanal\b/.test(text) || (platform === 'whatsapp' && path.includes('/channel/'))) return 'channel'
  if (platform === 'google-drive') return 'folder'
  if (/\bperfil|perfis\b/.test(text) || platform === 'instagram') return 'profile'
  if (/\bvideo|videos\b/.test(text) || platform === 'youtube') return 'video'
  return 'site'
}

export function getInitiativeLinkPresentation(link: InitiativeLink): InitiativeLinkPresentation {
  const platform = identifyLinkPlatform(link.url)
  const kind = identifyLinkKind(link, platform)
  return { platform, kind, descriptor: kind === 'site' && platform === 'website' ? 'Site externo' : `${kindLabels[kind]} · ${platformLabels[platform]}` }
}
