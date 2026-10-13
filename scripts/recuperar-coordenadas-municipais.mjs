import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const agendaPath = resolve(scriptDirectory, '../src/data/agenda-floripa.json')
const cachePath = resolve(scriptDirectory, 'geocoding-cache.json')
const reviewPath = resolve(scriptDirectory, 'geocoding-review.json')
const indexPath = resolve(scriptDirectory, 'municipality-coordinates.json')
const fetchMissing = process.argv.includes('--fetch-missing')
const delayMs = 1100

const stateNames = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}

const readJson = async (path, fallback) => JSON.parse((await readFile(path, 'utf8').catch(() => JSON.stringify(fallback))).replace(/^\uFEFF/, ''))
const atomicWrite = async (path, value) => {
  const temporary = `${path}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}
const normalize = (value = '') => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
const normalizePlace = (value = '') => normalize(value).replace(/[^a-z0-9]+/g, ' ').split(' ').filter((word) => !['de', 'da', 'do', 'das', 'dos'].includes(word)).join(' ')
const municipalityKey = (city, state) => `${normalizePlace(city)}|${state}`
const coordinateKey = (latitude, longitude) => `${Number(latitude).toFixed(7)}|${Number(longitude).toFixed(7)}`
const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

const agenda = await readJson(agendaPath, { eventos: [] })
const cache = await readJson(cachePath, { entries: {} })
const review = await readJson(reviewPath, { events: [] })
const municipalityIndex = await readJson(indexPath, { schemaVersion: 1, entries: {} })
const eventById = new Map(agenda.eventos.map((event) => [event.id, event]))
const cachedResultsByCoordinate = new Map()
for (const entry of Object.values(cache.entries)) {
  for (const result of entry.results || []) {
    const key = coordinateKey(result.lat, result.lon)
    if (!cachedResultsByCoordinate.has(key)) cachedResultsByCoordinate.set(key, [])
    cachedResultsByCoordinate.get(key).push(result)
  }
}

function resultMatchesMunicipality(result, city, state) {
  const address = result.address || {}
  if (address.country_code !== 'br') return false
  const isoState = address['ISO3166-2-lvl4'] || address['ISO3166-2-lvl6'] || ''
  const expectedState = stateNames[state]
  if (isoState !== `BR-${state}` && normalize(address.state || '') !== normalize(expectedState || '')) return false
  const expectedCity = normalizePlace(city)
  const localities = ['city', 'town', 'village', 'municipality', 'city_district', 'county']
    .map((field) => normalizePlace(address[field] || ''))
    .filter(Boolean)
  return localities.some((locality) => locality === expectedCity || locality.includes(expectedCity) || expectedCity.includes(locality))
}

function addIndexEntry(city, state, result, source, query) {
  const key = municipalityKey(city, state)
  if (municipalityIndex.entries[key]) return false
  municipalityIndex.entries[key] = {
    cidade: city,
    uf: state,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    rotulo: result.display_name,
    consulta: query,
    fonte: source,
  }
  return true
}

let recoveredFromHistory = 0
for (const item of review.events || []) {
  if (!item.previousCoordinates) continue
  const event = eventById.get(item.eventId)
  if (!event?.cidade || !event.uf) continue
  const results = cachedResultsByCoordinate.get(coordinateKey(item.previousCoordinates.latitude, item.previousCoordinates.longitude)) || []
  const result = results.find((candidate) => resultMatchesMunicipality(candidate, event.cidade, event.uf))
  if (result && addIndexEntry(event.cidade, event.uf, result, 'historico-cache', `${event.cidade}, ${event.uf}, Brasil`)) recoveredFromHistory += 1
}

const uncertainMunicipalityIds = new Set([
  'rel-2026-10-13-apucaran-praca-do-redondo-8828f9b1',
  'txt-2026-10-13-riacho-dantas-abee1c335e',
])
const missingMunicipalities = new Map()
for (const event of agenda.eventos) {
  if (event.modalidade === 'virtual' || event.coordenadas || !event.cidade || !event.uf || uncertainMunicipalityIds.has(event.id)) continue
  const key = municipalityKey(event.cidade, event.uf)
  if (!municipalityIndex.entries[key]) missingMunicipalities.set(key, { cidade: event.cidade, uf: event.uf })
}

let cacheHits = 0
let externalRequests = 0
for (const municipality of missingMunicipalities.values()) {
  const query = `${municipality.cidade}, ${stateNames[municipality.uf] || municipality.uf}, Brasil`
  const cacheKey = normalize(query)
  let entry = cache.entries[cacheKey]
  if (entry) cacheHits += 1
  if (!entry && fetchMissing) {
    if (externalRequests > 0) await wait(delayMs)
    const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '3', countrycodes: 'br' })
    if (process.env.GEOCODER_EMAIL) params.set('email', process.env.GEOCODER_EMAIL)
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'KitMobilizacaoAgendaGeocoder/1.0 (https://github.com/lulinucs/kitdemobilizacao; municipality index maintenance)',
      },
    })
    externalRequests += 1
    if (!response.ok) throw new Error(`Nominatim respondeu ${response.status} para “${query}”.`)
    entry = { query, fetchedAt: new Date().toISOString(), results: await response.json() }
    cache.entries[cacheKey] = entry
    await atomicWrite(cachePath, cache)
  }
  const result = entry?.results?.find((candidate) => resultMatchesMunicipality(candidate, municipality.cidade, municipality.uf))
  if (result) addIndexEntry(municipality.cidade, municipality.uf, result, entry ? 'cache-municipio' : 'nominatim-municipio', query)
}

let coordinatesRecovered = 0
const today = new Date().toISOString().slice(0, 10)
for (const event of agenda.eventos) {
  if (event.modalidade === 'virtual' || event.coordenadas || !event.cidade || !event.uf || uncertainMunicipalityIds.has(event.id)) continue
  const municipality = municipalityIndex.entries[municipalityKey(event.cidade, event.uf)]
  if (!municipality) continue
  event.coordenadas = {
    latitude: municipality.latitude,
    longitude: municipality.longitude,
    precisao: 'cidade',
    rotulo: `Localização aproximada em ${event.cidade}/${event.uf} — coordenada representativa do município`,
    provedor: 'nominatim',
    consulta: municipality.consulta,
    geocodificadoEm: today,
  }
  coordinatesRecovered += 1
}

const pendingEvents = agenda.eventos
  .filter((event) => event.modalidade !== 'virtual' && !event.coordenadas)
  .map((event) => {
    const existing = (review.events || []).find((item) => item.eventId === event.id)
    return {
      eventId: event.id,
      reason: uncertainMunicipalityIds.has(event.id) ? 'municipio-uf-inconsistentes' : existing?.reason || 'municipio-nao-informado',
      title: event.titulo,
      location: [event.local || event.pontoEncontro || event.endereco, event.cidade, event.uf].filter(Boolean).join(', '),
    }
  })

municipalityIndex.schemaVersion = 1
municipalityIndex.generatedAt = new Date().toISOString()
municipalityIndex.summary = {
  municipalities: Object.keys(municipalityIndex.entries).length,
  recoveredFromHistory,
  cacheHits,
  externalRequests,
  coordinatesRecovered,
}
await atomicWrite(indexPath, municipalityIndex)
await atomicWrite(agendaPath, agenda)
await atomicWrite(reviewPath, {
  generatedAt: new Date().toISOString(),
  dryRun: false,
  summary: { pendingReview: pendingEvents.length, municipalityRecoveryRequests: externalRequests },
  events: pendingEvents,
})

console.log(JSON.stringify({ ...municipalityIndex.summary, pendingReview: pendingEvents.length }, null, 2))
