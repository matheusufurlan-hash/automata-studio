import type { FA } from './types';
import { accepts, simulate } from './index';
import { example, fa } from './test-helpers';

describe('simulate: AFD', () => {
  const dfa = example('afd-termina-01').fa;

  it('passo a passo de 1001', () => {
    const r = simulate(dfa, '1001');
    expect(r.accepted).toBe(true);
    expect(r.reason).toBeUndefined();
    expect(r.stoppedAt).toBeUndefined();
    expect(r.steps).toEqual([
      { index: 0, read: null, consumed: '', remaining: '1001', active: ['q0'], viaEpsilon: [], usedTransitions: [] },
      { index: 1, read: '1', consumed: '1', remaining: '001', active: ['q0'], viaEpsilon: [], usedTransitions: ['t0'] },
      { index: 2, read: '0', consumed: '10', remaining: '01', active: ['q1'], viaEpsilon: [], usedTransitions: ['t1'] },
      { index: 3, read: '0', consumed: '100', remaining: '1', active: ['q1'], viaEpsilon: [], usedTransitions: ['t2'] },
      { index: 4, read: '1', consumed: '1001', remaining: '', active: ['q2'], viaEpsilon: [], usedTransitions: ['t3'] },
    ]);
  });

  it('rejeita quando termina fora de um final', () => {
    const r = simulate(dfa, '10');
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('ENDED_IN_NON_FINAL');
    expect(r.steps).toHaveLength(3);
    expect(r.stoppedAt).toBeUndefined();
  });

  it('palavra vazia: um único passo (índice 0)', () => {
    const r = simulate(dfa, '');
    expect(r.steps).toEqual([
      { index: 0, read: null, consumed: '', remaining: '', active: ['q0'], viaEpsilon: [], usedTransitions: [] },
    ]);
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('ENDED_IN_NON_FINAL');
    // inicial final: aceita a palavra vazia
    expect(simulate(example('minimizacao-05').fa, '').accepted).toBe(true);
  });
});

describe('simulate: rejeições', () => {
  it('DEAD_END: último passo sem estados ativos, mostrando o símbolo que matou', () => {
    const r = simulate(example('afd-so-01').fa, '00');
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('DEAD_END');
    expect(r.stoppedAt).toBe(1);
    expect(r.steps).toHaveLength(3);
    expect(r.steps[2]).toEqual({
      index: 2,
      read: '0',
      consumed: '00',
      remaining: '',
      active: [],
      viaEpsilon: [],
      usedTransitions: [],
    });
  });

  it('DEAD_END no terceiro símbolo de 010 (cenário de revisão do YAAS)', () => {
    const r = simulate(example('afd-so-01').fa, '010');
    expect(r.reason).toBe('DEAD_END');
    expect(r.stoppedAt).toBe(2);
    expect(r.steps.map((s) => s.active)).toEqual([['q0'], ['q1'], ['q2'], []]);
  });

  it('SYMBOL_NOT_IN_ALPHABET: para antes do símbolo estranho', () => {
    const r = simulate(example('afd-termina-01').fa, '0a1');
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('SYMBOL_NOT_IN_ALPHABET');
    expect(r.stoppedAt).toBe(1);
    expect(r.steps).toHaveLength(2);
    expect(r.steps[1]!.remaining).toBe('a1');
  });

  it('o primeiro problema vence: morrer antes de chegar no símbolo estranho é DEAD_END', () => {
    const r = simulate(example('afd-so-01').fa, '1x');
    expect(r.reason).toBe('DEAD_END');
    expect(r.stoppedAt).toBe(0);
  });

  it('ε digitado como caractere não é a palavra vazia', () => {
    expect(simulate(example('afd-termina-01').fa, 'ε').reason).toBe('SYMBOL_NOT_IN_ALPHABET');
  });

  it('NO_INITIAL_STATE: nenhum passo', () => {
    const r = simulate(fa(null, ['q1'], ['q0 a q1']), 'a');
    expect(r).toEqual({ accepted: false, steps: [], reason: 'NO_INITIAL_STATE' });
    expect(simulate({ states: [], transitions: [] }, '')).toEqual({
      accepted: false,
      steps: [],
      reason: 'NO_INITIAL_STATE',
    });
  });
});

describe('simulate: ε-AFN', () => {
  const decimal = example('enfa-numero-decimal').fa;

  it('passo 0 já inclui o fecho-ε do inicial', () => {
    const [step0] = simulate(decimal, '').steps;
    expect(step0!.active).toEqual(['q0', 'q1']);
    expect(step0!.viaEpsilon).toEqual(['q1']);
    // passo 0 traz as transições ε do fecho do inicial (contrato, commit a1258ce)
    expect(step0!.usedTransitions.length).toBeGreaterThan(0);
    for (const tid of step0!.usedTransitions) {
      expect(decimal.transitions.find((t) => t.id === tid)!.symbols).toContain('ε');
    }
  });

  it('passo a passo de 1.5 (viaEpsilon e transições ε usadas)', () => {
    const r = simulate(decimal, '1.5');
    expect(r.accepted).toBe(true);
    expect(r.steps.slice(1)).toEqual([
      { index: 1, read: '1', consumed: '1', remaining: '.5', active: ['q1', 'q4'], viaEpsilon: [], usedTransitions: ['t1', 't3'] },
      { index: 2, read: '.', consumed: '1.', remaining: '5', active: ['q2', 'q3', 'q5'], viaEpsilon: ['q5'], usedTransitions: ['t2', 't6', 't7'] },
      { index: 3, read: '5', consumed: '1.5', remaining: '', active: ['q3', 'q5'], viaEpsilon: ['q5'], usedTransitions: ['t4', 't5', 't6'] },
    ]);
  });

  it('aceita e rejeita como o livro', () => {
    for (const w of ['3.14', '-.5', '+7.', '1.', '.5', '-12.0']) expect(accepts(decimal, w), w).toBe(true);
    for (const w of ['', '42', '.', '+', '+-1.0', '1.2.3']) expect(accepts(decimal, w), w).toBe(false);
  });

  it('laço ε e ciclo ε não travam a simulação', () => {
    const loop = fa('q0', ['q1'], ['q0 ε q0', 'q0 a q1', 'q1 ε q1']);
    expect(simulate(loop, 'a').accepted).toBe(true);
    const cycle = fa('q0', ['q3'], ['q0 ε q1', 'q1 ε q2', 'q2 ε q0', 'q2 a q3']);
    const r = simulate(cycle, 'a');
    expect(r.steps[0]!.active).toEqual(['q0', 'q1', 'q2']);
    expect(r.steps[0]!.viaEpsilon).toEqual(['q1', 'q2']);
    expect(r.accepted).toBe(true);
  });
});

describe('simulate: AFN e casos estranhos', () => {
  it('AFN: vários estados ativos, ordenados por nome', () => {
    const r = simulate(example('afn-termina-01').fa, '001');
    expect(r.steps.map((s) => s.active)).toEqual([['q0'], ['q0', 'q1'], ['q0', 'q1'], ['q0', 'q2']]);
    expect(r.steps[1]!.usedTransitions).toEqual(['t0', 't1']);
    expect(r.accepted).toBe(true);
  });

  it('mais de um inicial (arquivo inválido): todos começam ativos', () => {
    const a = fa('q0', ['q2'], ['q0 a q2', 'q1 b q2'], ['q0', 'q1', 'q2']);
    a.states[1]!.initial = true;
    expect(simulate(a, '').steps[0]!.active).toEqual(['q0', 'q1']);
    expect(accepts(a, 'a')).toBe(true);
    expect(accepts(a, 'b')).toBe(true);
  });

  it('transição pendurada é ignorada (nem o símbolo dela entra em Σ)', () => {
    const a = fa('q0', ['q1'], ['q0 a q1', 'q0 b fantasma'], ['q0', 'q1']);
    expect(accepts(a, 'a')).toBe(true);
    expect(simulate(a, 'b').reason).toBe('SYMBOL_NOT_IN_ALPHABET');
  });

  it('pares (from, to) repetidos: os dois ids aparecem em usedTransitions', () => {
    const a = fa('q0', ['q1'], ['q0 a q1', 'q0 a q1']);
    expect(simulate(a, 'a').steps[1]!.usedTransitions).toEqual(['t0', 't1']);
  });

  it('caractere fora do BMP conta como um símbolo', () => {
    const a = fa('q0', ['q1'], ['q0 😀 q1']);
    const r = simulate(a, '😀');
    expect(r.accepted).toBe(true);
    expect(r.steps[1]!.read).toBe('😀');
  });
});

describe('accepts', () => {
  it('é igual a simulate(...).accepted', () => {
    const cases: Array<[FA, string[]]> = [
      [example('afd-termina-01').fa, ['', '0', '01', '1101', '10', '0a']],
      [example('enfa-numero-decimal').fa, ['', '1.', '.', '+.5', '9']],
      [fa(null, [], [], ['q0']), ['', 'a']],
    ];
    for (const [a, words] of cases) {
      for (const w of words) expect(accepts(a, w), w).toBe(simulate(a, w).accepted);
    }
  });
});
