/** Σ, validação, tipo, fecho-ε e definição formal. */
import { EPSILON } from './types';
import type { FA, FAType, FormalDefinition, StateId, Sym, ValidationIssue } from './types';
import {
  buildGraph,
  closure,
  isDeterministic,
  isValidSymbol,
  sortIdsByName,
  sortSymbols,
} from './internal';

export function alphabet(fa: FA): Sym[] {
  return buildGraph(fa).sigma;
}

export function validate(fa: FA): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const initials = fa.states.filter((s) => s.initial).map((s) => s.id);
  if (initials.length === 0) issues.push({ kind: 'NO_INITIAL_STATE' });
  if (initials.length > 1) issues.push({ kind: 'MULTIPLE_INITIAL_STATES', states: initials });

  const ids = new Set(fa.states.map((s) => s.id));
  for (const t of fa.transitions) {
    if (!ids.has(t.from) || !ids.has(t.to)) {
      issues.push({ kind: 'DANGLING_TRANSITION', transition: t.id });
    }
    for (const symbol of t.symbols) {
      if (!isValidSymbol(symbol)) {
        issues.push({ kind: 'INVALID_SYMBOL', transition: t.id, symbol });
      }
    }
  }

  const byName = new Map<string, StateId[]>();
  for (const st of fa.states) byName.set(st.name, [...(byName.get(st.name) ?? []), st.id]);
  for (const [name, states] of byName) {
    if (states.length > 1) issues.push({ kind: 'DUPLICATE_NAME', name, states });
  }
  return issues;
}

export function classify(fa: FA): FAType {
  if (fa.states.length === 0) return 'EMPTY';
  const g = buildGraph(fa);
  // mais de um inicial (arquivo editado à mão) roda como AFN
  if (g.initials.length <= 1 && isDeterministic(g)) return 'DFA';
  for (const bySym of g.delta.values()) {
    if (bySym.has(EPSILON)) return 'ENFA';
  }
  return 'NFA';
}

export function eclose(fa: FA, from: StateId | StateId[]): StateId[] {
  const g = buildGraph(fa);
  return sortIdsByName(g, closure(g, typeof from === 'string' ? [from] : from));
}

export function formalDefinition(fa: FA): FormalDefinition {
  const g = buildGraph(fa);
  const nameOf = (id: StateId) => g.byId.get(id)!.name;
  const ordered = sortIdsByName(g, g.ids);

  const delta: FormalDefinition['delta'] = [];
  for (const from of ordered) {
    const bySym = g.delta.get(from)!;
    for (const symbol of sortSymbols(bySym.keys())) {
      const to = sortIdsByName(g, bySym.get(symbol)!.keys()).map(nameOf);
      delta.push({ from: nameOf(from), symbol, to });
    }
  }

  const first = g.initials[0];
  return {
    states: ordered.map(nameOf),
    alphabet: g.sigma,
    delta,
    initial: first === undefined ? null : nameOf(first),
    finals: ordered.filter((id) => g.finals.has(id)).map(nameOf),
    type: classify(fa),
  };
}
