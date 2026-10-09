import type { ReactNode } from 'react'
import styles from '../styles/App.module.css'

interface AppShellProps {
  sidebar: ReactNode
  header: ReactNode
  children: ReactNode
  footer: ReactNode
}

export function AppShell({ sidebar, header, children, footer }: AppShellProps) {
  return (
    <div className={styles.shell}>
      {sidebar}
      <div className={styles.page}>
        {header}
        <main className={styles.main} id="conteudo">{children}</main>
        {footer}
      </div>
    </div>
  )
}
