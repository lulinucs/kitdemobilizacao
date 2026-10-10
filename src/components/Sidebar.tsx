import { CalendarDays, Home, Images, LayoutGrid, Menu, MessageCircle, UsersRound, X } from 'lucide-react'
import { WHATSAPP_SUBMISSION_URL } from '../config'
import styles from '../styles/App.module.css'

interface SidebarProps {
  currentView: 'home' | 'agenda' | 'profiles' | 'media'
  open: boolean
  onHome: () => void
  onInitiatives: () => void
  onAgenda: () => void
  onProfiles: () => void
  onMedia: () => void
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
          <button type="button" onClick={() => { props.onInitiatives(); props.onClose() }}><LayoutGrid aria-hidden="true" size={18} />Iniciativas</button>
          <button className={props.currentView === 'media' ? styles.mainNavActive : ''} type="button" onClick={() => { props.onMedia(); props.onClose() }}><Images aria-hidden="true" size={18} />Mídias para compartilhar</button>
          <button className={props.currentView === 'profiles' ? styles.mainNavActive : ''} type="button" onClick={() => { props.onProfiles(); props.onClose() }}><UsersRound aria-hidden="true" size={18} />Perfis para acompanhar</button>
          <a href={WHATSAPP_SUBMISSION_URL} target="_blank" rel="noopener noreferrer" onClick={props.onClose}><MessageCircle aria-hidden="true" size={18} />Envie sua iniciativa</a>
        </nav>
        <p className={styles.updated}>Atualizado em 9 out. 2026</p>
      </aside>
    </>
  )
}
