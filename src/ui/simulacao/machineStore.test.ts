import { FA_EXAMPLES } from '../../core/fa/examples';
import { useDocuments } from '../../store/documents';
import { useHighlight } from '../../store/highlight';
import { openExample } from '../ferramentas/actions';
import type { PDARun, TMRun } from './machine';
import { stepCount } from './machine';
import { SPEEDS, useSimulation } from './store';

const sim = () => useSimulation.getState();
const hl = () => useHighlight.getState();

beforeEach(() => {
  vi.useFakeTimers();
  sim().reset();
  sim().setWord('');
  sim().setSpeed(1);
  sim().setTreeAll(false);
});

afterEach(() => {
  sim().pause();
  vi.useRealTimers();
});

describe('simulação de AP no painel', () => {
  it('carrega, anda, toca e acende a regra usada', () => {
    openExample('ap-palindromo-par');
    sim().load('0110');
    expect(sim().machine?.kind).toBe('pda');
    expect(sim().step).toBe(0);
    expect(hl().active).toEqual(['q0']);
    sim().next();
    expect(hl().rules).toEqual([{ transition: 't0', rule: 0 }]);
    expect(sim().prevStep).toBe(0);
    sim().play();
    vi.advanceTimersByTime(10 * SPEEDS[1].ms);
    expect(sim().step).toBe(6);
    expect(sim().playing).toBe(false);
    expect(hl().status).toBe('accepted');
  });

  it('ε digitado é a palavra vazia', () => {
    openExample('ap-palindromo-par');
    sim().load('ε');
    expect(sim().simWord).toBe('');
    expect(sim().machine?.result.accepted).toBe(true);
  });

  it('editar o AP tira a simulação', () => {
    openExample('ap-0n1n');
    sim().load('01');
    useDocuments.getState().toggleFinal('q2');
    expect(sim().machine).toBeNull();
    expect(hl().active).toEqual([]);
  });

  it('foco num nó vai ao fim do caminho até ele; null volta ao caminho padrão', () => {
    openExample('ap-palindromo-par');
    sim().load('0110');
    const run = sim().machine!;
    const dead = run.result.tree!.findIndex((n) => n.status === 'DEAD');
    sim().focusNode(dead);
    expect(sim().machine!.focus).toBe(dead);
    expect(sim().step).toBe(stepCount(sim().machine) - 1);
    expect(hl().status).toBe('rejected');
    sim().focusNode(null);
    expect(sim().machine!.focus).toBeNull();
  });

  it('Buscar mais: o limite de IDs vezes 4', () => {
    openExample('ap-palindromo-par');
    sim().setBaseLimits({ maxNodes: 3 });
    sim().load('0110');
    expect((sim().machine as PDARun).result.reason).toBe('LIMIT_REACHED');
    sim().searchMore();
    expect(sim().machine!.limits.maxNodes).toBe(12);
    sim().setBaseLimits({ maxNodes: 5000 });
  });

  it('árvore inteira: simula de novo com exploreAll e guarda o passo', () => {
    openExample('ap-comeca-com-0');
    sim().load('01');
    sim().goTo(1);
    const before = (sim().machine as PDARun).result.tree.length;
    sim().setTreeAll(true);
    expect(sim().machine!.limits.exploreAll).toBe(true);
    expect((sim().machine as PDARun).result.tree.length).toBeGreaterThan(before);
    expect(sim().step).toBe(1);
    sim().setTreeAll(false);
  });
});

describe('simulação de MT no painel', () => {
  it('MT com 10000 passos: ir ao fim é imediato', () => {
    openExample('mt-divisao');
    sim().load('0010001');
    expect((sim().machine as TMRun).result.stop).toBe('STEP_LIMIT');
    const t0 = performance.now();
    sim().last();
    expect(sim().step).toBe(10000);
    expect(performance.now() - t0).toBeLessThan(200);
    sim().searchMore();
    expect(sim().machine!.limits.maxSteps).toBe(100000);
  });

  it('voltar para uma aba de AF usa a simulação do AF de novo', () => {
    openExample('mt-0n1n');
    sim().load('01');
    const e = FA_EXAMPLES.find((x) => x.id === 'afd-so-01')!;
    useDocuments.getState().openInNewTab(e.name, structuredClone(e.fa), structuredClone(e.layout));
    expect(sim().machine).toBeNull();
    sim().load('01');
    expect(sim().result?.accepted).toBe(true);
    expect(sim().machine).toBeNull();
  });
});
