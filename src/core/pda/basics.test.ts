import type { PDA } from './types';
import { DEFAULT_START_STACK_SYMBOL, EPSILON } from './types';
import { classify, formalDefinition, formatConfig, inputAlphabet, stackAlphabet, validate } from './index';
import { hopcroft62, pda } from './test-helpers';

describe('inputAlphabet e stackAlphabet', () => {
  it('Exemplo 6.2: Σ = {0, 1} e Γ = {0, 1, Z}', () => {
    expect(inputAlphabet(hopcroft62())).toEqual(['0', '1']);
    expect(stackAlphabet(hopcroft62())).toEqual(['0', '1', 'Z']);
  });

  it('Σ ignora ε; Γ junta Z0, pop e todos os símbolos de push, em ordem', () => {
    const p = pda('q0', [], ['q0 b,Z/XYZ|ε,X/ε q1', 'q1 a,Y/W q1'], { z0: 'Z' });
    expect(inputAlphabet(p)).toEqual(['a', 'b']);
    expect(stackAlphabet(p)).toEqual(['W', 'X', 'Y', 'Z']);
  });

  it('Γ tem o Z0 mesmo sem nenhuma regra; AP vazio tem Σ vazio', () => {
    const empty: PDA = { states: [], transitions: [], startStackSymbol: 'Z', acceptance: 'FINAL_STATE' };
    expect(inputAlphabet(empty)).toEqual([]);
    expect(stackAlphabet(empty)).toEqual(['Z']);
    expect(DEFAULT_START_STACK_SYMBOL).toBe('Z');
  });

  it('regras inválidas e transições penduradas não entram nos alfabetos', () => {
    const p = pda('q0', [], ['q0 a,Z/Z q0']);
    p.transitions.push(
      { id: 'x1', from: 'q0', to: 'q0', rules: [{ read: 'bc', pop: 'Z', push: 'Q' }] },
      { id: 'x2', from: 'q0', to: 'nada', rules: [{ read: 'd', pop: 'Z', push: 'R' }] },
      { id: 'x3', from: 'q0', to: 'q0', rules: [{ read: 'e', pop: EPSILON, push: 'S' }] },
    );
    expect(inputAlphabet(p)).toEqual(['a']);
    expect(stackAlphabet(p)).toEqual(['Z']);
  });
});

describe('validate', () => {
  it('AP válido: nenhum problema', () => {
    expect(validate(hopcroft62())).toEqual([]);
  });

  it('sem inicial, mais de um inicial, Z0 inválido', () => {
    expect(validate(pda(null, [], ['q0 a,Z/Z q1']))).toEqual([{ kind: 'NO_INITIAL_STATE' }]);
    const two = pda('q0', [], ['q0 a,Z/Z q1']);
    two.states[1]!.initial = true;
    expect(validate(two)).toEqual([{ kind: 'MULTIPLE_INITIAL_STATES', states: ['q0', 'q1'] }]);
    for (const z0 of ['', EPSILON, 'Z0']) {
      expect(validate(pda('q0', [], [], { z0 }))).toEqual([{ kind: 'INVALID_START_STACK_SYMBOL' }]);
    }
  });

  it('regras inválidas: read, pop e push', () => {
    const p = pda('q0', [], []);
    p.transitions = [
      {
        id: 't0',
        from: 'q0',
        to: 'q0',
        rules: [
          { read: 'ab', pop: 'Z', push: '' },
          { read: '', pop: 'Z', push: '' },
          { read: 'a', pop: EPSILON, push: '' },
          { read: 'a', pop: '', push: '' },
          { read: 'a', pop: 'ZZ', push: '' },
          { read: 'a', pop: 'Z', push: `0${EPSILON}` },
          { read: EPSILON, pop: 'Z', push: 'ZZ' },
          { read: 'ab', pop: EPSILON, push: EPSILON },
        ],
      },
    ];
    expect(validate(p)).toEqual([
      { kind: 'INVALID_READ', transition: 't0', rule: 0 },
      { kind: 'INVALID_READ', transition: 't0', rule: 1 },
      { kind: 'INVALID_POP', transition: 't0', rule: 2 },
      { kind: 'INVALID_POP', transition: 't0', rule: 3 },
      { kind: 'INVALID_POP', transition: 't0', rule: 4 },
      { kind: 'INVALID_PUSH', transition: 't0', rule: 5 },
      { kind: 'INVALID_READ', transition: 't0', rule: 7 },
      { kind: 'INVALID_POP', transition: 't0', rule: 7 },
      { kind: 'INVALID_PUSH', transition: 't0', rule: 7 },
    ]);
  });

  it('transição pendurada e nomes repetidos', () => {
    const p = pda('q0', [], ['q0 a,Z/Z q1']);
    p.transitions.push({ id: 'x', from: 'q1', to: 'sumiu', rules: [] });
    p.states[1]!.name = 'q0';
    expect(validate(p)).toEqual([
      { kind: 'DANGLING_TRANSITION', transition: 'x' },
      { kind: 'DUPLICATE_NAME', name: 'q0', states: ['q0', 'q1'] },
    ]);
  });

  it('autômato sem estados: só falta o inicial', () => {
    expect(validate({ states: [], transitions: [], startStackSymbol: 'Z', acceptance: 'EMPTY_STACK' })).toEqual([
      { kind: 'NO_INITIAL_STATE' },
    ]);
  });
});

describe('classify', () => {
  it('EMPTY sem estados', () => {
    expect(classify({ states: [], transitions: [], startStackSymbol: 'Z', acceptance: 'FINAL_STATE' })).toBe('EMPTY');
  });

  it('Exemplo 6.2 não é determinístico (ε, Z/Z junto com 0, Z/0Z)', () => {
    expect(classify(hopcroft62())).toBe('PDA');
  });

  it('wcwᴿ com marca no meio é DPDA', () => {
    const p = pda('q0', ['q2'], [
      'q0 0,Z/0Z|1,Z/1Z|0,0/00|0,1/01|1,0/10|1,1/11 q0',
      'q0 c,Z/Z|c,0/0|c,1/1 q1',
      'q1 0,0/ε|1,1/ε q1',
      'q1 ε,Z/Z q2',
    ]);
    expect(classify(p)).toBe('DPDA');
  });

  it('dois movimentos para o mesmo (q, a, X) → PDA, mesmo em transições diferentes', () => {
    expect(classify(pda('q0', [], ['q0 a,Z/Z q1', 'q0 a,Z/ε q2']))).toBe('PDA');
    expect(classify(pda('q0', [], ['q0 a,Z/Z|a,Z/XZ q1']))).toBe('PDA');
  });

  it('a mesma regra repetida conta uma vez só', () => {
    expect(classify(pda('q0', [], ['q0 a,Z/Z|a,Z/Z q1', 'q0 a,Z/Z q1']))).toBe('DPDA');
  });

  it('ε com um topo X só atrapalha se houver regra lendo símbolo com o MESMO X', () => {
    expect(classify(pda('q0', [], ['q0 a,X/ε|ε,Z/Z q1']))).toBe('DPDA');
    expect(classify(pda('q0', [], ['q0 a,Z/ε q1', 'q0 ε,Z/Z q2']))).toBe('PDA');
    // dois movimentos ε diferentes com o mesmo topo
    expect(classify(pda('q0', [], ['q0 ε,Z/Z q1', 'q0 ε,Z/ε q1']))).toBe('PDA');
  });

  it('regras inválidas não contam', () => {
    const p = pda('q0', [], ['q0 a,Z/Z q1']);
    p.transitions[0]!.rules.push({ read: 'a', pop: EPSILON, push: '' });
    expect(classify(p)).toBe('DPDA');
  });
});

describe('formalDefinition', () => {
  it('Exemplo 6.2: P = ({q0, q1, q2}, {0, 1}, {0, 1, Z}, δ, q0, Z, {q2})', () => {
    const d = formalDefinition(hopcroft62());
    expect(d.states).toEqual(['q0', 'q1', 'q2']);
    expect(d.inputAlphabet).toEqual(['0', '1']);
    expect(d.stackAlphabet).toEqual(['0', '1', 'Z']);
    expect(d.initial).toBe('q0');
    expect(d.startStackSymbol).toBe('Z');
    expect(d.finals).toEqual(['q2']);
    expect(d.acceptance).toBe('FINAL_STATE');
    expect(d.type).toBe('PDA');
    expect(d.delta).toEqual([
      { from: 'q0', read: '0', pop: '0', to: [{ state: 'q0', push: '00' }] },
      { from: 'q0', read: '0', pop: '1', to: [{ state: 'q0', push: '01' }] },
      { from: 'q0', read: '0', pop: 'Z', to: [{ state: 'q0', push: '0Z' }] },
      { from: 'q0', read: '1', pop: '0', to: [{ state: 'q0', push: '10' }] },
      { from: 'q0', read: '1', pop: '1', to: [{ state: 'q0', push: '11' }] },
      { from: 'q0', read: '1', pop: 'Z', to: [{ state: 'q0', push: '1Z' }] },
      { from: 'q0', read: 'ε', pop: '0', to: [{ state: 'q1', push: '0' }] },
      { from: 'q0', read: 'ε', pop: '1', to: [{ state: 'q1', push: '1' }] },
      { from: 'q0', read: 'ε', pop: 'Z', to: [{ state: 'q1', push: 'Z' }] },
      { from: 'q1', read: '0', pop: '0', to: [{ state: 'q1', push: '' }] },
      { from: 'q1', read: '1', pop: '1', to: [{ state: 'q1', push: '' }] },
      { from: 'q1', read: 'ε', pop: 'Z', to: [{ state: 'q2', push: 'Z' }] },
    ]);
  });

  it('nomes em ordem natural; vários destinos na mesma linha; sem inicial = null', () => {
    const p = pda(null, ['q10', 'q2'], ['q10 a,Z/Z q2', 'q10 a,Z/ε q10', 'q2 ε,Z/Z q10'], { acceptance: 'EMPTY_STACK' });
    const d = formalDefinition(p);
    expect(d.states).toEqual(['q2', 'q10']);
    expect(d.finals).toEqual(['q2', 'q10']);
    expect(d.initial).toBeNull();
    expect(d.acceptance).toBe('EMPTY_STACK');
    expect(d.delta).toEqual([
      { from: 'q2', read: 'ε', pop: 'Z', to: [{ state: 'q10', push: 'Z' }] },
      { from: 'q10', read: 'a', pop: 'Z', to: [{ state: 'q2', push: 'Z' }, { state: 'q10', push: '' }] },
    ]);
  });

  it('mais de um inicial: vale o primeiro na ordem de states', () => {
    const p = pda('q1', [], ['q0 a,Z/Z q1'], { states: ['q0', 'q1'] });
    p.states[0]!.initial = true;
    expect(formalDefinition(p).initial).toBe('q0');
  });
});

describe('formatConfig', () => {
  const p = hopcroft62();

  it('(q, w, γ) com o nome do estado', () => {
    expect(formatConfig(p, { state: 'q1', remaining: '011', stack: '0Z' })).toBe('(q1, 011, 0Z)');
  });

  it('ε quando a palavra que falta ou a pilha estão vazias', () => {
    expect(formatConfig(p, { state: 'q2', remaining: '', stack: 'Z' })).toBe('(q2, ε, Z)');
    expect(formatConfig(p, { state: 'q1', remaining: '1', stack: '' })).toBe('(q1, 1, ε)');
    expect(formatConfig(p, { state: 'q1', remaining: '', stack: '' })).toBe('(q1, ε, ε)');
  });

  it('usa o nome (não o id) e cai no id se o estado não existir', () => {
    const renamed = structuredClone(p);
    renamed.states[0]!.name = 'início';
    expect(formatConfig(renamed, { state: 'q0', remaining: '0', stack: 'Z' })).toBe('(início, 0, Z)');
    expect(formatConfig(p, { state: 'x9', remaining: '', stack: 'Z' })).toBe('(x9, ε, Z)');
  });
});
