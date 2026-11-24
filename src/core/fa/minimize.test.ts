import type { MinimizationResult } from './types';
import { classify, equivalent, minimize } from './index';
import { FA_EXAMPLES } from './examples';
import { example, fa } from './test-helpers';

/** Nomes de um par de ids do `input`. */
function names(r: MinimizationResult, pair: [string, string] | null): string | null {
  if (!pair) return null;
  const nameOf = (id: string) => r.input.states.find((s) => s.id === id)!.name;
  return `${nameOf(pair[0])}${nameOf(pair[1])}`;
}

describe('minimize: Hopcroft, AFD de A a H (minimizacao-01)', () => {
  const r = minimize(example('minimizacao-01').fa);

  it('D é inalcançável e sai antes da tabela', () => {
    expect(r.input.states.map((s) => s.name)).toEqual(['A', 'B', 'C', 'E', 'F', 'G', 'H']);
    expect(r.table.order.map((id) => r.input.states.find((s) => s.id === id)!.name)).toEqual([
      'A', 'B', 'C', 'E', 'F', 'G', 'H',
    ]);
  });

  it('rodada 0: C (o único final) contra todos', () => {
    const [round0] = r.table.rounds;
    expect(round0!.round).toBe(0);
    expect(round0!.newlyMarked.map((m) => names(r, m.pair))).toEqual(['AC', 'BC', 'CE', 'CF', 'CG', 'CH']);
    expect(round0!.newlyMarked.every((m) => m.symbol === null && m.because === null)).toBe(true);
  });

  it('rodada 1: quem vai para C com um símbolo', () => {
    const round1 = r.table.rounds[1]!;
    expect(round1.newlyMarked.map((m) => `${names(r, m.pair)}:${m.symbol}:${names(r, m.because)}`)).toEqual([
      'AB:1:CF', 'AF:0:BC', 'AH:1:CF', 'BE:1:CF', 'BF:0:CG', 'BG:1:CE',
      'EF:0:CH', 'EH:1:CF', 'FG:0:CG', 'FH:0:CG', 'GH:1:CE',
    ]);
  });

  it('rodada 2: AG e EG; depois nada muda', () => {
    expect(r.table.rounds).toHaveLength(3);
    const round2 = r.table.rounds[2]!;
    expect(round2.newlyMarked.map((m) => `${names(r, m.pair)}:${m.symbol}:${names(r, m.because)}`)).toEqual([
      'AG:0:BG', 'EG:0:GH',
    ]);
  });

  it('grupos {A,E}, {B,H}, C, F, G — 5 estados, como no livro', () => {
    const groupNames = r.table.groups.map((g) => g.map((id) => r.input.states.find((s) => s.id === id)!.name));
    expect(groupNames).toEqual([['A', 'E'], ['B', 'H'], ['C'], ['F'], ['G']]);
    expect(r.dfa.states.map((s) => s.name)).toEqual(['{A,E}', '{B,H}', 'F', 'G', 'C']);
    expect(r.dfa.states.map((s) => s.id)).toEqual(['q0', 'q1', 'q2', 'q3', 'q4']);
    expect(r.dfa.states[0]!.initial).toBe(true);
    expect(r.dfa.states.filter((s) => s.final).map((s) => s.name)).toEqual(['C']);
    expect(r.merged.q0!.map((id) => r.input.states.find((s) => s.id === id)!.name)).toEqual(['A', 'E']);
  });
});

describe('minimize', () => {
  it('junta T0/T1 e U0/U1 (cenário de revisão do YAAS)', () => {
    const r = minimize(example('afd-minimizacao-dois-grupos').fa);
    expect(r.dfa.states.map((s) => s.name)).toEqual(['q0', '{q1,q2}', '{q3,q4}']);
  });

  it('AFD parcial: completa com ∅ antes da tabela e não junta q1 com q2', () => {
    const r = minimize(example('afd-minimizacao-parcial').fa);
    expect(r.input.states.map((s) => s.name)).toEqual(['q0', 'q1', 'q2', 'q3', 'q4', 'q5', '∅']);
    expect(r.dfa.states).toHaveLength(7);
    expect(r.table.groups.every((g) => g.length === 1)).toBe(true);
    // q1 e q2 são separados por "ab" (rodada 2)
    const q1q2 = r.table.rounds.flatMap((x) => x.newlyMarked.map((m) => ({ ...m, round: x.round })))
      .find((m) => names(r, m.pair) === 'q1q2');
    expect(q1q2).toMatchObject({ round: 2, symbol: 'a' });
  });

  it('o estado morto entra no grupo dos estados que não chegam a final', () => {
    const r = minimize(example('minimizacao-09').fa);
    // F já é morto; o mínimo tem 3 estados: {A,B}, {C,D,E} e F
    expect(r.dfa.states.map((s) => s.name)).toEqual(['{A,B}', '{C,D,E}', 'F']);
  });

  it('AFN/ε-AFN: determiniza antes', () => {
    const r = minimize(example('afn-termina-01').fa);
    expect(r.input.states.map((s) => s.name)).toEqual(['{q0}', '{q0,q1}', '{q0,q2}']);
    expect(r.dfa.states).toHaveLength(3);
    expect(minimize(example('enfa-numero-decimal').fa).dfa.states).toHaveLength(6);
  });

  it('todos finais: a rodada 0 não marca nada', () => {
    const r = minimize(fa('q0', ['q0', 'q1'], ['q0 a q1', 'q1 a q0']));
    expect(r.table.rounds).toEqual([{ round: 0, newlyMarked: [] }]);
    expect(r.dfa.states).toEqual([{ id: 'q0', name: '{q0,q1}', initial: true, final: true }]);
    expect(r.dfa.transitions).toEqual([{ id: 't0', from: 'q0', to: 'q0', symbols: ['a'] }]);
  });

  it('linguagem vazia ou sem inicial: um estado só', () => {
    expect(minimize(fa('q0', [], ['q0 a q1'])).dfa.states).toHaveLength(1);
    expect(minimize(fa(null, ['q1'], ['q0 a q1'])).dfa.states).toEqual([
      { id: 'q0', name: '∅', initial: true, final: false },
    ]);
    expect(minimize({ states: [], transitions: [] }).dfa.states).toHaveLength(1);
  });

  it.each(FA_EXAMPLES.map((e) => [e.id, e.fa] as const))('%s: propriedades', (_id, a) => {
    const r = minimize(a);
    expect(classify(r.dfa)).toBe('DFA');
    expect(equivalent(a, r.dfa)).toEqual({ equivalent: true });
    expect(equivalent(a, r.input)).toEqual({ equivalent: true });
    // mínimo de mínimo: mesmo número de estados
    expect(minimize(r.dfa).dfa.states).toHaveLength(r.dfa.states.length);

    // `input` é completo; `order` tem todos os estados de `input`
    const sigma = new Set(a.transitions.flatMap((t) => t.symbols).filter((s) => s !== 'ε'));
    for (const s of r.input.states) {
      const out = r.input.transitions.filter((t) => t.from === s.id).flatMap((t) => t.symbols);
      expect(new Set(out)).toEqual(sigma);
    }
    expect([...r.table.order].sort()).toEqual(r.input.states.map((s) => s.id).sort());

    // cada par é marcado uma vez só, e o "porquê" foi marcado numa rodada anterior
    const roundOf = new Map<string, number>();
    for (const round of r.table.rounds) {
      for (const m of round.newlyMarked) {
        const key = m.pair.join('|');
        expect(roundOf.has(key)).toBe(false);
        roundOf.set(key, round.round);
        if (round.round > 0) {
          expect(roundOf.get(m.because!.join('|'))).toBeLessThan(round.round);
        }
      }
    }
    // grupos = estados do mínimo
    expect(r.table.groups).toHaveLength(r.dfa.states.length);
    expect(Object.values(r.merged).sort()).toEqual([...r.table.groups].sort());
  });
});
