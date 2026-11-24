// @vitest-environment jsdom
/**
 * Testes de revisão da versão 0.2 — simulação de AP e MT na tela.
 * Cada `it.fails` demonstra um problema encontrado na revisão; quando
 * o problema for corrigido, o teste passa a "falhar" e deve virar `it`.
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { PDA } from '../../core/pda/types';
import type { TM } from '../../core/tm/types';
import { openExample } from '../ferramentas/actions';
import { MAX_NODES_CAP, pdaVerdict, runMachine, tmVerdict } from './machine';
import type { PDARun, TMRun } from './machine';
import { samplesToBatch } from './machineBatch';
import { SimulationPanel } from './SimulationPanel';
import { useSimulation } from './store';
import { TM_EXAMPLES } from '../../core/tm/examples';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** MT que escreve e anda para a direita para sempre: a fita guardada cresce 1 célula por passo. */
const growing: TM = {
  states: [{ id: 'q0', name: 'q0', initial: true, final: false }],
  transitions: [{ id: 't0', from: 'q0', to: 'q0', rules: [{ read: 'B', write: 'a', move: 'R' }] }],
  blank: 'B',
  acceptance: 'FINAL_STATE',
  inputAlphabet: ['a'],
};

/** AP com um ciclo de ε que empilha (a pilha cresce a cada nível). */
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
  acceptance: 'FINAL_STATE',
};

describe('revisor 2: "Continuar" e "Buscar mais"', () => {
  it('MT: parou pela salvaguarda de memória (antes do limite de passos) → não oferece Continuar, que daria o mesmo resultado', () => {
    const limits = { maxSteps: 100_000, maxNodes: 5000, exploreAll: false };
    const run = runMachine({ kind: 'tm', tm: growing }, '', limits) as TMRun;
    // parou em 11 313 passos, bem antes dos 100 000: foi a salvaguarda (MAX_TAPE_SYMBOLS), não o limite
    expect(run.result.stop).toBe('STEP_LIMIT');
    expect(run.result.steps.length - 1).toBeLessThan(limits.maxSteps);
    // com 10× mais passos, sai exatamente o mesmo
    const again = runMachine({ kind: 'tm', tm: growing }, '', { ...limits, maxSteps: 1_000_000 }) as TMRun;
    expect(again.result.steps.length).toBe(run.result.steps.length);
    // mas a tela diz "parei depois de 11.313 passos ... pode ser que pare com mais passos" e oferece Continuar
    expect(tmVerdict(run).more).toBeUndefined();
  });

  it('AP: parou pela salvaguarda de memória (menos IDs que o limite) → não oferece Buscar mais', () => {
    const run = runMachine({ kind: 'pda', pda: pushing }, 'a', { maxSteps: 10_000, maxNodes: 20_000, exploreAll: false }) as PDARun;
    expect(run.result.reason).toBe('LIMIT_REACHED');
    expect(run.result.tree.length).toBeLessThan(20_000); // 17 314
    const again = runMachine({ kind: 'pda', pda: pushing }, 'a', { maxSteps: 10_000, maxNodes: 80_000, exploreAll: false }) as PDARun;
    expect(again.result.tree.length).toBe(run.result.tree.length);
    expect(pdaVerdict(run).more).toBeUndefined();
  });

  it('AP: já no limite máximo (MAX_NODES_CAP) → não oferece Buscar mais (na MT isso já é feito)', () => {
    const small = runMachine({ kind: 'pda', pda: pushing }, 'a', { maxSteps: 10_000, maxNodes: 50, exploreAll: false }) as PDARun;
    expect(small.result.reason).toBe('LIMIT_REACHED');
    const atCap: PDARun = { ...small, limits: { ...small.limits, maxNodes: MAX_NODES_CAP } };
    expect(pdaVerdict(atCap).more).toBeUndefined();
  });
});

describe('revisor 2: painel', () => {
  let root: Root;
  let host: HTMLDivElement;
  const sim = () => useSimulation.getState();

  beforeEach(() => {
    vi.useFakeTimers();
    sim().reset();
    sim().setWord('');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    sim().pause();
    vi.useRealTimers();
  });

  const render = () => act(() => root.render(createElement(SimulationPanel)));

  /** Lote com as samples do exemplo mt-divisao (a última, 0010001, fica INDEFINIDO). */
  function divisionBatch(): string {
    act(() => openExample('mt-divisao'));
    act(() => sim().setTab('batch'));
    // a amostra 0010001 saiu do exemplo (a MT não para nela); aqui ela entra à mão, como linha "deve rejeitar"
    act(() => sim().setBatchText(`${samplesToBatch(TM_EXAMPLES.find((e) => e.id === 'mt-divisao')!.samples!)}\n-0010001`));
    act(() => sim().runBatch());
    act(() => vi.runAllTimers());
    render();
    return host.querySelector('.sim-batch-summary')?.textContent ?? '';
  }

  it('lote: com uma linha esperada que ficou INDEFINIDO, o resumo não diz "todas como esperado"', () => {
    const summary = divisionBatch();
    expect(host.querySelectorAll('.sim-batch-item .mark.und').length).toBe(1);
    expect(summary).not.toContain('todas como esperado');
  });

  it('lote: concordância no singular ("1 indefinida", "1 não para")', () => {
    const summary = divisionBatch();
    expect(summary).toContain('1 indefinida');
    expect(summary).not.toContain('1 indefinidas');
  });

  it('Árvore de IDs de uma aba de MT, antes de simular: não fala de (q0, w, Z0), que é a ID inicial do AP', () => {
    act(() => openExample('mt-nao-deterministica'));
    act(() => sim().setTab('tree'));
    render();
    const empty = host.querySelector('.sim-tree-empty')?.textContent ?? '';
    expect(empty).toContain('Digite uma palavra');
    expect(empty).not.toContain('Z0');
  });
});
