import { CalendarDays, Clock3, List, Search, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import type { AgendaData, AgendaFilters, AgendaViewMode } from '../agendaTypes'
import { filterAgendaEvents, formatAgendaDate, isPastForList } from '../lib/agenda'
import { AgendaEventCard } from './AgendaEventCard'
import styles from '../styles/App.module.css'

interface AgendaPageProps {
  agenda: AgendaData
  events: AgendaData['eventos']
  now: Date
  params: URLSearchParams
  onUpdate: (patch: Record<string, string | null>, replace?: boolean) => void
}

export function AgendaPage({ agenda, events, now, params, onUpdate }: AgendaPageProps) {
  const selectedEventId = params.get('evento') ?? ''
  const selectedEvent = events.find((event) => event.id === selectedEventId)
  const mode = (params.get('modo') === 'lista' ? 'list' : 'timeline') as AgendaViewMode
  const filters: AgendaFilters = {
    query: params.get('qa') ?? '',
    day: params.get('dia') ?? '',
    neighborhood: params.get('bairro') ?? '',
    category: params.get('cat_agenda') ?? '',
    includePast: params.get('anteriores') === '1' || Boolean(selectedEvent && isPastForList(selectedEvent, now, agenda.timezone)),
  }

  const dated = useMemo(() => events.filter((event) => event.data), [events])
  const pending = useMemo(() => events.filter((event) => !event.data), [events])
  const filteredDated = selectedEvent
    ? selectedEvent.data ? [selectedEvent] : []
    : filterAgendaEvents(dated, filters, now, agenda.timezone)
  const filteredPending = selectedEvent
    ? selectedEvent.data ? [] : [selectedEvent]
    : filters.day ? [] : filterAgendaEvents(pending, { ...filters, includePast: true }, now, agenda.timezone)
  const neighborhoods = [...new Set(events.map((event) => event.bairro).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const days = [...new Set(dated.map((event) => event.data!))].sort()
  const resultCount = filteredDated.length + filteredPending.length
  const hasFilters = Boolean(filters.query || filters.day || filters.neighborhood || filters.category || filters.includePast || selectedEventId)

  useEffect(() => {
    if (!selectedEventId) return
    document.getElementById(`evento-${selectedEventId}`)?.scrollIntoView({ block: 'center' })
  }, [selectedEventId])

  const clear = () => onUpdate({ evento: null, qa: null, dia: null, bairro: null, cat_agenda: null, anteriores: null })
  const setMode = (next: AgendaViewMode) => onUpdate({ modo: next === 'list' ? 'lista' : null })

  return (
    <div className={styles.agendaPage}>
      <header className={styles.agendaHero}>
        <p className={styles.eyebrow}>AGENDA FLORIPA</p>
        <h1>Mobilizações em Florianópolis</h1>
        <p>Consulte horários e locais divulgados. Confirme as informações antes de sair.</p>
      </header>

      <div className={styles.agendaNotice} role="note">
        <CalendarDays aria-hidden="true" size={20} />
        <span>{agenda.aviso} “Divulgado” não significa que a informação foi verificada.</span>
      </div>

      <section className={styles.agendaControls} aria-label="Filtros da agenda">
        <label className={styles.agendaSearch}>
          <Search aria-hidden="true" size={19} />
          <span className={styles.srOnly}>Buscar na agenda</span>
          <input value={filters.query} onChange={(event) => onUpdate({ qa: event.target.value || null, evento: null }, true)} placeholder="Buscar por atividade, local ou descrição" />
          {filters.query && <button type="button" onClick={() => onUpdate({ qa: null })} aria-label="Limpar busca"><X aria-hidden="true" size={17} /></button>}
        </label>
        <label>Bairro
          <select value={filters.neighborhood} onChange={(event) => onUpdate({ bairro: event.target.value || null, evento: null })}>
            <option value="">Todos</option>
            {neighborhoods.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Categoria
          <select value={filters.category} onChange={(event) => onUpdate({ cat_agenda: event.target.value || null, evento: null })}>
            <option value="">Todas</option>
            {agenda.categorias.map((category) => <option value={category.id} key={category.id}>{category.nome}</option>)}
          </select>
        </label>
      </section>

      <div className={styles.dayPicker} aria-label="Filtrar por dia">
        <button className={!filters.day ? styles.dayActive : ''} type="button" onClick={() => onUpdate({ dia: null, evento: null })}>Todas as datas</button>
        {days.map((day) => <button className={filters.day === day ? styles.dayActive : ''} type="button" onClick={() => onUpdate({ dia: day, evento: null })} key={day}>{formatAgendaDate(day, agenda.timezone)}</button>)}
      </div>

      <div className={styles.agendaToolbar}>
        <div>
          <strong>{resultCount} {resultCount === 1 ? 'atividade' : 'atividades'}</strong>
          <label className={styles.pastToggle}><input type="checkbox" checked={filters.includePast} onChange={(event) => onUpdate({ anteriores: event.target.checked ? '1' : null, evento: null })} /> Ver anteriores</label>
        </div>
        <div className={styles.viewToggle} aria-label="Modo de visualização">
          <button className={mode === 'timeline' ? styles.viewActive : ''} type="button" onClick={() => setMode('timeline')} aria-label="Ver linha do tempo"><Clock3 aria-hidden="true" size={18} />Linha do tempo</button>
          <button className={mode === 'list' ? styles.viewActive : ''} type="button" onClick={() => setMode('list')} aria-label="Ver lista"><List aria-hidden="true" size={18} />Lista</button>
        </div>
        {hasFilters && <button className={styles.clearButton} type="button" onClick={clear}>Limpar filtros</button>}
      </div>

      {!resultCount && <div className={styles.emptyState}><Search aria-hidden="true" size={30} /><h3>Nenhuma atividade encontrada</h3><p>Tente outra data ou remova algum filtro.</p><button type="button" onClick={clear}>Limpar filtros</button></div>}

      {filteredDated.length > 0 && (
        <div className={mode === 'timeline' ? styles.timeline : styles.agendaList}>
          {mode === 'timeline'
            ? days.filter((day) => filteredDated.some((event) => event.data === day)).map((day) => (
              <section className={styles.timelineDay} key={day}>
                <h2>{formatAgendaDate(day, agenda.timezone, true)}</h2>
                {filteredDated.filter((event) => event.data === day).map((event) => (
                  <div className={styles.timelineRow} key={event.id}>
                    <time dateTime={`${event.data}T${event.inicio}`}>{event.inicio}</time>
                    <AgendaEventCard event={event} agenda={agenda} categoryName={agenda.categorias.find((item) => item.id === event.categoria)?.nome ?? event.categoria} now={now} selected={event.id === selectedEventId} onPermalink={(id) => onUpdate({ evento: id })} />
                  </div>
                ))}
              </section>
            ))
            : filteredDated.map((event) => <AgendaEventCard key={event.id} event={event} agenda={agenda} categoryName={agenda.categorias.find((item) => item.id === event.categoria)?.nome ?? event.categoria} now={now} selected={event.id === selectedEventId} onPermalink={(id) => onUpdate({ evento: id })} />)}
        </div>
      )}

      {filteredPending.length > 0 && (
        <section className={styles.pendingSection}>
          <div><p className={styles.eyebrow}>FORA DA CRONOLOGIA</p><h2>Atividades com data a confirmar</h2></div>
          <p>Estas atividades não entram na programação diária nem no widget de próxima atividade.</p>
          <div className={styles.agendaList}>{filteredPending.map((event) => <AgendaEventCard key={event.id} event={event} agenda={agenda} categoryName={agenda.categorias.find((item) => item.id === event.categoria)?.nome ?? event.categoria} now={now} selected={event.id === selectedEventId} onPermalink={(id) => onUpdate({ evento: id })} />)}</div>
        </section>
      )}
    </div>
  )
}
