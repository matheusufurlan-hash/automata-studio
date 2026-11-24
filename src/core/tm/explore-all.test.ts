import { describe, expect, it } from 'vitest';
import { formatConfig, simulate } from './index';
import { idText } from './basics';
import { ids, tm } from './test-helpers';

describe('simulate: NTM com exploreAll (árvore inteira)', () => {
  // a NTM do YAAS: aceita as palavras que contêm 00
  const ntm = tm('q0', ['q2'], ['q0 00R|11R q0', 'q0 00R q1', 'q1 00R q2'], { sigma: '01' });
  const statuses = (r: ReturnType<typeof simulate>) =>
    r.tree!.map((n) => [idText(formatConfig(ntm, n.config)), n.status]);

  it('sem exploreAll: para na 1ª ID que aceita e limitReached = false', () => {
    const r = simulate(ntm, '100');
    expect(r.accepted).toBe(true);
    expect(r.limitReached).toBe(false);
    expect(r.tree!.some((n) => n.status === 'UNEXPLORED')).toBe(true);
  });

  it('com exploreAll: expande o resto da fila, sem UNEXPLORED, e o caminho continua o mesmo', () => {
    const r = simulate(ntm, '100', { exploreAll: true });
    expect(r.accepted).toBe(true);
    expect(r.stop).toBe('ACCEPTED_FINAL');
    expect(r.limitReached).toBe(false);
    expect(statuses(r)).toEqual([
      ['q0100', 'EXPANDED'],
      ['1q000', 'EXPANDED'],
      ['10q00', 'EXPANDED'],
      ['10q10', 'EXPANDED'],
      ['100q0B', 'DEAD'],
      ['100q1B', 'DEAD'],
      ['100q2B', 'ACCEPTING'],
    ]);
    expect(ids(ntm, r)).toEqual(['q0100', '1q000', '10q10', '100q2B']);
    expect(r.output).toBe('100');
  });

  it('o limite de IDs aparece em limitReached (STEP_LIMIT quando não aceitou)', () => {
    const r = simulate(ntm, '100', { maxNodes: 5, exploreAll: true });
    expect(r.accepted).toBe(false);
    expect(r.stop).toBe('STEP_LIMIT');
    expect(r.limitReached).toBe(true);
  });

  it('DTM ignora exploreAll (não tem árvore)', () => {
    const dtm = tm('q0', ['q1'], ['q0 00R q1'], { sigma: '0' });
    const r = simulate(dtm, '0', { exploreAll: true });
    expect(r.accepted).toBe(true);
    expect(r.tree).toBeUndefined();
    expect(r.limitReached).toBeUndefined();
  });
});
