import { MessageCircle } from 'lucide-react'
import { WHATSAPP_SUBMISSION_URL } from '../config'
import styles from '../styles/App.module.css'

export function ContributionCallout() {
  return (
    <aside className={styles.contribution} aria-labelledby="contribution-title">
      <div>
        <p className={styles.eyebrow}>COLABORE COM O ACERVO</p>
        <h2 id="contribution-title">Conhece uma iniciativa que deveria estar aqui?</h2>
        <p>O Kit de Mobilização cresce com a colaboração de quem participa!</p>
        <p>Conhece uma ferramenta, um material ou uma iniciativa que pode ajudar outras pessoas? Sabe de algum encontro, atividade ou mobilização acontecendo na tua cidade?</p>
        <p><strong>Conta pra gente!</strong> Queremos reunir iniciativas de todo o Brasil e ajudar mais pessoas a descobrir maneiras de participar.</p>
        <p className={styles.contributionHighlight}>Sua cidade também faz parte desse mapa.</p>
      </div>
      <a href={WHATSAPP_SUBMISSION_URL} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" size={19} />Enviar pelo WhatsApp</a>
    </aside>
  )
}
