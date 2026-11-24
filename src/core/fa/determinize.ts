/**
 * Construção de subconjuntos (com fecho-ε), como o FADeterminize do YAAS,
 * mas com duas diferenças de propósito:
 *  - o conjunto vazio vira o estado "∅" quando é alcançado (o YAAS descarta);
 *  - nomes no estilo do Hopcroft: "{q0,q1}" (o YAAS usa A, B, C...).
 * Sem estado inicial, o conjunto de partida é ∅ (um único estado "∅").
 */
import type { DeterminizeResult, FA, StateId } from './types';
import { buildFA, buildGraph, closure, isDeterministic, move, sortIdsByName } from './internal';

export function determinize(fa: FA): DeterminizeResult {
  const g = buildGraph(fa);
  const keyOf = (set: Set<StateId>) => JSON.stringify(sortIdsByName(g, set));

  const start = closure(g, g.initials);
  const sets = new Map<string, StateId[]>();
  const edges: Array<{ from: string; sym: string; to: string }> = [];
  const queue: string[] = [];

  const startKey = keyOf(start);
  sets.set(startKey, sortIdsByName(g, start));
  queue.push(startKey);
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i]!;
    const current = sets.get(key)!;
    for (const sym of g.sigma) {
      const next = closure(g, move(g, current, sym));
      const nextKey = keyOf(next);
      if (!sets.has(nextKey)) {
        sets.set(nextKey, sortIdsByName(g, next));
        queue.push(nextKey);
      }
      edges.push({ from: key, sym, to: nextKey });
    }
  }

  // nomes repetidos no autômato (só em arquivo editado à mão): o id desfaz a ambiguidade
  const nameCount = new Map<string, number>();
  for (const s of g.byId.values()) nameCount.set(s.name, (nameCount.get(s.name) ?? 0) + 1);
  const label = (id: StateId) => {
    const name = g.byId.get(id)!.name;
    return nameCount.get(name)! > 1 ? `${name}[${id}]` : name;
  };
  const nameOf = (key: string) => {
    const members = sets.get(key)!;
    if (members.length === 0) return '∅';
    return `{${members.map(label).join(',')}}`;
  };
  const { fa: dfa, idOf } = buildFA({
    keys: queue,
    initial: [startKey],
    isFinal: (key) => sets.get(key)!.some((id) => g.finals.has(id)),
    edges,
    name: nameOf,
  });

  const subsets: Record<StateId, StateId[]> = {};
  for (const key of queue) subsets[idOf.get(key)!] = sets.get(key)!;
  return { dfa, subsets };
}

/**
 * O próprio FA se ele já é um AFD com exatamente um inicial; senão, o
 * resultado de determinize. Serve para os algoritmos que precisam de AFD.
 */
export function asDFA(fa: FA): FA {
  const g = buildGraph(fa);
  if (g.initials.length === 1 && isDeterministic(g)) return fa;
  return determinize(fa).dfa;
}
