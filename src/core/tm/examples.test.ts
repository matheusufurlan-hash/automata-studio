import oracleJson from './__fixtures__/oraculo.json';
import { classify, inputAlphabet, simulate, validate } from './index';
import { TM_EXAMPLES } from './examples';

interface OracleStructure {
  states: Array<{ name: string; x: number; y: number; initial: boolean; final: boolean }>;
  transitions: Array<{
    from: number;
    to: number;
    rules: Array<{ read: string; write: string; move: string }>;
    curvature?: number;
    loopAngle?: number;
  }>;
}

const oracle = oracleJson as unknown as { examples: Array<{ id: string; structure: OracleStructure }> };

const label = (r: { read: string; write: string; move: string }) => `${r.read}/${r.write} ${r.move}`;

describe('TM_EXAMPLES', () => {
  it('8 exemplos do YAAS (o Exemplo 8.2 do Hopcroft é o 1º) com ids únicos, nome, descrição e Σ', () => {
    expect(TM_EXAMPLES).toHaveLength(8);
    expect(new Set(TM_EXAMPLES.map((e) => e.id)).size).toBe(8);
    for (const e of TM_EXAMPLES) {
      expect(e.name.length, e.id).toBeGreaterThan(0);
      expect(e.description.length, e.id).toBeGreaterThan(0);
      expect(e.samples?.length, e.id).toBeGreaterThan(0);
      expect(e.tm.inputAlphabet.length, e.id).toBeGreaterThan(0);
    }
    expect(TM_EXAMPLES[0]!.description).toContain('Exemplo 8.2');
  });

  it.each(TM_EXAMPLES.map((e) => [e.id, e] as const))('%s: válido e com desenho completo', (_id, e) => {
    expect(validate(e.tm)).toEqual([]);
    expect(e.tm.blank).toBe('B');
    expect(Object.keys(e.layout.positions).sort()).toEqual(e.tm.states.map((s) => s.id).sort());
    expect(Object.keys(e.layout.edges).sort()).toEqual(e.tm.transitions.map((t) => t.id).sort());
    const pairs = e.tm.transitions.map((t) => `${t.from}>${t.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const t of e.tm.transitions) {
      const rules = t.rules.map(label);
      expect(new Set(rules).size, t.id).toBe(rules.length);
    }
  });

  it.each(TM_EXAMPLES.map((e) => [e.id, e] as const))('%s: as palavras de teste batem com a simulação', (_id, e) => {
    for (const s of e.samples!) {
      const r = simulate(e.tm, s.word);
      expect(r.accepted, s.word).toBe(s.accepted);
      if (e.tm.acceptance === 'HALT' && s.accepted) expect(r.output, s.word).toBe(s.output);
      else expect(s.output, s.word).toBeUndefined();
    }
  });

  it.each(oracle.examples.map((o) => [o.id, o.structure] as const))('%s: igual ao exemplo do YAAS', (id, s) => {
    const e = TM_EXAMPLES.find((x) => x.id === id)!;
    expect(
      e.tm.states.map((st) => ({ ...e.layout.positions[st.id]!, name: st.name, initial: st.initial, final: st.final })),
    ).toEqual(s.states.map((st) => ({ name: st.name, x: st.x, y: st.y, initial: st.initial, final: st.final })));

    const nameOf = (stateId: string) => e.tm.states.find((st) => st.id === stateId)!.name;
    expect(
      e.tm.transitions.map((t) => ({ from: nameOf(t.from), to: nameOf(t.to), rules: t.rules.map(label).sort() })),
    ).toEqual(
      s.transitions.map((t) => ({
        from: s.states[t.from]!.name,
        to: s.states[t.to]!.name,
        rules: t.rules.map(label).sort(),
      })),
    );

    e.tm.transitions.forEach((t, i) => {
      const yaas = s.transitions[i]!;
      const edge = e.layout.edges[t.id]!;
      if (yaas.loopAngle !== undefined) expect(edge.loopAngle).toBe(((yaas.loopAngle % 360) + 360) % 360);
      else expect(edge.curvature).toBe(yaas.curvature);
    });
  });

  it('só a MT não determinística é NTM; Σ informado em todas', () => {
    expect(TM_EXAMPLES.filter((e) => classify(e.tm) === 'NTM').map((e) => e.id)).toEqual(['mt-nao-deterministica']);
    expect(inputAlphabet(TM_EXAMPLES.find((e) => e.id === 'mt-anbncn')!.tm)).toEqual(['a', 'b', 'c']);
  });
});
