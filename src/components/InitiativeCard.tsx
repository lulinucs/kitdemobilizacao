import type { MouseEvent } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'
import type { Category, Initiative } from '../types'
import styles from '../styles/App.module.css'

interface InitiativeCardProps {
  initiative: Initiative
  category?: Category
  onInternalNavigate?: (path: string) => void
}

export function InitiativeCard({ initiative, category, onInternalNavigate }: InitiativeCardProps) {
  const primary = initiative.links.find((link) => link.principal) ?? initiative.links[0]
  const secondary = initiative.links.filter((link) => link !== primary)
  const internalNavigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (!onInternalNavigate || !path.startsWith('/')) return
    event.preventDefault()
    onInternalNavigate(path)
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardMeta}>
        <span>{category?.nome ?? initiative.categoriaPrincipal}</span>
        {initiative.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <h3>{initiative.nome}</h3>
      <p className={styles.description}>{initiative.descricao}</p>
      <div className={styles.cardActions}>
        <a className={styles.primaryLink} href={primary.url} target={primary.url.startsWith('/') ? undefined : '_blank'} rel={primary.url.startsWith('/') ? undefined : 'noopener noreferrer'} onClick={(event) => internalNavigate(event, primary.url)}>
          {primary.rotulo}{primary.url.startsWith('/') ? <ArrowRight aria-hidden="true" size={17} /> : <ExternalLink aria-hidden="true" size={17} />}
        </a>
        {secondary.map((link) => (
          <a className={styles.secondaryLink} href={link.url} target={link.url.startsWith('/') ? undefined : '_blank'} rel={link.url.startsWith('/') ? undefined : 'noopener noreferrer'} onClick={(event) => internalNavigate(event, link.url)} key={link.url}>
            {link.rotulo}{link.url.startsWith('/') ? <ArrowRight aria-hidden="true" size={14} /> : <ExternalLink aria-hidden="true" size={14} />}
          </a>
        ))}
      </div>
    </article>
  )
}
