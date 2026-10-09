import { SearchX } from 'lucide-react'
import styles from '../styles/App.module.css'

export function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className={styles.emptyState}>
      <SearchX aria-hidden="true" size={31} />
      <h3>Nenhuma iniciativa encontrada</h3>
      <p>Tente outro termo ou remova algum filtro.</p>
      <button type="button" onClick={onClear}>Limpar filtros</button>
    </div>
  )
}
