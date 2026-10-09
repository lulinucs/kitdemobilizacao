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
    city: params.get('cidade') ?? '',
    state: params.get('uf') ?? '',
    category: params.get('cat_agenda') ?? '',
    includePast: params.get('anteriores') === '1' || Boolean(selectedEvent && isPastForList(selectedEvent, now, agenda.timezone)),
  }

  const dated = useMemo(() => events.filter((event) => event.data), [events])
  const pending = useMemo(() => events.filter((event) => !event.data), [events])
  const states = useMemo(() => [...new Set(events.map((event) => event.uf))].sort(), [events])
  const cityOptions = useMemo(() => {
    const counts = new Map<string, { city: string; state: string; count: number }>()
    events.filter((event) => !filters.state || event.uf === filters.state).forEach((event) => {
      const key = `${event.uf}|${event.cidade}`
      const current = counts.get(key)
      counts.set(key, { city: event.cidade, state: event.uf, count: (current?.count ?? 0) + 1 })
    })
    return [...counts.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'pt-BR'))
  }, [events, filters.state])
  const locationEvents = events.filter((event) => (!filters.state || event.uf === filters.state) && (!filters.city || event.cidade === filters.city))
  const categories = agenda.categorias.filter((category) => locationEvents.some((event) => event.categoria === category.id))

  const matchingDated = selectedEvent
    ? selectedEvent.data ? [selectedEvent] : []
    : filterAgendaEvents(dated, { ...filters, includePast: true }, now, agenda.timezone)
  const upcomingEvents = matchingDated.filter((event) => !isPastForList(event, now, agenda.timezone))
  const pastEvents = matchingDated.filter((event) => isPastForList(event, now, agenda.timezone) && filters.includePast)
  const filteredPending = selectedEvent
    ? selectedEvent.data ? [] : [selectedEvent]
    : filters.day ? [] : filterAgendaEvents(pending, { ...filters, includePast: true }, now, agenda.timezone)
  const availableDays = [...new Set(filterAgendaEvents(dated, { ...filters, day: '', includePast: true }, now, agenda.timezone)
    .filter((event) => filters.includePast || !isPastForList(event, now, agenda.timezone))
    .map((event) => event.data!))].sort()
  const resultCount = upcomingEvents.length + pastEvents.length + filteredPending.length
  const hasFilters = Boolean(filters.query || filters.day || filters.city || filters.state || filters.category || filters.includePast || selectedEventId)

  useEffect(() => {
    if (!selectedEventId) return
    document.getElementById(`evento-${selectedEventId}`)?.scrollIntoView({ block: 'center' })
  }, [selectedEventId])

  const clear = () => onUpdate({ evento: null, qa: null, dia: null, cidade: null, uf: null, bairro: null, cat_agenda: null, anteriores: null })
  const setMode = (next: AgendaViewMode) => onUpdate({ modo: next === 'list' ? 'lista' : null })
  const eventCard = (event: AgendaData['eventos'][number]) => (
    <AgendaEventCard key={event.id} event={event} agenda={agenda} categoryName={agenda.categorias.find((item) => item.id === event.categoria)?.nome ?? event.categoria} now={now} selected={event.id === selectedEventId} onPermalink={(id) => onUpdate({ evento: id })} />
  )

  return (
    <div className={styles.agendaPage}>
      <header className={styles.agendaHero}>
        <p className={styles.eyebrow}>AGENDA NACIONAL</p>
        <h1>Agenda de Mobilizações</h1>
        <p>Encontre encontros, atividades e mobilizações na sua cidade ou em outras regiões do Brasil.</p>
      </header>

      <div className={styles.agendaNotice} role="note">
        <CalendarDays aria-hidden="true" size={20} />
        <span>{agenda.aviso} “Divulgado” não significa que a informação foi verificada.</span>
      </div>

      <section className={styles.agendaControls} aria-label="Filtros da agenda">
        <label className={styles.agendaSearch}>
          <Search aria-hidden="true" size={19} />
          <span className={styles.srOnly}>Buscar na agenda</span>
          <input value={filters.query} onChange={(event) => onUpdate({ qa: event.target.value || null, evento: null }, true)} placeholder="Buscar por atividade, cidade ou local" />
          {filters.query && <button type="button" onClick={() => onUpdate({ qa: null })} aria-label="Limpar busca"><X aria-hidden="true" size={17} /></button>}
        </label>
        {states.length > 1 && <label>Estado
          <select value={filters.state} onChange={(event) => onUpdate({ uf: event.target.value || null, cidade: null, cat_agenda: null, dia: null, evento: null })}>
            <option value="">Todos os estados</option>
            {states.map((state) => <option key={state}>{state}</option>)}
          </select>
        </label>}
        <label>Cidade
          <select value={filters.city} onChange={(event) => onUpdate({ cidade: event.target.value || null, cat_agenda: null, dia: null, evento: null })}>
            <option value="">Todo o Brasil</option>
            {cityOptions.map((item) => <option value={item.city} key={`${item.state}-${item.city}`}>{item.city}{states.length > 1 && !filters.state ? `/${item.state}` : ''}</option>)}
          </select>
        </label>
        {categories.length > 1 && <label>Tipo de atividade
          <select value={filters.category} onChange={(event) => onUpdate({ cat_agenda: event.target.value || null, dia: null, evento: null })}>
            <option value="">Todos os tipos</option>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.nome}</option>)}
          </select>
        </label>}
      </section>

      {availableDays.length > 1 && <div className={styles.dayPicker} aria-label="Filtrar por dia">
        <button className={!filters.day ? styles.dayActive : ''} type="button" onClick={() => onUpdate({ dia: null, evento: null })}>Todas as datas</button>
        {availableDays.map((day) => <button className={filters.day === day ? styles.dayActive : ''} type="button" onClick={() => onUpdate({ dia: day, evento: null })} key={day}>{formatAgendaDate(day, agenda.timezone)}</button>)}
      </div>}

      <div className={styles.agendaToolbar}>
        <div>
          <strong>{resultCount} {resultCount === 1 ? 'atividade' : 'atividades'}</strong>
          <label className={styles.pastToggle}><input type="checkbox" checked={filters.includePast} onChange={(event) => onUpdate({ anteriores: event.target.checked ? '1' : null, evento: null })} /> Ver encerradas</label>
        </div>
        <div className={styles.viewToggle} aria-label="Modo de visualização">
          <button className={mode === 'timeline' ? styles.viewActive : ''} type="button" onClick={() => setMode('timeline')} aria-label="Ver linha do tempo"><Clock3 aria-hidden="true" size={18} />Linha do tempo</button>
          <button className={mode === 'list' ? styles.viewActive : ''} type="button" onClick={() => setMode('list')} aria-label="Ver lista"><List aria-hidden="true" size={18} />Lista</button>
        </div>
        {hasFilters && <button className={styles.clearButton} type="button" onClick={clear}>Limpar filtros</button>}
      </div>

      {!resultCount && <div className={styles.emptyState}><Search aria-hidden="true" size={30} /><h3>Nenhuma atividade encontrada</h3><p>Tente outra data ou remova algum filtro.</p><button type="button" onClick={clear}>Limpar filtros</button></div>}

      {upcomingEvents.length > 0 && (
        <div className={mode === 'timeline' ? styles.timeline : styles.agendaList}>
          {mode === 'timeline'
            ? [...new Set(upcomingEvents.map((event) => event.data!))].map((day) => (
              <section className={styles.timelineDay} key={day}>
                <h2>{formatAgendaDate(day, agenda.timezone, true)}</h2>
                {upcomingEvents.filter((event) => event.data === day).map((event) => (
                  <div className={styles.timelineRow} key={event.id}>
                    <time dateTime={`${event.data}T${event.inicio}`}>{event.inicio}</time>
                    {eventCard(event)}
                  </div>
                ))}
              </section>
            ))
            : upcomingEvents.map(eventCard)}
        </div>
      )}

      {pastEvents.length > 0 && <section className={styles.pastSection}>
        <div><p className={styles.eyebrow}>ARQUIVO</p><h2>Atividades encerradas</h2></div>
        <p>Eventos anteriores ficam separados da programação principal.</p>
        <div className={styles.agendaList}>{pastEvents.map(eventCard)}</div>
      </section>}

      {filteredPending.length > 0 && (
        <section className={styles.pendingSection}>
          <div><p className={styles.eyebrow}>FORA DA CRONOLOGIA</p><h2>Atividades com data a confirmar</h2></div>
          <p>Estas atividades não entram na programação diária nem no widget de próxima atividade.</p>
          <div className={styles.agendaList}>{filteredPending.map(eventCard)}</div>
        </section>
      )}
    </div>
  )
}
