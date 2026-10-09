import { ExternalLink, Info } from 'lucide-react'
import type { Category, Initiative } from '../types'
import styles from '../styles/App.module.css'

interface InitiativeCardProps {
  initiative: Initiative
  category?: Category
}

export function InitiativeCard({ initiative, category }: InitiativeCardProps) {
  const primary = initiative.links.find((link) => link.principal) ?? initiative.links[0]
  const secondary = initiative.links.filter((link) => link !== primary)

  return (
    <article className={styles.card}>
      <div className={styles.cardMeta}>
        <span>{category?.nome ?? initiative.categoriaPrincipal}</span>
        {initiative.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <h3>{initiative.nome}</h3>
      <p className={styles.description}>{initiative.descricao}</p>
      {initiative.verificacao.observacao && (
        <details className={styles.note}>
          <summary><Info aria-hidden="true" size={15} /> Informação a confirmar</summary>
          <p>{initiative.verificacao.observacao}</p>
        </details>
      )}
      <div className={styles.cardActions}>
        <a className={styles.primaryLink} href={primary.url} target="_blank" rel="noopener noreferrer">
          {primary.rotulo}<ExternalLink aria-hidden="true" size={17} />
        </a>
        {secondary.map((link) => (
          <a className={styles.secondaryLink} href={link.url} target="_blank" rel="noopener noreferrer" key={link.url}>
            {link.rotulo}<ExternalLink aria-hidden="true" size={14} />
          </a>
        ))}
      </div>
    </article>
  )
}
