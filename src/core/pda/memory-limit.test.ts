import { describe, expect, it } from 'vitest';
import { simulate } from './index';
import type { PDA } from './types';

/** Ciclo de ε que empilha: a pilha cresce a cada nível e nenhuma ID se repete. */
const pushing: PDA = {
  states: [{ id: 'q0', name: 'q0', initial: true, final: false }],
  transitions: [
    {
      id: 't0',
      from: 'q0',
      to: 'q0',
      rules: [
        { read: 'ε', pop: 'Z', push: 'ZZ' },
        { read: 'ε', pop: 'Z', push: 'AZ' },
        { read: 'a', pop: 'A', push: '' },
      ],
    },
  ],
  startStackSymbol: 'Z',
  acceptance: 'EMPTY_STACK',
};

describe('simulate do AP: memoryLimit', () => {
  it('parou pelo limite de IDs: limitReached sem memoryLimit', () => {
    const r = simulate(pushing, 'a', { maxNodes: 1000 });
    expect(r.reason).toBe('LIMIT_REACHED');
    expect(r.limitReached).toBe(true);
    expect(r.memoryLimit).toBeUndefined();
  });

  it('parou pela proteção de memória: memoryLimit, e um limite maior dá o mesmo resultado', () => {
    const r = simulate(pushing, 'a', { maxNodes: 20_000 });
    expect(r.reason).toBe('LIMIT_REACHED');
    expect(r.memoryLimit).toBe(true);
    expect(r.tree.length).toBeLessThan(20_000);
    expect(simulate(pushing, 'a', { maxNodes: 80_000 }).tree.length).toBe(r.tree.length);
  });
});
