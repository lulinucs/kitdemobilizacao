export type AgendaStatus = 'divulgado' | 'confirmado' | 'cancelado' | 'alterado' | 'data_pendente' | 'encerrado'

export interface AgendaCategory {
  id: string
  nome: string
}

export interface AgendaLink {
  rotulo: string
  url: string
}

export interface AgendaSource {
  rotulo: string
  url?: string
}

export type AgendaModality = 'presencial' | 'virtual' | 'hibrida'

export interface AgendaEvent {
  id: string
  titulo: string
  mobilizacaoId?: string
  categoria: string
  data: string | null
  recorrencia?: {
    tipo: string
    texto: string
  }
  inicio: string | null
  inicioRotulo?: string
  fim: string | null
  cidade?: string
  uf?: string
  timezone?: string
  modalidade?: AgendaModality
  instituicao?: string
  campus?: string
  pontoEncontro?: string
  local?: string
  endereco?: string
  bairro?: string
  descricao: string
  informacoesAdicionais?: string
  fonte?: AgendaSource
  verificadoEm?: string
  links?: AgendaLink[]
  status: AgendaStatus
}

export interface AgendaData {
  schemaVersion: number
  titulo: string
  timezone: string
  atualizadoEm: string
  aviso: string
  categorias: AgendaCategory[]
  eventos: AgendaEvent[]
}

export interface AgendaFilters {
  query: string
  day: string
  city: string
  state: string
  category: string
  mobilization: string
  includePast: boolean
}

export type AgendaViewMode = 'timeline' | 'list'
