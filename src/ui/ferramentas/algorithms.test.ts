import { equivalent } from '../../core/fa';
import type { FA } from '../../core/fa/types';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { isComplete, runBinary, runUnary, unavailableReason } from './algorithms';
import { distinguishingWord, explainPair, markIndex, mergedGroups, preparationNotes, roundCaption, subsetTable } from './explain';

const ex = (id: string): FA => FA_EXAMPLES.find((e) => e.id === id)!.fa;

describe('quando cada algoritmo pode rodar', () => {
  const empty: FA = { states: [], transitions: [] };
  const noInitial: FA = { states: [{ id: 'a', name: 'a', initial: false, final: true }], transitions: [] };

  it('vazio e sem inicial', () => {
    expect(unavailableReason('minimize', empty)).toBe('o autômato está vazio');
    expect(unavailableReason('minimize', noInitial)).toBe('sem estado inicial');
    expect(unavailableReason('star', noInitial)).toBe('sem estado inicial');
  });

  it('AFN → AFD só para AFN/ε-AFN', () => {
    expect(unavailableReason('determinize', ex('afd-so-01'))).toBe('já é um AFD');
    expect(unavailableReason('determinize', ex('afn-termina-01'))).toBeNull();
  });

  it('completar: só AFD e só se faltar transição', () => {
    expect(unavailableReason('complete', ex('afd-so-01'))).toBeNull();
    expect(unavailableReason('complete', ex('afd-termina-01'))).toBe('já está completo');
    expect(unavailableReason('complete', ex('afn-termina-01'))).toMatch(/só para AFD/);
    expect(isComplete(ex('afd-termina-01'))).toBe(true);
  });

  it('remover: só quando há o que remover', () => {
    expect(unavailableReason('removeUnreachable', ex('afd-so-01'))).toBe('não há estados inalcançáveis');
    expect(unavailableReason('removeUnreachable', ex('minimizacao-01'))).toBeNull();
    expect(unavailableReason('removeUseless', ex('afn-estados-inuteis'))).toBeNull();
  });

  it('dois autômatos: precisa de outra aba com autômato', () => {
    expect(unavailableReason('union', ex('afd-so-01'), [])).toBe('abra outro autômato numa aba');
    expect(unavailableReason('union', ex('afd-so-01'), [empty])).toBe('abra outro autômato numa aba');
    expect(unavailableReason('equivalence', ex('afd-so-01'), [ex('afd-termina-01')])).toBeNull();
  });
});

describe('resultados', () => {
  it('nomes descritivos', () => {
    const fa = ex('afn-termina-01');
    expect(runUnary('determinize', 'X', fa).name).toBe('AFD de X');
    expect(runUnary('minimize', 'X', fa).name).toBe('Mínimo de X');
    expect(runUnary('complement', 'X', fa).name).toBe('Complemento de X');
    expect(runUnary('star', 'X', fa).name).toBe('(X)*');
    expect(runBinary('union', 'A', fa, 'B', fa).name).toBe('A ∪ B');
    expect(runBinary('intersection', 'A', fa, 'B', fa).name).toBe('A ∩ B');
    expect(runBinary('concat', 'A', fa, 'B', fa).name).toBe('A · B');
  });

  it('mantém o MinimizationResult / DeterminizeResult para o painel', () => {
    const fa = ex('minimizacao-01');
    const out = runUnary('minimize', 'M', fa);
    expect(out.provenance.kind).toBe('minimize');
    expect(out.provenance.fa).toBe(out.fa);
    const det = runUnary('determinize', 'N', ex('afn-termina-01'));
    expect(det.provenance.kind).toBe('determinize');
  });

  it('exercício de prova: ε-AFN → AFD → mínimo é equivalente ao original', () => {
    const enfa = ex('enfa-numero-decimal');
    const dfa = runUnary('determinize', 'E', enfa).fa;
    const min = runUnary('minimize', 'AFD de E', dfa).fa;
    expect(equivalent(min, enfa).equivalent).toBe(true);
  });

  it('remover inalcançáveis lista os removidos', () => {
    const out = runUnary('removeUnreachable', 'M', ex('minimizacao-01'));
    expect(out.provenance.kind === 'other' && out.provenance.notes[0]).toMatch(/^Removidos: D\./);
  });
});

describe('todos os exemplos × todos os algoritmos de um autômato', () => {
  const unary = ['determinize', 'minimize', 'complete', 'complement', 'removeUnreachable', 'removeUseless', 'star'] as const;
  const keepsLanguage = new Set(['determinize', 'minimize', 'complete', 'removeUnreachable', 'removeUseless']);
  for (const e of FA_EXAMPLES) {
    it(`${e.id}: roda sem erro e mantém a linguagem quando deve`, () => {
      for (const algo of unary) {
        if (unavailableReason(algo, e.fa) !== null) continue;
        const out = runUnary(algo, e.name, e.fa);
        expect(out.fa.states.length).toBeGreaterThan(0);
        if (keepsLanguage.has(algo)) expect(equivalent(out.fa, e.fa).equivalent, algo).toBe(true);
        if (algo === 'complement') {
          // nenhuma palavra é aceita pelos dois
          expect(runBinary('intersection', 'A', e.fa, 'B', out.fa).fa.states.some((s) => s.final)).toBe(false);
        }
      }
    });
  }
});

describe('explicações da minimização', () => {
  const fa = ex('minimizacao-01');
  const out = runUnary('minimize', 'M', fa);
  if (out.provenance.kind !== 'minimize') throw new Error('esperava minimize');
  const result = out.provenance.result;
  const marks = markIndex(result);
  const id = (name: string) => result.input.states.find((s) => s.name === name)!.id;

  it('preparação: inalcançável removido', () => {
    expect(preparationNotes(fa, result)).toEqual(['Inalcançáveis removidos antes: D.']);
  });

  it('rodada 0 e rodadas seguintes', () => {
    expect(explainPair(result, marks, id('A'), id('C'), 0)).toBe(
      'Rodada 0: C é final e A não é (a palavra ε já separa os dois).',
    );
    const txt = explainPair(result, marks, id('A'), id('B'), 9);
    expect(txt).toMatch(/^Rodada 1: marcado porque δ\(A,1\)=F, δ\(B,1\)=C, e esse par \{C,F\} já estava marcado\./);
    expect(distinguishingWord(marks, id('A'), id('B'))).toBe('1');
    expect(distinguishingWord(marks, id('A'), id('G'))).toBe('01');
  });

  it('pares não marcados e fim', () => {
    expect(explainPair(result, marks, id('A'), id('E'), 0)).toBe('{A,E} ainda não foi marcado.');
    expect(explainPair(result, marks, id('A'), id('E'), result.table.rounds.length)).toMatch(/^A ≡ E/);
    expect(roundCaption(result, result.table.rounds.length)).toMatch(/nenhum par novo/);
  });

  it('grupos juntados', () => {
    const groups = mergedGroups(result);
    expect(groups.find((g) => g.members.length === 2 && g.members.includes('A'))!.members).toEqual(['A', 'E']);
  });
});

describe('tabela de subconjuntos', () => {
  it('ε-AFN do número decimal', () => {
    const enfa = ex('enfa-numero-decimal');
    const out = runUnary('determinize', 'E', enfa);
    if (out.provenance.kind !== 'determinize') throw new Error('esperava determinize');
    const t = subsetTable(enfa, out.provenance.result);
    expect(t.start).toBe('O estado inicial do AFD é ECLOSE(q0) = {q0,q1}.');
    expect(t.rows[0]!.name).toBe('{q0,q1}');
    expect(t.rows[0]!.members).toEqual(['q0', 'q1']);
    const plus = t.rows[0]!.cells.find((c) => c.symbol === '+')!;
    expect(plus.targetName).toBe('{q1}');
    expect(plus.derivation).toEqual(['δ_D({q0,q1}, +) = δ(q0,+) ∪ δ(q1,+)', '= {q1} ∪ ∅ = {q1}', 'ECLOSE({q1}) = {q1}']);
  });
});
