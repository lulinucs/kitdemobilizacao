import type { AgendaEvent } from '../agendaTypes'
import { eventDateTime, getEventTemporalState } from './agenda'

export interface GeoPoint {
  latitude: number
  longitude: number
}

export type GeolocationFailure = 'denied' | 'unavailable'
export type MapMarkerState = 'now' | 'possibly' | 'soon' | 'future' | 'inactive' | 'cancelled'
export type ClusterStatus = 'now' | 'possibly' | 'future' | 'other'

export interface ClusterComposition {
  now: number
  possibly: number
  future: number
  other: number
  total: number
}

const CLUSTER_COLORS: Record<ClusterStatus, string> = {
  now: '#d73a31',
  possibly: '#ef765f',
  future: '#f4c542',
  other: '#7b8580',
}

export function geolocationFailure(code: number): GeolocationFailure {
  return code === 1 ? 'denied' : 'unavailable'
}

export function getMapMarkerState(event: AgendaEvent, now: Date, timezone: string): MapMarkerState {
  if (event.status === 'cancelado') return 'cancelled'
  const temporal = getEventTemporalState(event, now, timezone)
  if (temporal === 'happening-now') return 'now'
  if (temporal === 'possibly-happening') return 'possibly'
  if (temporal === 'upcoming') {
    const start = eventDateTime(event, timezone)
    if (start && start.getTime() <= now.getTime() + 2 * 60 * 60_000) return 'soon'
    return 'future'
  }
  return 'inactive'
}

export function summarizeMarkerStates(states: MapMarkerState[]): ClusterComposition {
  return states.reduce<ClusterComposition>((summary, state) => {
    const clusterState: ClusterStatus = state === 'soon' ? 'future' : state === 'inactive' || state === 'cancelled' ? 'other' : state
    summary[clusterState] += 1
    summary.total += 1
    return summary
  }, { now: 0, possibly: 0, future: 0, other: 0, total: 0 })
}

export function clusterRingGradient(composition: ClusterComposition): string {
  if (!composition.total) return CLUSTER_COLORS.other
  let start = 0
  const segments = (Object.keys(CLUSTER_COLORS) as ClusterStatus[]).flatMap((status) => {
    const count = composition[status]
    if (!count) return []
    const end = start + count / composition.total * 100
    const segment = `${CLUSTER_COLORS[status]} ${start.toFixed(2)}% ${end.toFixed(2)}%`
    start = end
    return [segment]
  })
  return `conic-gradient(${segments.join(', ')})`
}

const EARTH_RADIUS_KM = 6371

export function hasEventCoordinates(event: AgendaEvent): boolean {
  const point = event.coordenadas
  return Boolean(point
    && Number.isFinite(point.latitude)
    && Number.isFinite(point.longitude)
    && point.latitude >= -90 && point.latitude <= 90
    && point.longitude >= -180 && point.longitude <= 180)
}

export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const latitude1 = radians(from.latitude)
  const latitude2 = radians(to.latitude)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function sortEventsByDistance(events: AgendaEvent[], origin: GeoPoint): Array<{ event: AgendaEvent; distance: number }> {
  return events
    .filter(hasEventCoordinates)
    .map((event) => ({
      event,
      distance: distanceKm(origin, {
        latitude: event.coordenadas!.latitude,
        longitude: event.coordenadas!.longitude,
      }),
    }))
    .sort((a, b) => a.distance - b.distance || a.event.titulo.localeCompare(b.event.titulo, 'pt-BR'))
}

export function formatDistance(distance: number): string {
  if (distance < 1) return `aprox. ${Math.max(50, Math.round(distance * 20) * 50)} m`
  if (distance < 10) return `aprox. ${distance.toFixed(1).replace('.', ',')} km`
  return `aprox. ${Math.round(distance)} km`
}

export function buildExternalRouteUrl(event: AgendaEvent, origin?: GeoPoint): string | null {
  if (!hasEventCoordinates(event)) return null
  const destination = `${event.coordenadas!.latitude},${event.coordenadas!.longitude}`
  const params = new URLSearchParams({ api: '1', destination })
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`)
  return `https://www.google.com/maps/dir/?${params}`
}
