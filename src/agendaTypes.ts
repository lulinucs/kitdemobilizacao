export type AgendaStatus = 'divulgado' | 'confirmado' | 'cancelado' | 'alterado' | 'data_pendente' | 'encerrado'

export interface AgendaCategory {
  id: string
  nome: string
}

export interface AgendaLink {
  rotulo: string
  url: string
}

export interface AgendaEvent {
  id: string
  titulo: string
  categoria: string
  data: string | null
  recorrencia?: {
    tipo: string
    texto: string
  }
  inicio: string
  fim: string | null
  local?: string
  endereco?: string
  bairro?: string
  descricao: string
  participacao?: string
  links?: AgendaLink[]
  status: AgendaStatus
}

export interface AgendaData {
  schemaVersion: number
  titulo: string
  timezone: string
  cidade: string
  uf: string
  atualizadoEm: string
  aviso: string
  categorias: AgendaCategory[]
  eventos: AgendaEvent[]
}

export interface AgendaFilters {
  query: string
  day: string
  neighborhood: string
  category: string
  includePast: boolean
}

export type AgendaViewMode = 'timeline' | 'list'
