export type VerificationStatus = 'verificado' | 'nao-verificado'

export interface Category {
  id: string
  nome: string
  descricao: string
  icone: string
  ordem: number
}

export interface Activity {
  id: string
  nome: string
  icone: string
}

export interface InitiativeLink {
  rotulo: string
  url: string
  principal: boolean
}

export interface Initiative {
  id: string
  nome: string
  descricao: string
  categoriaPrincipal: string
  atividades: string[]
  tags: string[]
  links: InitiativeLink[]
  origem: string
  verificacao: {
    status: VerificationStatus
    verificadoEm: string | null
    observacao: string | null
  }
  ativo: boolean
  destaque: boolean
}

export interface DirectoryData {
  schemaVersion: string
  titulo: string
  subtitulo: string
  atualizadoEm: string
  aviso: string
  categorias: Category[]
  atividades: Activity[]
  iniciativas: Initiative[]
}

export interface Filters {
  query: string
  category: string
  activity: string
}
