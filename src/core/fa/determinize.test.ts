import { classify, determinize, equivalent } from './index';
import { FA_EXAMPLES } from './examples';
import { example, fa } from './test-helpers';

describe('determinize', () => {
  it('AFN termina em 01: {q0}, {q0,q1}, {q0,q2} (como no quadro)', () => {
    const { dfa, subsets } = determinize(example('afn-termina-01').fa);
    expect(dfa.states).toEqual([
      { id: 'q0', name: '{q0}', initial: true, final: false },
      { id: 'q1', name: '{q0,q1}', initial: false, final: false },
      { id: 'q2', name: '{q0,q2}', initial: false, final: true },
    ]);
    expect(subsets).toEqual({ q0: ['q0'], q1: ['q0', 'q1'], q2: ['q0', 'q2'] });
    expect(dfa.transitions).toEqual([
      { id: 't0', from: 'q0', to: 'q1', symbols: ['0'] },
      { id: 't1', from: 'q0', to: 'q0', symbols: ['1'] },
      { id: 't2', from: 'q1', to: 'q1', symbols: ['0'] },
      { id: 't3', from: 'q1', to: 'q2', symbols: ['1'] },
      { id: 't4', from: 'q2', to: 'q1', symbols: ['0'] },
      { id: 't5', from: 'q2', to: 'q0', symbols: ['1'] },
    ]);
  });

  it('cria o estado ∅ quando ele é alcançado, com laço em todos os símbolos', () => {
    const { dfa, subsets } = determinize(example('afd-so-01').fa);
    expect(dfa.states.map((s) => s.name)).toEqual(['{q0}', '{q1}', '∅', '{q2}']);
    expect(subsets.q2).toEqual([]);
    expect(dfa.transitions).toContainEqual({ id: expect.any(String), from: 'q2', to: 'q2', symbols: ['0', '1'] });
    // o resultado é total
    for (const s of dfa.states) {
      const symbols = dfa.transitions.filter((t) => t.from === s.id).flatMap((t) => t.symbols);
      expect(symbols.sort()).toEqual(['0', '1']);
    }
  });

  it('não cria ∅ quando não precisa', () => {
    const { dfa } = determinize(example('afd-termina-01').fa);
    expect(dfa.states.map((s) => s.name)).toEqual(['{q0}', '{q1}', '{q2}']);
  });

  it('ε-AFN: o inicial já é ECLOSE(q0)', () => {
    const { dfa, subsets } = determinize(example('enfa-numero-decimal').fa);
    expect(dfa.states[0]).toMatchObject({ id: 'q0', name: '{q0,q1}', initial: true });
    expect(subsets.q0).toEqual(['q0', 'q1']);
    // depois de "1." estamos em {q2,q3,q5}: final (q5 entra por ε)
    const finals = dfa.states.filter((s) => s.final).map((s) => s.name);
    expect(finals).toContain('{q2,q3,q5}');
  });

  it('laço ε e ciclo ε', () => {
    const cycle = fa('q0', ['q3'], ['q0 ε q1', 'q1 ε q2', 'q2 ε q0', 'q2 a q3', 'q3 ε q3']);
    const { dfa } = determinize(cycle);
    expect(dfa.states.map((s) => s.name)).toEqual(['{q0,q1,q2}', '{q3}', '∅']);
    expect(dfa.states[1]!.final).toBe(true);
  });

  it('só estados alcançáveis', () => {
    const { dfa } = determinize(example('minimizacao-02').fa);
    // E, F, G, H são inalcançáveis no original
    expect(dfa.states.map((s) => s.name)).toEqual(['{A}', '{B}', '{C}', '{D}']);
  });

  it('sem inicial: um único estado ∅', () => {
    const { dfa, subsets } = determinize(fa(null, ['q1'], ['q0 a q1']));
    expect(dfa.states).toEqual([{ id: 'q0', name: '∅', initial: true, final: false }]);
    expect(dfa.transitions).toEqual([{ id: 't0', from: 'q0', to: 'q0', symbols: ['a'] }]);
    expect(subsets).toEqual({ q0: [] });
  });

  it.each(FA_EXAMPLES.map((e) => [e.id, e.fa] as const))('%s: vira AFD equivalente', (_id, a) => {
    const { dfa, subsets } = determinize(a);
    expect(classify(dfa)).toBe('DFA');
    expect(equivalent(a, dfa)).toEqual({ equivalent: true });
    expect(dfa.states.filter((s) => s.initial)).toHaveLength(1);
    expect(Object.keys(subsets).sort()).toEqual(dfa.states.map((s) => s.id).sort());
    // no máximo uma transição por par (from, to)
    const pairs = dfa.transitions.map((t) => `${t.from}>${t.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});
