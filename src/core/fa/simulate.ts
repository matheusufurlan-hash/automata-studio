/**
 * Simulação passo a passo (AFD, AFN e ε-AFN), como no FA.accepts do YAAS:
 * conjunto de estados ativos, sempre fechado por ε.
 *
 * Regras dos passos:
 *  - passo 0 = ECLOSE(inicial), antes de ler qualquer símbolo;
 *  - passo k = ECLOSE(δ(ativos do passo k-1, k-ésimo símbolo));
 *  - `viaEpsilon` = estados que só entraram pelo fecho-ε (no passo 0, todos
 *    menos o próprio inicial);
 *  - `usedTransitions` = transições que leram o símbolo + transições ε
 *    percorridas no fecho (no passo 0, só as ε do fecho do inicial);
 *  - símbolo fora de Σ: para ANTES de lê-lo (SYMBOL_NOT_IN_ALPHABET);
 *  - nenhum estado ativo depois de ler: um último passo com `active` vazio
 *    mostra o símbolo que matou a simulação (DEAD_END);
 *  - sem estado inicial: `steps` vazio (NO_INITIAL_STATE).
 *  Se houver mais de um inicial (arquivo inválido), todos começam ativos.
 */
import { EPSILON } from './types';
import type { FA, SimulationResult, SimulationStep, StateId, TransitionId } from './types';
import { buildGraph, closure, sortIdsByName, type Graph } from './internal';

export function simulate(fa: FA, word: string): SimulationResult {
  const g = buildGraph(fa);
  const chars = Array.from(word);
  if (g.initials.length === 0) {
    return { accepted: false, steps: [], reason: 'NO_INITIAL_STATE' };
  }

  const order = transitionOrder(fa);
  const start = new Set(g.initials);
  let active = closure(g, start);
  const steps: SimulationStep[] = [
    {
      index: 0,
      read: null,
      consumed: '',
      remaining: word,
      active: sortIdsByName(g, active),
      viaEpsilon: sortIdsByName(g, [...active].filter((s) => !start.has(s))),
      usedTransitions: epsilonTransitionsFrom(g, active).sort(
        (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
      ),
    },
  ];

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (!g.sigmaSet.has(c)) {
      return { accepted: false, steps, reason: 'SYMBOL_NOT_IN_ALPHABET', stoppedAt: i };
    }

    const direct = new Set<StateId>();
    const used = new Set<TransitionId>();
    for (const s of active) {
      const byTarget = g.delta.get(s)!.get(c);
      if (!byTarget) continue;
      for (const [to, tids] of byTarget) {
        direct.add(to);
        for (const tid of tids) used.add(tid);
      }
    }

    const base = {
      index: i + 1,
      read: c,
      consumed: chars.slice(0, i + 1).join(''),
      remaining: chars.slice(i + 1).join(''),
    };

    if (direct.size === 0) {
      steps.push({ ...base, active: [], viaEpsilon: [], usedTransitions: [] });
      return { accepted: false, steps, reason: 'DEAD_END', stoppedAt: i };
    }

    active = closure(g, direct);
    for (const tid of epsilonTransitionsFrom(g, active)) used.add(tid);
    steps.push({
      ...base,
      active: sortIdsByName(g, active),
      viaEpsilon: sortIdsByName(g, [...active].filter((s) => !direct.has(s))),
      usedTransitions: [...used].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
    });
  }

  const accepted = [...active].some((s) => g.finals.has(s));
  return accepted ? { accepted, steps } : { accepted, steps, reason: 'ENDED_IN_NON_FINAL' };
}

/** Mesmo resultado que simulate(fa, word).accepted, sem montar os passos. */
export function accepts(fa: FA, word: string): boolean {
  return acceptsInGraph(buildGraph(fa), word);
}

/** Versão para quem testa muitas palavras no mesmo FA. */
export function acceptsInGraph(g: Graph, word: string): boolean {
  if (g.initials.length === 0) return false;
  let active = closure(g, g.initials);
  for (const c of word) {
    if (!g.sigmaSet.has(c)) return false;
    const direct = new Set<StateId>();
    for (const s of active) {
      const byTarget = g.delta.get(s)!.get(c);
      if (byTarget) for (const to of byTarget.keys()) direct.add(to);
    }
    if (direct.size === 0) return false;
    active = closure(g, direct);
  }
  for (const s of active) if (g.finals.has(s)) return true;
  return false;
}

function epsilonTransitionsFrom(g: Graph, states: Set<StateId>): TransitionId[] {
  const result: TransitionId[] = [];
  for (const s of states) {
    const byTarget = g.delta.get(s)!.get(EPSILON);
    if (byTarget) for (const tids of byTarget.values()) result.push(...tids);
  }
  return result;
}

function transitionOrder(fa: FA): Map<TransitionId, number> {
  const order = new Map<TransitionId, number>();
  fa.transitions.forEach((t, i) => {
    if (!order.has(t.id)) order.set(t.id, i);
  });
  return order;
}
