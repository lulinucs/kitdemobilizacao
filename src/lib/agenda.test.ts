import { describe, expect, it } from 'vitest'
import rawAgenda from '../data/agenda-floripa.json'
import type { AgendaData, AgendaEvent } from '../agendaTypes'
import { buildEventShare, createAgendaParams, eventEndDateTime, filterAgendaEvents, formatEventPlace, formatEventTime, formatMobilizationTitle, getBalancedUpcomingWidgetEvents, getNextEvent, getUpcomingWidgetEventsByLocation, getWidgetEventSelection, getZonedDate, groupAgendaEvents, isEventOngoing, isPastForList, isPastForWidget, sortEvents, validateAgenda } from './agenda'

const data = rawAgenda as AgendaData
const now = new Date('2026-10-09T14:00:00.000Z') // 11h em Florianópolis

describe('agenda', () => {
  it('incorpora a relação de outubro sem perder registros, fontes ou horários simbólicos', () => {
    expect(data.eventos).toHaveLength(102)
    const october13 = data.eventos.filter((event) => event.data === '2026-10-13')
    expect(october13).toHaveLength(11)
    expect(october13.map((event) => event.id)).toEqual(expect.arrayContaining([
      'mobilizacao-estudantil-brasilia-1310',
      'mobilizacao-estudantil-feira-santana-1310',
      'ato-nacional-estudantes-florianopolis-1310',
      'mobilizacao-estudantil-ufrj-fundao-1310',
    ]))
    expect(validateAgenda(data).errors).toEqual([])
    const ids = new Set(data.eventos.map((event) => event.id))
    expect(ids.size).toBe(data.eventos.length)
    expect(data.eventos.find((event) => event.id === 'mobilizacao-estudantil-brasilia-1310')).toMatchObject({
      inicio: '16:00',
      pontoEncontro: 'Museu Nacional da República, Setor Cultural Sul',
      fonte: { url: 'https://diariodecontexto.com/brasil/estudantes-unb-ato-brasilia/' },
    })
    expect(data.eventos.find((event) => event.id === 'mobilizacao-estudantil-ufrj-fundao-1310')?.fonte?.url).toContain('midianinja.org')
    const symbolic = data.eventos.filter((event) => event.inicio?.endsWith(':13'))
    expect(symbolic.map((event) => `${event.data} ${event.cidade} ${event.inicio}`)).toEqual(expect.arrayContaining([
      '2026-10-10 Aracaju 08:13',
      '2026-10-10 João Pessoa 09:13',
      '2026-10-10 João Pessoa 17:13',
      '2026-10-11 Aracaju 10:13',
      '2026-10-12 Aracaju 10:13',
      '2026-10-13 Aracaju 15:13',
      '2026-10-13 Assú 18:13',
    ]))
    expect(filterAgendaEvents(data.eventos, { query: '', day: '2026-10-18', city: 'Florianópolis', state: 'SC', category: '', mobilization: '', includePast: true }, now, data.timezone).map((event) => event.local)).toEqual(['Escadaria Valda Costa, Centro'])
    expect(sortEvents(data.eventos, data.timezone).filter((event) => event.data === '2026-10-18').map((event) => event.inicio)).toEqual(['08:30', '11:00', '11:00', '11:00', '11:00', '11:00', '11:00', '11:00', '13:00'])
  })

  it('ordena por data e hora e deixa data pendente ao final', () => {
    const sorted = sortEvents(data.eventos, data.timezone)
    expect(sorted[0].id).toBe('banca-ticen-0910')
    expect(sorted.at(-1)?.id).toBe('serigrafia-centro')
  })

  it('usa o fuso de Florianópolis e trata a virada de dia', () => {
    expect(getZonedDate(new Date('2026-10-10T02:30:00.000Z'), data.timezone)).toBe('2026-10-09')
    expect(getZonedDate(new Date('2026-10-10T03:01:00.000Z'), data.timezone)).toBe('2026-10-10')
  })

  it('mantém data pendente fora do próximo evento', () => {
    expect(getNextEvent(data.eventos, now, data.timezone)?.id).toBe('assembleia-ufsc-0910')
    expect(getNextEvent([data.eventos[0]], now, data.timezone)).toBeUndefined()
  })

  it('combina dia, cidade, estado, categoria e busca', () => {
    const result = filterAgendaEvents(data.eventos, { query: 'bandeiraco', day: '2026-10-09', city: 'Florianópolis', state: 'SC', category: 'bandeiraco', mobilization: '', includePast: true }, now, data.timezone)
    expect(result.map((event) => event.id)).toEqual(['bandeiraco-campeche-0910'])
  })

  it('aceita novas cidades sem depender de uma localização global', () => {
    const baseEvent = data.eventos.find((item) => item.id === 'pedalula-1110')!
    const event = { ...baseEvent, id: 'evento-recife', cidade: 'Recife', uf: 'PE' }
    const events = [...data.eventos, event]

    expect(filterAgendaEvents(events, { query: '', day: '', city: 'Recife', state: '', category: '', mobilization: '', includePast: true }, now, data.timezone).map((item) => item.id)).toEqual([
      'evento-recife',
      '2026-10-11-recife-estudantes-com-lula-pelo-futuro-do-brasil',
      '2026-10-18-recife-mobilizacao-marco-zero',
    ])
    expect(validateAgenda({ ...data, eventos: events }).errors).toEqual([])
  })

  it('valida IDs únicos', () => {
    const invalid = { ...data, eventos: [...data.eventos, { ...data.eventos[1] }] }
    const result = validateAgenda(invalid)
    expect(result.errors.some((error) => error.includes('duplicado'))).toBe(true)
    expect(result.events).toHaveLength(data.eventos.length)
  })

  it('separa eventos passados', () => {
    const event = data.eventos.find((item) => item.id === 'banca-ticen-0910')!
    expect(isPastForList(event, new Date('2026-10-09T21:00:00.000Z'), data.timezone)).toBe(true)
  })

  it('não presume que um evento sem hora final terminou após o início', () => {
    const event = data.eventos.find((item) => item.id === 'assembleia-ufsc-0910')!
    const afterStart = new Date('2026-10-09T15:30:00.000Z')
    expect(isPastForWidget(event, afterStart, data.timezone)).toBe(false)
    expect(isPastForList(event, afterStart, data.timezone)).toBe(false)
  })

  it('evento cancelado nunca aparece como próximo', () => {
    const event = { ...data.eventos.find((item) => item.id === 'pedalula-1110')!, status: 'cancelado' } as AgendaEvent
    expect(getNextEvent([event], now, data.timezone)).toBeUndefined()
  })

  it('gera compartilhamento com link permanente', () => {
    const event = data.eventos.find((item) => item.id === 'pedalula-1110')!
    const share = buildEventShare(event, { origin: 'https://exemplo.test', pathname: '/' }, data.timezone)
    expect(share.url).toBe('https://exemplo.test/?view=agenda&evento=pedalula-1110')
    expect(share.text).toContain('Pedalula')
    expect(share.text).toContain('Florianópolis/SC')
  })

  it('agrupa atos da mesma mobilização apenas quando solicitado', () => {
    const floripa = data.eventos.find((item) => item.id === 'ato-nacional-estudantes-florianopolis-1310')!
    const recife = { ...floripa, id: 'ato-nacional-recife-1310', cidade: 'Recife', uf: 'PE', inicio: '18:30', inicioRotulo: '18h30 — concentração' }
    const regular = data.eventos.find((item) => item.id === 'pedalula-1110')!

    const grouped = groupAgendaEvents([regular, floripa, recife])
    expect(grouped).toHaveLength(2)
    expect(grouped[1]).toMatchObject({ kind: 'mobilization', id: 'ato-nacional-13-out-2026' })
    if (grouped[1]?.kind === 'mobilization') expect(grouped[1].events.map((event) => event.cidade)).toEqual(['Florianópolis', 'Recife'])

    expect(groupAgendaEvents([floripa, recife], false).map((item) => item.kind)).toEqual(['event', 'event'])
  })

  it('forma o título nacional e preserva o rótulo confirmado da concentração', () => {
    const event = data.eventos.find((item) => item.id === 'ato-nacional-estudantes-florianopolis-1310')!
    expect(formatMobilizationTitle([event], data.timezone)).toBe('Ato Nacional — 13 de outubro')
    expect(formatEventTime(event)).toBe('17h — concentração')
  })

  it('mantém eventos sem horário no dia correto e depois dos horários conhecidos', () => {
    const timed = data.eventos.find((item) => item.id === 'banca-ticen-0910')!
    const unknown = data.eventos.find((item) => item.id === 'mobilizacao-estudantil-ufrpe-uabj-0910')!
    const sorted = sortEvents([unknown, timed], data.timezone)

    expect(formatEventTime(unknown)).toBe('Horário a confirmar')
    expect(sorted.map((event) => event.id)).toEqual([timed.id, unknown.id])
    expect(getWidgetEventSelection([unknown], now, data.timezone).kind).toBe('empty')
  })

  it('exibe a programação de São José sem duplicações, horários inventados ou vínculo estudantil', () => {
    const added = data.eventos.filter((event) => event.id.endsWith('-sao-jose-1010') || /-sao-jose-(1110|1210|1310|1410|1610)$/.test(event.id))
    expect(added).toHaveLength(11)
    expect(new Set(added.map((event) => event.id)).size).toBe(11)
    expect(added.every((event) => event.cidade === 'São José' && event.uf === 'SC' && event.status === 'divulgado')).toBe(true)
    expect(added.every((event) => !event.mobilizacaoId)).toBe(true)
    expect(added.every((event) => event.fonte && !event.fonte.url)).toBe(true)
    expect(added.filter((event) => event.data === '2026-10-15')).toHaveLength(0)
    expect(added.filter((event) => event.inicio === null)).toHaveLength(5)
    expect(added.filter((event) => event.fim !== null)).toHaveLength(3)
    expect(added.find((event) => event.id === 'mobilizacao-hospital-regional-sao-jose-1310')?.inicioRotulo).toContain('Ao longo do dia')
    expect(added.find((event) => event.id === 'mobilizacao-picadas-sul-sao-jose-1410')?.inicioRotulo).toContain('Pela manhã')
    expect(validateAgenda(data).errors).toEqual([])

    const cityEvents = filterAgendaEvents(data.eventos, { query: '', day: '', city: 'São José', state: 'SC', category: '', mobilization: '', includePast: true }, now, data.timezone)
    expect(cityEvents).toHaveLength(12) // Inclui a reunião já cadastrada na Serraria.
    expect(cityEvents.map((event) => event.data)).toEqual([...cityEvents.map((event) => event.data)].sort())
    expect(cityEvents[0]?.id).toBe('barraca-vira-voto-kobrasol-sao-jose-1010')
    expect(cityEvents.at(-1)?.id).toBe('adesivaco-cartazes-prefeitura-sao-jose-1610')

    const hospital = added.find((event) => event.id === 'mobilizacao-hospital-regional-sao-jose-1310')!
    expect(formatEventTime(hospital)).toBe('Ao longo do dia (horário a confirmar)')
    expect(isEventOngoing(hospital, new Date('2026-10-13T15:00:00.000Z'), data.timezone)).toBe(false)
    for (const event of added) {
      const url = buildEventShare(event, { origin: 'https://exemplo.test', pathname: '/' }, data.timezone).url
      expect(new URL(url).searchParams.get('evento')).toBe(event.id)
    }
    expect(getUpcomingWidgetEventsByLocation(data.eventos, now, data.timezone).find((item) => item.label === 'São José/SC')?.event.id).toBe('barraca-vira-voto-kobrasol-sao-jose-1010')
  })

  it('mantém a entrega do Dia do Nordestino até a meia-noite de 12/10', () => {
    const event = data.eventos.find((item) => item.id === 'entrega-materiais-dia-nordestino-sao-jose-1110')!
    expect(event).toMatchObject({ data: '2026-10-11', inicio: '13:00', fim: '00:00' })
    expect(event.local).toContain('Arena Multiuso')
    expect(event.informacoesAdicionais).toBe('Levar adesivos.')
    expect(formatEventTime(event)).toBe('13:00–00:00 (dia seguinte)')
    expect(eventEndDateTime(event, data.timezone)?.toISOString()).toBe('2026-10-12T03:00:00.000Z')
    expect(isEventOngoing(event, new Date('2026-10-12T02:30:00.000Z'), data.timezone)).toBe(true)
    expect(isEventOngoing(event, new Date('2026-10-12T03:00:00.000Z'), data.timezone)).toBe(false)
  })

  it('aceita atividade virtual sem cidade e permite encontrá-la pela instituição', () => {
    const virtual: AgendaEvent = {
      id: 'plenaria-virtual',
      titulo: 'Plenária virtual',
      categoria: 'plenaria',
      data: '2026-10-13',
      inicio: '20:00',
      fim: null,
      modalidade: 'virtual',
      instituicao: 'Entidade estudantil',
      descricao: 'Encontro virtual.',
      status: 'confirmado',
    }
    const nextData = { ...data, eventos: [...data.eventos, virtual] }

    expect(validateAgenda(nextData).errors).toEqual([])
    expect(formatEventPlace(virtual)).toBe('Atividade virtual')
    expect(filterAgendaEvents([virtual], { query: 'entidade estudantil', day: '', city: '', state: '', category: '', mobilization: '', includePast: true }, now, data.timezone)).toEqual([virtual])
  })

  it('não associa a agenda da Mídia NINJA ao ato nacional sem confirmação explícita', () => {
    const ninjaEvents = data.eventos.filter((event) => event.fonte?.url?.includes('midianinja.org'))

    expect(ninjaEvents).toHaveLength(8)
    expect(ninjaEvents.every((event) => event.mobilizacaoId === undefined)).toBe(true)
    expect(data.eventos.filter((event) => event.mobilizacaoId === 'ato-nacional-13-out-2026')).toHaveLength(1)
  })

  it('filtra uma mobilização nacional sem afetar os demais filtros', () => {
    const result = filterAgendaEvents(data.eventos, { query: '', day: '', city: '', state: '', category: '', mobilization: 'ato-nacional-13-out-2026', includePast: true }, now, data.timezone)

    expect(result.map((event) => event.id)).toEqual(['ato-nacional-estudantes-florianopolis-1310'])
  })

  it('gera navegação limpa para a agenda e links permanentes dos eventos', () => {
    expect(createAgendaParams().toString()).toBe('view=agenda')
    expect(createAgendaParams({ eventId: 'evento-individual' }).toString()).toBe('view=agenda&evento=evento-individual')
  })
})

describe('seleção do widget de próxima atividade', () => {
  const timezone = 'America/Sao_Paulo'
  const event = (overrides: Partial<AgendaEvent> = {}): AgendaEvent => ({
    id: 'evento-base',
    titulo: 'Evento base',
    categoria: 'ato',
    data: '2026-10-09',
    inicio: '14:00',
    fim: '18:00',
    cidade: 'Florianópolis',
    uf: 'SC',
    local: 'Praça',
    descricao: 'Descrição',
    status: 'divulgado',
    ...overrides,
  })

  it('prioriza um evento acontecendo agora entre 14h e 18h', () => {
    const ongoing = event()
    const future = event({ id: 'futuro', inicio: '17:00', fim: '19:00' })
    const selection = getWidgetEventSelection([future, ongoing], new Date('2026-10-09T19:00:00.000Z'), timezone) // 16h local

    expect(selection.kind).toBe('ongoing')
    expect(selection.events.map((item) => item.id)).toEqual(['evento-base'])
  })

  it('deixa de considerar o evento em andamento exatamente às 18h', () => {
    const atEnd = new Date('2026-10-09T21:00:00.000Z')
    const selection = getWidgetEventSelection([event()], atEnd, timezone)

    expect(selection.kind).toBe('empty')
    expect(isEventOngoing(event(), atEnd, timezone)).toBe(false)
  })

  it('retorna todos os eventos simultâneos', () => {
    const first = event({ id: 'primeiro', titulo: 'Primeiro' })
    const second = event({ id: 'segundo', titulo: 'Segundo', inicio: '15:00', fim: '17:00' })
    const selection = getWidgetEventSelection([second, first], new Date('2026-10-09T19:00:00.000Z'), timezone)

    expect(selection.kind).toBe('ongoing')
    expect(selection.events.map((item) => item.id)).toEqual(['primeiro', 'segundo'])
  })

  it('mantém todas as atividades em andamento para a vitrine expansível', () => {
    const simultaneous = Array.from({ length: 11 }, (_, index) => event({ id: `simultaneo-${index}` }))
    const selection = getWidgetEventSelection(simultaneous, new Date('2026-10-09T19:00:00.000Z'), timezone)
    expect(selection.kind).toBe('ongoing')
    expect(selection.events).toHaveLength(11)
  })

  it('seleciona o futuro mais próximo quando nada está acontecendo', () => {
    const later = event({ id: 'mais-tarde', inicio: '20:00', fim: '21:00' })
    const next = event({ id: 'proximo', inicio: '19:00', fim: '20:00' })
    const selection = getWidgetEventSelection([later, next], new Date('2026-10-09T21:00:00.000Z'), timezone) // 18h local

    expect(selection.kind).toBe('upcoming')
    expect(selection.events[0]?.id).toBe('proximo')
  })

  it('retorna vazio quando não há evento futuro', () => {
    const selection = getWidgetEventSelection([event()], new Date('2026-10-09T22:00:00.000Z'), timezone)
    expect(selection).toEqual({ kind: 'empty', events: [] })
  })

  it('considera em andamento um evento que atravessa a meia-noite', () => {
    const overnight = event({ inicio: '23:00', fim: '01:00' })
    const atHalfPastMidnight = new Date('2026-10-10T03:30:00.000Z')

    expect(isEventOngoing(overnight, atHalfPastMidnight, timezone)).toBe(true)
    expect(eventEndDateTime(overnight, timezone)?.toISOString()).toBe('2026-10-10T04:00:00.000Z')
  })

  it('não mantém como acontecendo agora um evento sem término conhecido', () => {
    const withoutEnd = event({ fim: null })
    const afterStart = new Date('2026-10-09T19:00:00.000Z')
    const selection = getWidgetEventSelection([withoutEnd], afterStart, timezone)

    expect(selection.kind).toBe('empty')
    expect(isEventOngoing(withoutEnd, afterStart, timezone)).toBe(false)
    expect(isPastForWidget(withoutEnd, new Date('2026-10-10T19:00:00.000Z'), timezone)).toBe(true)
  })

  it('mantém ao vivo por no mínimo uma hora mesmo sem término informado', () => {
    const withoutEnd = event({ fim: null })
    expect(isEventOngoing(withoutEnd, new Date('2026-10-09T17:30:00.000Z'), timezone)).toBe(true)
    expect(isEventOngoing(withoutEnd, new Date('2026-10-09T18:00:00.000Z'), timezone)).toBe(false)
  })

  it('mantém a janela mínima de uma hora quando o término divulgado é anterior', () => {
    const short = event({ fim: '14:30' })
    expect(isEventOngoing(short, new Date('2026-10-09T17:45:00.000Z'), timezone)).toBe(true)
  })

  it('seleciona uma próxima atividade por localidade em ordem cronológica', () => {
    const laterFloripa = event({ id: 'floripa-depois', data: '2026-10-10', inicio: '18:00' })
    const firstFloripa = event({ id: 'floripa-primeiro', data: '2026-10-10', inicio: '10:00' })
    const recife = event({ id: 'recife', data: '2026-10-10', inicio: null, fim: null, cidade: 'Recife', uf: 'PE' })
    const groups = getUpcomingWidgetEventsByLocation([laterFloripa, recife, firstFloripa], new Date('2026-10-09T19:00:00.000Z'), timezone)

    expect(groups.map((group) => group.event.id)).toEqual(['floripa-primeiro', 'recife'])
  })

  it('distribui próximas atividades entre cidades antes de preencher vagas e exclui as atuais', () => {
    const now = new Date('2026-10-09T19:00:00.000Z')
    const ongoing = event({ id: 'agora' })
    const floripa1 = event({ id: 'floripa-1', inicio: '17:00', fim: '19:00' })
    const floripa2 = event({ id: 'floripa-2', inicio: '17:30', fim: '19:30' })
    const floripa3 = event({ id: 'floripa-3', inicio: '18:00', fim: '20:00' })
    const recife = event({ id: 'recife', inicio: '19:00', fim: '21:00', cidade: 'Recife', uf: 'PE' })
    const brasilia = event({ id: 'brasilia', inicio: '20:00', fim: '22:00', cidade: 'Brasília', uf: 'DF' })
    const selected = getBalancedUpcomingWidgetEvents([floripa3, recife, ongoing, floripa2, brasilia, floripa1], now, timezone, 4)

    expect(selected.map((item) => item.event.id)).toEqual(['floripa-1', 'floripa-2', 'recife', 'brasilia'])
    expect(selected.map((item) => item.label)).toEqual(['Florianópolis/SC', 'Florianópolis/SC', 'Recife/PE', 'Brasília/DF'])
  })

  it('mostra o ato nacional como próximo antes da concentração sem mantê-lo em andamento indefinidamente', () => {
    const nationalAct = data.eventos.find((item) => item.id === 'ato-nacional-estudantes-florianopolis-1310')!
    const beforeStart = getWidgetEventSelection([nationalAct], new Date('2026-10-13T19:00:00.000Z'), timezone)
    const afterStart = getWidgetEventSelection([nationalAct], new Date('2026-10-13T21:00:00.000Z'), timezone)

    expect(beforeStart.kind).toBe('upcoming')
    expect(beforeStart.events[0]?.id).toBe(nationalAct.id)
    expect(afterStart.kind).toBe('empty')
  })

  it('respeita o conjunto previamente filtrado pela cidade', () => {
    const floripa = event({ id: 'floripa' })
    const recife = event({ id: 'recife', cidade: 'Recife', uf: 'PE' })
    const cityEvents = [floripa, recife].filter((item) => item.cidade === 'Recife')
    const selection = getWidgetEventSelection(cityEvents, new Date('2026-10-09T19:00:00.000Z'), timezone)

    expect(selection.events.map((item) => item.id)).toEqual(['recife'])
  })
})
