import { AlertTriangle, Crosshair, ExternalLink, LocateFixed, MapPin } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { formatAgendaDate, formatEventPlace, formatEventTime, getDisplayStatus, getEventTemporalState } from '../lib/agenda'
import { buildExternalRouteUrl, clusterRingGradient, formatEventDistance, geolocationFailure, getMapMarkerState, hasApproximateCoordinates, hasEventCoordinates, sortEventsByDistance, summarizeMapCoverage, summarizeMarkerStates, type ClusterComposition, type GeoPoint, type MapMarkerState } from '../lib/agendaMap'
import { publicAgendaStatusLabel } from '../lib/agendaPresentation'
import styles from '../styles/App.module.css'

interface AgendaMapProps {
  agenda: AgendaData
  events: AgendaEvent[]
  now: Date
  selectedEventId?: string
  variant?: 'agenda' | 'home'
  showNearbyList?: boolean
}

type LeafletApi = any

declare global {
  interface Window { L?: LeafletApi }
}

const LEAFLET_VERSION = '1.9.4'
const CLUSTER_VERSION = '1.5.3'
let leafletPromise: Promise<LeafletApi> | null = null

function addStyle(id: string, href: string) {
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.append(link)
}

function loadScript(id: string, src: string): Promise<void> {
  const current = document.getElementById(id) as HTMLScriptElement | null
  if (current?.dataset.loaded === 'true') return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = current ?? document.createElement('script')
    const done = () => { script.dataset.loaded = 'true'; resolve() }
    script.addEventListener('load', done, { once: true })
    script.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), { once: true })
    if (!current) {
      script.id = id
      script.src = src
      script.crossOrigin = 'anonymous'
      document.head.append(script)
    }
  })
}

function loadLeaflet(): Promise<LeafletApi> {
  if (window.L?.markerClusterGroup) return Promise.resolve(window.L)
  if (!leafletPromise) {
    addStyle('leaflet-css', `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`)
    addStyle('leaflet-cluster-css', `https://unpkg.com/leaflet.markercluster@${CLUSTER_VERSION}/dist/MarkerCluster.css`)
    addStyle('leaflet-cluster-default-css', `https://unpkg.com/leaflet.markercluster@${CLUSTER_VERSION}/dist/MarkerCluster.Default.css`)
    leafletPromise = loadScript('leaflet-js', `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`)
      .then(() => loadScript('leaflet-cluster-js', `https://unpkg.com/leaflet.markercluster@${CLUSTER_VERSION}/dist/leaflet.markercluster.js`))
      .then(() => {
        if (!window.L?.markerClusterGroup) throw new Error('Leaflet não ficou disponível.')
        return window.L
      })
      .catch((error) => { leafletPromise = null; throw error })
  }
  return leafletPromise
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

function temporalLabel(event: AgendaEvent, now: Date, timezone: string): string {
  const temporal = getEventTemporalState(event, now, timezone)
  if (temporal === 'happening-now') return 'Acontecendo agora'
  if (temporal === 'possibly-happening') return 'Pode estar acontecendo ainda'
  const status = getDisplayStatus(event, now, timezone)
  return publicAgendaStatusLabel(status) ?? (status === 'confirmado' ? 'Confirmado' : 'Divulgado')
}

function popupHtml(event: AgendaEvent, agenda: AgendaData, now: Date): string {
  const route = buildExternalRouteUrl(event)
  const details = `?view=agenda&evento=${encodeURIComponent(event.id)}`
  const precision = hasApproximateCoordinates(event) ? '<p class="agenda-map-precision"><strong>Localização aproximada</strong> — o marcador representa o município, não o ponto de encontro.</p>' : ''
  return `<article class="agenda-map-popup">
    <span>${escapeHtml(temporalLabel(event, now, agenda.timezone))}</span>
    <h3>${escapeHtml(event.titulo)}</h3>
    <p><strong>${event.data ? escapeHtml(formatAgendaDate(event.data, agenda.timezone, true)) : 'Data a confirmar'}</strong> · ${escapeHtml(formatEventTime(event))}</p>
    <p>${escapeHtml(formatEventPlace(event))}</p>${precision}
    <div><a class="agenda-map-popup__details" href="${details}">Ver detalhes</a>${route ? `<a class="agenda-map-popup__route" href="${escapeHtml(route)}" target="_blank" rel="noopener noreferrer">Traçar rota ↗</a>` : ''}</div>
  </article>`
}

function clusterLabel(composition: ClusterComposition, approximate: number): string {
  const parts = [
    composition.now && `${composition.now} acontecendo agora`,
    composition.possibly && `${composition.possibly} possivelmente acontecendo`,
    composition.future && `${composition.future} futuros`,
    composition.other && `${composition.other} encerrados ou cancelados`,
  ].filter(Boolean)
  const precision = approximate ? ` ${approximate} com localização municipal aproximada.` : ''
  return `Agrupamento com ${composition.total} eventos: ${parts.join(', ')}.${precision}`
}

function clusterCompositionHtml(composition: ClusterComposition, approximate: number): string {
  const rows = [
    ['now', 'Acontecendo agora', composition.now],
    ['possibly', 'Pode estar acontecendo', composition.possibly],
    ['future', 'Eventos futuros', composition.future],
    ['other', 'Encerrados ou cancelados', composition.other],
  ].filter(([, , count]) => Number(count) > 0)
  const precision = approximate ? `<p>${approximate} ${approximate === 1 ? 'marcador representa apenas o município' : 'marcadores representam apenas os municípios'}, não pontos exatos de concentração.</p>` : ''
  return `<section class="agenda-map-cluster-composition"><strong>${composition.total} eventos neste agrupamento</strong><ul>${rows.map(([state, label, count]) => `<li><i data-state="${state}" aria-hidden="true"></i><span>${label}</span><b>${count}</b></li>`).join('')}</ul>${precision}<small>Aproxime o mapa para ver cada marcador; eventos no mesmo município podem se sobrepor.</small></section>`
}

export function AgendaMap({ agenda, events, now, selectedEventId = '', variant = 'agenda', showNearbyList = true }: AgendaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [origin, setOrigin] = useState<GeoPoint | undefined>()
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'denied' | 'unavailable'>('idle')
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const mappedEvents = useMemo(() => events.filter(hasEventCoordinates), [events])
  const coverage = useMemo(() => summarizeMapCoverage(events), [events])
  const nearest = useMemo(() => origin ? sortEventsByDistance(mappedEvents, origin) : [], [mappedEvents, origin])

  useEffect(() => {
    let disposed = false
    let map: any
    let resizeObserver: ResizeObserver | undefined
    let resizeFrame = 0
    setMapStatus('loading')
    loadLeaflet().then((L) => {
      if (disposed || !containerRef.current) return
      const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
      map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        dragging: !(variant === 'home' && isCoarsePointer),
        touchZoom: true,
      }).setView([-14.2, -51.9], 4)
      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(() => {
          window.cancelAnimationFrame(resizeFrame)
          resizeFrame = window.requestAnimationFrame(() => map?.invalidateSize({ animate: false, pan: false }))
        })
        resizeObserver.observe(containerRef.current)
      }
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)
      const compositionFor = (group: any) => summarizeMarkerStates(group.getAllChildMarkers().map((marker: any) => marker.options.agendaState as MapMarkerState))
      const approximateFor = (group: any) => group.getAllChildMarkers().filter((marker: any) => marker.options.agendaPrecision === 'approximate').length
      const cluster = L.markerClusterGroup!({
        showCoverageOnHover: false,
        maxClusterRadius: 46,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (group: any) => {
          const composition = compositionFor(group)
          const size = composition.total >= 100 ? 62 : composition.total >= 10 ? 56 : 50
          const label = escapeHtml(clusterLabel(composition, approximateFor(group)))
          const ring = clusterRingGradient(composition)
          return L.divIcon({
            className: 'agenda-map-cluster-icon',
            html: `<span class="agenda-map-cluster" style="--agenda-cluster-ring:${ring}" role="img" aria-label="${label}"><strong aria-hidden="true">${composition.total}</strong></span>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          })
        },
      })
      const bounds: Array<[number, number]> = []
      let selectedMarker: any
      mappedEvents.forEach((event) => {
        const coordinates = event.coordenadas!
        const state = getMapMarkerState(event, now, agenda.timezone)
        const approximate = hasApproximateCoordinates(event)
        const icon = L.divIcon({
          className: 'agenda-map-marker-wrap',
          html: `<span class="agenda-map-marker agenda-map-marker--${state}${approximate ? ' agenda-map-marker--approximate' : ''}" aria-hidden="true"></span>`,
          iconSize: [26, 34], iconAnchor: [13, 30], popupAnchor: [0, -27],
        })
        const marker = L.marker([coordinates.latitude, coordinates.longitude], { icon, title: `${event.titulo}${approximate ? ' — localização aproximada' : ''}`, agendaState: state, agendaPrecision: approximate ? 'approximate' : 'exact' })
          .bindPopup(popupHtml(event, agenda, now), { maxWidth: 320 })
        cluster.addLayer(marker)
        bounds.push([coordinates.latitude, coordinates.longitude])
        if (event.id === selectedEventId) selectedMarker = marker
      })
      map.addLayer(cluster)
      cluster.on('clusterclick', (clusterEvent: any) => {
        const group = clusterEvent.layer
        const markers = group.getAllChildMarkers()
        const positions = new Set(markers.map((marker: any) => {
          const point = marker.getLatLng()
          return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
        }))
        const targetZoom = map.getBoundsZoom(group.getBounds())
        if (positions.size > 1 && targetZoom > map.getZoom()) return
        const composition = compositionFor(group)
        const approximate = approximateFor(group)
        window.setTimeout(() => {
          if (disposed) return
          L.popup({ className: 'agenda-map-cluster-popup', maxWidth: 280 })
            .setLatLng(clusterEvent.latlng)
            .setContent(clusterCompositionHtml(composition, approximate))
            .openOn(map)
        }, 0)
      })
      if (origin) {
        L.circleMarker([origin.latitude, origin.longitude], { radius: 8, color: '#155eef', fillColor: '#fff', fillOpacity: 1, weight: 4 })
          .bindPopup('Sua localização aproximada — não armazenada').addTo(map)
      }
      if (origin) {
        map.setView([origin.latitude, origin.longitude], 11)
      } else if (selectedMarker) {
        cluster.zoomToShowLayer(selectedMarker, () => selectedMarker.openPopup())
      } else if (bounds.length > 1) {
        const padding = variant === 'home' ? 14 : 28
        map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 11 })
      } else if (bounds.length === 1) map.setView(bounds[0], 11)
      setMapStatus('ready')
    }).catch(() => { if (!disposed) setMapStatus('error') })
    return () => {
      disposed = true
      resizeObserver?.disconnect()
      window.cancelAnimationFrame(resizeFrame)
      map?.remove()
    }
  }, [agenda, mappedEvents, now, origin, selectedEventId, variant])

  const locate = () => {
    if (!navigator.geolocation) { setLocationStatus('unavailable'); return }
    setLocationStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setOrigin({ latitude: coords.latitude, longitude: coords.longitude }); setLocationStatus('idle') },
      (error) => setLocationStatus(geolocationFailure(error.code)),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  return <section className={`${styles.agendaMapSection} ${variant === 'home' ? styles.agendaMapHome : ''}`} aria-label="Mapa das mobilizações">
    <div className={styles.agendaMapHeader}>
      <div><h2>{variant === 'home' ? 'Mapa nacional das mobilizações' : 'Mobilizações no mapa'}</h2><p>{coverage.total} no total · {coverage.exact} exatas · {coverage.approximate} aproximadas · {coverage.pending} pendentes.</p></div>
      <button type="button" onClick={locate} disabled={locationStatus === 'requesting'}><LocateFixed aria-hidden="true" size={18} />{locationStatus === 'requesting' ? 'Localizando…' : 'Perto de mim'}</button>
    </div>
    <div className={styles.agendaMapLegend} aria-label="Legenda dos marcadores">
      <span><i data-state="now" aria-hidden="true" />Acontecendo agora</span>
      <span><i data-state="possibly" aria-hidden="true" />Pode estar acontecendo</span>
      <span><i data-state="future" aria-hidden="true" />Evento futuro</span>
      <span><i data-state="soon" aria-hidden="true" />Começa em até 2 horas</span>
      <span><i data-precision="exact" aria-hidden="true" />Localização exata</span>
      <span><i data-precision="approximate" aria-hidden="true" />Município aproximado</span>
      <span className={styles.agendaClusterLegend}><i aria-hidden="true" />Anel do agrupamento = proporção por status; número = total</span>
    </div>
    {(locationStatus === 'denied' || locationStatus === 'unavailable') && <p className={styles.agendaMapNotice} role="status"><AlertTriangle aria-hidden="true" size={17} />{locationStatus === 'denied' ? 'A localização não foi autorizada. Use os filtros de cidade e UF acima.' : 'Não foi possível obter sua localização. Use os filtros de cidade e UF acima.'}</p>}
    <div className={styles.agendaMapCanvasWrap}>
      <div className={styles.agendaMapCanvas} ref={containerRef} aria-label="Mapa interativo com marcadores de eventos" />
      {mapStatus === 'loading' && <div className={styles.agendaMapOverlay} role="status">Carregando mapa…</div>}
      {mapStatus === 'error' && <div className={styles.agendaMapOverlay} role="alert"><MapPin aria-hidden="true" size={25} /><strong>O mapa não pôde ser carregado.</strong><span>A lista e os filtros continuam disponíveis. Verifique sua conexão e tente novamente.</span></div>}
    </div>
    {coverage.pending > 0 && <p className={styles.agendaMapFootnote}>{coverage.pending} {coverage.pending === 1 ? 'atividade ainda não aparece' : 'atividades ainda não aparecem'} no mapa porque o município e a UF não foram confirmados.</p>}
    {showNearbyList && origin && <div className={styles.nearbyEvents}>
      <div><Crosshair aria-hidden="true" size={18} /><strong>Mais perto de você</strong><span>Sua posição é usada somente neste navegador e não é armazenada.</span></div>
      <ol>{nearest.slice(0, 12).map(({ event, distance }) => <li key={event.id}>
        <a href={`?view=agenda&evento=${encodeURIComponent(event.id)}`}><span><strong>{event.titulo}</strong><small>{formatEventPlace(event)}</small>{hasApproximateCoordinates(event) && <em>Localização aproximada do município</em>}</span><b>{formatEventDistance(event, distance)}</b></a>
        {buildExternalRouteUrl(event) && <a href={buildExternalRouteUrl(event)!} target="_blank" rel="noopener noreferrer" aria-label={`Traçar rota para ${event.titulo}`}><ExternalLink aria-hidden="true" size={16} /></a>}
      </li>)}</ol>
    </div>}
  </section>
}
