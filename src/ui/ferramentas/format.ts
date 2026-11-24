/**
 * Formatação para a tela (funções puras): conjuntos, definição formal e
 * tabela de transição no estilo do Hopcroft.
 */
import { EPSILON } from '../../core/fa/types';
import type { FA, FAType, FormalDefinition, StateId, Sym } from '../../core/fa/types';

export const TYPE_LABEL: Record<FAType, string> = {
  EMPTY: 'Vazio',
  DFA: 'AFD',
  NFA: 'AFN',
  ENFA: 'ε-AFN',
};

export const TYPE_DESCRIPTION: Record<FAType, string> = {
  EMPTY: 'Ainda não há estados.',
  DFA: 'Determinístico: no máximo um destino por estado e símbolo, sem ε.',
  NFA: 'Não determinístico: algum estado tem mais de um destino com o mesmo símbolo.',
  ENFA: 'Não determinístico com transições ε (mudam de estado sem ler nada).',
};

const CHUNKS = /\d+|\D+/g;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Ordem "natural" de nomes, a mesma do núcleo (q2 antes de q10; "∅" depois
 * das letras): pedaços de dígitos comparados como números, o resto por UTF-16.
 */
export function compareNames(a: string, b: string): number {
  const ca = a.match(CHUNKS) ?? [];
  const cb = b.match(CHUNKS) ?? [];
  for (let i = 0; i < Math.min(ca.length, cb.length); i++) {
    const x = ca[i]!;
    const y = cb[i]!;
    if (x === y) continue;
    const dx = /^\d/.test(x);
    const dy = /^\d/.test(y);
    if (dx && dy) {
      const nx = x.replace(/^0+/, '');
      const ny = y.replace(/^0+/, '');
      if (nx.length !== ny.length) return nx.length - ny.length;
      if (nx !== ny) return cmp(nx, ny);
      return x.length - y.length;
    }
    return cmp(x, y);
  }
  return ca.length - cb.length;
}

/** "{q0,q1}" (ou "∅"). `sep` = ", " para textos mais "de livro". */
export function formatSet(names: readonly string[], sep = ','): string {
  return names.length === 0 ? '∅' : `{${names.join(sep)}}`;
}

/** Nome de cada estado (cai no id se o estado não existir). */
export function nameMap(fa: FA): Map<StateId, string> {
  return new Map(fa.states.map((s) => [s.id, s.name]));
}

export function namesOf(fa: FA, ids: readonly StateId[]): string[] {
  const names = nameMap(fa);
  return ids.map((id) => names.get(id) ?? id);
}

/** Conjunto de estados (por id) já formatado com os nomes. */
export function formatStates(fa: FA, ids: readonly StateId[], sep = ','): string {
  return formatSet(namesOf(fa, ids), sep);
}

/** Palavra para mostrar: a vazia vira ε. */
export function showWord(word: string): string {
  return word === '' ? EPSILON : word;
}

/** Um símbolo válido: exatamente 1 caractere (ε só em transições). */
export function isValidSym(s: string): boolean {
  return Array.from(s).length === 1;
}

/* ------------------------------------------------------------------ */
/* Definição formal                                                    */
/* ------------------------------------------------------------------ */

export interface FormalLines {
  Q: string;
  Sigma: string;
  q0: string;
  F: string;
}

/** Linhas de M = (Q, Σ, δ, q0, F) prontas para mostrar. */
export function formalLines(def: FormalDefinition): FormalLines {
  return {
    Q: formatSet(def.states, ', '),
    Sigma: formatSet(def.alphabet, ', '),
    q0: def.initial ?? '—',
    F: formatSet(def.finals, ', '),
  };
}

/* ------------------------------------------------------------------ */
/* Tabela de transição                                                 */
/* ------------------------------------------------------------------ */

export interface TableCell {
  symbol: Sym;
  targets: StateId[];
  /** "q1", "{q0,q1}" ou "∅". */
  text: string;
}

export interface TableRow {
  id: StateId;
  name: string;
  initial: boolean;
  final: boolean;
  cells: TableCell[];
}

export interface TransitionTable {
  /** Colunas: Σ em ordem e, por último, ε (se alguma transição usar ε). */
  symbols: Sym[];
  hasEpsilon: boolean;
  /** true = células com um estado só (sem chaves), como numa tabela de AFD. */
  deterministic: boolean;
  rows: TableRow[];
}

/**
 * Tabela de transição (uma linha por estado, uma coluna por símbolo).
 * Ignora transições penduradas e símbolos inválidos, como o núcleo.
 */
export function transitionTable(fa: FA): TransitionTable {
  const ids = new Set(fa.states.map((s) => s.id));
  const names = nameMap(fa);
  const delta = new Map<StateId, Map<Sym, Set<StateId>>>(fa.states.map((s) => [s.id, new Map()]));
  const sigma = new Set<Sym>();
  let hasEpsilon = false;
  for (const t of fa.transitions) {
    if (!ids.has(t.from) || !ids.has(t.to)) continue;
    for (const sym of t.symbols) {
      if (sym === EPSILON) hasEpsilon = true;
      else if (isValidSym(sym)) sigma.add(sym);
      else continue;
      const bySym = delta.get(t.from)!;
      if (!bySym.has(sym)) bySym.set(sym, new Set());
      bySym.get(sym)!.add(t.to);
    }
  }
  const symbols = [...sigma].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (hasEpsilon) symbols.push(EPSILON);

  let deterministic = !hasEpsilon;
  for (const bySym of delta.values()) for (const set of bySym.values()) if (set.size > 1) deterministic = false;

  const byName = (a: StateId, b: StateId) => compareNames(names.get(a)!, names.get(b)!);
  const states = [...fa.states].sort((a, b) => compareNames(a.name, b.name));
  const seen = new Set<StateId>();
  const rows: TableRow[] = [];
  for (const s of states) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    rows.push({
      id: s.id,
      name: s.name,
      initial: s.initial,
      final: s.final,
      cells: symbols.map((symbol) => {
        const targets = [...(delta.get(s.id)!.get(symbol) ?? [])].sort(byName);
        const targetNames = targets.map((id) => names.get(id)!);
        const text =
          targets.length === 0 ? '∅' : deterministic && targets.length === 1 ? targetNames[0]! : formatSet(targetNames);
        return { symbol, targets, text };
      }),
    });
  }
  return { symbols, hasEpsilon, deterministic, rows };
}

export interface TableColumn {
  /** Símbolos que a coluna representa (iguais em todas as linhas). */
  symbols: Sym[];
  /** Cabeçalho: "a", "+, -" ou "0, 1, …, 9". */
  label: string;
  /** Índice (em `symbols` da tabela) da célula a mostrar. */
  index: number;
}

/** "0, 1, …, 9" para uma sequência seguida de 4 ou mais; senão "a, b, c". */
export function symbolsLabel(symbols: readonly Sym[]): string {
  const codes = symbols.map((s) => s.codePointAt(0)!);
  const run = symbols.length >= 4 && codes.every((c, i) => i === 0 || c === codes[i - 1]! + 1);
  return run ? `${symbols[0]}, ${symbols[1]}, …, ${symbols[symbols.length - 1]}` : symbols.join(', ');
}

/**
 * Junta símbolos cujas colunas são iguais (`keyOf(i)` = conteúdo da coluna i),
 * só quando há mais de `minSymbols` símbolos. ε fica sempre sozinho.
 */
export function groupSymbols(symbols: readonly Sym[], keyOf: (i: number) => string, minSymbols = 4): TableColumn[] {
  const plain = symbols.filter((s) => s !== EPSILON).length;
  const columns: TableColumn[] = [];
  const byKey = new Map<string, TableColumn>();
  symbols.forEach((sym, i) => {
    if (sym === EPSILON || plain <= minSymbols) {
      columns.push({ symbols: [sym], label: sym, index: i });
      return;
    }
    const key = keyOf(i);
    const col = byKey.get(key);
    if (col) col.symbols.push(sym);
    else {
      const c: TableColumn = { symbols: [sym], label: sym, index: i };
      byKey.set(key, c);
      columns.push(c);
    }
  });
  for (const c of columns) c.label = symbolsLabel(c.symbols);
  return columns;
}

/**
 * Colunas da tabela de transição. Com Σ grande, junta as colunas iguais em
 * todas as linhas, como o Hopcroft faz com "0, 1, …, 9".
 */
export function tableColumns(table: TransitionTable, minSymbols = 4): TableColumn[] {
  return groupSymbols(
    table.symbols,
    (i) => table.rows.map((r) => r.cells[i]!.targets.join('\u0001')).join('\u0002'),
    minSymbols,
  );
}

/** Destinos de δ(estado, símbolo) num FA qualquer (ids, sem fecho-ε). */
export function deltaTargets(fa: FA, from: StateId, sym: Sym): StateId[] {
  const out = new Set<StateId>();
  for (const t of fa.transitions) if (t.from === from && t.symbols.includes(sym)) out.add(t.to);
  return [...out];
}

/** Ids em ordem natural dos nomes. */
export function sortByName(fa: FA, ids: Iterable<StateId>): StateId[] {
  const names = nameMap(fa);
  return [...ids].sort((a, b) => compareNames(names.get(a) ?? a, names.get(b) ?? b));
}
