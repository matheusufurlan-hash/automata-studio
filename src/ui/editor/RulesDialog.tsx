/**
 * Janelas de regras do AP ("a, X/γ") e da MT ("X/Y →"), uma regra por linha.
 *  - Lista: os campos de cada regra, com botão ε (AP: em `a` e em `γ`) ou o
 *    branco (MT); "+ Regra" e × para remover. Colar regras num campo também vale;
 *  - Texto: várias regras de uma vez, uma por linha ("0, Z / 0Z" ou "0/X R").
 * Confirmar troca as regras da transição (sem regras = apaga a transição).
 * Linhas vazias são ignoradas; regras repetidas entram uma vez só.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash, X } from 'lucide-react';
import { graphOf } from '../../core/automaton';
import { EPSILON } from '../../core/fa/types';
import type { PDARule } from '../../core/pda/types';
import { DEFAULT_BLANK } from '../../core/tm/types';
import type { TMMove, TMRule } from '../../core/tm/types';
import { normalizeRules, pdaOf, pdaRuleKey, tmOf, tmRuleKey, useActiveDoc, useDocuments } from '../../store/documents';
import type { DialogState } from '../../store/editorUi';
import { Anchored, closeDialog } from './DialogFrame';
import { Kbd } from './Menu';
import type { FieldError, LineError, RuleField } from './rules';
import { ARROW, formatPDARule, formatTMRule, parsePDAFields, parsePDAText, parseTMFields, parseTMText } from './rules';

type TransitionDialog = Extract<DialogState, { kind: 'transition' }>;
type Mode = 'list' | 'text';

/* ------------------------------------------------------------------ */
/* Lógica comum (linhas, modo texto, erros)                            */
/* ------------------------------------------------------------------ */

interface RowBase {
  id: number;
}

/** O que muda entre AP e MT. */
interface RulesKind<Row extends RowBase, Rule> {
  emptyRow(): Omit<Row, 'id'>;
  rowFromRule(r: Rule): Omit<Row, 'id'>;
  parseRow(row: Row): { rule: Rule | null; errors: FieldError[] };
  /** Texto da linha para o modo Texto (null = linha vazia). */
  rowText(row: Row): string | null;
  /** Valor do campo (para saber se está vazio). */
  field(row: Row, f: RuleField): string;
  parseText(text: string): { rules: Rule[]; errors: LineError[] };
  key(r: Rule): string;
}

/** Põe o foco num campo da lista depois que a tela atualizar (ex.: na regra que acabou de entrar). */
function focusLater(key: string) {
  if (typeof requestAnimationFrame === 'undefined') return;
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLInputElement>(`[data-rule-field="${key}"]`);
    el?.focus();
    el?.select();
  });
}

let rowCounter = 0;
const withId = <Row extends RowBase>(r: Omit<Row, 'id'>): Row => ({ ...r, id: ++rowCounter }) as Row;

/** Linhas (sem id) das regras que já existem. */
function rows0<Row extends RowBase, Rule>(kind: RulesKind<Row, Rule>, rules: readonly Rule[]): Array<Omit<Row, 'id'>> {
  return rules.map((r) => kind.rowFromRule(r));
}

/** Texto do modo Texto para estas linhas (as vazias ficam de fora). */
function textOfRules<Row extends RowBase, Rule>(kind: RulesKind<Row, Rule>, rows: ReadonlyArray<Omit<Row, 'id'>>): string {
  return rows
    .map((r) => kind.rowText({ ...r, id: 0 } as Row))
    .filter((x): x is string => x !== null)
    .join('\n');
}

function useRulesEditor<Row extends RowBase, Rule>(kind: RulesKind<Row, Rule>, initial: readonly Rule[], startMode: Mode) {
  const make = (r: Omit<Row, 'id'>) => withId<Row>(r);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length ? initial.map((r) => make(kind.rowFromRule(r))) : [make(kind.emptyRow())],
  );
  const [mode, setModeState] = useState<Mode>(startMode);
  const [text, setText] = useState(() => (startMode === 'text' ? textOfRules(kind, rows0(kind, initial)) : ''));
  /** Depois de tentar confirmar, todos os erros aparecem (antes, só os de campos já preenchidos). */
  const [tried, setTried] = useState(false);

  const parsed = useMemo(() => rows.map((row) => ({ row, ...kind.parseRow(row) })), [rows, kind]);
  const listRules = useMemo(
    () =>
      normalizeRules(
        parsed.flatMap((p) => (p.rule ? [p.rule] : [])),
        kind.key,
      ),
    [parsed, kind],
  );
  const filled = parsed.filter((p) => p.rule || p.errors.length).length;
  const duplicates = parsed.filter((p) => p.rule).length - listRules.length;
  const textParsed = useMemo(() => kind.parseText(text), [text, kind]);

  const shown = (row: Row, e: FieldError) => tried || (e.field !== null && kind.field(row, e.field).trim() !== '');
  const listErrors = parsed.flatMap((p, i) =>
    p.errors.filter((e) => shown(p.row, e)).map((e) => (rows.length > 1 ? `Regra ${i + 1}: ${e.message}` : cap(e.message))),
  );
  const invalid = (row: Row, f: RuleField) => {
    const p = parsed.find((x) => x.row.id === row.id);
    return !!p && p.errors.some((e) => e.field === f && shown(row, e));
  };

  const textOf = (list: readonly Row[]) =>
    list
      .map((r) => kind.rowText(r))
      .filter((x): x is string => x !== null)
      .join('\n');

  const update = (id: number, patch: Partial<Omit<Row, 'id'>>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? ({ ...r, ...patch } as Row) : r)));

  const addRow = () => {
    const row = make(kind.emptyRow());
    setRows((rs) => [...rs, row]);
    focusLater(`${row.id}:0`);
  };

  const removeRow = (id: number) => {
    const idx = rows.findIndex((r) => r.id === id);
    const rest = rows.filter((r) => r.id !== id);
    if (rest.length === 0) {
      const row = make(kind.emptyRow());
      setRows([row]);
      focusLater(`${row.id}:0`);
      return;
    }
    setRows(rest);
    focusLater(`${rest[Math.max(0, idx - 1)]!.id}:0`);
  };

  /** Troca de modo. Do texto para a lista só vai se o texto não tiver erro. */
  const setMode = (m: Mode) => {
    if (m === mode) return;
    if (m === 'text') {
      setText(textOf(rows));
      setTried(false);
      setModeState('text');
      return;
    }
    const p = kind.parseText(text);
    if (p.errors.length) {
      setTried(true);
      return;
    }
    const next = p.rules.length ? normalizeRules(p.rules, kind.key).map((r) => make(kind.rowFromRule(r))) : [make(kind.emptyRow())];
    setRows(next);
    setTried(false);
    setModeState('list');
  };

  /** Colar várias regras (ou uma regra inteira) num campo da lista. */
  const onPaste = (row: Row) => (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const p = kind.parseText(pasted);
    if (!pasted.includes('\n') && p.rules.length === 0) return; // colagem comum (um símbolo)
    e.preventDefault();
    const keepRow = kind.rowText(row) !== null;
    const idx = rows.findIndex((r) => r.id === row.id);
    const before = rows.slice(0, idx + (keepRow ? 1 : 0));
    const after = rows.slice(idx + 1);
    if (p.errors.length) {
      // com erro: vai para o modo Texto, para corrigir
      setText([textOf(before), pasted.trim(), textOf(after)].filter(Boolean).join('\n'));
      setTried(true);
      setModeState('text');
      return;
    }
    const added = p.rules.map((r) => make(kind.rowFromRule(r)));
    setRows([...before, ...added, ...after]);
    focusLater(`${added[added.length - 1]!.id}:0`);
  };

  /** Regras prontas para gravar, ou null se houver erro (aí os erros aparecem). */
  const result = (): Rule[] | null => {
    if (mode === 'text') {
      if (textParsed.errors.length) {
        setTried(true);
        return null;
      }
      return normalizeRules(textParsed.rules, kind.key);
    }
    if (parsed.some((p) => p.errors.length)) {
      setTried(true);
      return null;
    }
    return listRules;
  };

  const errors =
    mode === 'text' ? (tried ? textParsed.errors.map((e) => `Linha ${e.line}: ${e.message}`) : []) : listErrors;
  const count = mode === 'text' ? normalizeRules(textParsed.rules, kind.key).length + textParsed.errors.length : filled;

  return {
    rows,
    mode,
    setMode,
    text,
    setText,
    update,
    addRow,
    removeRow,
    onPaste,
    invalid,
    errors,
    duplicates: mode === 'list' ? duplicates : 0,
    empty: count === 0,
    result,
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */

function RuleInput({
  value,
  onChange,
  label,
  placeholder,
  invalid,
  quick,
  quickTitle,
  onQuick,
  focusKey,
  onKeyDown,
  onPaste,
}: {
  value: string;
  onChange(v: string): void;
  label: string;
  placeholder?: string;
  invalid: boolean;
  /** Botão rápido dentro do campo (ε no AP, o branco na MT). */
  quick?: string;
  quickTitle?: string;
  onQuick?(): void;
  focusKey: string;
  onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>): void;
  onPaste(e: ClipboardEvent<HTMLInputElement>): void;
}) {
  // o botão some quando o campo já tem o que ele põe (ex.: "ε")
  if (quick && value.trim() === quick) quick = undefined;
  return (
    <span className={invalid ? 'ed-rule-field is-invalid' : 'ed-rule-field'}>
      <input
        className={quick ? 'has-quick' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid || undefined}
        data-rule-field={focusKey}
        spellCheck={false}
        autoComplete="off"
      />
      {quick && (
        <button
          type="button"
          className={quick === EPSILON ? 'ed-rule-quick eps' : 'ed-rule-quick'}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onQuick}
          title={quickTitle}
          aria-label={quickTitle}
        >
          {quick}
        </button>
      )}
    </span>
  );
}

function RemoveButton({ onClick, n }: { onClick(): void; n: number }) {
  return (
    <button type="button" className="ed-icon-btn sm ed-rule-remove" onClick={onClick} aria-label={`Remover a regra ${n}`} title="Remover regra">
      <X size={15} />
    </button>
  );
}

interface ShellProps {
  d: TransitionDialog;
  existingId: string | undefined;
  hint: ReactNode;
  mode: Mode;
  setMode(m: Mode): void;
  textHint: string;
  text: string;
  setText(t: string): void;
  list: ReactNode;
  addRow(): void;
  errors: string[];
  duplicates: number;
  empty: boolean;
  confirm(): void;
  listKeys: ReactNode;
}

/** Moldura comum: título, Lista/Texto, erros e botões. */
function RulesShell(p: ShellProps) {
  const doc = useActiveDoc();
  const states = graphOf(doc.automaton).states;
  const nameOf = (id: string) => states.find((s) => s.id === id)?.name ?? '?';
  const root = useRef<HTMLDivElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const willDelete = !!p.existingId && p.empty;

  // foco ao abrir e ao trocar de modo: 1º campo da lista ou a caixa de texto
  const { mode } = p;
  useEffect(() => {
    if (mode === 'text') {
      textArea.current?.focus();
      return;
    }
    const el = root.current?.querySelector<HTMLInputElement>('[data-rule-field]');
    el?.focus();
    el?.select();
  }, [mode]);

  const onTextKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      p.confirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
    }
  };

  return (
    <div ref={root}>
      <div className="ed-rules-head">
        <h2>{p.existingId ? 'Editar transição' : 'Nova transição'}</h2>
        <div className="ed-seg" role="radiogroup" aria-label="Como editar">
          {(['list', 'text'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={p.mode === m}
              className={p.mode === m ? 'is-on' : undefined}
              onClick={() => p.setMode(m)}
              title={m === 'list' ? 'Um campo para cada parte da regra' : 'Várias regras de uma vez, uma por linha'}
            >
              {m === 'list' ? 'Lista' : 'Texto'}
            </button>
          ))}
        </div>
      </div>
      <p className="sub">
        <span className="ed-pair">
          <span className="ed-chip">{nameOf(p.d.from)}</span>
          <ArrowRight size={14} />
          <span className="ed-chip">{nameOf(p.d.to)}</span>
        </span>
        <span className="ed-rules-hint">{p.hint}</span>
      </p>

      {p.mode === 'list' ? (
        <>
          {p.list}
          <button type="button" className="ed-btn ghost ed-rules-add" onClick={p.addRow}>
            <Plus size={15} /> Regra
          </button>
        </>
      ) : (
        <textarea
          ref={textArea}
          className="ed-rules-text"
          value={p.text}
          onChange={(e) => p.setText(e.target.value)}
          onKeyDown={onTextKey}
          placeholder={p.textHint}
          aria-label="Regras, uma por linha"
          spellCheck={false}
          rows={6}
        />
      )}

      {p.errors.length > 0 && (
        <ul className="ed-rule-errors" aria-live="polite">
          {p.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {p.errors.length === 0 && willDelete && (
        <div className="ed-rule-note is-danger">Sem regras: a transição será apagada.</div>
      )}
      {p.errors.length === 0 && p.duplicates > 0 && (
        <div className="ed-rule-note">
          {p.duplicates === 1 ? 'Uma regra repetida vai entrar uma vez só.' : `${p.duplicates} regras repetidas vão entrar uma vez só.`}
        </div>
      )}

      <div className="ed-actions">
        {p.existingId && (
          <button
            type="button"
            className="ed-btn ghost danger"
            onClick={() => {
              useDocuments.getState().setTransitionRules(p.existingId!, []);
              closeDialog();
            }}
          >
            <Trash size={15} /> Apagar
          </button>
        )}
        <span className="grow" />
        <button type="button" className="ed-btn ghost" onClick={closeDialog}>
          Cancelar
        </button>
        <button type="button" className="ed-btn primary" onClick={p.confirm} disabled={!p.existingId && p.empty}>
          {willDelete ? 'Apagar' : 'OK'}
        </button>
      </div>
      <div className="ed-hint">
        {p.mode === 'list' ? (
          p.listKeys
        ) : (
          <>
            Uma regra por linha · <Kbd keys={['Ctrl', 'Enter']} /> confirma · <Kbd keys={['Esc']} /> cancela
          </>
        )}
      </div>
    </div>
  );
}

/** Teclas dos campos da lista: Enter confirma, Esc cancela, e o atalho do botão rápido. */
function fieldKeys(confirm: () => void, quick?: () => void) {
  return (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (quick && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      quick();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
    }
  };
}

/* ------------------------------------------------------------------ */
/* AP: a, X / γ                                                        */
/* ------------------------------------------------------------------ */

interface PDARow extends RowBase {
  read: string;
  pop: string;
  push: string;
}

const PDA_KIND: RulesKind<PDARow, PDARule> = {
  emptyRow: () => ({ read: '', pop: '', push: '' }),
  rowFromRule: (r) => ({ read: r.read, pop: r.pop, push: r.push === '' ? EPSILON : r.push }),
  parseRow: (row) => parsePDAFields(row.read, row.pop, row.push),
  rowText: (row) => {
    const r = parsePDAFields(row.read, row.pop, row.push);
    if (r.rule) return formatPDARule(r.rule);
    if (!row.read.trim() && !row.pop.trim() && !row.push.trim()) return null;
    return `${row.read.trim() || EPSILON}, ${row.pop.trim()}/${row.push.trim() || EPSILON}`;
  },
  field: (row, f) => (f === 'read' ? row.read : f === 'pop' ? row.pop : f === 'push' ? row.push : ''),
  parseText: parsePDAText,
  key: pdaRuleKey,
};

export function PDARulesDialog({ d }: { d: TransitionDialog }) {
  const pda = pdaOf(useActiveDoc());
  const existing =
    pda?.transitions.find((t) => t.id === d.transitionId) ?? pda?.transitions.find((t) => t.from === d.from && t.to === d.to);
  const ed = useRulesEditor(PDA_KIND, existing?.rules ?? [], d.mode ?? 'list');
  if (!pda) return null;

  const confirm = () => {
    const rules = ed.result();
    if (!rules) return;
    const st = useDocuments.getState();
    if (existing) st.setTransitionRules(existing.id, rules);
    else if (rules.length > 0) st.setRules(d.from, d.to, rules);
    closeDialog();
  };

  const list = (
    <div className="ed-rules pda">
      <div className="ed-rules-cols" aria-hidden>
        <span title="O símbolo lido da entrada (ou ε: não lê nada)">a</span>
        <span />
        <span title="O topo da pilha: sempre é desempilhado">X</span>
        <span />
        <span title="O que entra no lugar de X (o 1º símbolo fica no topo; ε = nada)">γ</span>
        <span />
      </div>
      <div className="ed-rules-list">
        {ed.rows.map((row, i) => {
          const setEps = (f: 'read' | 'push') => () => ed.update(row.id, { [f]: EPSILON });
          return (
            <div key={row.id} className="ed-rule-row" role="group" aria-label={`Regra ${i + 1}`}>
              <RuleInput
                value={row.read}
                onChange={(v) => ed.update(row.id, { read: v })}
                label={`Regra ${i + 1}: a (símbolo lido ou ε)`}
                placeholder={EPSILON}
                invalid={ed.invalid(row, 'read')}
                quick={EPSILON}
                quickTitle="ε: não lê nada (Ctrl+E)"
                onQuick={setEps('read')}
                focusKey={`${row.id}:0`}
                onKeyDown={fieldKeys(confirm, setEps('read'))}
                onPaste={ed.onPaste(row)}
              />
              <span className="ed-rule-sep">,</span>
              <RuleInput
                value={row.pop}
                onChange={(v) => ed.update(row.id, { pop: v })}
                label={`Regra ${i + 1}: X (topo da pilha)`}
                invalid={ed.invalid(row, 'pop')}
                focusKey={`${row.id}:1`}
                onKeyDown={fieldKeys(confirm)}
                onPaste={ed.onPaste(row)}
              />
              <span className="ed-rule-sep">/</span>
              <RuleInput
                value={row.push}
                onChange={(v) => ed.update(row.id, { push: v })}
                label={`Regra ${i + 1}: γ (o que empilha)`}
                placeholder={EPSILON}
                invalid={ed.invalid(row, 'push')}
                quick={EPSILON}
                quickTitle="ε: não empilha nada (Ctrl+E)"
                onQuick={setEps('push')}
                focusKey={`${row.id}:2`}
                onKeyDown={fieldKeys(confirm, setEps('push'))}
                onPaste={ed.onPaste(row)}
              />
              <RemoveButton onClick={() => ed.removeRow(row.id)} n={i + 1} />
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Anchored x={d.x} y={d.y} label="Regras da transição" className="rules">
      <RulesShell
        d={d}
        existingId={existing?.id}
        hint="Lê a (ou ε), desempilha X e empilha γ: o 1º símbolo de γ fica no topo."
        mode={ed.mode}
        setMode={ed.setMode}
        textHint={'Uma regra por linha, ex.:\n0, Z/0Z\n0, 0/00\n1, 0/ε\nε, Z/Z'}
        text={ed.text}
        setText={ed.setText}
        list={list}
        addRow={ed.addRow}
        errors={ed.errors}
        duplicates={ed.duplicates}
        empty={ed.empty}
        confirm={confirm}
        listKeys={
          <>
            <Kbd keys={['Enter']} /> confirma · <Kbd keys={['Ctrl', 'E']} /> põe ε · <Kbd keys={['Esc']} /> cancela
          </>
        }
      />
    </Anchored>
  );
}

/* ------------------------------------------------------------------ */
/* MT: X / Y →                                                         */
/* ------------------------------------------------------------------ */

interface TMRow extends RowBase {
  read: string;
  write: string;
  move: TMMove;
}

const TM_KIND: RulesKind<TMRow, TMRule> = {
  emptyRow: () => ({ read: '', write: '', move: 'R' }),
  rowFromRule: (r) => ({ read: r.read, write: r.write, move: r.move }),
  parseRow: (row) => parseTMFields(row.read, row.write, row.move),
  rowText: (row) => {
    const r = parseTMFields(row.read, row.write, row.move);
    if (r.rule) return formatTMRule(r.rule);
    if (!row.read.trim() && !row.write.trim()) return null;
    return `${row.read.trim()}/${row.write.trim()} ${ARROW[row.move]}`;
  },
  field: (row, f) => (f === 'read' ? row.read : f === 'write' ? row.write : ''),
  parseText: parseTMText,
  key: tmRuleKey,
};

export function TMRulesDialog({ d }: { d: TransitionDialog }) {
  const tm = tmOf(useActiveDoc());
  const existing =
    tm?.transitions.find((t) => t.id === d.transitionId) ?? tm?.transitions.find((t) => t.from === d.from && t.to === d.to);
  const ed = useRulesEditor(TM_KIND, existing?.rules ?? [], d.mode ?? 'list');
  if (!tm) return null;
  const blank = tm.blank || DEFAULT_BLANK;

  const confirm = () => {
    const rules = ed.result();
    if (!rules) return;
    const st = useDocuments.getState();
    if (existing) st.setTransitionRules(existing.id, rules);
    else if (rules.length > 0) st.setRules(d.from, d.to, rules);
    closeDialog();
  };

  const list = (
    <div className="ed-rules tm">
      <div className="ed-rules-cols" aria-hidden>
        <span title="O símbolo lido na fita">X</span>
        <span />
        <span title="O símbolo escrito no lugar de X">Y</span>
        <span title="Para onde a cabeça vai">direção</span>
        <span />
      </div>
      <div className="ed-rules-list">
        {ed.rows.map((row, i) => (
          <div key={row.id} className="ed-rule-row" role="group" aria-label={`Regra ${i + 1}`}>
            <RuleInput
              value={row.read}
              onChange={(v) => ed.update(row.id, { read: v })}
              label={`Regra ${i + 1}: X (símbolo lido)`}
              invalid={ed.invalid(row, 'read')}
              quick={blank}
              quickTitle={`Branco (${blank})`}
              onQuick={() => ed.update(row.id, { read: blank })}
              focusKey={`${row.id}:0`}
              onKeyDown={fieldKeys(confirm)}
              onPaste={ed.onPaste(row)}
            />
            <span className="ed-rule-sep">/</span>
            <RuleInput
              value={row.write}
              onChange={(v) => ed.update(row.id, { write: v })}
              label={`Regra ${i + 1}: Y (símbolo escrito)`}
              invalid={ed.invalid(row, 'write')}
              quick={blank}
              quickTitle={`Branco (${blank})`}
              onQuick={() => ed.update(row.id, { write: blank })}
              focusKey={`${row.id}:1`}
              onKeyDown={fieldKeys(confirm)}
              onPaste={ed.onPaste(row)}
            />
            <div className="ed-seg ed-rule-move" role="radiogroup" aria-label={`Regra ${i + 1}: direção`}>
              {(['L', 'R'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={row.move === m}
                  className={row.move === m ? 'is-on' : undefined}
                  onClick={() => ed.update(row.id, { move: m })}
                  title={m === 'L' ? 'Esquerda (L)' : 'Direita (R)'}
                  aria-label={m === 'L' ? 'Esquerda' : 'Direita'}
                >
                  {m === 'L' ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                </button>
              ))}
            </div>
            <RemoveButton onClick={() => ed.removeRow(row.id)} n={i + 1} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Anchored x={d.x} y={d.y} label="Regras da transição" className="rules narrow">
      <RulesShell
        d={d}
        existingId={existing?.id}
        hint={`Lê X, escreve Y e move a cabeça uma célula (← ou →). O branco é ${blank}.`}
        mode={ed.mode}
        setMode={ed.setMode}
        textHint={'Uma regra por linha, ex.:\n0/X R\nY/Y →\n1 / Y, L'}
        text={ed.text}
        setText={ed.setText}
        list={list}
        addRow={ed.addRow}
        errors={ed.errors}
        duplicates={ed.duplicates}
        empty={ed.empty}
        confirm={confirm}
        listKeys={
          <>
            <Kbd keys={['Enter']} /> confirma · <Kbd keys={['Esc']} /> cancela
          </>
        }
      />
    </Anchored>
  );
}
