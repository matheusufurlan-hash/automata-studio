import { complete, determinize } from '../../core/fa';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { keepLayout } from './actions';

const ex = (id: string) => FA_EXAMPLES.find((e) => e.id === id)!;

describe('keepLayout: resultado mantém o desenho do aluno', () => {
  it('completar: estados antigos no mesmo lugar e o morto à direita', () => {
    const src = ex('afd-so-01');
    const out = complete(src.fa);
    const layout = keepLayout(out, src)!;
    expect(layout).toBeDefined();
    for (const s of src.fa.states) expect(layout.positions[s.id]).toEqual(src.layout.positions[s.id]);
    const dead = out.states.find((s) => !src.fa.states.some((o) => o.id === s.id))!;
    const maxX = Math.max(...Object.values(src.layout.positions).map((p) => p.x));
    expect(layout.positions[dead.id]!.x).toBeGreaterThan(maxX);
  });

  it('AFN → AFD gera outro autômato: usa o layout automático', () => {
    const src = ex('enfa-numero-decimal');
    expect(keepLayout(determinize(src.fa).dfa, src)).toBeUndefined();
  });
});
