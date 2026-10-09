import { CalendarDays, Home, Menu, MessageCircle, UsersRound, X } from 'lucide-react'
import { WHATSAPP_SUBMISSION_URL } from '../config'
import type { Activity, Category } from '../types'
import { ActivityFilters } from './ActivityFilters'
import { CategoryNav } from './CategoryNav'
import styles from '../styles/App.module.css'

interface SidebarProps {
  categories: Category[]
  activities: Activity[]
  category: string
  activity: string
  currentView: 'home' | 'agenda' | 'profiles'
  open: boolean
  onCategory: (id: string) => void
  onActivity: (id: string) => void
  onHome: () => void
  onAgenda: () => void
  onProfiles: () => void
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
          <button className={styles.brandCard} type="button" onClick={props.onHome} aria-label="Kit de Mobilização — início">
            <img src="/logo.png" alt="Kit de Mobilização · Segundo Turno · Eleições 2026" className={styles.brandLogo} />
          </button>
          <button className={styles.closeMenu} type="button" onClick={props.onClose} aria-label="Fechar menu"><X aria-hidden="true" size={21} /></button>
        </div>
        <nav className={styles.mainNav} aria-label="Seções principais">
          <button className={props.currentView === 'home' ? styles.mainNavActive : ''} type="button" onClick={() => { props.onHome(); props.onClose() }}><Home aria-hidden="true" size={18} />Início</button>
          <button className={props.currentView === 'agenda' ? styles.mainNavActive : ''} type="button" onClick={() => { props.onAgenda(); props.onClose() }}><CalendarDays aria-hidden="true" size={18} />Agenda de Mobilizações</button>
          <button className={props.currentView === 'profiles' ? styles.mainNavActive : ''} type="button" onClick={() => { props.onProfiles(); props.onClose() }}><UsersRound aria-hidden="true" size={18} />Perfis para acompanhar</button>
          <a href={WHATSAPP_SUBMISSION_URL} target="_blank" rel="noopener noreferrer" onClick={props.onClose}><MessageCircle aria-hidden="true" size={18} />Envie sua iniciativa</a>
        </nav>
        <CategoryNav categories={props.categories} selected={props.category} onSelect={(id) => { props.onCategory(id); props.onClose() }} />
        <ActivityFilters activities={props.activities} selected={props.activity} onSelect={(id) => { props.onActivity(id); props.onClose() }} />
        <p className={styles.updated}>Atualizado em 9 out. 2026</p>
      </aside>
    </>
  )
}
