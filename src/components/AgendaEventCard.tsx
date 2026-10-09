import { Building2, CalendarDays, Clock3, ExternalLink, Link2, MapPin, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { buildEventShare, buildMapUrl, formatAgendaDate, formatEventInstitution, formatEventPlace, formatEventTime, getDisplayStatus } from '../lib/agenda'
import { publicAdditionalInfo, publicAgendaStatusLabel } from '../lib/agendaPresentation'
import styles from '../styles/App.module.css'

interface AgendaEventCardProps {
  event: AgendaEvent
  agenda: AgendaData
  categoryName: string
  now: Date
  selected?: boolean
  grouped?: boolean
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

export function AgendaEventCard({ event, agenda, categoryName, now, selected, grouped = false, onPermalink }: AgendaEventCardProps) {
  const [shareState, setShareState] = useState('Compartilhar')
  const [expanded, setExpanded] = useState(Boolean(selected))
  const status = getDisplayStatus(event, now, agenda.timezone)
  const statusLabel = publicAgendaStatusLabel(status)
  const additionalInfo = publicAdditionalInfo(event.informacoesAdicionais)
  const mapUrl = buildMapUrl(event)
  const institution = formatEventInstitution(event)
  const groupedTitle = event.cidade
    ? `${event.cidade}${event.uf ? `/${event.uf}` : ''}`
    : institution ?? (event.modalidade === 'virtual' ? 'Atividade virtual' : event.titulo)

  useEffect(() => {
    if (selected) setExpanded(true)
  }, [selected])

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
    <article className={`${styles.agendaCard} ${status === 'encerrado' ? styles.agendaCardPast : ''} ${selected ? styles.agendaCardSelected : ''}`} id={`evento-${event.id}`}>
      <div className={styles.agendaCardTop}>
        {statusLabel && <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>{statusLabel}</span>}
        <span className={styles.agendaCategory}>{categoryName}</span>
      </div>
      <h3>{grouped ? groupedTitle : event.titulo}</h3>
      <div className={styles.eventFacts}>
        {!grouped && <span><CalendarDays aria-hidden="true" size={16} />{event.data ? formatAgendaDate(event.data, agenda.timezone, true) : 'Data a confirmar'}</span>}
        <span><Clock3 aria-hidden="true" size={16} />{formatEventTime(event)}</span>
        <span><MapPin aria-hidden="true" size={16} /><strong>{formatEventPlace(event)}</strong></span>
        {institution && !grouped && <span><Building2 aria-hidden="true" size={16} />{institution}</span>}
      </div>
      <button className={styles.eventExpand} type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? 'Ocultar detalhes' : 'Ver detalhes'}</button>
      {expanded && <div className={styles.eventDetails}>
        <p>{event.descricao}</p>
        {institution && grouped && <p><strong>Instituição/campus:</strong> {institution}</p>}
        {event.pontoEncontro && <p><strong>Ponto de encontro:</strong> {event.pontoEncontro}</p>}
        {(event.endereco || event.bairro) && <p><strong>Localização:</strong> {[event.endereco, event.bairro].filter(Boolean).join(' · ')}</p>}
        {additionalInfo && <p><strong>Informações adicionais:</strong> {additionalInfo}</p>}
        {event.fonte && !event.fonte.url && <p><strong>Fonte:</strong> {event.fonte.rotulo}</p>}
        {event.recorrencia?.texto && <p className={styles.pendingNote}>{event.recorrencia.texto}</p>}
        <div className={styles.eventActions}>
          <button type="button" onClick={share}><Share2 aria-hidden="true" size={16} />{shareState}</button>
          <button type="button" onClick={() => onPermalink(event.id)}><Link2 aria-hidden="true" size={16} />Link permanente</button>
          {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden="true" size={16} />Ver no mapa</a>}
          {event.fonte?.url && <a href={event.fonte.url} target="_blank" rel="noopener noreferrer">{event.fonte.rotulo}<ExternalLink aria-hidden="true" size={15} /></a>}
          {event.links?.map((link) => <a href={link.url} target="_blank" rel="noopener noreferrer" key={link.url}>{link.rotulo}<ExternalLink aria-hidden="true" size={15} /></a>)}
        </div>
      </div>}
    </article>
  )
}
