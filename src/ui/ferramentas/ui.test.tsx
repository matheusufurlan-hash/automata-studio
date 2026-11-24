// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { getActiveDoc, useDocuments } from '../../store/documents';
import { openExample, runUnaryAlgorithm } from './actions';
import { AlgorithmsMenu } from './AlgorithmsMenu';
import { SidePanel } from './SidePanel';
import { useTools } from './store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useTools.getState().setSideCollapsed(false);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (el: React.ReactNode) => act(() => root.render(el));

describe('painel lateral', () => {
  it('mostra tipo, definição formal e tabela de transição', () => {
    act(() => openExample('afd-so-01'));
    render(<SidePanel />);
    expect(host.querySelector('.fx-type')?.textContent).toBe('AFD');
    expect(host.querySelector('.fx-formal')?.textContent).toContain('{q0, q1, q2}');
    const rows = [...host.querySelectorAll('.fx-table tbody tr')].map((r) => r.textContent);
    expect(rows).toEqual(['→q0q1∅', 'q1∅q2', '*q2∅∅']);
  });

  it('minimização: tabela em escada por rodada e explicação ao passar o mouse', () => {
    act(() => openExample('minimizacao-01'));
    act(() => runUnaryAlgorithm('minimize'));
    expect(getActiveDoc().name).toBe('Mínimo de Minimização 1: A a H');
    render(<SidePanel />);
    // começa com a tabela vazia
    expect(host.querySelectorAll('.fx-stair-cell.is-new').length).toBe(0);
    const next = host.querySelector<HTMLButtonElement>('button[aria-label="Avançar"]')!;
    act(() => next.click()); // rodada 0
    expect(host.querySelectorAll('.fx-stair-cell.is-new').length).toBe(6);
    act(() => next.click()); // rodada 1
    const cell = host.querySelector<HTMLElement>('[aria-label="Par {A,B}"]')!;
    expect(cell.textContent).toBe('1');
    act(() => cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(document.querySelector('.fx-tip')?.textContent).toContain(
      'marcado porque δ(A,1)=F, δ(B,1)=C, e esse par {C,F} já estava marcado',
    );
    const end = host.querySelector<HTMLButtonElement>('button[aria-label="Fim"]')!;
    act(() => end.click());
    expect(host.querySelector('.fx-groups')?.textContent).toContain('A ≡ E');
  });

  it('AFN → AFD: tabela de subconjuntos linha a linha', () => {
    act(() => openExample('afn-termina-01'));
    act(() => runUnaryAlgorithm('determinize'));
    render(<SidePanel />);
    const next = host.querySelector<HTMLButtonElement>('button[aria-label="Avançar"]')!;
    act(() => next.click());
    const first = host.querySelector('.fx-table tbody tr')!;
    expect(first.textContent).toContain('{q0}');
    expect(first.textContent).toContain('{q0,q1}');
  });

  it('avisos de validate() selecionam o elemento', () => {
    act(() =>
      useDocuments.getState().openInNewTab('Dois iniciais', {
        states: [
          { id: 'a', name: 'a', initial: true, final: false },
          { id: 'b', name: 'b', initial: true, final: true },
        ],
        transitions: [],
      }),
    );
    render(<SidePanel />);
    const issue = host.querySelector<HTMLButtonElement>('.fx-issue')!;
    expect(issue.textContent).toContain('Mais de um estado inicial (a, b)');
  });
});

describe('menu Algoritmos', () => {
  it('itens sem sentido ficam desabilitados com o motivo', () => {
    act(() => openExample('afd-so-01'));
    render(<AlgorithmsMenu />);
    const btn = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Algoritmos'))!;
    act(() => btn.click());
    const items = [...document.querySelectorAll<HTMLButtonElement>('.fx-algo')];
    const det = items.find((i) => i.textContent?.includes('AFN → AFD'))!;
    expect(det.disabled).toBe(true);
    expect(det.textContent).toContain('já é um AFD');
    const min = items.find((i) => i.textContent?.includes('Minimizar'))!;
    expect(min.disabled).toBe(false);
    const before = useDocuments.getState().docs.length;
    act(() => min.click());
    expect(useDocuments.getState().docs.length).toBe(before + 1);
    expect(useTools.getState().provenance[getActiveDoc().id]?.kind).toBe('minimize');
  });

  it('galeria de exemplos abre o exemplo numa aba', () => {
    render(<AlgorithmsMenu />);
    act(() => useTools.getState().openDialog({ kind: 'examples' }));
    const cards = document.querySelectorAll<HTMLButtonElement>('.fx-card');
    expect(cards.length).toBe(FA_EXAMPLES.length);
    act(() => cards[0]!.click());
    expect(getActiveDoc().name).toBe(FA_EXAMPLES[0]!.name);
    expect(useTools.getState().dialog).toBeNull();
  });

  it('equivalência: ε-AFN, AFD e mínimo são equivalentes', () => {
    act(() => openExample('enfa-numero-decimal'));
    act(() => runUnaryAlgorithm('determinize'));
    act(() => runUnaryAlgorithm('minimize'));
    render(<AlgorithmsMenu />);
    act(() => useTools.getState().openDialog({ kind: 'pick', algo: 'equivalence' }));
    const pick = [...document.querySelectorAll<HTMLButtonElement>('button.fx-pick-row')].find(
      (b) => b.textContent?.includes('ε-AFN: número decimal') && !b.textContent.includes('AFD de'),
    )!;
    act(() => pick.click());
    const cmp = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Comparar'))!;
    act(() => cmp.click());
    expect(document.querySelector('.fx-verdict')?.textContent).toContain('Equivalentes');
    act(() => useTools.getState().closeDialog());
  });
});
