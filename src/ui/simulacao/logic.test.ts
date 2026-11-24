import { simulate } from '../../core/fa';
import type { FA } from '../../core/fa/types';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { clampStep, explainStep, highlightFor, isFinished, lastStep, tapeModel, timeline, timelineText } from './logic';

const ex = (id: string): FA => FA_EXAMPLES.find((e) => e.id === id)!.fa;

describe('passos e destaque', () => {
  const fa = ex('afd-so-01');

  it('lastStep / clampStep / isFinished', () => {
    const r = simulate(fa, '01');
    expect(lastStep(r)).toBe(2);
    expect(clampStep(r, -5)).toBe(0);
    expect(clampStep(r, 99)).toBe(2);
    expect(isFinished(r, 1)).toBe(false);
    expect(isFinished(r, 2)).toBe(true);
    expect(lastStep(null)).toBe(-1);
    expect(isFinished(null, 0)).toBe(false);
  });

  it('passos do meio ficam "running"; o último mostra aceita/rejeita', () => {
    const r = simulate(fa, '01');
    expect(highlightFor(r, 0)).toEqual({ active: ['q0'], viaEpsilon: [], transitions: [], status: 'running' });
    expect(highlightFor(r, 1)).toMatchObject({ active: ['q1'], transitions: ['t0'], status: 'running' });
    expect(highlightFor(r, 2)).toMatchObject({ active: ['q2'], transitions: ['t1'], status: 'accepted' });
    expect(highlightFor(simulate(fa, '0'), 1)).toMatchObject({ active: ['q1'], status: 'rejected' });
  });

  it('DEAD_END: o último passo acende em vermelho onde a simulação ficou presa', () => {
    const r = simulate(fa, '00');
    expect(highlightFor(r, 2)).toEqual({ active: ['q1'], viaEpsilon: [], transitions: [], status: 'rejected' });
  });

  it('sem estado inicial: nada aceso', () => {
    const r = simulate({ states: [{ id: 'a', name: 'a', initial: false, final: false }], transitions: [] }, 'x');
    expect(highlightFor(r, 0).active).toEqual([]);
    expect(isFinished(r, -1)).toBe(true);
  });

  it('ε-AFN: o passo 0 já traz o fecho-ε', () => {
    const enfa = ex('enfa-numero-decimal');
    const r = simulate(enfa, '3.');
    const h = highlightFor(r, 0);
    expect(h.active).toEqual(['q0', 'q1']);
    expect(h.viaEpsilon).toEqual(['q1']);
    expect(h.transitions).toEqual(['t0']);
  });
});

describe('fita', () => {
  const fa = ex('afd-so-01');

  it('sem simulação: tudo pendente, cabeça escondida, marca símbolos fora de Σ', () => {
    const t = tapeModel('0x', ['0', '1'], null, 0);
    expect(t.head).toBe(-1);
    expect(t.cells.map((c) => c.kind)).toEqual(['pending', 'pending']);
    expect(t.cells.map((c) => c.foreign)).toEqual([false, true]);
  });

  it('lidos, atual e pendentes', () => {
    const r = simulate(fa, '01');
    const t = tapeModel('01', ['0', '1'], r, 1);
    expect(t.head).toBe(1);
    expect(t.cells.map((c) => c.kind)).toEqual(['read', 'current']);
    expect(t.tone).toBe('running');
    const end = tapeModel('01', ['0', '1'], r, 2);
    expect(end.head).toBe(2);
    expect(end.tone).toBe('accepted');
  });

  it('DEAD_END e símbolo fora de Σ: a célula culpada fica com erro', () => {
    const dead = tapeModel('000', ['0', '1'], simulate(fa, '000'), 99);
    expect(dead.head).toBe(1);
    expect(dead.cells.map((c) => c.kind)).toEqual(['read', 'error', 'pending']);
    const foreign = tapeModel('0x1', ['0', '1'], simulate(fa, '0x1'), 99);
    expect(foreign.head).toBe(1);
    expect(foreign.cells.map((c) => c.kind)).toEqual(['read', 'error', 'pending']);
    expect(foreign.tone).toBe('rejected');
  });
});

describe('linha do tempo e explicação', () => {
  it('timeline e texto {q0} --a--> {q0,q1}', () => {
    const nfa = ex('afn-termina-01');
    const r = simulate(nfa, '01');
    expect(timelineText(nfa, r)).toBe('{q0} --0--> {q0,q1} --1--> {q0,q2}');
    const items = timeline(nfa, r);
    expect(items.map((i) => i.read)).toEqual([null, '0', '1']);
    expect(items[1]!.states.map((s) => s.name)).toEqual(['q0', 'q1']);
  });

  it('DEAD_END termina com ∅', () => {
    const fa = ex('afd-so-01');
    const r = simulate(fa, '00');
    expect(timelineText(fa, r)).toBe('{q0} --0--> {q1} --0--> ∅');
    expect(timeline(fa, r).at(-1)!.dead).toBe(true);
  });

  it('marca os estados que entraram pelo fecho-ε', () => {
    const enfa = ex('enfa-numero-decimal');
    const items = timeline(enfa, simulate(enfa, '3.'));
    expect(items[0]!.states).toEqual([
      { id: 'q0', name: 'q0', viaEpsilon: false },
      { id: 'q1', name: 'q1', viaEpsilon: true },
    ]);
  });

  it('explica cada passo com δ e ECLOSE', () => {
    const fa = ex('afd-so-01');
    const r = simulate(fa, '00');
    expect(explainStep(fa, r, 0)).toEqual({ title: 'Início', lines: ['começa em q0, antes de ler qualquer símbolo'] });
    expect(explainStep(fa, r, 1)).toEqual({ title: "Leu '0'", lines: ['δ(q0, 0) = q1'] });
    expect(explainStep(fa, r, 2)).toEqual({ title: "Leu '0'", lines: ['δ(q1, 0) = ∅'] });

    const enfa = ex('enfa-numero-decimal');
    const e = simulate(enfa, '3.1');
    expect(explainStep(enfa, e, 0)!.lines).toEqual(['ECLOSE(q0) = {q0,q1}']);
    expect(explainStep(enfa, e, 3)!.lines).toEqual(['δ({q2,q3,q5}, 1) = {q3}', 'ECLOSE({q3}) = {q3,q5}']);

    const nfa = ex('afn-termina-01');
    expect(explainStep(nfa, simulate(nfa, '0'), 1)!.lines).toEqual(['δ({q0}, 0) = {q0,q1}']);
  });
});
