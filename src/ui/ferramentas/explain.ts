/**
 * Explicações (funções puras) para as tabelas didáticas do painel lateral:
 *  - minimização pelo método da tabela (escada de pares, rodada a rodada);
 *  - construção de subconjuntos (AFN → AFD), linha a linha.
 */
import { alphabet, classify, eclose } from '../../core/fa';
import { EPSILON } from '../../core/fa/types';
import type { DeterminizeResult, FA, MarkedPair, MinimizationResult, StateId, Sym } from '../../core/fa/types';
import { deltaTargets, formatSet, nameMap, namesOf, sortByName } from './format';

/* ------------------------------------------------------------------ */
/* Minimização                                                         */
/* ------------------------------------------------------------------ */

export interface PairMark {
  round: number;
  mark: MarkedPair;
}

/** Chave de um par sem ordem. */
export function pairKey(a: StateId, b: StateId): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/** Em que rodada (e por quê) cada par foi marcado. */
export function markIndex(result: MinimizationResult): Map<string, PairMark> {
  const map = new Map<string, PairMark>();
  for (const r of result.table.rounds) {
    for (const m of r.newlyMarked) map.set(pairKey(m.pair[0], m.pair[1]), { round: r.round, mark: m });
  }
  return map;
}

/** A palavra que separa o par (seguindo os "porquês" até a rodada 0). */
export function distinguishingWord(marks: Map<string, PairMark>, p: StateId, q: StateId): string | null {
  let word = '';
  let key = pairKey(p, q);
  for (let guard = 0; guard < 10_000; guard++) {
    const m = marks.get(key);
    if (!m) return null;
    if (m.round === 0 || !m.mark.symbol || !m.mark.because) return word;
    word += m.mark.symbol;
    key = pairKey(m.mark.because[0], m.mark.because[1]);
  }
  return null;
}

/** Texto para o mouse em cima da célula {p,q}, vendo a tabela até a rodada `upTo`. */
export function explainPair(
  result: MinimizationResult,
  marks: Map<string, PairMark>,
  p: StateId,
  q: StateId,
  upTo: number,
): string {
  const fa = result.input;
  const names = nameMap(fa);
  const n = (id: StateId) => names.get(id) ?? id;
  const m = marks.get(pairKey(p, q));
  const done = upTo >= result.table.rounds.length;
  if (!m || m.round > upTo) {
    if (done) return `${n(p)} ≡ ${n(q)}: nenhuma palavra separa os dois, então eles viram um estado só.`;
    return `{${n(p)},${n(q)}} ainda não foi marcado.`;
  }
  const [a, b] = m.mark.pair;
  if (m.round === 0 || !m.mark.symbol || !m.mark.because) {
    const finals = new Set(fa.states.filter((s) => s.final).map((s) => s.id));
    const [f, nf] = finals.has(a) ? [a, b] : [b, a];
    return `Rodada 0: ${n(f)} é final e ${n(nf)} não é (a palavra ε já separa os dois).`;
  }
  const sym = m.mark.symbol;
  const ta = deltaTargets(fa, a, sym)[0];
  const tb = deltaTargets(fa, b, sym)[0];
  const [x, y] = m.mark.because;
  const word = distinguishingWord(marks, a, b) ?? sym;
  return (
    `Rodada ${m.round}: marcado porque δ(${n(a)},${sym})=${ta ? n(ta) : '∅'}, δ(${n(b)},${sym})=${tb ? n(tb) : '∅'}, ` +
    `e esse par {${n(x)},${n(y)}} já estava marcado. A palavra ${word} separa ${n(a)} de ${n(b)}.`
  );
}

/** O que foi feito antes de montar a tabela (determinizar, tirar inalcançáveis, completar). */
export function preparationNotes(source: FA, result: MinimizationResult): string[] {
  const notes: string[] = [];
  const input = result.input;
  if (classify(source) !== 'DFA' || source.states.filter((s) => s.initial).length > 1) {
    notes.push('O autômato não era um AFD: ele foi determinizado antes (a tabela é feita sobre o AFD).');
    return notes;
  }
  const inInput = new Set(input.states.map((s) => s.id));
  const inSource = new Set(source.states.map((s) => s.id));
  const removed = namesOf(source, sortByName(source, [...inSource].filter((id) => !inInput.has(id))));
  const added = namesOf(input, input.states.filter((s) => !inSource.has(s.id)).map((s) => s.id));
  if (removed.length) {
    notes.push(`Inalcançáveis removidos antes: ${removed.join(', ')}.`);
  }
  if (added.length) {
    notes.push(`O AFD foi completado com o estado morto ${added.join(', ')} (toda célula precisa de δ definido).`);
  }
  return notes;
}

/** Texto de cada passo da escada (-1 = tabela vazia; rounds.length = fim). */
export function roundCaption(result: MinimizationResult, position: number): string {
  const rounds = result.table.rounds;
  if (position < 0) return 'Cada célula é um par de estados {p,q}. Vamos marcar os pares distinguíveis, rodada por rodada.';
  if (position >= rounds.length) {
    return `Rodada ${rounds.length}: nenhum par novo, então acabou. Os pares sem marca são equivalentes.`;
  }
  const r = rounds[position]!;
  const k = r.newlyMarked.length;
  const count = k === 1 ? '1 par marcado' : `${k} pares marcados`;
  if (r.round === 0) return `Rodada 0: marca os pares com um estado final e um não final (${count}).`;
  return `Rodada ${r.round}: marca {p,q} quando, com algum símbolo a, o par {δ(p,a), δ(q,a)} já está marcado (${count}).`;
}

export interface MergedGroup {
  /** Nome do estado no AFD mínimo. */
  name: string;
  /** Nomes dos estados (da tabela) que ele junta. */
  members: string[];
}

export function mergedGroups(result: MinimizationResult): MergedGroup[] {
  const minNames = nameMap(result.dfa);
  return result.dfa.states.map((s) => ({
    name: minNames.get(s.id) ?? s.id,
    members: namesOf(result.input, result.merged[s.id] ?? []),
  }));
}

/* ------------------------------------------------------------------ */
/* Construção de subconjuntos                                          */
/* ------------------------------------------------------------------ */

export interface SubsetCell {
  symbol: Sym;
  target: StateId | null;
  targetName: string;
  /** Contas para o mouse: "δ(q0,0) ∪ δ(q1,0) = {q0} ∪ ∅ = {q0}" etc. */
  derivation: string[];
}

export interface SubsetRow {
  id: StateId;
  name: string;
  initial: boolean;
  final: boolean;
  /** Estados do AFN original que este estado do AFD representa. */
  members: string[];
  cells: SubsetCell[];
}

export interface SubsetTable {
  symbols: Sym[];
  rows: SubsetRow[];
  /** Explicação do estado inicial (ECLOSE do inicial no ε-AFN). */
  start: string;
  hasEpsilon: boolean;
}

export function subsetTable(source: FA, result: DeterminizeResult): SubsetTable {
  const dfa = result.dfa;
  const symbols = alphabet(source);
  const hasEpsilon = source.transitions.some((t) => t.symbols.includes(EPSILON));
  const dfaNames = nameMap(dfa);
  const set = (ids: readonly StateId[]) => formatSet(namesOf(source, sortByName(source, ids)));

  const target = (from: StateId, sym: Sym) => dfa.transitions.find((t) => t.from === from && t.symbols.includes(sym))?.to ?? null;

  const rows: SubsetRow[] = dfa.states.map((s) => {
    const members = result.subsets[s.id] ?? [];
    const cells = symbols.map((symbol): SubsetCell => {
      const to = target(s.id, symbol);
      const head = `δ_D(${dfaNames.get(s.id)}, ${symbol})`;
      const derivation: string[] = [];
      if (members.length === 0) {
        derivation.push(`${head} = ∅ (do conjunto vazio não se sai)`);
      } else {
        const parts = members.map((q) => deltaTargets(source, q, symbol));
        const union = sortByName(source, new Set(parts.flat()));
        const qs = namesOf(source, members);
        derivation.push(`${head} = ${qs.map((q) => `δ(${q},${symbol})`).join(' ∪ ')}`);
        if (members.length > 1) derivation.push(`= ${parts.map((p) => set(p)).join(' ∪ ')} = ${set(union)}`);
        else derivation.push(`= ${set(union)}`);
        if (hasEpsilon) derivation.push(`ECLOSE(${set(union)}) = ${set(union.length ? eclose(source, union) : [])}`);
      }
      return { symbol, target: to, targetName: to ? (dfaNames.get(to) ?? to) : '∅', derivation };
    });
    return {
      id: s.id,
      name: dfaNames.get(s.id) ?? s.id,
      initial: s.initial,
      final: s.final,
      members: namesOf(source, members),
      cells,
    };
  });

  const initials = source.states.filter((s) => s.initial).map((s) => s.id);
  const startSet = set(initials.length ? eclose(source, initials) : []);
  const start = hasEpsilon
    ? `O estado inicial do AFD é ECLOSE(${namesOf(source, initials).join(', ')}) = ${startSet}.`
    : `O estado inicial do AFD é ${startSet}, só com o inicial do AFN.`;
  return { symbols, rows, start, hasEpsilon };
}

/** Texto de cada passo da construção (k linhas já processadas). */
export function subsetCaption(table: SubsetTable, shown: number): string {
  if (shown <= 0) return table.start;
  if (shown >= table.rows.length) {
    const finals = table.rows.filter((r) => r.final).map((r) => r.name);
    return `Nenhum conjunto novo apareceu: acabou. ${table.rows.length} estados no AFD; finais (contêm um final do AFN): ${finals.length ? finals.join(', ') : 'nenhum'}.`;
  }
  const row = table.rows[shown - 1]!;
  return `Linha ${shown}: para cada símbolo, junta os destinos de ${row.name}${table.hasEpsilon ? ' e aplica o fecho-ε' : ''}. Conjuntos que ainda não estavam na tabela viram linhas novas.`;
}
