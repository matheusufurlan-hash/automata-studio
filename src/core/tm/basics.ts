/** Γ, Σ, validação, tipo (DTM/NTM), definição formal e ID no formato do Hopcroft. */
import type { StateId, Sym, TM, TMConfig, TMFormalDefinition, TMIDText, TMMove, TMType, TMValidationIssue } from './types';
import {
  blankOf,
  buildGraph,
  compareNames,
  compareSymbols,
  isDeterministic,
  isTapeSymbol,
  isValidMove,
  sortIdsByName,
} from './internal';

export function tapeAlphabet(tm: TM): Sym[] {
  return buildGraph(tm).gamma;
}

export function inputAlphabet(tm: TM): Sym[] {
  return buildGraph(tm).sigma;
}

export function validate(tm: TM): TMValidationIssue[] {
  const issues: TMValidationIssue[] = [];
  const initials = tm.states.filter((s) => s.initial).map((s) => s.id);
  if (initials.length === 0) issues.push({ kind: 'NO_INITIAL_STATE' });
  if (initials.length > 1) issues.push({ kind: 'MULTIPLE_INITIAL_STATES', states: initials });

  if (!isTapeSymbol(tm.blank)) issues.push({ kind: 'INVALID_BLANK' });
  const blank = blankOf(tm);
  const sigma = Array.isArray(tm.inputAlphabet) ? tm.inputAlphabet : [];
  if (sigma.includes(blank)) issues.push({ kind: 'BLANK_IN_INPUT_ALPHABET' });
  for (const symbol of new Set(sigma)) {
    if (!isTapeSymbol(symbol)) issues.push({ kind: 'INVALID_INPUT_SYMBOL', symbol });
  }

  const ids = new Set(tm.states.map((s) => s.id));
  for (const t of tm.transitions) {
    if (!ids.has(t.from) || !ids.has(t.to)) issues.push({ kind: 'DANGLING_TRANSITION', transition: t.id });
    t.rules.forEach((r, rule) => {
      if (!isTapeSymbol(r.read)) issues.push({ kind: 'INVALID_READ', transition: t.id, rule });
      if (!isTapeSymbol(r.write)) issues.push({ kind: 'INVALID_WRITE', transition: t.id, rule });
      if (!isValidMove(r.move)) issues.push({ kind: 'INVALID_MOVE', transition: t.id, rule });
    });
  }

  const byName = new Map<string, StateId[]>();
  for (const st of tm.states) byName.set(st.name, [...(byName.get(st.name) ?? []), st.id]);
  for (const [name, states] of byName) {
    if (states.length > 1) issues.push({ kind: 'DUPLICATE_NAME', name, states });
  }
  return issues;
}

export function classify(tm: TM): TMType {
  if (tm.states.length === 0) return 'EMPTY';
  return isDeterministic(buildGraph(tm)) ? 'DTM' : 'NTM';
}

export function formalDefinition(tm: TM): TMFormalDefinition {
  const g = buildGraph(tm);
  const nameOf = (id: StateId) => g.byId.get(id)!.name;
  const ordered = sortIdsByName(g, g.ids);
  const order = new Map(g.gamma.map((s, i) => [s, i]));
  const moveOrder = (m: TMMove) => (m === 'L' ? 0 : 1);

  const delta: TMFormalDefinition['delta'] = [];
  for (const from of ordered) {
    const bySymbol = g.moves.get(from)!;
    const symbols = [...bySymbol.keys()].sort((a, b) => order.get(a)! - order.get(b)!);
    for (const read of symbols) {
      const to = bySymbol
        .get(read)!
        .map((m) => ({ state: nameOf(m.to), write: m.write, move: m.move }))
        .sort(
          (a, b) =>
            compareNames(a.state, b.state) || compareSymbols(a.write, b.write) || moveOrder(a.move) - moveOrder(b.move),
        );
      delta.push({ from: nameOf(from), read, to });
    }
  }

  return {
    states: ordered.map(nameOf),
    inputAlphabet: g.sigma,
    inputAlphabetGuessed: g.sigmaGuessed,
    tapeAlphabet: g.gamma,
    delta,
    initial: g.initial === null ? null : nameOf(g.initial),
    blank: g.blank,
    finals: ordered.filter((id) => g.finals.has(id)).map(nameOf),
    acceptance: tm.acceptance,
    type: classify(tm),
  };
}

/**
 * X1…Xi−1 q Xi…Xn: à esquerda, sem os brancos do começo; da cabeça em diante,
 * sem os brancos do fim, mas sempre com a célula da cabeça.
 */
export function formatConfig(tm: TM, config: TMConfig): TMIDText {
  const blank = blankOf(tm);
  const cells = Array.from(config.tape);
  let head = config.head;
  while (head < 0) {
    cells.unshift(blank);
    head++;
  }
  while (head >= cells.length) cells.push(blank);
  let lo = 0;
  while (lo < head && cells[lo] === blank) lo++;
  let hi = cells.length - 1;
  while (hi > head && cells[hi] === blank) hi--;
  const state = tm.states.find((s) => s.id === config.state)?.name ?? config.state;
  return { left: cells.slice(lo, head).join(''), state, right: cells.slice(head, hi + 1).join('') };
}

/** O texto da ID inteiro: left + state + right (para testes e para quem só quer o texto). */
export function idText(t: TMIDText): string {
  return `${t.left}${t.state}${t.right}`;
}

