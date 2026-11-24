import { formalDefinition } from '../../core/fa';
import type { FA } from '../../core/fa/types';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { compareNames, formalLines, formatSet, formatStates, showWord, symbolsLabel, tableColumns, transitionTable } from './format';

const ex = (id: string): FA => FA_EXAMPLES.find((e) => e.id === id)!.fa;

describe('formatação de conjuntos', () => {
  it('formatSet', () => {
    expect(formatSet(['q0', 'q1'])).toBe('{q0,q1}');
    expect(formatSet(['q0', 'q1'], ', ')).toBe('{q0, q1}');
    expect(formatSet([])).toBe('∅');
  });

  it('formatStates usa os nomes', () => {
    const fa: FA = { states: [{ id: 'x', name: 'A', initial: true, final: false }], transitions: [] };
    expect(formatStates(fa, ['x'])).toBe('{A}');
  });

  it('ordem natural e palavra vazia', () => {
    expect(['q10', 'q2', 'q1'].sort(compareNames)).toEqual(['q1', 'q2', 'q10']);
    expect(showWord('')).toBe('ε');
    expect(showWord('01')).toBe('01');
  });
});

describe('definição formal', () => {
  it('M = (Q, Σ, δ, q0, F)', () => {
    expect(formalLines(formalDefinition(ex('afd-so-01')))).toEqual({
      Q: '{q0, q1, q2}',
      Sigma: '{0, 1}',
      q0: 'q0',
      F: '{q2}',
    });
  });

  it('sem inicial e sem finais', () => {
    const fa: FA = { states: [{ id: 'a', name: 'a', initial: false, final: false }], transitions: [] };
    expect(formalLines(formalDefinition(fa))).toEqual({ Q: '{a}', Sigma: '∅', q0: '—', F: '∅' });
  });
});

describe('tabela de transição (Hopcroft)', () => {
  it('AFD parcial: um estado por célula e ∅ quando falta', () => {
    const t = transitionTable(ex('afd-so-01'));
    expect(t.symbols).toEqual(['0', '1']);
    expect(t.deterministic).toBe(true);
    expect(t.hasEpsilon).toBe(false);
    expect(t.rows.map((r) => [r.name, r.initial, r.final, ...r.cells.map((c) => c.text)])).toEqual([
      ['q0', true, false, 'q1', '∅'],
      ['q1', false, false, '∅', 'q2'],
      ['q2', false, true, '∅', '∅'],
    ]);
  });

  it('AFN: conjuntos nas células', () => {
    const t = transitionTable(ex('afn-termina-01'));
    expect(t.deterministic).toBe(false);
    expect(t.rows[0]!.cells.map((c) => c.text)).toEqual(['{q0,q1}', '{q0}']);
  });

  it('ε-AFN: coluna ε por último', () => {
    const t = transitionTable(ex('enfa-numero-decimal'));
    expect(t.symbols.at(-1)).toBe('ε');
    expect(t.symbols[0]).toBe('+');
    const q0 = t.rows[0]!;
    expect(q0.cells.find((c) => c.symbol === 'ε')!.text).toBe('{q1}');
  });

  it('ignora transições penduradas e símbolos inválidos', () => {
    const fa: FA = {
      states: [{ id: 'a', name: 'a', initial: true, final: false }],
      transitions: [
        { id: 't0', from: 'a', to: 'zzz', symbols: ['0'] },
        { id: 't1', from: 'a', to: 'a', symbols: ['ab', '1'] },
      ],
    };
    const t = transitionTable(fa);
    expect(t.symbols).toEqual(['1']);
    expect(t.rows[0]!.cells[0]!.text).toBe('a');
  });

  it('Σ grande: junta colunas iguais como o Hopcroft ("0, 1, …, 9"), ε fica sozinho', () => {
    const t = transitionTable(ex('enfa-numero-decimal'));
    expect(tableColumns(t).map((c) => c.label)).toEqual(['+, -', '.', '0, 1, …, 9', 'ε']);
    // Σ pequeno: uma coluna por símbolo, mesmo se forem iguais
    const small = transitionTable(ex('afn-termina-01'));
    expect(tableColumns(small).map((c) => c.label)).toEqual(['0', '1']);
    expect(symbolsLabel(['a', 'c'])).toBe('a, c');
  });

  it('linhas em ordem natural dos nomes', () => {
    const fa: FA = {
      states: [
        { id: 'a', name: 'q10', initial: false, final: false },
        { id: 'b', name: 'q2', initial: true, final: false },
      ],
      transitions: [],
    };
    expect(transitionTable(fa).rows.map((r) => r.name)).toEqual(['q2', 'q10']);
  });
});
