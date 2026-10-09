import { Moon, Sun } from 'lucide-react'
import styles from '../styles/App.module.css'

interface ThemeToggleProps {
  theme: 'light' | 'dark'
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const next = theme === 'light' ? 'escuro' : 'claro'
  return (
    <button className={styles.iconButton} type="button" onClick={onToggle} aria-label={`Ativar tema ${next}`} title={`Ativar tema ${next}`}>
      {theme === 'light' ? <Moon aria-hidden="true" size={20} /> : <Sun aria-hidden="true" size={20} />}
    </button>
  )
}
