import { EPSILON } from './types';
import type { FA } from './types';
import { alphabet, classify, eclose, formalDefinition, validate } from './index';
import { FA_EXAMPLES } from './examples';
import { example, fa } from './test-helpers';

const EMPTY: FA = { states: [], transitions: [] };

describe('alphabet', () => {
  it('lista os símbolos sem ε, sem repetição e em ordem', () => {
    const a = fa('q0', ['q1'], ['q0 ba q1', 'q1 εa q0', 'q1 c q1']);
    expect(alphabet(a)).toEqual(['a', 'b', 'c']);
  });

  it('número decimal: + - . e dígitos (ordem UTF-16)', () => {
    expect(alphabet(example('enfa-numero-decimal').fa)).toEqual([
      '+', '-', '.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ]);
  });

  it('autômato sem estados ou só com ε: alfabeto vazio', () => {
    expect(alphabet(EMPTY)).toEqual([]);
    expect(alphabet(fa('q0', [], ['q0 ε q1']))).toEqual([]);
  });

  it('ignora símbolos inválidos e transições penduradas', () => {
    const a: FA = {
      states: [{ id: 'q0', name: 'q0', initial: true, final: false }],
      transitions: [
        { id: 't0', from: 'q0', to: 'q0', symbols: ['ab', 'x'] },
        { id: 't1', from: 'q0', to: 'nao-existe', symbols: ['y'] },
      ],
    };
    expect(alphabet(a)).toEqual(['x']);
  });
});

describe('validate', () => {
  it('autômato correto: nenhum problema', () => {
    for (const e of FA_EXAMPLES) expect(validate(e.fa), e.id).toEqual([]);
  });

  it('sem estados ou sem inicial: NO_INITIAL_STATE', () => {
    expect(validate(EMPTY)).toEqual([{ kind: 'NO_INITIAL_STATE' }]);
    expect(validate(fa(null, ['q1'], ['q0 a q1']))).toEqual([{ kind: 'NO_INITIAL_STATE' }]);
  });

  it('dois iniciais: MULTIPLE_INITIAL_STATES', () => {
    const a = fa('q0', [], ['q0 a q1']);
    a.states[1]!.initial = true;
    expect(validate(a)).toEqual([{ kind: 'MULTIPLE_INITIAL_STATES', states: ['q0', 'q1'] }]);
  });

  it('símbolo com mais de um caractere ou vazio: INVALID_SYMBOL', () => {
    const a = fa('q0', [], ['q0 a q1']);
    a.transitions[0]!.symbols = ['a', 'ab', ''];
    expect(validate(a)).toEqual([
      { kind: 'INVALID_SYMBOL', transition: 't0', symbol: 'ab' },
      { kind: 'INVALID_SYMBOL', transition: 't0', symbol: '' },
    ]);
  });

  it('ε e caracteres fora do ASCII são válidos', () => {
    expect(validate(fa('q0', [], [`q0 ${EPSILON}çπ q1`]))).toEqual([]);
  });

  it('transição para estado que não existe: DANGLING_TRANSITION', () => {
    const a = fa('q0', [], ['q0 a q1'], ['q0']);
    expect(validate(a)).toEqual([{ kind: 'DANGLING_TRANSITION', transition: 't0' }]);
  });
});

describe('classify', () => {
  it('sem estados: EMPTY', () => {
    expect(classify(EMPTY)).toBe('EMPTY');
  });

  it('um estado sem transições é DFA', () => {
    expect(classify(fa('q0', [], [], ['q0']))).toBe('DFA');
  });

  it('função parcial ainda é DFA', () => {
    expect(classify(example('afd-so-01').fa)).toBe('DFA');
  });

  it('dois destinos com o mesmo símbolo: NFA', () => {
    expect(classify(example('afn-termina-01').fa)).toBe('NFA');
  });

  it('qualquer ε: ENFA (mesmo sem outro não determinismo)', () => {
    expect(classify(fa('q0', [], ['q0 ε q1']))).toBe('ENFA');
    expect(classify(example('enfa-numero-decimal').fa)).toBe('ENFA');
  });

  it('pares (from, to) repetidos com o mesmo símbolo não viram NFA', () => {
    const a = fa('q0', [], ['q0 a q1', 'q0 a q1']);
    expect(classify(a)).toBe('DFA');
  });
});

describe('eclose', () => {
  const decimal = example('enfa-numero-decimal').fa;

  it('inclui o próprio estado', () => {
    expect(eclose(decimal, 'q1')).toEqual(['q1']);
    expect(eclose(decimal, 'q0')).toEqual(['q0', 'q1']);
  });

  it('de um conjunto: união dos fechos, ordenada por nome', () => {
    expect(eclose(decimal, ['q3', 'q0'])).toEqual(['q0', 'q1', 'q3', 'q5']);
  });

  it('segue ε em cadeia', () => {
    const a = fa('q0', [], ['q0 ε q1', 'q1 ε q2', 'q2 a q3']);
    expect(eclose(a, 'q0')).toEqual(['q0', 'q1', 'q2']);
  });

  it('laço ε e ciclo ε terminam', () => {
    const loop = fa('q0', [], ['q0 ε q0', 'q0 a q1']);
    expect(eclose(loop, 'q0')).toEqual(['q0']);
    const cycle = fa('q0', [], ['q0 ε q1', 'q1 ε q2', 'q2 ε q0', 'q2 a q3']);
    expect(eclose(cycle, 'q1')).toEqual(['q0', 'q1', 'q2']);
  });

  it('ordem natural dos nomes (q2 antes de q10)', () => {
    const a = fa('q0', [], ['q0 ε q10', 'q0 ε q2']);
    expect(eclose(a, 'q0')).toEqual(['q0', 'q2', 'q10']);
  });

  it('estado desconhecido é ignorado', () => {
    expect(eclose(decimal, ['nao-existe'])).toEqual([]);
  });
});

describe('formalDefinition', () => {
  it('ε-AFN do número decimal', () => {
    const def = formalDefinition(example('enfa-numero-decimal').fa);
    expect(def.states).toEqual(['q0', 'q1', 'q2', 'q3', 'q4', 'q5']);
    expect(def.alphabet).toHaveLength(13);
    expect(def.initial).toBe('q0');
    expect(def.finals).toEqual(['q5']);
    expect(def.type).toBe('ENFA');
    // símbolos em ordem e ε por último (mesma ordem do editor e da coluna ε das tabelas)
    expect(def.delta.filter((d) => d.from === 'q0')).toEqual([
      { from: 'q0', symbol: '+', to: ['q1'] },
      { from: 'q0', symbol: '-', to: ['q1'] },
      { from: 'q0', symbol: EPSILON, to: ['q1'] },
    ]);
    expect(def.delta.find((d) => d.from === 'q1' && d.symbol === '7')).toEqual({
      from: 'q1',
      symbol: '7',
      to: ['q1', 'q4'],
    });
    expect(def.delta.find((d) => d.from === 'q3' && d.symbol === EPSILON)?.to).toEqual(['q5']);
    // q5 não tem transições: não aparece em δ
    expect(def.delta.some((d) => d.from === 'q5')).toBe(false);
  });

  it('usa os nomes (não os ids) e a ordem natural', () => {
    const def = formalDefinition(example('minimizacao-01').fa);
    expect(def.states).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(def.finals).toEqual(['C']);
    expect(def.delta[0]).toEqual({ from: 'A', symbol: '0', to: ['B'] });
    expect(def.delta).toHaveLength(16);
    const many = fa('q10', ['q2'], ['q10 a q2', 'q2 a q9']);
    expect(formalDefinition(many).states).toEqual(['q2', 'q9', 'q10']);
  });

  it('sem inicial: initial = null; sem estados: tudo vazio', () => {
    expect(formalDefinition(fa(null, [], ['q0 a q1'])).initial).toBeNull();
    expect(formalDefinition(EMPTY)).toEqual({
      states: [],
      alphabet: [],
      delta: [],
      initial: null,
      finals: [],
      type: 'EMPTY',
    });
  });
});
