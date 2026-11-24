/**
 * Testes de revisão da versão 0.2 — núcleo de AP.
 *
 *  - `it(...)`: propriedades que o revisor conferiu e que PASSAM (rede de
 *    segurança com APs aleatórios: nomes ≠ ids, 0/1/2 iniciais, pares
 *    (from, to) repetidos, Γ com até 3 símbolos).
 *  - `it.fails(...)`: demonstram um problema encontrado na revisão.
 *    Quando o problema for corrigido, o teste passa a "falhar" (it.fails) e
 *    deve virar `it` normal.
 *
 * A referência ingênua aqui NÃO usa nada do núcleo: busca em profundidade
 * sobre (estado, posição na palavra, pilha), com a pilha limitada a H
 * símbolos. Se precisou cortar algum ramo por causa de H, a resposta
 * "rejeita" vira "não sei" (só "aceita" continua valendo).
 */
import { EPSILON } from './types';
import type { PDA, PDAAcceptance, PDARule, PDAState, PDATransition } from './types';
import { classify, simulate, toEmptyStack, toFinalState } from './index';
import { PDA_EXAMPLES } from './examples';

/* ------------------------------------------------------------------ */
/* Referência ingênua                                                  */
/* ------------------------------------------------------------------ */

type Naive = 'ACC' | 'REJ' | 'UNK';

const isChar = (s: string) => typeof s === 'string' && Array.from(s).length === 1;
const validRule = (r: PDARule) =>
  (r.read === EPSILON || isChar(r.read)) && isChar(r.pop) && r.pop !== EPSILON && !r.push.includes(EPSILON);

function naive(pda: PDA, word: string, mode: PDAAcceptance, H = 9, cap = 40_000): Naive {
  const ids = new Set(pda.states.map((s) => s.id));
  const q0 = pda.states.find((s) => s.initial)?.id;
  if (q0 === undefined) return 'REJ';
  const finals = new Set(pda.states.filter((s) => s.final).map((s) => s.id));
  const rules: Array<{ from: string; to: string; r: PDARule }> = [];
  for (const t of pda.transitions) {
    if (!ids.has(t.from) || !ids.has(t.to)) continue;
    for (const r of t.rules) if (validRule(r)) rules.push({ from: t.from, to: t.to, r });
  }
  const w = Array.from(word);
  const seen = new Set<string>();
  const todo: Array<[string, number, string]> = [[q0, 0, pda.startStackSymbol]];
  let cut = false;
  while (todo.length > 0) {
    const [q, i, st] = todo.pop()!;
    const key = `${q}|${i}|${st}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > cap) return 'UNK';
    if (i === w.length && (mode === 'EMPTY_STACK' ? st === '' : finals.has(q))) return 'ACC';
    if (st === '') continue;
    for (const { from, to, r } of rules) {
      if (from !== q || r.pop !== st[0]) continue;
      let j = i;
      if (r.read !== EPSILON) {
        if (w[i] !== r.read) continue;
        j = i + 1;
      }
      const next = r.push + st.slice(1);
      if (next.length > H) {
        cut = true;
        continue;
      }
      todo.push([to, j, next]);
    }
  }
  return cut ? 'UNK' : 'REJ';
}

/** Hopcroft 6.4, escrito à parte: no máximo 1 movimento por (q, a, X); se há (q, a∈Σ, X), não há (q, ε, X). */
function naiveIsDPDA(pda: PDA): boolean {
  const ids = new Set(pda.states.map((s) => s.id));
  const moves = new Map<string, Set<string>>();
  for (const t of pda.transitions) {
    if (!ids.has(t.from) || !ids.has(t.to)) continue;
    for (const r of t.rules) {
      if (!validRule(r)) continue;
      const k = `${t.from}|${r.read}|${r.pop}`;
      if (!moves.has(k)) moves.set(k, new Set());
      moves.get(k)!.add(`${t.to}|${r.push}`);
    }
  }
  for (const [k, set] of moves) {
    if (set.size > 1) return false;
    const [q, a, x] = k.split('|');
    if (a !== EPSILON && moves.has(`${q}|${EPSILON}|${x}`)) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* APs aleatórios                                                      */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPDA(seed: number): PDA {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const n = 1 + Math.floor(r() * 4);
  const gamma = ['Z', 'A', 'B'].slice(0, 1 + Math.floor(r() * 3));
  const initialMode = r();
  const states: PDAState[] = Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    name: `q${i}`,
    initial: initialMode < 0.06 ? false : i === 0 || (initialMode > 0.94 && i === n - 1),
    final: r() < 0.35,
  }));
  const transitions: PDATransition[] = [];
  const nRules = 1 + Math.floor(r() * 7);
  for (let k = 0; k < nRules; k++) {
    const from = `s${Math.floor(r() * n)}`;
    const to = `s${Math.floor(r() * n)}`;
    const len = r() < 0.3 ? 0 : r() < 0.6 ? 1 : r() < 0.9 ? 2 : 3;
    const rule: PDARule = {
      read: r() < 0.35 ? EPSILON : pick(['a', 'b']),
      pop: pick(gamma),
      push: Array.from({ length: len }, () => pick(gamma)).join(''),
    };
    const same = transitions.find((t) => t.from === from && t.to === to);
    if (same && r() < 0.85) same.rules.push(rule);
    else transitions.push({ id: `t${transitions.length}`, from, to, rules: [rule] });
  }
  return { states, transitions, startStackSymbol: 'Z', acceptance: r() < 0.5 ? 'FINAL_STATE' : 'EMPTY_STACK' };
}

function words(maxLen: number): string[] {
  const out = [''];
  let layer = [''];
  for (let len = 1; len <= maxLen; len++) {
    layer = layer.flatMap((w) => [`${w}a`, `${w}b`]);
    out.push(...layer);
  }
  return out;
}

const WORDS = words(4);

/** "aceita" do núcleo, ou null se ele parou no limite. */
function core(pda: PDA, w: string): boolean | null {
  const res = simulate(pda, w, { maxNodes: 3000 });
  return res.reason === 'LIMIT_REACHED' ? null : res.accepted;
}

describe('revisor 2: AP contra uma simulação ingênua (200 APs aleatórios)', () => {
  it('simulate bate com a busca ingênua nos dois modos (palavras até 4)', () => {
    let compared = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const mode of ['FINAL_STATE', 'EMPTY_STACK'] as const) {
        const pda = { ...randomPDA(seed), acceptance: mode };
        for (const w of WORDS) {
          const ref = naive(pda, w, mode);
          const got = core(pda, w);
          if (ref === 'UNK' || got === null) continue;
          compared++;
          expect({ seed, mode, w, got }).toEqual({ seed, mode, w, got: ref === 'ACC' });
        }
      }
    }
    expect(compared).toBeGreaterThan(11_000);
  });

  it('Teorema 6.9 (toFinalState) e 6.11 (toEmptyStack) preservam a linguagem', () => {
    let compared = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const base = randomPDA(seed);
      const byEmpty = { ...base, acceptance: 'EMPTY_STACK' as const };
      const byFinal = { ...base, acceptance: 'FINAL_STATE' as const };
      const pf = toFinalState(byEmpty);
      const pn = toEmptyStack(byFinal);
      expect(pf.acceptance).toBe('FINAL_STATE');
      expect(pn.acceptance).toBe('EMPTY_STACK');
      for (const w of WORDS) {
        const n = naive(byEmpty, w, 'EMPTY_STACK');
        const f = naive(pf, w, 'FINAL_STATE', 10);
        if (n !== 'UNK' && f !== 'UNK') {
          compared++;
          expect({ seed, w, thm: '6.9', ok: f }).toEqual({ seed, w, thm: '6.9', ok: n });
        }
        const l = naive(byFinal, w, 'FINAL_STATE');
        const e = naive(pn, w, 'EMPTY_STACK', 10);
        if (l !== 'UNK' && e !== 'UNK') {
          compared++;
          expect({ seed, w, thm: '6.11', ok: e }).toEqual({ seed, w, thm: '6.11', ok: l });
        }
        // e o núcleo simulando o AP convertido também bate
        const gf = core(pf, w);
        if (gf !== null && n !== 'UNK') expect({ seed, w, gf }).toEqual({ seed, w, gf: n === 'ACC' });
        const ge = core(pn, w);
        if (ge !== null && l !== 'UNK') expect({ seed, w, ge }).toEqual({ seed, w, ge: l === 'ACC' });
      }
    }
    expect(compared).toBeGreaterThan(10_000);
  });

  it('classify segue a definição de APD da seção 6.4', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const pda = randomPDA(seed);
      expect({ seed, t: classify(pda) }).toEqual({ seed, t: naiveIsDPDA(pda) ? 'DPDA' : 'PDA' });
    }
  });
});

/* ------------------------------------------------------------------ */
/* Os exemplos fazem o que a descrição diz?                            */
/* ------------------------------------------------------------------ */

function allOver(sigma: string[], maxLen: number): string[] {
  const out = [''];
  let layer = [''];
  for (let len = 1; len <= maxLen; len++) {
    layer = layer.flatMap((w) => sigma.map((c) => w + c));
    out.push(...layer);
  }
  return out;
}

const count = (w: string, c: string) => Array.from(w).filter((x) => x === c).length;
const rev = (w: string) => Array.from(w).reverse().join('');

describe('revisor 2: a linguagem de cada exemplo de AP é a da descrição', () => {
  const lang: Record<string, [string[], number, (w: string) => boolean]> = {
    'ap-palindromo-par': [['0', '1'], 8, (w) => w.length % 2 === 0 && w === rev(w)],
    'ap-palindromo-par-pilha-vazia': [['0', '1'], 8, (w) => w.length % 2 === 0 && w === rev(w)],
    'ap-comeca-com-0': [['0', '1'], 8, (w) => w.startsWith('0')],
    'ap-0n1n': [['0', '1'], 8, (w) => /^(0+)(1+)$/.test(w) && count(w, '0') === count(w, '1')],
    'ap-0n1n-pilha-vazia': [['0', '1'], 8, (w) => /^(0+)(1+)$/.test(w) && count(w, '0') === count(w, '1')],
    'apd-0n1n': [['0', '1'], 8, (w) => /^(0+)(1+)$/.test(w) && count(w, '0') === count(w, '1')],
    'ap-mesmo-numero-de-0-e-1': [['0', '1'], 8, (w) => count(w, '0') === count(w, '1')],
    'ap-mesmo-numero-de-0-e-1-pilha-vazia': [['0', '1'], 8, (w) => count(w, '0') === count(w, '1')],
    'ap-aibjck': [
      ['a', 'b', 'c'],
      6,
      (w) => {
        const m = /^(a*)(b*)(c*)$/.exec(w);
        return !!m && (m[1]!.length === m[2]!.length || m[2]!.length === m[3]!.length);
      },
    ],
    'apd-palindromo-com-marca': [
      ['0', '1', 'c'],
      6,
      (w) => {
        const parts = w.split('c');
        return parts.length === 2 && parts[0] === rev(parts[1]!) && !parts[0]!.includes('c');
      },
    ],
    'apd-diferenca-de-0-e-1': [['0', '1'], 8, () => true],
    'ap-transicao-vazia-com-pilha-vazia': [['0'], 4, (w) => w === ''],
    'ap-ciclo-de-transicoes-vazias': [['0'], 4, (w) => w === ''],
  };

  for (const ex of PDA_EXAMPLES) {
    const spec = lang[ex.id];
    if (!spec) continue;
    it(`${ex.id}`, () => {
      const [sigma, n, inL] = spec;
      for (const w of allOver(sigma, n)) {
        expect({ w, ok: simulate(ex.pda, w).accepted }).toEqual({ w, ok: inL(w) });
      }
    });
  }

  it('ap-0-vale-dois: só aceita palavras com o mesmo número de 0s e 1s (como diz a descrição)', () => {
    const ex = PDA_EXAMPLES.find((e) => e.id === 'ap-0-vale-dois')!;
    for (const w of allOver(['0', '1'], 8)) {
      if (simulate(ex.pda, w).accepted) expect({ w, eq: count(w, '0') === count(w, '1') }).toEqual({ w, eq: true });
    }
  });

  it('os exemplos "apd-*" são APD; os não determinísticos citados são AP', () => {
    for (const ex of PDA_EXAMPLES) {
      if (ex.id.startsWith('apd-')) expect({ id: ex.id, t: classify(ex.pda) }).toEqual({ id: ex.id, t: 'DPDA' });
    }
    expect(classify(PDA_EXAMPLES.find((e) => e.id === 'ap-comeca-com-0')!.pda)).toBe('PDA');
    expect(classify(PDA_EXAMPLES.find((e) => e.id === 'ap-palindromo-par')!.pda)).toBe('PDA');
  });

  it('as samples de todos os exemplos de AP estão certas (simulação padrão)', () => {
    for (const ex of PDA_EXAMPLES) {
      for (const s of ex.samples ?? []) {
        expect({ id: ex.id, w: s.word, ok: simulate(ex.pda, s.word).accepted }).toEqual({
          id: ex.id,
          w: s.word,
          ok: s.accepted,
        });
      }
    }
  });
});
