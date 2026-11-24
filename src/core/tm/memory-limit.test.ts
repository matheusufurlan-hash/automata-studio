import { describe, expect, it } from 'vitest';
import { simulate } from './index';
import { tm } from './test-helpers';

describe('simulate da MT: memoryLimit', () => {
  // escreve e anda para a direita para sempre: a fita guardada cresce a cada passo
  const runaway = tm('q0', [], ['q0 BaR q0'], { sigma: 'a' });

  it('parou pelo limite de passos: STEP_LIMIT sem memoryLimit', () => {
    const r = simulate(runaway, '');
    expect(r.stop).toBe('STEP_LIMIT');
    expect(r.steps.length - 1).toBe(10_000);
    expect(r.memoryLimit).toBeUndefined();
  });

  it('parou pela proteção de memória antes do maxSteps: memoryLimit', () => {
    const r = simulate(runaway, '', { maxSteps: 100_000 });
    expect(r.stop).toBe('STEP_LIMIT');
    expect(r.memoryLimit).toBe(true);
    expect(r.steps.length - 1).toBeLessThan(100_000);
  });
});
