export type DnaPartKind =
  | 'adenine'
  | 'thymine'
  | 'cytosine'
  | 'guanine'
  | 'backbone'
  | 'basepair'
  | 'gene'
  | 'helix'

export interface DnaFact {
  id: string
  kind: DnaPartKind
  title: string
  subtitle: string
  body: string
  accent: string
}

export const FACTS: DnaFact[] = [
  {
    id: 'adenine',
    kind: 'adenine',
    title: 'Adenina (A)',
    subtitle: 'Base nitrogenada purina',
    body: 'A adenina é uma das quatro “letras” do código genético. Emparelha sempre com a timina (T) através de duas ligações de hidrogénio — como um fecho de correr molecular.',
    accent: '#5ec8ff',
  },
  {
    id: 'thymine',
    kind: 'thymine',
    title: 'Timina (T)',
    subtitle: 'Base nitrogenada pirimidina',
    body: 'A timina só existe no ADN (no ARN é substituída pela uracila). Forma o par clássico A–T e ajuda a manter a estabilidade da dupla hélice.',
    accent: '#ff9b5e',
  },
  {
    id: 'cytosine',
    kind: 'cytosine',
    title: 'Citosina (C)',
    subtitle: 'Base nitrogenada pirimidina',
    body: 'A citosina emparelha com a guanina (G) com três ligações de hidrogénio — um par mais “forte” do que A–T. Regiões ricas em C–G são tipicamente mais estáveis.',
    accent: '#7dffb3',
  },
  {
    id: 'guanine',
    kind: 'guanine',
    title: 'Guanina (G)',
    subtitle: 'Base nitrogenada purina',
    body: 'Além de formar o par C–G, a guanina participa em estruturas especiais como G-quadruplexes, que regulam a expressão de alguns genes.',
    accent: '#b48cff',
  },
  {
    id: 'backbone',
    kind: 'backbone',
    title: 'Espinha açúcar–fosfato',
    subtitle: 'O “esqueleto” da molécula',
    body: 'Cada fio do ADN é uma cadeia de desoxirribose (açúcar) ligada a grupos fosfato. As bases nitrogenadas penduram-se deste esqueleto como degraus de uma escada.',
    accent: '#8ef0ff',
  },
  {
    id: 'basepair',
    kind: 'basepair',
    title: 'Par de bases',
    subtitle: 'Os degraus da escada',
    body: 'Os pares A–T e C–G unem as duas cadeias. Se esticasses todo o ADN de uma célula humana, terias cerca de 2 metros de informação genética.',
    accent: '#ffe08a',
  },
  {
    id: 'gene',
    kind: 'gene',
    title: 'Gene',
    subtitle: 'Unidade de informação',
    body: 'Um gene é um trecho de ADN que contém instruções para produzir proteínas ou ARN. O genoma humano tem cerca de 20 000 genes codificantes — só ~1–2% do ADN total.',
    accent: '#5ec8ff',
  },
  {
    id: 'helix',
    kind: 'helix',
    title: 'Dupla hélice',
    subtitle: 'A forma icónica do ADN',
    body: 'Descoberta em 1953 por Watson e Crick (com dados de Rosalind Franklin), a dupla hélice dá uma volta completa a cada ~10 pares de bases e gira para a direita na forma B-ADN.',
    accent: '#8ef0ff',
  },
]

const KIND_CYCLE: DnaPartKind[] = [
  'adenine',
  'thymine',
  'cytosine',
  'guanine',
  'backbone',
  'basepair',
  'gene',
  'helix',
]

export function factForSegment(index: number): DnaFact {
  const kind = KIND_CYCLE[index % KIND_CYCLE.length]
  return FACTS.find((f) => f.kind === kind) ?? FACTS[0]
}
