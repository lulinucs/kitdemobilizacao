import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import rawAgenda from './data/agenda-floripa.json'
import rawData from './data/iniciativas.json'
import rawProfiles from './data/perfis.json'
import { AgendaPage } from './components/AgendaPage'
import { AppShell } from './components/AppShell'
import { ContributionCallout } from './components/ContributionCallout'
import { EmptyState } from './components/EmptyState'
import { InitiativeList } from './components/InitiativeList'
import { EditorialMobilizationsSpotlight } from './components/EditorialMobilizationsSpotlight'
import { NextEventWidget } from './components/NextEventWidget'
import { ParticipationPaths } from './components/ParticipationPaths'
import { ProfilesPage } from './components/ProfilesPage'
import { MediaPage } from './components/MediaPage'
import { Search } from './components/Search'
import { Sidebar } from './components/Sidebar'
import { ThemeToggle } from './components/ThemeToggle'
import { createAgendaParams, getUpcomingWidgetEventsByLocation, getWidgetEventSelection, validateAgenda } from './lib/agenda'
import { createCatalogSearch, filterInitiatives, readCatalogFilters, validateDirectory } from './lib/directory'
import { validateProfiles } from './lib/profiles'
import type { AgendaData } from './agendaTypes'
import type { DirectoryData, Filters, ProfilesData } from './types'
import styles from './styles/App.module.css'

const data = rawData as DirectoryData
const agendaSource = rawAgenda as AgendaData
const profilesSource = rawProfiles as ProfilesData

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
  const [catalogFiltersOpen, setCatalogFiltersOpen] = useState(() => window.innerWidth > 760)
  const [routeVersion, setRouteVersion] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const resultsRef = useRef<HTMLElement>(null)
  const pendingResultsScroll = useRef<ScrollBehavior | null>(null)
  const initialCatalogScrollHandled = useRef(false)
  const catalogFiltersRef = useRef(filters)
  catalogFiltersRef.current = filters
  const params = useMemo(() => new URLSearchParams(window.location.search), [routeVersion])
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/'
  const currentView = currentPath === '/midias' ? 'media' : currentPath === '/perfis' ? 'profiles' : params.get('view') === 'agenda' || params.has('evento') ? 'agenda' : 'home'
  const results = useMemo(() => filterInitiatives(data, filters), [filters])
  const directoryErrors = useMemo(() => validateDirectory(data), [])
  const profileErrors = useMemo(() => validateProfiles(profilesSource), [])
  const agendaValidation = useMemo(() => validateAgenda(agendaSource), [])
  const agenda = useMemo(() => ({ ...agendaSource, eventos: agendaValidation.events }), [agendaValidation.events])
  const widgetSelection = useMemo(() => getWidgetEventSelection(agenda.eventos, now, agenda.timezone), [agenda.eventos, agenda.timezone, now])
  const widgetUpcomingByLocation = useMemo(() => getUpcomingWidgetEventsByLocation(agenda.eventos, now, agenda.timezone), [agenda.eventos, agenda.timezone, now])

  useEffect(() => {
    if (directoryErrors.length) console.error('Erros em iniciativas.json:', directoryErrors)
    if (agendaValidation.errors.length) console.error('Registros ignorados na agenda de mobilizações:', agendaValidation.errors)
    if (profileErrors.length) console.error('Erros em perfis.json:', profileErrors)
  }, [agendaValidation.errors, directoryErrors, profileErrors])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('tema', theme)
  }, [theme])

  useEffect(() => {
    document.title = currentView === 'media'
      ? 'Mídias para compartilhar | Kit de Mobilização'
      : currentView === 'profiles'
      ? 'Perfis para acompanhar | Kit de Mobilização'
      : currentView === 'agenda'
        ? 'Agenda de Mobilizações | Kit de Mobilização'
        : 'Kit de Mobilização | Eleições 2026'
  }, [currentView])

  useEffect(() => {
    let interval: number | undefined
    const untilNextMinute = 60_000 - (Date.now() % 60_000)
    const timeout = window.setTimeout(() => {
      setNow(new Date())
      interval = window.setInterval(() => setNow(new Date()), 60_000)
    }, untilNextMinute)
    return () => {
      window.clearTimeout(timeout)
      if (interval !== undefined) window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const restoredFilters = readFilters()
      const restoredParams = new URLSearchParams(window.location.search)
      const restoredPath = window.location.pathname.replace(/\/+$/, '') || '/'
      const restoredHome = restoredPath === '/' && restoredParams.get('view') !== 'agenda' && !restoredParams.has('evento')
      if (restoredHome) {
        normalizeCatalogUrl(restoredFilters)
        const hadNavigationFilter = Boolean(catalogFiltersRef.current.category || catalogFiltersRef.current.activity)
        const hasNavigationFilter = Boolean(restoredFilters.category || restoredFilters.activity)
        if (hadNavigationFilter || hasNavigationFilter) pendingResultsScroll.current = 'auto'
      }
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

  useLayoutEffect(() => {
    if (currentView !== 'home') return

    let behavior = pendingResultsScroll.current
    if (!initialCatalogScrollHandled.current) {
      initialCatalogScrollHandled.current = true
      if (!behavior && (filters.category || filters.activity)) behavior = 'auto'
    }
    if (!behavior) return

    pendingResultsScroll.current = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    resultsRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : behavior, block: 'start' })
  }, [currentView, filters.activity, filters.category, routeVersion])

  const commitUrl = (nextParams: URLSearchParams, replace = false, pathname = window.location.pathname) => {
    const nextUrl = `${pathname}${nextParams.size ? `?${nextParams}` : ''}`
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextUrl)
    setRouteVersion((value) => value + 1)
  }

  const updateCatalog = (patch: Partial<Filters>, replace = false, scrollToResults = false) => {
    const nextFilters = { ...filters, ...patch }
    if (Object.hasOwn(patch, 'category')) nextFilters.activity = ''
    if (Object.hasOwn(patch, 'activity')) nextFilters.category = ''
    if (scrollToResults) pendingResultsScroll.current = 'smooth'
    const nextParams = new URLSearchParams(createCatalogSearch(nextFilters))
    commitUrl(nextParams, replace, '/')
    setFilters(nextFilters)
  }

  const updateAgenda = (patch: Record<string, string | null>, replace = false) => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set('view', 'agenda')
    Object.entries(patch).forEach(([key, value]) => value ? nextParams.set(key, value) : nextParams.delete(key))
    commitUrl(nextParams, replace, '/')
  }

  const goHome = () => {
    pendingResultsScroll.current = null
    setFilters({ query: '', category: '', activity: '' })
    commitUrl(new URLSearchParams(), false, '/')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
  }
  const goAgenda = () => {
    pendingResultsScroll.current = null
    commitUrl(createAgendaParams(), false, '/')
  }
  const goAgendaEvent = (eventId: string) => {
    pendingResultsScroll.current = null
    commitUrl(createAgendaParams({ eventId }), false, '/')
  }
  const goInitiatives = () => {
    pendingResultsScroll.current = 'smooth'
    setFilters({ query: '', category: '', activity: '' })
    commitUrl(new URLSearchParams(), false, '/')
  }
  const goHighlight = (highlightId: string) => {
    pendingResultsScroll.current = null
    commitUrl(createAgendaParams({ highlightId }), false, '/')
  }
  const goProfiles = () => {
    pendingResultsScroll.current = null
    commitUrl(new URLSearchParams(), false, '/perfis')
    window.scrollTo({ top: 0 })
  }
  const goMedia = () => {
    pendingResultsScroll.current = null
    commitUrl(new URLSearchParams(), false, '/midias')
    window.scrollTo({ top: 0 })
  }
  const selectMedia = (id: string | null) => {
    const next = new URLSearchParams()
    if (id) next.set('midia', id)
    commitUrl(next, false, '/midias')
  }
  const returnToCatalog = () => {
    pendingResultsScroll.current = null
    commitUrl(new URLSearchParams(createCatalogSearch(filters)), true, '/')
  }
  const clear = () => updateCatalog({ query: '', category: '', activity: '' }, false, true)
  const selectedCategory = data.categorias.find((item) => item.id === filters.category)
  const selectedActivity = data.atividades.find((item) => item.id === filters.activity)

  return (
    <AppShell
      sidebar={<Sidebar currentView={currentView} open={menuOpen} onHome={goHome} onInitiatives={goInitiatives} onAgenda={goAgenda} onProfiles={goProfiles} onMedia={goMedia} onClose={() => setMenuOpen(false)} onOpen={() => setMenuOpen(true)} />}
      header={<header className={styles.header}><div className={styles.mobileBrand}><strong>Kit de Mobilização</strong><small>Segundo Turno · Eleições 2026</small></div><ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')} /></header>}
      footer={<footer className={styles.footer}><p>O Kit de Mobilização é um agregador independente de recursos, iniciativas e informações de terceiros. Não representa uma organização ou movimento político. Confirme os dados e respeite a legislação eleitoral e as regras de uso dos espaços.</p><p>Dados atualizados em 9 de outubro de 2026.</p></footer>}
    >
      {currentView === 'media' ? (
        <MediaPage selectedId={params.get('midia')} onSelect={selectMedia} onInitiatives={goInitiatives} />
      ) : currentView === 'profiles' ? (
        <ProfilesPage data={profilesSource} onBack={returnToCatalog} />
      ) : currentView === 'agenda' ? (
        <AgendaPage agenda={agenda} events={agenda.eventos} now={now} params={params} onUpdate={updateAgenda} />
      ) : (
        <div className={styles.homePage}>
          <section className={styles.intro} aria-labelledby="page-title">
            <p className={styles.eyebrow}>KIT DE MOBILIZAÇÃO · ELEIÇÕES 2026</p>
            <h1 id="page-title">Como você quer participar?</h1>
            <p className={styles.lead}>Encontre atividades, materiais, ferramentas e informações sobre as mobilizações do segundo turno de 2026.</p>
          </section>

          <ParticipationPaths onAgenda={goAgenda} onInitiatives={goInitiatives} onMedia={goMedia} onProfiles={goProfiles} />

          <section className={styles.mobilizationsSection} aria-labelledby="mobilizations-title">
            <div className={styles.homeSectionHeading}><p className={styles.eyebrow}>AGENDA</p><h2 id="mobilizations-title">Atividades e mobilizações</h2></div>
            <div className={styles.mobilizationsGrid}>
              <NextEventWidget selection={widgetSelection} upcomingByLocation={widgetUpcomingByLocation} agenda={agenda} onAgenda={goAgenda} onEvent={goAgendaEvent} />
              <EditorialMobilizationsSpotlight agenda={agenda} now={now} onOpen={goHighlight} />
            </div>
          </section>

          <section className={styles.results} id="resultados" ref={resultsRef} aria-labelledby="results-title">
                <div className={styles.catalogIntro}>
                  <p className={styles.eyebrow}>CATÁLOGO</p>
                  <h2 id="results-title">Explore as iniciativas</h2>
                  <p>Encontre sites, ferramentas, materiais e projetos cadastrados no Kit.</p>
                </div>
                <Search value={filters.query} onChange={(query) => updateCatalog({ query }, true)} />
                <div className={styles.catalogFilters}>
                  <button className={styles.catalogFiltersToggle} type="button" aria-expanded={catalogFiltersOpen} onClick={() => setCatalogFiltersOpen((open) => !open)}><SlidersHorizontal aria-hidden="true" size={19} />Filtrar iniciativas</button>
                  {catalogFiltersOpen && <div className={styles.catalogFilterGroups}>
                    <fieldset><legend>Por categoria</legend><div>{data.categorias.map((category) => <button className={filters.category === category.id ? styles.catalogFilterActive : ''} type="button" aria-pressed={filters.category === category.id} onClick={() => updateCatalog({ category: filters.category === category.id ? '' : category.id }, false, true)} key={category.id}>{category.nome}</button>)}</div></fieldset>
                    <fieldset><legend>Por objetivo</legend><div>{data.atividades.map((activity) => <button className={filters.activity === activity.id ? styles.catalogFilterActive : ''} type="button" aria-pressed={filters.activity === activity.id} onClick={() => updateCatalog({ activity: filters.activity === activity.id ? '' : activity.id }, false, true)} key={activity.id}>{activity.nome.replace('Quero ', '')}</button>)}</div></fieldset>
                  </div>}
                </div>
                <div className={styles.resultsHeader}>
                  <h3>{results.length} {results.length === 1 ? 'iniciativa encontrada' : 'iniciativas encontradas'}</h3>
                  {(filters.query || filters.category || filters.activity) && <button className={styles.clearButton} type="button" onClick={clear}>Limpar filtros</button>}
                </div>
                <div className={styles.activeFilters} aria-label="Filtros ativos">
                  {selectedCategory ? <button type="button" onClick={() => updateCatalog({ category: '' }, false, true)}>{selectedCategory.nome}<X aria-hidden="true" size={15} /></button> : selectedActivity ? <button type="button" onClick={() => updateCatalog({ activity: '' }, false, true)}>{selectedActivity.nome}<X aria-hidden="true" size={15} /></button> : null}
                  {filters.query && <button type="button" onClick={() => updateCatalog({ query: '' }, false, true)}>Busca: “{filters.query}”<X aria-hidden="true" size={15} /></button>}
                </div>
                {results.length ? <InitiativeList initiatives={results} categories={data.categorias} onInternalNavigate={(path) => path === '/perfis' && goProfiles()} /> : <EmptyState onClear={clear} />}
          </section>
          <ContributionCallout />
        </div>
      )}
    </AppShell>
  )
}
