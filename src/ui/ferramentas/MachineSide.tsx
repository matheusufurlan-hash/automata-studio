/**
 * Painel lateral de AP e MT: o tipo (AP/APD, MTD/MTN), os avisos do
 * validate, a definição formal na notação do Hopcroft e, na MT, a tabela de
 * transição como a figura 8.10 do livro. Durante a simulação, a linha de δ
 * (AP) ou a célula da tabela (MT) da regra usada acende.
 */
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { CircleAlert } from 'lucide-react';
import type { RuleRef } from '../../core/common';
import { classify as classifyPDA, formalDefinition as pdaFormalDefinition, validate as validatePDA } from '../../core/pda';
import type { PDA } from '../../core/pda/types';
import { classify as classifyTM, formalDefinition as tmFormalDefinition, validate as validateTM } from '../../core/tm';
import type { TM } from '../../core/tm/types';
import { useEditorUi } from '../../store/editorUi';
import { useHighlight } from '../../store/highlight';
import { MathText } from '../simulacao/MathText';
import type { MachineType } from './machineFormat';
import {
  issueTargets,
  MACHINE_TYPE_DESCRIPTION,
  MACHINE_TYPE_LABEL,
  pdaFormalLines,
  pdaIssueText,
  tmFormalLines,
  tmIssueText,
  tmTable,
} from './machineFormat';
import { Section } from './parts';

export function MachineTypeBadge({ type, small = false }: { type: MachineType; small?: boolean }) {
  return (
    <span className={`fx-type fx-type-${type.toLowerCase()}${small ? ' sm' : ''}`} title={MACHINE_TYPE_DESCRIPTION[type]}>
      {MACHINE_TYPE_LABEL[type]}
    </span>
  );
}

export function machineType(a: { kind: 'pda'; pda: PDA } | { kind: 'tm'; tm: TM }): MachineType {
  return a.kind === 'pda' ? classifyPDA(a.pda) : classifyTM(a.tm);
}

/* ------------------------------------------------------------------ */
/* Avisos                                                              */
/* ------------------------------------------------------------------ */

export function MachineIssues({ automaton }: { automaton: { kind: 'pda'; pda: PDA } | { kind: 'tm'; tm: TM } }) {
  const items = useMemo(() => {
    if (automaton.kind === 'pda') {
      const pda = automaton.pda;
      return pda.states.length ? validatePDA(pda).map((i) => ({ text: pdaIssueText(pda, i), target: issueTargets(i) })) : [];
    }
    const tm = automaton.tm;
    return tm.states.length ? validateTM(tm).map((i) => ({ text: tmIssueText(tm, i), target: issueTargets(i) })) : [];
  }, [automaton]);
  if (items.length === 0) return null;
  return (
    <ul className="fx-issues">
      {items.map((it, i) => (
        <li key={i}>
          <button
            type="button"
            className="fx-issue"
            onClick={() => it.target && useEditorUi.getState().select(it.target)}
            disabled={!it.target}
          >
            <CircleAlert size={15} />
            <span>{it.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Regra usada no passo (destaque)                                     */
/* ------------------------------------------------------------------ */

/** A 1ª regra destacada no canvas, se for desta transição/autômato. */
function useUsedRule(): RuleRef | null {
  const rules = useHighlight((h) => h.rules);
  return rules && rules.length > 0 ? rules[0]! : null;
}

/* ------------------------------------------------------------------ */
/* AP: P = (Q, Σ, Γ, δ, q0, Z0, F)                                     */
/* ------------------------------------------------------------------ */

export function PDAFormal({ pda }: { pda: PDA }) {
  const def = useMemo(() => pdaFormalDefinition(pda), [pda]);
  const lines = pdaFormalLines(def);
  return (
    <div className="fx-formal">
      <div className="fx-formal-tuple">
        P = (Q, Σ, Γ, δ, q<sub>0</sub>, Z<sub>0</sub>, F)
      </div>
      <dl>
        <dt>Q</dt>
        <dd>{lines.Q}</dd>
        <dt>Σ</dt>
        <dd>{lines.Sigma}</dd>
        <dt>Γ</dt>
        <dd>{lines.Gamma}</dd>
        <dt>
          q<sub>0</sub>
        </dt>
        <dd>{lines.q0}</dd>
        <dt>
          Z<sub>0</sub>
        </dt>
        <dd>{lines.Z0}</dd>
        <dt>F</dt>
        <dd>{lines.F}</dd>
      </dl>
      <p className="fx-formal-mode">
        {def.acceptance === 'EMPTY_STACK' ? (
          <>
            Aceita por <b>pilha vazia</b>: N(P), as palavras que esvaziam a pilha (F não importa).
          </>
        ) : (
          <>
            Aceita por <b>estado final</b>: L(P), as palavras que levam a um estado de F.
          </>
        )}
      </p>
    </div>
  );
}

export function PDADelta({ pda }: { pda: PDA }) {
  const def = useMemo(() => pdaFormalDefinition(pda), [pda]);
  const lines = pdaFormalLines(def);
  const used = useUsedRule();
  const status = useHighlight((h) => h.status);
  // a linha de δ da regra usada: (estado de origem, a, X) e o destino (p, γ)
  const lit = useMemo(() => {
    if (!used) return null;
    const t = pda.transitions.find((x) => x.id === used.transition);
    const r = t?.rules[used.rule];
    if (!t || !r) return null;
    const name = (id: string) => pda.states.find((s) => s.id === id)?.name ?? id;
    return { from: name(t.from), read: r.read, pop: r.pop, to: name(t.to), push: r.push };
  }, [used, pda]);
  if (lines.delta.length === 0) return <div className="fx-empty-line">Sem regras ainda: δ é vazia.</div>;
  return (
    <ul className="fx-delta">
      {lines.delta.map((d, k) => {
        const on = !!lit && lit.from === d.from && lit.read === d.read && lit.pop === d.pop;
        const line = def.delta[k]!;
        return (
          <li key={k} className={on ? `is-lit lit-${status === 'idle' ? 'running' : status}` : undefined}>
            <MathText text={d.text} /> = {'{'}
            {line.to.map((t, j) => (
              <Fragment key={j}>
                {j > 0 && ', '}
                <span className={on && lit!.to === t.state && lit!.push === t.push ? 'fx-delta-used' : undefined}>
                  <MathText text={`(${t.state}, ${t.push || 'ε'})`} />
                </span>
              </Fragment>
            ))}
            {'}'}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* MT: M = (Q, Σ, Γ, δ, q0, B, F) e a tabela                          */
/* ------------------------------------------------------------------ */

export function TMFormal({ tm }: { tm: TM }) {
  const def = useMemo(() => tmFormalDefinition(tm), [tm]);
  const lines = tmFormalLines(def);
  return (
    <div className="fx-formal">
      <div className="fx-formal-tuple">
        M = (Q, Σ, Γ, δ, q<sub>0</sub>, B, F)
      </div>
      <dl>
        <dt>Q</dt>
        <dd>{lines.Q}</dd>
        <dt>Σ</dt>
        <dd>
          {lines.Sigma}
          {def.inputAlphabetGuessed && (
            <span className="fx-guess" title="Σ não foi informado: o palpite é Γ − {B}. Informe Σ nas propriedades da MT.">
              palpite
            </span>
          )}
        </dd>
        <dt>Γ</dt>
        <dd>{lines.Gamma}</dd>
        <dt>
          q<sub>0</sub>
        </dt>
        <dd>{lines.q0}</dd>
        <dt>B</dt>
        <dd>{lines.B}</dd>
        <dt>F</dt>
        <dd>{lines.F}</dd>
        <dt>δ</dt>
        <dd className="fx-formal-note">
          {def.delta.length === 0 ? 'sem regras' : <MathText text="δ(q, X) = (p, Y, D), com D = → ou ← (tabela abaixo)" />}
        </dd>
      </dl>
      <p className="fx-formal-mode">
        {def.acceptance === 'HALT' ? (
          <>
            Aceita <b>quando para</b>, em qualquer estado: a resposta é o que fica na fita (MT que calcula função).
          </>
        ) : (
          <>
            Aceita <b>ao entrar num estado final</b> (e para); se parar fora de F, rejeita.
          </>
        )}
      </p>
    </div>
  );
}

export function TMTableView({ tm }: { tm: TM }) {
  const def = useMemo(() => tmFormalDefinition(tm), [tm]);
  const table = useMemo(() => tmTable(def, def.initial, def.finals), [def]);
  const active = useHighlight((h) => h.active);
  const status = useHighlight((h) => h.status);
  const used = useUsedRule();
  const names = useMemo(() => new Map(tm.states.map((s) => [s.id, s.name])), [tm]);
  const litRows = new Set(active.map((id) => names.get(id) ?? id));
  // célula da regra usada: (estado de origem, símbolo lido)
  const usedCell = useMemo(() => {
    if (!used) return null;
    const t = tm.transitions.find((x) => x.id === used.transition);
    const r = t?.rules[used.rule];
    return t && r ? { row: names.get(t.from) ?? t.from, symbol: r.read } : null;
  }, [used, tm, names]);
  // a tabela pode ser mais larga que o painel: rola de lado até a célula da regra usada ficar à vista
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !usedCell) return;
    const reveal = () => {
      const cell = wrap.querySelector<HTMLElement>('td.is-used');
      if (!cell) return;
      const left = cell.offsetLeft;
      const right = left + cell.offsetWidth;
      if (left < wrap.scrollLeft) wrap.scrollLeft = Math.max(0, left - 12);
      else if (right > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = right - wrap.clientWidth + 12;
    };
    reveal();
    // a tabela ainda pode mudar de largura (fonte terminando de carregar, painel redimensionado): mostra de novo
    const table = wrap.querySelector('table');
    if (!table || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(reveal);
    observer.observe(table);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [usedCell]);
  if (table.rows.length === 0) return <div className="fx-empty-line">Sem estados.</div>;
  return (
    <div className="fx-table-wrap" ref={wrapRef}>
      <table className="fx-table fx-tm-table">
        <thead>
          <tr>
            <th className="fx-mark" />
            <th className="fx-rowhead">δ</th>
            {table.symbols.map((s) => (
              <th key={s} className={s === def.blank ? 'is-blank' : undefined} title={s === def.blank ? 'o branco' : undefined}>
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.name} className={litRows.has(r.name) ? `is-lit lit-${status === 'idle' ? 'running' : status}` : undefined}>
              <td className="fx-mark">
                {r.initial && <span className="fx-arrow">→</span>}
                {r.final && <span className="fx-star">*</span>}
              </td>
              <th className="fx-rowhead" scope="row">
                {r.name}
              </th>
              {r.cells.map((c) => {
                const on = !!usedCell && usedCell.row === r.name && usedCell.symbol === c.symbol;
                return (
                  <td key={c.symbol} className={[c.moves.length === 0 ? 'is-empty' : '', on ? 'is-used' : ''].join(' ').trim() || undefined}>
                    {c.moves.length === 0
                      ? '–'
                      : c.moves.map((m, j) => (
                          <div key={j}>
                            <MathText text={m} />
                          </div>
                        ))}
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

/** As seções do painel para AP/MT. */
export function MachineSections({ automaton }: { automaton: { kind: 'pda'; pda: PDA } | { kind: 'tm'; tm: TM } }) {
  if (automaton.kind === 'pda') {
    return (
      <>
        <Section id="formal" title="Definição formal">
          <PDAFormal pda={automaton.pda} />
        </Section>
        <Section id="delta" title="Função de transição">
          <PDADelta pda={automaton.pda} />
        </Section>
      </>
    );
  }
  return (
    <>
      <Section id="formal" title="Definição formal">
        <TMFormal tm={automaton.tm} />
      </Section>
      <Section id="table" title="Tabela de transição">
        <TMTableView tm={automaton.tm} />
      </Section>
    </>
  );
}
