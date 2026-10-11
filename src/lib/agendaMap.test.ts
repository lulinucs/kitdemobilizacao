import { describe, expect, it } from 'vitest'
import type { AgendaEvent } from '../agendaTypes'
import { clusterRingGradient, distanceKm, formatDistance, geolocationFailure, getMapMarkerState, hasEventCoordinates, sortEventsByDistance, summarizeMarkerStates } from './agendaMap'

const event = (id: string, latitude?: number, longitude?: number) => ({
  id, titulo: id, categoria: 'ato', data: '2026-10-13', inicio: '12:00', fim: null,
  descricao: id, status: 'confirmado',
  ...(latitude === undefined ? {} : { coordenadas: { latitude, longitude: longitude!, precisao: 'cidade', rotulo: id, provedor: 'nominatim', consulta: id, geocodificadoEm: '2026-10-11' } }),
}) as AgendaEvent

describe('agenda map', () => {
  it('valida coordenadas sem aceitar limites impossíveis', () => {
    expect(hasEventCoordinates(event('ok', -27.59, -48.55))).toBe(true)
    expect(hasEventCoordinates(event('missing'))).toBe(false)
    expect(hasEventCoordinates(event('invalid', 91, -48))).toBe(false)
  })

  it('calcula e ordena distâncias aproximadas', () => {
    const origin = { latitude: -27.59, longitude: -48.55 }
    const nearby = event('perto', -27.60, -48.55)
    const distant = event('longe', -23.55, -46.63)
    expect(distanceKm(origin, { latitude: -27.60, longitude: -48.55 })).toBeGreaterThan(1)
    expect(sortEventsByDistance([distant, nearby, event('sem')], origin).map(({ event: item }) => item.id)).toEqual(['perto', 'longe'])
    expect(formatDistance(2.34)).toBe('aprox. 2,3 km')
  })

  it('diferencia recusa de permissão de indisponibilidade', () => {
    expect(geolocationFailure(1)).toBe('denied')
    expect(geolocationFailure(2)).toBe('unavailable')
    expect(geolocationFailure(3)).toBe('unavailable')
  })

  it('destaca eventos futuros que começam nas próximas duas horas sem marcá-los como ativos', () => {
    const now = new Date('2026-10-13T17:00:00.000Z') // 14h em São Paulo
    const soon = { ...event('soon'), inicio: '15:30' }
    const later = { ...event('later'), inicio: '18:30' }
    expect(getMapMarkerState(soon, now, 'America/Sao_Paulo')).toBe('soon')
    expect(getMapMarkerState(later, now, 'America/Sao_Paulo')).toBe('future')
  })

  it('calcula a composição real do cluster e mantém eventos próximos na fatia futura', () => {
    const composition = summarizeMarkerStates(['now', 'now', 'possibly', 'soon', 'future'])
    expect(composition).toEqual({ now: 2, possibly: 1, future: 2, other: 0, total: 5 })
    expect(clusterRingGradient(composition)).toBe('conic-gradient(#d73a31 0.00% 40.00%, #ef765f 40.00% 60.00%, #f4c542 60.00% 100.00%)')
  })

  it('usa um único anel de cor quando todos os eventos têm o mesmo status', () => {
    expect(clusterRingGradient(summarizeMarkerStates(['future', 'soon']))).toBe('conic-gradient(#f4c542 0.00% 100.00%)')
  })

  it('não pinta evento cancelado como ativo mesmo durante seu horário', () => {
    const cancelled = { ...event('cancelled'), status: 'cancelado' } as AgendaEvent
    expect(getMapMarkerState(cancelled, new Date('2026-10-13T15:30:00.000Z'), 'America/Sao_Paulo')).toBe('cancelled')
  })
})
