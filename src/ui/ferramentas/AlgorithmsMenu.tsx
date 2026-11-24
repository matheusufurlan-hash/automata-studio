/**
 * Menu "Algoritmos" e botão "Exemplos" da barra de cima.
 * Cada algoritmo abre o resultado numa aba nova; os que não fazem sentido
 * ficam desabilitados com o motivo ao lado.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Asterisk,
  ChevronDown,
  CircleDot,
  CircleSlash,
  Combine,
  Contrast,
  Eraser,
  Info,
  Library,
  Link2,
  Minimize2,
  PackageOpen,
  Scale,
  Scissors,
  SquaresIntersect,
  SquaresUnite,
} from 'lucide-react';
import type { FA } from '../../core/fa/types';
import { EMPTY_FA, faOf, pdaOf, useActiveDoc, useActiveKind, useDocuments } from '../../store/documents';
import { MenuSurface } from '../editor/Menu';
import './ferramentas.css';
import type { AlgoId, BinaryAlgo, UnaryAlgo } from './algorithms';
import { ALGO_LABEL, unavailableReason } from './algorithms';
import { runPDAAlgorithm, runUnaryAlgorithm } from './actions';
import type { PDAAlgo } from './pdaAlgorithms';
import { PDA_ALGO_LABEL, PDA_ALGO_THEOREM, pdaUnavailableReason } from './pdaAlgorithms';
import { ExamplesDialog } from './ExamplesDialog';
import { PickDialog } from './PickDialog';
import { useTools } from './store';
import { bootstrapToolsFromUrl } from './urlParams';

bootstrapToolsFromUrl();

const ICONS: Record<AlgoId, ReactNode> = {
  determinize: <Combine size={16} />,
  minimize: <Minimize2 size={16} />,
  complete: <CircleSlash size={16} />,
  complement: <Contrast size={16} />,
  removeUnreachable: <Scissors size={16} />,
  removeUseless: <Eraser size={16} />,
  star: <Asterisk size={16} />,
  union: <SquaresUnite size={16} />,
  concat: <Link2 size={16} />,
  intersection: <SquaresIntersect size={16} />,
  equivalence: <Scale size={16} />,
};

const SECTIONS: Array<{ title: string; items: AlgoId[] }> = [
  { title: 'Converter', items: ['determinize', 'minimize'] },
  { title: 'Ajustar', items: ['complete', 'removeUnreachable', 'removeUseless'] },
  { title: 'Operações', items: ['complement', 'star', 'union', 'concat', 'intersection'] },
  { title: 'Comparar', items: ['equivalence'] },
];

const NEEDS_PICK = new Set<AlgoId>(['union', 'concat', 'intersection', 'equivalence']);

function AlgorithmList({ onDone }: { onDone(): void }) {
  const fa = faOf(useActiveDoc()) ?? EMPTY_FA;
  const activeId = useDocuments((s) => s.activeId);
  const docs = useDocuments((s) => s.docs);
  const reasons = useMemo(() => {
    const others = docs
      .filter((d) => d.id !== activeId)
      .map((d) => faOf(d))
      .filter((x): x is FA => !!x);
    const out = {} as Record<AlgoId, string | null>;
    for (const s of SECTIONS) for (const id of s.items) out[id] = unavailableReason(id, fa, others);
    return out;
  }, [fa, docs, activeId]);

  const select = (id: AlgoId) => {
    onDone();
    if (NEEDS_PICK.has(id)) useTools.getState().openDialog({ kind: 'pick', algo: id as BinaryAlgo | 'equivalence' });
    else runUnaryAlgorithm(id as UnaryAlgo);
  };

  return (
    <>
      {SECTIONS.map((s, i) => (
        <div key={s.title} role="group" aria-label={s.title}>
          {i > 0 && <div className="ed-menu-sep" role="separator" />}
          <div className="ed-menu-title">{s.title}</div>
          {s.items.map((id) => {
            const reason = reasons[id];
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                className="ed-menu-item fx-algo"
                disabled={!!reason}
                onClick={() => select(id)}
                title={reason ? `Indisponível: ${reason}` : undefined}
              >
                <span className="ico">{ICONS[id]}</span>
                <span className="lbl">
                  {ALGO_LABEL[id]}
                  {NEEDS_PICK.has(id) ? '…' : ''}
                </span>
                {reason && <span className="fx-algo-why">{reason}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

/** Aba de AP: as conversões entre os modos de aceitação (Hopcroft, seção 6.2). */
function PDAAlgorithmList({ onDone }: { onDone(): void }) {
  const pda = pdaOf(useActiveDoc());
  const items: PDAAlgo[] = ['toFinalState', 'toEmptyStack'];
  return (
    <div role="group" aria-label="Converter o modo de aceitação">
      <div className="ed-menu-title">Converter o modo de aceitação</div>
      {items.map((id) => {
        const reason = pda ? pdaUnavailableReason(id, pda) : 'abra uma aba de AP';
        return (
          <button
            key={id}
            type="button"
            role="menuitem"
            className="ed-menu-item fx-algo"
            disabled={!!reason}
            onClick={() => {
              onDone();
              runPDAAlgorithm(id);
            }}
            title={reason ? `Indisponível: ${reason}` : undefined}
          >
            <span className="ico">{id === 'toFinalState' ? <CircleDot size={16} /> : <PackageOpen size={16} />}</span>
            <span className="lbl">
              {PDA_ALGO_LABEL[id]} <span className="fx-algo-ref">{PDA_ALGO_THEOREM[id]}</span>
            </span>
            {reason && <span className="fx-algo-why">{reason}</span>}
          </button>
        );
      })}
      <div className="ed-menu-sep" role="separator" />
      <p className="fx-algo-note">O resultado abre numa aba nova; os estados originais ficam no mesmo lugar.</p>
    </div>
  );
}

/** Aba de MT: não há algoritmos de conversão. */
function NoTMAlgorithms() {
  return (
    <div className="ed-soon" style={{ padding: '8px 10px', maxWidth: 320 }}>
      <Info size={15} /> Não há algoritmos para máquinas de Turing. Use a simulação, a árvore de IDs e o teste em lote.
    </div>
  );
}

export function AlgorithmsMenu() {
  const kind = useActiveKind();
  const [open, setOpen] = useState<{ x: number; y: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(null), []);
  const dialog = useTools((s) => s.dialog);
  const menuRequest = useTools((s) => s.menuRequest);

  // pedido para abrir o menu (parâmetro de URL `menu=algoritmos`); espera a
  // janela assentar, porque o menu fecha sozinho ao redimensionar
  useEffect(() => {
    if (!menuRequest) return;
    const t = setTimeout(() => {
      const r = button.current?.getBoundingClientRect();
      if (r) setOpen({ x: r.left, y: r.bottom + 6 });
    }, 400);
    return () => clearTimeout(t);
  }, [menuRequest]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={open ? 'ed-menubtn is-open' : 'ed-menubtn'}
        aria-haspopup="menu"
        aria-expanded={!!open}
        onClick={() => {
          if (open) return setOpen(null);
          const r = button.current!.getBoundingClientRect();
          setOpen({ x: r.left, y: r.bottom + 6 });
        }}
      >
        Algoritmos <ChevronDown size={14} />
      </button>
      <button
        type="button"
        className={dialog?.kind === 'examples' ? 'ed-menubtn is-open' : 'ed-menubtn'}
        onClick={() => useTools.getState().openDialog({ kind: 'examples' })}
      >
        <Library size={15} /> Exemplos
      </button>
      {open && (
        <MenuSurface x={open.x} y={open.y} onClose={close} ignore={button}>
          <div className="fx-algo-menu">
            {kind === 'fa' ? <AlgorithmList onDone={close} /> : kind === 'pda' ? <PDAAlgorithmList onDone={close} /> : <NoTMAlgorithms />}
          </div>
        </MenuSurface>
      )}
      {dialog?.kind === 'examples' && <ExamplesDialog />}
      {dialog?.kind === 'pick' && <PickDialog key={dialog.algo} algo={dialog.algo} auto={dialog.auto} />}
    </>
  );
}
