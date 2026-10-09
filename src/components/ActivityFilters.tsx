import { Bell, BookOpen, CalendarDays, MessagesSquare, Printer, Share2 } from 'lucide-react'
import type { Activity } from '../types'
import styles from '../styles/App.module.css'

const icons = { 'share-2': Share2, bell: Bell, 'messages-square': MessagesSquare, printer: Printer, 'calendar-days': CalendarDays, 'book-open': BookOpen }

interface ActivityFiltersProps {
  activities: Activity[]
  selected: string
  onSelect: (id: string) => void
  compact?: boolean
}

export function ActivityFilters({ activities, selected, onSelect, compact = false }: ActivityFiltersProps) {
  return (
    <div className={compact ? styles.activityRow : styles.activityNav} aria-label="Filtrar por atividade">
      {!compact && <p className={styles.navLabel}>O que você quer fazer?</p>}
      {activities.map((activity) => {
        const Icon = icons[activity.icone as keyof typeof icons] ?? Share2
        return (
          <button className={selected === activity.id ? styles.filterActive : ''} type="button" key={activity.id} onClick={() => onSelect(selected === activity.id ? '' : activity.id)}>
            <Icon aria-hidden="true" size={17} />
            <span>{activity.nome.replace('Quero ', '')}</span>
          </button>
        )
      })}
    </div>
  )
}
