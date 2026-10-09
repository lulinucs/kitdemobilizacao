import { useMemo, useState } from 'react'
import { ArrowLeft, AtSign, ExternalLink, Search, UsersRound } from 'lucide-react'
import type { FollowProfile, ProfileGroup, ProfilesData } from '../types'
import { filterProfiles, getPopulatedGroups, groupProfiles } from '../lib/profiles'
import styles from '../styles/App.module.css'

interface ProfilesPageProps {
  data: ProfilesData
  onBack: () => void
}

function ProfileCard({ profile, group, headingLevel, showGroup }: { profile: FollowProfile; group: ProfileGroup; headingLevel: 2 | 3; showGroup: boolean }) {
  return (
    <article className={styles.profileCard}>
      <div className={styles.profileContent}>
        <header>
          {headingLevel === 2 ? <h2>{profile.nome}</h2> : <h3>{profile.nome}</h3>}
          <p className={styles.profileHandle}><AtSign aria-hidden="true" size={14} />{profile.usuario}</p>
        </header>
        {showGroup && <p className={styles.profileGroup}>{group.nome}</p>}
        {profile.descricao && <p className={styles.profileDescription}>{profile.descricao}</p>}
        {profile.assuntos?.length ? (
          <ul className={styles.profileTags} aria-label="Assuntos">
            {profile.assuntos.map((subject) => <li key={subject}>{subject}</li>)}
          </ul>
        ) : null}
        <a href={profile.url} target="_blank" rel="noopener noreferrer">Ver no Instagram<ExternalLink aria-hidden="true" size={14} /></a>
      </div>
    </article>
  )
}

export function ProfilesPage({ data, onBack }: ProfilesPageProps) {
  const [query, setQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const availableGroups = useMemo(() => getPopulatedGroups(data), [data])
  const results = useMemo(() => filterProfiles(data.perfis, query, selectedGroup), [data.perfis, query, selectedGroup])
  const sections = useMemo(() => groupProfiles(data, results), [data, results])
  const groupById = useMemo(() => new Map(data.grupos.map((group) => [group.id, group])), [data.grupos])

  const clearFilters = () => {
    setQuery('')
    setSelectedGroup('')
  }

  return (
    <div className={styles.profilesPage}>
      <button className={styles.backToCatalog} type="button" onClick={onBack}><ArrowLeft aria-hidden="true" size={18} />Voltar ao catálogo</button>

      <header className={styles.profilesHero}>
        <p className={styles.eyebrow}>NAS REDES</p>
        <h1>{data.titulo}</h1>
        <p>{data.descricao}</p>
      </header>

      <aside className={styles.profilesGuidance} aria-label={data.orientacao.titulo}>
        <UsersRound aria-hidden="true" size={21} />
        <div><strong>{data.orientacao.titulo}</strong><p>{data.orientacao.texto}</p></div>
      </aside>

      <div className={styles.profilesControls}>
        <label className={styles.profilesSearch}>
          <Search aria-hidden="true" size={20} />
          <span className={styles.srOnly}>Buscar perfis</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, @usuário ou assunto" type="search" />
        </label>
        <div className={styles.profileGroupFilters} aria-label="Filtrar perfis por grupo">
          <button className={!selectedGroup ? styles.profileGroupActive : ''} type="button" aria-pressed={!selectedGroup} onClick={() => setSelectedGroup('')}>Todos</button>
          {availableGroups.map((group) => (
            <button className={selectedGroup === group.id ? styles.profileGroupActive : ''} type="button" aria-pressed={selectedGroup === group.id} onClick={() => setSelectedGroup(group.id)} key={group.id}>
              {group.rotuloFiltro ?? group.nome}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.profilesResults} aria-live="polite">
        <p><strong>{results.length}</strong> {results.length === 1 ? 'perfil encontrado' : 'perfis encontrados'}</p>
        {results.length ? (
          selectedGroup ? (
            <div className={styles.profileGrid}>
              {results.map((profile) => <ProfileCard profile={profile} group={groupById.get(profile.grupo)!} headingLevel={2} showGroup key={profile.id} />)}
            </div>
          ) : (
            <div className={styles.profileSections}>
              {sections.map((section) => (
                <section className={styles.profileSection} aria-labelledby={`grupo-${section.group.id}`} key={section.group.id}>
                  <div className={styles.profileSectionHeading}>
                    <h2 id={`grupo-${section.group.id}`}>{section.group.nome}</h2>
                    <span>{section.profiles.length}</span>
                  </div>
                  <div className={styles.profileGrid}>
                    {section.profiles.map((profile) => <ProfileCard profile={profile} group={section.group} headingLevel={3} showGroup={false} key={profile.id} />)}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : (
          <div className={styles.profilesEmpty}>
            <p>Nenhum perfil encontrado com os filtros atuais.</p>
            <button type="button" onClick={clearFilters}>Limpar filtros</button>
          </div>
        )}
      </div>
    </div>
  )
}
