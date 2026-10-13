import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const agendaPath = resolve(scriptDirectory, '../src/data/agenda-floripa.json')
const cachePath = resolve(scriptDirectory, 'geocoding-cache.json')
const reviewPath = resolve(scriptDirectory, 'geocoding-review.json')
const delayMs = 1100
const dryRun = process.argv.includes('--dry-run')
const refresh = process.argv.includes('--refresh')
const selectedEventIds = new Set(process.argv.filter((argument) => argument.startsWith('--event-id=')).map((argument) => argument.slice('--event-id='.length)).filter(Boolean))
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='))
const limit = limitArgument ? Number(limitArgument.split('=')[1]) : Number.POSITIVE_INFINITY

if (limitArgument && (!Number.isFinite(limit) || limit < 1)) throw new Error('Use --limit=N com um número positivo válido.')

const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
const agenda = await readJson(agendaPath)
const cache = await readJson(cachePath)
const knownEventIds = new Set(agenda.eventos.map((event) => event.id))
const unknownEventIds = [...selectedEventIds].filter((eventId) => !knownEventIds.has(eventId))
if (unknownEventIds.length) throw new Error(`IDs de evento inexistentes: ${unknownEventIds.join(', ')}`)
const reviews = []
let requestCount = 0
let updatedCount = 0
let cacheHits = 0

const stateNames = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}

function normalize(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
}

function eventQueries(event) {
  const region = [event.cidade, event.uf, 'Brasil'].filter(Boolean).join(', ')
  const candidates = [
    event.endereco && { query: [event.endereco, event.bairro, region].filter(Boolean).join(', '), precision: 'endereco' },
    (event.pontoEncontro || event.local) && { query: [event.pontoEncontro || event.local, event.bairro, region].filter(Boolean).join(', '), precision: 'local' },
  ].filter(Boolean)
  const seen = new Set()
  return candidates.filter(({ query }) => {
    const key = normalize(query)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function atomicWrite(path, value) {
  const temporary = `${path}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

async function lookup(query) {
  const key = normalize(query)
  if (!refresh && cache.entries[key]) {
    cacheHits += 1
    return cache.entries[key]
  }
  if (requestCount > 0) await wait(delayMs)
  const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '3', countrycodes: 'br' })
  if (process.env.GEOCODER_EMAIL) params.set('email', process.env.GEOCODER_EMAIL)
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'User-Agent': 'KitMobilizacaoAgendaGeocoder/1.0 (https://github.com/lulinucs/kitdemobilizacao; agenda data maintenance)',
    },
  })
  requestCount += 1
  if (!response.ok) throw new Error(`Nominatim respondeu ${response.status} para “${query}”. O cache já obtido foi preservado.`)
  const results = await response.json()
  const entry = { query, fetchedAt: new Date().toISOString(), results }
  cache.entries[key] = entry
  await atomicWrite(cachePath, cache)
  return entry
}

function radians(degrees) { return degrees * Math.PI / 180 }
function distanceBetween(first, second) {
  const latitudeDelta = radians(Number(second.lat) - Number(first.lat))
  const longitudeDelta = radians(Number(second.lon) - Number(first.lon))
  const latitude1 = radians(Number(first.lat))
  const latitude2 = radians(Number(second.lat))
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function resultMatchesRegion(result, event) {
  const address = result.address || {}
  if (address.country_code !== 'br') return false
  const isoState = address['ISO3166-2-lvl4'] || address['ISO3166-2-lvl6'] || ''
  const expectedState = stateNames[event.uf]
  const stateMatches = isoState === `BR-${event.uf}` || (expectedState && normalize(address.state || '') === normalize(expectedState))
  if (!stateMatches) return false
  if (!event.cidade) return true
  const localityValues = ['city', 'town', 'village', 'municipality', 'city_district', 'suburb', 'county']
    .map((field) => normalize(address[field] || ''))
    .filter(Boolean)
  const expectedCity = normalize(event.cidade)
  return localityValues.some((value) => value === expectedCity || value.includes(expectedCity) || expectedCity.includes(value))
}

function chooseResult(results, precision, event) {
  const regional = results.filter((result) => resultMatchesRegion(result, event))
  if (!regional.length) return { kind: 'missing' }
  const [first, second] = regional
  if (second) {
    const importanceGap = Math.abs(Number(first.importance ?? 0) - Number(second.importance ?? 0))
    const separation = distanceBetween(first, second)
    const ambiguous = precision !== 'cidade' && importanceGap < 0.08 && separation > 2
    if (ambiguous) return { kind: 'ambiguous', candidates: regional.slice(0, 3) }
  }
  const latitude = Number(first.lat)
  const longitude = Number(first.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { kind: 'missing' }
  return { kind: 'found', result: first, latitude, longitude }
}

async function migrateEvent(event) {
  if (event.modalidade === 'virtual' || (!refresh && event.coordenadas)) return
  const queries = eventQueries(event)
  if (!queries.length) {
    reviews.push({ eventId: event.id, reason: 'sem-localizacao', title: event.titulo })
    return
  }
  for (const candidate of queries) {
    const entry = await lookup(candidate.query)
    const choice = chooseResult(entry.results, candidate.precision, event)
    if (choice.kind === 'missing') continue
    if (choice.kind === 'ambiguous') {
      reviews.push({
        eventId: event.id,
        reason: 'ambiguo',
        query: candidate.query,
        candidates: choice.candidates.map((item) => ({ displayName: item.display_name, latitude: Number(item.lat), longitude: Number(item.lon) })),
      })
      return
    }
    event.coordenadas = {
      latitude: choice.latitude,
      longitude: choice.longitude,
      precisao: candidate.precision,
      rotulo: choice.result.display_name,
      provedor: 'nominatim',
      consulta: candidate.query,
      geocodificadoEm: new Date().toISOString().slice(0, 10),
    }
    updatedCount += 1
    return
  }
  reviews.push({ eventId: event.id, reason: 'nao-encontrado', queries: queries.map(({ query }) => query), title: event.titulo })
}

try {
  let processed = 0
  for (const event of agenda.eventos) {
    if (processed >= limit) break
    if (selectedEventIds.size && !selectedEventIds.has(event.id)) continue
    if (event.modalidade === 'virtual' || (!refresh && event.coordenadas)) continue
    await migrateEvent(event)
    processed += 1
    process.stdout.write(`\rProcessados ${processed} · atualizados ${updatedCount} · cache ${cacheHits} · consultas ${requestCount}`)
  }
  process.stdout.write('\n')
  const existingReviewData = await readJson(reviewPath).catch(() => ({ events: [] }))
  const finalReviewEvents = selectedEventIds.size
    ? [
        ...(existingReviewData.events || []).filter((item) => !selectedEventIds.has(item.eventId)),
        ...reviews,
      ]
    : reviews
  if (!dryRun) await atomicWrite(agendaPath, agenda)
  await atomicWrite(reviewPath, {
    generatedAt: new Date().toISOString(),
    dryRun,
    summary: selectedEventIds.size
      ? { ...existingReviewData.summary, pendingReview: finalReviewEvents.length, lastRunUpdated: updatedCount, lastRunCacheHits: cacheHits, lastRunRequests: requestCount }
      : { updated: updatedCount, cacheHits, requests: requestCount, pendingReview: finalReviewEvents.length },
    events: finalReviewEvents,
  })
  console.log(dryRun ? 'Simulação concluída; agenda não alterada.' : 'Migração concluída e agenda atualizada.')
  console.log(`Revisão: ${reviewPath}`)
} catch (error) {
  const existingReviewData = await readJson(reviewPath).catch(() => ({ events: [] }))
  const finalReviewEvents = selectedEventIds.size
    ? [
        ...(existingReviewData.events || []).filter((item) => !selectedEventIds.has(item.eventId)),
        ...reviews,
      ]
    : reviews
  await atomicWrite(reviewPath, {
    generatedAt: new Date().toISOString(),
    interrupted: true,
    error: error instanceof Error ? error.message : String(error),
    summary: selectedEventIds.size
      ? { ...existingReviewData.summary, pendingReview: finalReviewEvents.length, lastRunUpdated: updatedCount, lastRunCacheHits: cacheHits, lastRunRequests: requestCount }
      : { updatedInMemory: updatedCount, cacheHits, requests: requestCount, pendingReview: finalReviewEvents.length },
    events: finalReviewEvents,
  })
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
