// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { PDA_EXAMPLES } from '../../core/pda/examples';
import { TM_EXAMPLES } from '../../core/tm/examples';
import { getActiveDoc } from '../../store/documents';
import { openExample } from './actions';
import { ExamplesDialog, groupPDAExamples, groupTMExamples, machineCardTitle } from './ExamplesDialog';
import { useTools } from './store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useTools.getState().closeDialog();
});

describe('galeria com AF, AP e MT', () => {
  it('todos os exemplos de AP e MT aparecem em algum grupo', () => {
    expect(groupPDAExamples(PDA_EXAMPLES).flatMap((g) => g.items).length).toBe(PDA_EXAMPLES.length);
    expect(groupTMExamples(TM_EXAMPLES).flatMap((g) => g.items).length).toBe(TM_EXAMPLES.length);
    expect(groupTMExamples(TM_EXAMPLES).map((g) => g.title)).toEqual(['Reconhecem linguagens', 'Calculam funções', 'Não determinística']);
  });

  it('título sem o prefixo do tipo', () => {
    expect(machineCardTitle('AP: 0ⁿ1ⁿ')).toBe('0ⁿ1ⁿ');
    expect(machineCardTitle('MTN: contém 00')).toBe('Contém 00');
    expect(machineCardTitle('AP de teste: cada 0 vale dois X')).toBe('Cada 0 vale dois X (teste)');
    // a notação da linguagem não muda
    expect(machineCardTitle('MT: aⁿbⁿcⁿ')).toBe('aⁿbⁿcⁿ');
    expect(machineCardTitle('APD: wcwᴿ (palíndromo com marca no meio)')).toBe('wcwᴿ (palíndromo com marca no meio)');
  });

  it('abre na seção pedida; clicar num card de MT abre a MT numa aba nova', () => {
    act(() => useTools.getState().openDialog({ kind: 'examples', section: 'tm' }));
    act(() => root.render(<ExamplesDialog />));
    expect(host.querySelector('.fx-gallery-tabs .is-on')?.textContent).toContain('Máquinas de Turing');
    const cards = host.querySelectorAll<HTMLButtonElement>('.fx-card');
    expect(cards.length).toBe(TM_EXAMPLES.length);
    act(() => cards[0]!.click());
    expect(getActiveDoc().automaton.kind).toBe('tm');
    expect(getActiveDoc().name).toBe(TM_EXAMPLES[0]!.name);
  });

  it('exemplo=<id> também abre AP e MT', () => {
    act(() => openExample('ap-0n1n'));
    expect(getActiveDoc().automaton.kind).toBe('pda');
    expect(useTools.getState().exampleOf[getActiveDoc().id]).toBe('ap-0n1n');
  });
});
