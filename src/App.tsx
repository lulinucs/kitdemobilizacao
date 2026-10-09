import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import rawData from './data/iniciativas.json'
import { ActivityFilters } from './components/ActivityFilters'
import { AppShell } from './components/AppShell'
import { EmptyState } from './components/EmptyState'
import { InitiativeList } from './components/InitiativeList'
import { Search } from './components/Search'
import { Sidebar } from './components/Sidebar'
import { ThemeToggle } from './components/ThemeToggle'
import { filterInitiatives, validateDirectory } from './lib/directory'
import type { DirectoryData, Filters } from './types'
import styles from './styles/App.module.css'

const data = rawData as DirectoryData

function readFilters(): Filters {
  const params = new URLSearchParams(window.location.search)
  return {
    query: params.get('q') ?? '',
    category: params.get('categoria') ?? '',
    activity: params.get('atividade') ?? '',
  }
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
  const results = useMemo(() => filterInitiatives(data, filters), [filters])
  const errors = useMemo(() => validateDirectory(data), [])

  useEffect(() => {
    if (import.meta.env.DEV && errors.length) console.error('Erros em iniciativas.json:', errors)
  }, [errors])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('tema', theme)
  }, [theme])

  useEffect(() => {
    const onPopState = () => setFilters(readFilters())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const update = (patch: Partial<Filters>, replace = false) => setFilters((current) => {
    const nextFilters = { ...current, ...patch }
    const params = new URLSearchParams()
    if (nextFilters.category) params.set('categoria', nextFilters.category)
    if (nextFilters.activity) params.set('atividade', nextFilters.activity)
    if (nextFilters.query) params.set('q', nextFilters.query)
    const nextUrl = `${window.location.pathname}${params.size ? `?${params}` : ''}`
    window.history[replace ? 'replaceState' : 'pushState'](nextFilters, '', nextUrl)
    return nextFilters
  })
  const clear = () => update({ query: '', category: '', activity: '' })
  const selectedCategory = data.categorias.find((item) => item.id === filters.category)
  const selectedActivity = data.atividades.find((item) => item.id === filters.activity)

  return (
    <AppShell
      sidebar={<Sidebar categories={data.categorias} activities={data.atividades} category={filters.category} activity={filters.activity} open={menuOpen} onCategory={(category) => update({ category })} onActivity={(activity) => update({ activity })} onClose={() => setMenuOpen(false)} onOpen={() => setMenuOpen(true)} />}
      header={
        <header className={styles.header}>
          <div className={styles.mobileBrand}>Diretório de Mobilização</div>
          <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
        </header>
      }
      footer={
        <footer className={styles.footer}>
          <p>Diretório independente de links de terceiros. Verifique informações e respeite a legislação eleitoral e as regras de uso dos espaços.</p>
          <p>Dados atualizados em 9 de outubro de 2026.</p>
        </footer>
      }
    >
      <section className={styles.intro} aria-labelledby="page-title">
        <p className={styles.eyebrow}>RECURSOS DE PARTICIPAÇÃO</p>
        <h1 id="page-title">Encontre uma iniciativa para participar</h1>
        <p className={styles.lead}>Busque materiais, canais, ferramentas e guias de mobilização reunidos em um só lugar.</p>
        <Search value={filters.query} onChange={(query) => update({ query }, true)} />
      </section>

      <section className={styles.quickActions} aria-labelledby="quick-title">
        <div className={styles.sectionTitleRow}>
          <div><p className={styles.eyebrow}>ATALHOS</p><h2 id="quick-title">O que você quer fazer?</h2></div>
        </div>
        <ActivityFilters activities={data.atividades.filter((item) => ['compartilhar', 'conversar', 'imprimir', 'organizar'].includes(item.id))} selected={filters.activity} onSelect={(activity) => update({ activity })} compact />
      </section>

      <section className={styles.results} aria-labelledby="results-title">
        <div className={styles.resultsHeader}>
          <div>
            <p className={styles.eyebrow}>ÍNDICE</p>
            <h2 id="results-title">{results.length} {results.length === 1 ? 'iniciativa encontrada' : 'iniciativas encontradas'}</h2>
          </div>
          {(filters.query || filters.category || filters.activity) && <button className={styles.clearButton} type="button" onClick={clear}>Limpar filtros</button>}
        </div>

        <div className={styles.activeFilters} aria-label="Filtros ativos">
          {selectedCategory && <button type="button" onClick={() => update({ category: '' })}>{selectedCategory.nome}<X aria-hidden="true" size={15} /></button>}
          {selectedActivity && <button type="button" onClick={() => update({ activity: '' })}>{selectedActivity.nome}<X aria-hidden="true" size={15} /></button>}
          {filters.query && <button type="button" onClick={() => update({ query: '' })}>Busca: “{filters.query}”<X aria-hidden="true" size={15} /></button>}
        </div>

        {results.length ? <InitiativeList initiatives={results} categories={data.categorias} /> : <EmptyState onClear={clear} />}
      </section>
    </AppShell>
  )
}
