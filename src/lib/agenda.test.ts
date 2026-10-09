import { describe, expect, it } from 'vitest'
import rawAgenda from '../data/agenda-floripa.json'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { buildEventShare, eventEndDateTime, filterAgendaEvents, getNextEvent, getWidgetEventSelection, getZonedDate, isEventOngoing, isPastForList, isPastForWidget, sortEvents, validateAgenda } from './agenda'

const data = rawAgenda as AgendaData
const now = new Date('2026-10-09T14:00:00.000Z') // 11h em Florianópolis

describe('agenda', () => {
  it('ordena por data e hora e deixa data pendente ao final', () => {
    const sorted = sortEvents(data.eventos, data.timezone)
    expect(sorted[0].id).toBe('banca-ticen-0910')
    expect(sorted.at(-1)?.id).toBe('serigrafia-centro')
  })

  it('usa o fuso de Florianópolis e trata a virada de dia', () => {
    expect(getZonedDate(new Date('2026-10-10T02:30:00.000Z'), data.timezone)).toBe('2026-10-09')
    expect(getZonedDate(new Date('2026-10-10T03:01:00.000Z'), data.timezone)).toBe('2026-10-10')
  })

  it('mantém data pendente fora do próximo evento', () => {
    expect(getNextEvent(data.eventos, now, data.timezone)?.id).toBe('assembleia-ufsc-0910')
    expect(getNextEvent([data.eventos[0]], now, data.timezone)).toBeUndefined()
  })

  it('combina dia, cidade, estado, categoria e busca', () => {
    const result = filterAgendaEvents(data.eventos, { query: 'bandeiraco', day: '2026-10-09', city: 'Florianópolis', state: 'SC', category: 'bandeiraco', includePast: true }, now, data.timezone)
    expect(result.map((event) => event.id)).toEqual(['bandeiraco-campeche-0910'])
  })

  it('aceita novas cidades sem depender de uma localização global', () => {
    const event = { ...data.eventos[14], id: 'evento-recife', cidade: 'Recife', uf: 'PE' }
    const events = [...data.eventos, event]

    expect(filterAgendaEvents(events, { query: '', day: '', city: 'Recife', state: '', category: '', includePast: true }, now, data.timezone).map((item) => item.id)).toEqual(['evento-recife'])
    expect(validateAgenda({ ...data, eventos: events }).errors).toEqual([])
  })

  it('valida IDs únicos', () => {
    const invalid = { ...data, eventos: [...data.eventos, { ...data.eventos[1] }] }
    const result = validateAgenda(invalid)
    expect(result.errors.some((error) => error.includes('duplicado'))).toBe(true)
    expect(result.events).toHaveLength(data.eventos.length)
  })

  it('separa eventos passados', () => {
    const event = data.eventos.find((item) => item.id === 'banca-ticen-0910')!
    expect(isPastForList(event, new Date('2026-10-09T21:00:00.000Z'), data.timezone)).toBe(true)
  })

  it('não presume que um evento sem hora final terminou após o início', () => {
    const event = data.eventos.find((item) => item.id === 'assembleia-ufsc-0910')!
    const afterStart = new Date('2026-10-09T15:30:00.000Z')
    expect(isPastForWidget(event, afterStart, data.timezone)).toBe(false)
    expect(isPastForList(event, afterStart, data.timezone)).toBe(false)
  })

  it('evento cancelado nunca aparece como próximo', () => {
    const event = { ...data.eventos[14], status: 'cancelado' } as AgendaEvent
    expect(getNextEvent([event], now, data.timezone)).toBeUndefined()
  })

  it('gera compartilhamento com link permanente', () => {
    const share = buildEventShare(data.eventos[14], { origin: 'https://exemplo.test', pathname: '/' }, data.timezone)
    expect(share.url).toBe('https://exemplo.test/?view=agenda&evento=pedalula-1110')
    expect(share.text).toContain('Pedalula')
    expect(share.text).toContain('Florianópolis/SC')
  })
})

describe('seleção do widget de próxima atividade', () => {
  const timezone = 'America/Sao_Paulo'
  const event = (overrides: Partial<AgendaEvent> = {}): AgendaEvent => ({
    id: 'evento-base',
    titulo: 'Evento base',
    categoria: 'ato',
    data: '2026-10-09',
    inicio: '14:00',
    fim: '18:00',
    cidade: 'Florianópolis',
    uf: 'SC',
    local: 'Praça',
    descricao: 'Descrição',
    status: 'divulgado',
    ...overrides,
  })

  it('prioriza um evento acontecendo agora entre 14h e 18h', () => {
    const ongoing = event()
    const future = event({ id: 'futuro', inicio: '17:00', fim: '19:00' })
    const selection = getWidgetEventSelection([future, ongoing], new Date('2026-10-09T19:00:00.000Z'), timezone) // 16h local

    expect(selection.kind).toBe('ongoing')
    expect(selection.events.map((item) => item.id)).toEqual(['evento-base'])
  })

  it('deixa de considerar o evento em andamento exatamente às 18h', () => {
    const atEnd = new Date('2026-10-09T21:00:00.000Z')
    const selection = getWidgetEventSelection([event()], atEnd, timezone)

    expect(selection.kind).toBe('empty')
    expect(isEventOngoing(event(), atEnd, timezone)).toBe(false)
  })

  it('retorna todos os eventos simultâneos', () => {
    const first = event({ id: 'primeiro', titulo: 'Primeiro' })
    const second = event({ id: 'segundo', titulo: 'Segundo', inicio: '15:00', fim: '17:00' })
    const selection = getWidgetEventSelection([second, first], new Date('2026-10-09T19:00:00.000Z'), timezone)

    expect(selection.kind).toBe('ongoing')
    expect(selection.events.map((item) => item.id)).toEqual(['primeiro', 'segundo'])
  })

  it('seleciona o futuro mais próximo quando nada está acontecendo', () => {
    const later = event({ id: 'mais-tarde', inicio: '20:00', fim: '21:00' })
    const next = event({ id: 'proximo', inicio: '19:00', fim: '20:00' })
    const selection = getWidgetEventSelection([later, next], new Date('2026-10-09T21:00:00.000Z'), timezone) // 18h local

    expect(selection.kind).toBe('upcoming')
    expect(selection.events[0]?.id).toBe('proximo')
  })

  it('retorna vazio quando não há evento futuro', () => {
    const selection = getWidgetEventSelection([event()], new Date('2026-10-09T22:00:00.000Z'), timezone)
    expect(selection).toEqual({ kind: 'empty', events: [] })
  })

  it('considera em andamento um evento que atravessa a meia-noite', () => {
    const overnight = event({ inicio: '23:00', fim: '01:00' })
    const atHalfPastMidnight = new Date('2026-10-10T03:30:00.000Z')

    expect(isEventOngoing(overnight, atHalfPastMidnight, timezone)).toBe(true)
    expect(eventEndDateTime(overnight, timezone)?.toISOString()).toBe('2026-10-10T04:00:00.000Z')
  })

  it('não mantém como acontecendo agora um evento sem término conhecido', () => {
    const withoutEnd = event({ fim: null })
    const afterStart = new Date('2026-10-09T19:00:00.000Z')
    const selection = getWidgetEventSelection([withoutEnd], afterStart, timezone)

    expect(selection.kind).toBe('empty')
    expect(isEventOngoing(withoutEnd, afterStart, timezone)).toBe(false)
    expect(isPastForWidget(withoutEnd, new Date('2026-10-10T19:00:00.000Z'), timezone)).toBe(false)
  })

  it('respeita o conjunto previamente filtrado pela cidade', () => {
    const floripa = event({ id: 'floripa' })
    const recife = event({ id: 'recife', cidade: 'Recife', uf: 'PE' })
    const cityEvents = [floripa, recife].filter((item) => item.cidade === 'Recife')
    const selection = getWidgetEventSelection(cityEvents, new Date('2026-10-09T19:00:00.000Z'), timezone)

    expect(selection.events.map((item) => item.id)).toEqual(['recife'])
  })
})
