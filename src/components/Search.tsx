import { Search as SearchIcon, X } from 'lucide-react'
import styles from '../styles/App.module.css'

interface SearchProps {
  value: string
  onChange: (value: string) => void
}

export function Search({ value, onChange }: SearchProps) {
  return (
    <label className={styles.search}>
      <SearchIcon aria-hidden="true" size={21} />
      <span className={styles.srOnly}>Buscar iniciativas</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Busque por tema, recurso ou plataforma"
        autoComplete="off"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpar busca">
          <X aria-hidden="true" size={18} />
        </button>
      )}
    </label>
  )
}
