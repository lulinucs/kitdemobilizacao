import type { AgendaStatus } from '../agendaTypes'

const functionalStatusLabels: Partial<Record<AgendaStatus, string>> = {
  cancelado: 'Cancelado',
  alterado: 'Alterado',
  encerrado: 'Encerrado',
}

export function publicAgendaStatusLabel(status: AgendaStatus): string | null {
  return functionalStatusLabels[status] ?? null
}

export function publicAdditionalInfo(text?: string): string {
  if (!text) return ''

  const cleaned = text
    .replace(/Atividade divulgada; confirmação pública pendente\.\s*/gi, '')
    .replace(/Atividade em planejamento;\s*/gi, '')
    .replace(/horário, ponto de encontro e confirmação pendentes/gi, 'horário e ponto de encontro a confirmar')
    .replace(/endereço específico e confirmação pendentes/gi, 'endereço específico a confirmar')
    .replace(/intervalo e confirmação pendentes/gi, 'intervalo a confirmar')
    .replace(/horário exato e confirmação pendentes/gi, 'horário exato a confirmar')
    .replace(/^confirmação pendente\.?\s*/i, '')
    .trim()

  return cleaned.replace(/^./, (first) => first.toUpperCase())
}
