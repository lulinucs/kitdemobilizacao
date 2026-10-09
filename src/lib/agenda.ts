import type { AgendaData, AgendaEvent, AgendaFilters, AgendaStatus } from '../agendaTypes'
import { normalizeText } from './directory'

const VALID_STATUSES = new Set<AgendaStatus>(['divulgado', 'confirmado', 'cancelado', 'alterado', 'data_pendente', 'encerrado'])
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function getZonedDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function timezoneOffsetMs(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(instant)
  const value = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00'
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(value)
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return (match[1] === '-' ? -minutes : minutes) * 60_000
}

export function eventDateTime(event: Pick<AgendaEvent, 'data' | 'inicio'>, timezone: string): Date | null {
  if (!event.data || !TIME_PATTERN.test(event.inicio)) return null
  const [year, month, day] = event.data.split('-').map(Number)
  const [hour, minute] = event.inicio.split(':').map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute))
  const first = new Date(guess.getTime() - timezoneOffsetMs(guess, timezone))
  return new Date(guess.getTime() - timezoneOffsetMs(first, timezone))
}

export function eventEndDateTime(event: AgendaEvent, timezone: string): Date | null {
  if (!event.data || !event.fim) return null
  return eventDateTime({ data: event.data, inicio: event.fim }, timezone)
}

export function isPastForWidget(event: AgendaEvent, now: Date, timezone: string): boolean {
  const start = eventDateTime(event, timezone)
  return !start || start.getTime() <= now.getTime()
}

export function isPastForList(event: AgendaEvent, now: Date, timezone: string): boolean {
  if (!event.data) return false
  const today = getZonedDate(now, timezone)
  if (event.data < today) return true
  if (event.data > today) return false
  const end = eventEndDateTime(event, timezone)
  return end ? end.getTime() <= now.getTime() : false
}

export function getDisplayStatus(event: AgendaEvent, now: Date, timezone: string): AgendaStatus {
  if (event.status === 'cancelado' || event.status === 'alterado' || event.status === 'data_pendente') return event.status
  return isPastForList(event, now, timezone) ? 'encerrado' : event.status
}

export function sortEvents(events: AgendaEvent[], timezone: string): AgendaEvent[] {
  return [...events].sort((a, b) => {
    if (!a.data && !b.data) return a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo, 'pt-BR')
    if (!a.data) return 1
    if (!b.data) return -1
    return (eventDateTime(a, timezone)?.getTime() ?? 0) - (eventDateTime(b, timezone)?.getTime() ?? 0)
      || a.titulo.localeCompare(b.titulo, 'pt-BR')
  })
}

export function getNextEvent(events: AgendaEvent[], now: Date, timezone: string): AgendaEvent | undefined {
  return sortEvents(events, timezone).find((event) =>
    Boolean(event.data)
    && ['divulgado', 'confirmado', 'alterado'].includes(event.status)
    && !isPastForWidget(event, now, timezone),
  )
}

export function filterAgendaEvents(events: AgendaEvent[], filters: AgendaFilters, now: Date, timezone: string): AgendaEvent[] {
  const query = normalizeText(filters.query.trim())
  return sortEvents(events, timezone).filter((event) => {
    if (!filters.includePast && isPastForList(event, now, timezone)) return false
    if (filters.day && event.data !== filters.day) return false
    if (filters.city && event.cidade !== filters.city) return false
    if (filters.state && event.uf !== filters.state) return false
    if (filters.category && event.categoria !== filters.category) return false
    if (!query) return true
    return normalizeText([event.titulo, event.cidade, event.uf, event.local ?? '', event.endereco ?? '', event.bairro ?? '', event.descricao, event.informacoesAdicionais ?? ''].join(' ')).includes(query)
  })
}

export function formatAgendaDate(date: string, timezone: string, long = false): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: long ? 'long' : 'short',
    day: '2-digit',
    month: long ? 'long' : '2-digit',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function formatEventTime(event: AgendaEvent): string {
  return event.fim ? `${event.inicio}–${event.fim}` : `a partir das ${event.inicio}`
}

export function buildEventUrl(eventId: string, locationLike: Pick<Location, 'origin' | 'pathname'>): string {
  const params = new URLSearchParams({ view: 'agenda', evento: eventId })
  return `${locationLike.origin}${locationLike.pathname}?${params}`
}

export function buildEventShare(event: AgendaEvent, locationLike: Pick<Location, 'origin' | 'pathname'>, timezone: string) {
  const when = event.data ? `${formatAgendaDate(event.data, timezone, true)}, ${formatEventTime(event)}` : `data a confirmar, ${formatEventTime(event)}`
  return {
    title: event.titulo,
    text: `${event.titulo} — ${when} — ${event.cidade}/${event.uf}${event.local ? ` — ${event.local}` : ''}`,
    url: buildEventUrl(event.id, locationLike),
  }
}

export function buildMapUrl(event: AgendaEvent): string | null {
  const place = event.endereco ?? event.local
  if (!place) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place}, ${event.cidade} - ${event.uf}`)}`
}

export function validateAgenda(data: AgendaData): { events: AgendaEvent[]; errors: string[] } {
  const errors: string[] = []
  const categoryIds = new Set(data.categorias.map((category) => category.id))
  const ids = new Set<string>()
  const events = data.eventos.filter((event) => {
    const recordErrors: string[] = []
    if (!event.id || ids.has(event.id)) recordErrors.push(`ID ausente ou duplicado: ${event.id || '(vazio)'}`)
    ids.add(event.id)
    if (!categoryIds.has(event.categoria)) recordErrors.push(`Categoria inválida em ${event.id}`)
    if (!event.cidade.trim() || !/^[A-Z]{2}$/.test(event.uf)) recordErrors.push(`Localização inválida em ${event.id}`)
    if (!VALID_STATUSES.has(event.status)) recordErrors.push(`Status inválido em ${event.id}`)
    if (!TIME_PATTERN.test(event.inicio) || (event.fim && !TIME_PATTERN.test(event.fim))) recordErrors.push(`Horário inválido em ${event.id}`)
    if (event.data) {
      const validShape = DATE_PATTERN.test(event.data)
      const parsed = validShape ? eventDateTime(event, data.timezone) : null
      if (!parsed || getZonedDate(parsed, data.timezone) !== event.data) recordErrors.push(`Data inválida em ${event.id}`)
    } else if (event.status !== 'data_pendente') {
      recordErrors.push(`Evento sem data deve usar data_pendente: ${event.id}`)
    }
    errors.push(...recordErrors)
    return recordErrors.length === 0
  })
  return { events, errors }
}
