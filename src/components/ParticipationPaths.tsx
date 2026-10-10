import { CalendarDays, Images, Megaphone, UsersRound } from 'lucide-react'
import styles from '../styles/App.module.css'

interface ParticipationPathsProps {
  onAgenda: () => void
  onInitiatives: () => void
  onMedia: () => void
  onProfiles: () => void
}

export function ParticipationPaths({ onAgenda, onInitiatives, onMedia, onProfiles }: ParticipationPathsProps) {
  const paths = [
    { title: 'Agenda de mobilizações', description: 'Confira datas, horários e locais de atos e atividades.', Icon: CalendarDays, action: onAgenda },
    { title: 'Mídias para compartilhar', description: 'Encontre artes, cartazes e materiais para baixar, compartilhar ou imprimir.', Icon: Images, action: onMedia },
    { title: 'Conhecer iniciativas', description: 'Descubra projetos e ações de mobilização nas ruas e na internet.', Icon: Megaphone, action: onInitiatives },
    { title: 'Perfis para acompanhar', description: 'Conheça páginas, coletivos e organizações para seguir nas redes.', Icon: UsersRound, action: onProfiles },
  ]
  return <nav className={styles.participationPaths} aria-label="Escolha como participar">{paths.map(({ title, description, Icon, action }) => (
    <button type="button" onClick={action} key={title}><Icon aria-hidden="true" size={26} /><span><strong>{title}</strong><small>{description}</small></span></button>
  ))}</nav>
}
