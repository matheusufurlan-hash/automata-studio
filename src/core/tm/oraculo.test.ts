/**
 * Comparação com o YAAS ORIGINAL (o oráculo) — MT.
 *
 * __fixtures__/oraculo.json é gerado por tools/oraculo/GerarOraculoMT.java,
 * que roda o YAAS-1.0.7.jar em cada exemplo. Para regerar, veja o comentário
 * no topo desse arquivo Java.
 *
 * Divergências CONHECIDAS (o YAAS está errado ou segue outro modelo; em
 * todas, a nossa resposta é conferida com `refRun`, uma simulação de
 * referência escrita de outro jeito, ou com a definição da linguagem):
 *
 *  1. Modelo do Hopcroft (seção 8.2.5): a MT aceita ASSIM QUE entra num
 *     estado final. O YAAS continua rodando depois de passar por um final e
 *     só olha o estado em que parou. Em mt-laco-infinito (q1 é final e tem
 *     regras saindo), o YAAS entra em laço com 01, 001, 011... e rejeita;
 *     aqui essas palavras são aceitas ao entrar em q1. Em todas as outras
 *     MTs de exemplo, os finais não têm regras saindo, e os dois modelos
 *     dão a mesma resposta.
 *  2. MT não determinística: o YAAS não simula (segue sempre a 1ª regra que
 *     casa; ver o comentário do topo de TM.java). Em mt-nao-deterministica
 *     ele nunca aceita; aqui a busca em largura aceita as palavras com 00.
 *  3. BUG do YAAS: transição com várias operações. Falta um break no laço
 *     das operações de TM.accepts: depois de aplicar uma operação, o YAAS
 *     testa as seguintes DA MESMA TRANSIÇÃO já na configuração nova e, se
 *     casar, aplica de novo (com a regra de outro estado). O oráculo detecta
 *     isso palavra por palavra (`yaasTwoOperations`). Nos exemplos, só
 *     mt-sim-ou-nao é afetada, e lá a resposta não muda (qs e qn são
 *     finais). O caso `bugs.duas-operacoes` mostra uma MT em que o YAAS
 *     rejeita 01 e a resposta certa é aceitar.
 *  4. BUG do YAAS: limite fixo de 4000 passos. Qualquer MT que precise de
 *     mais passos é dada como "não para". O caso `bugs.limite-4000-passos`
 *     é o Exemplo 8.2 com 0⁴⁵1⁴⁵ (4141 passos): o YAAS rejeita; aqui aceita
 *     com o limite padrão (10000). Nos exemplos com palavras de até 6
 *     símbolos, todas as que batem nos 4000 passos do YAAS (`yaasStepLimit`)
 *     são laços de verdade (ou a divergência 1), e aqui também rejeitam.
 *  5. O YAAS lança StringIndexOutOfBoundsException com a palavra vazia
 *     quando a MT lê o branco no 1º passo; o oráculo simula a palavra vazia
 *     com a fita "B" (a mesma configuração) e a resposta bate com a nossa.
 */
import oracleJson from './__fixtures__/oraculo.json';
import { summarize, type LanguageSummary } from '../fa/test-helpers';
import type { Sym, TM, TMAcceptance } from './types';
import { classify, inputAlphabet, simulate } from './index';
import { TM_EXAMPLES } from './examples';
import { allWords, tm } from './test-helpers';

interface OracleExample {
  id: string;
  source: string;
  acceptance: TMAcceptance;
  type: string;
  alphabet: Sym[];
  maxLength: number;
  accepted: LanguageSummary;
  outputs?: Record<string, string>;
  yaasTwoOperations: string[];
  yaasStepLimit: string[];
  yaasEmptyWord?: string;
}

interface OracleBug {
  id: string;
  description: string;
  word: string;
  acceptance: TMAcceptance;
  yaasAccepted: boolean;
  yaasAbleToHalt: boolean;
  yaasTwoOperations: boolean;
}

const oracle = oracleJson as unknown as { examples: OracleExample[]; bugs: OracleBug[] };

/** Exemplos em que a linguagem do YAAS é outra (divergências 1 e 2 do topo). */
const DIVERGENT: Record<string, { why: string; language: (w: string) => boolean }> = {
  'mt-laco-infinito': { why: 'aceita ao entrar no final (Hopcroft 8.2.5)', language: (w) => w.includes('1') },
  'mt-nao-deterministica': { why: 'o YAAS não simula MT não determinística', language: (w) => w.includes('00') },
};

/**
 * Simulação de referência de uma MT DETERMINÍSTICA: fita num Map, uma regra
 * por passo, procurando a regra direto na lista de transições.
 */
function refRun(m: TM, word: string, maxSteps = 100_000): { accepted: boolean; output?: string } {
  const tape = new Map<number, string>();
  Array.from(word).forEach((c, i) => tape.set(i, c));
  const finals = new Set(m.states.filter((s) => s.final).map((s) => s.id));
  let state = m.states.find((s) => s.initial)!.id;
  let head = 0;
  const output = () => {
    const cells = [...tape.entries()].filter(([, c]) => c !== m.blank).map(([p]) => p);
    if (cells.length === 0) return '';
    let text = '';
    for (let p = Math.min(...cells); p <= Math.max(...cells); p++) text += tape.get(p) ?? m.blank;
    return text;
  };
  if (m.acceptance === 'FINAL_STATE' && finals.has(state)) return { accepted: true, output: output() };
  for (let step = 0; step < maxSteps; step++) {
    const symbol = tape.get(head) ?? m.blank;
    let next: { to: string; write: string; move: 'L' | 'R' } | undefined;
    for (const t of m.transitions) {
      if (t.from !== state || next) continue;
      const r = t.rules.find((x) => x.read === symbol);
      if (r) next = { to: t.to, write: r.write, move: r.move };
    }
    if (!next) return { accepted: m.acceptance === 'HALT', output: output() };
    tape.set(head, next.write);
    head += next.move === 'R' ? 1 : -1;
    state = next.to;
    if (m.acceptance === 'FINAL_STATE' && finals.has(state)) return { accepted: true, output: output() };
  }
  return { accepted: false };
}

function example(id: string) {
  const e = TM_EXAMPLES.find((x) => x.id === id);
  if (!e) throw new Error(`exemplo desconhecido: ${id}`);
  return e;
}

describe('oráculo MT: arquivo e exemplos', () => {
  it('tem os mesmos 8 exemplos de TM_EXAMPLES, na mesma ordem', () => {
    expect(oracle.examples.map((e) => e.id)).toEqual(TM_EXAMPLES.map((e) => e.id));
  });

  it('as divergências documentadas são só estas (e o bug 3 só aparece em mt-sim-ou-nao)', () => {
    expect(Object.keys(DIVERGENT).sort()).toEqual(['mt-laco-infinito', 'mt-nao-deterministica']);
    expect(oracle.examples.filter((e) => e.yaasTwoOperations.length > 0).map((e) => e.id)).toEqual(['mt-sim-ou-nao']);
    expect(oracle.examples.filter((e) => e.yaasEmptyWord).map((e) => e.id)).toEqual([
      'mt-sim-ou-nao',
      'mt-mesmo-numero-de-0-e-1',
    ]);
  });
});

describe.each(oracle.examples)('oráculo MT: $id ($source)', (o) => {
  const { tm: m } = example(o.id);
  const words = allWords(o.alphabet, o.maxLength);
  const ours = new Map(words.map((w) => [w, simulate(m, w)]));

  it('mesmo modo de aceitação, mesmo tipo e o mesmo Σ', () => {
    expect(m.acceptance).toBe(o.acceptance);
    expect(classify(m)).toBe(o.type);
    expect(inputAlphabet(m)).toEqual(o.alphabet);
  });

  it(`palavras aceitas (tamanho 0 a ${o.maxLength})`, async () => {
    const accepted = words.filter((w) => ours.get(w)!.accepted);
    const divergent = DIVERGENT[o.id];
    if (!divergent) {
      const summary = await summarize(accepted, o.maxLength, o.accepted.words !== undefined);
      if (o.accepted.words) expect(summary.words).toEqual(o.accepted.words);
      expect(summary.counts).toEqual(o.accepted.counts);
      expect(summary.sha256).toEqual(o.accepted.sha256);
    } else {
      // a nossa resposta segue a definição da linguagem; a do YAAS, não
      expect(accepted).toEqual(words.filter(divergent.language));
      expect(o.accepted.words).not.toEqual(accepted);
    }
    // STEP_LIMIT aqui só onde o YAAS também não decidiu (MT andando sobre brancos para sempre)
    for (const [w, r] of ours) if (r.stop === 'STEP_LIMIT') expect(o.yaasStepLimit, w).toContain(w);
  });

  it('as MTs determinísticas batem com a simulação de referência, palavra por palavra', () => {
    if (classify(m) === 'NTM') return;
    for (const w of words) {
      const r = ours.get(w)!;
      const ref = refRun(m, w);
      expect(r.accepted, w).toBe(ref.accepted);
      if (r.accepted && m.acceptance === 'HALT') expect(r.output, w).toBe(ref.output);
    }
  });

  it('palavras em que o YAAS bateu nos 4000 passos: aqui rejeitam por laço (ou divergência 1)', () => {
    for (const w of o.yaasStepLimit) {
      const r = ours.get(w)!;
      if (o.id === 'mt-laco-infinito') {
        expect(r.stop, w).toBe('ACCEPTED_FINAL');
        // e trocando para aceitação por parada, a MT entra mesmo em laço
        expect(simulate({ ...m, acceptance: 'HALT' }, w).stop, w).toBe('LOOP');
      } else {
        expect(r.accepted, w).toBe(false);
        // 5× o limite do YAAS e continua sem parar
        expect(['LOOP', 'STEP_LIMIT']).toContain(simulate(m, w, { maxSteps: 20_000 }).stop);
      }
    }
  });

  if (o.outputs) {
    it('aceitação por parada: a mesma fita final em cada palavra aceita', () => {
      for (const [w, output] of Object.entries(o.outputs!)) {
        expect(ours.get(w)!.output, w).toBe(output);
      }
    });
  }
});

describe('oráculo MT: os 2 bugs do YAAS', () => {
  it('duas operações seguidas: o YAAS rejeita 01; com uma regra por passo, aceita', () => {
    const bug = oracle.bugs.find((b) => b.id === 'duas-operacoes')!;
    expect(bug.yaasAccepted).toBe(false);
    expect(bug.yaasTwoOperations).toBe(true);
    const m = tm('q0', ['q2'], ['q0 00R|11R q1', 'q1 11R q2'], { sigma: '01' });
    const r = simulate(m, bug.word);
    expect(r.accepted).toBe(true);
    expect(r.steps).toHaveLength(3);
    expect(refRun(m, bug.word).accepted).toBe(true);
  });

  it('limite fixo de 4000 passos: o YAAS diz que não para; aqui aceita (e com limite menor, STEP_LIMIT)', () => {
    const bug = oracle.bugs.find((b) => b.id === 'limite-4000-passos')!;
    expect(bug.yaasAccepted).toBe(false);
    expect(bug.yaasAbleToHalt).toBe(false);
    const m = example('mt-0n1n').tm;
    const r = simulate(m, bug.word);
    expect(r.accepted).toBe(true);
    expect(r.steps.length - 1).toBe(4141);
    expect(refRun(m, bug.word).accepted).toBe(true);
    const limited = simulate(m, bug.word, { maxSteps: 4000 });
    expect(limited.stop).toBe('STEP_LIMIT');
  });

  it('mt-sim-ou-nao: o YAAS aplica duas operações seguidas, mas aqui cada passo usa uma regra do estado atual', () => {
    const o = oracle.examples.find((e) => e.id === 'mt-sim-ou-nao')!;
    const m = example(o.id).tm;
    for (const w of o.yaasTwoOperations) {
      const r = simulate(m, w);
      r.steps.forEach((step, i) => {
        if (i === 0) return;
        const t = m.transitions.find((x) => x.id === step.via!.transition)!;
        expect(t.from, `${w} passo ${i}`).toBe(r.steps[i - 1]!.config.state);
        expect(t.to, `${w} passo ${i}`).toBe(step.config.state);
      });
    }
  });
});
