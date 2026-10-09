import { useId } from 'react'
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
      <h4><EventLink className={styles.nextEventTitle} event={event} onEvent={onEvent} /></h4>
      <div className={styles.nextEventMeta}>
        <span><CalendarDays aria-hidden="true" size={16} />{formatAgendaDate(event.data!, agenda.timezone, true)}</span>
        <span><Clock3 aria-hidden="true" size={16} />{formatEventTime(event)}</span>
        <span><MapPin aria-hidden="true" size={16} /><span><strong>{location}</strong>{venue && <small>{venue}</small>}</span></span>
      </div>
    </article>
  )
}

export function NextEventWidget({ selection, upcomingByLocation, agenda, onAgenda, onEvent }: NextEventWidgetProps) {
  const titleId = useId()
  const ongoing = selection.kind === 'ongoing'
  const visibleOngoing = ongoing ? selection.events.slice(0, 2) : []
  const hiddenOngoingCount = ongoing ? selection.events.length - visibleOngoing.length : 0
  const visibleLocations = upcomingByLocation.slice(0, 4)

  return (
    <aside className={styles.nextEvent} aria-labelledby={titleId} aria-live="polite">
      <header className={styles.nextEventHeader}><CalendarDays aria-hidden="true" size={21} /><h3 id={titleId}>Agenda de Mobilizações</h3></header>
      {ongoing ? <div className={styles.nextEventStatus}><span className={styles.liveDot} aria-hidden="true" /><h4>Acontecendo agora</h4></div> : <h4 className={styles.nextEventUpcomingTitle}>Próximas mobilizações</h4>}
      {visibleOngoing.length > 0 && <div className={styles.nextEventItems}>{visibleOngoing.map((event) => <EventDetails key={event.id} event={event} agenda={agenda} onEvent={onEvent} />)}</div>}
      {hiddenOngoingCount > 0 && <p className={styles.nextEventCount}>Mais {hiddenOngoingCount} {hiddenOngoingCount === 1 ? 'atividade acontecendo' : 'atividades acontecendo'}</p>}
      {visibleLocations.length > 0 ? (
        <section className={styles.nextEventCities} aria-labelledby={`${titleId}-cities`}>
          <h4 id={`${titleId}-cities`}>Próximas por cidade</h4>
          <div className={styles.nextEventCityList}>{visibleLocations.map(({ key, label, event }) => (
            <article className={styles.nextEventCity} key={key}>
              <strong>{label}</strong>
              <EventLink className={styles.nextEventCityTitle} event={event} onEvent={onEvent} />
              <span>{formatAgendaDate(event.data!, agenda.timezone)} · {formatUpcomingEventTime(event)}</span>
            </article>
          ))}</div>
        </section>
      ) : !ongoing && <p className={styles.nextEventEmpty}>Nenhuma atividade futura cadastrada.</p>}
      <button className={styles.nextEventAgendaButton} type="button" onClick={onAgenda}>Ver agenda completa<ArrowRight aria-hidden="true" size={17} /></button>
    </aside>
  )
}
