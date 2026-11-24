import type { TM } from './types';
import { DEFAULT_BLANK } from './types';
import { EPSILON } from '../common';
import { classify, formalDefinition, formatConfig, inputAlphabet, tapeAlphabet, validate } from './index';
import { hopcroft82, tm } from './test-helpers';

const EMPTY: TM = { states: [], transitions: [], blank: 'B', acceptance: 'FINAL_STATE', inputAlphabet: [] };

describe('tapeAlphabet e inputAlphabet', () => {
  it('Exemplo 8.2: Γ = {0, 1, X, Y, B} (B por último) e Σ = {0, 1}', () => {
    expect(tapeAlphabet(hopcroft82())).toEqual(['0', '1', 'X', 'Y', 'B']);
    expect(inputAlphabet(hopcroft82())).toEqual(['0', '1']);
    expect(DEFAULT_BLANK).toBe('B');
  });

  it('Σ não informado: o palpite é Γ − {B}', () => {
    const m = { ...hopcroft82(), inputAlphabet: [] };
    expect(inputAlphabet(m)).toEqual(['0', '1', 'X', 'Y']);
  });

  it('Σ informado entra em Γ mesmo sem regra; sai sem repetição e em ordem', () => {
    const m = tm('q0', [], ['q0 aaR q0'], { sigma: 'cbab' });
    expect(inputAlphabet(m)).toEqual(['a', 'b', 'c']);
    expect(tapeAlphabet(m)).toEqual(['a', 'b', 'c', 'B']);
  });

  it('o branco pode ser outro símbolo; continua por último', () => {
    const m = tm('q0', [], ['q0 a_R q0', 'q0 _aL q0'], { blank: '_' });
    expect(tapeAlphabet(m)).toEqual(['a', '_']);
    expect(inputAlphabet(m)).toEqual(['a']);
    // 'B' comum (não é o branco) fica em ordem alfabética
    expect(tapeAlphabet(tm('q0', [], ['q0 BaR q0'], { blank: '_' }))).toEqual(['B', 'a', '_']);
  });

  it('regras inválidas, transições penduradas e símbolos inválidos de Σ não entram', () => {
    const m = tm('q0', [], ['q0 aaR q0'], { sigma: 'b' });
    m.inputAlphabet.push('xy', EPSILON, 'B');
    m.transitions.push(
      { id: 'x1', from: 'q0', to: 'q0', rules: [{ read: 'c', write: 'd', move: 'S' as never }] },
      { id: 'x2', from: 'q0', to: 'nada', rules: [{ read: 'e', write: 'e', move: 'R' }] },
    );
    expect(tapeAlphabet(m)).toEqual(['a', 'b', 'B']);
    expect(inputAlphabet(m)).toEqual(['b']);
  });

  it('MT vazia: Γ = {B} e Σ vazio', () => {
    expect(tapeAlphabet(EMPTY)).toEqual(['B']);
    expect(inputAlphabet(EMPTY)).toEqual([]);
  });
});

describe('validate', () => {
  it('MT válida: nenhum problema', () => {
    expect(validate(hopcroft82())).toEqual([]);
  });

  it('sem inicial e com mais de um inicial', () => {
    expect(validate(tm(null, [], ['q0 aaR q1']))).toEqual([{ kind: 'NO_INITIAL_STATE' }]);
    const two = tm('q0', [], ['q0 aaR q1']);
    two.states[1]!.initial = true;
    expect(validate(two)).toEqual([{ kind: 'MULTIPLE_INITIAL_STATES', states: ['q0', 'q1'] }]);
    expect(validate(EMPTY)).toEqual([{ kind: 'NO_INITIAL_STATE' }]);
  });

  it('branco inválido, branco em Σ e símbolos inválidos em Σ', () => {
    for (const blank of ['', EPSILON, 'BB']) {
      expect(validate(tm('q0', [], [], { blank }))).toEqual([{ kind: 'INVALID_BLANK' }]);
    }
    expect(validate(tm('q0', [], [], { sigma: '0B' }))).toEqual([{ kind: 'BLANK_IN_INPUT_ALPHABET' }]);
    const m = tm('q0', [], [], { sigma: '0' });
    m.inputAlphabet.push('01', EPSILON, '', '01');
    expect(validate(m)).toEqual([
      { kind: 'INVALID_INPUT_SYMBOL', symbol: '01' },
      { kind: 'INVALID_INPUT_SYMBOL', symbol: EPSILON },
      { kind: 'INVALID_INPUT_SYMBOL', symbol: '' },
    ]);
  });

  it('regras inválidas: read, write e move', () => {
    const m = tm('q0', [], []);
    m.transitions = [
      {
        id: 't0',
        from: 'q0',
        to: 'q0',
        rules: [
          { read: '', write: 'a', move: 'R' },
          { read: EPSILON, write: 'a', move: 'R' },
          { read: 'a', write: 'ab', move: 'L' },
          { read: 'a', write: EPSILON, move: 'L' },
          { read: 'a', write: 'a', move: 'S' as never },
          { read: 'a', write: 'a', move: 'R' },
          { read: 'ab', write: '', move: 'X' as never },
        ],
      },
    ];
    expect(validate(m)).toEqual([
      { kind: 'INVALID_READ', transition: 't0', rule: 0 },
      { kind: 'INVALID_READ', transition: 't0', rule: 1 },
      { kind: 'INVALID_WRITE', transition: 't0', rule: 2 },
      { kind: 'INVALID_WRITE', transition: 't0', rule: 3 },
      { kind: 'INVALID_MOVE', transition: 't0', rule: 4 },
      { kind: 'INVALID_READ', transition: 't0', rule: 6 },
      { kind: 'INVALID_WRITE', transition: 't0', rule: 6 },
      { kind: 'INVALID_MOVE', transition: 't0', rule: 6 },
    ]);
  });

  it('transição pendurada e nomes repetidos', () => {
    const m = tm('q0', [], ['q0 aaR q1']);
    m.transitions.push({ id: 'x', from: 'sumiu', to: 'q1', rules: [] });
    m.states[1]!.name = 'q0';
    expect(validate(m)).toEqual([
      { kind: 'DANGLING_TRANSITION', transition: 'x' },
      { kind: 'DUPLICATE_NAME', name: 'q0', states: ['q0', 'q1'] },
    ]);
  });
});

describe('classify', () => {
  it('EMPTY sem estados; o Exemplo 8.2 é DTM', () => {
    expect(classify(EMPTY)).toBe('EMPTY');
    expect(classify(hopcroft82())).toBe('DTM');
  });

  it('NTM quando (q, X) tem mais de uma regra diferente, somando todas as transições de q', () => {
    expect(classify(tm('q0', [], ['q0 00R q1', 'q0 00R q2']))).toBe('NTM');
    expect(classify(tm('q0', [], ['q0 00R|01R q1']))).toBe('NTM');
    expect(classify(tm('q0', [], ['q0 00R|00L q1']))).toBe('NTM');
  });

  it('a mesma regra repetida conta uma vez; regras inválidas não contam', () => {
    expect(classify(tm('q0', [], ['q0 00R|00R q1', 'q0 00R q1']))).toBe('DTM');
    const m = tm('q0', [], ['q0 00R q1']);
    m.transitions[0]!.rules.push({ read: '0', write: '1', move: 'S' as never });
    expect(classify(m)).toBe('DTM');
  });
});

describe('formalDefinition', () => {
  it('Exemplo 8.2: M = ({q0..q4}, {0,1}, {0,1,X,Y,B}, δ, q0, B, {q4})', () => {
    const d = formalDefinition(hopcroft82());
    expect(d.states).toEqual(['q0', 'q1', 'q2', 'q3', 'q4']);
    expect(d.inputAlphabet).toEqual(['0', '1']);
    expect(d.inputAlphabetGuessed).toBe(false);
    expect(d.tapeAlphabet).toEqual(['0', '1', 'X', 'Y', 'B']);
    expect(d.initial).toBe('q0');
    expect(d.blank).toBe('B');
    expect(d.finals).toEqual(['q4']);
    expect(d.acceptance).toBe('FINAL_STATE');
    expect(d.type).toBe('DTM');
    const row = (from: string, read: string, state: string, write: string, move: 'L' | 'R') => ({
      from,
      read,
      to: [{ state, write, move }],
    });
    expect(d.delta).toEqual([
      row('q0', '0', 'q1', 'X', 'R'),
      row('q0', 'Y', 'q3', 'Y', 'R'),
      row('q1', '0', 'q1', '0', 'R'),
      row('q1', '1', 'q2', 'Y', 'L'),
      row('q1', 'Y', 'q1', 'Y', 'R'),
      row('q2', '0', 'q2', '0', 'L'),
      row('q2', 'X', 'q0', 'X', 'R'),
      row('q2', 'Y', 'q2', 'Y', 'L'),
      row('q3', 'Y', 'q3', 'Y', 'R'),
      row('q3', 'B', 'q4', 'B', 'R'),
    ]);
  });

  it('NTM: vários destinos na mesma linha, em ordem; palpite de Σ; sem inicial', () => {
    const m = tm(null, [], ['q10 01R q2', 'q10 00L q10', 'q10 00R q10', 'q2 BBL q10'], { acceptance: 'HALT' });
    const d = formalDefinition(m);
    expect(d.states).toEqual(['q2', 'q10']);
    expect(d.initial).toBeNull();
    expect(d.inputAlphabet).toEqual(['0', '1']);
    expect(d.inputAlphabetGuessed).toBe(true);
    expect(d.acceptance).toBe('HALT');
    expect(d.type).toBe('NTM');
    expect(d.delta).toEqual([
      { from: 'q2', read: 'B', to: [{ state: 'q10', write: 'B', move: 'L' }] },
      {
        from: 'q10',
        read: '0',
        to: [
          { state: 'q2', write: '1', move: 'R' },
          { state: 'q10', write: '0', move: 'L' },
          { state: 'q10', write: '0', move: 'R' },
        ],
      },
    ]);
  });
});

describe('formatConfig (ID do Hopcroft em partes)', () => {
  const m = hopcroft82();

  it('o estado fica antes do símbolo sob a cabeça', () => {
    expect(formatConfig(m, { state: 'q1', tape: 'XXY1', head: 2, origin: 0 })).toEqual({
      left: 'XX',
      state: 'q1',
      right: 'Y1',
    });
    expect(formatConfig(m, { state: 'q2', tape: 'X0Y1', head: 0, origin: 0 })).toEqual({
      left: '',
      state: 'q2',
      right: 'X0Y1',
    });
  });

  it('cabeça no branco depois da palavra: a célula da cabeça aparece', () => {
    expect(formatConfig(m, { state: 'q3', tape: 'XXYYB', head: 4, origin: 0 })).toEqual({
      left: 'XXYY',
      state: 'q3',
      right: 'B',
    });
    expect(formatConfig(m, { state: 'q4', tape: 'XXYYBB', head: 5, origin: 0 })).toEqual({
      left: 'XXYYB',
      state: 'q4',
      right: 'B',
    });
  });

  it('cabeça à esquerda da palavra: os brancos até a palavra aparecem à direita', () => {
    expect(formatConfig(m, { state: 'q0', tape: 'BB01', head: 0, origin: -2 })).toEqual({
      left: '',
      state: 'q0',
      right: 'BB01',
    });
  });

  it('corta os brancos das pontas mesmo se a fita vier com sobra; mantém os do meio', () => {
    expect(formatConfig(m, { state: 'q1', tape: 'BB0B1BB', head: 3, origin: 0 })).toEqual({
      left: '0',
      state: 'q1',
      right: 'B1',
    });
    expect(formatConfig(m, { state: 'q1', tape: 'B', head: 0, origin: 7 })).toEqual({
      left: '',
      state: 'q1',
      right: 'B',
    });
  });

  it('cabeça fora do trecho (configuração montada à mão): completa com brancos', () => {
    expect(formatConfig(m, { state: 'q0', tape: '01', head: 4, origin: 0 })).toEqual({
      left: '01BB',
      state: 'q0',
      right: 'B',
    });
    expect(formatConfig(m, { state: 'q0', tape: '01', head: -2, origin: 0 })).toEqual({
      left: '',
      state: 'q0',
      right: 'BB01',
    });
  });

  it('usa o nome do estado (ou o id, se não existir) e o branco da MT', () => {
    const renamed = structuredClone(m);
    renamed.states[0]!.name = 'início';
    expect(formatConfig(renamed, { state: 'q0', tape: '0', head: 0, origin: 0 }).state).toBe('início');
    expect(formatConfig(m, { state: 'zz', tape: '0', head: 0, origin: 0 }).state).toBe('zz');
    const underscore = { ...m, blank: '_' };
    expect(formatConfig(underscore, { state: 'q0', tape: '_0_', head: 2, origin: 0 })).toEqual({
      left: '0',
      state: 'q0',
      right: '_',
    });
  });
});
