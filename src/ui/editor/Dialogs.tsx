/**
 * Janelas do editor: transição (símbolos do AF; regras do AP e da MT em
 * RulesDialog.tsx), renomear estado, salvar como, fechar sem salvar, atalhos.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ArrowRight, CircleAlert, CircleCheck, Info, Trash, X } from 'lucide-react';
import { graphOf } from '../../core/automaton';
import { EPSILON } from '../../core/fa/types';
import { FILE_EXTENSION } from '../../platform/fileFormat';
import { EMPTY_FA, faOf, useActiveDoc, useActiveKind, useDocuments } from '../../store/documents';
import type { DialogState } from '../../store/editorUi';
import { useEditorUi } from '../../store/editorUi';
import { Anchored, closeDialog as close, Modal } from './DialogFrame';
import { saveDocument, writeDocument } from './fileActions';
import { Kbd } from './Menu';
import { PropertiesDialog } from './Properties';
import { PDARulesDialog, TMRulesDialog } from './RulesDialog';
import { parseSymbols, symbolsToText } from './symbols';

function SymbolsPreview({ symbols }: { symbols: string[] }) {
  return (
    <>
      {symbols.map((s) => (
        <span key={s} className={s === EPSILON ? 'ed-chip eps' : 'ed-chip'}>
          {s}
        </span>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */

function SymbolsDialog({ d }: { d: Extract<DialogState, { kind: 'transition' }> }) {
  const fa = faOf(useActiveDoc()) ?? EMPTY_FA;
  const existing =
    fa.transitions.find((t) => t.id === d.transitionId) ?? fa.transitions.find((t) => t.from === d.from && t.to === d.to);
  const nameOf = (id: string) => fa.states.find((s) => s.id === id)?.name ?? '?';
  const [text, setText] = useState(() => (existing ? symbolsToText(existing.symbols) : ''));
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const symbols = parseSymbols(text);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);
  useLayoutEffect(() => {
    if (caret.current !== null && input.current) {
      input.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [text]);

  const insertEpsilon = () => {
    const el = input.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const glue = before && !/[\s,]$/.test(before) ? ', ' : '';
    const next = before + glue + EPSILON + text.slice(end);
    caret.current = (before + glue + EPSILON).length;
    setText(next);
    el?.focus();
  };

  const confirm = () => {
    const st = useDocuments.getState();
    if (existing) st.setTransitionSymbols(existing.id, symbols);
    else if (symbols.length > 0) st.setTransition(d.from, d.to, symbols);
    close();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      insertEpsilon();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const willDelete = !!existing && symbols.length === 0;
  return (
    <Anchored x={d.x} y={d.y} label="Símbolos da transição">
      <h2>{existing ? 'Editar transição' : 'Nova transição'}</h2>
      <p className="sub">
        <span className="ed-pair">
          <span className="ed-chip">{nameOf(d.from)}</span>
          <ArrowRight size={14} />
          <span className="ed-chip">{nameOf(d.to)}</span>
        </span>
      </p>
      <div className="ed-field">
        <input
          ref={input}
          className="ed-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="ex.: 0, 1"
          aria-label="Símbolos"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          className="ed-eps"
          onClick={insertEpsilon}
          onMouseDown={(e) => e.preventDefault()}
          title="Inserir ε (Ctrl+E)"
        >
          <span className="big">ε</span>
          <span className="small">Ctrl+E</span>
        </button>
      </div>
      <div className="ed-chips">
        {symbols.length > 0 ? (
          <>
            <span>Símbolos:</span>
            <SymbolsPreview symbols={symbols} />
          </>
        ) : willDelete ? (
          <span style={{ color: 'var(--reject)' }}>Sem símbolos: a transição será apagada.</span>
        ) : (
          <span>Cada caractere é um símbolo. Espaços e vírgulas são ignorados.</span>
        )}
      </div>
      <div className="ed-actions">
        {existing && (
          <button
            type="button"
            className="ed-btn ghost danger"
            onClick={() => {
              useDocuments.getState().setTransitionSymbols(existing.id, []);
              close();
            }}
          >
            <Trash size={15} /> Apagar
          </button>
        )}
        <span className="grow" />
        <button type="button" className="ed-btn ghost" onClick={close}>
          Cancelar
        </button>
        <button type="button" className="ed-btn primary" onClick={confirm} disabled={!existing && symbols.length === 0}>
          {willDelete ? 'Apagar' : 'OK'}
        </button>
      </div>
      <div className="ed-hint">
        <Kbd keys={['Enter']} /> confirma · <Kbd keys={['Esc']} /> cancela
      </div>
    </Anchored>
  );
}

function RenameStateDialog({ d }: { d: Extract<DialogState, { kind: 'rename-state' }> }) {
  const states = graphOf(useActiveDoc().automaton).states;
  const state = states.find((s) => s.id === d.stateId);
  const [text, setText] = useState(state?.name ?? '');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  if (!state) return null;
  const clean = text.trim();
  const duplicate = states.some((s) => s.id !== state.id && s.name === clean);
  const valid = clean.length > 0 && !duplicate;
  const confirm = () => {
    if (!valid) return;
    useDocuments.getState().renameState(state.id, clean);
    close();
  };
  return (
    <Anchored x={d.x} y={d.y} label="Renomear estado">
      <h2>Renomear estado</h2>
      <p className="sub">O nome aparece no círculo e nas tabelas.</p>
      <input
        ref={input}
        className="ed-input"
        style={{ width: '100%' }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirm();
          else if (e.key === 'Escape') close();
        }}
        aria-label="Nome do estado"
        spellCheck={false}
        autoComplete="off"
      />
      {duplicate && <div className="ed-hint" style={{ color: 'var(--reject)' }}>Já existe um estado com esse nome.</div>}
      <div className="ed-actions">
        <button type="button" className="ed-btn ghost" onClick={close}>
          Cancelar
        </button>
        <button type="button" className="ed-btn primary" onClick={confirm} disabled={!valid}>
          Renomear
        </button>
      </div>
    </Anchored>
  );
}

function SaveAsDialog({ d }: { d: Extract<DialogState, { kind: 'save-as' }> }) {
  const doc = useDocuments((s) => s.docs.find((x) => x.id === d.docId));
  const [text, setText] = useState(doc?.name ?? '');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  if (!doc) return null;
  const confirm = () => {
    close();
    void writeDocument(doc.id, text, d.closeAfter);
  };
  return (
    <Modal label="Salvar como">
      <h2>Salvar como</h2>
      <p className="sub">Escolha o nome do arquivo. Ele vai para a pasta de downloads do navegador.</p>
      <div className="ed-field">
        <input
          ref={input}
          className="ed-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
          }}
          aria-label="Nome do arquivo"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div className="ed-hint">
        Arquivo: <b>{(text.trim() || 'automato') + FILE_EXTENSION}</b>
      </div>
      <div className="ed-actions">
        <button type="button" className="ed-btn ghost" onClick={close}>
          Cancelar
        </button>
        <button type="button" className="ed-btn primary" onClick={confirm}>
          Salvar
        </button>
      </div>
    </Modal>
  );
}

function ConfirmCloseDialog({ d }: { d: Extract<DialogState, { kind: 'confirm-close' }> }) {
  const doc = useDocuments((s) => s.docs.find((x) => x.id === d.docId));
  if (!doc) return null;
  return (
    <Modal label="Fechar sem salvar?">
      <h2>Fechar “{doc.name}”?</h2>
      <p className="sub">Há alterações que ainda não foram salvas. Se fechar agora, elas serão perdidas.</p>
      <div className="ed-actions">
        <button
          type="button"
          className="ed-btn danger"
          onClick={() => {
            close();
            useDocuments.getState().closeDoc(doc.id);
          }}
        >
          Fechar sem salvar
        </button>
        <span className="grow" />
        <button type="button" className="ed-btn ghost" onClick={close}>
          Cancelar
        </button>
        <button
          type="button"
          className="ed-btn primary"
          onClick={() => {
            close();
            void saveDocument(doc.id, true);
          }}
        >
          Salvar
        </button>
      </div>
    </Modal>
  );
}

const SHORTCUTS: Array<[string, string[]]> = [
  ['Novo autômato (AF, AP ou MT)', ['Alt', 'N']],
  ['Novo estado', ['Duplo clique']],
  ['Ferramenta Estado / Selecionar', ['S', 'V']],
  ['Nova transição', ['Arrastar da borda']],
  ['Editar símbolos ou regras', ['Duplo clique no rótulo']],
  ['Curvar a transição', ['Arrastar o rótulo']],
  ['Inserir ε (janela de símbolos ou de regras)', ['Ctrl', 'E']],
  ['Estado inicial / final', ['I', 'F']],
  ['Renomear estado', ['F2']],
  ['Apagar seleção', ['Delete']],
  ['Selecionar tudo', ['Ctrl', 'A']],
  ['Seleção por área', ['Shift', 'arrastar']],
  ['Desfazer', ['Ctrl', 'Z']],
  ['Refazer', ['Ctrl', 'Y']],
  ['Abrir / Salvar', ['Ctrl', 'O / S']],
  ['Ajustar à tela', ['Shift', '1']],
];

function ShortcutsDialog() {
  return (
    <Modal label="Atalhos" wide>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h2 style={{ flex: 1 }}>Atalhos do editor</h2>
        <button type="button" className="ed-icon-btn sm" onClick={close} aria-label="Fechar">
          <X size={16} />
        </button>
      </div>
      <div className="ed-shortcuts">
        {SHORTCUTS.map(([label, keys]) => (
          <div key={label} style={{ display: 'contents' }}>
            <span>{label}</span>
            <Kbd keys={keys} />
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function Dialogs() {
  const dialog = useEditorUi((s) => s.dialog);
  const kind = useActiveKind();
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'transition': {
      const key = `${dialog.from}-${dialog.to}-${dialog.transitionId ?? ''}`;
      if (kind === 'pda') return <PDARulesDialog key={key} d={dialog} />;
      if (kind === 'tm') return <TMRulesDialog key={key} d={dialog} />;
      return <SymbolsDialog key={key} d={dialog} />;
    }
    case 'rename-state':
      return <RenameStateDialog key={dialog.stateId} d={dialog} />;
    case 'properties':
      return <PropertiesDialog />;
    case 'save-as':
      return <SaveAsDialog key={dialog.docId} d={dialog} />;
    case 'confirm-close':
      return <ConfirmCloseDialog d={dialog} />;
    case 'shortcuts':
      return <ShortcutsDialog />;
  }
}

export function Toasts() {
  const toasts = useEditorUi((s) => s.toasts);
  const dismiss = useEditorUi((s) => s.dismissToast);
  return (
    <div className="ed-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`ed-toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          {t.kind === 'success' ? <CircleCheck size={17} /> : t.kind === 'error' ? <CircleAlert size={17} /> : <Info size={17} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
