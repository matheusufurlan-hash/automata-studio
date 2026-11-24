/**
 * Lógica pura da simulação de AP e MT na tela (sem React):
 *  - a "rodada" (`MachineRun`): o resultado do núcleo + o caminho mostrado;
 *  - o destaque do canvas em cada passo (estado, seta e a regra usada);
 *  - a pilha (o que entrou e o que saiu), a fita da MT e a sequência de IDs;
 *  - os textos de cada passo e do resultado, em português simples.
 *
 * A simulação é calculada de uma vez (`simulate` do núcleo) e o painel só
 * anda pelo caminho: no AP, `path` (índices na árvore de IDs); na MT
 * determinística, `steps`; na MT não determinística, o caminho na árvore.
 * Clicar num nó da árvore troca o caminho mostrado (`focus`).
 */
import { EPSILON } from '../../core/common';
import type { IDNode, IDStatus, RuleRef, StateId } from '../../core/common';
import { formatConfig as formatPDAConfig, inputAlphabet as pdaInputAlphabet, simulate as simulatePDA } from '../../core/pda';
import { PDA_DEFAULT_MAX_NODES } from '../../core/pda/types';
import type { PDA, PDAConfig, PDARule, PDASimulationResult } from '../../core/pda/types';
import { formatConfig as formatTMConfig, inputAlphabet as tmInputAlphabet, simulate as simulateTM } from '../../core/tm';
import { TM_DEFAULT_MAX_STEPS } from '../../core/tm/types';
import type { TM, TMConfig, TMIDText, TMRule, TMSimulationResult } from '../../core/tm/types';
import type { HighlightData, HighlightStatus } from '../../store/highlight';
import { ARROW } from '../editor/rules';
import { formatSet } from '../ferramentas/format';

/* ------------------------------------------------------------------ */
/* Rodada                                                              */
/* ------------------------------------------------------------------ */

export interface RunLimits {
  /** AP e MT não determinística: máximo de IDs na árvore. */
  maxNodes: number;
  /** MT determinística: máximo de passos. */
  maxSteps: number;
  /** Continua a busca depois de aceitar, para montar a árvore inteira. */
  exploreAll: boolean;
}

export const DEFAULT_LIMITS: RunLimits = {
  maxNodes: PDA_DEFAULT_MAX_NODES,
  maxSteps: TM_DEFAULT_MAX_STEPS,
  exploreAll: false,
};

/** "Continuar"/"Buscar mais" não passam disto (a simulação roda na hora, sem travar muito). */
export const MAX_STEPS_CAP = 1_000_000;
export const MAX_NODES_CAP = 320_000;

interface RunBase {
  /** A palavra simulada (sem os ε digitados). */
  word: string;
  limits: RunLimits;
  /**
   * Caminho mostrado: índices na árvore de IDs, da raiz até a ID final.
   * null = MT determinística (o caminho são os `steps`).
   */
  path: number[] | null;
  /** Nó escolhido na árvore (null = o caminho que o núcleo devolveu). */
  focus: number | null;
}

export interface PDARun extends RunBase {
  kind: 'pda';
  pda: PDA;
  result: PDASimulationResult;
  path: number[];
}

export interface TMRun extends RunBase {
  kind: 'tm';
  tm: TM;
  result: TMSimulationResult;
}

export type MachineRun = PDARun | TMRun;

export type MachineAutomaton = { kind: 'pda'; pda: PDA } | { kind: 'tm'; tm: TM };

/** Índices da raiz até `index`. */
export function pathTo(tree: ReadonlyArray<{ parent: number | null }>, index: number): number[] {
  const out: number[] = [];
  for (let i: number | null = index; i !== null && tree[i]; i = tree[i]!.parent) out.push(i);
  return out.reverse();
}

/** O caminho da MT não determinística, como índices na árvore (o mesmo de `steps`). */
export function ntmPath(result: TMSimulationResult): number[] {
  const tree = result.tree ?? [];
  if (tree.length === 0) return [];
  let target = result.accepted ? tree.findIndex((n) => n.status === 'ACCEPTING') : -1;
  if (target < 0) {
    target = 0;
    for (const n of tree) if (n.depth > tree[target]!.depth) target = n.index;
  }
  return pathTo(tree, target);
}

/** Simula a palavra no AP ou na MT e monta a rodada (caminho padrão, sem foco). */
export function runMachine(a: MachineAutomaton, word: string, limits: RunLimits = DEFAULT_LIMITS): MachineRun {
  if (a.kind === 'pda') {
    const result = simulatePDA(a.pda, word, { maxNodes: limits.maxNodes, exploreAll: limits.exploreAll });
    return { kind: 'pda', pda: a.pda, word, limits, result, path: result.path, focus: null };
  }
  const result = simulateTM(a.tm, word, {
    maxSteps: limits.maxSteps,
    maxNodes: limits.maxNodes,
    exploreAll: limits.exploreAll,
  });
  return { kind: 'tm', tm: a.tm, word, limits, result, path: result.tree ? ntmPath(result) : null, focus: null };
}

/** A mesma rodada, mostrando o caminho até o nó `node` da árvore (null = o caminho padrão). */
export function withFocus(run: MachineRun, node: number | null): MachineRun {
  const tree = treeOf(run);
  if (!tree || (node !== null && !tree[node])) return run;
  if (node === null) {
    if (run.kind === 'pda') return { ...run, focus: null, path: run.result.path };
    return { ...run, focus: null, path: ntmPath(run.result) };
  }
  const path = pathTo(tree, node);
  return run.kind === 'pda' ? { ...run, focus: node, path } : { ...run, focus: node, path };
}

/** A árvore de IDs (AP e MT não determinística); null na MT determinística. */
export function treeOf(run: MachineRun): ReadonlyArray<IDNode<PDAConfig | TMConfig>> | null {
  if (run.kind === 'pda') return run.result.tree;
  return run.result.tree ?? null;
}

/** Quantas IDs o caminho mostrado tem (0 = nem começou, ex.: sem estado inicial). */
export function stepCount(run: MachineRun | null): number {
  if (!run) return 0;
  if (run.path) return run.path.length;
  return run.kind === 'tm' ? run.result.steps.length : 0;
}

export function lastIndex(run: MachineRun | null): number {
  return stepCount(run) - 1;
}

export function clampIndex(run: MachineRun | null, step: number): number {
  const last = lastIndex(run);
  if (last < 0) return -1;
  return Math.max(0, Math.min(last, Math.trunc(step)));
}

export function isRunFinished(run: MachineRun | null, step: number): boolean {
  if (!run) return false;
  return stepCount(run) === 0 || step >= lastIndex(run);
}

/** Nó da árvore no passo `i` do caminho (null na MT determinística). */
export function nodeIndexAt(run: MachineRun, i: number): number | null {
  return run.path ? (run.path[i] ?? null) : null;
}

export function pdaConfigAt(run: PDARun, i: number): PDAConfig {
  return run.result.tree[run.path[i]!]!.config;
}

export function tmConfigAt(run: TMRun, i: number): TMConfig {
  if (run.path) return run.result.tree![run.path[i]!]!.config;
  return run.result.steps[i]!.config;
}

export function viaAt(run: MachineRun, i: number): RuleRef | null {
  if (run.kind === 'pda') return run.result.tree[run.path[i]!]?.via ?? null;
  if (run.path) return run.result.tree![run.path[i]!]?.via ?? null;
  return run.result.steps[i]?.via ?? null;
}

export function stateAt(run: MachineRun, i: number): StateId {
  return run.kind === 'pda' ? pdaConfigAt(run, i).state : tmConfigAt(run, i).state;
}

/** Nome do estado (cai no id se ele não existir). */
export function stateName(a: { states: ReadonlyArray<{ id: StateId; name: string }> }, id: StateId): string {
  return a.states.find((s) => s.id === id)?.name ?? id;
}

export function pdaRuleOf(pda: PDA, via: RuleRef): { rule: PDARule; from: StateId; to: StateId } | null {
  const t = pda.transitions.find((x) => x.id === via.transition);
  const rule = t?.rules[via.rule];
  return t && rule ? { rule, from: t.from, to: t.to } : null;
}

export function tmRuleOf(tm: TM, via: RuleRef): { rule: TMRule; from: StateId; to: StateId } | null {
  const t = tm.transitions.find((x) => x.id === via.transition);
  const rule = t?.rules[via.rule];
  return t && rule ? { rule, from: t.from, to: t.to } : null;
}

/* ------------------------------------------------------------------ */
/* Resultado                                                           */
/* ------------------------------------------------------------------ */

/** accepted/rejected = decidiu; loop = nunca para; undecided = parou no limite. */
export type VerdictTone = 'accepted' | 'rejected' | 'loop' | 'undecided';

export const VERDICT_LABEL: Record<VerdictTone, string> = {
  accepted: 'ACEITA',
  rejected: 'REJEITA',
  loop: 'NÃO PARA',
  undecided: 'INDEFINIDO',
};

export interface Verdict {
  tone: VerdictTone;
  /** Título curto em negrito, ex.: "Por estado final". */
  title: string;
  /** Uma ou duas frases que explicam o resultado. */
  text: string;
  /** Saída da MT (aceitação por parada): o que ficou na fita. */
  output?: string;
  /** Botão para continuar a busca (limite atingido). */
  more?: { label: string; hint: string };
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;
const showWord = (w: string) => (w === '' ? EPSILON : w);

/** Símbolo da palavra na posição `pos` (0-based). */
function symbolAt(word: string, pos: number): string {
  return Array.from(word)[pos] ?? '?';
}

/** ID do AP no formato do livro, encurtando palavras e pilhas muito longas. */
export function pdaIdText(pda: PDA, c: PDAConfig, max = 18): string {
  return formatPDAConfig(pda, { state: c.state, remaining: elide(c.remaining, max, 0), stack: elide(c.stack, max, 2) });
}

/** ID da MT (X1…Xi−1 q Xi…Xn) em partes, encurtando os lados muito longos. */
export function tmIdParts(tm: TM, c: TMConfig, max = 14): TMIDText {
  const t = formatTMConfig(tm, c);
  return { left: elideStart(t.left, max), state: t.state, right: elide(t.right, max, 0) };
}

export function tmIdText(tm: TM, c: TMConfig, max = 14): string {
  const t = tmIdParts(tm, c, max);
  return `${t.left}${t.state}${t.right}`;
}

/** "abcdefgh…yz": corta o meio de textos longos, guardando `keepEnd` caracteres do fim. */
export function elide(s: string, max: number, keepEnd: number): string {
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  const head = Math.max(1, max - keepEnd - 1);
  return `${chars.slice(0, head).join('')}…${keepEnd > 0 ? chars.slice(chars.length - keepEnd).join('') : ''}`;
}

/** "…xyz": guarda o FIM de textos longos (o lado esquerdo da fita, perto da cabeça). */
export function elideStart(s: string, max: number): string {
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  return `…${chars.slice(chars.length - (max - 1)).join('')}`;
}

/** Por que o ramo terminou nesta ID do AP (frase curta). */
/**
 * Como o ramo terminou nesta ID do AP. A frase começa com um verbo, para
 * caber depois de "O caminho que mais avançou" ou de "Este ramo".
 */
function pdaEndText(run: PDARun, nodeIndex: number): string {
  const pda = run.pda;
  const node = run.result.tree[nodeIndex]!;
  const c = node.config;
  const id = pdaIdText(pda, c);
  const q = stateName(pda, c.state);
  const total = Array.from(run.word).length;
  const read = total - Array.from(c.remaining).length;
  const what = pda.acceptance === 'EMPTY_STACK' ? 'esvazia a pilha' : 'leva a um estado final';
  switch (node.status) {
    case 'ACCEPTING':
      return pda.acceptance === 'EMPTY_STACK'
        ? `terminou em ${id}: leu a palavra toda e a pilha ficou vazia`
        : `terminou em ${id}: leu a palavra toda e ${q} é final`;
    case 'REPEATED':
      return `chegou em ${id}, que já tinha aparecido antes na árvore (não é expandida de novo)`;
    case 'UNEXPLORED':
      return `parou em ${id}: a busca acabou antes de expandir esta ID`;
    case 'EXPANDED':
      return read < total
        ? `leu ${read} de ${total} símbolos e chegou em ${id}; dali só há movimentos ε, e nenhum deles consegue ler ${symbolAt(c.remaining, 0)}`
        : `leu a palavra toda e chegou em ${id}, mas dali nenhum movimento ε ${what}`;
    case 'DEAD':
    default: {
      if (c.remaining === '') {
        return pda.acceptance === 'EMPTY_STACK'
          ? `leu a palavra toda e parou em ${id}, mas a pilha não esvaziou`
          : `leu a palavra toda e parou em ${id}, mas ${q} não é final`;
      }
      const a = symbolAt(c.remaining, 0);
      if (c.stack === '') return `parou em ${id}: a pilha esvaziou e, sem topo, nenhuma regra se aplica`;
      const x = symbolAt(c.stack, 0);
      return `leu ${read} de ${total} símbolos e parou em ${id}: nenhuma regra de ${q} lê ${a} (nem ε) com ${x} no topo`;
    }
  }
}

export function pdaVerdict(run: PDARun): Verdict {
  const r = run.result;
  const pda = run.pda;
  if (r.accepted) {
    const end = run.path[run.path.length - 1] ?? 0;
    return {
      tone: 'accepted',
      title: pda.acceptance === 'EMPTY_STACK' ? 'Por pilha vazia' : 'Por estado final',
      text: pdaEndText(run, end),
    };
  }
  switch (r.reason) {
    case 'NO_INITIAL_STATE':
      return {
        tone: 'rejected',
        title: 'Sem estado inicial',
        text: 'o AP não tem estado inicial: marque um estado como inicial para simular',
      };
    case 'SYMBOL_NOT_IN_ALPHABET': {
      const pos = r.stoppedAt ?? 0;
      return {
        tone: 'rejected',
        title: 'Símbolo que nenhuma regra lê',
        text: `nenhuma regra lê o símbolo '${symbolAt(run.word, pos)}' (posição ${pos + 1}); o AP lê Σ = ${formatSet(pdaInputAlphabet(pda), ', ')}`,
      };
    }
    case 'LIMIT_REACHED': {
      const n = r.tree.length;
      if (r.memoryLimit) {
        return {
          tone: 'undecided',
          title: 'Parei para não acabar a memória',
          text: `as pilhas da busca ficaram grandes demais (o AP parece empilhar sem parar, por exemplo num ciclo de ε): parei depois de ${plural(n, 'descrição instantânea', 'descrições instantâneas')} sem aceitar, e uma busca maior daria o mesmo resultado`,
        };
      }
      return {
        tone: 'undecided',
        title: 'Busca interrompida',
        text: `parei depois de ${plural(n, 'descrição instantânea', 'descrições instantâneas')} sem aceitar; pode ser que aceite com uma busca maior`,
        more:
          run.limits.maxNodes < MAX_NODES_CAP
            ? { label: 'Buscar mais', hint: `procura em até ${plural(Math.min(run.limits.maxNodes * 4, MAX_NODES_CAP), 'ID', 'IDs')}` }
            : undefined,
      };
    }
    case 'NO_ACCEPTING_PATH':
    default: {
      const end = run.path[run.path.length - 1] ?? 0;
      return {
        tone: 'rejected',
        title: 'Nenhum caminho aceita',
        text: `todos morreram ou se repetiram. O que mais avançou ${pdaEndText(run, end)}`,
      };
    }
  }
}

export function tmVerdict(run: TMRun): Verdict {
  const r = run.result;
  const tm = run.tm;
  const steps = r.steps;
  const last = steps[steps.length - 1];
  const n = Math.max(0, steps.length - 1);
  const ntm = !!r.tree;
  const lastState = last ? stateName(tm, last.config.state) : '?';
  const under = last ? Array.from(last.config.tape)[last.config.head] ?? tm.blank : tm.blank;
  switch (r.stop) {
    case 'ACCEPTED_FINAL':
      return {
        tone: 'accepted',
        title: 'Entrou num estado final',
        text: `entrou em ${lastState}, que é final: a MT para e aceita (${plural(n, 'passo', 'passos')})`,
      };
    case 'HALTED':
      if (r.accepted) {
        return {
          tone: 'accepted',
          title: 'Parou (aceitação por parada)',
          text: `parou em ${lastState}: não há regra de ${lastState} lendo ${under} (${plural(n, 'passo', 'passos')})`,
          output: r.output ?? '',
        };
      }
      return {
        tone: 'rejected',
        title: 'Parou fora de um estado final',
        text: ntm
          ? `todos os ramos pararam sem entrar num estado final. O mais longo parou em ${lastState}, lendo ${under}`
          : `parou em ${lastState}, que não é final: não há regra de ${lastState} lendo ${under}`,
      };
    case 'LOOP':
      return {
        tone: 'loop',
        title: 'Laço',
        text: ntm
          ? 'nenhum ramo aceita e algum ramo entra em ciclo (uma ID se repete): a MT nunca para nesse ramo'
          : `a configuração do passo ${r.loopStart ?? 0} se repetiu no último passo (${n}): a MT nunca vai parar`,
      };
    case 'STEP_LIMIT': {
      if (r.memoryLimit) {
        const what = ntm
          ? `${plural(r.tree?.length ?? 0, 'descrição instantânea', 'descrições instantâneas')} na árvore`
          : plural(n, 'passo', 'passos');
        return {
          tone: 'undecided',
          title: 'Parei para não acabar a memória',
          text: `a fita guardada ficou grande demais (a MT parece escrever sem parar enquanto anda): parei depois de ${what} sem decidir, e simular com um limite maior daria o mesmo resultado`,
        };
      }
      if (ntm) {
        const nodes = r.tree?.length ?? 0;
        return {
          tone: 'undecided',
          title: 'Busca interrompida',
          text: `parei depois de ${plural(nodes, 'descrição instantânea', 'descrições instantâneas')} na árvore sem decidir; pode ser que aceite com uma busca maior`,
          more:
            run.limits.maxNodes < MAX_NODES_CAP
              ? { label: 'Buscar mais', hint: `procura em até ${plural(Math.min(run.limits.maxNodes * 4, MAX_NODES_CAP), 'ID', 'IDs')}` }
              : undefined,
        };
      }
      const next = Math.min(run.limits.maxSteps * 10, MAX_STEPS_CAP);
      return {
        tone: 'undecided',
        title: 'Limite de passos',
        text: `parei depois de ${plural(n, 'passo', 'passos')} sem decidir; pode ser que a MT pare com mais passos`,
        more:
          run.limits.maxSteps < MAX_STEPS_CAP
            ? { label: 'Continuar', hint: `simula de novo, com até ${plural(next, 'passo', 'passos')}${next >= MAX_STEPS_CAP ? ' (pode demorar alguns segundos)' : ''}` }
            : undefined,
      };
    }
    case 'NO_INITIAL_STATE':
      return {
        tone: 'rejected',
        title: 'Sem estado inicial',
        text: 'a MT não tem estado inicial: marque um estado como inicial para simular',
      };
    case 'BLANK_IN_INPUT': {
      const pos = r.stoppedAt ?? 0;
      return {
        tone: 'rejected',
        title: 'Branco na entrada',
        text: `a palavra tem o branco ${tm.blank} na posição ${pos + 1}: a entrada não pode ter o símbolo branco`,
      };
    }
    case 'SYMBOL_NOT_IN_ALPHABET':
    default: {
      const pos = r.stoppedAt ?? 0;
      return {
        tone: 'rejected',
        title: 'Símbolo fora do alfabeto',
        text: `o símbolo '${symbolAt(run.word, pos)}' (posição ${pos + 1}) não está em Σ = ${formatSet(tmInputAlphabet(tm), ', ')}`,
      };
    }
  }
}

export function machineVerdict(run: MachineRun): Verdict {
  return run.kind === 'pda' ? pdaVerdict(run) : tmVerdict(run);
}

const NODE_TONE: Record<IDStatus, VerdictTone> = {
  ACCEPTING: 'accepted',
  DEAD: 'rejected',
  REPEATED: 'loop',
  EXPANDED: 'undecided',
  UNEXPLORED: 'undecided',
};

/** Texto do fim de um ramo escolhido na árvore (foco). */
export function focusText(run: MachineRun): { tone: VerdictTone; text: string } | null {
  if (run.focus === null) return null;
  const tree = treeOf(run);
  const node = tree?.[run.focus];
  if (!tree || !node) return null;
  if (run.kind === 'pda') return { tone: NODE_TONE[node.status], text: `Este ramo ${pdaEndText(run, run.focus)}` };
  const c = node.config as TMConfig;
  const q = stateName(run.tm, c.state);
  const text: Record<IDStatus, string> = {
    ACCEPTING:
      run.tm.acceptance === 'HALT' ? `Este ramo parou em ${q} e aceita (por parada)` : `Este ramo entrou em ${q}, que é final: aceita`,
    DEAD: `Este ramo parou em ${q}, que não é final: rejeita`,
    REPEATED: 'Este ramo chegou numa ID que já tinha aparecido antes (não é expandida de novo)',
    EXPANDED: 'Este ramo continua: a ID tem filhas na árvore',
    UNEXPLORED: 'A busca parou antes de expandir esta ID',
  };
  return { tone: NODE_TONE[node.status], text: text[node.status] };
}

/* ------------------------------------------------------------------ */
/* Destaque do canvas                                                  */
/* ------------------------------------------------------------------ */

export const NO_MACHINE_HIGHLIGHT: HighlightData = {
  active: [],
  viaEpsilon: [],
  transitions: [],
  rules: [],
  status: 'idle',
};

const TONE_STATUS: Record<VerdictTone, HighlightStatus> = {
  accepted: 'accepted',
  rejected: 'rejected',
  loop: 'running',
  undecided: 'running',
};

/** Cor do fim do caminho: a do resultado ou, com um nó escolhido na árvore, a do nó. */
export function endTone(run: MachineRun): VerdictTone {
  const f = focusText(run);
  return f ? f.tone : machineVerdict(run).tone;
}

/** Tom da fita/pilha/IDs no passo `step`: 'running' até o fim; no fim, o do resultado. */
export function stepTone(run: MachineRun | null, step: number): 'running' | VerdictTone {
  if (!run) return 'running';
  return isRunFinished(run, step) ? endTone(run) : 'running';
}

/** Estado, seta e regra do passo `step` (no fim, com a cor do resultado). */
export function machineHighlight(run: MachineRun | null, step: number): HighlightData {
  const n = stepCount(run);
  if (!run || n === 0) return NO_MACHINE_HIGHLIGHT;
  const i = clampIndex(run, step);
  const via = viaAt(run, i);
  const status: HighlightStatus = i === n - 1 ? TONE_STATUS[endTone(run)] : 'running';
  return {
    active: [stateAt(run, i)],
    viaEpsilon: [],
    transitions: via ? [via.transition] : [],
    rules: via ? [via] : [],
    status,
  };
}

/* ------------------------------------------------------------------ */
/* Explicação do passo                                                 */
/* ------------------------------------------------------------------ */

export interface MachineStepText {
  title: string;
  /** δ do livro: "(q0, 0Z) ∈ δ(q0, 0, Z)" ou "δ(q0, 0) = (q1, X, →)". */
  formula: string;
  /** O movimento no formato do livro: "(q0, 0110, Z) ⊢ (q0, 110, 0Z)". */
  move?: string;
  /** Frase curta, ex.: "empilhou 0 (o Z continua embaixo)". */
  note?: string;
  /** Regra usada, no formato da seta (para o selo). */
  rule?: string;
}

/** O que a regra "a, X/γ" fez com a pilha. */
export function stackEffect(rule: PDARule): string {
  const x = rule.pop;
  const g = rule.push;
  if (g === '') return `tirou ${x} do topo (desempilhou)`;
  if (g === x) return `a pilha não mudou (tirou ${x} e pôs ${x} de volta)`;
  const chars = Array.from(g);
  if (chars.length > 1 && chars[chars.length - 1] === x) {
    const added = chars.slice(0, -1).join('');
    return `empilhou ${added} em cima do ${x}${added.length > 1 ? ` (${chars[0]} fica no topo)` : ''}`;
  }
  return `trocou ${x} por ${g}${chars.length > 1 ? ` (${chars[0]} fica no topo)` : ''}`;
}

export function pdaStepText(run: PDARun, step: number): MachineStepText | null {
  const n = stepCount(run);
  if (n === 0) return null;
  const i = clampIndex(run, step);
  const pda = run.pda;
  const c = pdaConfigAt(run, i);
  if (i === 0) {
    return {
      title: 'Início',
      formula: pdaIdText(pda, c),
      note: `o AP começa em ${stateName(pda, c.state)}, com a palavra toda para ler e só ${pda.startStackSymbol} na pilha`,
    };
  }
  const prev = pdaConfigAt(run, i - 1);
  const via = viaAt(run, i);
  const used = via ? pdaRuleOf(pda, via) : null;
  const move = `${pdaIdText(pda, prev, 12)} ⊢ ${pdaIdText(pda, c, 12)}`;
  if (!used) return { title: `Passo ${i}`, formula: move };
  const { rule } = used;
  const q = stateName(pda, prev.state);
  const p = stateName(pda, c.state);
  const a = rule.read;
  return {
    title: a === EPSILON ? 'Movimento ε (não lê nada)' : `Leu '${a}'`,
    formula: `(${p}, ${rule.push || EPSILON}) ∈ δ(${q}, ${a}, ${rule.pop})`,
    move,
    note: stackEffect(rule),
    rule: `${a}, ${rule.pop}/${rule.push || EPSILON}`,
  };
}

export function tmStepText(run: TMRun, step: number): MachineStepText | null {
  const n = stepCount(run);
  if (n === 0) return null;
  const i = clampIndex(run, step);
  const tm = run.tm;
  const c = tmConfigAt(run, i);
  if (i === 0) {
    return {
      title: 'Início',
      formula: tmIdText(tm, c),
      note:
        run.word === ''
          ? `a fita está toda em branco e a MT começa em ${stateName(tm, c.state)}`
          : `a cabeça começa na 1ª letra da palavra, em ${stateName(tm, c.state)}`,
    };
  }
  const prev = tmConfigAt(run, i - 1);
  const via = viaAt(run, i);
  const used = via ? tmRuleOf(tm, via) : null;
  const move = `${tmIdText(tm, prev, 10)} ⊢ ${tmIdText(tm, c, 10)}`;
  if (!used) return { title: `Passo ${i}`, formula: move };
  const { rule } = used;
  const q = stateName(tm, prev.state);
  const p = stateName(tm, c.state);
  const arrow = ARROW[rule.move];
  const delta = run.path ? `(${p}, ${rule.write}, ${arrow}) ∈ δ(${q}, ${rule.read})` : `δ(${q}, ${rule.read}) = (${p}, ${rule.write}, ${arrow})`;
  return {
    title: `Leu ${rule.read}, escreveu ${rule.write} e foi para a ${rule.move === 'R' ? 'direita' : 'esquerda'}`,
    formula: delta,
    move,
    rule: `${rule.read}/${rule.write} ${arrow}`,
  };
}

export function machineStepText(run: MachineRun, step: number): MachineStepText | null {
  return run.kind === 'pda' ? pdaStepText(run, step) : tmStepText(run, step);
}

/* ------------------------------------------------------------------ */
/* Pilha                                                               */
/* ------------------------------------------------------------------ */

export interface StackCell {
  /** Estável enquanto o símbolo fica na mesma altura (para a animação). */
  key: string;
  sym: string;
  /** Acabou de entrar (empilhado neste passo). */
  pushed: boolean;
  /** O fundo da pilha é o Z0. */
  bottom: boolean;
}

export interface StackView {
  /** Do TOPO para o fundo. Pilha grande: só o topo e o fundo (ver `hidden`). */
  cells: StackCell[];
  /** Quantos símbolos do meio estão escondidos (entre o último do topo e o fundo). */
  hidden: number;
  /** Símbolos que saíram neste passo (do topo para baixo). */
  popped: string[];
  size: number;
}

/**
 * A pilha `cur` (topo primeiro). Com `prev` (a pilha do passo anterior), marca
 * o que entrou e o que saiu: a parte de baixo em comum fica parada.
 */
export function stackView(prev: string | null, cur: string, z0: string, maxVisible = 7): StackView {
  const now = Array.from(cur);
  const before = prev === null ? null : Array.from(prev);
  let common = now.length;
  if (before) {
    common = 0;
    while (
      common < now.length &&
      common < before.length &&
      now[now.length - 1 - common] === before[before.length - 1 - common]
    ) {
      common++;
    }
  }
  const pushedCount = now.length - common;
  const popped = before ? before.slice(0, before.length - common) : [];
  const all: StackCell[] = now.map((sym, i) => ({
    key: `${now.length - i}:${sym}`,
    sym,
    pushed: i < pushedCount,
    bottom: i === now.length - 1 && sym === z0,
  }));
  if (all.length <= maxVisible) return { cells: all, hidden: 0, popped, size: all.length };
  const top = Math.max(1, maxVisible - 2);
  return { cells: [...all.slice(0, top), all[all.length - 1]!], hidden: all.length - top - 1, popped, size: all.length };
}

/* ------------------------------------------------------------------ */
/* Entrada do AP (fita da palavra)                                     */
/* ------------------------------------------------------------------ */

/** Quantos símbolos da palavra o AP já leu no passo `step`. */
export function pdaConsumed(run: PDARun, step: number): number {
  if (stepCount(run) === 0) return 0;
  const c = pdaConfigAt(run, clampIndex(run, step));
  return Array.from(run.word).length - Array.from(c.remaining).length;
}

/* ------------------------------------------------------------------ */
/* Fita da MT                                                          */
/* ------------------------------------------------------------------ */

export interface TapeWindowCell {
  /** Posição absoluta (a célula 0 é a 1ª letra da entrada). */
  pos: number;
  sym: string;
  blank: boolean;
}

/** Posição absoluta da cabeça. */
export function headPos(c: TMConfig): number {
  return c.origin + c.head;
}

/** Símbolo na posição absoluta `pos` (branco fora do trecho guardado). */
export function cellAt(cells: readonly string[], c: TMConfig, pos: number, blank: string): string {
  const i = pos - c.origin;
  return i >= 0 && i < cells.length ? cells[i]! : blank;
}

/** As células de `from` até `to` (posições absolutas, inclusive). */
export function tapeWindow(c: TMConfig, from: number, to: number, blank: string): TapeWindowCell[] {
  const cells = Array.from(c.tape);
  const out: TapeWindowCell[] = [];
  for (let pos = from; pos <= to; pos++) {
    const sym = cellAt(cells, c, pos, blank);
    out.push({ pos, sym, blank: sym === blank });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sequência de IDs (com ⊢)                                            */
/* ------------------------------------------------------------------ */

/** Janela de passos em volta do atual (a sequência de uma MT pode ter 10000 IDs). */
export function idWindow(total: number, step: number, radius = 40): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: -1 };
  const s = Math.max(0, Math.min(total - 1, step));
  let start = Math.max(0, s - radius);
  let end = Math.min(total - 1, s + radius);
  // perto das pontas: usa o espaço que sobra do outro lado
  if (s - start < radius) end = Math.min(total - 1, end + (radius - (s - start)));
  if (end - s < radius) start = Math.max(0, start - (radius - (end - s)));
  return { start, end };
}

export interface IDItem {
  index: number;
  /** AP: o texto da ID. MT: as partes (o estado é destacado). */
  text?: string;
  parts?: TMIDText;
  /** Regra usada para chegar aqui (dica ao passar o mouse). */
  rule?: string;
  /** Status do nó na árvore (AP/MTN). */
  status?: IDStatus;
}

export function idItem(run: MachineRun, i: number): IDItem {
  const via = viaAt(run, i);
  const node = nodeIndexAt(run, i);
  const status = node !== null ? treeOf(run)?.[node]?.status : undefined;
  if (run.kind === 'pda') {
    const used = via ? pdaRuleOf(run.pda, via) : null;
    return {
      index: i,
      text: pdaIdText(run.pda, pdaConfigAt(run, i)),
      rule: used ? `${used.rule.read}, ${used.rule.pop}/${used.rule.push || EPSILON}` : undefined,
      status,
    };
  }
  const used = via ? tmRuleOf(run.tm, via) : null;
  return {
    index: i,
    parts: tmIdParts(run.tm, tmConfigAt(run, i)),
    rule: used ? `${used.rule.read}/${used.rule.write} ${ARROW[used.rule.move]}` : undefined,
    status,
  };
}

/** A palavra para mostrar (vazia = ε). */
export { showWord };
