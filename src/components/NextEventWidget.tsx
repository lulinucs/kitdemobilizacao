import { CalendarDays, Clock3, MapPin } from 'lucide-react'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { formatAgendaDate, formatEventTime } from '../lib/agenda'
import styles from '../styles/App.module.css'

interface NextEventWidgetProps {
  event?: AgendaEvent
  agenda: AgendaData
  onAgenda: () => void
}

export function NextEventWidget({ event, agenda, onAgenda }: NextEventWidgetProps) {
  return (
    <aside className={styles.nextEvent} aria-labelledby="next-event-title">
      <p className={styles.eyebrow}>AGENDA FLORIPA</p>
      <h2 id="next-event-title">Próxima atividade</h2>
      {event ? (
        <>
          <h3>{event.titulo}</h3>
          <div className={styles.nextEventMeta}>
            <span><CalendarDays aria-hidden="true" size={16} />{formatAgendaDate(event.data!, agenda.timezone, true)}</span>
            <span><Clock3 aria-hidden="true" size={16} />{formatEventTime(event)}</span>
            {(event.local || event.bairro) && <span><MapPin aria-hidden="true" size={16} />{[event.local, event.bairro].filter(Boolean).join(' · ')}</span>}
          </div>
        </>
      ) : <p className={styles.nextEventEmpty}>Nenhuma atividade futura cadastrada.</p>}
      <button type="button" onClick={onAgenda}>Ver agenda</button>
    </aside>
  )
}
