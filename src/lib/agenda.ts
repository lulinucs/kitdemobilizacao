import type { AgendaData, AgendaEvent, AgendaFilters, AgendaStatus } from '../agendaTypes'
import { normalizeText } from './directory'

const VALID_STATUSES = new Set<AgendaStatus>(['divulgado', 'confirmado', 'cancelado', 'alterado', 'data_pendente', 'encerrado'])
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

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

export function eventDateTime(event: Pick<AgendaEvent, 'data' | 'inicio' | 'timezone'>, timezone: string): Date | null {
  if (!event.data || !event.inicio || !TIME_PATTERN.test(event.inicio)) return null
  const eventTimezone = event.timezone ?? timezone
  const [year, month, day] = event.data.split('-').map(Number)
  const [hour, minute] = event.inicio.split(':').map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute))
  const first = new Date(guess.getTime() - timezoneOffsetMs(guess, eventTimezone))
  return new Date(guess.getTime() - timezoneOffsetMs(first, eventTimezone))
}

export function eventEndDateTime(event: AgendaEvent, timezone: string): Date | null {
  if (!event.data || !event.fim) return null
  const start = eventDateTime(event, timezone)
  let end = eventDateTime({ data: event.data, inicio: event.fim, timezone: event.timezone }, timezone)
  if (!start || !end) return null

  // Um fim anterior ao início representa uma atividade que termina no dia
  // seguinte (por exemplo, 23:00–01:00).
  if (end.getTime() < start.getTime()) {
    const [year, month, day] = event.data.split('-').map(Number)
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
    const date = [nextDay.getUTCFullYear(), String(nextDay.getUTCMonth() + 1).padStart(2, '0'), String(nextDay.getUTCDate()).padStart(2, '0')].join('-')
    end = eventDateTime({ data: date, inicio: event.fim, timezone: event.timezone }, timezone)
  }
  return end
}

export function isPastForWidget(event: AgendaEvent, now: Date, timezone: string): boolean {
  const end = effectiveEventEndDateTime(event, timezone)
  return Boolean(end && end.getTime() <= now.getTime())
}

function effectiveEventEndDateTime(event: AgendaEvent, timezone: string): Date | null {
  const start = eventDateTime(event, timezone)
  if (!start) return null
  const declaredEnd = eventEndDateTime(event, timezone)
  return new Date(Math.max(declaredEnd?.getTime() ?? 0, start.getTime() + 60 * 60_000))
}

export function isEventOngoing(event: AgendaEvent, now: Date, timezone: string): boolean {
  const start = eventDateTime(event, timezone)
  if (!start) return false
  const effectiveEnd = effectiveEventEndDateTime(event, timezone)
  return Boolean(effectiveEnd && start.getTime() <= now.getTime() && now.getTime() < effectiveEnd.getTime())
}

export function isPastForList(event: AgendaEvent, now: Date, timezone: string): boolean {
  if (event.status === 'encerrado') return true
  const end = effectiveEventEndDateTime(event, timezone)
  if (end) return end.getTime() <= now.getTime()
  return Boolean(event.data && event.data < getZonedDate(now, event.timezone ?? timezone))
}

export function getDisplayStatus(event: AgendaEvent, now: Date, timezone: string): AgendaStatus {
  if (event.status === 'cancelado' || event.status === 'alterado' || event.status === 'data_pendente') return event.status
  return isPastForList(event, now, timezone) ? 'encerrado' : event.status
}

export function sortEvents(events: AgendaEvent[], _timezone: string): AgendaEvent[] {
  return [...events].sort((a, b) => {
    if (!a.data && !b.data) return (a.inicio ?? '99:99').localeCompare(b.inicio ?? '99:99') || a.titulo.localeCompare(b.titulo, 'pt-BR')
    if (!a.data) return 1
    if (!b.data) return -1
    return a.data.localeCompare(b.data)
      || (a.inicio ?? '99:99').localeCompare(b.inicio ?? '99:99')
      || a.titulo.localeCompare(b.titulo, 'pt-BR')
  })
}

export type AgendaDisplayItem =
  | { kind: 'event'; event: AgendaEvent }
  | { kind: 'mobilization'; id: string; events: AgendaEvent[] }

export function createAgendaParams(options: { eventId?: string; mobilizationId?: string } = {}): URLSearchParams {
  const params = new URLSearchParams({ view: 'agenda' })
  if (options.eventId) params.set('evento', options.eventId)
  if (options.mobilizationId) params.set('mobilizacao', options.mobilizationId)
  return params
}

export function groupAgendaEvents(events: AgendaEvent[], enabled = true): AgendaDisplayItem[] {
  if (!enabled) return events.map((event) => ({ kind: 'event', event }))

  const grouped = new Map<string, AgendaEvent[]>()
  events.forEach((event) => {
    if (!event.mobilizacaoId) return
    grouped.set(event.mobilizacaoId, [...(grouped.get(event.mobilizacaoId) ?? []), event])
  })

  const rendered = new Set<string>()
  return events.flatMap<AgendaDisplayItem>((event) => {
    if (!event.mobilizacaoId) return [{ kind: 'event' as const, event }]
    if (rendered.has(event.mobilizacaoId)) return []
    rendered.add(event.mobilizacaoId)
    return [{ kind: 'mobilization' as const, id: event.mobilizacaoId, events: grouped.get(event.mobilizacaoId) ?? [event] }]
  })
}

export function formatMobilizationTitle(events: AgendaEvent[], timezone: string): string {
  const first = events[0]
  if (!first) return 'Mobilização nacional'
  const label = first.titulo.split('—').at(-1)?.trim() || first.titulo
  if (!first.data) return label
  const [year, month, day] = first.data.split('-').map(Number)
  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
  return `${label} — ${date}`
}

export function getNextEvent(events: AgendaEvent[], now: Date, timezone: string): AgendaEvent | undefined {
  return sortEvents(events, timezone).find((event) =>
    Boolean(event.data)
    && ['divulgado', 'confirmado', 'alterado'].includes(event.status)
    && (eventDateTime(event, timezone)?.getTime() ?? 0) > now.getTime(),
  )
}

export type WidgetEventSelection =
  | { kind: 'ongoing'; events: AgendaEvent[] }
  | { kind: 'upcoming'; events: [AgendaEvent] }
  | { kind: 'empty'; events: [] }

export interface WidgetLocationEvent {
  key: string
  label: string
  event: AgendaEvent
}

export function getWidgetEventSelection(events: AgendaEvent[], now: Date, timezone: string): WidgetEventSelection {
  const eligible = events.filter((event) =>
    Boolean(event.data) && ['divulgado', 'confirmado', 'alterado'].includes(event.status),
  )
  const ongoing = sortEvents(eligible.filter((event) => isEventOngoing(event, now, timezone)), timezone)
  if (ongoing.length) return { kind: 'ongoing', events: ongoing }

  const next = getNextEvent(eligible, now, timezone)
  return next ? { kind: 'upcoming', events: [next] } : { kind: 'empty', events: [] }
}

function isWidgetEligible(event: AgendaEvent): boolean {
  return Boolean(event.data) && ['divulgado', 'confirmado', 'alterado'].includes(event.status)
}

export function getUpcomingWidgetEvents(events: AgendaEvent[], now: Date, timezone: string): AgendaEvent[] {
  return sortEvents(events.filter((event) => {
    if (!isWidgetEligible(event) || !event.data || isEventOngoing(event, now, timezone)) return false
    if (event.inicio) {
      const start = eventDateTime(event, timezone)
      return Boolean(start && start.getTime() > now.getTime())
    }
    return event.data >= getZonedDate(now, event.timezone ?? timezone)
  }), timezone)
}

function widgetLocation(event: AgendaEvent): { key: string; label: string } {
  if (event.cidade) return { key: `city:${event.cidade}|${event.uf ?? ''}`, label: `${event.cidade}${event.uf ? `/${event.uf}` : ''}` }
  if (event.modalidade === 'virtual') return { key: 'virtual', label: 'Atividade virtual' }
  if (event.uf) return { key: `state:${event.uf}`, label: `Município a confirmar · ${event.uf}` }
  return { key: 'location-pending', label: 'Localidade a confirmar' }
}

export function getUpcomingWidgetEventsByLocation(events: AgendaEvent[], now: Date, timezone: string): WidgetLocationEvent[] {
  const locations = new Set<string>()
  return getUpcomingWidgetEvents(events, now, timezone).flatMap((event) => {
    const location = widgetLocation(event)
    if (locations.has(location.key)) return []
    locations.add(location.key)
    return [{ ...location, event }]
  })
}

export function formatUpcomingEventTime(event: AgendaEvent): string {
  if (!event.inicio) return 'Horário a confirmar'
  if (event.inicioRotulo) return event.inicioRotulo
  if (!event.fim) return `Início previsto às ${formatClock(event.inicio)}`
  return formatEventTime(event)
}

export function filterAgendaEvents(events: AgendaEvent[], filters: AgendaFilters, now: Date, timezone: string): AgendaEvent[] {
  const query = normalizeText(filters.query.trim())
  return sortEvents(events, timezone).filter((event) => {
    if (!filters.includePast && isPastForList(event, now, timezone)) return false
    if (filters.day && event.data !== filters.day) return false
    if (filters.city && event.cidade !== filters.city) return false
    if (filters.state && event.uf !== filters.state) return false
    if (filters.category && event.categoria !== filters.category) return false
    if (filters.mobilization && event.mobilizacaoId !== filters.mobilization) return false
    if (!query) return true
    return normalizeText([event.titulo, event.cidade ?? '', event.uf ?? '', event.instituicao ?? '', event.campus ?? '', event.pontoEncontro ?? '', event.local ?? '', event.endereco ?? '', event.bairro ?? '', event.descricao, event.informacoesAdicionais ?? ''].join(' ')).includes(query)
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
  if (event.inicioRotulo) return event.inicioRotulo
  if (!event.inicio) return 'Horário a confirmar'
  if (!event.fim) return `a partir das ${event.inicio}`
  return `${event.inicio}–${event.fim}${event.fim < event.inicio ? ' (dia seguinte)' : ''}`
}

export function getBalancedUpcomingWidgetEvents(events: AgendaEvent[], now: Date, timezone: string, limit = 8): WidgetLocationEvent[] {
  const byLocation = new Map<string, AgendaEvent[]>()
  for (const event of getUpcomingWidgetEvents(events, now, timezone)) {
    const location = widgetLocation(event)
    const group = byLocation.get(location.key) ?? []
    group.push(event)
    byLocation.set(location.key, group)
  }

  const chosen: AgendaEvent[] = []
  while (chosen.length < limit) {
    let added = false
    for (const group of byLocation.values()) {
      const event = group.shift()
      if (!event) continue
      chosen.push(event)
      added = true
      if (chosen.length === limit) break
    }
    if (!added) break
  }
  return sortEvents(chosen, timezone).map((event) => ({ ...widgetLocation(event), key: event.id, event }))
}

function formatClock(time: string): string {
  const [hour, minute] = time.split(':')
  return minute === '00' ? `${Number(hour)}h` : `${Number(hour)}h${minute}`
}

export function formatEventPlace(event: AgendaEvent): string {
  if (event.modalidade === 'virtual') return 'Atividade virtual'
  const city = event.cidade ? `${event.cidade}${event.uf ? `/${event.uf}` : ''}` : event.uf ? `Local a confirmar · ${event.uf}` : 'Local a confirmar'
  const venue = event.pontoEncontro ?? event.local
  return venue ? `${venue} · ${city}` : city
}

export function formatEventInstitution(event: AgendaEvent): string | null {
  if (!event.instituicao && !event.campus) return null
  return [event.instituicao, event.campus].filter(Boolean).join(' · ')
}

export function buildEventUrl(eventId: string, locationLike: Pick<Location, 'origin' | 'pathname'>): string {
  const params = new URLSearchParams({ view: 'agenda', evento: eventId })
  return `${locationLike.origin}${locationLike.pathname}?${params}`
}

export function buildEventShare(event: AgendaEvent, locationLike: Pick<Location, 'origin' | 'pathname'>, timezone: string) {
  const when = event.data ? `${formatAgendaDate(event.data, timezone, true)}, ${formatEventTime(event)}` : `data a confirmar, ${formatEventTime(event)}`
  return {
    title: event.titulo,
    text: `${event.titulo} — ${when} — ${formatEventPlace(event)}`,
    url: buildEventUrl(event.id, locationLike),
  }
}

export function buildMapUrl(event: AgendaEvent): string | null {
  if (event.modalidade === 'virtual') return null
  const place = event.endereco ?? event.pontoEncontro ?? event.local
  if (!place || (!event.cidade && !event.uf)) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place, event.cidade, event.uf].filter(Boolean).join(', '))}`
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
    if (event.cidade !== undefined && !event.cidade.trim()) recordErrors.push(`Cidade inválida em ${event.id}`)
    if (event.uf !== undefined && !/^[A-Z]{2}$/.test(event.uf)) recordErrors.push(`UF inválida em ${event.id}`)
    if (event.modalidade && !['presencial', 'virtual', 'hibrida'].includes(event.modalidade)) recordErrors.push(`Modalidade inválida em ${event.id}`)
    if (!VALID_STATUSES.has(event.status)) recordErrors.push(`Status inválido em ${event.id}`)
    if (event.mobilizacaoId !== undefined && !event.mobilizacaoId.trim()) recordErrors.push(`Mobilização inválida em ${event.id}`)
    if ((event.inicio !== null && !TIME_PATTERN.test(event.inicio)) || (event.fim && !TIME_PATTERN.test(event.fim))) recordErrors.push(`Horário inválido em ${event.id}`)
    if (event.fim && !event.inicio) recordErrors.push(`Término sem horário inicial em ${event.id}`)
    if (event.verificadoEm && !DATE_PATTERN.test(event.verificadoEm)) recordErrors.push(`Data de verificação inválida em ${event.id}`)
    if (event.data) {
      if (!isValidDate(event.data)) recordErrors.push(`Data inválida em ${event.id}`)
    } else if (event.status !== 'data_pendente') {
      recordErrors.push(`Evento sem data deve usar data_pendente: ${event.id}`)
    }
    errors.push(...recordErrors)
    return recordErrors.length === 0
  })
  return { events, errors }
}
