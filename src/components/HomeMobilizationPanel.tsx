import { ArrowRight, CalendarDays, Clock3, MapPin } from 'lucide-react'
import { useMemo } from 'react'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { createAgendaParams, formatAgendaDate, formatEventPlace, formatEventTime, getEventTemporalState, getUpcomingWidgetEvents } from '../lib/agenda'
import { AgendaMap } from './AgendaMap'
import styles from '../styles/App.module.css'

interface HomeMobilizationPanelProps {
  agenda: AgendaData
  now: Date
  onAgenda: () => void
  onEvent: (eventId: string) => void
}

const eligibleStatuses = new Set(['divulgado', 'confirmado', 'alterado'])

function uniqueEvents(groups: AgendaEvent[][]): AgendaEvent[] {
  const seen = new Set<string>()
  return groups.flat().filter((event) => {
    if (seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })
}

function eventStateLabel(event: AgendaEvent, now: Date, timezone: string): string {
  const state = getEventTemporalState(event, now, timezone)
  if (state === 'happening-now') return 'Acontecendo agora'
  if (state === 'possibly-happening') return 'Pode estar acontecendo'
  return 'Próximo evento'
}

export function HomeMobilizationPanel({ agenda, now, onAgenda, onEvent }: HomeMobilizationPanelProps) {
  const data = useMemo(() => {
    const eligible = agenda.eventos.filter((event) => eligibleStatuses.has(event.status))
    const happening = eligible.filter((event) => getEventTemporalState(event, now, agenda.timezone) === 'happening-now')
    const possibly = eligible.filter((event) => getEventTemporalState(event, now, agenda.timezone) === 'possibly-happening')
    const upcoming = getUpcomingWidgetEvents(eligible, now, agenda.timezone)
    const mapEvents = uniqueEvents([happening, possibly, upcoming])
    const compactEvents = mapEvents.slice(0, 5)
    const cities = new Set(mapEvents.filter((event) => event.cidade).map((event) => `${event.cidade}/${event.uf ?? ''}`))
    return { happening, possibly, upcoming, mapEvents, compactEvents, cityCount: cities.size }
  }, [agenda, now])

  const subtitle = data.cityCount > 0
    ? `Acompanhe mobilizações em ${data.cityCount} ${data.cityCount === 1 ? 'cidade' : 'cidades'} de todo o país.`
    : 'Acompanhe as mobilizações de todo o país.'

  return <section className={styles.nationalPanel} aria-labelledby="mobilizations-title">
    <header className={styles.nationalPanelHero}>
      <div className={styles.nationalPanelIntro}>
        <p className={styles.eyebrow}>AGENDA NACIONAL</p>
        <h2 id="mobilizations-title">O Brasil está nas ruas!</h2>
        <p>{subtitle}</p>
      </div>
      <dl className={styles.nationalStats} aria-label="Situação das mobilizações">
        <div data-state="now"><dt><span className={styles.nationalStatLong}>Acontecendo agora</span><span className={styles.nationalStatShort}>Agora</span></dt><dd>{data.happening.length}</dd></div>
        <div data-state="possibly"><dt><span className={styles.nationalStatLong}>Possivelmente em andamento</span><span className={styles.nationalStatShort}>Possíveis</span></dt><dd>{data.possibly.length}</dd></div>
        <div data-state="future"><dt><span className={styles.nationalStatLong}>Próximos eventos</span><span className={styles.nationalStatShort}>Futuras</span></dt><dd>{data.upcoming.length}</dd></div>
      </dl>
    </header>

    <div className={styles.nationalMapWrap}>
      <AgendaMap agenda={agenda} events={data.mapEvents} now={now} variant="home" showNearbyList={false} />
    </div>

    <div className={styles.nationalPanelFooter}>
      <section className={styles.nationalEventStrip} aria-labelledby="national-events-title">
        <div className={styles.nationalEventStripHeading}>
          <div><p className={styles.eyebrow}>AGORA E A SEGUIR</p><h3 id="national-events-title">Mobilizações em destaque</h3></div>
          <span>{data.compactEvents.length} de {data.mapEvents.length}</span>
        </div>
        {data.compactEvents.length > 0 ? <ol>{data.compactEvents.map((event) => <li key={event.id}>
          <a href={`?${createAgendaParams({ eventId: event.id })}`} onClick={(click) => { click.preventDefault(); onEvent(event.id) }}>
            <span className={styles.nationalEventStatus} data-state={getEventTemporalState(event, now, agenda.timezone)}>{eventStateLabel(event, now, agenda.timezone)}</span>
            <strong>{event.titulo}</strong>
            <span className={styles.nationalEventMeta}>
              <span><CalendarDays aria-hidden="true" size={15} />{event.data ? formatAgendaDate(event.data, agenda.timezone) : 'Data a confirmar'}</span>
              <span><Clock3 aria-hidden="true" size={15} />{formatEventTime(event)}</span>
              <span><MapPin aria-hidden="true" size={15} />{formatEventPlace(event)}</span>
            </span>
          </a>
        </li>)}</ol> : <p className={styles.nationalEventEmpty}>Nenhuma atividade atual ou futura cadastrada.</p>}
      </section>
      <button className={styles.nationalAgendaButton} type="button" onClick={onAgenda}>Ver agenda completa<ArrowRight aria-hidden="true" size={18} /></button>
    </div>
  </section>
}
