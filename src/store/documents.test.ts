import { beforeEach, describe, expect, it } from 'vitest';
import { EPSILON } from '../core/fa/types';
import type { AutomatonFile, FA } from '../core/fa/types';
import type { PDARule } from '../core/pda/types';
import type { TM, TMRule } from '../core/tm/types';
import {
  faOf,
  getActiveDoc,
  HISTORY_LIMIT,
  isEmptyDoc,
  nextId,
  normalizeRules,
  normalizeSymbols,
  pdaOf,
  pdaRuleKey,
  tmOf,
  useDocuments,
} from './documents';
import { useHighlight } from './highlight';

const store = () => useDocuments.getState();

/** Fecha tudo e começa com uma aba vazia nova. */
function reset() {
  const ids = store().docs.map((d) => d.id);
  for (const id of ids) store().closeDoc(id);
}

describe('useDocuments', () => {
  beforeEach(reset);

  it('começa com uma aba vazia e limpa', () => {
    expect(store().docs).toHaveLength(1);
    const doc = getActiveDoc();
    expect(faOf(doc)!.states).toHaveLength(0);
    expect(doc.dirty).toBe(false);
    expect(store().canUndo()).toBe(false);
  });

  it('addState dá nomes q0, q1, ... e o primeiro já é inicial', () => {
    const a = store().addState({ x: 0, y: 0 });
    const b = store().addState({ x: 100, y: 0 });
    const fa = faOf(getActiveDoc())!;
    expect(fa.states.map((s) => s.name)).toEqual(['q0', 'q1']);
    expect(fa.states.find((s) => s.id === a)?.initial).toBe(true);
    expect(fa.states.find((s) => s.id === b)?.initial).toBe(false);
    expect(getActiveDoc().layout.positions[b]).toEqual({ x: 100, y: 0 });
    expect(getActiveDoc().dirty).toBe(true);
  });

  it('desfazer 10 vezes volta ao início e refazer volta ao fim', () => {
    const start = getActiveDoc();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(store().addState({ x: i * 160, y: 0 }));
    store().setTransition(ids[0]!, ids[1]!, ['0']);
    store().setTransition(ids[1]!, ids[1]!, ['1']);
    store().toggleFinal(ids[4]!);
    store().moveStates({ [ids[2]!]: { x: 10, y: 50 } });
    store().renameState(ids[3]!, 'x');
    const end = getActiveDoc();
    for (let i = 0; i < 10; i++) store().undo();
    expect(getActiveDoc().automaton).toBe(start.automaton);
    expect(getActiveDoc().layout).toBe(start.layout);
    expect(getActiveDoc().dirty).toBe(false);
    expect(store().canUndo()).toBe(false);
    for (let i = 0; i < 10; i++) store().redo();
    expect(getActiveDoc().automaton).toEqual(end.automaton);
    expect(getActiveDoc().layout).toEqual(end.layout);
    expect(store().canRedo()).toBe(false);
  });

  it('uma edição nova apaga o "refazer"', () => {
    store().addState({ x: 0, y: 0 });
    store().addState({ x: 1, y: 0 });
    store().undo();
    expect(store().canRedo()).toBe(true);
    store().addState({ x: 2, y: 0 });
    expect(store().canRedo()).toBe(false);
  });

  it(`o histórico guarda no máximo ${HISTORY_LIMIT} passos`, () => {
    const id = store().addState({ x: 0, y: 0 });
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) store().moveStates({ [id]: { x: i, y: 0 } });
    let n = 0;
    while (store().canUndo()) {
      store().undo();
      n++;
    }
    expect(n).toBe(HISTORY_LIMIT);
  });

  it('edições que não mudam nada não entram no histórico', () => {
    const id = store().addState({ x: 0, y: 0 });
    store().moveStates({ [id]: { x: 0, y: 0 } });
    store().setInitial(id);
    store().renameState(id, 'q0');
    store().undo();
    expect(store().canUndo()).toBe(false);
  });

  it('setTransition junta símbolos no mesmo par e lista vazia apaga', () => {
    const a = store().addState({ x: 0, y: 0 });
    const b = store().addState({ x: 160, y: 0 });
    store().setTransition(a, b, ['b']);
    store().setTransition(a, b, ['a', EPSILON, 'b']);
    let ts = faOf(getActiveDoc())!.transitions;
    expect(ts).toHaveLength(1);
    expect(ts[0]!.symbols).toEqual(['a', 'b', EPSILON]);
    store().setTransition(a, b, []);
    ts = faOf(getActiveDoc())!.transitions;
    expect(ts).toHaveLength(0);
  });

  it('transição nova que passaria por cima de outro estado já nasce curva', () => {
    const a = store().addState({ x: 0, y: 0 });
    const b = store().addState({ x: 200, y: 0 });
    const c = store().addState({ x: 400, y: 0 });
    store().setTransition(a, b, ['0']);
    store().setTransition(c, a, ['1']);
    const [t1, t2] = faOf(getActiveDoc())!.transitions;
    expect(getActiveDoc().layout.edges[t1!.id]).toBeUndefined();
    const k = getActiveDoc().layout.edges[t2!.id]?.curvature ?? 0;
    // relativa (não é pixel); estados alinhados no meio → curva para cima
    // (indo para a esquerda, "para cima" é a direita de quem anda: negativo)
    expect(k).toBeLessThan(0);
    expect(k).toBeGreaterThan(-1);
    expect(c).toBeDefined();
  });

  it('setTransitionSymbols troca os símbolos (vazio apaga)', () => {
    const a = store().addState({ x: 0, y: 0 });
    store().setTransition(a, a, ['a', 'b']);
    const t = faOf(getActiveDoc())!.transitions[0]!;
    expect(getActiveDoc().layout.edges[t.id]?.loopAngle).toBeTypeOf('number');
    store().setTransitionSymbols(t.id, ['c']);
    expect(faOf(getActiveDoc())!.transitions[0]!.symbols).toEqual(['c']);
    store().setTransitionSymbols(t.id, []);
    expect(faOf(getActiveDoc())!.transitions).toHaveLength(0);
    expect(getActiveDoc().layout.edges[t.id]).toBeUndefined();
  });

  it('removeElements de um estado remove as transições dele', () => {
    const a = store().addState({ x: 0, y: 0 });
    const b = store().addState({ x: 160, y: 0 });
    const c = store().addState({ x: 320, y: 0 });
    store().setTransition(a, b, ['0']);
    store().setTransition(b, c, ['1']);
    store().setTransition(c, a, ['0']);
    store().setTransition(b, b, ['1']);
    store().setTransition(a, c, ['1']);
    store().removeElements([b], []);
    const fa = faOf(getActiveDoc())!;
    expect(fa.states.map((s) => s.id)).toEqual([a, c]);
    expect(fa.transitions.every((t) => t.from !== b && t.to !== b)).toBe(true);
    expect(fa.transitions).toHaveLength(2);
    expect(getActiveDoc().layout.positions[b]).toBeUndefined();
    // e apaga só uma transição pela lista de transições
    store().removeElements([], [fa.transitions[0]!.id]);
    expect(faOf(getActiveDoc())!.transitions).toHaveLength(1);
  });

  it('setInitial deixa um único inicial; toggleFinal liga e desliga', () => {
    const a = store().addState({ x: 0, y: 0 });
    const b = store().addState({ x: 160, y: 0 });
    store().setInitial(b);
    const fa = faOf(getActiveDoc())!;
    expect(fa.states.filter((s) => s.initial).map((s) => s.id)).toEqual([b]);
    store().toggleFinal(a);
    expect(faOf(getActiveDoc())!.states.find((s) => s.id === a)?.final).toBe(true);
    store().toggleFinal(a);
    expect(faOf(getActiveDoc())!.states.find((s) => s.id === a)?.final).toBe(false);
  });

  it('toFile → loadFile → igual', () => {
    const a = store().addState({ x: 0, y: 0 });
    const b = store().addState({ x: 160, y: 40 });
    store().setTransition(a, b, ['0', EPSILON]);
    store().setTransition(b, a, ['1']);
    store().toggleFinal(b);
    const t = faOf(getActiveDoc())!.transitions[0]!;
    store().setEdgeLayout(t.id, { curvature: 0.25 });
    store().renameDoc(store().activeId, 'meu autômato');
    const file = store().toFile() as AutomatonFile;
    const roundTrip = JSON.parse(JSON.stringify(file));
    store().loadFile(roundTrip);
    expect(store().docs).toHaveLength(2);
    const loaded = getActiveDoc();
    expect(loaded.name).toBe('meu autômato');
    expect(faOf(loaded)).toEqual(file.fa);
    expect(loaded.layout).toEqual(file.layout);
    expect(loaded.dirty).toBe(false);
    expect(store().toFile()).toEqual(file);
  });

  it('loadFile reaproveita a aba vazia e intocada', () => {
    const file = store().toFile() as AutomatonFile;
    store().loadFile({ ...file, name: 'x', fa: { states: [{ id: 's', name: 's', initial: true, final: false }], transitions: [] } });
    expect(store().docs).toHaveLength(1);
    expect(getActiveDoc().name).toBe('x');
    // sem posição no arquivo → o autoLayout completa
    expect(getActiveDoc().layout.positions.s).toBeDefined();
  });

  it('openInNewTab sem layout usa o autoLayout e fica como "não salvo"', () => {
    store().addState({ x: 0, y: 0 });
    const fa: FA = {
      states: [
        { id: 'a', name: 'q0', initial: true, final: false },
        { id: 'b', name: 'q1', initial: false, final: true },
      ],
      transitions: [{ id: 't', from: 'a', to: 'b', symbols: ['0'] }],
    };
    store().openInNewTab('AFD', fa);
    expect(store().docs).toHaveLength(2);
    const doc = getActiveDoc();
    expect(doc.name).toBe('AFD');
    expect(doc.dirty).toBe(true);
    expect(doc.layout.positions.a!.x).toBeLessThan(doc.layout.positions.b!.x);
  });

  it('histórico é por documento', () => {
    store().addState({ x: 0, y: 0 });
    const first = store().activeId;
    store().newDoc();
    expect(store().canUndo()).toBe(false);
    store().addState({ x: 0, y: 0 });
    store().setActive(first);
    store().undo();
    expect(faOf(getActiveDoc())!.states).toHaveLength(0);
    const other = store().docs.find((d) => d.id !== first)!;
    expect(faOf(other)!.states).toHaveLength(1);
  });

  it('markSaved tira o "não salvo"; desfazer até o salvo volta a ficar limpo', () => {
    store().addState({ x: 0, y: 0 });
    store().markSaved();
    expect(getActiveDoc().dirty).toBe(false);
    store().addState({ x: 10, y: 0 });
    expect(getActiveDoc().dirty).toBe(true);
    store().undo();
    expect(getActiveDoc().dirty).toBe(false);
  });

  it('fechar a última aba abre uma vazia; trocar de aba limpa o destaque', () => {
    store().newDoc('B');
    useHighlight.getState().set({ active: ['q0'], status: 'running' });
    store().setActive(store().docs[0]!.id);
    expect(useHighlight.getState().active).toEqual([]);
    for (const d of [...store().docs]) store().closeDoc(d.id);
    expect(store().docs).toHaveLength(1);
    expect(store().docs[0]!.id).toBe(store().activeId);
  });

  it('não modifica o FA antigo (imutável)', () => {
    const a = store().addState({ x: 0, y: 0 });
    const before = faOf(getActiveDoc())!;
    const copy = JSON.parse(JSON.stringify(before));
    store().toggleFinal(a);
    store().setTransition(a, a, ['x']);
    expect(before).toEqual(copy);
  });
});

const pr = (read: string, pop: string, push: string): PDARule => ({ read, pop, push });
const tr = (read: string, write: string, move: 'L' | 'R'): TMRule => ({ read, write, move });

describe('useDocuments: AP e MT', () => {
  beforeEach(reset);

  it('newDoc cria uma aba vazia do tipo pedido, com os padrões do Hopcroft', () => {
    store().newDoc('pilha', 'pda');
    expect(getActiveDoc().name).toBe('pilha');
    expect(pdaOf(getActiveDoc())).toEqual({ states: [], transitions: [], startStackSymbol: 'Z', acceptance: 'FINAL_STATE' });
    expect(faOf(getActiveDoc())).toBeNull();
    store().newDoc(undefined, 'tm');
    expect(tmOf(getActiveDoc())).toEqual({
      states: [],
      transitions: [],
      blank: 'B',
      acceptance: 'FINAL_STATE',
      inputAlphabet: [],
    });
    expect(getActiveDoc().dirty).toBe(false);
    expect(isEmptyDoc(getActiveDoc())).toBe(true);
    expect(store().docs).toHaveLength(3);
  });

  it('as ações genéricas valem para AP e MT', () => {
    for (const kind of ['pda', 'tm'] as const) {
      store().newDoc(undefined, kind);
      const a = store().addState({ x: 0, y: 0 });
      const b = store().addState({ x: 160, y: 0 });
      store().setInitial(b);
      store().toggleFinal(a);
      store().renameState(a, 'p');
      store().moveStates({ [b]: { x: 200, y: 40 } });
      const doc = getActiveDoc();
      expect(doc.automaton.kind).toBe(kind);
      const g = kind === 'pda' ? pdaOf(doc)! : tmOf(doc)!;
      expect(g.states).toEqual([
        { id: a, name: 'p', initial: false, final: true },
        { id: b, name: 'q1', initial: true, final: false },
      ]);
      expect(doc.layout.positions[b]).toEqual({ x: 200, y: 40 });
      store().removeElements([a], []);
      expect((kind === 'pda' ? pdaOf(getActiveDoc())! : tmOf(getActiveDoc())!).states).toHaveLength(1);
    }
  });

  it('setRules junta as regras no mesmo par (sem repetir, na ordem) e lista vazia apaga', () => {
    store().newDoc(undefined, 'pda');
    const a = store().addState({ x: 0, y: 0 });
    const b = store().addState({ x: 160, y: 0 });
    store().setRules(a, b, [pr('0', 'Z', '0Z'), pr('0', '0', '00')]);
    store().setRules(a, b, [pr('1', '0', ''), pr('0', 'Z', '0Z')]);
    let ts = pdaOf(getActiveDoc())!.transitions;
    expect(ts).toHaveLength(1);
    expect(ts[0]!.rules).toEqual([pr('0', 'Z', '0Z'), pr('0', '0', '00'), pr('1', '0', '')]);
    // laço nasce com o ângulo mais livre
    store().setRules(a, a, [pr('ε', 'Z', 'Z')]);
    const loop = pdaOf(getActiveDoc())!.transitions[1]!;
    expect(getActiveDoc().layout.edges[loop.id]?.loopAngle).toBeTypeOf('number');
    store().setRules(a, b, []);
    ts = pdaOf(getActiveDoc())!.transitions;
    expect(ts.map((t) => t.id)).toEqual([loop.id]);
  });

  it('setTransitionRules troca as regras (vazio apaga)', () => {
    store().newDoc(undefined, 'tm');
    const a = store().addState({ x: 0, y: 0 });
    store().setRules(a, a, [tr('0', '0', 'R')]);
    const t = tmOf(getActiveDoc())!.transitions[0]!;
    store().setTransitionRules(t.id, [tr('Y', 'Y', 'R'), tr('0', '0', 'R'), tr('Y', 'Y', 'R')]);
    expect(tmOf(getActiveDoc())!.transitions[0]!.rules).toEqual([tr('Y', 'Y', 'R'), tr('0', '0', 'R')]);
    // mesmas regras: não entra no histórico
    const before = store().meta[store().activeId]!.past.length;
    store().setTransitionRules(t.id, [tr('Y', 'Y', 'R'), tr('0', '0', 'R')]);
    expect(store().meta[store().activeId]!.past.length).toBe(before);
    store().setTransitionRules(t.id, []);
    expect(tmOf(getActiveDoc())!.transitions).toHaveLength(0);
    expect(getActiveDoc().layout.edges[t.id]).toBeUndefined();
  });

  it('regras do tipo errado e as ações de AF não fazem nada (e vice-versa)', () => {
    store().newDoc(undefined, 'pda');
    const a = store().addState({ x: 0, y: 0 });
    const doc = getActiveDoc();
    store().setRules(a, a, [tr('0', '0', 'R')]);
    store().setTransition(a, a, ['0']);
    expect(getActiveDoc().automaton).toBe(doc.automaton);
    store().setTMOptions({ blank: '_' });
    store().setRules(a, a, [{ read: '0', pop: 'Z' } as unknown as PDARule]);
    expect(getActiveDoc().automaton).toBe(doc.automaton);
    // num AF, regras não fazem nada
    store().newDoc();
    const q = store().addState({ x: 0, y: 0 });
    const fa = getActiveDoc().automaton;
    store().setRules(q, q, [pr('0', 'Z', 'Z')]);
    store().setPDAOptions({ acceptance: 'EMPTY_STACK' });
    expect(getActiveDoc().automaton).toBe(fa);
  });

  it('AP 0ⁿ1ⁿ do zero: desfazer 10 vezes volta ao início e refazer volta ao fim', () => {
    store().newDoc('0n1n', 'pda');
    const start = getActiveDoc();
    const q0 = store().addState({ x: 0, y: 0 });
    const q1 = store().addState({ x: 200, y: 0 });
    const q2 = store().addState({ x: 400, y: 0 });
    store().toggleFinal(q2);
    store().setRules(q0, q0, [pr('0', 'Z', '0Z'), pr('0', '0', '00')]);
    store().setRules(q0, q1, [pr('1', '0', '')]);
    store().setRules(q1, q1, [pr('1', '0', '')]);
    store().setRules(q1, q2, [pr('ε', 'Z', 'Z')]);
    store().setPDAOptions({ acceptance: 'EMPTY_STACK' });
    store().setPDAOptions({ acceptance: 'FINAL_STATE' });
    const end = getActiveDoc();
    expect(pdaOf(end)!.transitions.map((t) => t.rules.length)).toEqual([2, 1, 1, 1]);
    for (let i = 0; i < 10; i++) store().undo();
    expect(getActiveDoc().automaton).toBe(start.automaton);
    expect(getActiveDoc().dirty).toBe(false);
    expect(store().canUndo()).toBe(false);
    for (let i = 0; i < 10; i++) store().redo();
    expect(getActiveDoc().automaton).toEqual(end.automaton);
    expect(getActiveDoc().layout).toEqual(end.layout);
  });

  it('setPDAOptions: Z0 (com ou sem troca nas regras) e aceitação; símbolo inválido é ignorado', () => {
    store().newDoc(undefined, 'pda');
    const a = store().addState({ x: 0, y: 0 });
    store().setRules(a, a, [pr('0', 'Z', '0Z'), pr('Z', '0', '0')]);
    store().setPDAOptions({ startStackSymbol: '$' }, { renameInRules: true });
    let pda = pdaOf(getActiveDoc())!;
    expect(pda.startStackSymbol).toBe('$');
    // troca só na pilha (X e γ): o `a` lido não muda
    expect(pda.transitions[0]!.rules).toEqual([pr('0', '$', '0$'), pr('Z', '0', '0')]);
    store().setPDAOptions({ startStackSymbol: 'Y' });
    pda = pdaOf(getActiveDoc())!;
    expect(pda.startStackSymbol).toBe('Y');
    expect(pda.transitions[0]!.rules[0]).toEqual(pr('0', '$', '0$'));
    const before = getActiveDoc().automaton;
    store().setPDAOptions({ startStackSymbol: 'ZZ' });
    store().setPDAOptions({ startStackSymbol: 'ε' });
    store().setPDAOptions({ startStackSymbol: '' });
    expect(getActiveDoc().automaton).toBe(before);
    store().setPDAOptions({ acceptance: 'EMPTY_STACK' });
    expect(pdaOf(getActiveDoc())!.acceptance).toBe('EMPTY_STACK');
    store().undo();
    expect(pdaOf(getActiveDoc())!.acceptance).toBe('FINAL_STATE');
  });

  it('setTMOptions: branco (trocando nas regras), aceitação e Σ (sem o branco)', () => {
    store().newDoc(undefined, 'tm');
    const a = store().addState({ x: 0, y: 0 });
    store().setRules(a, a, [tr('B', 'B', 'R'), tr('0', 'X', 'R')]);
    store().setTMOptions({ blank: '_' }, { renameInRules: true });
    let tm: TM = tmOf(getActiveDoc())!;
    expect(tm.blank).toBe('_');
    expect(tm.transitions[0]!.rules).toEqual([tr('_', '_', 'R'), tr('0', 'X', 'R')]);
    store().setTMOptions({ acceptance: 'HALT', inputAlphabet: ['1', '0', '0', '_', 'ab'] });
    tm = tmOf(getActiveDoc())!;
    expect(tm.acceptance).toBe('HALT');
    expect(tm.inputAlphabet).toEqual(['0', '1']);
    // branco que já está em Σ sai de Σ
    store().setTMOptions({ blank: '1' });
    expect(tmOf(getActiveDoc())!.inputAlphabet).toEqual(['0']);
    const before = getActiveDoc().automaton;
    store().setTMOptions({});
    store().setTMOptions({ inputAlphabet: ['0'] });
    expect(getActiveDoc().automaton).toBe(before);
  });

  it('toFile → loadFile → igual (AP e MT), com o tipo no arquivo', () => {
    store().newDoc('pilha', 'pda');
    const a = store().addState({ x: 0, y: 0 });
    const b = store().addState({ x: 160, y: 40 });
    store().setRules(a, b, [pr('ε', 'Z', 'Z')]);
    store().setPDAOptions({ acceptance: 'EMPTY_STACK' });
    const original = getActiveDoc();
    const file = store().toFile();
    expect(file.kind).toBe('pda');
    store().loadFile(JSON.parse(JSON.stringify(file)));
    const loaded = getActiveDoc();
    expect(loaded.id).not.toBe(original.id);
    expect(loaded.name).toBe('pilha');
    expect(loaded.automaton).toEqual(original.automaton);
    expect(loaded.dirty).toBe(false);
    expect(store().toFile()).toEqual(file);

    store().newDoc('fita', 'tm');
    const q = store().addState({ x: 0, y: 0 });
    store().setRules(q, q, [tr('0', '1', 'L')]);
    store().setTMOptions({ inputAlphabet: ['0'] });
    const tmFile = store().toFile();
    expect(tmFile.kind).toBe('tm');
    store().loadFile(JSON.parse(JSON.stringify(tmFile)));
    expect(store().toFile()).toEqual(tmFile);
    expect(getActiveDoc().automaton.kind).toBe('tm');
  });

  it('openInNewTab aceita um Automaton de qualquer tipo (sem layout → autoLayout)', () => {
    store().openInNewTab('MT', {
      kind: 'tm',
      tm: {
        states: [
          { id: 'a', name: 'q0', initial: true, final: false },
          { id: 'b', name: 'q1', initial: false, final: true },
        ],
        transitions: [{ id: 't', from: 'a', to: 'b', rules: [tr('0', 'X', 'R')] }],
        blank: 'B',
        acceptance: 'FINAL_STATE',
        inputAlphabet: [],
      },
    });
    const doc = getActiveDoc();
    expect(doc.automaton.kind).toBe('tm');
    expect(doc.dirty).toBe(true);
    expect(doc.layout.positions.a!.x).toBeLessThan(doc.layout.positions.b!.x);
  });
});

describe('ajudantes', () => {
  it('normalizeRules tira repetidas e mantém a ordem', () => {
    expect(normalizeRules([pr('1', 'Z', ''), pr('0', 'Z', '0Z'), pr('1', 'Z', '')], pdaRuleKey)).toEqual([
      pr('1', 'Z', ''),
      pr('0', 'Z', '0Z'),
    ]);
  });
  it('nextId nunca reaproveita', () => {
    expect(nextId('q', [])).toBe('q0');
    expect(nextId('q', ['q0', 'q5', 'x'])).toBe('q6');
  });
  it('normalizeSymbols ordena, tira repetidos e põe ε no fim', () => {
    expect(normalizeSymbols(['b', EPSILON, 'a', 'b', ''])).toEqual(['a', 'b', EPSILON]);
  });
});
