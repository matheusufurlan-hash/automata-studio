/**
 * Parâmetros de URL das ferramentas e da simulação (lidos uma vez, ao carregar).
 * Servem para abrir a tela num estado certo (prints e testes manuais):
 *
 *  - `exemplo=<id>`            abre um exemplo da galeria (ids em core/fa/examples.ts,
 *                              core/pda/examples.ts e core/tm/examples.ts);
 *  - `exemplo2=<id>`           abre um 2º exemplo e volta para o 1º (para União, Equivalência...);
 *  - `algoritmo=afd,minimizar` roda algoritmos em sequência, cada um no resultado do anterior
 *                              (afd, minimizar, completar, complemento, inalcancaveis, inuteis, estrela);
 *  - `rodada=<n>|fim`          posição da tabela passo a passo (minimização: -1..fim; subconjuntos: 0..fim);
 *  - `palavra=<w>`             carrega a palavra no simulador (vazia = ε); `passo=<n>|fim` vai ao passo;
 *  - `tocar=1`                 começa a tocar;
 *  - `painel=lote`             abre o teste em lote; `lote=<linhas>` (separadas por %0A) já testa;
 *                              `gerar=<n>` gera todas as palavras até n e testa;
 *  - `lateral=recolhido` · `simulacao=recolhido`   recolhe os painéis;
 *  - `menu=algoritmos`         abre o menu Algoritmos;
 *  Só AP e MT:
 *  - `painel=arvore`           abre a árvore de IDs; `arvore=inteira` = "Mostrar a árvore inteira";
 *  - `no=<n>`                  (com `palavra`) mostra o caminho até o nó n da árvore;
 *  - `limite=<n>`              limite de IDs (AP e MT não determinística) e de passos (MT determinística);
 *  - `amostras=1`              põe as palavras de teste do exemplo no teste em lote e testa;
 *  - `aceitacao=parada|final|pilha-vazia`  troca o modo de aceitação da aba (MT: parada/final; AP: final/pilha-vazia);
 *  - `algoritmo=estado-final|pilha-vazia`  converte o AP (Teoremas 6.9 e 6.11);
 *  - `dialogo=exemplos|uniao|concatenacao|intersecao|equivalencia` abre a janela;
 *    com `galeria=af|ap|mt`, a galeria abre nessa seção;
 *    com `comparar=1`, a janela de equivalência já mostra o resultado.
 */
import { getActiveDoc, useDocuments } from '../../store/documents';
import { samplesToBatch } from '../simulacao/machineBatch';
import { useSimulation } from '../simulacao/store';
import type { BinaryAlgo, UnaryAlgo } from './algorithms';
import { examplesSamples, openExample, runPDAAlgorithm, runUnaryAlgorithm } from './actions';
import type { PDAAlgo } from './pdaAlgorithms';
import { useTools } from './store';

const UNARY: Record<string, UnaryAlgo> = {
  afd: 'determinize',
  determinizar: 'determinize',
  minimizar: 'minimize',
  completar: 'complete',
  complemento: 'complement',
  inalcancaveis: 'removeUnreachable',
  inuteis: 'removeUseless',
  estrela: 'star',
  kleene: 'star',
};

const PDA_ALGOS: Record<string, PDAAlgo> = {
  'estado-final': 'toFinalState',
  'pilha-vazia': 'toEmptyStack',
};

const DIALOGS: Record<string, BinaryAlgo | 'equivalence'> = {
  uniao: 'union',
  concatenacao: 'concat',
  intersecao: 'intersection',
  equivalencia: 'equivalence',
};

let done = false;

export function bootstrapToolsFromUrl() {
  if (done || typeof window === 'undefined') return;
  done = true;
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(window.location.search);
  } catch {
    return;
  }

  const ex = p.get('exemplo');
  if (ex) openExample(ex);
  const ex2 = p.get('exemplo2');
  if (ex2) {
    const first = useDocuments.getState().activeId;
    openExample(ex2);
    useDocuments.getState().setActive(first);
  }

  for (const name of (p.get('algoritmo') ?? '').split(',')) {
    const algo = UNARY[name.trim()];
    if (algo) runUnaryAlgorithm(algo);
    const pdaAlgo = PDA_ALGOS[name.trim()];
    if (pdaAlgo) runPDAAlgorithm(pdaAlgo);
  }

  const tools = useTools.getState();
  const rodada = p.get('rodada');
  if (rodada !== null) {
    const id = getActiveDoc().id;
    const prov = tools.provenance[id];
    const end = prov?.kind === 'minimize' ? prov.result.table.rounds.length : prov?.kind === 'determinize' ? prov.result.dfa.states.length : 0;
    tools.setStepper(id, rodada === 'fim' ? end : Number(rodada) || 0);
  }

  const lateral = p.get('lateral');
  if (lateral === 'recolhido') tools.setSideCollapsed(true);
  if (lateral === 'aberto') tools.setSideCollapsed(false);

  const sim = useSimulation.getState();
  const simPanel = p.get('simulacao');
  if (simPanel === 'recolhido') sim.setCollapsed(true);
  if (simPanel === 'aberto') sim.setCollapsed(false);

  // AP/MT: modo de aceitação (para prints), limites e árvore inteira valem para a simulação que vem a seguir
  const aceitacao = p.get('aceitacao');
  const docs = useDocuments.getState();
  if (aceitacao === 'parada') docs.setTMOptions({ acceptance: 'HALT' });
  if (aceitacao === 'final') {
    docs.setTMOptions({ acceptance: 'FINAL_STATE' });
    docs.setPDAOptions({ acceptance: 'FINAL_STATE' });
  }
  if (aceitacao === 'pilha-vazia') docs.setPDAOptions({ acceptance: 'EMPTY_STACK' });
  const machineTab = getActiveDoc().automaton.kind !== 'fa';
  const limite = Number(p.get('limite'));
  if (machineTab && limite > 0) sim.setBaseLimits({ maxNodes: limite, maxSteps: limite });
  if (machineTab && p.get('arvore') === 'inteira') sim.setTreeAll(true);

  const palavra = p.get('palavra');
  if (palavra !== null) {
    sim.setTab('simulate');
    sim.load(palavra);
    const no = p.get('no');
    if (machineTab && no !== null) sim.focusNode(Number(no) || 0);
    const passo = p.get('passo');
    if (passo === 'fim') sim.last();
    else if (passo !== null) sim.goTo(Number(passo) || 0);
    if (p.get('tocar') === '1') sim.play();
  }

  if (machineTab && p.get('painel') === 'arvore') sim.setTab('tree');
  if (machineTab && p.get('amostras') === '1') {
    const samples = examplesSamples(getActiveDoc().id);
    if (samples) {
      sim.setTab('batch');
      sim.setBatchText(samplesToBatch(samples));
      sim.runBatch();
    }
  }
  if (p.get('painel') === 'lote') sim.setTab('batch');
  const lote = p.get('lote');
  if (lote !== null) {
    sim.setTab('batch');
    sim.setBatchText(lote);
    sim.runBatch();
  }
  const gerar = p.get('gerar');
  if (gerar !== null) {
    sim.setTab('batch');
    sim.setGenLength(Number(gerar) || 0);
    sim.generateBatch();
  }

  if (p.get('menu') === 'algoritmos') tools.requestMenu();
  const dialogo = p.get('dialogo');
  if (dialogo === 'exemplos') {
    const galeria = p.get('galeria');
    const section = galeria === 'af' ? 'fa' : galeria === 'ap' ? 'pda' : galeria === 'mt' ? 'tm' : undefined;
    tools.openDialog(section ? { kind: 'examples', section } : { kind: 'examples' });
  }
  else if (dialogo && DIALOGS[dialogo]) tools.openDialog({ kind: 'pick', algo: DIALOGS[dialogo], auto: p.get('comparar') === '1' });
}
