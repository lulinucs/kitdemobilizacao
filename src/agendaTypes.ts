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
  cidade: string
  uf: string
  local?: string
  endereco?: string
  bairro?: string
  descricao: string
  informacoesAdicionais?: string
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
  includePast: boolean
}

export type AgendaViewMode = 'timeline' | 'list'
