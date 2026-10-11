import type { MouseEvent } from 'react'
import { ArrowRight, AtSign, Code2, ExternalLink, Folder, Globe2, HardDrive, MessageCircle, Play, Radio, Send, UserRound, UsersRound, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Category, Initiative } from '../types'
import { getInitiativeLinkPresentation, type InitiativeLinkPresentation } from '../lib/initiativeLinks'
import styles from '../styles/App.module.css'

interface InitiativeCardProps {
  initiative: Initiative
  category?: Category
  onInternalNavigate?: (path: string) => void
}

const platformIcons: Partial<Record<InitiativeLinkPresentation['platform'], LucideIcon>> = {
  whatsapp: MessageCircle, telegram: Send, 'google-drive': HardDrive,
  instagram: AtSign, youtube: Play, github: Code2,
}
const kindIcons = { group: UsersRound, channel: Radio, folder: Folder, profile: UserRound, video: Video, site: Globe2 }

function InitiativeLinkIcon({ presentation }: { presentation: InitiativeLinkPresentation }) {
  const Icon = platformIcons[presentation.platform] ?? kindIcons[presentation.kind]
  return <span className={styles.initiativeLinkIcon} data-platform={presentation.platform}><Icon aria-hidden="true" /></span>
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
      <div className={styles.initiativeLinks}>
        {[primary, ...secondary].map((link) => {
          const presentation = getInitiativeLinkPresentation(link)
          const internal = link.url.startsWith('/')
          return <a className={`${styles.initiativeLink} ${link === primary ? styles.initiativeLinkPrimary : ''}`} data-platform={presentation.platform} href={link.url} target={internal ? undefined : '_blank'} rel={internal ? undefined : 'noopener noreferrer'} onClick={(event) => internalNavigate(event, link.url)} key={link.url}>
            <InitiativeLinkIcon presentation={presentation} />
            <span className={styles.initiativeLinkText}><strong>{link.rotulo}</strong><small>{presentation.descriptor}</small></span>
            {internal ? <ArrowRight className={styles.initiativeLinkArrow} aria-hidden="true" size={17} /> : <ExternalLink className={styles.initiativeLinkArrow} aria-hidden="true" size={16} />}
            {!internal && <span className={styles.srOnly}>(abre em nova aba)</span>}
          </a>
        })}
      </div>
    </article>
  )
}
