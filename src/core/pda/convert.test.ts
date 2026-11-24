import type { PDA } from './types';
import { EPSILON } from './types';
import { accepts, inputAlphabet, simulate, stackAlphabet, toEmptyStack, toFinalState, validate } from './index';
import { PDA_EXAMPLES } from './examples';
import { allWords, hopcroft62, pda, rules } from './test-helpers';

const label = (r: { read: string; pop: string; push: string }) => `${r.read},${r.pop}/${r.push || EPSILON}`;
const shape = (p: PDA) => ({
  states: p.states.map((s) => [s.id, s.name, s.initial ? 'i' : '', s.final ? 'f' : ''].join(' ').trim()),
  transitions: p.transitions.map((t) => `${t.id}: ${t.from}→${t.to} ${t.rules.map(label).join(' ')}`),
  z0: p.startStackSymbol,
  acceptance: p.acceptance,
});

describe('toFinalState (Teorema 6.9: pilha vazia → estado final)', () => {
  it('Exemplo 6.2 por pilha vazia: p0 empilha Z sobre X0 e todo estado vai para pf com ε, X0/ε', () => {
    expect(shape(toFinalState(hopcroft62('EMPTY_STACK')))).toEqual({
      states: ['q0 q0', 'q1 q1', 'q2 q2', 'q3 p0 i', 'q4 pf  f'],
      transitions: [
        't0: q0→q0 0,Z/0Z 1,Z/1Z 0,0/00 0,1/01 1,0/10 1,1/11',
        't1: q0→q1 ε,Z/Z ε,0/0 ε,1/1',
        't2: q1→q1 0,0/ε 1,1/ε',
        't3: q1→q2 ε,Z/ε',
        't4: q3→q0 ε,X/ZX',
        't5: q0→q4 ε,X/ε',
        't6: q1→q4 ε,X/ε',
        't7: q2→q4 ε,X/ε',
      ],
      z0: 'X',
      acceptance: 'FINAL_STATE',
    });
  });

  it('aceita o que o original aceitava por pilha vazia, e só isso', () => {
    const n = hopcroft62('EMPTY_STACK');
    const f = toFinalState(n);
    for (const w of allWords(['0', '1'], 6)) expect(accepts(f, w), w).toBe(accepts(n, w));
  });

  it('os finais antigos deixam de ser finais (senão a linguagem mudaria)', () => {
    // por pilha vazia, o final q1 não conta; se continuasse final em P_F, "a" seria aceita
    const n = pda('q0', ['q1'], ['q0 a,Z/Z q1'], { acceptance: 'EMPTY_STACK' });
    expect(accepts(n, 'a')).toBe(false);
    const f = toFinalState(n);
    expect(f.states.filter((s) => s.final).map((s) => s.name)).toEqual(['pf']);
    expect(accepts(f, 'a')).toBe(false);
  });

  it('já por estado final: devolve uma cópia (objetos novos)', () => {
    const p = hopcroft62();
    const c = toFinalState(p);
    expect(c).toEqual(p);
    expect(c).not.toBe(p);
    expect(c.states[0]).not.toBe(p.states[0]);
    expect(c.transitions[0]!.rules[0]).not.toBe(p.transitions[0]!.rules[0]);
  });
});

describe('toEmptyStack (Teorema 6.11: estado final → pilha vazia)', () => {
  it('Exemplo 6.2: p0 empilha Z sobre X0; o final q2 vai para p, que esvazia tudo (Γ ∪ {X0})', () => {
    expect(shape(toEmptyStack(hopcroft62()))).toEqual({
      states: ['q0 q0', 'q1 q1', 'q2 q2', 'q3 p0 i', 'q4 p'],
      transitions: [
        't0: q0→q0 0,Z/0Z 1,Z/1Z 0,0/00 0,1/01 1,0/10 1,1/11',
        't1: q0→q1 ε,Z/Z ε,0/0 ε,1/1',
        't2: q1→q1 0,0/ε 1,1/ε',
        't3: q1→q2 ε,Z/Z',
        't4: q3→q0 ε,X/ZX',
        't5: q2→q4 ε,0/ε ε,1/ε ε,Z/ε ε,X/ε',
        't6: q4→q4 ε,0/ε ε,1/ε ε,Z/ε ε,X/ε',
      ],
      z0: 'X',
      acceptance: 'EMPTY_STACK',
    });
  });

  it('o X0 impede aceitar quando o original esvazia a pilha fora de um final', () => {
    // por estado final, ε não é aceita (q0 não é final), mas a pilha esvazia em q0
    const f = pda('q0', ['q1'], ['q0 ε,Z/ε q0', 'q0 a,Z/Z q1']);
    expect(accepts(f, '')).toBe(false);
    const n = toEmptyStack(f);
    expect(accepts(n, '')).toBe(false);
    expect(accepts(n, 'a')).toBe(true);
  });

  it('sem estados finais: p fica sem entrada e a linguagem continua vazia', () => {
    const f = pda('q0', [], ['q0 a,Z/Z q0']);
    const n = toEmptyStack(f);
    expect(n.states.map((s) => s.name)).toEqual(['q0', 'p0', 'p']);
    expect(n.transitions.filter((t) => t.to === 'q2' && t.from !== 'q2')).toEqual([]);
    for (const w of ['', 'a', 'aa']) expect(accepts(n, w)).toBe(false);
  });

  it('já por pilha vazia: devolve uma cópia', () => {
    const p = hopcroft62('EMPTY_STACK');
    expect(toEmptyStack(p)).toEqual(p);
    expect(toEmptyStack(p)).not.toBe(p);
  });
});

describe('conversões: convenções de nomes, ids e X0', () => {
  it('X0 é o 1º de X, $, #, ⊥, @ que não está em Γ', () => {
    const base = (gamma: string) =>
      pda('q0', ['q1'], [`q0 a,Z/${gamma}Z q1`]);
    expect(toEmptyStack(base('')).startStackSymbol).toBe('X');
    expect(toEmptyStack(base('X')).startStackSymbol).toBe('$');
    expect(toEmptyStack(base('X$')).startStackSymbol).toBe('#');
    expect(toEmptyStack(base('X$#')).startStackSymbol).toBe('⊥');
    expect(toEmptyStack(base('X$#⊥')).startStackSymbol).toBe('@');
    // todos ocupados: o 1º caractere visível livre (fora de Γ e de Σ)
    expect(toEmptyStack(base('X$#⊥@')).startStackSymbol).toBe('!');
    expect(toEmptyStack(pda('q0', ['q1'], ['q0 !,Z/X$#⊥@Z q1'])).startStackSymbol).toBe('"');
  });

  it('o novo X0 nunca está em Γ do original', () => {
    for (const e of PDA_EXAMPLES) {
      for (const c of [toEmptyStack(e.pda), toFinalState(e.pda)]) {
        if (c.acceptance === e.pda.acceptance) continue;
        expect(stackAlphabet(e.pda)).not.toContain(c.startStackSymbol);
      }
    }
  });

  it('nomes p0, pf e p ganham apóstrofo se já existirem; ids são os 1os qN e tN livres', () => {
    const p = pda('q3', ['pf'], ['q3 a,Z/Z pf', 'pf ε,Z/Z p0'], { acceptance: 'FINAL_STATE' });
    p.states.push({ id: 'q0', name: "p0'", initial: false, final: false });
    p.transitions[0]!.id = 't1';
    p.transitions[1]!.id = 't3';
    const n = toEmptyStack(p);
    expect(n.states.map((s) => `${s.id}:${s.name}`)).toEqual([
      'q3:q3', 'pf:pf', 'p0:p0', "q0:p0'", "q1:p0''", 'q2:p',
    ]);
    expect(n.transitions.map((t) => `${t.id}:${t.from}→${t.to}`)).toEqual([
      't1:q3→pf', 't3:pf→p0', 't0:q1→q3', 't2:pf→q2', 't4:q2→q2',
    ]);
    const f = toFinalState({ ...p, acceptance: 'EMPTY_STACK' });
    expect(f.states.map((s) => s.name)).toEqual(['q3', 'pf', 'p0', "p0'", "p0''", "pf'"]);
  });

  it('mantém ids, nomes e a ordem; originais deixam de ser iniciais e finais', () => {
    for (const e of PDA_EXAMPLES) {
      for (const c of [toEmptyStack(e.pda), toFinalState(e.pda)]) {
        if (c.acceptance === e.pda.acceptance) continue;
        const originals = c.states.slice(0, e.pda.states.length);
        expect(originals.map((s) => [s.id, s.name])).toEqual(e.pda.states.map((s) => [s.id, s.name]));
        expect(originals.some((s) => s.initial || s.final)).toBe(false);
        expect(c.states.filter((s) => s.initial).map((s) => s.name)).toEqual(['p0']);
        expect(c.transitions.slice(0, e.pda.transitions.length)).toEqual(e.pda.transitions);
        expect(validate(c)).toEqual([]);
        const pairs = c.transitions.map((t) => `${t.from}>${t.to}`);
        expect(new Set(pairs).size).toBe(pairs.length);
      }
    }
  });

  it('sem estado inicial: p0 fica sem saída (a linguagem continua vazia)', () => {
    const p = pda(null, ['q1'], ['q0 a,Z/Z q1'], { states: ['q0', 'q1'] });
    const n = toEmptyStack(p);
    const p0 = n.states.find((s) => s.name === 'p0')!;
    expect(p0.initial).toBe(true);
    expect(n.transitions.some((t) => t.from === p0.id)).toBe(false);
    expect(accepts(n, 'a')).toBe(false);
    expect(accepts(toFinalState({ ...p, acceptance: 'EMPTY_STACK' }), 'a')).toBe(false);
  });

  it('autômato sem estados: só os estados novos, e a linguagem continua vazia', () => {
    const empty: PDA = { states: [], transitions: [], startStackSymbol: 'Z', acceptance: 'FINAL_STATE' };
    const n = toEmptyStack(empty);
    expect(n.states.map((s) => `${s.id}:${s.name}`)).toEqual(['q0:p0', 'q1:p']);
    expect(n.transitions.map((t) => `${t.id}:${t.from}→${t.to}`)).toEqual(['t0:q1→q1']);
    expect(accepts(n, '')).toBe(false);
    const f = toFinalState({ ...empty, acceptance: 'EMPTY_STACK' });
    expect(f.states.map((s) => s.name)).toEqual(['p0', 'pf']);
    expect(f.transitions).toEqual([]);
    expect(accepts(f, '')).toBe(false);
  });

  it('mais de um inicial: p0 vai para o primeiro; os outros deixam de ser iniciais', () => {
    const p = pda('q1', ['q2'], ['q0 a,Z/Z q2', 'q1 b,Z/Z q2'], { states: ['q0', 'q1', 'q2'] });
    p.states[0]!.initial = true;
    const n = toEmptyStack(p);
    expect(n.transitions.find((t) => t.from === 'q3')!.to).toBe('q0');
    expect(n.states.filter((s) => s.initial).map((s) => s.name)).toEqual(['p0']);
    expect(accepts(n, 'a')).toBe(true);
    expect(accepts(n, 'b')).toBe(false);
  });

  it('regras inválidas, repetidas e transições penduradas somem; pares repetidos viram uma transição', () => {
    const p = pda('q0', ['q1'], ['q0 a,Z/Z q1', 'q0 b,Z/Z|a,Z/Z q1']);
    p.transitions[0]!.rules.push({ read: 'c', pop: EPSILON, push: '' });
    p.transitions.push({ id: 'x', from: 'q0', to: 'sumiu', rules: rules('d,Z/Z') });
    for (const c of [toEmptyStack(p), toFinalState(p)]) {
      expect(validate(c)).toEqual([]);
      expect(c.transitions[0]).toEqual({ id: 't0', from: 'q0', to: 'q1', rules: rules('a,Z/Z b,Z/Z') });
      expect(c.transitions.some((t) => t.id === 't1' || t.id === 'x')).toBe(false);
      expect(inputAlphabet(c)).toEqual(['a', 'b']);
    }
  });
});

describe('conversões preservam a linguagem de todos os exemplos (tamanho 0 a 6)', () => {
  it.each(PDA_EXAMPLES.map((e) => [e.id, e.pda] as const))('%s', (_id, p) => {
    const sigma = inputAlphabet(p);
    const words = allWords(sigma, 6);
    const expected = words.filter((w) => accepts(p, w));
    const n = toEmptyStack(p);
    const f = toFinalState(p);
    expect(n.acceptance).toBe('EMPTY_STACK');
    expect(f.acceptance).toBe('FINAL_STATE');
    for (const c of [n, f, toFinalState(n), toEmptyStack(f)]) {
      const ours = words.filter((w) => {
        const r = simulate(c, w);
        expect(r.limitReached, w).toBe(false);
        return r.accepted;
      });
      expect(ours).toEqual(expected);
    }
  });
});
