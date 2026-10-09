import { ArrowRight, CalendarDays, Clock3, MapPin } from 'lucide-react'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { formatEventScheduleLines, getHighlightCityGroups, shouldShowEditorialSpotlight } from '../lib/agenda'
import { publicAgendaStatusLabel } from '../lib/agendaPresentation'
import styles from '../styles/App.module.css'

const HIGHLIGHT_ID = 'mobilizacoes-13-out-2026'
const HIGHLIGHT_DATE = '2026-10-13'
const MAX_VISIBLE_CITIES = 3

interface EditorialMobilizationsSpotlightProps {
  agenda: AgendaData
  now: Date
  onOpen: (highlightId: string) => void
}

function shortDate(date: string | null): string {
  if (!date) return 'Data a confirmar'
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

function eventPlace(event: AgendaEvent): string {
  return event.pontoEncontro ?? event.local ?? event.endereco ?? 'Local a confirmar'
}

export function EditorialMobilizationsSpotlight({ agenda, now, onOpen }: EditorialMobilizationsSpotlightProps) {
  if (!shouldShowEditorialSpotlight(agenda.eventos, HIGHLIGHT_ID, HIGHLIGHT_DATE, now, agenda.timezone)) return null

  const cities = getHighlightCityGroups(agenda.eventos, HIGHLIGHT_ID, agenda.timezone)
  if (!cities.length) return null
  const visibleCities = cities.slice(0, MAX_VISIBLE_CITIES)
  const hiddenCityCount = cities.length - visibleCities.length

  return (
    <section className={styles.editorialSpotlight} aria-labelledby="editorial-mobilizations-title">
      <div className={styles.editorialSpotlightHeader}>
        <div>
          <p className={styles.editorialSpotlightEyebrow}>AGENDA EM DESTAQUE</p>
          <h2 id="editorial-mobilizations-title">MOBILIZAÇÕES DE 13 DE OUTUBRO</h2>
          <p>Atos e atividades estudantis anunciados em diferentes cidades do Brasil. Confira horários, locais e informações de cada convocação.</p>
        </div>
        <strong>{cities.length} {cities.length === 1 ? 'cidade com atividade anunciada' : 'cidades com atividades anunciadas'}</strong>
      </div>

      <div className={styles.editorialCityList}>
        {visibleCities.map((city) => (
          <article className={styles.editorialCity} key={city.key}>
            <h3>{city.city}{city.state ? `/${city.state}` : ''}</h3>
            {city.events.map((event) => {
              const statusLabel = publicAgendaStatusLabel(event.status)
              return <div className={styles.editorialAct} key={event.id}>
                {statusLabel && <span className={`${styles.editorialStatus} ${styles[`status_${event.status}`]}`}>{statusLabel}</span>}
                <div className={styles.editorialActDetails}>
                  <p><CalendarDays aria-hidden="true" size={16} /><span>{shortDate(event.data)}</span></p>
                  <div className={styles.editorialSchedule}><Clock3 aria-hidden="true" size={16} /><div>{formatEventScheduleLines(event).map((line) => <span key={line}>{line}</span>)}</div></div>
                  <p><MapPin aria-hidden="true" size={16} /><span>{eventPlace(event)}</span></p>
                </div>
              </div>
            })}
          </article>
        ))}
      </div>

      {hiddenCityCount > 0 && <p className={styles.editorialMoreCities}>Mais {hiddenCityCount} {hiddenCityCount === 1 ? 'cidade na agenda' : 'cidades na agenda'}.</p>}
      <button type="button" onClick={() => onOpen(HIGHLIGHT_ID)}>Ver mobilizações de 13/10<ArrowRight aria-hidden="true" size={18} /></button>
    </section>
  )
}
