/**
 * Minimização pelo método da tabela de pares (Hopcroft), em rodadas:
 *  - rodada 0: marca {p,q} quando um é final e o outro não;
 *  - rodada k: marca {p,q} quando, para algum símbolo a (em ordem), o par
 *    {δ(p,a), δ(q,a)} JÁ estava marcado ANTES desta rodada começar.
 *    Assim, a rodada k separa exatamente os estados que uma palavra de
 *    tamanho k distingue (o que o professor faz no quadro);
 *  - para quando uma rodada não marca nada (essa rodada vazia não entra em
 *    `rounds`; a rodada 0 entra sempre).
 *
 * Antes da tabela: determiniza (se preciso), remove inalcançáveis e completa
 * (com Σ do autômato recebido). Por isso o mínimo é COMPLETO e pode ter um
 * estado morto, como no livro. (O DFAMinimize do YAAS também remove os
 * estados inúteis e devolve um AFD parcial: ele tem 1 estado a menos quando
 * a linguagem precisa de estado morto.)
 */
import type { FA, MarkedPair, MinimizationResult, MinimizationRound, StateId } from './types';
import { asDFA } from './determinize';
import { complete, removeUnreachable } from './operations';
import { buildFA, buildGraph, compareNames, sortIdsByName, targets } from './internal';

export function minimize(fa: FA): MinimizationResult {
  const sigma = buildGraph(fa).sigma;
  const asDfa = asDFA(fa);
  // o estado morto não reaproveita o id de um inalcançável removido (a tela compara por id)
  const input = complete(removeUnreachable(asDfa), sigma, asDfa.states.map((s) => s.id));
  const g = buildGraph(input);
  const order = sortIdsByName(g, g.ids);
  const n = order.length;
  const index = new Map(order.map((id, i) => [id, i]));
  const delta = (i: number, sym: string) => index.get(targets(g, order[i]!, sym)[0]!)!;
  const isFinal = (i: number) => g.finals.has(order[i]!);

  // marked[i][j] (i < j): o par já foi marcado
  const marked: boolean[][] = order.map(() => new Array<boolean>(n).fill(false));
  const isMarked = (i: number, j: number) => (i < j ? marked[i]![j]! : marked[j]![i]!);
  const pairOf = (i: number, j: number): [StateId, StateId] =>
    i < j ? [order[i]!, order[j]!] : [order[j]!, order[i]!];
  const markAll = (pairs: MarkedPair[]) => {
    for (const { pair } of pairs) {
      const i = index.get(pair[0])!;
      const j = index.get(pair[1])!;
      marked[Math.min(i, j)]![Math.max(i, j)] = true;
    }
  };

  const rounds: MinimizationRound[] = [];
  const round0: MarkedPair[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (isFinal(i) !== isFinal(j)) round0.push({ pair: pairOf(i, j), symbol: null, because: null });
    }
  }
  rounds.push({ round: 0, newlyMarked: round0 });
  markAll(round0);

  for (let r = 1; ; r++) {
    const newly: MarkedPair[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (marked[i]![j]) continue;
        for (const sym of sigma) {
          const p = delta(i, sym);
          const q = delta(j, sym);
          if (p !== q && isMarked(p, q)) {
            newly.push({ pair: pairOf(i, j), symbol: sym, because: pairOf(p, q) });
            break;
          }
        }
      }
    }
    if (newly.length === 0) break;
    rounds.push({ round: r, newlyMarked: newly });
    markAll(newly);
  }

  // grupos: estados que nunca foram separados (é uma relação de equivalência)
  const groupOf = new Array<number>(n).fill(-1);
  const groups: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (groupOf[i] !== -1) continue;
    const group = [i];
    groupOf[i] = groups.length;
    for (let j = i + 1; j < n; j++) {
      if (groupOf[j] === -1 && !marked[i]![j]) {
        group.push(j);
        groupOf[j] = groups.length;
      }
    }
    groups.push(group);
  }

  const groupNames = nameGroups(groups.map((group) => group.map((i) => g.byId.get(order[i]!)!.name)));

  const initialIndex = index.get(g.initials[0]!)!;
  const keyOf = (gi: number) => String(gi);
  const { fa: dfa, idOf } = buildFA({
    keys: groups.map((_, gi) => keyOf(gi)),
    initial: [keyOf(groupOf[initialIndex]!)],
    isFinal: (k) => isFinal(groups[Number(k)]![0]!),
    edges: groups.flatMap((group, gi) =>
      sigma.map((sym) => ({ from: keyOf(gi), sym, to: keyOf(groupOf[delta(group[0]!, sym)]!) })),
    ),
    name: (k) => groupNames[Number(k)]!,
  });

  const merged: Record<StateId, StateId[]> = {};
  groups.forEach((group, gi) => {
    merged[idOf.get(keyOf(gi))!] = group.map((i) => order[i]!);
  });

  return {
    dfa,
    input,
    table: { order, rounds, groups: groups.map((group) => group.map((i) => order[i]!)) },
    merged,
  };
}

/**
 * Nome de cada estado do mínimo.
 *  - estado sozinho: mantém o nome;
 *  - grupo de estados comuns: "{A,E}" (como no Hopcroft);
 *  - grupo de estados que já são conjuntos (vindos do AFN → AFD, ex.: "{q2,q3}" e
 *    "{q3}"): a UNIÃO dos conjuntos, "{q2,q3}", em vez de "{{q2,q3},{q3}}".
 *    Se a união repetir o nome de outro grupo, volta para o formato aninhado.
 */
function nameGroups(groups: string[][]): string[] {
  const plain = groups.map((members) => (members.length === 1 ? members[0]! : `{${members.join(',')}}`));
  const flat = groups.map((members, gi) => {
    if (members.length === 1) return plain[gi]!;
    const inner = members.map(setElements);
    if (inner.some((x) => x === null)) return plain[gi]!;
    const union = [...new Set(inner.flatMap((x) => x!))].sort(compareNames);
    return union.length === 0 ? '∅' : `{${union.join(',')}}`;
  });
  const count = new Map<string, number>();
  for (const n of flat) count.set(n, (count.get(n) ?? 0) + 1);
  return flat.map((n, gi) => (count.get(n)! > 1 ? plain[gi]! : n));
}

/** "{q0,q1}" → ["q0","q1"]; "∅" → []; qualquer outro nome → null. */
function setElements(name: string): string[] | null {
  if (name === '∅') return [];
  if (!name.startsWith('{') || !name.endsWith('}') || name.slice(1, -1).includes('{')) return null;
  const body = name.slice(1, -1).trim();
  return body === '' ? [] : body.split(',').map((x) => x.trim());
}
