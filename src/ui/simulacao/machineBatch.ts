/**
 * Teste em lote de AP e MT (funções puras).
 *
 * Formato: o mesmo do AF (uma palavra por linha; `+palavra` deve aceitar,
 * `-palavra` deve rejeitar, `ε` = palavra vazia) e, na MT que calcula uma
 * função (aceitação por parada), `palavra => saída` com a saída esperada
 * (`ε` = fita toda em branco). Uma saída esperada já diz que deve aceitar.
 *
 * Resultado de cada palavra: aceita, rejeita, NÃO PARA (a MT entrou em laço)
 * ou INDEFINIDO (a busca parou no limite sem decidir). "Não para" bate com
 * "deve rejeitar" (a palavra não é aceita); "indefinido" não bate nem deixa
 * de bater: fica amarelo.
 */
import { EPSILON } from '../../core/common';
import { simulate as simulatePDA } from '../../core/pda';
import type { PDA } from '../../core/pda/types';
import { simulate as simulateTM } from '../../core/tm';
import type { TM } from '../../core/tm/types';
import type { BatchEntry } from './batch';
import { parseBatch } from './batch';
import type { MachineAutomaton, RunLimits } from './machine';
import { DEFAULT_LIMITS, stateName } from './machine';

export interface MachineBatchEntry extends BatchEntry {
  /** Saída esperada (MT por parada): o que deve sobrar na fita. */
  expectedOutput?: string;
}

/** accepted/rejected = decidiu; loop = nunca para; undecided = parou no limite. */
export type Outcome = 'accepted' | 'rejected' | 'loop' | 'undecided';

export interface MachineBatchResult extends MachineBatchEntry {
  outcome: Outcome;
  /** Saída da MT por parada (quando aceitou). */
  output?: string;
  /** true = bateu com o esperado; false = não bateu; null = sem esperado ou indefinido. */
  ok: boolean | null;
  /** Por que deu isso, em poucas palavras (dica ao passar o mouse). */
  detail: string;
}

/** Lê a saída escrita depois de "=>": sem espaços, "ε" = vazia. */
function cleanOutput(s: string): string {
  return s.replace(/\s+/g, '').split(EPSILON).join('');
}

export function parseMachineBatch(text: string, sigma: readonly string[] = []): MachineBatchEntry[] {
  const out: MachineBatchEntry[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() === '') return;
    const arrow = raw.indexOf('=>');
    const left = arrow < 0 ? raw : raw.slice(0, arrow);
    const entry = parseBatch(left.trim() === '' ? EPSILON : left, sigma)[0];
    if (!entry) return;
    const e: MachineBatchEntry = { ...entry, line: i + 1 };
    if (arrow >= 0) {
      e.expectedOutput = cleanOutput(raw.slice(arrow + 2));
      if (e.expected === null) e.expected = true;
    }
    out.push(e);
  });
  return out;
}

/** Volta a lista para texto (para preencher a caixa). */
export function formatMachineBatch(entries: readonly Pick<MachineBatchEntry, 'word' | 'expected' | 'expectedOutput'>[]): string {
  return entries
    .map((e) => {
      const w = e.word === '' ? EPSILON : e.word;
      if (e.expectedOutput !== undefined) return `${w} => ${e.expectedOutput === '' ? EPSILON : e.expectedOutput}`;
      return `${e.expected === null ? '' : e.expected ? '+' : '-'}${w}`;
    })
    .join('\n');
}

/** As palavras de teste de um exemplo da galeria, no formato da caixa. */
export function samplesToBatch(samples: ReadonlyArray<{ word: string; accepted: boolean; output?: string }>): string {
  return formatMachineBatch(
    samples.map((s) => ({
      word: s.word,
      expected: s.accepted,
      expectedOutput: s.accepted && s.output !== undefined ? s.output : undefined,
    })),
  );
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;

function judge(e: MachineBatchEntry, outcome: Outcome, output: string | undefined): boolean | null {
  if (e.expected === null && e.expectedOutput === undefined) return null;
  if (outcome === 'undecided') return null;
  const accepted = outcome === 'accepted';
  if (e.expectedOutput !== undefined) return accepted && output === e.expectedOutput;
  return e.expected === accepted;
}

function runPDAEntry(pda: PDA, e: MachineBatchEntry, limits: RunLimits): MachineBatchResult {
  const r = simulatePDA(pda, e.word, { maxNodes: limits.maxNodes });
  let outcome: Outcome;
  let detail: string;
  if (r.accepted) {
    outcome = 'accepted';
    detail = pda.acceptance === 'EMPTY_STACK' ? 'aceita por pilha vazia' : 'aceita por estado final';
  } else if (r.reason === 'LIMIT_REACHED') {
    outcome = 'undecided';
    detail = `parei em ${count(r.tree.length, 'ID', 'IDs')} sem aceitar`;
  } else {
    outcome = 'rejected';
    detail =
      r.reason === 'NO_INITIAL_STATE'
        ? 'o AP não tem estado inicial'
        : r.reason === 'SYMBOL_NOT_IN_ALPHABET'
          ? `nenhuma regra lê '${Array.from(e.word)[r.stoppedAt ?? 0] ?? '?'}'`
          : 'nenhum caminho aceita';
  }
  return { ...e, outcome, ok: judge(e, outcome, undefined), detail };
}

function runTMEntry(tm: TM, e: MachineBatchEntry, limits: RunLimits): MachineBatchResult {
  const r = simulateTM(tm, e.word, { maxSteps: limits.maxSteps, maxNodes: limits.maxNodes });
  const steps = Math.max(0, r.steps.length - 1);
  const last = r.steps[r.steps.length - 1];
  const q = last ? stateName(tm, last.config.state) : '?';
  let outcome: Outcome;
  let detail: string;
  let output: string | undefined;
  switch (r.stop) {
    case 'ACCEPTED_FINAL':
      outcome = 'accepted';
      detail = `entrou em ${q}, que é final (${count(steps, 'passo', 'passos')})`;
      break;
    case 'HALTED':
      if (r.accepted) {
        outcome = 'accepted';
        output = r.output ?? '';
        detail = `parou em ${q} (${count(steps, 'passo', 'passos')}); saída: ${output === '' ? EPSILON : output}`;
      } else {
        outcome = 'rejected';
        detail = r.tree ? 'todos os ramos pararam fora de um estado final' : `parou em ${q}, que não é final`;
      }
      break;
    case 'LOOP':
      outcome = 'loop';
      detail = r.tree ? 'nenhum ramo aceita e algum entra em ciclo' : 'a configuração se repete: a MT nunca para';
      break;
    case 'STEP_LIMIT':
      outcome = 'undecided';
      detail = r.tree
        ? `parei em ${count(r.tree.length, 'ID', 'IDs')} sem decidir`
        : `parei em ${count(steps, 'passo', 'passos')} sem decidir`;
      break;
    case 'NO_INITIAL_STATE':
      outcome = 'rejected';
      detail = 'a MT não tem estado inicial';
      break;
    case 'BLANK_IN_INPUT':
      outcome = 'rejected';
      detail = `a palavra tem o branco ${tm.blank}`;
      break;
    case 'SYMBOL_NOT_IN_ALPHABET':
    default:
      outcome = 'rejected';
      detail = `'${Array.from(e.word)[r.stoppedAt ?? 0] ?? '?'}' não está em Σ`;
      break;
  }
  const res: MachineBatchResult = { ...e, outcome, ok: judge(e, outcome, output), detail };
  if (output !== undefined) res.output = output;
  return res;
}

/** Testa uma palavra (o painel chama em fatias, para a tela não travar). */
export function runMachineEntry(a: MachineAutomaton, e: MachineBatchEntry, limits: RunLimits = DEFAULT_LIMITS): MachineBatchResult {
  return a.kind === 'pda' ? runPDAEntry(a.pda, e, limits) : runTMEntry(a.tm, e, limits);
}

export function runMachineBatch(
  a: MachineAutomaton,
  entries: readonly MachineBatchEntry[],
  limits: RunLimits = DEFAULT_LIMITS,
): MachineBatchResult[] {
  return entries.map((e) => runMachineEntry(a, e, limits));
}

export interface MachineBatchSummary {
  total: number;
  accepted: number;
  rejected: number;
  loop: number;
  undecided: number;
  /** Com esperado e iguais ao esperado. */
  passed: number;
  /** Com esperado e diferentes do esperado. */
  failed: number;
  /** Com esperado, mas sem resposta (não para / indefinido): não dá para dizer que bateu. */
  unresolved: number;
}

export function summarizeMachine(results: readonly MachineBatchResult[]): MachineBatchSummary {
  const s: MachineBatchSummary = {
    total: results.length,
    accepted: 0,
    rejected: 0,
    loop: 0,
    undecided: 0,
    passed: 0,
    failed: 0,
    unresolved: 0,
  };
  for (const r of results) {
    s[r.outcome]++;
    if (r.ok === true) s.passed++;
    else if (r.ok === false) s.failed++;
    else if (r.expected !== null || r.expectedOutput !== undefined) s.unresolved++;
  }
  return s;
}
