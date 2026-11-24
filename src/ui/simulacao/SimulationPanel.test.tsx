// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { useDocuments } from '../../store/documents';
import { useHighlight } from '../../store/highlight';
import { SimulationPanel } from './SimulationPanel';
import { useSimulation } from './store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

function key(k: string, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k === ' ' ? 'Space' : k, bubbles: true }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  const e = FA_EXAMPLES.find((x) => x.id === 'afd-so-01')!;
  useDocuments.getState().openInNewTab(e.name, structuredClone(e.fa), structuredClone(e.layout));
  useSimulation.getState().reset();
  useSimulation.getState().setWord('');
  useSimulation.getState().setTab('simulate');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<SimulationPanel />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useSimulation.getState().pause();
  vi.useRealTimers();
});

describe('SimulationPanel', () => {
  it('Enter no campo simula e toca; a fita e o selo aparecem', () => {
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Palavra para simular"]')!;
    act(() => useSimulation.getState().setWord('01'));
    key('Enter', input);
    expect(useSimulation.getState().playing).toBe(true);
    expect(host.querySelectorAll('.sim-cell').length).toBe(3); // 0, 1 e o fim
    act(() => vi.advanceTimersByTime(5000));
    expect(host.querySelector('.sim-seal')?.textContent).toContain('ACEITA');
    expect(host.querySelector('.sim-reason')?.textContent).toContain('terminou em {q2}, que é final');
  });

  it('atalhos: Espaço toca/pausa, setas andam; digitando no campo não vale', () => {
    act(() => useSimulation.getState().setWord('00'));
    key('ArrowRight');
    expect(useSimulation.getState().step).toBe(0);
    key('ArrowRight');
    expect(useSimulation.getState().step).toBe(1);
    key('ArrowLeft');
    expect(useSimulation.getState().step).toBe(0);
    key(' ');
    expect(useSimulation.getState().playing).toBe(true);
    key(' ');
    expect(useSimulation.getState().playing).toBe(false);
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Palavra para simular"]')!;
    key('ArrowRight', input);
    expect(useSimulation.getState().step).toBe(0);
  });

  it('DEAD_END: selo REJEITA com o motivo e destaque vermelho', () => {
    act(() => useSimulation.getState().load('00'));
    act(() => useSimulation.getState().last());
    expect(host.querySelector('.sim-seal')?.textContent).toContain('REJEITA');
    expect(host.querySelector('.sim-reason')?.textContent).toContain("nenhuma transição com '0' a partir de {q1}");
    expect(useHighlight.getState().status).toBe('rejected');
    expect(host.querySelector('.sim-cell.is-error')?.textContent).toBe('0');
  });

  it('clicar num passo da linha do tempo vai até ele', () => {
    act(() => useSimulation.getState().load('01'));
    const chips = host.querySelectorAll<HTMLButtonElement>('.sim-tl-chip');
    expect(chips.length).toBe(3);
    act(() => chips[2]!.click());
    expect(useSimulation.getState().step).toBe(2);
  });

  it('teste em lote: testar e clicar num resultado carrega no simulador', () => {
    act(() => useSimulation.getState().setTab('batch'));
    act(() => useSimulation.getState().setBatchText('+01\n+00'));
    const run = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Testar tudo'))!;
    act(() => run.click());
    const items = host.querySelectorAll<HTMLButtonElement>('.sim-batch-item');
    expect(items.length).toBe(2);
    expect(items[1]!.classList.contains('is-bad')).toBe(true);
    act(() => items[1]!.click());
    expect(useSimulation.getState().tab).toBe('simulate');
    expect(useSimulation.getState().simWord).toBe('00');
  });
});
