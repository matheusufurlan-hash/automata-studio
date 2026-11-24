/**
 * Painel de simulação de AP e MT (embaixo do canvas):
 *  - aba Simulação: palavra e controles (os mesmos do AF); no AP, a entrada
 *    (o que já foi lido fica riscado) e a pilha (topo em cima); na MT, a fita
 *    infinita com a cabeça e o estado; a sequência de IDs com ⊢ e o cartão
 *    com o passo (δ do livro) e o resultado;
 *  - aba Árvore de IDs (AP e MT não determinística);
 *  - aba Teste em lote.
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, CircleHelp, CircleX, Footprints, ListChecks, Network, Repeat, Search } from 'lucide-react';
import { EPSILON } from '../../core/common';
import { inputAlphabet as pdaInputAlphabet, validate as validatePDA } from '../../core/pda';
import type { PDA } from '../../core/pda/types';
import { validate as validateTM } from '../../core/tm';
import type { TM, TMConfig } from '../../core/tm/types';
import { isEmptyDoc, useActiveDoc } from '../../store/documents';
import { Kbd } from '../editor/Menu';
import { pdaIssueText, tmIssueText } from '../ferramentas/machineFormat';
import { showWord } from '../ferramentas/format';
import { Speed, Transport, WordField } from './Controls';
import { IDSequence } from './IDSequence';
import { MathText } from './MathText';
import type { TapeModel } from './logic';
import type { PDARun, TMRun, VerdictTone } from './machine';
import {
  endTone,
  stepTone,
  focusText,
  isRunFinished,
  lastIndex,
  machineStepText,
  machineVerdict,
  pdaConfigAt,
  pdaConsumed,

  stateName,
  stepCount,
  tmConfigAt,
  VERDICT_LABEL,
} from './machine';
import { MachineBatchView } from './MachineBatchView';
import './machine.css';
import { Stack } from './Stack';
import { useSimulation } from './store';
import { Tape } from './Tape';
import { TreeView } from './TreeView';
import { TuringTape } from './TuringTape';

type Kind = 'pda' | 'tm';

/* ------------------------------------------------------------------ */
/* Selo do resultado                                                   */
/* ------------------------------------------------------------------ */

const SEAL_ICON: Record<VerdictTone, ReactNode> = {
  accepted: <CircleCheck size={20} strokeWidth={2.4} />,
  rejected: <CircleX size={20} strokeWidth={2.4} />,
  loop: <Repeat size={19} strokeWidth={2.4} />,
  undecided: <CircleHelp size={20} strokeWidth={2.4} />,
};

export function Seal({ tone, small = false }: { tone: VerdictTone; small?: boolean }) {
  return (
    <span className={`sim-seal is-${tone}${small ? ' sm' : ''}`}>
      {!small && SEAL_ICON[tone]}
      {VERDICT_LABEL[tone]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Cartão da direita                                                   */
/* ------------------------------------------------------------------ */

function Issues({ kind, automaton }: { kind: Kind; automaton: PDA | TM }) {
  const texts = useMemo(() => {
    if (kind === 'pda') {
      const pda = automaton as PDA;
      return validatePDA(pda).map((i) => pdaIssueText(pda, i));
    }
    const tm = automaton as TM;
    return validateTM(tm).map((i) => tmIssueText(tm, i));
  }, [kind, automaton]);
  if (texts.length === 0) return null;
  return (
    <ul className="sim-issues">
      {texts.slice(0, 3).map((t) => (
        <li key={t}>
          <CircleAlert size={14} />
          <span>{t}</span>
        </li>
      ))}
      {texts.length > 3 && <li className="more">e mais {texts.length - 3} (veja o painel lateral)</li>}
    </ul>
  );
}

function IdleCard({ kind, automaton, empty }: { kind: Kind; automaton: PDA | TM; empty: boolean }) {
  return (
    <div className="sim-card is-idle">
      <div className="sim-card-eyebrow">Como simular</div>
      {empty ? (
        <p>Desenhe {kind === 'pda' ? 'um autômato com pilha' : 'uma máquina de Turing'} (ou abra um exemplo pronto em Exemplos) e digite uma palavra.</p>
      ) : (
        <p>
          Digite a palavra e aperte <Kbd keys={['Enter']} /> ou ▶. Ande passo a passo com <Kbd keys={['←']} /> <Kbd keys={['→']} />
          {kind === 'pda' ? ' e veja a pilha mudar.' : ' e veja a cabeça andar na fita.'}
        </p>
      )}
      {!empty && <Issues kind={kind} automaton={automaton} />}
    </div>
  );
}

function MachineCard({ kind, automaton, empty }: { kind: Kind; automaton: PDA | TM; empty: boolean }) {
  const run = useSimulation((s) => s.machine);
  const step = useSimulation((s) => s.step);
  const simWord = useSimulation((s) => s.simWord);
  if (!run) return <IdleCard kind={kind} automaton={automaton} empty={empty} />;

  const finished = isRunFinished(run, step);
  const total = Math.max(0, lastIndex(run));
  const exp = machineStepText(run, step);
  const verdict = machineVerdict(run);
  const focus = focusText(run);
  const tone = focus ? focus.tone : verdict.tone;

  return (
    <div className={finished ? `sim-card is-${tone}` : 'sim-card'} aria-live="polite">
      <div className="sim-card-eyebrow">
        <span className="sim-card-step">{stepCount(run) > 0 ? `Passo ${Math.max(0, step)} de ${total}` : 'Simulação'}</span>
        <span className="sim-card-word">w = {showWord(simWord)}</span>
      </div>
      {!finished && exp && (
        <>
          <div className="sim-card-title">{exp.title}</div>
          <div className="sim-card-math">
            <MathText text={exp.formula} />
          </div>
          {exp.move && (
            <div className="sim-card-move">
              <MathText text={exp.move} />
            </div>
          )}
          {exp.note && <div className="sim-card-note">{exp.note}</div>}
        </>
      )}
      {finished && (
        <div className="sim-verdict">
          {focus ? (
            <>
              <p className="sim-reason">{focus.text}.</p>
              <p className="sim-reason muted">
                A palavra: <Seal tone={verdict.tone} small /> <button type="button" className="sim-link" onClick={() => useSimulation.getState().focusNode(null)}>ver o caminho da resposta</button>
              </p>
            </>
          ) : (
            <>
              <Seal tone={verdict.tone} />
              {verdict.output !== undefined && (
                <div className="sim-output">
                  Saída: <span className={verdict.output === '' ? 'eps' : undefined}>{verdict.output === '' ? EPSILON : verdict.output}</span>
                </div>
              )}
              <p className="sim-reason">
                <b>{verdict.title}: </b>
                {verdict.text}.
              </p>
              {verdict.more && (
                <button type="button" className="ed-btn sm sim-more" onClick={() => useSimulation.getState().searchMore()} title={verdict.more.hint}>
                  <Search size={14} /> {verdict.more.label}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AP                                                                  */
/* ------------------------------------------------------------------ */

/** A palavra do AP como fita: o que já foi lido fica riscado. */
function pdaTape(word: string, sigma: readonly string[], run: PDARun | null, step: number): TapeModel {
  const chars = Array.from(word);
  const inSigma = new Set(sigma);
  const cells = chars.map((ch) => ({ ch, kind: 'pending' as const, foreign: !inSigma.has(ch) }));
  if (!run) return { cells, head: -1, tone: 'idle' };
  if (stepCount(run) === 0) return { cells, head: -1, tone: 'rejected' };
  const finished = isRunFinished(run, step);
  let head = pdaConsumed(run, step);
  let errorAt = -1;
  if (finished && run.result.reason === 'SYMBOL_NOT_IN_ALPHABET') {
    errorAt = run.result.stoppedAt ?? head;
    head = errorAt;
  }
  const tone = finished ? (endTone(run) === 'accepted' ? 'accepted' : endTone(run) === 'rejected' ? 'rejected' : 'running') : 'running';
  return {
    cells: cells.map((c, k) => ({
      ...c,
      kind: k === errorAt ? 'error' : k < head ? 'read' : k === head && !finished ? 'current' : 'pending',
    })),
    head,
    tone,
  };
}

function PDAView({ pda, empty }: { pda: PDA; empty: boolean }) {
  const word = useSimulation((s) => s.word);
  const machine = useSimulation((s) => s.machine);
  const simWord = useSimulation((s) => s.simWord);
  const step = useSimulation((s) => s.step);
  const prevStep = useSimulation((s) => s.prevStep);
  const goTo = useSimulation((s) => s.goTo);
  const run = machine?.kind === 'pda' ? machine : null;
  const sigma = useMemo(() => pdaInputAlphabet(pda), [pda]);
  const shownWord = run ? simWord : word.split(EPSILON).join('');
  const tape = useMemo(() => pdaTape(shownWord, sigma, run, step), [shownWord, sigma, run, step]);
  const tone = stepTone(run, step);

  // a pilha do passo (e a do passo anterior, para animar ao andar 1 passo)
  const hasSteps = !!run && stepCount(run) > 0;
  const animate = hasSteps && step > 0 && prevStep === step - 1;
  const stack = hasSteps ? pdaConfigAt(run, step).stack : pda.startStackSymbol;
  const prevStack = animate ? pdaConfigAt(run, step - 1).stack : null;

  return (
    <div className="sim-body is-machine is-pda">
      <div className="sim-main">
        <div className="sim-controls">
          <WordField />
          <Transport />
          <Speed />
        </div>
        <div className="sim-lane">
          <span className="sim-lane-label">entrada</span>
          <Tape model={tape} empty={shownWord === ''} className="is-struck" />
        </div>
        <IDSequence run={run} step={step} tone={tone} onPick={goTo} />
      </div>
      <Stack
        stack={stack}
        prev={prevStack}
        z0={run ? run.pda.startStackSymbol : pda.startStackSymbol}
        animKey={step}
        dimmed={!run}
        tone={tone === 'loop' ? 'undecided' : tone}
      />
      <MachineCard kind="pda" automaton={pda} empty={empty} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MT                                                                  */
/* ------------------------------------------------------------------ */

function TMView({ tm, empty }: { tm: TM; empty: boolean }) {
  const word = useSimulation((s) => s.word);
  const machine = useSimulation((s) => s.machine);
  const step = useSimulation((s) => s.step);
  const prevStep = useSimulation((s) => s.prevStep);
  const runSeq = useSimulation((s) => s.runSeq);
  const goTo = useSimulation((s) => s.goTo);
  const run: TMRun | null = machine?.kind === 'tm' ? machine : null;
  const tone = stepTone(run, step);

  const typed = word.split(EPSILON).join('');
  const initial = tm.states.find((s) => s.initial);
  // antes de simular: a fita com a palavra digitada e a cabeça na 1ª célula
  const config: TMConfig = useMemo(() => {
    if (run && stepCount(run) > 0) return tmConfigAt(run, step);
    return { state: initial?.id ?? '', tape: typed || tm.blank, head: 0, origin: 0 };
  }, [run, step, typed, tm.blank, initial]);
  const animate = !!run && step > 0 && prevStep === step - 1;
  const prev = animate && run ? tmConfigAt(run, step - 1) : null;
  const state = run && stepCount(run) > 0 ? stateName(tm, config.state) : (initial?.name ?? '?');

  return (
    <div className="sim-body is-machine is-tm">
      <div className="sim-main">
        <div className="sim-controls">
          <WordField />
          <Transport />
          <Speed />
        </div>
        <TuringTape
          key={runSeq}
          config={config}
          prev={prev}
          blank={tm.blank}
          state={state}
          tone={!run ? 'idle' : tone === 'loop' ? 'undecided' : tone}
          stepKey={step}
        />
        <IDSequence run={run} step={step} tone={tone} onPick={goTo} />
      </div>
      <MachineCard kind="tm" automaton={tm} empty={empty} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

export function MachinePanel({ kind }: { kind: Kind }) {
  const doc = useActiveDoc();
  const tab = useSimulation((s) => s.tab);
  const collapsed = useSimulation((s) => s.collapsed);
  const machine = useSimulation((s) => s.machine);
  const step = useSimulation((s) => s.step);
  const setTab = useSimulation((s) => s.setTab);
  const setCollapsed = useSimulation((s) => s.setCollapsed);
  const empty = isEmptyDoc(doc);
  const a = doc.automaton;
  const finished = machine && isRunFinished(machine, step);

  const tabs: Array<{ id: 'simulate' | 'tree' | 'batch'; label: string; icon: ReactNode }> = [
    { id: 'simulate', label: 'Simulação', icon: <Footprints size={15} /> },
    { id: 'tree', label: 'Árvore de IDs', icon: <Network size={15} /> },
    { id: 'batch', label: 'Teste em lote', icon: <ListChecks size={15} /> },
  ];

  let body: ReactNode = null;
  if (!collapsed) {
    if (tab === 'batch') body = <MachineBatchView />;
    else if (tab === 'tree') body = <TreeView />;
    else if (a.kind === 'pda') body = <PDAView pda={a.pda} empty={empty} />;
    else if (a.kind === 'tm') body = <TMView tm={a.tm} empty={empty} />;
  }

  return (
    <section className={`sim is-${kind}${collapsed ? ' is-collapsed' : ''}`} aria-label="Simulação">
      <header className="sim-head">
        <div className="sim-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'sim-tab is-on' : 'sim-tab'}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {collapsed && machine && (
          <span className="sim-mini">
            {finished ? <Seal tone={machineVerdict(machine).tone} small /> : `Passo ${Math.max(0, step)} de ${Math.max(0, lastIndex(machine))}`}
          </span>
        )}
        <span className="grow" />
        <button
          type="button"
          className="ed-icon-btn sm"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Mostrar o painel de simulação' : 'Recolher o painel de simulação'}
          data-tip={collapsed ? 'Mostrar' : 'Recolher'}
          data-tip-pos="top"
          data-tip-align="end"
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </header>
      {body}
    </section>
  );
}


