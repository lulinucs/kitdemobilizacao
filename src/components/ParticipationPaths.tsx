import { CalendarDays, Printer, Smartphone, UsersRound } from 'lucide-react'
import styles from '../styles/App.module.css'

interface ParticipationPathsProps {
  onAgenda: () => void
  onCategory: (category: string) => void
  onMedia: () => void
  onProfiles: () => void
}

export function ParticipationPaths({ onAgenda, onCategory, onMedia, onProfiles }: ParticipationPathsProps) {
  const paths = [
    { title: 'Ver atos e atividades', description: 'Encontre datas, horários e locais de mobilizações.', Icon: CalendarDays, action: onAgenda },
    { title: 'Baixar e imprimir materiais', description: 'Explore artes, cartazes e materiais prontos para compartilhar ou imprimir.', Icon: Printer, action: onMedia },
    { title: 'Participar pela internet', description: 'Conheça iniciativas, ferramentas e ações digitais.', Icon: Smartphone, action: () => onCategory('nas-redes') },
    { title: 'Encontrar perfis', description: 'Descubra páginas e organizações para acompanhar.', Icon: UsersRound, action: onProfiles },
  ]
  return <nav className={styles.participationPaths} aria-label="Escolha como participar">{paths.map(({ title, description, Icon, action }) => (
    <button type="button" onClick={action} key={title}><Icon aria-hidden="true" size={26} /><span><strong>{title}</strong><small>{description}</small></span></button>
  ))}</nav>
}
