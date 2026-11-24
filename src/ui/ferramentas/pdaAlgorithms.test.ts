import { accepts } from '../../core/pda';
import { PDA_EXAMPLES } from '../../core/pda/examples';
import { getActiveDoc, pdaOf, useDocuments } from '../../store/documents';
import { openExample, runPDAAlgorithm } from './actions';
import { pdaUnavailableReason, runPDAAlgo } from './pdaAlgorithms';
import { useTools } from './store';

const ex = (id: string) => PDA_EXAMPLES.find((e) => e.id === id)!;

describe('conversões do AP (Teoremas 6.9 e 6.11)', () => {
  it('quando cada uma faz sentido', () => {
    const fs = ex('ap-palindromo-par').pda;
    expect(pdaUnavailableReason('toFinalState', fs)).toBe('ele já aceita por estado final');
    expect(pdaUnavailableReason('toEmptyStack', fs)).toBeNull();
    const es = ex('ap-palindromo-par-pilha-vazia').pda;
    expect(pdaUnavailableReason('toEmptyStack', es)).toBe('ele já aceita por pilha vazia');
    expect(pdaUnavailableReason('toFinalState', es)).toBeNull();
    expect(pdaUnavailableReason('toEmptyStack', { ...fs, states: [] })).toBe('o AP está vazio');
  });

  it('estado final → pilha vazia: mesma linguagem, originais no mesmo lugar e explicação', () => {
    const e = ex('ap-palindromo-par');
    const out = runPDAAlgo('toEmptyStack', 'P', e.pda, e.layout);
    expect(out.pda.acceptance).toBe('EMPTY_STACK');
    for (const w of ['', '0110', '1111', '011', '0101']) expect(accepts(out.pda, w), w).toBe(accepts(e.pda, w));
    for (const s of e.pda.states) expect(out.layout.positions[s.id]).toEqual(e.layout.positions[s.id]);
    // os novos (p0 e p) ganham posição fora dos originais
    const fresh = out.pda.states.filter((s) => !e.pda.states.some((o) => o.id === s.id));
    expect(fresh.map((s) => s.name).sort()).toEqual(['p', 'p0']);
    const p0 = out.layout.positions[fresh.find((s) => s.initial)!.id]!;
    expect(p0.x).toBeLessThan(e.layout.positions.q0!.x);
    expect(out.title).toBe('Estado final → pilha vazia (Teorema 6.11)');
    expect(out.notes.join(' ')).toContain('N(P_N) = L(P)');
  });

  it('pilha vazia → estado final: pf embaixo do desenho e a mesma linguagem', () => {
    const e = ex('ap-0n1n-pilha-vazia');
    const out = runPDAAlgo('toFinalState', 'P', e.pda, e.layout);
    expect(out.pda.acceptance).toBe('FINAL_STATE');
    for (const w of ['01', '0011', '', '0', '10']) expect(accepts(out.pda, w), w).toBe(accepts(e.pda, w));
    const pf = out.pda.states.find((s) => s.final)!;
    expect(pf.name).toBe('pf');
    const maxY = Math.max(...e.pda.states.map((s) => e.layout.positions[s.id]!.y));
    expect(out.layout.positions[pf.id]!.y).toBeGreaterThan(maxY);
    expect(out.notes.join(' ')).toContain('L(P_F) = N(P)');
  });

  it('pelo menu: abre numa aba nova com a origem explicada; 0110 continua aceita', () => {
    openExample('ap-palindromo-par');
    const before = useDocuments.getState().docs.length;
    runPDAAlgorithm('toEmptyStack');
    expect(useDocuments.getState().docs.length).toBe(before + 1);
    const doc = getActiveDoc();
    const pda = pdaOf(doc)!;
    expect(pda.acceptance).toBe('EMPTY_STACK');
    expect(accepts(pda, '0110')).toBe(true);
    const prov = useTools.getState().provenance[doc.id];
    expect(prov?.kind).toBe('pda');
  });
});
