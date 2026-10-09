import type { Category, Initiative } from '../types'
import { InitiativeCard } from './InitiativeCard'
import styles from '../styles/App.module.css'

interface InitiativeListProps {
  initiatives: Initiative[]
  categories: Category[]
  onInternalNavigate?: (path: string) => void
}

export function InitiativeList({ initiatives, categories, onInternalNavigate }: InitiativeListProps) {
  return (
    <div className={styles.cardGrid}>
      {initiatives.map((initiative) => (
        <InitiativeCard key={initiative.id} initiative={initiative} category={categories.find((category) => category.id === initiative.categoriaPrincipal)} onInternalNavigate={onInternalNavigate} />
      ))}
    </div>
  )
}
