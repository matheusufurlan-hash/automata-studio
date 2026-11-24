// @vitest-environment jsdom
/**
 * Roteiro completo pela interface:
 *  - AP 0ⁿ1ⁿ do zero, com as regras digitadas na janela de regras;
 *  - MT do Exemplo 8.2 do Hopcroft do zero (regras + Σ nas propriedades);
 *  - salvar (o texto do .automato.json), fechar e abrir de novo: fica igual;
 *  - desfazer 10 vezes volta ao começo e refazer volta ao fim.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { TMTransition } from '../../core/tm/types';
import { parseAutomatonFile, serializeAutomatonFile } from '../../platform/fileFormat';
import { getActiveDoc, pdaOf, tmOf, useDocuments } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { DEMOS } from './demos';
import { Dialogs } from './Dialogs';
import { newDocument } from './fileActions';
import { formatPDARule, formatTMRule } from './rules';

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

const click = (el: Element) => act(() => (el as HTMLElement).click());
const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const radio = (text: string) =>
  [...host.querySelectorAll('button[role="radio"]')].find((b) => b.textContent?.includes(text))!;

/** Abre a janela da seta from→to, escreve as regras no modo Texto e confirma. */
function typeRules(from: string, to: string, text: string) {
  act(() => useEditorUi.getState().openDialog({ kind: 'transition', from, to, x: 100, y: 100 }));
  click(button('Texto'));
  setValue(host.querySelector('textarea')!, text);
  click(button('OK'));
  expect(useEditorUi.getState().dialog).toBeNull();
}

/** "Salvar" como faz o menu Arquivo: o arquivo leva o nome escolhido e a aba fica limpa. */
function save(name: string): string {
  const text = serializeAutomatonFile({ ...docs().toFile(), name });
  act(() => docs().markSaved(undefined, name));
  return text;
}

/** Fecha a aba e abre o arquivo de novo. */
function closeAndReopen(text: string) {
  act(() => docs().closeDoc(docs().activeId));
  act(() => docs().loadFile(parseAutomatonFile(text), { path: '/tmp/x.automato.json' }));
}

describe('roteiro completo', () => {
  it('AP 0ⁿ1ⁿ do zero: salvar, fechar e abrir igual; desfazer 10 vezes', () => {
    act(() => newDocument('pda'));
    const empty = getActiveDoc().automaton;
    let q0 = '';
    let q1 = '';
    let q2 = '';
    act(() => {
      q0 = docs().addState({ x: 0, y: 0 });
      q1 = docs().addState({ x: 220, y: 0 });
      q2 = docs().addState({ x: 440, y: 0 });
      docs().toggleFinal(q2);
    });
    typeRules(q0, q0, '0, Z/0Z\n0, 0/00');
    typeRules(q0, q1, '1, 0/ε');
    typeRules(q1, q1, '1, 0/ε');
    typeRules(q1, q2, 'ε, Z/Z');
    // propriedades pela janela: pilha vazia e de volta a estado final (2 passos no Desfazer)
    for (const mode of ['Por pilha vazia', 'Por estado final']) {
      act(() => useEditorUi.getState().openDialog({ kind: 'properties' }));
      click(radio(mode));
      click(button('Salvar'));
    }
    const built = getActiveDoc();
    const pda = pdaOf(built)!;
    expect(pda.transitions.map((t) => t.rules.map(formatPDARule))).toEqual([
      ['0, Z/0Z', '0, 0/00'],
      ['1, 0/ε'],
      ['1, 0/ε'],
      ['ε, Z/Z'],
    ]);
    expect(pda.acceptance).toBe('FINAL_STATE');

    const text = save('0n1n com pilha');
    expect(getActiveDoc().dirty).toBe(false);

    // desfazer 10 vezes volta à aba vazia; refazer 10 vezes volta ao salvo
    for (let i = 0; i < 10; i++) act(() => docs().undo());
    expect(getActiveDoc().automaton).toBe(empty);
    expect(docs().canUndo()).toBe(false);
    expect(getActiveDoc().dirty).toBe(true);
    for (let i = 0; i < 10; i++) act(() => docs().redo());
    expect(getActiveDoc().automaton).toBe(built.automaton);
    expect(getActiveDoc().dirty).toBe(false);

    closeAndReopen(text);
    const reopened = getActiveDoc();
    expect(reopened.name).toBe('0n1n com pilha');
    expect(reopened.dirty).toBe(false);
    expect(reopened.automaton).toEqual(built.automaton);
    expect(reopened.layout).toEqual(built.layout);
  });

  it('MT do Exemplo 8.2 do zero: igual ao livro, e igual depois de salvar e abrir', () => {
    act(() => newDocument('tm'));
    const q: string[] = [];
    act(() => {
      for (let i = 0; i < 5; i++) q.push(docs().addState({ x: (i % 3) * 220, y: i < 3 ? 0 : 230 }));
      docs().toggleFinal(q[4]!);
    });
    const [q0, q1, q2, q3, q4] = q as [string, string, string, string, string];
    typeRules(q0, q1, '0/X →');
    typeRules(q1, q1, '0/0 R\nY/Y R');
    typeRules(q1, q2, '1/Y ←');
    typeRules(q2, q2, '0 / 0, L\nY / Y, L');
    typeRules(q2, q0, 'X/X →');
    typeRules(q0, q3, 'Y/Y →');
    typeRules(q3, q3, 'Y/Y →');
    typeRules(q3, q4, 'B/B →');
    act(() => useEditorUi.getState().openDialog({ kind: 'properties' }));
    setValue([...host.querySelectorAll<HTMLInputElement>('.ed-prop input')].find((i) => i.placeholder === 'automático')!, '0, 1');
    click(button('Salvar'));

    const tm = tmOf(getActiveDoc())!;
    expect(tm.inputAlphabet).toEqual(['0', '1']);
    expect(tm.blank).toBe('B');
    // mesmas regras do Exemplo 8.2 (demo mt-0n1n), seta por seta (os ids q0…q4 coincidem)
    const sig = (t: TMTransition) => `${t.from}>${t.to}: ${t.rules.map(formatTMRule).join(' | ')}`;
    const demo = DEMOS['mt-0n1n'].tm;
    expect(tm.transitions.map(sig).sort()).toEqual(demo.transitions.map(sig).sort());
    expect(sig(tm.transitions.find((t) => t.from === q2 && t.to === q2)!)).toBe('q2>q2: 0/0 ← | Y/Y ←');

    const built = getActiveDoc();
    closeAndReopen(save('Exemplo 8.2'));
    expect(getActiveDoc().automaton).toEqual(built.automaton);
    expect(getActiveDoc().layout).toEqual(built.layout);
    expect(getActiveDoc().dirty).toBe(false);
  });
});
