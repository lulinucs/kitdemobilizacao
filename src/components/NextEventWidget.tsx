import { useId, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3, MapPin } from 'lucide-react'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { createAgendaParams, formatAgendaDate, formatEventTime, formatUpcomingEventTime, type WidgetEventSelection, type WidgetLocationEvent } from '../lib/agenda'
import styles from '../styles/App.module.css'

interface NextEventWidgetProps {
  selection: WidgetEventSelection
  upcomingByLocation: WidgetLocationEvent[]
  agenda: AgendaData
  onAgenda: () => void
  onEvent: (eventId: string) => void
}

function EventLink({ event, onEvent, className }: { event: AgendaEvent; onEvent: (eventId: string) => void; className: string }) {
  return <a className={className} href={`?${createAgendaParams({ eventId: event.id })}`} onClick={(click) => { click.preventDefault(); onEvent(event.id) }}>{event.titulo}</a>
}

function EventDetails({ event, agenda, onEvent }: { event: AgendaEvent; agenda: AgendaData; onEvent: (eventId: string) => void }) {
  const location = event.modalidade === 'virtual' ? 'Atividade virtual' : event.cidade ? `${event.cidade}${event.uf ? `/${event.uf}` : ''}` : event.uf ? `Município a confirmar · ${event.uf}` : 'Localidade a confirmar'
  const venue = event.pontoEncontro ?? event.local ?? event.endereco
  return (
    <article className={styles.nextEventItem}>
      <strong className={styles.nextEventLocation}>{location}</strong>
      <h5><EventLink className={styles.nextEventTitle} event={event} onEvent={onEvent} /></h5>
      <div className={styles.nextEventMeta}>
        <span><CalendarDays aria-hidden="true" size={16} />{formatAgendaDate(event.data!, agenda.timezone, true)}</span>
        <span><Clock3 aria-hidden="true" size={16} />{formatEventTime(event)}</span>
        {venue && <span><MapPin aria-hidden="true" size={16} />{venue}</span>}
      </div>
    </article>
  )
}

export function NextEventWidget({ selection, upcomingByLocation, agenda, onAgenda, onEvent }: NextEventWidgetProps) {
  const titleId = useId()
  const [showAllOngoing, setShowAllOngoing] = useState(false)
  const ongoingEvents = selection.kind === 'ongoing' ? selection.events : []
  const visibleOngoing = showAllOngoing ? ongoingEvents : ongoingEvents.slice(0, 9)

  return (
    <aside className={styles.nextEvent} aria-labelledby={titleId}>
      <header className={styles.nextEventHeader}><CalendarDays aria-hidden="true" size={21} /><h3 id={titleId}>Agenda de Mobilizações</h3></header>
      <section className={styles.nextEventNow} aria-labelledby={`${titleId}-now`}>
        <div className={styles.nextEventStatus}>{ongoingEvents.length > 0 && <span className={styles.liveDot} aria-hidden="true" />}<h4 id={`${titleId}-now`}>Acontecendo agora</h4><span className={styles.nextEventNowCount} role="status">{ongoingEvents.length} {ongoingEvents.length === 1 ? 'atividade' : 'atividades'}</span></div>
      {visibleOngoing.length > 0 && <div className={styles.nextEventItems}>{visibleOngoing.map((event) => <EventDetails key={event.id} event={event} agenda={agenda} onEvent={onEvent} />)}</div>}
      {!ongoingEvents.length && <p className={styles.nextEventEmpty}>Nenhuma atividade acontecendo neste momento.</p>}
      {ongoingEvents.length > 9 && <button className={styles.nextEventExpand} type="button" aria-expanded={showAllOngoing} onClick={() => setShowAllOngoing((value) => !value)}>{showAllOngoing ? 'Mostrar menos atividades' : `Ver todas as ${ongoingEvents.length} atividades acontecendo`}</button>}
      </section>
      {upcomingByLocation.length > 0 ? (
        <section className={styles.nextEventCities} aria-labelledby={`${titleId}-cities`}>
          <h4 id={`${titleId}-cities`}>Próximas atividades</h4>
          <div className={styles.nextEventCityList}>{upcomingByLocation.map(({ key, label, event }) => (
            <article className={styles.nextEventCity} key={key}>
              <strong>{label}</strong>
              <EventLink className={styles.nextEventCityTitle} event={event} onEvent={onEvent} />
              <span>{formatAgendaDate(event.data!, agenda.timezone)} · {formatUpcomingEventTime(event)}</span>
            </article>
          ))}</div>
        </section>
      ) : <p className={styles.nextEventEmpty}>Nenhuma atividade futura cadastrada.</p>}
      <button className={styles.nextEventAgendaButton} type="button" onClick={onAgenda}>Ver agenda completa<ArrowRight aria-hidden="true" size={17} /></button>
    </aside>
  )
}
