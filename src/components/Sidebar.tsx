import { Menu, X } from 'lucide-react'
import type { Activity, Category } from '../types'
import { ActivityFilters } from './ActivityFilters'
import { CategoryNav } from './CategoryNav'
import styles from '../styles/App.module.css'

interface SidebarProps {
  categories: Category[]
  activities: Activity[]
  category: string
  activity: string
  open: boolean
  onCategory: (id: string) => void
  onActivity: (id: string) => void
  onClose: () => void
  onOpen: () => void
}

export function Sidebar(props: SidebarProps) {
  return (
    <>
      <button className={styles.mobileMenuButton} type="button" onClick={props.onOpen} aria-label="Abrir menu" aria-expanded={props.open}>
        <Menu aria-hidden="true" size={22} />
      </button>
      {props.open && <button className={styles.backdrop} type="button" onClick={props.onClose} aria-label="Fechar menu" />}
      <aside className={`${styles.sidebar} ${props.open ? styles.sidebarOpen : ''}`} aria-label="Navegação e filtros">
        <div className={styles.brandRow}>
          <a className={styles.brand} href="/" aria-label="Diretório de Mobilização — início">
            <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /></span>
            <span>Diretório de<br />Mobilização</span>
          </a>
          <button className={styles.closeMenu} type="button" onClick={props.onClose} aria-label="Fechar menu"><X aria-hidden="true" size={21} /></button>
        </div>
        <CategoryNav categories={props.categories} selected={props.category} onSelect={(id) => { props.onCategory(id); props.onClose() }} />
        <ActivityFilters activities={props.activities} selected={props.activity} onSelect={(id) => { props.onActivity(id); props.onClose() }} />
        <p className={styles.updated}>Atualizado em 9 out. 2026</p>
      </aside>
    </>
  )
}
