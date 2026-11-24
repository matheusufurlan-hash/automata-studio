/** Σ, Γ, validação, tipo (DPDA/PDA), definição formal e ID no formato do Hopcroft. */
import { EPSILON } from './types';
import type { PDA, PDAConfig, PDAFormalDefinition, PDAType, PDAValidationIssue, StateId, Sym } from './types';
import {
  buildGraph,
  compareNames,
  compareReads,
  compareSymbols,
  isStackSymbol,
  isValidPush,
  isValidRead,
  sortIdsByName,
  type Graph,
} from './internal';

export function inputAlphabet(pda: PDA): Sym[] {
  return buildGraph(pda).sigma;
}

export function stackAlphabet(pda: PDA): Sym[] {
  return buildGraph(pda).gamma;
}

export function validate(pda: PDA): PDAValidationIssue[] {
  const issues: PDAValidationIssue[] = [];
  const initials = pda.states.filter((s) => s.initial).map((s) => s.id);
  if (initials.length === 0) issues.push({ kind: 'NO_INITIAL_STATE' });
  if (initials.length > 1) issues.push({ kind: 'MULTIPLE_INITIAL_STATES', states: initials });
  if (!isStackSymbol(pda.startStackSymbol)) issues.push({ kind: 'INVALID_START_STACK_SYMBOL' });

  const ids = new Set(pda.states.map((s) => s.id));
  for (const t of pda.transitions) {
    if (!ids.has(t.from) || !ids.has(t.to)) issues.push({ kind: 'DANGLING_TRANSITION', transition: t.id });
    t.rules.forEach((r, rule) => {
      if (!isValidRead(r.read)) issues.push({ kind: 'INVALID_READ', transition: t.id, rule });
      if (!isStackSymbol(r.pop)) issues.push({ kind: 'INVALID_POP', transition: t.id, rule });
      if (!isValidPush(r.push)) issues.push({ kind: 'INVALID_PUSH', transition: t.id, rule });
    });
  }

  const byName = new Map<string, StateId[]>();
  for (const st of pda.states) byName.set(st.name, [...(byName.get(st.name) ?? []), st.id]);
  for (const [name, states] of byName) {
    if (states.length > 1) issues.push({ kind: 'DUPLICATE_NAME', name, states });
  }
  return issues;
}

export function classify(pda: PDA): PDAType {
  if (pda.states.length === 0) return 'EMPTY';
  return isDeterministic(buildGraph(pda)) ? 'DPDA' : 'PDA';
}

/**
 * Hopcroft, seção 6.4: no máximo um movimento (p, γ) para cada (q, a, X), e
 * se há movimento lendo a ∈ Σ com X no topo, não há movimento ε com X no topo.
 */
export function isDeterministic(g: Graph): boolean {
  for (const list of g.moves.values()) {
    const count = new Map<string, number>();
    const withSymbol = new Set<Sym>();
    const withEpsilon = new Set<Sym>();
    for (const m of list) {
      const key = JSON.stringify([m.read, m.pop]);
      const n = (count.get(key) ?? 0) + 1;
      if (n > 1) return false;
      count.set(key, n);
      (m.read === EPSILON ? withEpsilon : withSymbol).add(m.pop);
    }
    for (const x of withEpsilon) if (withSymbol.has(x)) return false;
  }
  return true;
}

export function formalDefinition(pda: PDA): PDAFormalDefinition {
  const g = buildGraph(pda);
  const nameOf = (id: StateId) => g.byId.get(id)!.name;
  const ordered = sortIdsByName(g, g.ids);

  const delta: PDAFormalDefinition['delta'] = [];
  for (const from of ordered) {
    const lines = new Map<string, { read: Sym; pop: Sym; to: Array<{ state: string; push: string }> }>();
    for (const m of g.moves.get(from)!) {
      const key = JSON.stringify([m.read, m.pop]);
      let line = lines.get(key);
      if (!line) {
        line = { read: m.read, pop: m.pop, to: [] };
        lines.set(key, line);
      }
      line.to.push({ state: nameOf(m.to), push: m.push });
    }
    const sorted = [...lines.values()].sort((a, b) => compareReads(a.read, b.read) || compareSymbols(a.pop, b.pop));
    for (const line of sorted) {
      line.to.sort((a, b) => compareNames(a.state, b.state) || compareSymbols(a.push, b.push));
      delta.push({ from: nameOf(from), read: line.read, pop: line.pop, to: line.to });
    }
  }

  return {
    states: ordered.map(nameOf),
    inputAlphabet: g.sigma,
    stackAlphabet: g.gamma,
    delta,
    initial: g.initial === null ? null : nameOf(g.initial),
    startStackSymbol: pda.startStackSymbol,
    finals: ordered.filter((id) => g.finals.has(id)).map(nameOf),
    acceptance: pda.acceptance,
    type: classify(pda),
  };
}

export function formatConfig(pda: PDA, config: PDAConfig): string {
  const state = pda.states.find((s) => s.id === config.state)?.name ?? config.state;
  return `(${state}, ${config.remaining || EPSILON}, ${config.stack || EPSILON})`;
}
