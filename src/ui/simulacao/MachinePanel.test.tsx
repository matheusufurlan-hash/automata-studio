// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { useDocuments } from '../../store/documents';
import { openExample } from '../ferramentas/actions';
import { SimulationPanel } from './SimulationPanel';
import { useSimulation } from './store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const sim = () => useSimulation.getState();
const text = (sel: string) => [...host.querySelectorAll(sel)].map((e) => e.textContent);

beforeEach(() => {
  vi.useFakeTimers();
  sim().reset();
  sim().setWord('');
  sim().setTab('simulate');
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

const render = () => act(() => root.render(<SimulationPanel />));

describe('painel de AP e MT', () => {
  it('AP: entrada, pilha (topo em cima), IDs com ⊢ e ACEITA', () => {
    act(() => openExample('ap-palindromo-par'));
    render();
    expect(text('.sim-tab')).toEqual(['Simulação', 'Árvore de IDs', 'Teste em lote'].map((t) => ` ${t}`));
    expect(text('.sim-stack-cell')).toEqual(['Z']); // antes de simular: só Z0
    act(() => sim().load('0110'));
    act(() => sim().goTo(2));
    expect(text('.sim-stack-cell')).toEqual(['1', '0', 'Z']);
    expect(host.querySelector('.sim-stack-cell.is-top')?.textContent).toBe('1');
    expect(host.querySelector('.sim-stack-cell.is-bottom')?.textContent).toBe('Z');
    expect(host.querySelectorAll('.sim-cell.is-read').length).toBe(2);
    expect(text('.sim-id').slice(0, 3)).toEqual(['(q0, 0110, Z)', '(q0, 110, 0Z)', '(q0, 10, 10Z)']);
    expect(host.querySelector('.sim-card-math')?.textContent).toBe('(q0, 10) ∈ δ(q0, 1, 0)');
    act(() => sim().last());
    expect(host.querySelector('.sim-seal')?.textContent).toContain('ACEITA');
    expect(host.querySelector('.sim-reason')?.textContent).toContain('Por estado final');
  });

  it('AP: rejeita com o motivo; clicar numa ID vai ao passo', () => {
    act(() => openExample('ap-palindromo-par'));
    render();
    act(() => sim().load('011'));
    act(() => sim().last());
    expect(host.querySelector('.sim-seal')?.textContent).toContain('REJEITA');
    expect(host.querySelector('.sim-reason')?.textContent).toContain('Nenhum caminho aceita');
    act(() => host.querySelectorAll<HTMLButtonElement>('.sim-id')[1]!.click());
    expect(sim().step).toBe(1);
  });

  it('MT: fita com a cabeça e o estado, IDs do livro e a saída da MT por parada', () => {
    act(() => openExample('mt-0n1n'));
    render();
    act(() => sim().load('0011'));
    act(() => sim().goTo(1));
    expect(host.querySelector('.sim-tm-state')?.textContent).toBe('q1');
    expect(text('.sim-id').slice(0, 2)).toEqual(['q00011', 'Xq1011']);
    expect(host.querySelector('.sim-id .sim-id-state')?.textContent).toBe('q0');
    act(() => openExample('mt-monus'));
    act(() => sim().load('0000100'));
    act(() => sim().last());
    expect(host.querySelector('.sim-output')?.textContent).toBe('Saída: 00');
  });

  it('MT em laço: NÃO PARA', () => {
    act(() => openExample('mt-laco-infinito'));
    act(() => useDocuments.getState().setTMOptions({ acceptance: 'HALT' }));
    render();
    act(() => sim().load('01'));
    act(() => sim().last());
    expect(host.querySelector('.sim-seal')?.textContent).toContain('NÃO PARA');
  });

  it('árvore: nós com a ID e o status; clicar num nó mostra o caminho até ele', () => {
    act(() => openExample('ap-palindromo-par'));
    act(() => sim().load('1111'));
    act(() => sim().setTab('tree'));
    render();
    const nodes = host.querySelectorAll<HTMLButtonElement>('.sim-tree-node');
    expect(nodes.length).toBeGreaterThan(5);
    expect(nodes[0]!.textContent).toBe('(q0, 1111, Z)');
    expect(host.querySelector('.sim-tree-stats')?.textContent).toContain('17 IDs');
    const dead = host.querySelector<HTMLButtonElement>('.sim-tree-node.st-dead')!;
    act(() => dead.click());
    expect(sim().machine!.focus).not.toBeNull();
    expect(host.querySelector('.sim-tree-node.is-current')).toBe(host.querySelector('.sim-tree-node.st-dead.is-focus'));
  });

  it('lote: as palavras do exemplo ficam verdes', () => {
    act(() => openExample('ap-0n1n'));
    act(() => sim().setTab('batch'));
    render();
    const fromExample = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Do exemplo'))!;
    act(() => fromExample.click());
    act(() => vi.runAllTimers());
    const items = host.querySelectorAll('.sim-batch-item');
    expect(items.length).toBe(8);
    expect(host.querySelectorAll('.sim-batch-item .mark.ok').length).toBe(8);
    expect(host.querySelector('.sim-batch-summary .ok')?.textContent).toContain('todas como esperado');
  });
});
