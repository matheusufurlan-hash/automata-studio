import type { PDA, PDAIDNode, PDASimulationResult } from './types';
import { EPSILON, PDA_DEFAULT_MAX_NODES } from './types';
import { accepts, formatConfig, simulate } from './index';
import { MAX_STACK_SYMBOLS } from './simulate';
import { hopcroft62, pda } from './test-helpers';

/** Caminho no formato do Hopcroft: "(q0, 11, Z) ⊢ (q0, 1, 1Z) ⊢ ...". */
function trace(p: PDA, r: PDASimulationResult): string {
  return r.path.map((i) => formatConfig(p, r.tree[i]!.config)).join(' ⊢ ');
}

/** Resumo de um nó: [ID, status, pai, via "t:regra"]. */
function brief(p: PDA, n: PDAIDNode): [string, string, number | null, string | null] {
  return [formatConfig(p, n.config), n.status, n.parent, n.via ? `${n.via.transition}:${n.via.rule}` : null];
}

describe('simulate: Exemplo 6.2 do Hopcroft (wwᴿ)', () => {
  const p = hopcroft62();

  it('1111: o caminho é a sequência de IDs do livro', () => {
    const r = simulate(p, '1111');
    expect(r.accepted).toBe(true);
    expect(r.acceptance).toBe('FINAL_STATE');
    expect(r.reason).toBeUndefined();
    expect(r.limitReached).toBe(false);
    expect(trace(p, r)).toBe(
      '(q0, 1111, Z) ⊢ (q0, 111, 1Z) ⊢ (q0, 11, 11Z) ⊢ (q1, 11, 11Z) ⊢ (q1, 1, 1Z) ⊢ (q1, ε, Z) ⊢ (q2, ε, Z)',
    );
  });

  it('11: árvore inteira em largura, filhos na ordem das transições e das regras', () => {
    const r = simulate(p, '11');
    expect(r.tree.map((n) => brief(p, n))).toEqual([
      ['(q0, 11, Z)', 'EXPANDED', null, null],
      ['(q0, 1, 1Z)', 'EXPANDED', 0, 't0:1'],
      ['(q1, 11, Z)', 'EXPANDED', 0, 't1:0'],
      ['(q0, ε, 11Z)', 'EXPANDED', 1, 't0:5'],
      ['(q1, 1, 1Z)', 'EXPANDED', 1, 't1:2'],
      ['(q2, 11, Z)', 'DEAD', 2, 't3:0'],
      ['(q1, ε, 11Z)', 'DEAD', 3, 't1:2'],
      ['(q1, ε, Z)', 'EXPANDED', 4, 't2:1'],
      ['(q2, ε, Z)', 'ACCEPTING', 7, 't3:0'],
    ]);
    expect(r.tree.map((n) => n.depth)).toEqual([0, 1, 1, 2, 2, 2, 3, 3, 4]);
    expect(r.tree.map((n) => n.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(r.tree[0]!.children).toEqual([1, 2]);
    expect(r.tree[1]!.children).toEqual([3, 4]);
    expect(r.tree[5]!.children).toEqual([]);
    expect(r.path).toEqual([0, 1, 4, 7, 8]);
  });

  it('10 (ímpar): rejeita; o caminho vai até a 1ª ID que leu a palavra toda', () => {
    const r = simulate(p, '10');
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('NO_ACCEPTING_PATH');
    expect(r.limitReached).toBe(false);
    expect(r.stoppedAt).toBeUndefined();
    expect(r.tree.map((n) => n.status)).toEqual(['EXPANDED', 'EXPANDED', 'EXPANDED', 'EXPANDED', 'DEAD', 'DEAD', 'DEAD']);
    expect(trace(p, r)).toBe('(q0, 10, Z) ⊢ (q0, 0, 1Z) ⊢ (q0, ε, 01Z)');
  });

  it('palavra vazia: aceita (ε = εεᴿ) pelo caminho mais curto', () => {
    const r = simulate(p, '');
    expect(r.accepted).toBe(true);
    expect(trace(p, r)).toBe('(q0, ε, Z) ⊢ (q1, ε, Z) ⊢ (q2, ε, Z)');
  });

  it('por pilha vazia (regra 5 trocada por ε, Z/ε): N(P) = wwᴿ', () => {
    const n = hopcroft62('EMPTY_STACK');
    const r = simulate(n, '0110');
    expect(r.accepted).toBe(true);
    expect(r.acceptance).toBe('EMPTY_STACK');
    expect(formatConfig(n, r.tree[r.path.at(-1)!]!.config)).toBe('(q2, ε, ε)');
    expect(accepts(n, '011')).toBe(false);
    expect(accepts(n, '')).toBe(true);
  });

  it('accepts é o mesmo que simulate(...).accepted', () => {
    for (const w of ['', '0', '00', '01', '0110', '1001', '10101', '110011']) {
      expect(accepts(p, w), w).toBe(simulate(p, w).accepted);
    }
    expect(accepts(p, '110011', { maxNodes: 3 })).toBe(false);
  });
});

describe('simulate: aceitação', () => {
  it('estado final: só depois de ler a palavra TODA', () => {
    const p = pda('q0', ['q1'], ['q0 a,Z/Z q1', 'q1 a,Z/Z q1']);
    expect(accepts(p, 'a')).toBe(true);
    expect(accepts(p, 'aaa')).toBe(true);
    expect(accepts(p, '')).toBe(false);
    // passou pelo final no meio da palavra e morreu depois: rejeita
    const q = pda('q0', ['q1'], ['q0 a,Z/Z q1', 'q1 b,Z/Z q2']);
    expect(accepts(q, 'ab')).toBe(false);
  });

  it('pilha vazia: só depois de ler a palavra toda, em qualquer estado', () => {
    const p = pda('q0', [], ['q0 a,Z/ε q1'], { acceptance: 'EMPTY_STACK' });
    expect(accepts(p, 'a')).toBe(true);
    expect(accepts(p, '')).toBe(false);
  });

  it('inicial final aceita a palavra vazia sem nenhum movimento', () => {
    const p = pda('q0', ['q0'], ['q0 a,Z/Z q0']);
    const r = simulate(p, '');
    expect(r.tree).toHaveLength(1);
    expect(r.tree[0]!.status).toBe('ACCEPTING');
    expect(r.path).toEqual([0]);
  });

  it('os estados finais não importam na aceitação por pilha vazia (e vice-versa)', () => {
    const p = pda('q0', ['q0'], ['q0 a,Z/ε q0'], { acceptance: 'EMPTY_STACK' });
    expect(accepts(p, '')).toBe(false);
    expect(accepts(p, 'a')).toBe(true);
    expect(accepts({ ...p, acceptance: 'FINAL_STATE' }, '')).toBe(true);
  });

  it('o caminho de aceitação é o MAIS CURTO, mesmo que outra transição venha antes', () => {
    const p = pda('q0', ['q2'], ['q0 ε,Z/Z q1', 'q1 ε,Z/Z q2', 'q0 ε,Z/Z q2']);
    const r = simulate(p, '');
    expect(r.path).toEqual([0, 2]);
    expect(r.tree[2]!.via).toEqual({ transition: 't2', rule: 0 });
  });

  it('pilha vazia no meio da palavra: nenhuma regra se aplica (não existe "topo ε")', () => {
    const p = pda('q0', [], ['q0 0,X/XX|0,Z/XZ q0', 'q0 ε,X/X q1', 'q1 1,X/ε q1', 'q1 ε,Z/ε q2'], {
      acceptance: 'EMPTY_STACK',
    });
    expect(accepts(p, '01')).toBe(true);
    const r = simulate(p, '0110');
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('NO_ACCEPTING_PATH');
    const empty = r.tree.find((n) => n.config.stack === '')!;
    expect(formatConfig(p, empty.config)).toBe('(q2, 10, ε)');
    expect(empty.status).toBe('DEAD');
    expect(trace(p, r)).toBe('(q0, 0110, Z) ⊢ (q0, 110, XZ) ⊢ (q1, 110, XZ) ⊢ (q1, 10, Z)');
  });
});

describe('simulate: árvore, ciclos e limites', () => {
  // o exemplo do YAAS "ciclo de transições ε" (q0 → q1 → q0 sem ler nada)
  const cycle = pda('q0', ['q2'], ['q0 ε,Z/Z q2', 'q0 ε,Z/Z q1', 'q1 ε,Z/Z q0']);

  it('para na 1ª ID que aceita: o resto da fila fica UNEXPLORED', () => {
    const r = simulate(cycle, '');
    expect(r.accepted).toBe(true);
    expect(r.limitReached).toBe(false);
    expect(r.tree.map((n) => [formatConfig(cycle, n.config), n.status])).toEqual([
      ['(q0, ε, Z)', 'EXPANDED'],
      ['(q2, ε, Z)', 'ACCEPTING'],
      ['(q1, ε, Z)', 'UNEXPLORED'],
    ]);
    expect(r.path).toEqual([0, 1]);
  });

  it('exploreAll: continua depois de aceitar; ID repetida vira REPEATED e não é expandida', () => {
    const r = simulate(cycle, '', { exploreAll: true });
    expect(r.accepted).toBe(true);
    expect(r.limitReached).toBe(false);
    expect(r.tree.map((n) => [formatConfig(cycle, n.config), n.status])).toEqual([
      ['(q0, ε, Z)', 'EXPANDED'],
      ['(q2, ε, Z)', 'ACCEPTING'],
      ['(q1, ε, Z)', 'EXPANDED'],
      ['(q0, ε, Z)', 'REPEATED'],
    ]);
    expect(r.path).toEqual([0, 1]);
  });

  it('ciclo de ε sem saída: termina (REPEATED) e rejeita sem bater no limite', () => {
    const p = pda('q0', [], ['q0 ε,Z/Z q1', 'q1 ε,Z/Z q0']);
    const r = simulate(p, '');
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('NO_ACCEPTING_PATH');
    expect(r.tree.map((n) => n.status)).toEqual(['EXPANDED', 'EXPANDED', 'REPEATED']);
  });

  it('REPEATED vale para IDs de OUTROS ramos também', () => {
    const p = pda('q0', [], ['q0 ε,Z/Z q1', 'q0 ε,Z/Z q2', 'q1 ε,Z/Z q3', 'q2 ε,Z/Z q3']);
    const r = simulate(p, '');
    expect(r.tree.map((n) => [formatConfig(p, n.config), n.status])).toEqual([
      ['(q0, ε, Z)', 'EXPANDED'],
      ['(q1, ε, Z)', 'EXPANDED'],
      ['(q2, ε, Z)', 'EXPANDED'],
      ['(q3, ε, Z)', 'DEAD'],
      ['(q3, ε, Z)', 'REPEATED'],
    ]);
  });

  it('com exploreAll, todas as IDs que aceitam ficam ACCEPTING; o caminho vai para a primeira', () => {
    const p = pda('q0', ['q1', 'q2'], ['q0 ε,Z/Z q1', 'q0 ε,Z/Z q2']);
    const r = simulate(p, '', { exploreAll: true });
    expect(r.tree.map((n) => n.status)).toEqual(['EXPANDED', 'ACCEPTING', 'ACCEPTING']);
    expect(r.path).toEqual([0, 1]);
  });

  it('ciclo de ε que EMPILHA sem parar: a ID nunca repete e a busca para no limite', () => {
    const p = pda('q0', ['q1'], ['q0 ε,Z/ZZ q0', 'q0 a,Z/Z q1']);
    const r = simulate(p, '', { maxNodes: 50 });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('LIMIT_REACHED');
    expect(r.limitReached).toBe(true);
    expect(r.tree).toHaveLength(50);
    expect(r.tree.at(-1)!.status).toBe('UNEXPLORED');
    expect(r.tree.at(-1)!.config.stack).toBe('Z'.repeat(50));
    expect(r.tree.slice(0, -1).every((n) => n.status === 'EXPANDED')).toBe(true);
    // com o limite padrão também termina
    const d = simulate(p, '');
    expect(d.reason).toBe('LIMIT_REACHED');
    expect(d.tree).toHaveLength(PDA_DEFAULT_MAX_NODES);
  });

  it('salvaguarda de memória: pilha que cresce muito por passo para mesmo sem limite de nós', () => {
    const p = pda('q0', ['q1'], [`q0 ε,Z/${'Z'.repeat(1000)} q0`]);
    const r = simulate(p, '', { maxNodes: Infinity });
    expect(r.reason).toBe('LIMIT_REACHED');
    expect(r.limitReached).toBe(true);
    const total = r.tree.reduce((sum, n) => sum + n.config.stack.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_STACK_SYMBOLS);
    expect(r.tree.length).toBeLessThan(400);
  });

  it('maxNodes conta todos os nós; expandir é tudo ou nada', () => {
    const p = hopcroft62();
    const r = simulate(p, '1111', { maxNodes: 4 });
    // raiz + 2 filhos = 3; o nó 1 tem 2 filhos e não cabe (5 > 4)
    expect(r.tree.map((n) => n.status)).toEqual(['EXPANDED', 'UNEXPLORED', 'UNEXPLORED']);
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('LIMIT_REACHED');
    expect(r.limitReached).toBe(true);
    expect(trace(p, r)).toBe('(q0, 1111, Z) ⊢ (q0, 111, 1Z)');

    for (const maxNodes of [1, 0, -5, 0.5]) {
      const one = simulate(p, '1111', { maxNodes });
      expect(one.tree.map((n) => n.status)).toEqual(['UNEXPLORED']);
      expect(one.limitReached).toBe(true);
      expect(one.path).toEqual([0]);
    }
    // com folga suficiente, aceita
    expect(simulate(p, '1111', { maxNodes: 1000 }).accepted).toBe(true);
    expect(simulate(p, '1111', { maxNodes: NaN }).accepted).toBe(true);
  });

  it('exploreAll + limite: aceita e ainda avisa que parou no limite', () => {
    const p = pda('q0', ['q1'], ['q0 ε,Z/Z q1', 'q0 ε,Z/ZZ q0']);
    const r = simulate(p, '', { exploreAll: true, maxNodes: 20 });
    expect(r.accepted).toBe(true);
    expect(r.limitReached).toBe(true);
    expect(r.reason).toBeUndefined();
  });
});

describe('simulate: casos de borda', () => {
  it('sem estado inicial: árvore e caminho vazios', () => {
    const r = simulate(pda(null, [], ['q0 a,Z/Z q1']), 'a');
    expect(r).toEqual({
      accepted: false,
      acceptance: 'FINAL_STATE',
      tree: [],
      path: [],
      limitReached: false,
      reason: 'NO_INITIAL_STATE',
    });
  });

  it('autômato sem estados: NO_INITIAL_STATE', () => {
    const r = simulate({ states: [], transitions: [], startStackSymbol: 'Z', acceptance: 'EMPTY_STACK' }, '');
    expect(r.reason).toBe('NO_INITIAL_STATE');
    expect(r.acceptance).toBe('EMPTY_STACK');
  });

  it('símbolo fora de Σ: só a raiz, posição do 1º símbolo estranho', () => {
    const p = hopcroft62();
    const r = simulate(p, '01x0y');
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('SYMBOL_NOT_IN_ALPHABET');
    expect(r.stoppedAt).toBe(2);
    expect(r.path).toEqual([0]);
    expect(r.tree).toHaveLength(1);
    expect(r.tree[0]!.config).toEqual({ state: 'q0', remaining: '01x0y', stack: 'Z' });
    expect(r.tree[0]!.status).toBe('UNEXPLORED');
    // ε digitado não é símbolo de Σ
    expect(simulate(p, EPSILON).reason).toBe('SYMBOL_NOT_IN_ALPHABET');
  });

  it('mais de um inicial: a simulação usa o primeiro (ordem de states)', () => {
    const p = pda('q1', ['q2'], ['q0 a,Z/Z q2', 'q1 b,Z/Z q2'], { states: ['q0', 'q1', 'q2'] });
    p.states[0]!.initial = true;
    expect(accepts(p, 'a')).toBe(true);
    expect(accepts(p, 'b')).toBe(false);
  });

  it('regras inválidas e transições penduradas são ignoradas; a via guarda o índice original', () => {
    const p = pda('q0', ['q1'], ['q0 b,Z/Z q1']);
    p.transitions[0]!.rules.unshift({ read: 'a', pop: EPSILON, push: '' }, { read: 'a', pop: 'Z', push: `${EPSILON}` });
    p.transitions.push({ id: 'x', from: 'q0', to: 'sumiu', rules: [{ read: 'c', pop: 'Z', push: '' }] });
    expect(accepts(p, 'a')).toBe(false);
    expect(simulate(p, 'c').reason).toBe('SYMBOL_NOT_IN_ALPHABET');
    const r = simulate(p, 'b');
    expect(r.accepted).toBe(true);
    expect(r.tree[1]!.via).toEqual({ transition: 't0', rule: 2 });
  });

  it('pares (from, to) repetidos valem como a união das regras; regra repetida não duplica filho', () => {
    const p = pda('q0', ['q1'], ['q0 a,Z/Z q1', 'q0 b,Z/Z|a,Z/Z q1']);
    expect(accepts(p, 'a')).toBe(true);
    expect(accepts(p, 'b')).toBe(true);
    const r = simulate(p, 'a');
    expect(r.tree).toHaveLength(2);
    expect(r.tree[1]!.via).toEqual({ transition: 't0', rule: 0 });
    expect(simulate(p, 'b').tree[1]!.via).toEqual({ transition: 't1', rule: 0 });
  });

  it('γ com vários símbolos: o 1º fica no topo', () => {
    const p = pda('q0', [], ['q0 a,Z/XYZ q1', 'q1 ε,X/ε q1'], { acceptance: 'EMPTY_STACK' });
    const r = simulate(p, 'a');
    expect(r.tree.map((n) => n.config.stack)).toEqual(['Z', 'XYZ', 'YZ']);
    expect(r.tree[2]!.status).toBe('DEAD');
  });
});
