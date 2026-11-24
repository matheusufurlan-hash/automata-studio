/**
 * Janela para os algoritmos com dois autômatos (União, Concatenação,
 * Interseção) e para Comparar equivalência: escolhe o 2º entre as abas abertas.
 */
import { useState } from 'react';
import { ArrowRight, CircleCheck, CircleX, Play } from 'lucide-react';
import { classify } from '../../core/fa';
import { EMPTY_FA, faOf, useActiveDoc, useDocuments } from '../../store/documents';
import type { Doc } from '../../store/documents';
import { showWord } from './format';
import type { BinaryAlgo } from './algorithms';
import { ALGO_LABEL, BINARY_SYMBOL } from './algorithms';
import type { Comparison } from './actions';
import { compare, runBinaryAlgorithm, simulateWord } from './actions';
import { Modal } from './Modal';
import { useTools } from './store';
import { TypeBadge } from './TypeBadge';

/** O AF da aba (AP/MT ficam de fora: AF vazio). */
const faOfDoc = (d: Doc) => faOf(d) ?? EMPTY_FA;

const SUBTITLE: Record<BinaryAlgo | 'equivalence', string> = {
  union: 'L(A) ∪ L(B): aceita o que pelo menos um dos dois aceita. O resultado abre numa aba nova.',
  concat: 'L(A) · L(B): uma palavra de A seguida de uma palavra de B. O resultado abre numa aba nova.',
  intersection: 'L(A) ∩ L(B): aceita o que os dois aceitam. O resultado abre numa aba nova.',
  equivalence: 'Os dois aceitam exatamente as mesmas palavras? Se não, mostra a menor palavra que separa os dois.',
};

export function PickDialog({ algo, auto = false }: { algo: BinaryAlgo | 'equivalence'; auto?: boolean }) {
  const close = useTools((s) => s.closeDialog);
  const a = useActiveDoc();
  const activeId = useDocuments((s) => s.activeId);
  const docs = useDocuments((s) => s.docs);
  const others = docs.filter(
    (d) => d.id !== activeId && faOfDoc(d).states.length > 0 && faOfDoc(d).states.some((s) => s.initial),
  );
  const [picked, setPicked] = useState<string | null>(others[0]?.id ?? null);
  const [result, setResult] = useState<{ b: string; cmp: Comparison } | null>(() =>
    auto && algo === 'equivalence' && others[0] ? { b: others[0].id, cmp: compare(faOfDoc(a), faOfDoc(others[0])) } : null,
  );
  const b = others.find((d) => d.id === picked) ?? null;

  const submit = () => {
    if (!b) return;
    if (algo === 'equivalence') {
      setResult({ b: b.id, cmp: compare(faOfDoc(a), faOfDoc(b)) });
      return;
    }
    close();
    runBinaryAlgorithm(algo, b.id);
  };

  const shown = result && result.b === picked ? result.cmp : null;

  return (
    <Modal label={ALGO_LABEL[algo]} onClose={close} className="fx-pick">
      <h2>
        {ALGO_LABEL[algo]}
        {algo !== 'equivalence' && <span className="fx-pick-op">A {BINARY_SYMBOL[algo]} B</span>}
      </h2>
      <p className="sub">{SUBTITLE[algo]}</p>

      <div className="fx-pick-row">
        <span className="fx-pick-tag">A</span>
        <span className="fx-pick-name">{a.name}</span>
        <TypeBadge type={classify(faOfDoc(a))} small />
        <span className="fx-pick-note">aba atual</span>
      </div>
      <div className="fx-pick-label">B: escolha outra aba</div>
      <div className="fx-pick-list" role="radiogroup" aria-label="Segundo autômato">
        {others.length === 0 && <div className="fx-empty-line">Nenhuma outra aba tem um autômato com estado inicial.</div>}
        {others.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={picked === d.id}
            className={picked === d.id ? 'fx-pick-row is-picked' : 'fx-pick-row'}
            onClick={() => setPicked(d.id)}
            onDoubleClick={submit}
          >
            <span className="fx-pick-tag">B</span>
            <span className="fx-pick-name">{d.name}</span>
            <TypeBadge type={classify(faOfDoc(d))} small />
            <span className="fx-pick-note">{faOfDoc(d).states.length} estados</span>
          </button>
        ))}
      </div>

      {shown && b && (
        <div className={shown.equivalent ? 'fx-verdict is-ok' : 'fx-verdict is-bad'} role="status">
          {shown.equivalent ? <CircleCheck size={22} /> : <CircleX size={22} />}
          <div>
            <strong>{shown.equivalent ? 'Equivalentes' : 'Não são equivalentes'}</strong>
            {shown.equivalent ? (
              <p>L(A) = L(B): os dois aceitam exatamente as mesmas palavras.</p>
            ) : (
              <p>
                A palavra <code>{showWord(shown.counterexample ?? '')}</code> é aceita por{' '}
                <b>{shown.acceptedBy === 'a' ? 'A' : 'B'}</b> e rejeitada por <b>{shown.acceptedBy === 'a' ? 'B' : 'A'}</b>
                {shown.counterexample === '' ? ' (a palavra vazia)' : ''}. É a menor palavra que separa os dois.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="ed-actions">
        {shown && !shown.equivalent && (
          <button
            type="button"
            className="ed-btn ghost"
            onClick={() => {
              close();
              simulateWord(shown.counterexample ?? '');
            }}
          >
            <Play size={14} /> Simular em A
          </button>
        )}
        <span className="grow" />
        <button type="button" className="ed-btn" onClick={close}>
          {shown ? 'Fechar' : 'Cancelar'}
        </button>
        <button type="button" className="ed-btn primary" onClick={submit} disabled={!b}>
          {algo === 'equivalence' ? 'Comparar' : 'Abrir resultado'} <ArrowRight size={14} />
        </button>
      </div>
    </Modal>
  );
}
