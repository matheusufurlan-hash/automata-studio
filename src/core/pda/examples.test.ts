import oracleJson from './__fixtures__/oraculo.json';
import { EPSILON } from './types';
import { simulate, validate } from './index';
import { PDA_EXAMPLES } from './examples';

interface OracleRule {
  read: string;
  pop: string;
  push: string | null;
  topoEpsilon?: boolean;
}

interface OracleStructure {
  states: Array<{ name: string; x: number; y: number; initial: boolean; final: boolean }>;
  transitions: Array<{ from: number; to: number; rules: OracleRule[]; curvature?: number; loopAngle?: number }>;
}

const oracle = oracleJson as unknown as { examples: Array<{ id: string; structure: OracleStructure }> };

/**
 * Exemplos adaptados de propósito (regras diferentes das do YAAS traduzidas):
 * o "topo ε" do YAAS não existe no Hopcroft (ver a descrição do exemplo).
 */
const ADAPTED: Record<string, Array<{ transition: number; yaas: string[]; ours: string[] }>> = {
  'ap-transicao-vazia-com-pilha-vazia': [
    // o YAAS esvazia a pilha aqui; nós deixamos o Z no fundo
    { transition: 0, yaas: ['ε,Z/ε'], ours: ['ε,Z/Z'] },
    // "topo ε" (só com a pilha vazia) → "ε, Z/Z" (só com o Z no topo)
    { transition: 1, yaas: ['ε,ε/?'], ours: ['ε,Z/Z'] },
  ],
};

const label = (r: { read: string; pop: string; push: string | null }) =>
  `${r.read},${r.pop}/${r.push === null ? '?' : r.push || EPSILON}`;

describe('PDA_EXAMPLES', () => {
  it('14 exemplos com ids únicos, nome e descrição', () => {
    expect(PDA_EXAMPLES).toHaveLength(14);
    expect(new Set(PDA_EXAMPLES.map((e) => e.id)).size).toBe(14);
    for (const e of PDA_EXAMPLES) {
      expect(e.name.length, e.id).toBeGreaterThan(0);
      expect(e.description.length, e.id).toBeGreaterThan(0);
      expect(e.samples?.length, e.id).toBeGreaterThan(0);
    }
  });

  it.each(PDA_EXAMPLES.map((e) => [e.id, e] as const))('%s: válido e com desenho completo', (_id, e) => {
    expect(validate(e.pda)).toEqual([]);
    expect(e.pda.startStackSymbol).toBe('Z');
    expect(Object.keys(e.layout.positions).sort()).toEqual(e.pda.states.map((s) => s.id).sort());
    expect(Object.keys(e.layout.edges).sort()).toEqual(e.pda.transitions.map((t) => t.id).sort());
    const pairs = e.pda.transitions.map((t) => `${t.from}>${t.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const t of e.pda.transitions) {
      const rules = t.rules.map(label);
      expect(new Set(rules).size, t.id).toBe(rules.length);
    }
  });

  it.each(PDA_EXAMPLES.map((e) => [e.id, e] as const))('%s: as palavras de teste batem com a simulação', (_id, e) => {
    for (const s of e.samples!) expect(simulate(e.pda, s.word).accepted, s.word).toBe(s.accepted);
  });

  it.each(oracle.examples.map((o) => [o.id, o.structure] as const))('%s: igual ao exemplo do YAAS', (id, s) => {
    const e = PDA_EXAMPLES.find((x) => x.id === id)!;
    expect(
      e.pda.states.map((st) => ({ ...e.layout.positions[st.id]!, name: st.name, initial: st.initial, final: st.final })),
    ).toEqual(s.states.map((st) => ({ name: st.name, x: st.x, y: st.y, initial: st.initial, final: st.final })));

    const nameOf = (stateId: string) => e.pda.states.find((st) => st.id === stateId)!.name;
    expect(e.pda.transitions.map((t) => [nameOf(t.from), nameOf(t.to)])).toEqual(
      s.transitions.map((t) => [s.states[t.from]!.name, s.states[t.to]!.name]),
    );

    const adapted = ADAPTED[id] ?? [];
    e.pda.transitions.forEach((t, i) => {
      const yaas = s.transitions[i]!;
      const ours = t.rules.map(label).sort();
      const theirs = yaas.rules.map(label).sort();
      const change = adapted.find((a) => a.transition === i);
      if (change) {
        expect(theirs).toEqual(change.yaas);
        expect(ours).toEqual(change.ours);
      } else {
        expect(yaas.rules.some((r) => r.topoEpsilon), `${id} t${i}: topo ε sem adaptação`).toBe(false);
        expect(ours, `${id} t${i}`).toEqual(theirs);
      }
      const edge = e.layout.edges[t.id]!;
      if (yaas.loopAngle !== undefined) expect(edge.loopAngle).toBe(((yaas.loopAngle % 360) + 360) % 360);
      else expect(edge.curvature).toBe(yaas.curvature);
    });
  });

  it('o 1º exemplo é o Exemplo 6.2 do Hopcroft, com as regras na ordem do livro', () => {
    const e = PDA_EXAMPLES[0]!;
    expect(e.description).toContain('Exemplo 6.2');
    expect(e.pda.transitions.map((t) => t.rules.map(label).join(' '))).toEqual([
      '0,Z/0Z 1,Z/1Z 0,0/00 0,1/01 1,0/10 1,1/11',
      'ε,Z/Z ε,0/0 ε,1/1',
      '0,0/ε 1,1/ε',
      'ε,Z/Z',
    ]);
  });
});
