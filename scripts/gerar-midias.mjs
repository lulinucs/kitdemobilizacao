import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, extname, basename, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { createCanvas } from '@napi-rs/canvas'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const root = process.cwd()
const source = join(root, 'public', 'midia')
const thumbs = join(root, 'public', 'midia-miniaturas')
const catalogFile = join(root, 'src', 'data', 'midias.generated.json')
const reportFile = join(root, '.cache', 'midias-build.json')
const maxBytes = 25 * 1024 * 1024
const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' }
const titleCase = (value) => value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\w/u, (letter) => letter.toUpperCase())
const categoryName = (name) => ({ 'GUIAS-MANUAIS': 'Guias e manuais', 'LAMBES-CARTAZES': 'Lambes e cartazes', WEB: 'Imagens para compartilhar' })[name] || titleCase(name.toLocaleLowerCase('pt-BR'))
// O servidor de arquivos do Vite procura estes caracteres literalmente no nome.
// Se ficarem como %40, %2C ou %24, o fallback da SPA entrega index.html.
const urlOf = (path) => '/' + path.split(/[\\/]/).map((segment) => encodeURIComponent(segment)
  .replace(/%40/gi, '@').replace(/%2C/gi, ',').replace(/%24/gi, '$')).join('/')
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name)
  return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : []
})

async function main() {
  if (!existsSync(source)) throw new Error('Acervo public/midia não encontrado')
  mkdirSync(thumbs, { recursive: true })
  mkdirSync(dirname(reportFile), { recursive: true })
  const catalog = []
  const excluded = []
  let generated = 0
  for (const file of files(source).sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
    const rel = relative(source, file).replaceAll('\\', '/')
    const extension = extname(file).toLowerCase()
    if (!mime[extension]) { excluded.push({ path: rel, reason: 'Formato não suportado' }); continue }
    const size = statSync(file).size
    if (size > maxBytes) { excluded.push({ path: rel, reason: 'Acima de 25 MiB do Cloudflare Pages', bytes: size }); continue }
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
    const id = createHash('sha256').update(rel).digest('hex').slice(0, 20)
    const thumbnail = join(thumbs, `${id}-${hash.slice(0, 12)}.webp`)
    let width, height, pages
    try {
      if (extension === '.pdf') {
        const bytes = new Uint8Array(readFileSync(file))
        const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true })
        const pdf = await task.promise
        pages = pdf.numPages
        const page = await pdf.getPage(1)
        const original = page.getViewport({ scale: 1 })
        width = Math.round(original.width)
        height = Math.round(original.height)
        if (!existsSync(thumbnail)) {
          const viewport = page.getViewport({ scale: Math.min(900 / original.width, 900 / original.height, 2) })
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
          await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise
          await sharp(canvas.toBuffer('image/png')).webp({ quality: 75 }).toFile(thumbnail)
          generated++
        }
        await task.destroy()
      } else {
        const metadata = await sharp(file).metadata()
        const swapped = [5, 6, 7, 8].includes(metadata.orientation)
        width = swapped ? metadata.height : metadata.width
        height = swapped ? metadata.width : metadata.height
        if (!existsSync(thumbnail)) {
          await sharp(file).rotate().resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 4 }).toFile(thumbnail)
          generated++
        }
      }
      const category = rel.split('/')[0]
      catalog.push({ id, path: urlOf(`midia/${rel}`), originalName: basename(file), title: titleCase(basename(file, extname(file))), category, categoryName: categoryName(category), mime: mime[extension], format: extension.slice(1).toUpperCase(), bytes: size, width, height, pages: pages || null, thumbnail: urlOf(`midia-miniaturas/${basename(thumbnail)}`), printable: true })
    } catch (error) {
      excluded.push({ path: rel, reason: `Falha ao processar: ${error.message}` })
    }
  }
  writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + '\n')
  const report = { cataloged: catalog.length, generated, excluded, thumbnailBytes: files(thumbs).reduce((sum, file) => sum + statSync(file).size, 0) }
  writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error); process.exitCode = 1 })
