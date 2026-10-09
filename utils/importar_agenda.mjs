#!/usr/bin/env node

import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const UFS = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'])
const STATUSES = new Set(['divulgado', 'confirmado', 'cancelado', 'alterado', 'data_pendente', 'encerrado'])
const MODALIDADES = new Set(['presencial', 'virtual', 'hibrida'])
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function usage() {
  console.log('Uso: node utils/importar_agenda.mjs <eventos.json> [--dry-run | --write]')
}

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function duplicateKey(event) {
  if (!event.data || (!event.instituicao && !event.cidade)) return null
  return [event.data, event.inicio ?? 'sem-horario', event.instituicao, event.campus, event.cidade, event.uf].map(normalize).join('|')
}

function validateEvent(event, index, categoryIds) {
  const errors = []
  const label = event?.id || `registro ${index + 1}`
  if (!event || typeof event !== 'object' || Array.isArray(event)) return [`Registro ${index + 1} não é um objeto.`]
  if (!event.id || typeof event.id !== 'string') errors.push(`${label}: id obrigatório.`)
  if (!event.titulo || typeof event.titulo !== 'string') errors.push(`${label}: título obrigatório.`)
  if (!categoryIds.has(event.categoria)) errors.push(`${label}: categoria inválida.`)
  if (event.data !== null && !validDate(event.data)) errors.push(`${label}: data inválida; use AAAA-MM-DD ou null.`)
  if (event.data === null && event.status !== 'data_pendente') errors.push(`${label}: data null exige status data_pendente.`)
  if (event.inicio !== null && !TIME_PATTERN.test(event.inicio)) errors.push(`${label}: início inválido; use HH:MM ou null.`)
  if (event.fim !== null && event.fim !== undefined && !TIME_PATTERN.test(event.fim)) errors.push(`${label}: término inválido; use HH:MM ou null.`)
  if (event.fim && !event.inicio) errors.push(`${label}: término informado sem início.`)
  if (event.uf !== undefined && !UFS.has(event.uf)) errors.push(`${label}: UF inválida.`)
  if (event.modalidade !== undefined && !MODALIDADES.has(event.modalidade)) errors.push(`${label}: modalidade inválida.`)
  if (!event.descricao || typeof event.descricao !== 'string') errors.push(`${label}: descrição obrigatória.`)
  if (!STATUSES.has(event.status)) errors.push(`${label}: status inválido.`)
  if (event.mobilizacaoId !== undefined && (typeof event.mobilizacaoId !== 'string' || !event.mobilizacaoId.trim())) errors.push(`${label}: mobilizacaoId inválido.`)
  if (event.destaques !== undefined && (!Array.isArray(event.destaques) || event.destaques.some((item) => typeof item !== 'string' || !item.trim()) || new Set(event.destaques).size !== event.destaques.length)) errors.push(`${label}: destaques inválidos.`)
  if (event.verificadoEm !== undefined && !validDate(event.verificadoEm)) errors.push(`${label}: verificadoEm inválido.`)
  return errors
}

const args = process.argv.slice(2)
const inputArg = args.find((arg) => !arg.startsWith('--'))
const write = args.includes('--write')
const dryRun = args.includes('--dry-run') || !write

if (!inputArg || args.includes('--help')) {
  usage()
  process.exit(inputArg ? 0 : 1)
}

const agendaPath = resolve('src/data/agenda-floripa.json')
const inputPath = resolve(inputArg)
const agenda = JSON.parse(await readFile(agendaPath, 'utf8'))
const imported = JSON.parse(await readFile(inputPath, 'utf8'))
const candidates = Array.isArray(imported) ? imported : imported.eventos

if (!Array.isArray(candidates)) throw new Error('O arquivo de entrada deve ser uma lista ou conter a propriedade "eventos".')

const categoryIds = new Set(agenda.categorias.map((category) => category.id))
const errors = candidates.flatMap((event, index) => validateEvent(event, index, categoryIds))
const warnings = []
const existingIds = new Set(agenda.eventos.map((event) => event.id))
const incomingIds = new Set()
const knownSignatures = new Map()

for (const event of agenda.eventos) {
  const key = duplicateKey(event)
  if (key) knownSignatures.set(key, event.id)
}

for (const event of candidates) {
  if (!event?.id) continue
  if (existingIds.has(event.id)) errors.push(`${event.id}: ID já existe; o registro atual não será sobrescrito.`)
  if (incomingIds.has(event.id)) errors.push(`${event.id}: ID duplicado no arquivo de entrada.`)
  incomingIds.add(event.id)

  const key = duplicateKey(event)
  const similarId = key ? knownSignatures.get(key) : null
  if (similarId) warnings.push(`${event.id}: possível duplicação de ${similarId} por data, instituição/cidade e horário.`)
  if (key && !similarId) knownSignatures.set(key, event.id)
}

console.log(`Arquivo: ${inputPath}`)
console.log(`Registros recebidos: ${candidates.length}`)
console.log(`Erros: ${errors.length}`)
errors.forEach((error) => console.log(`  ERRO: ${error}`))
console.log(`Avisos: ${warnings.length}`)
warnings.forEach((warning) => console.log(`  AVISO: ${warning}`))

if (errors.length) {
  console.log('Nenhuma alteração foi gravada.')
  process.exitCode = 1
} else if (dryRun) {
  console.log('Simulação concluída. Use --write para acrescentar os registros validados.')
} else {
  const next = {
    ...agenda,
    atualizadoEm: new Date().toISOString().slice(0, 10),
    eventos: [...agenda.eventos, ...candidates],
  }
  const temporaryPath = `${agendaPath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, agendaPath)
  console.log(`${candidates.length} registro(s) acrescentado(s) a ${agendaPath}.`)
}
