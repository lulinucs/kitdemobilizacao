import { describe, expect, it } from 'vitest'
import rawAgenda from '../data/agenda-floripa.json'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { buildEventShare, filterAgendaEvents, getNextEvent, getZonedDate, isPastForList, isPastForWidget, sortEvents, validateAgenda } from './agenda'

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

  it('evento sem hora final passa no widget após o início, mas fica no dia', () => {
    const event = data.eventos.find((item) => item.id === 'assembleia-ufsc-0910')!
    const afterStart = new Date('2026-10-09T15:30:00.000Z')
    expect(isPastForWidget(event, afterStart, data.timezone)).toBe(true)
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
