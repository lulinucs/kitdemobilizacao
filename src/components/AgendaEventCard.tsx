import { CalendarDays, Clock3, ExternalLink, Link2, MapPin, Share2 } from 'lucide-react'
import { useState } from 'react'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { buildEventShare, buildMapUrl, formatAgendaDate, formatEventTime, getDisplayStatus } from '../lib/agenda'
import styles from '../styles/App.module.css'

const statusLabels = {
  divulgado: 'Divulgado — confirme',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  alterado: 'Alterado',
  data_pendente: 'Data a confirmar',
  encerrado: 'Encerrado',
}

interface AgendaEventCardProps {
  event: AgendaEvent
  agenda: AgendaData
  categoryName: string
  now: Date
  selected?: boolean
  onPermalink: (id: string) => void
}

function fallbackCopy(text: string) {
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

export function AgendaEventCard({ event, agenda, categoryName, now, selected, onPermalink }: AgendaEventCardProps) {
  const [shareState, setShareState] = useState('Compartilhar')
  const status = getDisplayStatus(event, now, agenda.timezone)
  const mapUrl = buildMapUrl(event, agenda.cidade, agenda.uf)

  const share = async () => {
    const payload = buildEventShare(event, window.location, agenda.timezone)
    try {
      if (navigator.share) await navigator.share(payload)
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`)
        setShareState('Link copiado')
      } else {
        fallbackCopy(`${payload.text}\n${payload.url}`)
        setShareState('Link copiado')
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') setShareState('Não foi possível copiar')
    }
  }

  return (
    <article className={`${styles.agendaCard} ${selected ? styles.agendaCardSelected : ''}`} id={`evento-${event.id}`}>
      <div className={styles.agendaCardTop}>
        <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>{statusLabels[status]}</span>
        <span className={styles.agendaCategory}>{categoryName}</span>
      </div>
      <h3>{event.titulo}</h3>
      <div className={styles.eventFacts}>
        <span><CalendarDays aria-hidden="true" size={16} />{event.data ? formatAgendaDate(event.data, agenda.timezone, true) : 'Data a confirmar'}</span>
        <span><Clock3 aria-hidden="true" size={16} />{formatEventTime(event)}</span>
        {(event.local || event.endereco || event.bairro) && <span><MapPin aria-hidden="true" size={16} />{[event.local, event.endereco, event.bairro].filter(Boolean).join(' · ')}</span>}
      </div>
      <p>{event.descricao}</p>
      {event.participacao && <p className={styles.participation}><strong>Participação:</strong> {event.participacao}</p>}
      {event.recorrencia?.texto && <p className={styles.pendingNote}>{event.recorrencia.texto}. Não há recorrência presumida.</p>}
      <div className={styles.eventActions}>
        <button type="button" onClick={share}><Share2 aria-hidden="true" size={16} />{shareState}</button>
        <button type="button" onClick={() => onPermalink(event.id)}><Link2 aria-hidden="true" size={16} />Link permanente</button>
        {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden="true" size={16} />Ver no mapa</a>}
        {event.links?.map((link) => <a href={link.url} target="_blank" rel="noopener noreferrer" key={link.url}>{link.rotulo}<ExternalLink aria-hidden="true" size={15} /></a>)}
      </div>
    </article>
  )
}
