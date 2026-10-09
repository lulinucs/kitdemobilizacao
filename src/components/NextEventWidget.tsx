import { useId } from 'react'
import { CalendarDays, Clock3, MapPin } from 'lucide-react'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { formatAgendaDate, formatEventTime, type WidgetEventSelection } from '../lib/agenda'
import styles from '../styles/App.module.css'

interface NextEventWidgetProps {
  selection: WidgetEventSelection
  agenda: AgendaData
  cityContext?: string
  onAgenda: (eventId?: string) => void
}

function EventDetails({ event, agenda, onAgenda }: { event: AgendaEvent; agenda: AgendaData; onAgenda: (eventId: string) => void }) {
  return (
    <article className={styles.nextEventItem}>
      <button className={styles.nextEventTitle} type="button" onClick={() => onAgenda(event.id)}>{event.titulo}</button>
      <div className={styles.nextEventMeta}>
        <span><CalendarDays aria-hidden="true" size={16} />{formatAgendaDate(event.data!, agenda.timezone, true)}</span>
        <span><Clock3 aria-hidden="true" size={16} />{formatEventTime(event)}</span>
        <span><MapPin aria-hidden="true" size={16} />{event.local ? `${event.local} · ` : ''}{event.cidade}/{event.uf}</span>
      </div>
    </article>
  )
}

export function NextEventWidget({ selection, agenda, cityContext, onAgenda }: NextEventWidgetProps) {
  const titleId = useId()
  const ongoing = selection.kind === 'ongoing'
  const multiple = ongoing && selection.events.length > 1

  return (
    <aside className={styles.nextEvent} aria-labelledby={titleId} aria-live="polite">
      <p className={styles.eyebrow}>AGENDA DE MOBILIZAÇÕES</p>
      <h2 id={titleId}>{ongoing ? 'Acontecendo agora' : 'Próxima atividade'}</h2>
      {multiple && <p className={styles.nextEventCount}>{selection.events.length} atividades acontecendo simultaneamente</p>}
      {selection.events.length ? (
        <div className={styles.nextEventItems}>
          {selection.events.map((event) => <EventDetails key={event.id} event={event} agenda={agenda} onAgenda={onAgenda} />)}
        </div>
      ) : <p className={styles.nextEventEmpty}>Nenhuma atividade futura cadastrada{cityContext ? ` em ${cityContext}` : ''}.</p>}
      <button className={styles.nextEventAgendaButton} type="button" onClick={() => onAgenda(multiple ? undefined : selection.events[0]?.id)}>
        {multiple ? 'Ver todas na agenda' : 'Ver na agenda'}
      </button>
    </aside>
  )
}
