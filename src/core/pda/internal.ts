/**
 * Peças internas do núcleo de AP (não fazem parte da API pública).
 *
 * Tudo aqui é puro: nada modifica o PDA recebido.
 */
import { compareNames, compareSymbols, freshId } from '../fa/internal';
import { EPSILON } from './types';
import type { PDA, PDARule, PDAState, PDATransition, RuleRef, StateId, Sym, TransitionId } from './types';

export { compareNames, compareSymbols, freshId };

/* ------------------------------------------------------------------ */
/* Símbolos                                                            */
/* ------------------------------------------------------------------ */

/** Exatamente 1 caractere (code point). */
export function isChar(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && s.length <= 2 && Array.from(s).length === 1;
}

/** `a` de "a, X/γ": 1 caractere ou ε. */
export function isValidRead(read: unknown): boolean {
  return read === EPSILON || isChar(read);
}

/** `X` de "a, X/γ" (e o Z0): 1 caractere e diferente de ε. */
export function isStackSymbol(sym: unknown): sym is string {
  return isChar(sym) && sym !== EPSILON;
}

/** `γ` de "a, X/γ": qualquer sequência de símbolos sem ε ('' = ε). */
export function isValidPush(push: unknown): boolean {
  return typeof push === 'string' && !push.includes(EPSILON);
}

export function isValidRule(r: PDARule): boolean {
  return isValidRead(r.read) && isStackSymbol(r.pop) && isValidPush(r.push);
}

/** Símbolos sem repetição, em ordem alfabética (por unidade UTF-16, como no Java). */
export function sortSymbols(symbols: Iterable<Sym>): Sym[] {
  return [...new Set(symbols)].sort(compareSymbols);
}

/** Ordem da coluna "a" nas tabelas: Σ em ordem e ε por último. */
export function compareReads(a: Sym, b: Sym): number {
  if (a === b) return 0;
  if (a === EPSILON) return 1;
  if (b === EPSILON) return -1;
  return compareSymbols(a, b);
}

/* ------------------------------------------------------------------ */
/* Grafo: a visão do PDA que os algoritmos usam                        */
/* ------------------------------------------------------------------ */

/** Um movimento possível: uma regra válida de uma transição não pendurada. */
export interface Move {
  via: RuleRef;
  to: StateId;
  read: Sym;
  pop: Sym;
  push: string;
}

/**
 * O PDA "limpo": ignora transições penduradas, regras inválidas, regras
 * repetidas (vale a primeira) e ids de estado repetidos (vale o primeiro).
 */
export interface Graph {
  /** Ids dos estados, na ordem do PDA. */
  ids: StateId[];
  byId: Map<StateId, PDAState>;
  /** Primeiro estado inicial (na ordem de `states`), ou null. */
  initial: StateId | null;
  finals: Set<StateId>;
  /** Movimentos de cada estado, na ordem das transições e, dentro de cada uma, das regras. */
  moves: Map<StateId, Move[]>;
  /** Σ (sem ε), em ordem. */
  sigma: Sym[];
  sigmaSet: Set<Sym>;
  /** Γ (Z0 + pop + push), em ordem. */
  gamma: Sym[];
}

export function buildGraph(pda: PDA): Graph {
  const ids: StateId[] = [];
  const byId = new Map<StateId, PDAState>();
  for (const s of pda.states) {
    if (byId.has(s.id)) continue;
    byId.set(s.id, s);
    ids.push(s.id);
  }
  const initial = ids.find((id) => byId.get(id)!.initial) ?? null;
  const finals = new Set(ids.filter((id) => byId.get(id)!.final));

  const moves = new Map<StateId, Move[]>();
  for (const id of ids) moves.set(id, []);
  const seen = new Set<string>();
  const sigmaSet = new Set<Sym>();
  const gammaSet = new Set<Sym>();
  if (isStackSymbol(pda.startStackSymbol)) gammaSet.add(pda.startStackSymbol);

  for (const t of pda.transitions) {
    if (!byId.has(t.from) || !byId.has(t.to)) continue;
    const list = moves.get(t.from)!;
    t.rules.forEach((r, rule) => {
      if (!isValidRule(r)) return;
      const key = JSON.stringify([t.from, t.to, r.read, r.pop, r.push]);
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ via: { transition: t.id, rule }, to: t.to, read: r.read, pop: r.pop, push: r.push });
      if (r.read !== EPSILON) sigmaSet.add(r.read);
      gammaSet.add(r.pop);
      for (const c of r.push) gammaSet.add(c);
    });
  }

  return {
    ids,
    byId,
    initial,
    finals,
    moves,
    sigma: sortSymbols(sigmaSet),
    sigmaSet,
    gamma: sortSymbols(gammaSet),
  };
}

/** Ordena ids de estados pelo nome (ordem natural); empate pelo id. */
export function sortIdsByName(g: Graph, ids: Iterable<StateId>): StateId[] {
  return [...ids].sort((a, b) => {
    const c = compareNames(g.byId.get(a)?.name ?? a, g.byId.get(b)?.name ?? b);
    return c !== 0 ? c : compareSymbols(a, b);
  });
}

/* ------------------------------------------------------------------ */
/* Cópias e construções                                                */
/* ------------------------------------------------------------------ */

/**
 * Cópia limpa que MANTÉM ids, nomes e a ordem: estados com id repetido somem
 * (vale o primeiro), transições penduradas somem, regras inválidas ou
 * repetidas somem, transições do mesmo par (from, to) viram uma só (na
 * posição da primeira) e transições sem nenhuma regra válida somem. Ids de
 * transição repetidos ganham um id "tN" novo.
 */
export function normalize(pda: PDA): PDA {
  const g = buildGraph(pda);
  const states = g.ids.map((id) => ({ ...g.byId.get(id)! }));

  const byPair = new Map<string, { t: PDATransition; rules: PDARule[]; keys: Set<string> }>();
  const order: string[] = [];
  for (const t of pda.transitions) {
    if (!g.byId.has(t.from) || !g.byId.has(t.to)) continue;
    const pair = JSON.stringify([t.from, t.to]);
    let entry = byPair.get(pair);
    if (!entry) {
      entry = { t, rules: [], keys: new Set() };
      byPair.set(pair, entry);
      order.push(pair);
    }
    for (const r of t.rules) {
      if (!isValidRule(r)) continue;
      const key = JSON.stringify([r.read, r.pop, r.push]);
      if (entry.keys.has(key)) continue;
      entry.keys.add(key);
      entry.rules.push({ read: r.read, pop: r.pop, push: r.push });
    }
  }

  const taken = new Set(pda.transitions.map((t) => t.id));
  const assigned = new Set<TransitionId>();
  const transitions: PDATransition[] = [];
  for (const pair of order) {
    const { t, rules } = byPair.get(pair)!;
    if (rules.length === 0) continue;
    let id = t.id;
    if (assigned.has(id)) {
      id = freshId(taken, 't');
      taken.add(id);
    }
    assigned.add(id);
    transitions.push({ id, from: t.from, to: t.to, rules });
  }
  return { states, transitions, startStackSymbol: pda.startStackSymbol, acceptance: pda.acceptance };
}

/** `base` se estiver livre; senão base', base'', ... (nomes novos das construções do Hopcroft). */
export function primedName(used: Set<string>, base: string): string {
  let name = base;
  while (used.has(name)) name += "'";
  return name;
}

/** Candidatos ao novo fundo de pilha X0 (convenção do index.ts). */
const BOTTOM_CANDIDATES: Sym[] = ['X', '$', '#', '⊥', '@'];

/**
 * Novo fundo de pilha X0: o primeiro de 'X', '$', '#', '⊥', '@' que não está
 * em Γ. Se todos estiverem (raro), o primeiro caractere visível a partir de
 * '!' que não esteja em Γ nem em Σ.
 */
export function freshBottom(g: Graph): Sym {
  const gamma = new Set(g.gamma);
  for (const c of BOTTOM_CANDIDATES) if (!gamma.has(c)) return c;
  for (let code = 0x21; ; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const c = String.fromCodePoint(code);
    if (c === EPSILON || /\s/u.test(c) || gamma.has(c) || g.sigmaSet.has(c)) continue;
    return c;
  }
}
