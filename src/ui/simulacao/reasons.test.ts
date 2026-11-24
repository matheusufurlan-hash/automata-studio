import { simulate } from '../../core/fa';
import type { FA } from '../../core/fa/types';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { verdictText } from './reasons';

const ex = (id: string): FA => FA_EXAMPLES.find((e) => e.id === id)!.fa;
const text = (fa: FA, w: string) => verdictText(fa, w, simulate(fa, w));

describe('verdictText (motivo em português)', () => {
  const so01 = ex('afd-so-01');

  it('DEAD_END: diz o símbolo e de onde não havia transição', () => {
    expect(text(so01, '00')).toBe("nenhuma transição com '0' a partir de {q1}");
    expect(text(so01, '1')).toBe("nenhuma transição com '1' a partir de {q0}");
  });

  it('ENDED_IN_NON_FINAL: um estado e vários estados', () => {
    expect(text(so01, '0')).toBe('terminou em {q1}, que não é final');
    const nfa = ex('afn-termina-01');
    expect(text(nfa, '0')).toBe('terminou em {q0,q1}, e nenhum deles é final');
  });

  it('SYMBOL_NOT_IN_ALPHABET: mostra o símbolo, a posição e Σ', () => {
    expect(text(so01, '0x1')).toBe("o símbolo 'x' (posição 2) não está em Σ = {0, 1}");
  });

  it('NO_INITIAL_STATE', () => {
    const fa: FA = { states: [{ id: 'a', name: 'a', initial: false, final: true }], transitions: [] };
    expect(text(fa, '')).toMatch(/não tem estado inicial/);
  });

  it('aceita: diz qual estado final foi alcançado', () => {
    expect(text(so01, '01')).toBe('terminou em {q2}, que é final');
    const nfa = ex('afn-termina-01');
    expect(text(nfa, '01')).toBe('terminou em {q0,q2}, que contém o estado final q2');
  });

  it('usa os NOMES dos estados, não os ids', () => {
    const fa: FA = {
      states: [
        { id: 'x', name: 'A', initial: true, final: false },
        { id: 'y', name: 'B', initial: false, final: false },
      ],
      transitions: [{ id: 't', from: 'x', to: 'y', symbols: ['a'] }],
    };
    expect(text(fa, 'aa')).toBe("nenhuma transição com 'a' a partir de {B}");
  });
});
