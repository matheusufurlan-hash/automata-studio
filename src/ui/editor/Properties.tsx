/**
 * Propriedades do autômato da aba (só AP e MT):
 *  - AP: Z0 (símbolo inicial da pilha) e o modo de aceitação (estado final ou pilha vazia);
 *  - MT: o branco, o modo de aceitação (estado final ou parada) e Σ.
 * O chip no canto do canvas mostra o resumo e abre a janela. Salvar = 1 passo no Desfazer.
 */
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Settings2 } from 'lucide-react';
import { EPSILON } from '../../core/fa/types';
import type { PDA, PDAAcceptance } from '../../core/pda/types';
import type { TM, TMAcceptance } from '../../core/tm/types';
import { stackSymbolInRules, tapeSymbolInRules, useActiveDoc, useDocuments } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { closeDialog, Modal } from './DialogFrame';
import { KindBadge } from './KindBadge';

export const openProperties = () => useEditorUi.getState().openDialog({ kind: 'properties' });

export const PDA_ACCEPTANCE_TEXT: Record<PDAAcceptance, string> = {
  FINAL_STATE: 'aceita por estado final',
  EMPTY_STACK: 'aceita por pilha vazia',
};

export const TM_ACCEPTANCE_TEXT: Record<TMAcceptance, string> = {
  FINAL_STATE: 'aceita por estado final',
  HALT: 'aceita quando para',
};

/** Σ para mostrar: "{0, 1}" ou "automático" (não informado). */
export function sigmaText(tm: TM): string {
  return tm.inputAlphabet.length ? `{${tm.inputAlphabet.join(', ')}}` : 'automático';
}

/* ------------------------------------------------------------------ */
/* Chip no canvas                                                      */
/* ------------------------------------------------------------------ */

export function PropertiesChip() {
  const a = useActiveDoc().automaton;
  if (a.kind === 'fa') return null;
  return (
    <button
      type="button"
      className="ed-float ed-props-chip"
      onClick={openProperties}
      aria-label={a.kind === 'pda' ? 'Propriedades do autômato com pilha' : 'Propriedades da máquina de Turing'}
      data-tip="Propriedades: clique para mudar"
      data-tip-align="end"
    >
      <KindBadge kind={a.kind} />
      {a.kind === 'pda' ? (
        <>
          <span>
            Z<sub>0</sub> = <b>{a.pda.startStackSymbol}</b>
          </span>
          <span className="dot" />
          <span>{PDA_ACCEPTANCE_TEXT[a.pda.acceptance]}</span>
        </>
      ) : (
        <>
          <span>
            branco <b>{a.tm.blank}</b>
          </span>
          <span className="dot" />
          <span>{TM_ACCEPTANCE_TEXT[a.tm.acceptance]}</span>
          <span className="dot" />
          <span>Σ = {sigmaText(a.tm)}</span>
        </>
      )}
      <Settings2 size={15} className="ico" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Janela                                                              */
/* ------------------------------------------------------------------ */

/** Erro de um símbolo que precisa ter exatamente 1 caractere (Z0, branco). */
export function symbolError(s: string, what: string): string | null {
  if (s === '') return `Escolha ${what} (1 caractere).`;
  if (s === EPSILON || s === 'ϵ') return `${cap(what)} não pode ser ε.`;
  if (Array.from(s).length !== 1 || /\s/.test(s)) {
    return `${cap(what)} precisa ser exatamente 1 símbolo${/^Z[0₀]$/.test(s) ? ' (o Z0 do livro aqui é só Z)' : ''}.`;
  }
  return null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Trocar `old` por `next` nas regras quando `next` já está nelas juntaria os dois símbolos num só. */
export function mergeError(old: string, next: string): string {
  return `${next} já aparece nas regras: trocar ${old} por ${next} juntaria os dois símbolos num só e mudaria o autômato. Escolha um símbolo que ainda não aparece nas regras.`;
}

/** "0, 1" → ['0', '1'] (cada caractere é um símbolo; espaços e vírgulas não contam). */
export function parseSigma(text: string): string[] {
  return [...new Set(Array.from(text.replace(/ϵ/g, EPSILON)).filter((ch) => ch !== ',' && !/\s/.test(ch)))];
}

function Choice({ on, onClick, title, detail }: { on: boolean; onClick(): void; title: string; detail: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={on ? 'ed-choice is-on' : 'ed-choice'} onClick={onClick}>
      <span className="ed-choice-dot" />
      <span>
        <b>{title}</b>
        <span className="ed-choice-detail">{detail}</span>
      </span>
    </button>
  );
}

function Actions({ onSave, disabled }: { onSave(): void; disabled: boolean }) {
  return (
    <div className="ed-actions">
      <span className="grow" />
      <button type="button" className="ed-btn ghost" onClick={closeDialog}>
        Cancelar
      </button>
      <button type="button" className="ed-btn primary" onClick={onSave} disabled={disabled}>
        Salvar
      </button>
    </div>
  );
}

const enterSaves = (save: () => void) => (e: ReactKeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    save();
  }
};

function PDAProperties({ pda }: { pda: PDA }) {
  const [z0, setZ0] = useState(pda.startStackSymbol);
  const [acceptance, setAcceptance] = useState(pda.acceptance);
  const [rename, setRename] = useState(true);
  const clean = z0.trim();
  const old = pda.startStackSymbol;
  const error = symbolError(clean, 'o Z₀');
  const changed = clean !== old;
  const used = stackSymbolInRules(pda.transitions, old);
  const collides = !error && changed && stackSymbolInRules(pda.transitions, clean);
  const merge = collides && used && rename ? mergeError(old, clean) : null;
  const save = () => {
    if (error || merge) return;
    useDocuments.getState().setPDAOptions({ startStackSymbol: clean, acceptance }, { renameInRules: changed && used && rename });
    closeDialog();
  };
  return (
    <Modal label="Propriedades do autômato com pilha">
      <div className="ed-props-head">
        <KindBadge kind="pda" className="lg" />
        <h2>Propriedades do autômato com pilha</h2>
      </div>
      <p className="sub">
        P = (Q, Σ, Γ, δ, q<sub>0</sub>, Z<sub>0</sub>, F)
      </p>
      <label className="ed-prop">
        <span className="ed-prop-label">
          Símbolo inicial da pilha (Z<sub>0</sub>)
        </span>
        <input
          className="ed-input ed-prop-symbol"
          value={z0}
          onChange={(e) => setZ0(e.target.value)}
          onKeyDown={enterSaves(save)}
          aria-invalid={!!error || undefined}
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
        <span className="ed-prop-help">Fica sozinho no fundo da pilha quando a simulação começa.</span>
      </label>
      {error && <div className="ed-prop-error">{error}</div>}
      {!error && changed && used && (
        <label className="ed-check-row">
          <input type="checkbox" checked={rename} onChange={(e) => setRename(e.target.checked)} />
          <span>
            Trocar <b>{old}</b> por <b>{clean}</b> nas regras também
          </span>
        </label>
      )}
      {merge && <div className="ed-prop-error">{merge}</div>}
      {collides && !merge && (
        <div className="ed-prop-help">
          {clean} já aparece nas regras: com ele no fundo da pilha, as regras que desempilham {clean} passam a valer
          também para o fundo.
        </div>
      )}
      <div className="ed-prop">
        <span className="ed-prop-label">Aceitação</span>
        <div className="ed-choices" role="radiogroup" aria-label="Aceitação">
          <Choice
            on={acceptance === 'FINAL_STATE'}
            onClick={() => setAcceptance('FINAL_STATE')}
            title="Por estado final"
            detail="L(P): leu a palavra toda e está num estado final."
          />
          <Choice
            on={acceptance === 'EMPTY_STACK'}
            onClick={() => setAcceptance('EMPTY_STACK')}
            title="Por pilha vazia"
            detail="N(P): leu a palavra toda e a pilha ficou vazia."
          />
        </div>
      </div>
      <Actions onSave={save} disabled={!!error || !!merge} />
    </Modal>
  );
}

function TMProperties({ tm }: { tm: TM }) {
  const [blank, setBlank] = useState(tm.blank);
  const [acceptance, setAcceptance] = useState(tm.acceptance);
  const [sigmaInput, setSigmaInput] = useState(tm.inputAlphabet.join(', '));
  const [rename, setRename] = useState(true);
  const clean = blank.trim();
  const old = tm.blank;
  const sigma = parseSigma(sigmaInput);
  const blankError = symbolError(clean, 'o branco');
  const sigmaError = sigma.includes(EPSILON)
    ? 'Σ não tem ε (a palavra vazia não é um símbolo).'
    : !blankError && sigma.includes(clean)
      ? `O branco (${clean}) não pode estar em Σ.`
      : null;
  const changed = clean !== old;
  const used = tapeSymbolInRules(tm.transitions, old);
  const collides = !blankError && changed && tapeSymbolInRules(tm.transitions, clean);
  const merge = collides && used && rename ? mergeError(old, clean) : null;
  const save = () => {
    if (blankError || sigmaError || merge) return;
    useDocuments
      .getState()
      .setTMOptions({ blank: clean, acceptance, inputAlphabet: sigma }, { renameInRules: changed && used && rename });
    closeDialog();
  };
  return (
    <Modal label="Propriedades da máquina de Turing">
      <div className="ed-props-head">
        <KindBadge kind="tm" className="lg" />
        <h2>Propriedades da máquina de Turing</h2>
      </div>
      <p className="sub">
        M = (Q, Σ, Γ, δ, q<sub>0</sub>, B, F)
      </p>
      <label className="ed-prop">
        <span className="ed-prop-label">Símbolo branco (B)</span>
        <input
          className="ed-input ed-prop-symbol"
          value={blank}
          onChange={(e) => setBlank(e.target.value)}
          onKeyDown={enterSaves(save)}
          aria-invalid={!!blankError || undefined}
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
        <span className="ed-prop-help">Preenche todas as células da fita que estão vazias.</span>
      </label>
      {blankError && <div className="ed-prop-error">{blankError}</div>}
      {!blankError && changed && used && (
        <label className="ed-check-row">
          <input type="checkbox" checked={rename} onChange={(e) => setRename(e.target.checked)} />
          <span>
            Trocar <b>{old}</b> por <b>{clean}</b> nas regras também
          </span>
        </label>
      )}
      {merge && <div className="ed-prop-error">{merge}</div>}
      {collides && !merge && (
        <div className="ed-prop-help">
          {clean} já aparece nas regras: como branco, ele vai preencher todas as células vazias da fita, e as regras
          que leem {clean} passam a valer também para elas.
        </div>
      )}
      <div className="ed-prop">
        <span className="ed-prop-label">Aceitação</span>
        <div className="ed-choices" role="radiogroup" aria-label="Aceitação">
          <Choice
            on={acceptance === 'FINAL_STATE'}
            onClick={() => setAcceptance('FINAL_STATE')}
            title="Por estado final"
            detail="Aceita assim que entra num estado final (e para)."
          />
          <Choice
            on={acceptance === 'HALT'}
            onClick={() => setAcceptance('HALT')}
            title="Por parada"
            detail="Aceita quando para, em qualquer estado. Para MT que calcula: a resposta fica na fita."
          />
        </div>
      </div>
      <label className="ed-prop">
        <span className="ed-prop-label">Alfabeto de entrada (Σ)</span>
        <input
          className="ed-input"
          value={sigmaInput}
          onChange={(e) => setSigmaInput(e.target.value)}
          onKeyDown={enterSaves(save)}
          placeholder="automático"
          aria-invalid={!!sigmaError || undefined}
          spellCheck={false}
          autoComplete="off"
        />
        <span className="ed-prop-help">
          Ex.: 0, 1. Vazio = automático: os símbolos das regras, menos o branco.
        </span>
      </label>
      {sigmaError && <div className="ed-prop-error">{sigmaError}</div>}
      <Actions onSave={save} disabled={!!blankError || !!sigmaError || !!merge} />
    </Modal>
  );
}

export function PropertiesDialog() {
  const a = useActiveDoc().automaton;
  if (a.kind === 'pda') return <PDAProperties pda={a.pda} />;
  if (a.kind === 'tm') return <TMProperties tm={a.tm} />;
  return null;
}
