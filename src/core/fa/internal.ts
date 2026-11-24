/**
 * Peças internas do núcleo (não fazem parte da API pública).
 *
 * Tudo aqui é puro: nada modifica o FA recebido.
 */
import { EPSILON } from './types';
import type { FA, FAState, FATransition, StateId, Sym, TransitionId } from './types';

/* ------------------------------------------------------------------ */
/* Comparações                                                         */
/* ------------------------------------------------------------------ */

/** Ordem de símbolos e palavras: por unidade UTF-16 (a mesma do Java). */
export function compareSymbols(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const CHUNKS = /\d+|\D+/g;

/**
 * Ordem "natural" de nomes: q2 vem antes de q10. Os pedaços de dígitos são
 * comparados como números; o resto, por unidade UTF-16.
 */
export function compareNames(a: string, b: string): number {
  const ca = a.match(CHUNKS) ?? [];
  const cb = b.match(CHUNKS) ?? [];
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i++) {
    const x = ca[i]!;
    const y = cb[i]!;
    if (x === y) continue;
    const dx = x.charCodeAt(0) >= 48 && x.charCodeAt(0) <= 57;
    const dy = y.charCodeAt(0) >= 48 && y.charCodeAt(0) <= 57;
    if (dx && dy) {
      const nx = x.replace(/^0+/, '');
      const ny = y.replace(/^0+/, '');
      if (nx.length !== ny.length) return nx.length - ny.length;
      if (nx !== ny) return compareSymbols(nx, ny);
      return x.length - y.length;
    }
    return compareSymbols(x, y);
  }
  return ca.length - cb.length;
}

/** Um símbolo válido numa transição: ε ou exatamente 1 caractere. */
export function isValidSymbol(sym: string): boolean {
  return sym === EPSILON || Array.from(sym).length === 1;
}

/** Símbolo do alfabeto: 1 caractere e diferente de ε. */
export function isAlphabetSymbol(sym: string): boolean {
  return sym !== EPSILON && Array.from(sym).length === 1;
}

/** Símbolos sem repetição, em ordem (Σ em ordem e ε por último, igual ao editor e à coluna ε das tabelas). */
export function sortSymbols(symbols: Iterable<Sym>): Sym[] {
  return [...new Set(symbols)].sort((a, b) => {
    if (a === b) return 0;
    if (a === EPSILON) return 1;
    if (b === EPSILON) return -1;
    return compareSymbols(a, b);
  });
}

/* ------------------------------------------------------------------ */
/* Grafo: a visão do FA que os algoritmos usam                         */
/* ------------------------------------------------------------------ */

/**
 * O FA "limpo": ignora transições penduradas (de/para estado inexistente),
 * símbolos inválidos e ids de estado repetidos (vale o primeiro).
 */
export interface Graph {
  /** Ids dos estados, na ordem do FA. */
  ids: StateId[];
  byId: Map<StateId, FAState>;
  /** Estados iniciais, na ordem do FA (normalmente 0 ou 1). */
  initials: StateId[];
  finals: Set<StateId>;
  /** Σ (sem ε), em ordem. */
  sigma: Sym[];
  sigmaSet: Set<Sym>;
  /** δ: estado -> símbolo (pode ser ε) -> destino -> ids das transições. */
  delta: Map<StateId, Map<Sym, Map<StateId, TransitionId[]>>>;
}

export function buildGraph(fa: FA): Graph {
  const ids: StateId[] = [];
  const byId = new Map<StateId, FAState>();
  for (const s of fa.states) {
    if (byId.has(s.id)) continue;
    byId.set(s.id, s);
    ids.push(s.id);
  }
  const initials = ids.filter((id) => byId.get(id)!.initial);
  const finals = new Set(ids.filter((id) => byId.get(id)!.final));

  const delta = new Map<StateId, Map<Sym, Map<StateId, TransitionId[]>>>();
  for (const id of ids) delta.set(id, new Map());
  const sigmaSet = new Set<Sym>();

  for (const t of fa.transitions) {
    if (!byId.has(t.from) || !byId.has(t.to)) continue;
    const bySym = delta.get(t.from)!;
    for (const sym of new Set(t.symbols)) {
      if (!isValidSymbol(sym)) continue;
      if (sym !== EPSILON) sigmaSet.add(sym);
      let byTarget = bySym.get(sym);
      if (!byTarget) {
        byTarget = new Map();
        bySym.set(sym, byTarget);
      }
      const tids = byTarget.get(t.to);
      if (tids) {
        if (!tids.includes(t.id)) tids.push(t.id);
      } else {
        byTarget.set(t.to, [t.id]);
      }
    }
  }

  const sigma = [...sigmaSet].sort(compareSymbols);
  return { ids, byId, initials, finals, sigma, sigmaSet, delta };
}

/** Destinos de δ(s, sym), na ordem em que aparecem no FA. */
export function targets(g: Graph, s: StateId, sym: Sym): StateId[] {
  const byTarget = g.delta.get(s)?.get(sym);
  return byTarget ? [...byTarget.keys()] : [];
}

/** Fecho-ε de um conjunto de estados (inclui os próprios estados). */
export function closure(g: Graph, from: Iterable<StateId>): Set<StateId> {
  const result = new Set<StateId>();
  const stack: StateId[] = [];
  for (const s of from) {
    if (g.byId.has(s) && !result.has(s)) {
      result.add(s);
      stack.push(s);
    }
  }
  while (stack.length > 0) {
    const s = stack.pop()!;
    for (const t of targets(g, s, EPSILON)) {
      if (!result.has(t)) {
        result.add(t);
        stack.push(t);
      }
    }
  }
  return result;
}

/** Estados alcançados lendo `sym` a partir de `from` (sem fecho-ε). */
export function move(g: Graph, from: Iterable<StateId>, sym: Sym): Set<StateId> {
  const result = new Set<StateId>();
  for (const s of from) {
    for (const t of targets(g, s, sym)) result.add(t);
  }
  return result;
}

/** Sem ε e no máximo um destino por (estado, símbolo). */
export function isDeterministic(g: Graph): boolean {
  for (const bySym of g.delta.values()) {
    for (const [sym, byTarget] of bySym) {
      if (sym === EPSILON || byTarget.size > 1) return false;
    }
  }
  return true;
}

/** Ordena ids de estados pelo nome (ordem natural); empate pelo id. */
export function sortIdsByName(g: Graph, ids: Iterable<StateId>): StateId[] {
  return [...ids].sort((a, b) => {
    const c = compareNames(g.byId.get(a)?.name ?? a, g.byId.get(b)?.name ?? b);
    return c !== 0 ? c : compareSymbols(a, b);
  });
}

/** Estados alcançáveis a partir de `from` por qualquer transição (inclusive ε). */
export function reachableFrom(g: Graph, from: Iterable<StateId>): Set<StateId> {
  const seen = new Set<StateId>();
  const stack: StateId[] = [];
  for (const s of from) {
    if (g.byId.has(s) && !seen.has(s)) {
      seen.add(s);
      stack.push(s);
    }
  }
  while (stack.length > 0) {
    const s = stack.pop()!;
    for (const byTarget of g.delta.get(s)!.values()) {
      for (const t of byTarget.keys()) {
        if (!seen.has(t)) {
          seen.add(t);
          stack.push(t);
        }
      }
    }
  }
  return seen;
}

/* ------------------------------------------------------------------ */
/* Montagem de FAs de saída                                            */
/* ------------------------------------------------------------------ */

/** Primeiro id livre da forma prefixo0, prefixo1, ... */
export function freshId(used: Set<string>, prefix: string): string {
  for (let i = 0; ; i++) {
    const id = `${prefix}${i}`;
    if (!used.has(id)) return id;
  }
}

/** `base` se estiver livre; senão base1, base2, ... */
export function freshName(used: Set<string>, base: string): string {
  if (!used.has(base)) return base;
  for (let i = 1; ; i++) {
    const name = `${base}${i}`;
    if (!used.has(name)) return name;
  }
}

/**
 * Cópia limpa que MANTÉM ids e nomes: só os estados de `keep` (todos, se
 * omitido), uma transição por par (from, to), símbolos válidos sem repetição
 * e em ordem. Transições penduradas ou sem símbolo somem.
 */
export function normalize(fa: FA, keep?: Set<StateId>): FA {
  const g = buildGraph(fa);
  const kept = g.ids.filter((id) => !keep || keep.has(id));
  const keptSet = new Set(kept);
  const states = kept.map((id) => ({ ...g.byId.get(id)! }));

  const byPair = new Map<string, { t: FATransition; symbols: Set<Sym> }>();
  const order: string[] = [];
  for (const t of fa.transitions) {
    if (!keptSet.has(t.from) || !keptSet.has(t.to)) continue;
    const symbols = t.symbols.filter(isValidSymbol);
    if (symbols.length === 0) continue;
    const key = JSON.stringify([t.from, t.to]);
    const entry = byPair.get(key);
    if (entry) {
      for (const s of symbols) entry.symbols.add(s);
    } else {
      byPair.set(key, { t, symbols: new Set(symbols) });
      order.push(key);
    }
  }
  // ids de transição repetidos (arquivo editado à mão) ganham um id novo
  const taken = new Set(fa.transitions.map((t) => t.id));
  const assigned = new Set<string>();
  const transitions: FATransition[] = [];
  for (const key of order) {
    const { t, symbols } = byPair.get(key)!;
    let id = t.id;
    if (assigned.has(id)) {
      id = freshId(taken, 't');
      taken.add(id);
    }
    assigned.add(id);
    transitions.push({ id, from: t.from, to: t.to, symbols: sortSymbols(symbols) });
  }
  return { states, transitions };
}

/** Um autômato "rascunho", antes de ganhar ids e nomes definitivos. */
export interface RawFA {
  /** Chaves únicas dos estados, na ordem de preferência para os inalcançáveis. */
  keys: string[];
  initial: string[];
  isFinal: (key: string) => boolean;
  edges: Array<{ from: string; sym: Sym; to: string }>;
  /** Nome do estado; omitido = "q0", "q1", ... (igual ao id). */
  name?: (key: string) => string;
}

export interface BuiltFA {
  fa: FA;
  /** chave do rascunho -> id novo */
  idOf: Map<string, StateId>;
}

/**
 * Dá ids "q0", "q1", ... na ordem de uma busca em largura a partir do(s)
 * inicial(is) (ε primeiro, depois símbolos em ordem alfabética). Estados
 * inalcançáveis vêm depois, na ordem de `raw.keys`. Junta as transições por
 * par (from, to), com símbolos em ordem, e dá ids "t0", "t1", ...
 */
export function buildFA(raw: RawFA): BuiltFA {
  const out = new Map<string, Map<Sym, string[]>>();
  for (const k of raw.keys) out.set(k, new Map());
  for (const e of raw.edges) {
    const bySym = out.get(e.from);
    if (!bySym || !out.has(e.to)) continue;
    const list = bySym.get(e.sym);
    if (!list) bySym.set(e.sym, [e.to]);
    else if (!list.includes(e.to)) list.push(e.to);
  }

  // busca em largura: `order` é a própria fila
  const order: string[] = [];
  const seen = new Set<string>();
  for (const k of raw.initial) {
    if (out.has(k) && !seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
  }
  for (let i = 0; i < order.length; i++) {
    const bySym = out.get(order[i]!)!;
    for (const sym of sortSymbols(bySym.keys())) {
      for (const to of bySym.get(sym)!) {
        if (!seen.has(to)) {
          seen.add(to);
          order.push(to);
        }
      }
    }
  }
  for (const k of raw.keys) {
    if (!seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
  }

  const idOf = new Map<string, StateId>();
  order.forEach((k, i) => idOf.set(k, `q${i}`));
  const initialSet = new Set(raw.initial);
  const states: FAState[] = order.map((k) => ({
    id: idOf.get(k)!,
    name: raw.name ? raw.name(k) : idOf.get(k)!,
    initial: initialSet.has(k),
    final: raw.isFinal(k),
  }));

  const transitions: FATransition[] = [];
  for (const k of order) {
    const bySym = out.get(k)!;
    const byTarget = new Map<string, Sym[]>();
    for (const sym of sortSymbols(bySym.keys())) {
      for (const to of bySym.get(sym)!) {
        const list = byTarget.get(to);
        if (list) list.push(sym);
        else byTarget.set(to, [sym]);
      }
    }
    for (const [to, symbols] of byTarget) {
      transitions.push({
        id: `t${transitions.length}`,
        from: idOf.get(k)!,
        to: idOf.get(to)!,
        symbols: sortSymbols(symbols),
      });
    }
  }

  return { fa: { states, transitions }, idOf };
}

/** Arestas (from, sym, to) válidas de um grafo, com as chaves passadas por `key`. */
export function graphEdges(
  g: Graph,
  key: (id: StateId) => string,
): Array<{ from: string; sym: Sym; to: string }> {
  const edges: Array<{ from: string; sym: Sym; to: string }> = [];
  for (const from of g.ids) {
    for (const [sym, byTarget] of g.delta.get(from)!) {
      for (const to of byTarget.keys()) edges.push({ from: key(from), sym, to: key(to) });
    }
  }
  return edges;
}
