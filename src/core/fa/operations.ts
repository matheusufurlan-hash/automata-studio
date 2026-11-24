/**
 * Operações sobre AFs: completar, complemento, união, concatenação, estrela,
 * interseção, remoção de estados inalcançáveis/inúteis e equivalência.
 *
 * complete, complement (quando já recebe um AFD), removeUnreachable e
 * removeUseless MANTÊM os ids e nomes dos estados (o aluno reconhece o
 * próprio autômato). union, concat, star e intersection GERAM um autômato
 * novo, com ids e nomes "q0", "q1", ... em ordem de busca em largura.
 */
import { EPSILON } from './types';
import type { EquivalenceResult, FA, FATransition, StateId, Sym } from './types';
import { asDFA } from './determinize';
import {
  buildFA,
  buildGraph,
  compareSymbols,
  freshId,
  freshName,
  graphEdges,
  isAlphabetSymbol,
  normalize,
  reachableFrom,
  targets,
  type Graph,
  type RawFA,
} from './internal';

/* ------------------------------------------------------------------ */
/* complete / complement                                               */
/* ------------------------------------------------------------------ */

/**
 * `reservedIds` (uso interno do núcleo): ids que o estado morto NÃO pode usar,
 * ex.: ids de estados inalcançáveis que a minimização acabou de remover.
 */
export function complete(fa: FA, sigma?: Sym[], reservedIds: Iterable<StateId> = []): FA {
  const g = buildGraph(fa);
  const symbols = sigma ? alphabetFrom(sigma) : g.sigma;
  const base = normalize(fa);

  const missing: Array<{ from: StateId; symbols: Sym[] }> = [];
  for (const id of g.ids) {
    const lacking = symbols.filter((sym) => targets(g, id, sym).length === 0);
    if (lacking.length > 0) missing.push({ from: id, symbols: lacking });
  }
  if (missing.length === 0) return base;

  const dead = freshId(new Set([...g.ids, ...reservedIds]), 'q');
  const name = freshName(new Set(base.states.map((s) => s.name)), '∅');
  const usedTids = new Set(base.transitions.map((t) => t.id));
  const newTransition = (from: StateId, syms: Sym[]): FATransition => {
    const id = freshId(usedTids, 't');
    usedTids.add(id);
    return { id, from, to: dead, symbols: syms };
  };

  return {
    states: [...base.states, { id: dead, name, initial: false, final: false }],
    transitions: [
      ...base.transitions,
      ...missing.map((m) => newTransition(m.from, m.symbols)),
      newTransition(dead, symbols),
    ],
  };
}

export function complement(fa: FA, sigma?: Sym[]): FA {
  const symbols = sigma ? alphabetFrom(sigma) : buildGraph(fa).sigma;
  const allowed = new Set(symbols);
  const dfa = asDFA(fa);
  // complemento relativo a `symbols`: transições com outros símbolos saem
  const restricted: FA = {
    states: dfa.states,
    transitions: dfa.transitions.map((t) => ({
      ...t,
      symbols: t.symbols.filter((s) => allowed.has(s)),
    })),
  };
  const total = complete(restricted, symbols);
  return {
    states: total.states.map((s) => ({ ...s, final: !s.final })),
    transitions: total.transitions,
  };
}

/* ------------------------------------------------------------------ */
/* união, concatenação, estrela (construções de Thompson, com ε)       */
/* ------------------------------------------------------------------ */

const keyA = (id: StateId) => `a:${id}`;
const keyB = (id: StateId) => `b:${id}`;
const NEW = 'new';

export function union(a: FA, b: FA): FA {
  const ga = buildGraph(a);
  const gb = buildGraph(b);
  return buildFA({
    keys: [NEW, ...ga.ids.map(keyA), ...gb.ids.map(keyB)],
    initial: [NEW],
    isFinal: (k) => isFinalKey(k, ga, gb),
    edges: [
      ...ga.initials.map((id) => ({ from: NEW, sym: EPSILON, to: keyA(id) })),
      ...gb.initials.map((id) => ({ from: NEW, sym: EPSILON, to: keyB(id) })),
      ...graphEdges(ga, keyA),
      ...graphEdges(gb, keyB),
    ],
  }).fa;
}

export function concat(a: FA, b: FA): FA {
  const ga = buildGraph(a);
  const gb = buildGraph(b);
  // com exatamente um inicial em `a`, ele é o inicial; senão, um novo com ε
  const single = ga.initials.length === 1;
  const keys = [...(single ? [] : [NEW]), ...ga.ids.map(keyA), ...gb.ids.map(keyB)];
  const edges: RawFA['edges'] = [
    ...(single ? [] : ga.initials.map((id) => ({ from: NEW, sym: EPSILON, to: keyA(id) }))),
    ...graphEdges(ga, keyA),
    ...graphEdges(gb, keyB),
  ];
  for (const f of ga.ids.filter((id) => ga.finals.has(id))) {
    for (const i of gb.initials) edges.push({ from: keyA(f), sym: EPSILON, to: keyB(i) });
  }
  return buildFA({
    keys,
    initial: single ? [keyA(ga.initials[0]!)] : [NEW],
    isFinal: (k) => k.startsWith('b:') && gb.finals.has(k.slice(2)),
    edges,
  }).fa;
}

export function star(a: FA): FA {
  const ga = buildGraph(a);
  // novo inicial (e final) com ε para o inicial antigo; finais voltam por ε
  const edges: RawFA['edges'] = [
    ...ga.initials.map((id) => ({ from: NEW, sym: EPSILON, to: keyA(id) })),
    ...graphEdges(ga, keyA),
    ...ga.ids.filter((id) => ga.finals.has(id)).map((id) => ({ from: keyA(id), sym: EPSILON, to: NEW })),
  ];
  return buildFA({
    keys: [NEW, ...ga.ids.map(keyA)],
    initial: [NEW],
    isFinal: (k) => k === NEW || ga.finals.has(k.slice(2)),
    edges,
  }).fa;
}

function isFinalKey(k: string, ga: Graph, gb: Graph): boolean {
  if (k.startsWith('a:')) return ga.finals.has(k.slice(2));
  if (k.startsWith('b:')) return gb.finals.has(k.slice(2));
  return false;
}

/* ------------------------------------------------------------------ */
/* interseção: produto de AFDs                                         */
/* ------------------------------------------------------------------ */

/**
 * Produto direto dos AFDs (só pares alcançáveis). Diferente do YAAS, que usa
 * De Morgan com o alfabeto de cada autômato e erra quando os alfabetos são
 * diferentes (ver oraculo.test.ts).
 */
export function intersection(a: FA, b: FA): FA {
  const ga = buildGraph(asDFA(a));
  const gb = buildGraph(asDFA(b));
  const common = ga.sigma.filter((s) => gb.sigmaSet.has(s));
  const key = (p: StateId, q: StateId) => JSON.stringify([p, q]);

  const start = key(ga.initials[0]!, gb.initials[0]!);
  const pairs = new Map<string, [StateId, StateId]>([[start, [ga.initials[0]!, gb.initials[0]!]]]);
  const queue = [start];
  const edges: RawFA['edges'] = [];
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i]!;
    const [p, q] = pairs.get(k)!;
    for (const sym of common) {
      const p2 = targets(ga, p, sym)[0];
      const q2 = targets(gb, q, sym)[0];
      if (p2 === undefined || q2 === undefined) continue;
      const k2 = key(p2, q2);
      if (!pairs.has(k2)) {
        pairs.set(k2, [p2, q2]);
        queue.push(k2);
      }
      edges.push({ from: k, sym, to: k2 });
    }
  }

  return buildFA({
    keys: queue,
    initial: [start],
    isFinal: (k) => {
      const [p, q] = pairs.get(k)!;
      return ga.finals.has(p) && gb.finals.has(q);
    },
    edges,
  }).fa;
}

/* ------------------------------------------------------------------ */
/* inalcançáveis e inúteis                                             */
/* ------------------------------------------------------------------ */

export function removeUnreachable(fa: FA): FA {
  const g = buildGraph(fa);
  return normalize(fa, reachableFrom(g, g.initials));
}

export function removeUseless(fa: FA): FA {
  const reachable = removeUnreachable(fa);
  const g = buildGraph(reachable);
  // busca para trás a partir dos finais
  const reverse = new Map<StateId, StateId[]>(g.ids.map((id) => [id, []]));
  for (const from of g.ids) {
    for (const byTarget of g.delta.get(from)!.values()) {
      for (const to of byTarget.keys()) reverse.get(to)!.push(from);
    }
  }
  const useful = new Set<StateId>();
  const stack = g.ids.filter((id) => g.finals.has(id));
  for (const s of stack) useful.add(s);
  while (stack.length > 0) {
    for (const prev of reverse.get(stack.pop()!)!) {
      if (!useful.has(prev)) {
        useful.add(prev);
        stack.push(prev);
      }
    }
  }
  return normalize(reachable, useful);
}

/* ------------------------------------------------------------------ */
/* equivalência                                                        */
/* ------------------------------------------------------------------ */

/**
 * Produto dos dois AFDs (faltou transição = estado morto implícito) com busca
 * em largura e símbolos em ordem: a primeira palavra que separa os dois é a
 * menor (e, entre as menores, a primeira em ordem alfabética).
 */
export function equivalent(a: FA, b: FA): EquivalenceResult {
  const ga = buildGraph(asDFA(a));
  const gb = buildGraph(asDFA(b));
  const sigma = [...new Set([...ga.sigma, ...gb.sigma])].sort(compareSymbols);
  const DEAD = null;
  type Pair = [StateId | null, StateId | null];
  const isFinal = (g: Graph, s: StateId | null) => s !== DEAD && g.finals.has(s);
  const step = (g: Graph, s: StateId | null, sym: Sym) =>
    s === DEAD ? DEAD : (targets(g, s, sym)[0] ?? DEAD);
  const key = (p: Pair) => JSON.stringify(p);

  const start: Pair = [ga.initials[0]!, gb.initials[0]!];
  const seen = new Map<string, string>([[key(start), '']]);
  const queue: Pair[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const pair = queue[i]!;
    const word = seen.get(key(pair))!;
    if (isFinal(ga, pair[0]) !== isFinal(gb, pair[1])) {
      return { equivalent: false, counterexample: word };
    }
    for (const sym of sigma) {
      const next: Pair = [step(ga, pair[0], sym), step(gb, pair[1], sym)];
      const k = key(next);
      if (!seen.has(k)) {
        seen.set(k, word + sym);
        queue.push(next);
      }
    }
  }
  return { equivalent: true };
}

/* ------------------------------------------------------------------ */

function alphabetFrom(sigma: Sym[]): Sym[] {
  return [...new Set(sigma.filter(isAlphabetSymbol))].sort(compareSymbols);
}
