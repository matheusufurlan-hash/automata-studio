import oracleJson from './__fixtures__/oraculo.json';
import { validate } from './index';
import { FA_EXAMPLES } from './examples';

interface OracleStructure {
  states: Array<{ name: string; x: number; y: number; initial: boolean; final: boolean }>;
  transitions: Array<{ from: number; to: number; symbols: string[]; curvature?: number; loopAngle?: number }>;
}

const oracle = oracleJson as unknown as { examples: Array<{ id: string; structure: OracleStructure }> };

describe('FA_EXAMPLES', () => {
  it('24 exemplos (14 + 9 de minimização + 1 de remoção) com ids únicos', () => {
    expect(FA_EXAMPLES).toHaveLength(24);
    expect(new Set(FA_EXAMPLES.map((e) => e.id)).size).toBe(24);
    for (const e of FA_EXAMPLES) {
      expect(e.name.length, e.id).toBeGreaterThan(0);
      expect(e.description.length, e.id).toBeGreaterThan(0);
    }
  });

  it.each(FA_EXAMPLES.map((e) => [e.id, e] as const))('%s: válido e com desenho completo', (_id, e) => {
    expect(validate(e.fa)).toEqual([]);
    expect(Object.keys(e.layout.positions).sort()).toEqual(e.fa.states.map((s) => s.id).sort());
    expect(Object.keys(e.layout.edges).sort()).toEqual(e.fa.transitions.map((t) => t.id).sort());
    const pairs = e.fa.transitions.map((t) => `${t.from}>${t.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it.each(oracle.examples.map((o) => [o.id, o.structure] as const))('%s: igual ao exemplo do YAAS', (id, s) => {
    const e = FA_EXAMPLES.find((x) => x.id === id)!;
    expect(e.fa.states.map((st) => ({ ...e.layout.positions[st.id]!, name: st.name, initial: st.initial, final: st.final })))
      .toEqual(s.states.map((st) => ({ name: st.name, x: st.x, y: st.y, initial: st.initial, final: st.final })));

    const nameOf = (stateId: string) => e.fa.states.find((st) => st.id === stateId)!.name;
    expect(
      e.fa.transitions.map((t) => ({ from: nameOf(t.from), to: nameOf(t.to), symbols: [...t.symbols].sort() })),
    ).toEqual(
      s.transitions.map((t) => ({
        from: s.states[t.from]!.name,
        to: s.states[t.to]!.name,
        symbols: [...t.symbols].sort(),
      })),
    );

    e.fa.transitions.forEach((t, i) => {
      const yaas = s.transitions[i]!;
      const edge = e.layout.edges[t.id]!;
      if (yaas.loopAngle !== undefined) expect(edge.loopAngle).toBe(((yaas.loopAngle % 360) + 360) % 360);
      else expect(edge.curvature).toBe(yaas.curvature);
    });
  });
});
