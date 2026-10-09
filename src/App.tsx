import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import rawAgenda from './data/agenda-floripa.json'
import rawData from './data/iniciativas.json'
import { ActivityFilters } from './components/ActivityFilters'
import { AgendaPage } from './components/AgendaPage'
import { AppShell } from './components/AppShell'
import { ContributionCallout } from './components/ContributionCallout'
import { EmptyState } from './components/EmptyState'
import { InitiativeList } from './components/InitiativeList'
import { NextEventWidget } from './components/NextEventWidget'
import { Search } from './components/Search'
import { Sidebar } from './components/Sidebar'
import { ThemeToggle } from './components/ThemeToggle'
import { getNextEvent, validateAgenda } from './lib/agenda'
import { createCatalogSearch, filterInitiatives, readCatalogFilters, validateDirectory } from './lib/directory'
import type { AgendaData } from './agendaTypes'
import type { DirectoryData, Filters } from './types'
import styles from './styles/App.module.css'

const data = rawData as DirectoryData
const agendaSource = rawAgenda as AgendaData

function readFilters(): Filters {
  return readCatalogFilters(window.location.search)
}

function normalizeCatalogUrl(filters: Filters) {
  const search = createCatalogSearch(filters)
  const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}`
  const currentUrl = `${window.location.pathname}${window.location.search}`
  if (nextUrl !== currentUrl) window.history.replaceState({}, '', nextUrl)
}

function systemTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('tema')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(readFilters)
  const [theme, setTheme] = useState<'light' | 'dark'>(systemTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const [routeVersion, setRouteVersion] = useState(0)
  const [agendaCityContext, setAgendaCityContext] = useState(() => localStorage.getItem('agenda-cidade') ?? '')
  const [now] = useState(() => new Date())
  const params = useMemo(() => new URLSearchParams(window.location.search), [routeVersion])
  const currentView = params.get('view') === 'agenda' || params.has('evento') ? 'agenda' : 'home'
  const results = useMemo(() => filterInitiatives(data, filters), [filters])
  const directoryErrors = useMemo(() => validateDirectory(data), [])
  const agendaValidation = useMemo(() => validateAgenda(agendaSource), [])
  const agenda = useMemo(() => ({ ...agendaSource, eventos: agendaValidation.events }), [agendaValidation.events])
  const nextEvent = useMemo(() => getNextEvent(agenda.eventos.filter((event) => !agendaCityContext || event.cidade === agendaCityContext), now, agenda.timezone), [agenda.eventos, agenda.timezone, agendaCityContext, now])

  useEffect(() => {
    if (directoryErrors.length) console.error('Erros em iniciativas.json:', directoryErrors)
    if (agendaValidation.errors.length) console.error('Registros ignorados na agenda de mobilizações:', agendaValidation.errors)
  }, [agendaValidation.errors, directoryErrors])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('tema', theme)
  }, [theme])

  useEffect(() => {
    if (currentView !== 'agenda') return
    const city = params.get('cidade') ?? ''
    setAgendaCityContext(city)
    if (city) localStorage.setItem('agenda-cidade', city)
    else localStorage.removeItem('agenda-cidade')
  }, [currentView, params])

  useEffect(() => {
    const onPopState = () => {
      const restoredFilters = readFilters()
      const restoredParams = new URLSearchParams(window.location.search)
      if (restoredParams.get('view') !== 'agenda' && !restoredParams.has('evento')) normalizeCatalogUrl(restoredFilters)
      setFilters(restoredFilters)
      setRouteVersion((value) => value + 1)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (currentView === 'home') normalizeCatalogUrl(filters)
    // A normalização inicial deve acontecer apenas ao montar a aplicação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commitUrl = (nextParams: URLSearchParams, replace = false) => {
    const nextUrl = `${window.location.pathname}${nextParams.size ? `?${nextParams}` : ''}`
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextUrl)
    setRouteVersion((value) => value + 1)
  }

  const updateCatalog = (patch: Partial<Filters>, replace = false) => {
    const nextFilters = { ...filters, ...patch }
    if (Object.hasOwn(patch, 'category')) nextFilters.activity = ''
    if (Object.hasOwn(patch, 'activity')) nextFilters.category = ''
    const nextParams = new URLSearchParams(createCatalogSearch(nextFilters))
    commitUrl(nextParams, replace)
    setFilters(nextFilters)
  }

  const updateAgenda = (patch: Record<string, string | null>, replace = false) => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set('view', 'agenda')
    Object.entries(patch).forEach(([key, value]) => value ? nextParams.set(key, value) : nextParams.delete(key))
    commitUrl(nextParams, replace)
  }

  const goHome = () => {
    setFilters({ query: '', category: '', activity: '' })
    commitUrl(new URLSearchParams())
  }
  const goAgenda = (eventId?: string) => {
    const nextParams = new URLSearchParams({ view: 'agenda' })
    if (eventId) nextParams.set('evento', eventId)
    if (agendaCityContext) nextParams.set('cidade', agendaCityContext)
    commitUrl(nextParams)
  }
  const clear = () => updateCatalog({ query: '', category: '', activity: '' })
  const selectedCategory = data.categorias.find((item) => item.id === filters.category)
  const selectedActivity = data.atividades.find((item) => item.id === filters.activity)

  return (
    <AppShell
      sidebar={<Sidebar categories={data.categorias} activities={data.atividades} category={filters.category} activity={filters.activity} currentView={currentView} open={menuOpen} onCategory={(category) => updateCatalog({ category })} onActivity={(activity) => updateCatalog({ activity })} onHome={goHome} onAgenda={goAgenda} onClose={() => setMenuOpen(false)} onOpen={() => setMenuOpen(true)} />}
      header={<header className={styles.header}><div className={styles.mobileBrand}><strong>Kit de Mobilização</strong><small>Segundo Turno · Eleições 2026</small></div><ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')} /></header>}
      footer={<footer className={styles.footer}><p>O Kit de Mobilização é um agregador independente de recursos, iniciativas e informações de terceiros. Não representa uma organização ou movimento político. Confirme os dados e respeite a legislação eleitoral e as regras de uso dos espaços.</p><p>Dados atualizados em 9 de outubro de 2026.</p></footer>}
    >
      {currentView === 'agenda' ? (
        <AgendaPage agenda={agenda} events={agenda.eventos} now={now} params={params} onUpdate={updateAgenda} />
      ) : (
        <div className={styles.homeLayout}>
          <div className={styles.homePrimary}>
            <section className={styles.intro} aria-labelledby="page-title">
              <p className={styles.eyebrow}>SEGUNDO TURNO · ELEIÇÕES 2026</p>
              <h1 id="page-title">Encontre uma iniciativa para participar</h1>
              <p className={styles.lead}>Um acervo independente de iniciativas, ferramentas, materiais e agendas de mobilização para o segundo turno das eleições de 2026. Tudo organizado em um só lugar para facilitar o acesso e a participação.</p>
              <Search value={filters.query} onChange={(query) => updateCatalog({ query }, true)} />
            </section>

            <div className={styles.mobileNextEvent}><NextEventWidget event={nextEvent} agenda={agenda} cityContext={agendaCityContext} onAgenda={goAgenda} /></div>

            <section className={styles.quickActions} aria-labelledby="quick-title">
              <div className={styles.sectionTitleRow}><div><p className={styles.eyebrow}>ATALHOS</p><h2 id="quick-title">O que você quer fazer?</h2></div></div>
              <ActivityFilters activities={data.atividades.filter((item) => ['compartilhar', 'conversar', 'imprimir', 'organizar'].includes(item.id))} selected={filters.activity} onSelect={(activity) => updateCatalog({ activity })} compact />
            </section>

            <section className={styles.results} aria-labelledby="results-title">
              <div className={styles.resultsHeader}>
                <div><p className={styles.eyebrow}>ÍNDICE</p><h2 id="results-title">{results.length} {results.length === 1 ? 'iniciativa encontrada' : 'iniciativas encontradas'}</h2></div>
                {(filters.query || filters.category || filters.activity) && <button className={styles.clearButton} type="button" onClick={clear}>Limpar filtros</button>}
              </div>
              <div className={styles.activeFilters} aria-label="Filtros ativos">
                {selectedCategory ? <button type="button" onClick={() => updateCatalog({ category: '' })}>{selectedCategory.nome}<X aria-hidden="true" size={15} /></button> : selectedActivity ? <button type="button" onClick={() => updateCatalog({ activity: '' })}>{selectedActivity.nome}<X aria-hidden="true" size={15} /></button> : null}
                {filters.query && <button type="button" onClick={() => updateCatalog({ query: '' })}>Busca: “{filters.query}”<X aria-hidden="true" size={15} /></button>}
              </div>
              {results.length ? <InitiativeList initiatives={results} categories={data.categorias} /> : <EmptyState onClear={clear} />}
            </section>
            <ContributionCallout />
          </div>
          <div className={styles.desktopNextEvent}><NextEventWidget event={nextEvent} agenda={agenda} cityContext={agendaCityContext} onAgenda={goAgenda} /></div>
        </div>
      )}
    </AppShell>
  )
}
