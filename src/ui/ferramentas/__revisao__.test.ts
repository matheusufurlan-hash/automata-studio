/**
 * Testes de revisão para as ferramentas. Cada `it.fails` mostra um
 * problema encontrado na revisão; quando for corrigido, vira `it`.
 */
import { minimize } from '../../core/fa';
import type { FA } from '../../core/fa/types';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { runUnary } from './algorithms';
import { distinguishingWord, markIndex, preparationNotes } from './explain';

const ex = (id: string): FA => FA_EXAMPLES.find((e) => e.id === id)!.fa;

describe('revisor: a palavra da dica da escada separa mesmo o par (todos os exemplos)', () => {
  it.each(FA_EXAMPLES.map((e) => [e.id, e.fa] as const))('%s', (_id, fa) => {
    const result = minimize(fa);
    const marks = markIndex(result);
    const finals = new Set(result.input.states.filter((s) => s.final).map((s) => s.id));
    const run = (from: string, w: string) => {
      let s = from;
      for (const c of w) s = result.input.transitions.find((t) => t.from === s && t.symbols.includes(c))!.to;
      return s;
    };
    for (const { mark } of marks.values()) {
      const [p, q] = mark.pair;
      const w = distinguishingWord(marks, p, q);
      expect(w).not.toBeNull();
      expect(finals.has(run(p, w!))).not.toBe(finals.has(run(q, w!)));
    }
  });
});

describe('revisor: ferramentas', () => {
  /**
   * Revisão — "Minimização: notas de preparo somem quando o estado morto
   * reaproveita o id de um inalcançável".
   * q2 é inalcançável e o AFD é parcial. O núcleo remove q2 e cria o estado
   * morto com o primeiro id livre... que é "q2" de novo. preparationNotes
   * compara por id e não vê nem a remoção nem o estado morto.
   */
  it('preparationNotes avisa "inalcançáveis removidos" e "estado morto" mesmo se o id se repetir', () => {
    const source: FA = {
      states: [
        { id: 'q0', name: 'q0', initial: true, final: false },
        { id: 'q1', name: 'q1', initial: false, final: true },
        { id: 'q2', name: 'q2', initial: false, final: false },
      ],
      transitions: [
        { id: 't0', from: 'q0', to: 'q1', symbols: ['a'] },
        { id: 't1', from: 'q2', to: 'q0', symbols: ['a'] },
      ],
    };
    const result = minimize(source);
    // corrigido: o estado morto ∅ não reaproveita mais o id q2 do inalcançável removido
    expect(result.input.states.find((s) => s.name === '∅')?.id).not.toBe('q2');
    const notes = preparationNotes(source, result).join(' ');
    expect(notes).toMatch(/Inalcançáveis removidos/);
    expect(notes).toMatch(/estado morto/);
  });

  /**
   * Revisão — "Minimizar um AFD parcial diz 'Já era mínimo' com MAIS estados".
   * "Só 01" tem 3 estados; o mínimo (completo) tem 4 e a mensagem diz
   * "Já era mínimo: 4 estados.", comparando com o AFD completado, não com o do aluno.
   */
  it('mensagem de Minimizar não diz "Já era mínimo" quando o resultado tem mais estados que o original', () => {
    const out = runUnary('minimize', 'Só 01', ex('afd-so-01'));
    expect(ex('afd-so-01').states).toHaveLength(3);
    expect(out.fa.states).toHaveLength(4);
    expect(out.message).not.toMatch(/Já era mínimo/);
  });
});
