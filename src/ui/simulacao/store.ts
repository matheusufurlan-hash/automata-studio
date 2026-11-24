/**
 * Estado do painel de simulação (só da interface; não vai para o arquivo).
 *
 * - A simulação inteira é calculada de uma vez (`simulate`) e o painel só
 *   anda pelos passos; cada mudança de passo atualiza `useHighlight`.
 * - AF: `result`/`fa` (como na rodada 1). AP e MT: `machine` (ver machine.ts),
 *   com o caminho na árvore de IDs, "Buscar mais"/"Continuar" e o foco num nó.
 * - Tocar = um temporizador que avança um passo por vez e para no fim.
 * - Se o autômato da aba ativa mudar (ou a aba mudar), a simulação é
 *   resetada e o destaque é limpo.
 * - Teste em lote de AP/MT: roda em fatias (a tela não trava com palavras
 *   que batem no limite).
 */
import { create } from 'zustand';
import { simulate } from '../../core/fa';
import { EPSILON } from '../../core/fa/types';
import type { FA, SimulationResult } from '../../core/fa/types';
import { inputAlphabet as pdaInputAlphabet } from '../../core/pda';
import type { PDA } from '../../core/pda/types';
import { inputAlphabet as tmInputAlphabet } from '../../core/tm';
import type { TM } from '../../core/tm/types';
import { faOf, getActiveDoc, useDocuments } from '../../store/documents';
import { useHighlight } from '../../store/highlight';
import type { BatchResult } from './batch';
import { formatBatch, generateWords, parseBatch, runBatch } from './batch';
import { alphabet } from '../../core/fa';
import type { MachineAutomaton, MachineRun, RunLimits } from './machine';
import {
  clampIndex,
  DEFAULT_LIMITS,
  isRunFinished,
  lastIndex,
  machineHighlight,
  MAX_NODES_CAP,
  MAX_STEPS_CAP,
  runMachine,
  stepCount,
  withFocus,
} from './machine';
import type { MachineBatchResult } from './machineBatch';
import { formatMachineBatch, parseMachineBatch, runMachineEntry } from './machineBatch';

/** Máximo de palavras geradas de uma vez. */
export const GENERATE_LIMIT = 2000;
import { clampStep, highlightFor, isFinished, lastStep } from './logic';

export const SPEEDS = [
  { label: '0,5×', ms: 1400 },
  { label: '1×', ms: 800 },
  { label: '2×', ms: 400 },
  { label: '4×', ms: 170 },
] as const;
export const DEFAULT_SPEED = 1;

/** 'tree' = árvore de IDs (só AP e MT). */
export type PanelTab = 'simulate' | 'batch' | 'tree';

export interface SimulationState {
  /** Palavra digitada. */
  word: string;
  /** Simulação carregada (null = nada simulando). Só AF. */
  result: SimulationResult | null;
  /** Autômato e palavra usados em `result`. */
  fa: FA | null;
  simWord: string;
  step: number;
  /** Passo mostrado antes do atual (a pilha e a fita só animam quando anda 1 passo para a frente). */
  prevStep: number;
  playing: boolean;
  speed: number;

  /** AP/MT: a simulação carregada (null = nada simulando ou aba de AF). */
  machine: MachineRun | null;
  /** AP/MT: "Mostrar a árvore inteira" (continua a busca depois de aceitar). Vale para as próximas simulações. */
  treeAll: boolean;
  /** AP/MT: limites de uma simulação nova (os padrões do núcleo; `limite=` na URL muda). */
  baseLimits: RunLimits;
  /** Conta as rodadas de AP/MT carregadas (a fita da MT recomeça a vista a cada uma). */
  runSeq: number;

  tab: PanelTab;
  collapsed: boolean;

  batchText: string;
  batchResults: BatchResult[] | null;
  /** Autômato e texto usados em `batchResults` (para saber se estão desatualizados). */
  batchFa: FA | null;
  batchSource: string;
  genLength: number;

  /** AP/MT: resultados do lote (chegam aos poucos; ver `batchProgress`). */
  machineBatch: MachineBatchResult[] | null;
  /** AP/MT: o autômato usado em `machineBatch` (para saber se está desatualizado). */
  machineBatchOf: PDA | TM | null;
  /** AP/MT: lote rodando (null = terminou). */
  batchProgress: { done: number; total: number } | null;

  setWord(word: string): void;
  /** Calcula a simulação da palavra (ou da atual) no autômato ativo e vai ao passo 0. */
  load(word?: string): void;
  play(): void;
  pause(): void;
  togglePlay(): void;
  next(): void;
  prev(): void;
  first(): void;
  last(): void;
  goTo(step: number): void;
  /** Tira a simulação (mantém a palavra) e limpa o destaque. */
  reset(): void;
  setSpeed(i: number): void;
  setTab(tab: PanelTab): void;
  setCollapsed(c: boolean): void;

  setBatchText(text: string): void;
  runBatch(): void;
  setGenLength(n: number): void;
  /** Preenche a lista com todas as palavras sobre Σ até `genLength` e testa. Devolve se cortou no limite. */
  generateBatch(): { count: number; truncated: boolean };

  /** AP/MT: simula de novo com um limite maior (AP e MTN: IDs × 4; MTD: passos × 10) e vai ao fim. */
  searchMore(): void;
  /** AP/MT: liga/desliga "Mostrar a árvore inteira" (simula de novo se precisar). */
  setTreeAll(on: boolean): void;
  /** AP/MT: mostra o caminho até o nó `index` da árvore (null = volta ao caminho padrão) e vai ao fim dele. */
  focusNode(index: number | null): void;
  /** AP/MT: limites das próximas simulações (parâmetro `limite=` da URL). */
  setBaseLimits(patch: Partial<RunLimits>): void;
}

const STORAGE_KEY = 'automatos-studio:simulacao';

function loadPrefs(): { speed: number; collapsed: boolean } {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as { speed?: unknown; collapsed?: unknown };
      const speed = typeof p.speed === 'number' && SPEEDS[p.speed] ? p.speed : DEFAULT_SPEED;
      return { speed, collapsed: p.collapsed === true };
    }
  } catch {
    /* localStorage bloqueado ou lixo: usa o padrão */
  }
  return { speed: DEFAULT_SPEED, collapsed: false };
}

function savePrefs(p: { speed: number; collapsed: boolean }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* sem localStorage: só não lembra */
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
function stopTimer() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

/** Lote de AP/MT em andamento: cada `runBatch` novo cancela o anterior. */
let batchJob = 0;
let batchTimer: ReturnType<typeof setTimeout> | null = null;
function stopBatch() {
  batchJob++;
  if (batchTimer !== null) clearTimeout(batchTimer);
  batchTimer = null;
}
/** Tempo de cada fatia do lote (ms): entre uma e outra, a tela respira. */
const BATCH_SLICE_MS = 24;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** AP ou MT da aba ativa (null = AF). */
function activeMachine(): MachineAutomaton | null {
  const a = getActiveDoc().automaton;
  if (a.kind === 'pda') return { kind: 'pda', pda: a.pda };
  if (a.kind === 'tm') return { kind: 'tm', tm: a.tm };
  return null;
}

function automatonOfRun(run: MachineRun): MachineAutomaton {
  return run.kind === 'pda' ? { kind: 'pda', pda: run.pda } : { kind: 'tm', tm: run.tm };
}

/** Σ do AP ou da MT (o da MT pode ser um palpite: ver `inputAlphabetGuessed`). */
export function machineSigma(a: MachineAutomaton): string[] {
  return a.kind === 'pda' ? pdaInputAlphabet(a.pda) : tmInputAlphabet(a.tm);
}

const prefs = loadPrefs();

export const useSimulation = create<SimulationState>()((set, get) => {
  /** Vai ao passo `step` e acende o destaque correspondente. */
  const go = (step: number) => {
    const { result, machine } = get();
    if (machine) {
      const i = clampIndex(machine, step);
      set({ step: i, prevStep: get().step });
      useHighlight.getState().set(machineHighlight(machine, i));
      return;
    }
    const i = clampStep(result, step);
    set({ step: i, prevStep: get().step });
    useHighlight.getState().set(highlightFor(result, i));
  };

  /** Há uma simulação carregada (AF ou AP/MT)? */
  const loaded = () => !!get().result || !!get().machine;
  /** Último passo da simulação carregada. */
  const lastOf = () => {
    const s = get();
    return s.machine ? lastIndex(s.machine) : lastStep(s.result);
  };
  const finished = () => {
    const s = get();
    return s.machine ? isRunFinished(s.machine, s.step) : isFinished(s.result, s.step);
  };

  const ensureLoaded = (): boolean => {
    if (!loaded()) get().load();
    return loaded();
  };

  const tick = () => {
    timer = null;
    const s = get();
    if (!s.playing || !loaded()) return;
    if (s.step >= lastOf()) {
      set({ playing: false });
      return;
    }
    go(s.step + 1);
    if (get().step >= lastOf()) set({ playing: false });
    else timer = setTimeout(tick, SPEEDS[get().speed]!.ms);
  };

  /** Troca a rodada de AP/MT (mesma palavra) e vai ao passo `step` (-1 = fim). */
  const replaceRun = (run: MachineRun, step: number) => {
    stopTimer();
    set({ machine: run, playing: false, runSeq: get().runSeq + 1 });
    if (stepCount(run) === 0) {
      set({ step: -1 });
      useHighlight.getState().clear();
      return;
    }
    go(step < 0 ? lastIndex(run) : step);
  };

  /** Lote de AP/MT: testa em fatias de ~24 ms e mostra os resultados aos poucos. */
  const runMachineBatchNow = () => {
    const a = activeMachine();
    if (!a) return;
    stopBatch();
    const job = batchJob;
    const text = get().batchText;
    const entries = parseMachineBatch(text, machineSigma(a));
    const results: MachineBatchResult[] = [];
    set({
      machineBatch: [],
      machineBatchOf: a.kind === 'pda' ? a.pda : a.tm,
      batchSource: text,
      batchProgress: entries.length ? { done: 0, total: entries.length } : null,
    });
    const slice = () => {
      batchTimer = null;
      if (job !== batchJob) return;
      const t0 = now();
      while (results.length < entries.length) {
        results.push(runMachineEntry(a, entries[results.length]!));
        if (now() - t0 > BATCH_SLICE_MS) break;
      }
      const done = results.length >= entries.length;
      set({ machineBatch: results.slice(), batchProgress: done ? null : { done: results.length, total: entries.length } });
      if (!done) batchTimer = setTimeout(slice, 0);
    };
    slice();
  };

  return {
    word: '',
    result: null,
    fa: null,
    simWord: '',
    step: -1,
    prevStep: -1,
    playing: false,
    speed: prefs.speed,
    machine: null,
    treeAll: false,
    baseLimits: DEFAULT_LIMITS,
    runSeq: 0,
    tab: 'simulate',
    collapsed: prefs.collapsed,

    batchText: '',
    batchResults: null,
    batchFa: null,
    batchSource: '',
    genLength: 3,
    machineBatch: null,
    machineBatchOf: null,
    batchProgress: null,

    setWord(word) {
      if (word === get().word) return;
      if (loaded()) get().reset();
      set({ word });
    },

    load(word) {
      stopTimer();
      const w = word ?? get().word;
      const fa = faOf(getActiveDoc());
      // AP e MT: a rodada inteira de uma vez; o painel anda pelo caminho
      if (!fa) {
        const a = activeMachine();
        if (!a) return;
        // ε é a palavra vazia (igual ao AF)
        const clean = w.split(EPSILON).join('');
        const run = runMachine(a, clean, { ...get().baseLimits, exploreAll: get().treeAll });
        set({ word: w, simWord: clean, result: null, fa: null, step: -1, prevStep: -1 });
        replaceRun(run, 0);
        return;
      }
      // ε é a palavra vazia (igual ao Teste em lote): "ε" = vazia, "0ε1" = "01"
      const clean = w.split(EPSILON).join('');
      const result = simulate(fa, clean);
      set({ word: w, simWord: clean, fa, result, machine: null, playing: false, step: -1 });
      if (result.steps.length === 0) {
        set({ step: -1 });
        useHighlight.getState().clear();
      } else go(0);
    },

    play() {
      if (!ensureLoaded()) return;
      const { result, machine } = get();
      if (machine) {
        if (stepCount(machine) === 0) return;
      } else if (!result || result.steps.length === 0) return;
      if (finished()) go(0);
      if (finished()) return; // palavra vazia: não há o que tocar
      stopTimer();
      set({ playing: true });
      timer = setTimeout(tick, SPEEDS[get().speed]!.ms);
    },

    pause() {
      stopTimer();
      if (get().playing) set({ playing: false });
    },

    togglePlay() {
      if (get().playing) get().pause();
      else get().play();
    },

    next() {
      get().pause();
      if (!loaded()) {
        get().load();
        return;
      }
      go(get().step + 1);
    },

    prev() {
      get().pause();
      if (!loaded()) return;
      go(get().step - 1);
    },

    first() {
      get().pause();
      if (!ensureLoaded()) return;
      go(0);
    },

    last() {
      get().pause();
      if (!ensureLoaded()) return;
      go(lastOf());
    },

    goTo(step) {
      get().pause();
      if (!loaded()) return;
      go(step);
    },

    reset() {
      stopTimer();
      const had = loaded();
      set({ result: null, fa: null, machine: null, simWord: '', step: -1, prevStep: -1, playing: false });
      if (had) useHighlight.getState().clear();
    },

    setSpeed(i) {
      if (!SPEEDS[i]) return;
      set({ speed: i });
      savePrefs({ speed: i, collapsed: get().collapsed });
      // tocando: o próximo passo já usa a velocidade nova
      if (get().playing) {
        stopTimer();
        timer = setTimeout(tick, SPEEDS[i]!.ms);
      }
    },

    setTab(tab) {
      set({ tab, collapsed: false });
      savePrefs({ speed: get().speed, collapsed: false });
    },

    setCollapsed(collapsed) {
      set({ collapsed });
      savePrefs({ speed: get().speed, collapsed });
    },

    setBatchText(batchText) {
      set({ batchText });
    },

    runBatch() {
      const fa = faOf(getActiveDoc());
      if (!fa) {
        runMachineBatchNow();
        return;
      }
      const text = get().batchText;
      const entries = parseBatch(text, alphabet(fa));
      set({ batchResults: runBatch(fa, entries), batchFa: fa, batchSource: text });
    },

    setGenLength(n) {
      set({ genLength: Math.max(0, Math.min(12, Math.trunc(n) || 0)) });
    },

    generateBatch() {
      const fa = faOf(getActiveDoc());
      if (!fa) {
        const a = activeMachine();
        if (!a) return { count: 0, truncated: false };
        const { words, truncated } = generateWords(machineSigma(a), get().genLength, GENERATE_LIMIT);
        set({ batchText: formatMachineBatch(words.map((word) => ({ word, expected: null }))) });
        get().runBatch();
        return { count: words.length, truncated };
      }
      const sigma = alphabet(fa);
      const { words, truncated } = generateWords(sigma, get().genLength, GENERATE_LIMIT);
      set({ batchText: formatBatch(words.map((word) => ({ word, expected: null }))) });
      get().runBatch();
      return { count: words.length, truncated };
    },

    searchMore() {
      const run = get().machine;
      if (!run) return;
      const l = run.limits;
      const dtm = run.kind === 'tm' && !run.result.tree;
      const limits: RunLimits = dtm
        ? { ...l, maxSteps: Math.min(l.maxSteps * 10, MAX_STEPS_CAP) }
        : { ...l, maxNodes: Math.min(l.maxNodes * 4, MAX_NODES_CAP) };
      replaceRun(runMachine(automatonOfRun(run), run.word, limits), -1);
    },

    setTreeAll(on) {
      set({ treeAll: on });
      const run = get().machine;
      if (!run || run.limits.exploreAll === on || (run.kind === 'tm' && !run.result.tree)) return;
      // a ordem da busca não muda: os nós antigos guardam o índice, então o foco e o passo continuam valendo
      let next = runMachine(automatonOfRun(run), run.word, { ...run.limits, exploreAll: on });
      if (run.focus !== null) next = withFocus(next, run.focus);
      replaceRun(next, get().step);
    },

    focusNode(index) {
      const run = get().machine;
      if (!run) return;
      const next = withFocus(run, index);
      if (next === run && index !== null) return;
      replaceRun(next, -1);
    },

    setBaseLimits(patch) {
      set({ baseLimits: { ...get().baseLimits, ...patch } });
    },
  };
});

/* Autômato mudou (edição, desfazer, outra aba): a simulação não vale mais. */
let seenDoc = getActiveDoc();
useDocuments.subscribe((st) => {
  const doc = st.docs.find((d) => d.id === st.activeId) ?? st.docs[0];
  if (!doc || (doc.id === seenDoc.id && doc.automaton === seenDoc.automaton)) return;
  seenDoc = doc;
  const sim = useSimulation.getState();
  if (sim.result || sim.machine) sim.reset();
  // lote de AP/MT ainda rodando para o autômato antigo: para
  if (sim.batchProgress) {
    stopBatch();
    useSimulation.setState({ batchProgress: null });
  }
  // a árvore de IDs não existe em AF: volta para a simulação
  if (sim.tab === 'tree' && doc.automaton.kind === 'fa') useSimulation.setState({ tab: 'simulate' });
});
