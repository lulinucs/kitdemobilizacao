import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download, ExternalLink, FileDown, Image as ImageIcon, Link, Printer, Search as SearchIcon, Share2, X } from 'lucide-react'
import catalog from '../data/midias.generated.json'
import { copies, createPrintPdf, downloadBlob, mediaUrl, sheetLayout, type CopyCount, type MediaItem, type Orientation } from '../lib/media'
import { canShareFile, prepareShareFile, sharePreparedFile, SharePreparationError, type PreparationError } from '../lib/mediaShare'
import styles from '../styles/Media.module.css'

const VideoGallery = lazy(() => import('./VideoGallery').then((module) => ({ default: module.VideoGallery })))

const items = catalog as MediaItem[]
const categories = [...new Map(items.map((item) => [item.category, item.categoryName])).entries()]
const pageSize = 24
type PreparedState = { key: string, status: 'preparing' | 'ready' | 'unsupported' | 'failed', file?: File, reason?: PreparationError | 'browser' | 'incompatible' }

interface Props {
  selectedId: string | null
  onSelect: (id: string | null) => void
  onInitiatives: () => void
  tab: 'images' | 'videos'
  onTabChange: (tab: 'images' | 'videos') => void
  selectedVideoId: string | null
  onSelectVideo: (id: string | null) => void
}

export function MediaPage({ selectedId, onSelect, onInitiatives, tab, onTabChange, selectedVideoId, onSelectVideo }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [format, setFormat] = useState('')
  const [visible, setVisible] = useState(pageSize)
  const selected = items.find((item) => item.id === selectedId) || null
  const filtered = useMemo(() => items.filter((item) => (!category || item.category === category) && (!format || (format === 'pdf' ? item.mime === 'application/pdf' : item.mime !== 'application/pdf')) && (!query || `${item.title} ${item.originalName}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')))), [query, category, format])
  useEffect(() => setVisible(pageSize), [query, category, format])
  return <div className={styles.page}>
    <header className={styles.hero}>
      <p className={styles.kicker}>ACERVO DO KIT</p>
      <h1>Mídias para compartilhar</h1>
      <p>Reunimos aqui uma seleção de materiais disponíveis nos drives de iniciativas que já divulgamos no Kit de Mobilização. Como navegar por pastas enormes nem sempre é fácil, organizamos tudo em uma galeria para você encontrar, visualizar, compartilhar e imprimir com muito mais praticidade.</p>
      <button className={styles.textLink} type="button" onClick={onInitiatives}>Conheça as iniciativas e seus drives <ExternalLink size={16} aria-hidden="true" /></button>
    </header>
    <nav className={styles.mediaTabs} aria-label="Tipos de mídia"><a href="/midias" className={tab === 'images' ? styles.selectedTab : ''} aria-current={tab === 'images' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); onTabChange('images') }}>Imagens</a><a href="/midias?aba=videos" className={tab === 'videos' ? styles.selectedTab : ''} aria-current={tab === 'videos' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); onTabChange('videos') }}>Vídeos</a></nav>
    {tab === 'videos' ? <Suspense fallback={<p className={styles.count} role="status">Carregando vídeos…</p>}><VideoGallery selectedId={selectedVideoId} onSelect={onSelectVideo} /></Suspense> : <>
    <section className={styles.filters} aria-label="Buscar e filtrar mídias">
      <label className={styles.search}><SearchIcon size={20} aria-hidden="true" /><span className={styles.srOnly}>Buscar pelo nome</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque pelo nome do material" type="search" /></label>
      <div className={styles.filterGroup} aria-label="Categorias"><button type="button" className={!category ? styles.active : ''} aria-pressed={!category} onClick={() => setCategory('')}>Todos</button>{categories.map(([id, name]) => <button type="button" key={id} className={category === id ? styles.active : ''} aria-pressed={category === id} onClick={() => setCategory(id)}>{name}</button>)}</div>
      <div className={styles.filterGroup} aria-label="Formatos"><button type="button" className={!format ? styles.active : ''} aria-pressed={!format} onClick={() => setFormat('')}>Todos os formatos</button><button type="button" className={format === 'image' ? styles.active : ''} aria-pressed={format === 'image'} onClick={() => setFormat('image')}>Imagens</button><button type="button" className={format === 'pdf' ? styles.active : ''} aria-pressed={format === 'pdf'} onClick={() => setFormat('pdf')}>PDFs</button></div>
    </section>
    <div className={styles.count} role="status">{filtered.length} {filtered.length === 1 ? 'material encontrado' : 'materiais encontrados'}</div>
    {filtered.length ? <div className={styles.grid}>{filtered.slice(0, visible).map((item) => <a key={item.id} className={styles.card} href={`/midias?midia=${encodeURIComponent(item.id)}`} onClick={(event) => { event.preventDefault(); onSelect(item.id) }}><div className={styles.thumb}><img src={item.thumbnail} alt="" loading="lazy" width={item.width} height={item.height} />{item.mime === 'application/pdf' && <span className={styles.pdfBadge}>PDF{item.pages && item.pages > 1 ? ` · ${item.pages} pág.` : ''}</span>}</div><div className={styles.cardBody}><span>{item.categoryName}</span><h2>{item.title}</h2><small>Abrir material <ChevronRight size={15} aria-hidden="true" /></small></div></a>)}</div> : <div className={styles.empty}><ImageIcon aria-hidden="true" /><p>Nenhum material encontrado. Tente outra busca ou filtro.</p><button type="button" onClick={() => { setQuery(''); setCategory(''); setFormat('') }}>Limpar filtros</button></div>}
    {visible < filtered.length && <button type="button" className={styles.more} onClick={() => setVisible((value) => value + pageSize)}>Mostrar mais materiais</button>}
    {selected && <MediaViewer item={selected} items={filtered} onSelect={onSelect} />}
    </>}
  </div>
}

function MediaViewer({ item, items: visibleItems, onSelect }: { item: MediaItem, items: MediaItem[], onSelect: (id: string | null) => void }) {
  const [mode, setMode] = useState<'view' | 'print'>('view')
  const [count, setCount] = useState<CopyCount>(1)
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [margin, setMargin] = useState(8)
  const [gap, setGap] = useState(3)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pdfPreview, setPdfPreview] = useState<{ url: string, ratio: number, page: number } | null>(null)
  const [prepared, setPrepared] = useState<PreparedState>({ key: '', status: 'preparing' })
  const [shareBusy, setShareBusy] = useState(false)
  const [shareRetry, setShareRetry] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const index = visibleItems.findIndex((entry) => entry.id === item.id)
  const ratio = item.mime === 'application/pdf' && page > 1 && pdfPreview?.page === page ? pdfPreview.ratio : item.width / item.height
  const layout = sheetLayout(count, orientation, ratio, margin, gap)
  const dpi = item.mime === 'application/pdf' ? null : Math.round(Math.min(item.width / (layout.artWidth / 25.4), item.height / (layout.artHeight / 25.4)))
  const shareKey = `${item.id}:${item.mime === 'application/pdf' ? page : 1}`
  const activeShareKey = useRef(shareKey)
  activeShareKey.current = shareKey
  const currentPreparation = prepared.key === shareKey ? prepared : { key: shareKey, status: 'preparing' as const }
  useEffect(() => { closeRef.current?.focus() }, [item.id])
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => previous?.focus()
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onSelect(null); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select')]
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous }
  }, [onSelect])
  useEffect(() => { setMode('view'); setPage(1); setMessage('') }, [item.id])
  useEffect(() => {
    const key = `${item.id}:${item.mime === 'application/pdf' ? page : 1}`
    const controller = new AbortController()
    setShareBusy(false)
    setMessage('')
    setPrepared({ key, status: 'preparing' })
    // Para imagens, não transfira um original grande se o navegador sequer expõe compartilhamento de arquivos.
    if (item.mime !== 'application/pdf' && (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function')) {
      setPrepared({ key, status: 'unsupported', reason: 'browser' })
      return () => controller.abort()
    }
    void prepareShareFile(item, page, controller.signal).then((file) => {
      if (controller.signal.aborted) return
      setPrepared(canShareFile(file) ? { key, status: 'ready', file } : { key, status: 'unsupported', file, reason: typeof navigator.share === 'function' && typeof navigator.canShare === 'function' ? 'incompatible' : 'browser' })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setPrepared({ key, status: 'failed', reason: error instanceof SharePreparationError ? error.code : 'network' })
    })
    return () => controller.abort()
  }, [item, page, shareRetry])
  useEffect(() => {
    if (item.mime !== 'application/pdf' || page === 1 || mode !== 'print') { setPdfPreview(null); return }
    let cancelled = false
    let task: { destroy: () => Promise<void> } | undefined
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const response = await fetch(item.path)
        if (!response.ok) throw new Error('PDF indisponível')
        const loading = pdfjs.getDocument({ data: await response.arrayBuffer() })
        task = loading
        const document = await loading.promise
        const selectedPage = await document.getPage(page)
        const viewport = selectedPage.getViewport({ scale: 1 })
        const canvas = window.document.createElement('canvas')
        const scale = Math.min(900 / viewport.width, 900 / viewport.height)
        const sized = selectedPage.getViewport({ scale })
        canvas.width = Math.ceil(sized.width); canvas.height = Math.ceil(sized.height)
        await selectedPage.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: sized }).promise
        if (!cancelled) setPdfPreview({ url: canvas.toDataURL('image/webp', .75), ratio: viewport.width / viewport.height, page })
      } catch { if (!cancelled) setMessage('Não foi possível visualizar esta página. O PDF original continua disponível.') }
    })()
    return () => { cancelled = true; void task?.destroy() }
  }, [item.id, item.mime, item.path, mode, page])
  const filename = `kit-${item.id}-${count}por-folha-a4.pdf`
  const create = async (print: boolean) => {
    const popup = print ? window.open('', '_blank') : null
    if (popup) popup.document.body.textContent = 'Preparando impressão…'
    setBusy(true); setMessage('')
    try {
      const result = await createPrintPdf(item, page - 1, count, orientation, margin, gap)
      const blob = new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' })
      if (print) {
        if (popup) {
          const url = URL.createObjectURL(blob)
          popup.addEventListener('load', () => popup.print(), { once: true })
          popup.location.href = url
          window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
        } else setMessage('O navegador bloqueou a janela. Use “Baixar PDF A4” para imprimir o arquivo.')
      } else downloadBlob(blob, filename)
    } catch (error) { popup?.close(); setMessage(error instanceof Error ? error.message : 'Não foi possível preparar a folha.') }
    finally { setBusy(false) }
  }
  const share = () => {
    if (currentPreparation.status !== 'ready' || !currentPreparation.file || shareBusy) return
    setMessage('')
    const attempt = sharePreparedFile(currentPreparation.file)
    setShareBusy(true)
    void attempt.then((result) => {
      if (activeShareKey.current !== shareKey) return
      setShareBusy(false)
      if (result === 'blocked') setMessage('O navegador bloqueou o envio. Baixe a mídia e compartilhe pelo aplicativo desejado.')
      if (result === 'invalid') setMessage('O aplicativo ou navegador não aceitou o formato ou tamanho. Baixe a mídia para compartilhar.')
      if (result === 'error') setMessage('O envio não foi concluído. Baixe a mídia para compartilhar pelo aplicativo desejado.')
      if (result === 'unsupported') setMessage('Este navegador não permite enviar este arquivo diretamente. Baixe a mídia para compartilhar.')
      if (result !== 'shared' && result !== 'cancelled') setPrepared({ key: shareKey, status: 'unsupported', file: currentPreparation.file, reason: 'incompatible' })
    })
  }
  const preparationMessage = currentPreparation.reason === 'not-found' ? 'Arquivo não encontrado.'
    : currentPreparation.reason === 'network' ? 'Não foi possível carregar a mídia. Verifique sua conexão.'
    : currentPreparation.reason === 'invalid-file' ? 'O arquivo recebido não corresponde ao formato esperado.'
    : currentPreparation.reason === 'too-large' ? 'Este arquivo é grande demais para preparar o compartilhamento.'
    : currentPreparation.reason === 'pdf-render' ? 'Não foi possível preparar esta página como imagem.'
    : currentPreparation.reason === 'incompatible' ? 'Este navegador não aceita enviar este arquivo diretamente. Baixe a mídia para compartilhar pelo aplicativo desejado.'
    : 'Seu navegador não permite enviar arquivos diretamente. Baixe a mídia para compartilhar pelo aplicativo desejado.'
  const copyLink = async () => { try { await navigator.clipboard.writeText(mediaUrl(item.id)); setMessage('Link copiado.') } catch { setMessage('Não foi possível copiar. Use o endereço desta página.') } }
  return <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) onSelect(null) }}><div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="media-dialog-title" ref={dialogRef}>
    <div className={styles.dialogTop}><button ref={closeRef} type="button" onClick={() => onSelect(null)}><X size={20} aria-hidden="true" /> Fechar</button><span>{item.categoryName}</span></div>
    <div className={styles.dialogContent}><div className={styles.viewerArea}>
      {mode === 'view' ? item.mime === 'application/pdf' ? <iframe src={`${item.path}#page=${page}`} title={`Visualização de ${item.title}`} /> : <img src={item.path} alt={item.title} /> : item.mime === 'application/pdf' && page > 1 && pdfPreview?.page !== page ? <p role="status">Preparando prévia da página…</p> : <div className={`${styles.sheet} ${orientation === 'landscape' ? styles.landscape : ''}`} style={{ aspectRatio: `${layout.sheetWidth} / ${layout.sheetHeight}`, padding: `${margin / layout.sheetWidth * 100}%` }}><div className={styles.sheetGrid} style={{ gridTemplateColumns: `repeat(${layout.columns}, 1fr)`, gridTemplateRows: `repeat(${layout.rows}, 1fr)`, columnGap: `${gap / layout.sheetWidth * 100}%`, rowGap: `${gap / layout.sheetHeight * 100}%` }}>{Array.from({ length: count }, (_, index) => <div className={styles.sheetCell} key={index}><img src={pdfPreview && page > 1 ? pdfPreview.url : item.thumbnail} alt="" /></div>)}</div></div>}
      {mode === 'view' && index >= 0 && visibleItems.length > 1 && <div className={styles.navigation}><button type="button" disabled={index === 0} onClick={() => onSelect(visibleItems[index - 1].id)} aria-label="Material anterior"><ChevronLeft /></button><span>{index + 1} de {visibleItems.length}</span><button type="button" disabled={index === visibleItems.length - 1} onClick={() => onSelect(visibleItems[index + 1].id)} aria-label="Próximo material"><ChevronRight /></button></div>}
    </div><div className={styles.viewerDetails}><h2 id="media-dialog-title">{item.title}</h2><p>{item.categoryName} · {item.format} · {(item.bytes / 1048576).toFixed(1)} MiB{item.pages ? ` · ${item.pages} ${item.pages === 1 ? 'página' : 'páginas'}` : ''}</p>
      {mode === 'view' ? <>{item.mime === 'application/pdf' && item.pages && item.pages > 1 && <label className={styles.field}>Página para compartilhar como imagem<select value={page} onChange={(event) => setPage(Number(event.target.value))}>{Array.from({ length: item.pages }, (_, index) => <option key={index} value={index + 1}>Página {index + 1}</option>)}</select></label>}<div className={styles.actions}>
        {currentPreparation.status === 'ready' && <button type="button" disabled={shareBusy} onClick={share}><Share2 size={18} /> {shareBusy ? 'Abrindo compartilhamento…' : item.mime === 'application/pdf' ? 'Compartilhar como imagem' : 'Compartilhar imagem'}</button>}
        {currentPreparation.status === 'preparing' && <p className={styles.preparing} role="status">Preparando {item.mime === 'application/pdf' ? 'a página como imagem' : 'a imagem original'} para compartilhar…</p>}
        {currentPreparation.status === 'unsupported' && <div className={styles.shareFallback}><p>{preparationMessage}</p>{item.mime === 'application/pdf' && currentPreparation.file && <button type="button" onClick={() => downloadBlob(currentPreparation.file!, currentPreparation.file!.name)}><Download size={18} /> Baixar mídia</button>}<small>Depois de baixar, abra o arquivo no aplicativo em que deseja compartilhá-lo.</small></div>}
        {currentPreparation.status === 'failed' && <div className={styles.shareFallback}><p>{preparationMessage}</p><button type="button" onClick={() => setShareRetry((value) => value + 1)}>Tentar carregar novamente</button></div>}
        <button type="button" onClick={() => setMode('print')}><Printer size={18} /> Imprimir</button>
        {currentPreparation.reason !== 'not-found' && <a href={item.path} download={item.originalName}><Download size={18} /> {item.mime === 'application/pdf' ? 'Baixar PDF original' : currentPreparation.status === 'unsupported' ? 'Baixar mídia' : 'Baixar original'}</a>}
      </div><div className={styles.secondary}><button type="button" onClick={copyLink}><Link size={17} /> Copiar link</button>{item.mime === 'application/pdf' && <a href={item.path} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} /> Abrir PDF completo</a>}</div></> : <><button className={styles.back} type="button" onClick={() => setMode('view')}><ArrowLeft size={17} /> Voltar ao material</button>
        {item.pages && item.pages > 1 && <label className={styles.field}>Página a repetir<select value={page} onChange={(event) => setPage(Number(event.target.value))}>{Array.from({ length: item.pages }, (_, index) => <option key={index} value={index + 1}>Página {index + 1}</option>)}</select><small>Para imprimir o documento inteiro, abra o PDF completo.</small></label>}
        <fieldset className={styles.choice}><legend>Cópias por folha A4</legend><div>{copies.map((value) => <button key={value} type="button" className={count === value ? styles.active : ''} aria-pressed={count === value} onClick={() => setCount(value)}>{value}</button>)}</div></fieldset>
        <fieldset className={styles.choice}><legend>Orientação</legend><div><button type="button" className={orientation === 'portrait' ? styles.active : ''} aria-pressed={orientation === 'portrait'} onClick={() => setOrientation('portrait')}>Retrato</button><button type="button" className={orientation === 'landscape' ? styles.active : ''} aria-pressed={orientation === 'landscape'} onClick={() => setOrientation('landscape')}>Paisagem</button></div></fieldset>
        <div className={styles.printFields}><label className={styles.field}>Margens (mm)<input type="number" min="3" max="25" value={margin} onChange={(event) => setMargin(Math.max(3, Math.min(25, Number(event.target.value) || 3)))} /></label><label className={styles.field}>Espaço (mm)<input type="number" min="0" max="15" value={gap} onChange={(event) => setGap(Math.max(0, Math.min(15, Number(event.target.value) || 0)))} /></label></div>
        <p className={styles.printSummary}>{count} {count === 1 ? 'cópia' : 'cópias'} · {layout.columns} × {layout.rows} · folha A4 real</p>{dpi !== null && dpi < 150 && <p className={styles.quality}>Resolução aproximada: {dpi} DPI. A impressão pode perder nitidez.</p>}
        <div className={styles.actions}><button disabled={busy} type="button" onClick={() => void create(true)}><Printer size={18} /> Imprimir</button><button disabled={busy} type="button" onClick={() => void create(false)}><FileDown size={18} /> Baixar PDF A4</button></div>
      </>}{message && <p className={styles.message} role="status">{message.startsWith('Link copiado') && <Check size={17} />} {message}</p>}
    </div></div>
  </div></div>
}
