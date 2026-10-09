import type { Category, Initiative } from '../types'
import { InitiativeCard } from './InitiativeCard'
import styles from '../styles/App.module.css'

interface InitiativeListProps {
  initiatives: Initiative[]
  categories: Category[]
}

export function InitiativeList({ initiatives, categories }: InitiativeListProps) {
  return (
    <div className={styles.cardGrid}>
      {initiatives.map((initiative) => (
        <InitiativeCard key={initiative.id} initiative={initiative} category={categories.find((category) => category.id === initiative.categoriaPrincipal)} />
      ))}
    </div>
  )
}
