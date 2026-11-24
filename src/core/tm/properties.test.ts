/**
 * Propriedades em MTs ALEATÓRIAS (semente fixa) e pureza das funções.
 * A referência `refRun` é escrita de outro jeito (fita num Map, regras
 * procuradas direto na lista de transições, busca no conjunto de
 * configurações), para não esconder um erro igual dos dois lados.
 */
import type { TM, TMAcceptance, TMConfig, TMSimulationResult } from './types';
import { classify, formalDefinition, formatConfig, inputAlphabet, simulate, tapeAlphabet, validate } from './index';
import { TM_EXAMPLES } from './examples';
import { allWords } from './test-helpers';

const SYMBOLS = ['0', '1', 'X', 'B'];
const WORDS = allWords(['0', '1'], 4);
/** Limites menores que os padrões: algumas MTs aleatórias escrevem para sempre. */
const OPTS = { maxSteps: 500, maxNodes: 800 };

/** Configuração da referência: estado, cabeça e as células não brancas. */
interface RefConfig {
  state: string;
  head: number;
  tape: Map<number, string>;
}

function refKey(c: RefConfig): string {
  return JSON.stringify([c.state, c.head, [...c.tape.entries()].sort((a, b) => a[0] - b[0])]);
}

function refNext(m: TM, c: RefConfig): RefConfig[] {
  const symbol = c.tape.get(c.head) ?? m.blank;
  const result: RefConfig[] = [];
  const seen = new Set<string>();
  for (const t of m.transitions) {
    if (t.from !== c.state) continue;
    for (const r of t.rules) {
      if (r.read !== symbol) continue;
      const key = JSON.stringify([t.to, r.write, r.move]);
      if (seen.has(key)) continue;
      seen.add(key);
      const tape = new Map(c.tape);
      if (r.write === m.blank) tape.delete(c.head);
      else tape.set(c.head, r.write);
      result.push({ state: t.to, head: c.head + (r.move === 'R' ? 1 : -1), tape });
    }
  }
  return result;
}

function refOutput(m: TM, c: RefConfig): string {
  const cells = [...c.tape.keys()];
  if (cells.length === 0) return '';
  let text = '';
  for (let p = Math.min(...cells); p <= Math.max(...cells); p++) text += c.tape.get(p) ?? m.blank;
  return text;
}

/**
 * Referência: busca em largura no conjunto de configurações (serve para DTM e
 * NTM). undefined = não deu para decidir dentro do teto de configurações.
 */
function refRun(m: TM, word: string): { accepted: boolean; output?: string; loops: boolean } | undefined {
  const initial = m.states.find((s) => s.initial)!;
  const finals = new Set(m.states.filter((s) => s.final).map((s) => s.id));
  const tape = new Map<number, string>();
  Array.from(word).forEach((c, i) => tape.set(i, c));
  const start: RefConfig = { state: initial.id, head: 0, tape };
  const seen = new Set([refKey(start)]);
  const queue = [start];
  let loops = false;
  while (queue.length > 0) {
    const c = queue.shift()!;
    const next = refNext(m, c);
    if (m.acceptance === 'FINAL_STATE' ? finals.has(c.state) : next.length === 0) {
      return { accepted: true, output: refOutput(m, c), loops };
    }
    for (const n of next) {
      const key = refKey(n);
      if (seen.has(key)) {
        loops = true;
        continue;
      }
      seen.add(key);
      if (seen.size > 4000) return undefined;
      queue.push(n);
    }
  }
  return { accepted: false, loops };
}

/** Gerador pseudoaleatório com semente (mulberry32). */
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

function randomTM(random: () => number): TM {
  const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)]!;
  const n = 1 + Math.floor(random() * 4);
  const states = Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    name: `s${i}`,
    initial: i === 0,
    final: i > 0 && random() < 0.3,
  }));
  const transitions: TM['transitions'] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (random() > 0.5) continue;
      const rules = Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({
        read: pick(SYMBOLS),
        write: pick(SYMBOLS),
        move: pick(['L', 'R'] as const),
      }));
      transitions.push({ id: `t${transitions.length}`, from: `s${i}`, to: `s${j}`, rules });
    }
  }
  const acceptance: TMAcceptance = random() < 0.5 ? 'FINAL_STATE' : 'HALT';
  return { states, transitions, blank: 'B', acceptance, inputAlphabet: ['0', '1'] };
}

/** Problemas de uma configuração: trecho mínimo, cabeça dentro do trecho, nunca vazio. */
function configProblems(m: TM, c: TMConfig): string[] {
  const cells = Array.from(c.tape);
  const problems: string[] = [];
  if (cells.length === 0) problems.push('fita vazia');
  if (c.head < 0 || c.head >= cells.length) problems.push('cabeça fora do trecho');
  if (cells[0] === m.blank && c.head !== 0) problems.push('branco sobrando à esquerda');
  if (cells.at(-1) === m.blank && c.head !== cells.length - 1) problems.push('branco sobrando à direita');
  const t = formatConfig(m, c);
  if (Array.from(t.right)[0] !== cells[c.head]) problems.push('a parte da direita não começa na cabeça');
  return problems;
}

/** Passos da DTM: cada um sai do anterior pela regra `via` (uma regra por passo). */
function dtmProblems(m: TM, r: TMSimulationResult): string[] {
  const problems: string[] = [];
  r.steps.forEach((step, i) => {
    problems.push(...configProblems(m, step.config).map((p) => `passo ${i}: ${p}`));
    if (step.index !== i) problems.push(`passo ${i}: índice`);
    if (i === 0) return;
    const prev = r.steps[i - 1]!.config;
    const t = m.transitions.find((x) => x.id === step.via!.transition)!;
    const rule = t.rules[step.via!.rule]!;
    const at = (c: TMConfig, abs: number) => Array.from(c.tape)[abs - c.origin] ?? m.blank;
    const headBefore = prev.origin + prev.head;
    const headAfter = step.config.origin + step.config.head;
    if (t.from !== prev.state || t.to !== step.config.state) problems.push(`passo ${i}: estados`);
    if (at(prev, headBefore) !== rule.read) problems.push(`passo ${i}: símbolo lido`);
    if (at(step.config, headBefore) !== rule.write) problems.push(`passo ${i}: símbolo escrito`);
    if (headAfter !== headBefore + (rule.move === 'R' ? 1 : -1)) problems.push(`passo ${i}: movimento`);
  });
  return problems;
}

const random = rng(20261105);
const RANDOM = Array.from({ length: 150 }, () => randomTM(random));

describe('propriedades em 150 MTs aleatórias', () => {
  let compared = 0;
  afterAll(() => {
    expect(compared).toBeGreaterThan(0.8 * RANDOM.length * WORDS.length);
  });

  it.each(RANDOM.map((m, i) => [i, m] as const))('#%i', (_i, m) => {
    const ntm = classify(m) === 'NTM';
    for (const w of WORDS) {
      const r = simulate(m, w, OPTS);
      expect(r.tree !== undefined, w).toBe(ntm);
      const problems = ntm
        ? [...r.steps, ...r.tree!].flatMap((s) => configProblems(m, s.config))
        : dtmProblems(m, r);
      expect(problems, w).toEqual([]);
      if (r.stop === 'STEP_LIMIT') continue;
      const ref = refRun(m, w);
      if (ref === undefined) continue;
      compared++;
      expect(r.accepted, w).toBe(ref.accepted);
      if (r.accepted && m.acceptance === 'HALT') expect(r.output, w).toBe(ref.output);
      // LOOP só quando a referência também viu uma configuração repetida
      if (r.stop === 'LOOP') expect(ref.loops, w).toBe(true);
      if (!ntm && r.stop === 'LOOP') {
        expect(r.steps.at(-1)!.config).toEqual(r.steps[r.loopStart!]!.config);
      }
    }
  });
});

/** Congela o objeto inteiro: qualquer escrita vira erro (módulos são strict). */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

describe('pureza: nenhuma função modifica a entrada', () => {
  it.each(TM_EXAMPLES.map((e) => [e.id, e.tm] as const))('%s', (_id, original) => {
    const before = structuredClone(original);
    const m = deepFreeze(structuredClone(original));
    tapeAlphabet(m);
    inputAlphabet(m);
    validate(m);
    classify(m);
    const r = simulate(m, '0011');
    simulate(m, 'abc');
    simulate(m, '', { maxSteps: 10, maxNodes: 10 });
    formalDefinition(m);
    const config = deepFreeze(structuredClone(r.steps[0]!.config));
    formatConfig(m, config);
    expect(m).toEqual(before);
    expect(config).toEqual(r.steps[0]!.config);
  });
});
