/**
 * CONTRATO do núcleo de Máquinas de Turing (MT), no modelo do Hopcroft
 * (cap. 8): M = (Q, Σ, Γ, δ, q0, B, F).
 *
 * Uma fita infinita para os dois lados e uma cabeça. Cada passo lê X, escreve
 * Y e move a cabeça uma célula: L (←) ou R (→). Regra "X / Y →".
 *
 * Aceitação:
 *  - FINAL_STATE (padrão, Hopcroft 8.2.5): aceita ASSIM QUE entra num estado
 *    final — a MT para ao aceitar. Se parar (nenhuma regra se aplica) fora de
 *    um estado final, rejeita.
 *  - HALT: aceita quando para, em qualquer estado. Serve para MT que calcula
 *    uma função (ex.: monus): a resposta é o que ficou na fita.
 *
 * Regras:
 *  - Só dados. Nada de cor, fonte, posição na tela ou React aqui.
 *  - Este arquivo é contrato: o resto do app depende dele, então mude com cuidado.
 *  - Todas as funções do núcleo são puras.
 */
import type { IDNode, Layout, RuleRef, StateId, Sym, TransitionId } from '../common';

export type { IDNode, IDStatus, Layout, RuleRef, StateId, Sym, TransitionId } from '../common';

/** Branco padrão (Hopcroft e YAAS usam B). */
export const DEFAULT_BLANK = 'B';

/** Limite padrão de passos de uma MT determinística. */
export const TM_DEFAULT_MAX_STEPS = 10000;

/** Limite padrão de IDs na árvore de uma MT não determinística. */
export const TM_DEFAULT_MAX_NODES = 5000;

export interface TMState {
  id: StateId;
  name: string;
  initial: boolean;
  final: boolean;
}

/** L = esquerda (←), R = direita (→). Hopcroft não tem "ficar parado". */
export type TMMove = 'L' | 'R';

/** Uma regra "X / Y D". Todo símbolo de fita tem exatamente 1 caractere. */
export interface TMRule {
  /** X: símbolo lido (pode ser o branco). EPSILON aqui é inválido. */
  read: Sym;
  /** Y: símbolo escrito no lugar de X (pode ser o branco). */
  write: Sym;
  move: TMMove;
}

/**
 * Uma seta de `from` para `to` com uma ou mais regras.
 * Invariante (garantida pela interface e pelo núcleo nas suas saídas):
 * no máximo UMA transição por par (from, to), sem regras repetidas.
 */
export interface TMTransition {
  id: TransitionId;
  from: StateId;
  to: StateId;
  rules: TMRule[];
}

export type TMAcceptance = 'FINAL_STATE' | 'HALT';

export interface TM {
  states: TMState[];
  transitions: TMTransition[];
  /** B: 1 caractere. */
  blank: Sym;
  acceptance: TMAcceptance;
  /**
   * Σ informado pelo usuário (1 caractere cada, sem o branco).
   * [] = não informado: o núcleo usa Γ − {B} como palpite (ver inputAlphabet()).
   */
  inputAlphabet: Sym[];
}

/** EMPTY = sem estados. NTM = algum (q, X) tem mais de uma regra. */
export type TMType = 'EMPTY' | 'DTM' | 'NTM';

/**
 * Configuração da MT. A fita é guardada como o MENOR trecho que contém todas
 * as células não brancas E a célula da cabeça.
 */
export interface TMConfig {
  state: StateId;
  /** O trecho da fita (1 caractere por célula). Nunca é ''. */
  tape: string;
  /** Posição da cabeça dentro de `tape`. */
  head: number;
  /**
   * Posição absoluta da célula tape[0]. A célula 0 é a 1ª letra da entrada
   * (ou a célula da cabeça, se a entrada for vazia). Serve para a fita não
   * "pular" na animação.
   */
  origin: number;
}

export interface TMStep {
  /** 0 = configuração inicial. */
  index: number;
  config: TMConfig;
  /** Regra usada para chegar aqui (null no passo 0). */
  via: RuleRef | null;
}

export type TMIDNode = IDNode<TMConfig>;

export type TMStopReason =
  /** FINAL_STATE: entrou num estado final (aceita e para). */
  | 'ACCEPTED_FINAL'
  /** Nenhuma regra se aplica: a MT parou. Em HALT isso aceita; em FINAL_STATE rejeita. */
  | 'HALTED'
  /** Repetiu uma configuração inteira (DTM) ou algum ramo entra em ciclo (NTM): nunca vai parar/aceitar. */
  | 'LOOP'
  /** Passou do limite de passos (DTM) ou de IDs (NTM) sem decidir. Pode decidir com mais passos. */
  | 'STEP_LIMIT'
  | 'NO_INITIAL_STATE'
  /** A palavra contém o símbolo branco. */
  | 'BLANK_IN_INPUT'
  /** Σ foi informado e a palavra tem um símbolo fora dele. */
  | 'SYMBOL_NOT_IN_ALPHABET';

export interface TMSimulateOptions {
  /** DTM: máximo de passos (padrão TM_DEFAULT_MAX_STEPS). */
  maxSteps?: number;
  /** NTM: máximo de IDs na árvore (padrão TM_DEFAULT_MAX_NODES). */
  maxNodes?: number;
  /** NTM: true = continua a busca depois de aceitar, para montar a árvore inteira (padrão false). */
  exploreAll?: boolean;
}

export interface TMSimulationResult {
  accepted: boolean;
  /** Modo usado (o `acceptance` da MT). */
  acceptance: TMAcceptance;
  stop: TMStopReason;
  /**
   * DTM: todos os passos, do 0 até onde parou (em STEP_LIMIT, até o limite).
   * NTM: o caminho da raiz até a ID que aceitou (ou, se não aceitou, até a ID
   * mais funda; empate: a primeira da busca em largura).
   * Vazio em NO_INITIAL_STATE; só o passo 0 em BLANK_IN_INPUT/SYMBOL_NOT_IN_ALPHABET.
   */
  steps: TMStep[];
  /**
   * Conteúdo da fita quando parou, sem os brancos das pontas ('' = fita toda
   * branca). Só quando stop é ACCEPTED_FINAL ou HALTED. É a "saída" de uma MT
   * que calcula função.
   */
  output?: string;
  /** Só para NTM: a árvore de IDs (busca em largura). */
  tree?: TMIDNode[];
  /** Só para NTM: true = a busca parou no limite de IDs (há nós UNEXPLORED por causa disso). */
  limitReached?: boolean;
  /**
   * true = em STEP_LIMIT, quem parou foi a proteção de memória (a fita
   * guardada ficou grande demais), não o `maxSteps`/`maxNodes`: simular com
   * um limite maior não adianta.
   */
  memoryLimit?: boolean;
  /** Só em LOOP de DTM: índice (em `steps`) da 1ª vez que a configuração repetida apareceu. */
  loopStart?: number;
  /** Posição (0-based) do símbolo problemático em BLANK_IN_INPUT / SYMBOL_NOT_IN_ALPHABET. */
  stoppedAt?: number;
}

/**
 * ID no formato do Hopcroft: X1…Xi−1 q Xi…Xn (o estado fica antes do símbolo
 * sob a cabeça). Ex.: "XX" + "q1" + "Y1" = XXq1Y1.
 */
export interface TMIDText {
  /** Fita à esquerda da cabeça, sem os brancos do começo. */
  left: string;
  /** Nome do estado. */
  state: string;
  /** Da cabeça em diante, sem os brancos do fim — mas a célula da cabeça sempre aparece. */
  right: string;
}

export interface TMFormalDefinition {
  /** Nomes dos estados (ordem natural). */
  states: string[];
  /** Σ (o informado, ou o palpite Γ − {B}), em ordem alfabética. */
  inputAlphabet: Sym[];
  /** true = Σ não foi informado e é só um palpite. */
  inputAlphabetGuessed: boolean;
  /** Γ (inclui B e Σ), em ordem alfabética com B por último. */
  tapeAlphabet: Sym[];
  /** Uma linha por (q, X) que tem destino: δ(q, X) = (p, Y, D) — mais de um destino só em NTM. */
  delta: Array<{ from: string; read: Sym; to: Array<{ state: string; write: Sym; move: TMMove }> }>;
  initial: string | null;
  blank: Sym;
  finals: string[];
  acceptance: TMAcceptance;
  type: TMType;
}

export type TMValidationIssue =
  | { kind: 'NO_INITIAL_STATE' }
  | { kind: 'MULTIPLE_INITIAL_STATES'; states: StateId[] }
  | { kind: 'DANGLING_TRANSITION'; transition: TransitionId }
  | { kind: 'DUPLICATE_NAME'; name: string; states: StateId[] }
  /** `read` não é exatamente 1 caractere (ou é ε). */
  | { kind: 'INVALID_READ'; transition: TransitionId; rule: number }
  /** `write` não é exatamente 1 caractere (ou é ε). */
  | { kind: 'INVALID_WRITE'; transition: TransitionId; rule: number }
  /** `move` não é 'L' nem 'R'. */
  | { kind: 'INVALID_MOVE'; transition: TransitionId; rule: number }
  /** O branco não é exatamente 1 caractere (ou é ε). */
  | { kind: 'INVALID_BLANK' }
  /** Σ contém o branco. */
  | { kind: 'BLANK_IN_INPUT_ALPHABET' }
  /** Σ contém algo que não é 1 caractere. */
  | { kind: 'INVALID_INPUT_SYMBOL'; symbol: string };

/** Exemplo pronto (galeria). */
export interface TMExample {
  id: string;
  name: string;
  description: string;
  tm: TM;
  layout: Layout;
  /** Palavras de teste com a resposta certa. `output` só para MT de aceitação por parada. */
  samples?: Array<{ word: string; accepted: boolean; output?: string }>;
}
