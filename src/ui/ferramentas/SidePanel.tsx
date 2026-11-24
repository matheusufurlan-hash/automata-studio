/**
 * Painel lateral (recolhível e com largura ajustável):
 *  - tipo do autômato e avisos de validate() (clicáveis: selecionam no canvas);
 *  - de onde veio a aba (resultado de qual algoritmo) e, para Minimizar e
 *    AFN → AFD, a tabela passo a passo;
 *  - definição formal M = (Q, Σ, δ, q0, F);
 *  - tabela de transição no estilo do Hopcroft.
 */
import { useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CircleAlert, Info, PanelRightClose, PanelRightOpen, Sparkles } from 'lucide-react';
import { graphOf } from '../../core/automaton';
import { classify, formalDefinition, validate } from '../../core/fa';
import type { FA, FAType, ValidationIssue } from '../../core/fa/types';
import { EMPTY_FA, faOf, pdaOf, useActiveDoc } from '../../store/documents';
import type { Doc } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { useHighlight } from '../../store/highlight';
import { KindBadge } from '../editor/KindBadge';
import { MachineIssues, MachineSections, MachineTypeBadge, machineType } from './MachineSide';
import './ferramentas.css';
import type { Provenance } from './algorithms';
import { formalLines, namesOf, tableColumns, transitionTable } from './format';
import { MinimizationSteps } from './MinimizationSteps';
import { Section } from './parts';
import { useTools } from './store';
import { SubsetSteps } from './SubsetSteps';
import { TypeBadge } from './TypeBadge';

/* ------------------------------------------------------------------ */
/* Avisos                                                              */
/* ------------------------------------------------------------------ */

function issueText(fa: FA, issue: ValidationIssue): string {
  const tr = (id: string) => {
    const t = fa.transitions.find((x) => x.id === id);
    if (!t) return id;
    const [from, to] = namesOf(fa, [t.from, t.to]);
    return `${from} → ${to}`;
  };
  switch (issue.kind) {
    case 'NO_INITIAL_STATE':
      return 'Sem estado inicial: selecione um estado e aperte I (ou clique com o botão direito → Inicial).';
    case 'MULTIPLE_INITIAL_STATES':
      return `Mais de um estado inicial (${namesOf(fa, issue.states).join(', ')}). Só pode haver um.`;
    case 'INVALID_SYMBOL':
      return `Símbolo inválido “${issue.symbol}” em ${tr(issue.transition)}: cada símbolo é um caractere só.`;
    case 'DANGLING_TRANSITION':
      return `A transição ${tr(issue.transition)} aponta para um estado que não existe.`;
    case 'DUPLICATE_NAME':
      return `${issue.states.length} estados se chamam “${issue.name}”. Renomeie para não confundir nas tabelas.`;
  }
}

function selectIssue(issue: ValidationIssue) {
  const ui = useEditorUi.getState();
  if (issue.kind === 'MULTIPLE_INITIAL_STATES' || issue.kind === 'DUPLICATE_NAME')
    ui.select({ states: issue.states, transitions: [] });
  else if (issue.kind === 'INVALID_SYMBOL' || issue.kind === 'DANGLING_TRANSITION')
    ui.select({ states: [], transitions: [issue.transition] });
}

function Issues({ fa }: { fa: FA }) {
  const issues = useMemo(() => (fa.states.length ? validate(fa) : []), [fa]);
  if (issues.length === 0) return null;
  return (
    <ul className="fx-issues">
      {issues.map((issue, i) => {
        const clickable = issue.kind !== 'NO_INITIAL_STATE';
        return (
          <li key={i}>
            <button type="button" className="fx-issue" onClick={() => selectIssue(issue)} disabled={!clickable}>
              <CircleAlert size={15} />
              <span>{issueText(fa, issue)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Origem (resultado de algoritmo)                                     */
/* ------------------------------------------------------------------ */

function Origin({ doc, prov }: { doc: Doc; prov: Provenance }) {
  const stepper = useTools((s) => s.stepper[doc.id]);
  const setStepper = useTools((s) => s.setStepper);
  const edited = prov.kind === 'pda' ? prov.pda !== pdaOf(doc) : prov.fa !== faOf(doc);

  let title: string;
  let notes: string[];
  if (prov.kind === 'minimize') {
    title = `Mínimo de ${prov.sourceName}`;
    notes = [
      `Método da tabela (Hopcroft): ${prov.result.input.states.length} estados viraram ${prov.result.dfa.states.length}.`,
    ];
  } else if (prov.kind === 'determinize') {
    title = `AFD de ${prov.sourceName}`;
    notes = ['Construção de subconjuntos: cada estado do AFD é um conjunto de estados do AFN.'];
  } else {
    title = prov.title;
    notes = prov.notes;
  }

  return (
    <>
      <Section id="origin" title="De onde veio">
        <div className="fx-origin">
          <Sparkles size={16} />
          <div>
            <strong>{title}</strong>
            {notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
            {edited && <p className="fx-warn-text">Você editou este autômato depois: as tabelas abaixo são do resultado original.</p>}
          </div>
        </div>
      </Section>
      {prov.kind === 'minimize' && (
        <Section id="steps" title="Minimização passo a passo">
          <MinimizationSteps
            source={prov.source}
            result={prov.result}
            pos={stepper ?? -1}
            onChange={(p) => setStepper(doc.id, p)}
          />
        </Section>
      )}
      {prov.kind === 'determinize' && (
        <Section id="steps" title="Construção de subconjuntos">
          <SubsetSteps source={prov.source} result={prov.result} pos={stepper ?? 0} onChange={(p) => setStepper(doc.id, p)} />
        </Section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Definição formal e tabela                                           */
/* ------------------------------------------------------------------ */

const DELTA_SIGNATURE: Record<FAType, string> = {
  EMPTY: '',
  DFA: 'Q × Σ → Q',
  NFA: 'Q × Σ → 𝒫(Q)',
  ENFA: 'Q × (Σ ∪ {ε}) → 𝒫(Q)',
};

function Formal({ fa }: { fa: FA }) {
  const def = useMemo(() => formalDefinition(fa), [fa]);
  const lines = formalLines(def);
  const count = def.delta.length;
  return (
    <div className="fx-formal">
      <div className="fx-formal-tuple">
        M = (Q, Σ, δ, q<sub>0</sub>, F)
      </div>
      <dl>
        <dt>Q</dt>
        <dd>{lines.Q}</dd>
        <dt>Σ</dt>
        <dd>{lines.Sigma}</dd>
        <dt>
          q<sub>0</sub>
        </dt>
        <dd>{lines.q0}</dd>
        <dt>F</dt>
        <dd>{lines.F}</dd>
        <dt>δ</dt>
        <dd className="fx-formal-note">
          {count === 0 ? 'sem transições' : `${DELTA_SIGNATURE[def.type]} (tabela abaixo)`}
        </dd>
      </dl>
    </div>
  );
}

function TransitionTableView({ fa }: { fa: FA }) {
  const table = useMemo(() => transitionTable(fa), [fa]);
  const columns = useMemo(() => tableColumns(table), [table]);
  const active = useHighlight((h) => h.active);
  const status = useHighlight((h) => h.status);
  const lit = new Set(active);
  if (table.rows.length === 0) return <div className="fx-empty-line">Sem estados.</div>;
  if (table.symbols.length === 0) return <div className="fx-empty-line">Sem transições ainda: Σ = ∅.</div>;
  return (
    <div className="fx-table-wrap">
      <table className="fx-table">
        <thead>
          <tr>
            <th className="fx-mark" />
            <th className="fx-rowhead">δ</th>
            {columns.map((c) => (
              <th key={c.label} className={c.label === 'ε' ? 'is-eps' : undefined} title={c.symbols.length > 1 ? `Os símbolos ${c.symbols.join(' ')} têm as mesmas transições` : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.id} className={lit.has(r.id) ? `is-lit lit-${status === 'idle' ? 'running' : status}` : undefined}>
              <td className="fx-mark">
                {r.initial && <span className="fx-arrow">→</span>}
                {r.final && <span className="fx-star">*</span>}
              </td>
              <th className="fx-rowhead" scope="row">
                {r.name}
              </th>
              {columns.map((col) => {
                const c = r.cells[col.index]!;
                return (
                  <td key={col.label} className={c.targets.length === 0 ? 'is-empty' : undefined}>
                    {c.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

function Resizer() {
  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = useTools.getState().sideWidth;
    const onMove = (ev: PointerEvent) => useTools.getState().setSideWidth(startW + (startX - ev.clientX));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('fx-resizing');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.classList.add('fx-resizing');
  };
  return (
    <div
      className="fx-resizer"
      onPointerDown={onPointerDown}
      onDoubleClick={() => useTools.getState().setSideWidth(380)}
      role="separator"
      aria-orientation="vertical"
      aria-label="Largura do painel (arraste)"
    />
  );
}

export function SidePanel() {
  const doc = useActiveDoc();
  const collapsed = useTools((s) => s.sideCollapsed);
  const width = useTools((s) => s.sideWidth);
  const setCollapsed = useTools((s) => s.setSideCollapsed);
  const prov = useTools((s) => s.provenance[doc.id]);
  const fa = faOf(doc) ?? EMPTY_FA;
  const type = useMemo(() => classify(fa), [fa]);
  // AP e MT: o tipo deles (AP/APD, MTD/MTN), a definição formal e, na MT, a tabela
  const a = doc.automaton;
  const kind = a.kind;
  const machine = useMemo(() => (a.kind === 'pda' ? { kind: 'pda' as const, pda: a.pda } : a.kind === 'tm' ? { kind: 'tm' as const, tm: a.tm } : null), [a]);
  const mType = useMemo(() => (machine ? machineType(machine) : null), [machine]);
  const badge = mType ? <MachineTypeBadge type={mType} /> : <TypeBadge type={type} />;

  if (collapsed) {
    return (
      <div className="fx-rail">
        <button
          type="button"
          className="ed-icon-btn"
          onClick={() => setCollapsed(false)}
          aria-label="Abrir o painel lateral"
          data-tip="Mostrar definição e tabelas"
          data-tip-align="end"
        >
          <PanelRightOpen size={17} />
        </button>
        <span className="fx-rail-type">{mType ? <MachineTypeBadge type={mType} small /> : <TypeBadge type={type} small />}</span>
      </div>
    );
  }

  const graph = graphOf(doc.automaton);
  const nStates = graph.states.length;
  const nTrans = graph.transitions.length;
  return (
    <div className="fx-side" style={{ width }}>
      <Resizer />
      <header className="fx-side-head">
        {badge}
        <div className="fx-side-title">
          <strong title={doc.name}>{doc.name}</strong>
          <span>
            {nStates} {nStates === 1 ? 'estado' : 'estados'} · {nTrans} {nTrans === 1 ? 'transição' : 'transições'}
          </span>
        </div>
        <button
          type="button"
          className="ed-icon-btn sm"
          onClick={() => setCollapsed(true)}
          aria-label="Recolher o painel lateral"
          data-tip="Recolher"
          data-tip-align="end"
        >
          <PanelRightClose size={16} />
        </button>
      </header>
      <div className="fx-side-scroll">
        {machine ? <MachineIssues automaton={machine} /> : <Issues fa={fa} />}
        {machine ? (
          nStates === 0 && !prov ? (
            <div className="fx-hint">
              <KindBadge kind={kind} />
              <p>
                Desenhe {kind === 'pda' ? 'o autômato com pilha' : 'a máquina de Turing'} ou abra um pronto em <b>Exemplos</b>.
                Aqui aparecem a definição formal{kind === 'tm' ? ' e a tabela de transição' : ' e a função de transição δ'}.
              </p>
            </div>
          ) : (
            <>
              {prov && <Origin doc={doc} prov={prov} />}
              <MachineSections automaton={machine} />
            </>
          )
        ) : nStates === 0 && !prov ? (
          <div className="fx-hint">
            <Info size={16} />
            <p>
              Desenhe um autômato ou abra um pronto em <b>Exemplos</b>. Aqui aparecem a definição formal, a tabela de
              transição e as tabelas passo a passo dos algoritmos.
            </p>
          </div>
        ) : (
          <>
            {prov && <Origin doc={doc} prov={prov} />}
            <Section id="formal" title="Definição formal">
              <Formal fa={fa} />
            </Section>
            <Section id="table" title="Tabela de transição">
              <TransitionTableView fa={fa} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
