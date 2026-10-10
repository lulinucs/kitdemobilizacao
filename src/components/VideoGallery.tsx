import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Play, Search as SearchIcon, Share2, X } from 'lucide-react'
import { canShareFile, sharePreparedFile } from '../lib/mediaShare'
import { filterVideos, prepareVideoFile, validateVideoCatalog, VideoFileError, type VideoItem } from '../lib/videos'
import styles from '../styles/Media.module.css'

const pageSize = 24
let cachedVideos: VideoItem[] | null = null

export function VideoGallery({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [videos, setVideos] = useState<VideoItem[]>(() => cachedVideos || [])
  const [loading, setLoading] = useState(() => !cachedVideos)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(pageSize)
  const filtered = useMemo(() => filterVideos(videos, query), [videos, query])
  const selected = videos.find((item) => item.id === selectedId)

  useEffect(() => {
    if (cachedVideos) return
    const controller = new AbortController()
    fetch('/videos_kit.json', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Catálogo indisponível')
      const result = validateVideoCatalog(await response.json())
      if (result.errors.length) console.warn('Registros de vídeos ignorados:', result.errors)
      if (!result.videos.length) throw new Error('Catálogo vazio')
      if (!controller.signal.aborted) { cachedVideos = result.videos; setVideos(result.videos); setLoading(false) }
    }).catch(() => { if (!controller.signal.aborted) { setError('Não foi possível carregar os vídeos. Tente novamente mais tarde.'); setLoading(false) } })
    return () => controller.abort()
  }, [])
  useEffect(() => setVisible(pageSize), [query])

  return <section aria-label="Galeria de vídeos">
    <div className={styles.filters}><label className={styles.search}><SearchIcon size={20} aria-hidden="true" /><span className={styles.srOnly}>Buscar vídeos</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque vídeos pelo nome" /></label></div>
    {loading ? <p className={styles.count} role="status">Carregando vídeos…</p> : error ? <p className={styles.empty} role="alert">{error}</p> : <>
      <div className={styles.count} role="status">{filtered.length} {filtered.length === 1 ? 'vídeo encontrado' : 'vídeos encontrados'}</div>
      {filtered.length ? <div className={styles.grid}>{filtered.slice(0, visible).map((item) => <a key={item.id} className={styles.card} href={`/midias?aba=videos&video=${encodeURIComponent(item.id)}`} onClick={(event) => { event.preventDefault(); onSelect(item.id) }}><VideoThumbnail item={item} /><div className={styles.cardBody}><span>{item.format.toUpperCase()}{item.profile || item.author ? ` · ${item.profile || item.author}` : ''}{item.duration ? ` · ${formatDuration(item.duration)}` : ''}</span><h2>{item.title}</h2><small>Assistir vídeo <Play size={15} aria-hidden="true" /></small></div></a>)}</div> : <div className={styles.empty}><p>Nenhum vídeo encontrado.</p><button type="button" onClick={() => setQuery('')}>Limpar busca</button></div>}
      {visible < filtered.length && <button type="button" className={styles.more} onClick={() => setVisible((value) => value + pageSize)}>Mostrar mais vídeos</button>}
      {selected && <VideoViewer key={selected.id} item={selected} onClose={() => onSelect(null)} />}
      {selectedId && !selected && <p role="status" className={styles.empty}>Vídeo não encontrado no catálogo.</p>}
    </>}
  </section>
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

function VideoThumbnail({ item }: { item: VideoItem }) {
  const [failed, setFailed] = useState(false)
  return <div className={styles.thumb}>{!failed ? <img src={item.thumbnail} alt="" loading="lazy" width="320" height="240" onError={() => setFailed(true)} /> : <span className={styles.thumbMissing}>Prévia indisponível</span>}<Play className={styles.playMark} size={22} aria-hidden="true" /></div>
}

function VideoViewer({ item, onClose }: { item: VideoItem; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const dialogRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLVideoElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const fileRef = useRef<File | null>(null)
  const [playerError, setPlayerError] = useState(() => item.format.toLowerCase() === 'mov' && !document.createElement('video').canPlayType('video/quicktime'))
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'ready' | 'unsupported' | 'error'>('idle')
  const [progress, setProgress] = useState<{ received: number; total?: number } | null>(null)
  const [message, setMessage] = useState('')
  const [sharing, setSharing] = useState(false)
  const nativeShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function'

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onCloseRef.current(); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const elements = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], video[controls]')]
      if (!elements.length) return
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0].focus() }
    }
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => { controllerRef.current?.abort(); fileRef.current = null; playerRef.current?.pause(); document.body.style.overflow = priorOverflow; document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [])

  const prepare = () => {
    if (!nativeShare || shareState === 'loading') return
    const controller = new AbortController()
    controllerRef.current = controller
    setShareState('loading'); setMessage(''); setProgress(null)
    void prepareVideoFile(item, controller.signal, (received, total) => {
      if (!controller.signal.aborted) setProgress({ received, total })
    }).then((file) => {
      if (controller.signal.aborted) return
      if (canShareFile(file)) { fileRef.current = file; setShareState('ready') }
      else { fileRef.current = null; setShareState('unsupported'); setMessage('Este navegador ou aplicativo não aceita compartilhar este arquivo. Baixe o vídeo para enviá-lo pelo aplicativo desejado.') }
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setShareState('error')
      setMessage(error instanceof VideoFileError ? ({
        'not-found': 'Arquivo não encontrado no servidor.',
        network: 'Não foi possível baixar o vídeo. Verifique sua conexão.',
        cors: 'Não foi possível obter o arquivo neste navegador. O servidor pode estar bloqueando o acesso.',
        invalid: 'O servidor não enviou um arquivo de vídeo válido.',
        'too-large': 'Este vídeo é grande demais para preparar o compartilhamento no celular.',
        unsupported: 'Formato não aceito para compartilhamento.',
      })[error.code] : 'Não foi possível preparar o vídeo para compartilhar.')
    })
  }
  const share = () => {
    if (!fileRef.current || sharing) return
    const attempt = sharePreparedFile(fileRef.current)
    setSharing(true)
    void attempt.then((result) => {
      setSharing(false)
      if (result === 'cancelled' || result === 'shared') return
      setMessage(result === 'blocked' ? 'O navegador bloqueou o envio. Toque em Compartilhar novamente ou baixe o vídeo.' : 'Este arquivo não pôde ser enviado diretamente. Baixe o vídeo para compartilhar pelo aplicativo desejado.')
      if (result !== 'blocked') { fileRef.current = null; setShareState('unsupported') }
    })
  }
  const download = <a href={item.url} target="_blank" rel="noopener noreferrer"><Download size={18} aria-hidden="true" /> Baixar original</a>

  return <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="video-dialog-title" ref={dialogRef}>
    <div className={styles.dialogTop}><button ref={closeRef} type="button" onClick={onClose}><X size={20} aria-hidden="true" /> Fechar</button><span>Vídeo · {item.format.toUpperCase()}</span></div>
    <div className={styles.dialogContent}><div className={styles.viewerArea}>{playerError ? <div className={styles.empty}><p>Não foi possível reproduzir este vídeo neste navegador. O arquivo original continua disponível.</p></div> : <video ref={playerRef} src={item.url} controls playsInline preload="none" poster={item.thumbnail} onError={() => setPlayerError(true)} aria-label={item.title} />}</div>
      <div className={styles.viewerDetails}><h2 id="video-dialog-title">{item.title}</h2><p>{item.format.toUpperCase()}{item.profile || item.author ? ` · ${item.profile || item.author}` : ''}{item.duration ? ` · ${formatDuration(item.duration)}` : ''}</p>
        <div className={styles.actions}>
          {nativeShare && shareState === 'idle' && <button type="button" onClick={prepare}><Share2 size={18} aria-hidden="true" /> Preparar para compartilhar arquivo</button>}
          {shareState === 'loading' && <div className={styles.preparing} role="status">Preparando vídeo para compartilhar… {progress ? progress.total ? `${Math.round(progress.received / progress.total * 100)}%` : `${(progress.received / 1048576).toFixed(1)} MiB recebidos` : ''}<button type="button" onClick={() => { controllerRef.current?.abort(); setShareState('idle'); setProgress(null) }}>Cancelar</button></div>}
          {shareState === 'ready' && <button type="button" disabled={sharing} onClick={share}><Share2 size={18} aria-hidden="true" /> {sharing ? 'Abrindo compartilhamento…' : 'Compartilhar arquivo'}</button>}
          {(!nativeShare || shareState === 'unsupported') && <p className={styles.preparing}>Seu navegador não permite enviar este vídeo diretamente. Baixe o original para compartilhar pelo aplicativo desejado.</p>}
          {shareState === 'error' && <button type="button" onClick={prepare}>Tentar preparar novamente</button>}
          {download}
        </div>
        <p className={styles.downloadHint}>Se o vídeo abrir em outra aba, use o menu do navegador para salvar o arquivo original.</p>
        {message && <p className={styles.message} role="status">{message}</p>}
        {item.format.toLowerCase() === 'mov' && <p className={styles.quality}>A reprodução de MOV depende dos codecs aceitos pelo navegador. Se não abrir, baixe o original.</p>}
      </div></div>
  </div></div>
}
