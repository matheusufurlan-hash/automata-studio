// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { EPSILON } from '../../core/fa/types';
import { getActiveDoc, pdaOf, tmOf, useDocuments } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { Dialogs } from './Dialogs';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Dialogs />));
});

afterEach(() => {
  act(() => useEditorUi.getState().closeDialog());
  act(() => root.unmount());
  host.remove();
});

const docs = () => useDocuments.getState();

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function press(el: Element, key: string, opts: KeyboardEventInit = {}) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
  });
}

function click(el: Element) {
  act(() => (el as HTMLElement).click());
}

const field = (label: string) => host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const byLabel = (label: string) => host.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const errors = () => [...host.querySelectorAll('.ed-rule-errors li, .ed-prop-error')].map((e) => e.textContent);

function newDocWithStates(kind: 'pda' | 'tm') {
  let a = '';
  let b = '';
  act(() => {
    docs().newDoc(undefined, kind);
    a = docs().addState({ x: 0, y: 0 });
    b = docs().addState({ x: 200, y: 0 });
  });
  return [a, b] as const;
}

function openTransition(from: string, to: string, transitionId?: string) {
  act(() => useEditorUi.getState().openDialog({ kind: 'transition', from, to, transitionId, x: 100, y: 100 }));
}

describe('janela de regras do AP', () => {
  it('nova transição: a, X e γ e Enter grava a regra', () => {
    const [a, b] = newDocWithStates('pda');
    openTransition(a, b);
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Regras da transição');
    setValue(field('Regra 1: a (símbolo lido ou ε)'), '0');
    setValue(field('Regra 1: X (topo da pilha)'), 'Z');
    setValue(field('Regra 1: γ (o que empilha)'), '0Z');
    press(field('Regra 1: γ (o que empilha)'), 'Enter');
    expect(pdaOf(getActiveDoc())!.transitions[0]!.rules).toEqual([{ read: '0', pop: 'Z', push: '0Z' }]);
    expect(useEditorUi.getState().dialog).toBeNull();
  });

  it('+ Regra, botão ε e Ctrl+E; linha vazia é ignorada', () => {
    const [a] = newDocWithStates('pda');
    openTransition(a, a);
    setValue(field('Regra 1: a (símbolo lido ou ε)'), '1');
    setValue(field('Regra 1: X (topo da pilha)'), '0');
    click(byLabel('ε: não empilha nada (Ctrl+E)'));
    expect(field('Regra 1: γ (o que empilha)').value).toBe(EPSILON);
    click(button('Regra'));
    press(field('Regra 2: a (símbolo lido ou ε)'), 'e', { ctrlKey: true });
    expect(field('Regra 2: a (símbolo lido ou ε)').value).toBe(EPSILON);
    setValue(field('Regra 2: X (topo da pilha)'), 'Z');
    setValue(field('Regra 2: γ (o que empilha)'), 'Z');
    click(button('Regra')); // fica vazia
    click(button('OK'));
    expect(pdaOf(getActiveDoc())!.transitions[0]!.rules).toEqual([
      { read: '1', pop: '0', push: '' },
      { read: EPSILON, pop: 'Z', push: 'Z' },
    ]);
  });

  it('erro em português e a janela continua aberta', () => {
    const [a, b] = newDocWithStates('pda');
    openTransition(a, b);
    setValue(field('Regra 1: a (símbolo lido ou ε)'), '0');
    // X vazio só vira erro ao tentar confirmar
    expect(errors()).toEqual([]);
    press(field('Regra 1: a (símbolo lido ou ε)'), 'Enter');
    expect(errors()).toEqual(['O topo da pilha (X) precisa ser exatamente 1 símbolo']);
    expect(field('Regra 1: X (topo da pilha)').getAttribute('aria-invalid')).toBe('true');
    expect(useEditorUi.getState().dialog).not.toBeNull();
    expect(pdaOf(getActiveDoc())!.transitions).toHaveLength(0);
  });

  it('modo Texto: várias regras de uma vez (e erro diz a linha)', () => {
    const [a, b] = newDocWithStates('pda');
    openTransition(a, b);
    click(button('Texto'));
    const text = host.querySelector<HTMLTextAreaElement>('textarea')!;
    setValue(text, '0, Z/0Z\n0 Z 0Z');
    click(button('OK'));
    expect(errors()).toEqual(['Linha 2: use o formato a, X/γ (ex.: 0, Z/0Z)']);
    setValue(text, '0, Z / 0Z\n0, 0/00\n1, 0/ε\nε, Z/Z\n0, Z/0Z');
    expect(host.textContent).not.toContain('Linha 2');
    press(text, 'Enter', { ctrlKey: true });
    expect(pdaOf(getActiveDoc())!.transitions[0]!.rules).toEqual([
      { read: '0', pop: 'Z', push: '0Z' },
      { read: '0', pop: '0', push: '00' },
      { read: '1', pop: '0', push: '' },
      { read: EPSILON, pop: 'Z', push: 'Z' },
    ]);
  });

  it('Texto ⇄ Lista mantém as regras; colar várias regras num campo', () => {
    const [a, b] = newDocWithStates('pda');
    openTransition(a, b);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.assign(paste, { clipboardData: { getData: () => '0, Z/0Z\n1, Z/1Z' } });
    act(() => {
      field('Regra 1: a (símbolo lido ou ε)').dispatchEvent(paste);
    });
    expect(field('Regra 2: γ (o que empilha)').value).toBe('1Z');
    click(button('Texto'));
    expect(host.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('0, Z/0Z\n1, Z/1Z');
    click(button('Lista'));
    expect(field('Regra 1: X (topo da pilha)').value).toBe('Z');
  });

  it('editar: remover regras; sem regras a transição é apagada', () => {
    const [a, b] = newDocWithStates('pda');
    act(() => docs().setRules(a, b, [{ read: '0', pop: 'Z', push: '0Z' }, { read: '1', pop: 'Z', push: '' }]));
    const t = pdaOf(getActiveDoc())!.transitions[0]!;
    openTransition(a, b, t.id);
    expect(host.textContent).toContain('Editar transição');
    expect(field('Regra 2: γ (o que empilha)').value).toBe(EPSILON);
    click(byLabel('Remover a regra 1'));
    click(button('OK'));
    expect(pdaOf(getActiveDoc())!.transitions[0]!.rules).toEqual([{ read: '1', pop: 'Z', push: '' }]);
    openTransition(a, b, t.id);
    click(byLabel('Remover a regra 1'));
    expect(host.textContent).toContain('Sem regras: a transição será apagada.');
    click(host.querySelector('.ed-btn.primary')!);
    expect(pdaOf(getActiveDoc())!.transitions).toHaveLength(0);
  });
});

describe('janela de regras da MT', () => {
  it('X, Y, botão do branco e direção ←', () => {
    const [a, b] = newDocWithStates('tm');
    openTransition(a, b);
    setValue(field('Regra 1: X (símbolo lido)'), '0');
    click(host.querySelectorAll('button[aria-label="Branco (B)"]')[1]!);
    expect(field('Regra 1: Y (símbolo escrito)').value).toBe('B');
    click(byLabel('Esquerda'));
    press(field('Regra 1: X (símbolo lido)'), 'Enter');
    expect(tmOf(getActiveDoc())!.transitions[0]!.rules).toEqual([{ read: '0', write: 'B', move: 'L' }]);
  });

  it('modo Texto aceita 0/X R, 0/X → e 0 / X, R', () => {
    const [a] = newDocWithStates('tm');
    openTransition(a, a);
    click(button('Texto'));
    setValue(host.querySelector<HTMLTextAreaElement>('textarea')!, '0/X R\nY/Y →\n1 / Y, L');
    click(button('OK'));
    expect(tmOf(getActiveDoc())!.transitions[0]!.rules).toEqual([
      { read: '0', write: 'X', move: 'R' },
      { read: 'Y', write: 'Y', move: 'R' },
      { read: '1', write: 'Y', move: 'L' },
    ]);
  });
});

describe('propriedades', () => {
  it('AP: Z0 trocado nas regras e aceitação, num passo só do Desfazer', () => {
    const [a] = newDocWithStates('pda');
    act(() => docs().setRules(a, a, [{ read: '0', pop: 'Z', push: '0Z' }]));
    const before = getActiveDoc().automaton;
    act(() => useEditorUi.getState().openDialog({ kind: 'properties' }));
    setValue(host.querySelector<HTMLInputElement>('.ed-prop-symbol')!, '$');
    expect(host.textContent).toContain('nas regras também');
    click([...host.querySelectorAll('button[role="radio"]')].find((b) => b.textContent?.includes('Por pilha vazia'))!);
    click(button('Salvar'));
    const pda = pdaOf(getActiveDoc())!;
    expect(pda.startStackSymbol).toBe('$');
    expect(pda.acceptance).toBe('EMPTY_STACK');
    expect(pda.transitions[0]!.rules).toEqual([{ read: '0', pop: '$', push: '0$' }]);
    act(() => docs().undo());
    expect(getActiveDoc().automaton).toBe(before);
  });

  it('MT: o branco não pode estar em Σ; Σ e aceitação por parada', () => {
    newDocWithStates('tm');
    act(() => useEditorUi.getState().openDialog({ kind: 'properties' }));
    const sigma = [...host.querySelectorAll<HTMLInputElement>('.ed-prop input')].find((i) => i.placeholder === 'automático')!;
    setValue(sigma, '0, 1, B');
    expect(errors()).toEqual(['O branco (B) não pode estar em Σ.']);
    expect(button('Salvar').disabled).toBe(true);
    setValue(sigma, '1 0');
    click([...host.querySelectorAll('button[role="radio"]')].find((b) => b.textContent?.includes('Por parada'))!);
    click(button('Salvar'));
    const tm = tmOf(getActiveDoc())!;
    expect(tm.inputAlphabet).toEqual(['0', '1']);
    expect(tm.acceptance).toBe('HALT');
  });

  it('AP: Z0 → símbolo que já está nas regras: com "trocar nas regras" trava o Salvar; sem, só avisa', () => {
    const [a] = newDocWithStates('pda');
    act(() => docs().setRules(a, a, [{ read: '0', pop: 'Z', push: 'XZ' }]));
    act(() => useEditorUi.getState().openDialog({ kind: 'properties' }));
    setValue(host.querySelector<HTMLInputElement>('.ed-prop-symbol')!, 'X');
    expect(errors()).toEqual([
      'X já aparece nas regras: trocar Z por X juntaria os dois símbolos num só e mudaria o autômato. Escolha um símbolo que ainda não aparece nas regras.',
    ]);
    expect(button('Salvar').disabled).toBe(true);
    click(host.querySelector('.ed-check-row input[type="checkbox"]')!);
    expect(errors()).toEqual([]);
    expect(host.textContent).toContain('X já aparece nas regras: com ele no fundo da pilha');
    click(button('Salvar'));
    const pda = pdaOf(getActiveDoc())!;
    expect(pda.startStackSymbol).toBe('X');
    expect(pda.transitions[0]!.rules).toEqual([{ read: '0', pop: 'Z', push: 'XZ' }]);
  });

  it('MT: branco → símbolo que já está nas regras, com "trocar nas regras", trava o Salvar', () => {
    const [a] = newDocWithStates('tm');
    act(() => docs().setRules(a, a, [{ read: 'B', write: 'Y', move: 'R' }]));
    act(() => useEditorUi.getState().openDialog({ kind: 'properties' }));
    setValue(host.querySelector<HTMLInputElement>('.ed-prop-symbol')!, 'Y');
    expect(errors()).toHaveLength(1);
    expect(errors()[0]).toContain('Y já aparece nas regras: trocar B por Y juntaria os dois símbolos');
    expect(button('Salvar').disabled).toBe(true);
  });
});
