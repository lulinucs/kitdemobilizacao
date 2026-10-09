import { BookOpen, LayoutGrid, Printer, Smartphone, Users } from 'lucide-react'
import type { Category } from '../types'
import styles from '../styles/App.module.css'

const icons = { smartphone: Smartphone, users: Users, printer: Printer, 'book-open': BookOpen }

interface CategoryNavProps {
  categories: Category[]
  selected: string
  onSelect: (id: string) => void
}

export function CategoryNav({ categories, selected, onSelect }: CategoryNavProps) {
  return (
    <nav aria-label="Categorias" className={styles.categoryNav}>
      <p className={styles.navLabel}>Categorias</p>
      <button className={!selected ? styles.navActive : ''} type="button" onClick={() => onSelect('')}>
        <LayoutGrid aria-hidden="true" size={18} /> Todas
      </button>
      {categories.map((category) => {
        const Icon = icons[category.icone as keyof typeof icons] ?? LayoutGrid
        return (
          <button className={selected === category.id ? styles.navActive : ''} type="button" key={category.id} onClick={() => onSelect(category.id)}>
            <Icon aria-hidden="true" size={18} /> {category.nome}
          </button>
        )
      })}
    </nav>
  )
}
