import { describe, expect, it } from 'vitest'
import type { InitiativeLink } from '../types'
import { getInitiativeLinkPresentation, identifyLinkPlatform } from './initiativeLinks'

const link = (rotulo: string, url: string): InitiativeLink => ({ rotulo, url, principal: false })

describe('apresentação dos links de iniciativas', () => {
  it.each([
    ['https://www.whatsapp.com/channel/abc', 'whatsapp'],
    ['https://t.me/exemplo', 'telegram'],
    ['https://drive.google.com/drive/folders/abc', 'google-drive'],
    ['https://instagram.com/exemplo', 'instagram'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://github.com/exemplo/projeto', 'github'],
    ['https://exemplo.org', 'website'],
    ['/perfis', 'internal'],
  ])('identifica %s como %s', (url, platform) => {
    expect(identifyLinkPlatform(url)).toBe(platform)
  })

  it.each([
    [link('Entrar no grupo', 'https://t.me/joinchat/abc'), 'group', 'Grupo · Telegram'],
    [link('Canal no WhatsApp', 'https://whatsapp.com/channel/abc'), 'channel', 'Canal · WhatsApp'],
    [link('Acessar materiais', 'https://drive.google.com/drive/folders/abc'), 'folder', 'Pasta · Google Drive'],
    [link('Ver perfil', 'https://instagram.com/exemplo'), 'profile', 'Perfil · Instagram'],
    [link('Assistir vídeo', 'https://youtube.com/watch?v=abc'), 'video', 'Vídeo · YouTube'],
    [link('Acessar iniciativa', 'https://exemplo.org'), 'site', 'Site externo'],
  ])('classifica $0', (value, kind, descriptor) => {
    expect(getInitiativeLinkPresentation(value)).toMatchObject({ kind, descriptor })
  })
})
