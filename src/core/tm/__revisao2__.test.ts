/**
 * Testes de revisão da versão 0.2 — núcleo de MT.
 *
 *  - `it(...)`: propriedades que o revisor conferiu e que PASSAM (rede de
 *    segurança com MTs aleatórias: nomes ≠ ids, fita que vai para a esquerda
 *    do começo, branco escrito no meio, Σ informado ou não).
 *  - `it.fails(...)`: demonstram um problema encontrado na revisão.
 *
 * A referência ingênua NÃO usa nada do núcleo: fita = Map<posição, símbolo>.
 */
import type { TM, TMAcceptance, TMRule, TMState, TMTransition } from './types';
import { classify, formatConfig, simulate } from './index';
import { TM_EXAMPLES } from './examples';

/* ------------------------------------------------------------------ */
/* Referência ingênua                                                  */
/* ------------------------------------------------------------------ */

interface NConf {
  q: string;
  head: number;
  tape: Map<number, string>;
}

/** Texto canônico da configuração: estado, cabeça absoluta e as células não brancas. */
function canon(c: NConf, blank: string): string {
  const cells = [...c.tape.entries()].filter(([, s]) => s !== blank).sort((a, b) => a[0] - b[0]);
  return `${c.q}@${c.head}:${cells.map(([p, s]) => `${p}=${s}`).join(',')}`;
}

/** O mesmo texto a partir da TMConfig do núcleo. */
function canonCore(c: { state: string; tape: string; head: number; origin: number }, blank: string): string {
  const tape = new Map<number, string>();
  Array.from(c.tape).forEach((s, i) => tape.set(c.origin + i, s));
  return canon({ q: c.state, head: c.origin + c.head, tape }, blank);
}

function movesOf(tm: TM) {
  const ids = new Set(tm.states.map((s) => s.id));
  const m: Array<{ from: string; to: string; r: TMRule }> = [];
  const seen = new Set<string>();
  for (const t of tm.transitions) {
    if (!ids.has(t.from) || !ids.has(t.to)) continue;
    for (const r of t.rules) {
      const k = `${t.from}|${r.read}|${t.to}|${r.write}|${r.move}`;
      if (seen.has(k)) continue;
      seen.add(k);
      m.push({ from: t.from, to: t.to, r });
    }
  }
  return m;
}

function step(c: NConf, mv: { to: string; r: TMRule }): NConf {
  const tape = new Map(c.tape);
  tape.set(c.head, mv.r.write);
  return { q: mv.to, head: c.head + (mv.r.move === 'R' ? 1 : -1), tape };
}

function output(c: NConf, blank: string): string {
  const cells = [...c.tape.entries()].filter(([, s]) => s !== blank).sort((a, b) => a[0] - b[0]);
  if (cells.length === 0) return '';
  let s = '';
  for (let p = cells[0]![0]; p <= cells[cells.length - 1]![0]; p++) s += c.tape.get(p) ?? blank;
  return s;
}

interface NaiveDTM {
  stop: 'ACCEPTED_FINAL' | 'HALTED' | 'LOOP' | 'STEP_LIMIT';
  accepted: boolean;
  configs: string[];
  output?: string;
  loopStart?: number;
}

function naiveDTM(tm: TM, word: string, maxSteps: number): NaiveDTM {
  const blank = tm.blank;
  const q0 = tm.states.find((s) => s.initial)!.id;
  const finals = new Set(tm.states.filter((s) => s.final).map((s) => s.id));
  const moves = movesOf(tm);
  const tape = new Map<number, string>();
  Array.from(word).forEach((s, i) => tape.set(i, s));
  let c: NConf = { q: q0, head: 0, tape };
  const configs = [canon(c, blank)];
  const first = new Map([[configs[0]!, 0]]);
  if (tm.acceptance === 'FINAL_STATE' && finals.has(c.q))
    return { stop: 'ACCEPTED_FINAL', accepted: true, configs, output: output(c, blank) };
  for (;;) {
    const sym = c.tape.get(c.head) ?? blank;
    const mv = moves.find((m) => m.from === c.q && m.r.read === sym);
    if (!mv) return { stop: 'HALTED', accepted: tm.acceptance === 'HALT', configs, output: output(c, blank) };
    if (configs.length - 1 >= maxSteps) return { stop: 'STEP_LIMIT', accepted: false, configs };
    c = step(c, mv);
    const k = canon(c, blank);
    configs.push(k);
    if (tm.acceptance === 'FINAL_STATE' && finals.has(c.q))
      return { stop: 'ACCEPTED_FINAL', accepted: true, configs, output: output(c, blank) };
    if (first.has(k)) return { stop: 'LOOP', accepted: false, configs, loopStart: first.get(k)! };
    first.set(k, configs.length - 1);
  }
}

/** NTM: grafo inteiro das configurações (até `cap`); aceita? algum ciclo? */
function naiveNTM(tm: TM, word: string, cap = 500): { accepted: boolean; cycle: boolean } | null {
  const blank = tm.blank;
  const q0 = tm.states.find((s) => s.initial)!.id;
  const finals = new Set(tm.states.filter((s) => s.final).map((s) => s.id));
  const moves = movesOf(tm);
  const tape = new Map<number, string>();
  Array.from(word).forEach((s, i) => tape.set(i, s));
  const start: NConf = { q: q0, head: 0, tape };
  const succ = (c: NConf) => moves.filter((m) => m.from === c.q && m.r.read === (c.tape.get(c.head) ?? blank)).map((m) => step(c, m));
  const accepting = (c: NConf) => (tm.acceptance === 'FINAL_STATE' ? finals.has(c.q) : succ(c).length === 0);
  const nodes = new Map<string, NConf>();
  const edges = new Map<string, string[]>();
  const todo = [start];
  nodes.set(canon(start, blank), start);
  let accepted = false;
  for (let head = 0; head < todo.length; head++) {
    const c = todo[head]!;
    const k = canon(c, blank);
    if (accepting(c)) {
      accepted = true;
      edges.set(k, []);
      continue;
    }
    const next = succ(c);
    edges.set(k, next.map((n) => canon(n, blank)));
    for (const n of next) {
      const nk = canon(n, blank);
      if (!nodes.has(nk)) {
        nodes.set(nk, n);
        todo.push(n);
        if (nodes.size > cap) return null;
      }
    }
  }
  // ciclo no grafo (DFS com cores)
  const color = new Map<string, number>();
  let cycle = false;
  const visit = (k: string) => {
    color.set(k, 1);
    for (const n of edges.get(k) ?? []) {
      if (color.get(n) === 1) cycle = true;
      else if (!color.has(n)) visit(n);
    }
    color.set(k, 2);
  };
  for (const k of nodes.keys()) if (!color.has(k)) visit(k);
  return { accepted, cycle };
}

/* ------------------------------------------------------------------ */
/* MTs aleatórias                                                      */
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

function randomTM(seed: number, deterministic: boolean): TM {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const n = 1 + Math.floor(r() * 4);
  const gamma = ['a', 'b', 'X', 'B'];
  const states: TMState[] = Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    name: `q${i}`,
    initial: i === 0,
    final: i > 0 && r() < 0.3,
  }));
  const transitions: TMTransition[] = [];
  const used = new Set<string>();
  const nRules = 1 + Math.floor(r() * 8);
  for (let k = 0; k < nRules; k++) {
    const from = `s${Math.floor(r() * n)}`;
    const to = `s${Math.floor(r() * n)}`;
    const rule: TMRule = { read: pick(gamma), write: pick(gamma), move: r() < 0.5 ? 'L' : 'R' };
    if (deterministic) {
      if (used.has(`${from}|${rule.read}`)) continue;
      used.add(`${from}|${rule.read}`);
    }
    const same = transitions.find((t) => t.from === from && t.to === to);
    if (same) same.rules.push(rule);
    else transitions.push({ id: `t${transitions.length}`, from, to, rules: [rule] });
  }
  const acceptance: TMAcceptance = r() < 0.5 ? 'FINAL_STATE' : 'HALT';
  return { states, transitions, blank: 'B', acceptance, inputAlphabet: r() < 0.5 ? ['a', 'b'] : [] };
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

describe('revisor 2: MT contra uma simulação ingênua', () => {
  it('DTM (300 aleatórias, palavras até 3): mesmas IDs, parada, laço, saída e loopStart', () => {
    let runs = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const tm = randomTM(seed, true);
      expect(classify(tm)).not.toBe('NTM');
      for (const w of words(3)) {
        const got = simulate(tm, w, { maxSteps: 60 });
        const ref = naiveDTM(tm, w, 60);
        runs++;
        expect({ seed, w, stop: got.stop, accepted: got.accepted }).toEqual({
          seed,
          w,
          stop: ref.stop,
          accepted: ref.accepted,
        });
        expect(got.steps.map((s) => canonCore(s.config, tm.blank))).toEqual(ref.configs);
        expect(got.steps.map((s) => s.index)).toEqual(ref.configs.map((_, i) => i));
        expect(got.output).toBe(ref.output);
        expect(got.loopStart).toBe(ref.loopStart);
      }
    }
    expect(runs).toBe(300 * 15);
  });

  it('NTM (200 aleatórias, palavras até 2): aceita = algum ramo aceita; LOOP = há ciclo; HALTED = todos param', { timeout: 30_000 }, () => {
    let compared = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const tm = randomTM(seed + 10_000, false);
      if (classify(tm) !== 'NTM') continue;
      for (const w of words(2)) {
        // só quando o grafo das configurações é pequeno (a busca ingênua termina)
        const ref = naiveNTM(tm, w);
        if (!ref) continue;
        const got = simulate(tm, w, { maxNodes: 2500 });
        if (got.stop === 'STEP_LIMIT') continue;
        compared++;
        expect({ seed, w, accepted: got.accepted }).toEqual({ seed, w, accepted: ref.accepted });
        if (!got.accepted) {
          expect({ seed, w, stop: got.stop }).toEqual({ seed, w, stop: ref.cycle ? 'LOOP' : 'HALTED' });
        }
      }
    }
    expect(compared).toBeGreaterThan(200);
  });
});

/* ------------------------------------------------------------------ */
/* Exemplos                                                            */
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
const ex = (id: string) => TM_EXAMPLES.find((e) => e.id === id)!;
const idText = (tm: TM, c: Parameters<typeof formatConfig>[1]) => {
  const t = formatConfig(tm, c);
  return `${t.left}${t.state}${t.right}`;
};

describe('revisor 2: exemplos de MT', () => {
  it('Exemplo 8.2 com 0011: exatamente as IDs do livro', () => {
    const m = ex('mt-0n1n').tm;
    const r = simulate(m, '0011');
    expect(r.steps.map((s) => idText(m, s.config)).join(' ⊢ ')).toBe(
      'q00011 ⊢ Xq1011 ⊢ X0q111 ⊢ Xq20Y1 ⊢ q2X0Y1 ⊢ Xq00Y1 ⊢ XXq1Y1 ⊢ XXYq11 ⊢ XXq2YY ⊢ Xq2XYY ⊢ XXq0YY ⊢ XXYq3Y ⊢ XXYYq3B ⊢ XXYYBq4B',
    );
  });

  it('as linguagens das descrições batem (palavras até 8, ou 6 com Σ de 3 símbolos)', () => {
    const lang: Record<string, [string[], number, (w: string) => boolean]> = {
      'mt-0n1n': [['0', '1'], 8, (w) => /^0+1+$/.test(w) && count(w, '0') === count(w, '1')],
      'mt-laco-infinito': [['0', '1'], 8, (w) => w.includes('1')],
      'mt-mesmo-numero-de-0-e-1': [['0', '1'], 8, (w) => count(w, '0') === count(w, '1')],
      'mt-anbncn': [['a', 'b', 'c'], 6, (w) => /^a+b+c+$/.test(w) && count(w, 'a') === count(w, 'b') && count(w, 'b') === count(w, 'c')],
      'mt-nao-deterministica': [['0', '1'], 8, (w) => w.includes('00')],
      'mt-sim-ou-nao': [['0', '1'], 8, () => true],
    };
    for (const [id, [sigma, n, inL]] of Object.entries(lang)) {
      for (const w of allOver(sigma, n)) {
        expect({ id, w, ok: simulate(ex(id).tm, w).accepted }).toEqual({ id, w, ok: inL(w) });
      }
    }
  });

  it('mt-sim-ou-nao para em qs só quando a palavra termina em 00', () => {
    const m = ex('mt-sim-ou-nao').tm;
    for (const w of allOver(['0', '1'], 7)) {
      const r = simulate(m, w);
      const last = m.states.find((s) => s.id === r.steps.at(-1)!.config.state)!.name;
      expect({ w, last }).toEqual({ w, last: w.endsWith('00') ? 'qs' : 'qn' });
    }
  });

  it('monus: 0ᵐ10ⁿ → 0^(m ∸ n), para m, n ≤ 6', () => {
    const m = ex('mt-monus').tm;
    for (let a = 0; a <= 6; a++) {
      for (let b = 0; b <= 6; b++) {
        const r = simulate(m, `${'0'.repeat(a)}1${'0'.repeat(b)}`);
        expect({ a, b, stop: r.stop, out: r.output }).toEqual({ a, b, stop: 'HALTED', out: '0'.repeat(Math.max(a - b, 0)) });
      }
    }
  });

  it('divisão: 0ᵐ10ⁿ1 → 0^⌊m/n⌋ quando m ≥ n ≥ 1 (m, n ≤ 7)', () => {
    const m = ex('mt-divisao').tm;
    for (let a = 1; a <= 7; a++) {
      for (let b = 1; b <= a; b++) {
        const r = simulate(m, `${'0'.repeat(a)}1${'0'.repeat(b)}1`);
        expect({ a, b, stop: r.stop, out: r.output }).toEqual({ a, b, stop: 'HALTED', out: '0'.repeat(Math.floor(a / b)) });
      }
    }
  });

  it('as samples batem com a simulação padrão', () => {
    for (const e of TM_EXAMPLES) {
      for (const s of e.samples ?? []) {
        const r = simulate(e.tm, s.word);
        expect({ id: e.id, w: s.word, ok: r.accepted, out: s.output === undefined ? undefined : r.output }).toEqual({
          id: e.id,
          w: s.word,
          ok: s.accepted,
          out: s.output,
        });
      }
    }
  });
});

describe('revisor 2: problemas nos exemplos de MT', () => {
  it('toda sample dos exemplos de MT é decidida pela simulação padrão (a 0010001 da divisão saiu)', () => {
    for (const e of TM_EXAMPLES) {
      for (const s of e.samples ?? []) expect({ id: e.id, w: s.word, stop: simulate(e.tm, s.word).stop }).not.toMatchObject({ stop: 'STEP_LIMIT' });
    }
    // 2 ÷ 3: o quociente é 0, a MT apaga tudo e anda para a direita sobre brancos para sempre.
    // Nenhuma configuração se repete (a cabeça anda), então nunca vira LOOP: dá STEP_LIMIT (INDEFINIDO),
    // como a descrição do exemplo agora explica.
    expect(simulate(ex('mt-divisao').tm, '0010001').stop).toBe('STEP_LIMIT');
    expect(ex('mt-divisao').description).toContain('INDEFINIDO');
  });
});
