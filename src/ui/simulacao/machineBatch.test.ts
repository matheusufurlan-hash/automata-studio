import { PDA_EXAMPLES } from '../../core/pda/examples';
import { TM_EXAMPLES } from '../../core/tm/examples';
import type { MachineAutomaton } from './machine';
import { formatMachineBatch, parseMachineBatch, runMachineBatch, samplesToBatch, summarizeMachine } from './machineBatch';

const pda = (id: string): MachineAutomaton => ({ kind: 'pda', pda: PDA_EXAMPLES.find((e) => e.id === id)!.pda });
const tm = (id: string): MachineAutomaton => ({ kind: 'tm', tm: TM_EXAMPLES.find((e) => e.id === id)!.tm });

describe('lote de AP e MT', () => {
  it('lê +, -, ε e "palavra => saída"', () => {
    const e = parseMachineBatch('+0110\n-011\n\n0000100 => 00\nε => ε\n0101', ['0', '1']);
    expect(e.map((x) => [x.line, x.word, x.expected, x.expectedOutput])).toEqual([
      [1, '0110', true, undefined],
      [2, '011', false, undefined],
      [4, '0000100', true, '00'],
      [5, '', true, ''],
      [6, '0101', null, undefined],
    ]);
    expect(formatMachineBatch(e)).toBe('+0110\n-011\n0000100 => 00\nε => ε\n0101');
  });

  it('as palavras de teste de todos os exemplos de AP e MT ficam verdes (ou amarelas quando a MT não decide)', () => {
    for (const ex of PDA_EXAMPLES) {
      const r = runMachineBatch({ kind: 'pda', pda: ex.pda }, parseMachineBatch(samplesToBatch(ex.samples!)));
      expect(summarizeMachine(r).failed, ex.id).toBe(0);
      expect(r.every((x) => x.ok === true), ex.id).toBe(true);
    }
    for (const ex of TM_EXAMPLES) {
      const r = runMachineBatch({ kind: 'tm', tm: ex.tm }, parseMachineBatch(samplesToBatch(ex.samples!)));
      expect(summarizeMachine(r).failed, ex.id).toBe(0);
      // mt-divisao com 0010001 anda para sempre sobre brancos: "indefinido" (amarelo), não "rejeita"
      for (const x of r) if (x.ok !== true) expect([ex.id, x.outcome]).toEqual(['mt-divisao', 'undecided']);
    }
  });

  it('saída diferente da esperada fica vermelha', () => {
    const [r] = runMachineBatch(tm('mt-monus'), parseMachineBatch('0000100 => 000'));
    expect(r!.outcome).toBe('accepted');
    expect(r!.output).toBe('00');
    expect(r!.ok).toBe(false);
  });

  it('NÃO PARA bate com "deve rejeitar"; INDEFINIDO não bate nem deixa de bater', () => {
    const loop: MachineAutomaton = { kind: 'tm', tm: { ...TM_EXAMPLES.find((e) => e.id === 'mt-laco-infinito')!.tm, acceptance: 'HALT' } };
    const [l1, l2] = runMachineBatch(loop, parseMachineBatch('-01\n+01'));
    expect(l1!.outcome).toBe('loop');
    expect(l1!.ok).toBe(true);
    expect(l2!.ok).toBe(false);
    const [u] = runMachineBatch(tm('mt-divisao'), parseMachineBatch('-0010001'), { maxNodes: 5000, maxSteps: 300, exploreAll: false });
    expect(u!.outcome).toBe('undecided');
    expect(u!.ok).toBeNull();
    expect(u!.detail).toContain('300 passos');
  });

  it('AP: o motivo de cada resultado', () => {
    const r = runMachineBatch(pda('ap-palindromo-par'), parseMachineBatch('0110\n011\n0a'));
    expect(r.map((x) => x.detail)).toEqual(['aceita por estado final', 'nenhum caminho aceita', "nenhuma regra lê 'a'"]);
  });
});
