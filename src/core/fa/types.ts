/**
 * CONTRATO do núcleo de Autômatos Finitos.
 *
 * Regras:
 *  - Só dados. Nada de cor, fonte, posição na tela ou React aqui.
 *  - Este arquivo é contrato: o resto do app depende dele, então mude com cuidado.
 *  - Todas as funções do núcleo são puras: recebem um FA e devolvem um FA NOVO,
 *    sem modificar o que receberam.
 */

/** Símbolo da cadeia vazia. É o único símbolo "especial" de uma transição. */
export const EPSILON = 'ε' as const;

export type StateId = string;
export type TransitionId = string;

/** Um símbolo do alfabeto: exatamente 1 caractere (ou EPSILON numa transição). */
export type Sym = string;

export interface FAState {
  id: StateId;
  /** Nome mostrado na tela, ex.: "q0" ou "{q0,q1}". */
  name: string;
  initial: boolean;
  final: boolean;
}

/**
 * Uma seta de `from` para `to` com um ou mais símbolos.
 * Invariante (garantida pela interface e pelo núcleo nas suas saídas):
 * no máximo UMA transição por par (from, to). O núcleo deve aceitar entradas
 * com pares repetidos mesmo assim (trata como a união dos símbolos).
 */
export interface FATransition {
  id: TransitionId;
  from: StateId;
  to: StateId;
  /** Sem repetição. Pode conter EPSILON. */
  symbols: Sym[];
}

export interface FA {
  states: FAState[];
  transitions: FATransition[];
}

/** EMPTY = sem estados. */
export type FAType = 'EMPTY' | 'DFA' | 'NFA' | 'ENFA';

/* ------------------------------------------------------------------ */
/* Desenho (fica FORA do FA de propósito)                              */
/* ------------------------------------------------------------------ */

export interface Point {
  x: number;
  y: number;
}

export interface EdgeLayout {
  /**
   * 0 = reta. Valor RELATIVO (não é pixel): deslocamento do meio da curva em
   * relação ao meio da reta, dividido pela distância entre os centros dos estados.
   * Positivo = curva para a ESQUERDA de quem anda de `from` para `to`
   * (em coordenadas de tela, y para baixo). Ex.: 0.2 = curva suave.
   */
  curvature: number;
  /** Para laços (from === to): graus, 0 = laço em cima, sentido horário. */
  loopAngle?: number;
}

export interface Layout {
  /** CENTRO de cada estado, em pixels do canvas (y para baixo). */
  positions: Record<StateId, Point>;
  edges: Record<TransitionId, EdgeLayout>;
}

/** Formato do arquivo salvo (.automato.json). */
export interface AutomatonFile {
  format: 'automatos-studio';
  version: 1;
  kind: 'fa';
  name: string;
  fa: FA;
  layout: Layout;
}

/* ------------------------------------------------------------------ */
/* Resultados das funções do núcleo                                    */
/* ------------------------------------------------------------------ */

export interface SimulationStep {
  /** 0 = antes de ler qualquer símbolo. */
  index: number;
  /** Símbolo lido para chegar neste passo (null no passo 0). */
  read: Sym | null;
  /** Parte da palavra já lida. */
  consumed: string;
  /** Parte da palavra que falta ler. */
  remaining: string;
  /** Estados ativos neste passo, JÁ incluindo o fecho-ε. Ordenados por nome. */
  active: StateId[];
  /** Quais dos `active` só entraram por causa do fecho-ε (para destacar na tela). */
  viaEpsilon: StateId[];
  /**
   * Transições usadas para chegar neste passo, incluindo as ε do fecho.
   * No passo 0: só as transições ε do fecho do estado inicial (pode ser vazio).
   */
  usedTransitions: TransitionId[];
}

export type RejectReason =
  | 'NO_INITIAL_STATE'        // autômato sem estado inicial
  | 'SYMBOL_NOT_IN_ALPHABET'  // a palavra tem um símbolo que nenhuma transição usa
  | 'DEAD_END'                // em algum passo o conjunto de estados ativos ficou vazio
  | 'ENDED_IN_NON_FINAL';     // leu tudo, mas nenhum estado ativo é final

export interface SimulationResult {
  accepted: boolean;
  /**
   * Passos da simulação. Vazio quando reason === 'NO_INITIAL_STATE'.
   * Em DEAD_END, o último passo vem com `active` vazio (mostra o símbolo que matou).
   */
  steps: SimulationStep[];
  /** Só quando accepted === false. */
  reason?: RejectReason;
  /** Posição (0-based) do símbolo onde parou, para DEAD_END e SYMBOL_NOT_IN_ALPHABET. */
  stoppedAt?: number;
}

export interface DeterminizeResult {
  dfa: FA;
  /** id do estado novo -> ids dos estados originais que ele representa. */
  subsets: Record<StateId, StateId[]>;
}

/** Um par marcado como distinguível na tabela de minimização. */
export interface MarkedPair {
  pair: [StateId, StateId];
  /** Símbolo que distinguiu (null na rodada 0: final × não final). */
  symbol: Sym | null;
  /** Par já marcado que causou esta marcação (null na rodada 0). */
  because: [StateId, StateId] | null;
}

export interface MinimizationRound {
  /** 0 = final × não final; 1, 2, ... = rodadas seguintes. */
  round: number;
  newlyMarked: MarkedPair[];
}

export interface MinimizationResult {
  /** AFD mínimo. */
  dfa: FA;
  /** O AFD (completo, só com estados alcançáveis) usado como entrada da tabela. */
  input: FA;
  table: {
    /** Ordem dos estados de `input` para desenhar a tabela em escada. */
    order: StateId[];
    rounds: MinimizationRound[];
    /** Grupos de estados equivalentes de `input`; cada grupo vira um estado do mínimo. */
    groups: StateId[][];
  };
  /** id do estado do mínimo -> ids dos estados de `input` que ele junta. */
  merged: Record<StateId, StateId[]>;
}

export interface FormalDefinition {
  /** Nomes dos estados. */
  states: string[];
  /** Σ, sem ε, ordenado. */
  alphabet: Sym[];
  /** Uma linha por (estado, símbolo) que tem destino. Inclui ε se houver. */
  delta: Array<{ from: string; symbol: Sym; to: string[] }>;
  initial: string | null;
  finals: string[];
  type: FAType;
}

export interface EquivalenceResult {
  equivalent: boolean;
  /** Menor palavra aceita por um e rejeitada pelo outro (quando não são equivalentes). */
  counterexample?: string;
}

export type ValidationIssue =
  | { kind: 'NO_INITIAL_STATE' }
  | { kind: 'MULTIPLE_INITIAL_STATES'; states: StateId[] }
  | { kind: 'INVALID_SYMBOL'; transition: TransitionId; symbol: string }
  | { kind: 'DANGLING_TRANSITION'; transition: TransitionId }
  | { kind: 'DUPLICATE_NAME'; name: string; states: StateId[] };
