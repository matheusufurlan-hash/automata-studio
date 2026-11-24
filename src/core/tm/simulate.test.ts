import type { TM } from './types';
import { TM_DEFAULT_MAX_NODES, TM_DEFAULT_MAX_STEPS } from './types';
import { accepts, formatConfig, simulate } from './index';
import { idText } from './basics';
import { MAX_TAPE_SYMBOLS } from './simulate';
import { hopcroft82, ids, tm } from './test-helpers';

/** Monus do Hopcroft (Exemplo 8.4): 0^m 1 0^n → 0^(m ∸ n), aceitação por parada. */
function monus(): TM {
  return tm(
    'q0',
    [],
    [
      'q0 0BR q1', 'q1 11R q2', 'q1 00R q1', 'q0 1BR q5', 'q5 0BR|1BR q5', 'q2 11R q2', 'q2 01L q3',
      'q2 BBL q4', 'q3 00L|11L q3', 'q4 00L|1BL q4', 'q5 BBR q6', 'q4 B0R q6', 'q3 BBR q0',
    ],
    { acceptance: 'HALT', sigma: '01' },
  );
}

describe('simulate: Exemplo 8.2 do Hopcroft (0ⁿ1ⁿ)', () => {
  const m = hopcroft82();

  it('0011: exatamente a sequência de IDs do livro', () => {
    const r = simulate(m, '0011');
    expect(ids(m, r).join(' ⊢ ')).toBe(
      'q00011 ⊢ Xq1011 ⊢ X0q111 ⊢ Xq20Y1 ⊢ q2X0Y1 ⊢ Xq00Y1 ⊢ XXq1Y1 ⊢ XXYq11 ⊢ XXq2YY ⊢ Xq2XYY ⊢ XXq0YY ⊢ XXYq3Y ⊢ XXYYq3B ⊢ XXYYBq4B',
    );
    expect(r.accepted).toBe(true);
    expect(r.acceptance).toBe('FINAL_STATE');
    expect(r.stop).toBe('ACCEPTED_FINAL');
    expect(r.output).toBe('XXYY');
    expect(r.tree).toBeUndefined();
    expect(r.loopStart).toBeUndefined();
  });

  it('passos: índice, configuração (trecho mínimo + cabeça + origem) e regra usada', () => {
    const r = simulate(m, '0011');
    expect(r.steps[0]).toEqual({ index: 0, config: { state: 'q0', tape: '0011', head: 0, origin: 0 }, via: null });
    expect(r.steps[1]).toEqual({
      index: 1,
      config: { state: 'q1', tape: 'X011', head: 1, origin: 0 },
      via: { transition: 't0', rule: 0 },
    });
    expect(r.steps[12]!.config).toEqual({ state: 'q3', tape: 'XXYYB', head: 4, origin: 0 });
    expect(r.steps[13]).toEqual({
      index: 13,
      config: { state: 'q4', tape: 'XXYYBB', head: 5, origin: 0 },
      via: { transition: 't7', rule: 0 },
    });
    expect(r.steps.map((s) => s.index)).toEqual([...Array(14).keys()]);
  });

  it('rejeições: para (HALTED) fora de um final', () => {
    for (const w of ['', '0', '1', '01 1'.replace(' ', ''), '0010', '0101', '10']) {
      const r = simulate(m, w);
      expect(r.accepted, w).toBe(false);
      expect(r.stop, w).toBe('HALTED');
      expect(r.output, w).toBe(ids(m, r).at(-1)!.replace(/q\d/, '').replace(/^B+|B+$/g, ''));
    }
    expect(accepts(m, '000111')).toBe(true);
  });

  it('palavra vazia: a fita é só o branco da cabeça, na célula 0', () => {
    const r = simulate(m, '');
    expect(r.steps).toEqual([{ index: 0, config: { state: 'q0', tape: 'B', head: 0, origin: 0 }, via: null }]);
    expect(r.stop).toBe('HALTED');
    expect(r.output).toBe('');
    expect(idText(formatConfig(m, r.steps[0]!.config))).toBe('q0B');
  });
});

describe('simulate: aceitação', () => {
  it('FINAL_STATE aceita ASSIM QUE entra num final (mesmo com regras saindo dele)', () => {
    // o YAAS continuaria rodando e entraria em laço: q0 ↔ q1 (ver oráculo)
    const loop = tm('q0', ['q1'], ['q0 00R q0', 'q0 11L q1', 'q1 00R q1', 'q1 11L q0'], { sigma: '01' });
    const r = simulate(loop, '01');
    expect(r.accepted).toBe(true);
    expect(r.stop).toBe('ACCEPTED_FINAL');
    expect(ids(loop, r)).toEqual(['q001', '0q01', 'q101']);
  });

  it('inicial final: aceita com zero passos', () => {
    const m = tm('q0', ['q0'], ['q0 00R q0']);
    const r = simulate(m, '000');
    expect(r.accepted).toBe(true);
    expect(r.stop).toBe('ACCEPTED_FINAL');
    expect(r.steps).toHaveLength(1);
    expect(r.output).toBe('000');
  });

  it('HALT: aceita quando para, em qualquer estado; a saída é a fita (monus: 4 ∸ 2 = 2)', () => {
    const m = monus();
    const r = simulate(m, '0000100');
    expect(r.accepted).toBe(true);
    expect(r.acceptance).toBe('HALT');
    expect(r.stop).toBe('HALTED');
    expect(r.output).toBe('00');
    expect(simulate(m, '0010000').output).toBe('');
    expect(simulate(m, '0001').output).toBe('000');
    // fora do formato 0^m 1 0^n a MT também para: q1 não tem regra para o B
    expect(simulate(m, '000').output).toBe('00');
  });

  it('HALT ignora os finais: não para ao entrar num final', () => {
    const m = tm('q0', ['q1'], ['q0 0XR q1', 'q1 0XR q1'], { acceptance: 'HALT' });
    const r = simulate(m, '000');
    expect(r.stop).toBe('HALTED');
    expect(r.output).toBe('XXX');
    expect(r.steps).toHaveLength(4);
  });
});

describe('simulate: fita infinita para os dois lados', () => {
  it('anda para a esquerda além do começo da entrada: a origem fica negativa', () => {
    const m = tm('q0', ['q3'], ['q0 0XL q1', 'q1 BYL q2', 'q2 BZR q3']);
    const r = simulate(m, '0');
    expect(r.steps.map((s) => s.config)).toEqual([
      { state: 'q0', tape: '0', head: 0, origin: 0 },
      { state: 'q1', tape: 'BX', head: 0, origin: -1 },
      { state: 'q2', tape: 'BYX', head: 0, origin: -2 },
      { state: 'q3', tape: 'ZYX', head: 1, origin: -2 },
    ]);
    expect(ids(m, r)).toEqual(['q00', 'q1BX', 'q2BYX', 'Zq3YX']);
    expect(r.output).toBe('ZYX');
  });

  it('branco escrito no meio da palavra continua na fita; as pontas brancas saem do trecho', () => {
    const m = tm('q0', [], ['q0 0BR q1', 'q1 1BR q2', 'q2 0BR q3'], { acceptance: 'HALT' });
    const r = simulate(m, '0101');
    expect(r.steps.map((s) => s.config.tape)).toEqual(['0101', '101', '01', '1']);
    expect(r.steps.map((s) => s.config.origin)).toEqual([0, 1, 2, 3]);
    const middle = tm('q0', [], ['q0 00R q1', 'q1 1BR q2'], { acceptance: 'HALT' });
    const s = simulate(middle, '010');
    expect(s.steps.at(-1)!.config).toEqual({ state: 'q2', tape: '0B0', head: 2, origin: 0 });
    expect(s.output).toBe('0B0');
  });

  it('palavra com o branco no meio: BLANK_IN_INPUT, só o passo 0', () => {
    const m = hopcroft82();
    const r = simulate(m, '0B1');
    expect(r.accepted).toBe(false);
    expect(r.stop).toBe('BLANK_IN_INPUT');
    expect(r.stoppedAt).toBe(1);
    expect(r.steps).toEqual([{ index: 0, config: { state: 'q0', tape: '0B1', head: 0, origin: 0 }, via: null }]);
    expect(r.output).toBeUndefined();
    expect(simulate(m, 'B').steps[0]!.config).toEqual({ state: 'q0', tape: 'B', head: 0, origin: 0 });
  });

  it('Σ informado: símbolo fora de Σ para antes de rodar; sem Σ, a MT roda e para onde não houver regra', () => {
    const m = hopcroft82();
    const r = simulate(m, '0X1');
    expect(r.stop).toBe('SYMBOL_NOT_IN_ALPHABET');
    expect(r.stoppedAt).toBe(1);
    expect(r.steps).toHaveLength(1);
    const guessed = { ...m, inputAlphabet: [] };
    expect(simulate(guessed, '0X1').stop).toBe('HALTED');
    expect(simulate(guessed, 'Y').stop).toBe('ACCEPTED_FINAL');
    // o 1º problema da esquerda para a direita vence
    expect(simulate(m, 'xB').stop).toBe('SYMBOL_NOT_IN_ALPHABET');
    expect(simulate(m, 'Bx').stop).toBe('BLANK_IN_INPUT');
  });
});

describe('simulate: laço e limite de passos', () => {
  it('configuração repetida → LOOP, com loopStart na 1ª vez que ela apareceu', () => {
    const m = tm('q0', ['q9'], ['q0 00R q1', 'q1 BBL q0'], { states: ['q0', 'q1', 'q9'] });
    const r = simulate(m, '0');
    expect(r.accepted).toBe(false);
    expect(r.stop).toBe('LOOP');
    expect(r.loopStart).toBe(0);
    expect(r.steps).toHaveLength(3);
    expect(r.steps[2]!.config).toEqual(r.steps[0]!.config);
    expect(r.output).toBeUndefined();
  });

  it('a mesma fita em outra posição não é laço: anda para a direita para sempre → STEP_LIMIT', () => {
    const m = tm('q0', [], ['q0 BBR q0'], { acceptance: 'HALT' });
    const r = simulate(m, '', { maxSteps: 50 });
    expect(r.stop).toBe('STEP_LIMIT');
    expect(r.accepted).toBe(false);
    expect(r.steps).toHaveLength(51);
    expect(r.steps.at(-1)!.config).toEqual({ state: 'q0', tape: 'B', head: 0, origin: 50 });
  });

  it('STEP_LIMIT com maxSteps pequeno: os passos vão até o limite', () => {
    const m = hopcroft82();
    const r = simulate(m, '0011', { maxSteps: 5 });
    expect(r.stop).toBe('STEP_LIMIT');
    expect(r.accepted).toBe(false);
    expect(r.steps).toHaveLength(6);
    expect(r.output).toBeUndefined();
    const zero = simulate(m, '0011', { maxSteps: 0 });
    expect(zero.stop).toBe('STEP_LIMIT');
    expect(zero.steps).toHaveLength(1);
    // exatamente os 13 passos de que precisa: aceita
    expect(simulate(m, '0011', { maxSteps: 13 }).stop).toBe('ACCEPTED_FINAL');
    expect(simulate(m, '0011', { maxSteps: 12 }).stop).toBe('STEP_LIMIT');
    // limite inválido: usa o padrão
    expect(simulate(m, '0011', { maxSteps: NaN }).stop).toBe('ACCEPTED_FINAL');
    expect(simulate(m, '0011', { maxSteps: -3 }).stop).toBe('STEP_LIMIT');
  });

  it('bug do YAAS (limite fixo de 4000): 0⁴⁵1⁴⁵ precisa de 4141 passos e é aceita com o limite padrão', () => {
    expect(TM_DEFAULT_MAX_STEPS).toBe(10000);
    const m = hopcroft82();
    const w = '0'.repeat(45) + '1'.repeat(45);
    const r = simulate(m, w);
    expect(r.accepted).toBe(true);
    expect(r.stop).toBe('ACCEPTED_FINAL');
    // 2n² + 2n + 1 passos (n = 2: os 13 do livro)
    expect(r.steps.length - 1).toBe(2 * 45 * 45 + 2 * 45 + 1);
    expect(r.steps.length - 1).toBeGreaterThan(4000);
    // com um limite menor: STEP_LIMIT (ainda não se sabe), e não LOOP
    const short = simulate(m, w, { maxSteps: 1000 });
    expect(short.stop).toBe('STEP_LIMIT');
    expect(short.accepted).toBe(false);
    expect(short.loopStart).toBeUndefined();
  });

  it('limite padrão: 0⁷⁰1⁷⁰ (9941 passos) cabe; 0⁷¹1⁷¹ (10225) não', () => {
    const m = hopcroft82();
    const n70 = simulate(m, '0'.repeat(70) + '1'.repeat(70));
    expect(n70.stop).toBe('ACCEPTED_FINAL');
    expect(n70.steps).toHaveLength(9942);
    const n71 = simulate(m, '0'.repeat(71) + '1'.repeat(71));
    expect(n71.stop).toBe('STEP_LIMIT');
    expect(n71.steps).toHaveLength(TM_DEFAULT_MAX_STEPS + 1);
    expect(simulate(m, '0'.repeat(71) + '1'.repeat(71), { maxSteps: 10225 }).accepted).toBe(true);
  });

  it('bug do YAAS (duas operações seguidas): aqui cada passo aplica uma regra só', () => {
    // q0 → q1 tem duas regras. Lendo 01, o YAAS aplica 0/0 → e, sem parar,
    // 1/1 → (que é de q0!) já em q1; depois para em q1 lendo B e rejeita.
    const m = tm('q0', ['q2'], ['q0 00R|11R q1', 'q1 11R q2'], { sigma: '01' });
    const r = simulate(m, '01');
    expect(r.accepted).toBe(true);
    expect(ids(m, r)).toEqual(['q001', '0q11', '01q2B']);
    expect(r.steps.map((s) => s.via)).toEqual([
      null,
      { transition: 't0', rule: 0 },
      { transition: 't1', rule: 0 },
    ]);
  });

  it('salvaguarda de memória: a soma das fitas guardadas não passa de MAX_TAPE_SYMBOLS', () => {
    // escreve 1 para a direita para sempre: a fita cresce uma célula por passo
    const m = tm('q0', [], ['q0 B1R q0'], { acceptance: 'HALT' });
    const r = simulate(m, '', { maxSteps: Infinity });
    expect(r.stop).toBe('STEP_LIMIT');
    const total = r.steps.reduce((sum, s) => sum + s.config.tape.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TAPE_SYMBOLS + r.steps.at(-1)!.config.tape.length);
    expect(r.steps.length).toBeGreaterThan(TM_DEFAULT_MAX_STEPS);
  }, 30000);
});

describe('simulate: MT não determinística (árvore de IDs)', () => {
  // a NTM do YAAS: aceita as palavras que contêm 00 ("adivinha" onde começa o 00)
  const ntm = tm('q0', ['q2'], ['q0 00R|11R q0', 'q0 00R q1', 'q1 00R q2'], { sigma: '01' });

  it('aceita só por um ramo; steps = o caminho até a ID que aceitou', () => {
    const r = simulate(ntm, '100');
    expect(r.accepted).toBe(true);
    expect(r.stop).toBe('ACCEPTED_FINAL');
    expect(ids(ntm, r)).toEqual(['q0100', '1q000', '10q10', '100q2B']);
    expect(r.steps.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    expect(r.output).toBe('100');
    const tree = r.tree!;
    expect(tree.map((n) => [idText(formatConfig(ntm, n.config)), n.status])).toEqual([
      ['q0100', 'EXPANDED'],
      ['1q000', 'EXPANDED'],
      ['10q00', 'EXPANDED'],
      ['10q10', 'EXPANDED'],
      // a busca para na 1ª ID que aceita: o resto da fila não é expandido
      ['100q0B', 'UNEXPLORED'],
      ['100q1B', 'UNEXPLORED'],
      ['100q2B', 'ACCEPTING'],
    ]);
    expect(r.steps.map((s) => s.config)).toEqual([0, 1, 3, 6].map((i) => tree[i]!.config));
  });

  it('todos os ramos param sem aceitar → HALTED; steps vai até a ID mais funda', () => {
    const r = simulate(ntm, '101');
    expect(r.accepted).toBe(false);
    expect(r.stop).toBe('HALTED');
    expect(ids(ntm, r)).toEqual(['q0101', '1q001', '10q01', '101q0B']);
    expect(r.output).toBe('101');
  });

  it('algum ramo entra em ciclo e nenhum aceita → LOOP', () => {
    const m = tm('q0', ['q9'], ['q0 00R q1', 'q0 00R q2', 'q1 BBL q0'], { states: ['q0', 'q1', 'q2', 'q9'] });
    const r = simulate(m, '0');
    expect(r.stop).toBe('LOOP');
    expect(r.accepted).toBe(false);
    expect(r.tree!.map((n) => n.status)).toEqual(['EXPANDED', 'EXPANDED', 'DEAD', 'REPEATED']);
    expect(r.loopStart).toBeUndefined();
  });

  it('ramos que se encontram (sem ciclo) não são laço: HALTED', () => {
    const m = tm('q0', [], ['q0 0XR q1', 'q0 0XR q2', 'q1 BBL q3', 'q2 BBL q3'], { sigma: '0' });
    const r = simulate(m, '0');
    expect(r.tree!.map((n) => n.status)).toEqual(['EXPANDED', 'EXPANDED', 'EXPANDED', 'DEAD', 'REPEATED']);
    expect(r.stop).toBe('HALTED');
  });

  it('ciclo formado por dois ramos que apontam um para o outro também é laço', () => {
    // q1 → q2 → q1 sem passar de novo pela mesma ID de um ancestral do ramo
    const m = tm('q0', ['q9'], ['q0 0XR q1', 'q0 0XR q3', 'q1 BBL q2', 'q3 BBL q2', 'q2 XXR q1'], {
      states: ['q0', 'q1', 'q2', 'q3', 'q9'],
    });
    expect(simulate(m, '0').stop).toBe('LOOP');
  });

  it('HALT: aceita quando algum ramo para; a saída é a fita desse ramo', () => {
    const m = tm('q0', [], ['q0 0XR q1', 'q0 0YR q2', 'q1 BBL q0', 'q0 XXR q1'], { acceptance: 'HALT', sigma: '0' });
    const r = simulate(m, '0');
    expect(r.accepted).toBe(true);
    expect(r.stop).toBe('HALTED');
    expect(r.output).toBe('Y');
  });

  it('limite de nós → STEP_LIMIT', () => {
    const m = tm('q0', [], ['q0 BBR q0', 'q0 BXR q0'], { sigma: '0' });
    const r = simulate(m, '', { maxNodes: 40 });
    expect(r.stop).toBe('STEP_LIMIT');
    expect(r.tree!.length).toBeLessThanOrEqual(40);
    expect(r.tree!.at(-1)!.status).toBe('UNEXPLORED');
    expect(simulate(m, '').tree!.length).toBeLessThanOrEqual(TM_DEFAULT_MAX_NODES);
  });

  it('a árvore vem sempre numa NTM: [] sem inicial, só a raiz quando a palavra é recusada', () => {
    const noInitial = tm(null, [], ['q0 00R q1', 'q0 00R q2']);
    expect(simulate(noInitial, '0')).toEqual({
      accepted: false,
      acceptance: 'FINAL_STATE',
      stop: 'NO_INITIAL_STATE',
      steps: [],
      tree: [],
    });
    const r = simulate(ntm, '0B');
    expect(r.stop).toBe('BLANK_IN_INPUT');
    expect(r.tree!.map((n) => n.status)).toEqual(['UNEXPLORED']);
  });
});

describe('simulate: casos de borda', () => {
  it('sem estado inicial (DTM): steps vazio e sem árvore', () => {
    expect(simulate(tm(null, [], ['q0 00R q1']), '0')).toEqual({
      accepted: false,
      acceptance: 'FINAL_STATE',
      stop: 'NO_INITIAL_STATE',
      steps: [],
    });
    expect(simulate({ states: [], transitions: [], blank: 'B', acceptance: 'HALT', inputAlphabet: [] }, '').stop).toBe(
      'NO_INITIAL_STATE',
    );
  });

  it('mais de um inicial: a simulação usa o primeiro (ordem de states)', () => {
    const m = tm('q1', ['q2'], ['q0 aaR q2', 'q1 bbR q2'], { states: ['q0', 'q1', 'q2'] });
    m.states[0]!.initial = true;
    expect(accepts(m, 'a')).toBe(true);
    expect(accepts(m, 'b')).toBe(false);
  });

  it('regras inválidas e transições penduradas são ignoradas; a via guarda o índice original', () => {
    const m = tm('q0', ['q1'], ['q0 bbR q1']);
    m.transitions[0]!.rules.unshift({ read: 'a', write: 'a', move: 'S' as never });
    m.transitions.push({ id: 'x', from: 'q0', to: 'nada', rules: [{ read: 'c', write: 'c', move: 'R' }] });
    expect(accepts(m, 'a')).toBe(false);
    expect(accepts(m, 'c')).toBe(false);
    expect(simulate(m, 'b').steps[1]!.via).toEqual({ transition: 't0', rule: 1 });
  });

  it('branco inválido: a simulação usa o B padrão', () => {
    const m = { ...hopcroft82(), blank: '' };
    expect(accepts(m, '0011')).toBe(true);
    expect(simulate(m, '').steps[0]!.config.tape).toBe('B');
  });

  it('accepts é o mesmo que simulate(...).accepted', () => {
    const m = hopcroft82();
    for (const w of ['', '01', '0011', '0101', '000111', '0001111']) {
      expect(accepts(m, w), w).toBe(simulate(m, w).accepted);
    }
    expect(accepts(m, '0011', { maxSteps: 3 })).toBe(false);
  });
});
