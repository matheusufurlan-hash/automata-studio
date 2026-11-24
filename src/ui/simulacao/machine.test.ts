import { PDA_EXAMPLES } from '../../core/pda/examples';
import type { PDA } from '../../core/pda/types';
import { TM_EXAMPLES } from '../../core/tm/examples';
import type { TM } from '../../core/tm/types';
import type { PDARun, TMRun } from './machine';
import {
  elide,
  idItem,
  idWindow,
  machineHighlight,
  ntmPath,
  pdaConfigAt,
  pdaIdText,
  pdaStepText,
  pdaVerdict,
  runMachine,
  stackEffect,
  stackView,
  stepCount,
  tapeWindow,
  tmConfigAt,
  tmIdText,
  tmStepText,
  tmVerdict,
  withFocus,
} from './machine';

const pdaEx = (id: string) => PDA_EXAMPLES.find((e) => e.id === id)!.pda;
const tmEx = (id: string) => TM_EXAMPLES.find((e) => e.id === id)!.tm;
const pdaRun = (pda: PDA, w: string, maxNodes = 5000) =>
  runMachine({ kind: 'pda', pda }, w, { maxNodes, maxSteps: 10000, exploreAll: false }) as PDARun;
const tmRun = (tm: TM, w: string, maxSteps = 10000) =>
  runMachine({ kind: 'tm', tm }, w, { maxNodes: 5000, maxSteps, exploreAll: false }) as TMRun;

describe('AP: caminho, IDs e resultado', () => {
  it('Exemplo 6.2 com 0110: as IDs do livro e ACEITA por estado final', () => {
    const run = pdaRun(pdaEx('ap-palindromo-par'), '0110');
    const ids = Array.from({ length: stepCount(run) }, (_, i) => pdaIdText(run.pda, pdaConfigAt(run, i)));
    expect(ids.join(' ⊢ ')).toBe(
      '(q0, 0110, Z) ⊢ (q0, 110, 0Z) ⊢ (q0, 10, 10Z) ⊢ (q1, 10, 10Z) ⊢ (q1, 0, 0Z) ⊢ (q1, ε, Z) ⊢ (q2, ε, Z)',
    );
    const v = pdaVerdict(run);
    expect(v.tone).toBe('accepted');
    expect(v.title).toBe('Por estado final');
    expect(v.text).toContain('(q2, ε, Z)');
  });

  it('011 rejeita: todos os caminhos morreram, e mostra o que mais avançou', () => {
    const run = pdaRun(pdaEx('ap-palindromo-par'), '011');
    const v = pdaVerdict(run);
    expect(v.tone).toBe('rejected');
    expect(v.title).toBe('Nenhum caminho aceita');
    expect(v.text).toContain('todos morreram ou se repetiram');
    expect(v.text).toContain('O que mais avançou leu a palavra toda e chegou em (q0, ε, 110Z), mas dali nenhum movimento ε leva a um estado final');
  });

  it('o ramo que parou no meio: diz quanto leu e o que faltou', () => {
    const run = pdaRun(pdaEx('ap-0n1n'), '0101');
    expect(pdaVerdict(run).text).toContain(
      'leu 2 de 4 símbolos e chegou em (q1, 01, Z); dali só há movimentos ε, e nenhum deles consegue ler 0',
    );
    const dead = pdaRun(pdaEx('apd-0n1n'), '10');
    expect(pdaVerdict(dead).text).toContain('leu 0 de 2 símbolos e parou em (q0, 10, Z): nenhuma regra de q0 lê 1 (nem ε) com Z no topo');
  });

  it('pilha vazia: o modo aparece no resultado', () => {
    const v = pdaVerdict(pdaRun(pdaEx('ap-palindromo-par-pilha-vazia'), '0110'));
    expect(v.title).toBe('Por pilha vazia');
    expect(v.text).toContain('a pilha ficou vazia');
  });

  it('símbolo que nenhuma regra lê: diz qual e onde', () => {
    const v = pdaVerdict(pdaRun(pdaEx('ap-palindromo-par'), '01a'));
    expect(v.text).toContain("'a' (posição 3)");
    expect(v.text).toContain('Σ = {0, 1}');
  });

  it('limite: INDEFINIDO com o botão Buscar mais', () => {
    // ciclo de ε que empilha sem parar: a busca nunca acaba sozinha
    const pda: PDA = {
      states: [{ id: 'q0', name: 'q0', initial: true, final: false }],
      transitions: [{ id: 't0', from: 'q0', to: 'q0', rules: [{ read: 'ε', pop: 'Z', push: 'ZZ' }] }],
      startStackSymbol: 'Z',
      acceptance: 'FINAL_STATE',
    };
    const v = pdaVerdict(pdaRun(pda, '', 50));
    expect(v.tone).toBe('undecided');
    expect(v.text).toContain('parei depois de 50 descrições instantâneas');
    expect(v.more?.label).toBe('Buscar mais');
  });

  it('sem estado inicial: nenhuma ID e o motivo', () => {
    const pda = { ...pdaEx('ap-0n1n'), states: pdaEx('ap-0n1n').states.map((s) => ({ ...s, initial: false })) };
    const run = pdaRun(pda, '01');
    expect(stepCount(run)).toBe(0);
    expect(pdaVerdict(run).title).toBe('Sem estado inicial');
    expect(machineHighlight(run, 0).active).toEqual([]);
  });

  it('explica o passo com δ do livro e o efeito na pilha', () => {
    const run = pdaRun(pdaEx('ap-palindromo-par'), '0110');
    expect(pdaStepText(run, 0)?.title).toBe('Início');
    const s1 = pdaStepText(run, 1)!;
    expect(s1.title).toBe("Leu '0'");
    expect(s1.formula).toBe('(q0, 0Z) ∈ δ(q0, 0, Z)');
    expect(s1.move).toBe('(q0, 0110, Z) ⊢ (q0, 110, 0Z)');
    expect(s1.note).toBe('empilhou 0 em cima do Z');
    expect(pdaStepText(run, 3)!.title).toBe('Movimento ε (não lê nada)');
    expect(pdaStepText(run, 4)!.note).toBe('tirou 1 do topo (desempilhou)');
  });

  it('destaque: estado, seta e a regra usada; no fim, a cor do resultado', () => {
    const run = pdaRun(pdaEx('ap-palindromo-par'), '0110');
    const h1 = machineHighlight(run, 1);
    expect(h1.active).toEqual(['q0']);
    expect(h1.transitions).toEqual(['t0']);
    expect(h1.rules).toEqual([{ transition: 't0', rule: 0 }]);
    expect(h1.status).toBe('running');
    expect(machineHighlight(run, 6).status).toBe('accepted');
    expect(machineHighlight(pdaRun(pdaEx('ap-palindromo-par'), '011'), 99).status).toBe('rejected');
  });

  it('foco num nó da árvore troca o caminho mostrado', () => {
    const run = pdaRun(pdaEx('ap-palindromo-par'), '0110');
    const dead = run.result.tree.find((n) => n.status === 'DEAD')!;
    const f = withFocus(run, dead.index);
    expect(f.focus).toBe(dead.index);
    expect(f.path![f.path!.length - 1]).toBe(dead.index);
    expect(machineHighlight(f, 99).status).toBe('rejected');
    expect(withFocus(f, null).path).toEqual(run.result.path);
  });

  it('IDs longas são encurtadas no meio', () => {
    expect(elide('0123456789', 6, 2)).toBe('012…89');
    expect(elide('abc', 6, 2)).toBe('abc');
  });
});

describe('pilha', () => {
  it('empilhar: só o que entrou é novo; o fundo é o Z0', () => {
    const v = stackView('0Z', '10Z', 'Z');
    expect(v.cells.map((c) => c.sym)).toEqual(['1', '0', 'Z']);
    expect(v.cells.map((c) => c.pushed)).toEqual([true, false, false]);
    expect(v.cells[2]!.bottom).toBe(true);
    expect(v.popped).toEqual([]);
  });

  it('desempilhar: o que saiu vai para `popped`', () => {
    const v = stackView('10Z', '0Z', 'Z');
    expect(v.popped).toEqual(['1']);
    expect(v.cells.some((c) => c.pushed)).toBe(false);
  });

  it('trocar o topo e pilha vazia', () => {
    expect(stackView('XZ', 'YZ', 'Z').cells[0]!.pushed).toBe(true);
    const empty = stackView('Z', '', 'Z');
    expect(empty.size).toBe(0);
    expect(empty.popped).toEqual(['Z']);
  });

  it('pilha grande: o topo, "+N" e o fundo', () => {
    const v = stackView(null, 'XXXXXXXXXXZ', 'Z', 7);
    expect(v.cells.length).toBe(6);
    expect(v.hidden).toBe(5);
    expect(v.cells[v.cells.length - 1]!.sym).toBe('Z');
  });

  it('efeito de cada regra em palavras', () => {
    expect(stackEffect({ read: '0', pop: 'Z', push: '0Z' })).toBe('empilhou 0 em cima do Z');
    expect(stackEffect({ read: '0', pop: 'Z', push: 'Z' })).toContain('a pilha não mudou');
    expect(stackEffect({ read: '0', pop: 'X', push: '' })).toBe('tirou X do topo (desempilhou)');
    expect(stackEffect({ read: '0', pop: 'X', push: 'YW' })).toBe('trocou X por YW (Y fica no topo)');
  });
});

describe('MT: fita, IDs e resultado', () => {
  it('Exemplo 8.2 com 0011: exatamente as IDs do livro', () => {
    const run = tmRun(tmEx('mt-0n1n'), '0011');
    const ids = Array.from({ length: stepCount(run) }, (_, i) => tmIdText(run.tm, tmConfigAt(run, i)));
    expect(ids.join(' ⊢ ')).toBe(
      'q00011 ⊢ Xq1011 ⊢ X0q111 ⊢ Xq20Y1 ⊢ q2X0Y1 ⊢ Xq00Y1 ⊢ XXq1Y1 ⊢ XXYq11 ⊢ XXq2YY ⊢ Xq2XYY ⊢ XXq0YY ⊢ XXYq3Y ⊢ XXYYq3B ⊢ XXYYBq4B',
    );
    expect(tmVerdict(run).tone).toBe('accepted');
    expect(idItem(run, 1).parts).toEqual({ left: 'X', state: 'q1', right: '011' });
    expect(idItem(run, 1).rule).toBe('0/X →');
  });

  it('passo com δ(q, X) = (p, Y, D) e setas', () => {
    const run = tmRun(tmEx('mt-0n1n'), '0011');
    const s = tmStepText(run, 1)!;
    expect(s.formula).toBe('δ(q0, 0) = (q1, X, →)');
    expect(s.title).toBe('Leu 0, escreveu X e foi para a direita');
    expect(s.move).toBe('q00011 ⊢ Xq1011');
  });

  it('monus (por parada): ACEITA com a saída', () => {
    const v = tmVerdict(tmRun(tmEx('mt-monus'), '0000100'));
    expect(v.tone).toBe('accepted');
    expect(v.output).toBe('00');
  });

  it('parou fora de um final: REJEITA', () => {
    const v = tmVerdict(tmRun(tmEx('mt-0n1n'), '0010'));
    expect(v.tone).toBe('rejected');
    expect(v.title).toBe('Parou fora de um estado final');
  });

  it('laço: NÃO PARA, dizendo o passo que se repetiu', () => {
    const tm = { ...tmEx('mt-laco-infinito'), acceptance: 'HALT' as const };
    const run = tmRun(tm, '01');
    expect(run.result.stop).toBe('LOOP');
    const v = tmVerdict(run);
    expect(v.tone).toBe('loop');
    expect(v.text).toContain(`a configuração do passo ${run.result.loopStart} se repetiu`);
    expect(machineHighlight(run, 999).status).toBe('running');
  });

  it('limite de passos: INDEFINIDO com o botão Continuar', () => {
    const run = tmRun(tmEx('mt-divisao'), '0010001', 500);
    const v = tmVerdict(run);
    expect(v.tone).toBe('undecided');
    expect(v.text).toContain('parei depois de 500 passos');
    expect(v.more?.label).toBe('Continuar');
  });

  it('branco na entrada e símbolo fora de Σ', () => {
    expect(tmVerdict(tmRun(tmEx('mt-0n1n'), '0B1')).text).toContain('o branco B na posição 2');
    expect(tmVerdict(tmRun(tmEx('mt-0n1n'), '012')).text).toContain("o símbolo '2' (posição 3) não está em Σ = {0, 1}");
  });

  it('MT não determinística: o caminho na árvore é o mesmo dos passos', () => {
    const run = tmRun(tmEx('mt-nao-deterministica'), '100');
    expect(run.path).toEqual(ntmPath(run.result));
    expect(run.path!.length).toBe(run.result.steps.length);
    expect(tmStepText(run, 2)!.formula).toContain('∈ δ(');
  });

  it('janela da fita: brancos fora do trecho guardado', () => {
    const run = tmRun(tmEx('mt-0n1n'), '01');
    const cells = tapeWindow(tmConfigAt(run, 0), -2, 3, 'B');
    expect(cells.map((c) => c.sym).join('')).toBe('BB01BB');
    expect(cells.map((c) => c.pos)).toEqual([-2, -1, 0, 1, 2, 3]);
  });
});

describe('janela da sequência de IDs', () => {
  it('em volta do passo, sem passar das pontas', () => {
    expect(idWindow(10000, 5000, 40)).toEqual({ start: 4960, end: 5040 });
    expect(idWindow(10000, 0, 40)).toEqual({ start: 0, end: 80 });
    expect(idWindow(10000, 9999, 40)).toEqual({ start: 9919, end: 9999 });
    expect(idWindow(5, 2, 40)).toEqual({ start: 0, end: 4 });
  });
});
