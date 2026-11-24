// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { formalDefinition as pdaDef, validate as validatePDA } from '../../core/pda';
import { PDA_EXAMPLES } from '../../core/pda/examples';
import { formalDefinition as tmDef } from '../../core/tm';
import { TM_EXAMPLES } from '../../core/tm/examples';
import { useDocuments } from '../../store/documents';
import { useSimulation } from '../simulacao/store';
import { openExample } from './actions';
import { pdaFormalLines, pdaIssueText, tmTable } from './machineFormat';
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

describe('formatação de AP e MT', () => {
  it('δ do AP no formato do livro (γ vazio = ε)', () => {
    const lines = pdaFormalLines(pdaDef(PDA_EXAMPLES[0]!.pda));
    const all = lines.delta.map((d) => `${d.text} = ${d.targets}`);
    expect(all).toContain('δ(q0, 0, Z) = {(q0, 0Z)}');
    expect(all).toContain('δ(q1, 0, 0) = {(q1, ε)}');
    expect(all).toContain('δ(q0, ε, Z) = {(q1, Z)}');
    expect(lines.Gamma).toBe('{0, 1, Z}');
  });

  it('tabela da MT como a figura 8.10: → no inicial, * nos finais, (p, Y, →)', () => {
    const def = tmDef(TM_EXAMPLES[0]!.tm);
    const t = tmTable(def, def.initial, def.finals);
    expect(t.symbols).toEqual(['0', '1', 'X', 'Y', 'B']);
    const q0 = t.rows.find((r) => r.name === 'q0')!;
    expect(q0.initial).toBe(true);
    expect(q0.cells.map((c) => c.moves.join(' '))).toEqual(['(q1, X, →)', '', '', '(q3, Y, →)', '']);
    expect(t.rows.find((r) => r.name === 'q4')!.final).toBe(true);
    // MT não determinística: mais de um destino na mesma célula
    const nd = tmDef(TM_EXAMPLES.find((e) => e.id === 'mt-nao-deterministica')!.tm);
    const cell = tmTable(nd, nd.initial, nd.finals).rows.find((r) => r.name === 'q0')!.cells.find((c) => c.symbol === '0')!;
    expect(cell.moves).toEqual(['(q0, 0, →)', '(q1, 0, →)']);
  });

  it('avisos em português simples', () => {
    const pda = { ...PDA_EXAMPLES[0]!.pda, transitions: [{ id: 't9', from: 'q0', to: 'q1', rules: [{ read: '0', pop: 'ε', push: '' }] }] };
    const texts = validatePDA(pda).map((i) => pdaIssueText(pda, i));
    expect(texts[0]).toContain('o topo (X) precisa ser exatamente 1 símbolo');
  });
});

describe('painel lateral de AP e MT', () => {
  it('AP: selo, P = (Q, Σ, Γ, δ, q0, Z0, F) e a linha de δ da regra usada acende', () => {
    act(() => openExample('ap-palindromo-par'));
    act(() => root.render(<SidePanel />));
    expect(host.querySelector('.fx-type')?.textContent).toBe('AP');
    expect(host.querySelector('.fx-formal-tuple')?.textContent).toBe('P = (Q, Σ, Γ, δ, q0, Z0, F)');
    expect(host.querySelector('.fx-formal-mode')?.textContent).toContain('estado final');
    act(() => useSimulation.getState().load('0110'));
    act(() => useSimulation.getState().goTo(1));
    expect(host.querySelector('.fx-delta li.is-lit')?.textContent).toBe('δ(q0, 0, Z) = {(q0, 0Z)}');
  });

  it('APD e MTN no selo', () => {
    act(() => openExample('apd-0n1n'));
    act(() => root.render(<SidePanel />));
    expect(host.querySelector('.fx-type')?.textContent).toBe('APD');
    act(() => openExample('mt-nao-deterministica'));
    expect(host.querySelector('.fx-type')?.textContent).toBe('MTN');
  });

  it('MT: Σ como palpite e a tabela de transição', () => {
    act(() => openExample('mt-0n1n'));
    act(() => useDocuments.getState().setTMOptions({ inputAlphabet: [] }));
    act(() => root.render(<SidePanel />));
    expect(host.querySelector('.fx-type')?.textContent).toBe('MTD');
    expect(host.querySelector('.fx-guess')?.textContent).toBe('palpite');
    const rows = [...host.querySelectorAll('.fx-tm-table tbody tr')].map((r) => r.textContent);
    expect(rows[0]).toBe('→q0(q1, X, →)––(q3, Y, →)–');
  });
});
