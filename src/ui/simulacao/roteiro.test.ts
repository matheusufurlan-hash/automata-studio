/**
 * Roteiro completo pela mesma API que a tela usa (store da simulação + ações das ferramentas).
 */
import { PDA_EXAMPLES } from '../../core/pda/examples';
import { TM_EXAMPLES } from '../../core/tm/examples';
import { useDocuments } from '../../store/documents';
import { openExample, runPDAAlgorithm } from '../ferramentas/actions';
import type { PDARun, TMRun } from './machine';
import { idItem, machineVerdict, pdaConfigAt, stepCount } from './machine';
import { parseMachineBatch, runMachineBatch, samplesToBatch } from './machineBatch';
import { useSimulation } from './store';

const sim = () => useSimulation.getState();
const ids = (run: PDARun | TMRun) =>
  Array.from({ length: stepCount(run) }, (_, i) => {
    const it = idItem(run, i);
    return it.text ?? `${it.parts!.left}${it.parts!.state}${it.parts!.right}`;
  }).join(' ⊢ ');

describe('roteiro completo', () => {
  it('1. AP do Exemplo 6.2: 0110 aceita por estado final, com a pilha e as IDs do livro e a árvore', () => {
    openExample('ap-palindromo-par');
    sim().load('0110');
    const run = sim().machine as PDARun;
    expect(ids(run)).toBe('(q0, 0110, Z) ⊢ (q0, 110, 0Z) ⊢ (q0, 10, 10Z) ⊢ (q1, 10, 10Z) ⊢ (q1, 0, 0Z) ⊢ (q1, ε, Z) ⊢ (q2, ε, Z)');
    expect(pdaConfigAt(run, 2).stack).toBe('10Z');
    sim().last();
    expect(machineVerdict(run)).toMatchObject({ tone: 'accepted', title: 'Por estado final' });
    expect(run.result.tree.length).toBeGreaterThan(stepCount(run));
  });

  it('2. 011 rejeita, com o motivo', () => {
    openExample('ap-palindromo-par');
    sim().load('011');
    const v = machineVerdict(sim().machine!);
    expect(v.tone).toBe('rejected');
    expect(v.title).toBe('Nenhum caminho aceita');
  });

  it('3. converter para pilha vazia: 0110 continua aceita no AP novo', () => {
    openExample('ap-palindromo-par');
    runPDAAlgorithm('toEmptyStack');
    sim().load('0110');
    const v = machineVerdict(sim().machine!);
    expect(v).toMatchObject({ tone: 'accepted', title: 'Por pilha vazia' });
  });

  it('4. MT do Exemplo 8.2 com 0011: exatamente as IDs do livro', () => {
    openExample('mt-0n1n');
    sim().load('0011');
    expect(ids(sim().machine as TMRun)).toBe(
      'q00011 ⊢ Xq1011 ⊢ X0q111 ⊢ Xq20Y1 ⊢ q2X0Y1 ⊢ Xq00Y1 ⊢ XXq1Y1 ⊢ XXYq11 ⊢ XXq2YY ⊢ Xq2XYY ⊢ XXq0YY ⊢ XXYq3Y ⊢ XXYYq3B ⊢ XXYYBq4B',
    );
  });

  it('5. monus mostra a saída; o laço (por parada) não para; a MTN tem árvore', () => {
    openExample('mt-monus');
    sim().load('0000100');
    expect(machineVerdict(sim().machine!).output).toBe('00');
    openExample('mt-laco-infinito');
    useDocuments.getState().setTMOptions({ acceptance: 'HALT' });
    sim().load('01');
    expect(machineVerdict(sim().machine!).tone).toBe('loop');
    openExample('mt-nao-deterministica');
    sim().load('1001');
    const run = sim().machine as TMRun;
    expect(run.result.tree?.length).toBeGreaterThan(stepCount(run));
    expect(machineVerdict(run).tone).toBe('accepted');
  });

  it('6. teste em lote com as palavras de um exemplo de AP e de um de MT: tudo verde', () => {
    const ap = PDA_EXAMPLES.find((e) => e.id === 'ap-palindromo-par')!;
    const mt = TM_EXAMPLES.find((e) => e.id === 'mt-0n1n')!;
    const r1 = runMachineBatch({ kind: 'pda', pda: ap.pda }, parseMachineBatch(samplesToBatch(ap.samples!)));
    const r2 = runMachineBatch({ kind: 'tm', tm: mt.tm }, parseMachineBatch(samplesToBatch(mt.samples!)));
    expect([...r1, ...r2].every((r) => r.ok === true)).toBe(true);
  });
});
