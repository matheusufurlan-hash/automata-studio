/**
 * A palavra como uma fita: uma célula por símbolo, os já lidos esmaecidos e
 * a cabeça (cursor animado) na posição do próximo símbolo a ler.
 */
import { memo, useEffect, useRef } from 'react';
import type { CellKind, TapeModel } from './logic';

const CELL = 38;
const GAP = 4;

/** Uma célula; memo para palavras longas: a cada passo só 2 ou 3 células mudam. */
const Cell = memo(function Cell({ index, ch, kind, foreign }: { index: number; ch: string; kind: CellKind; foreign: boolean }) {
  return (
    <div
      className={`sim-cell is-${kind}${foreign ? ' is-foreign' : ''}`}
      title={foreign ? `posição ${index + 1}: '${ch}' não está em Σ` : `posição ${index + 1}`}
    >
      {ch}
    </div>
  );
});

export function Tape({ model, empty, className }: { model: TapeModel; empty: boolean; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const n = model.cells.length;

  // mantém a cabeça à vista em palavras longas
  useEffect(() => {
    const el = scroller.current;
    if (!el || model.head < 0) return;
    const x = 12 + model.head * (CELL + GAP);
    const left = el.scrollLeft;
    const right = left + el.clientWidth;
    if (x < left + CELL || x + 2 * CELL > right) {
      const target = Math.max(0, x - el.clientWidth / 2 + CELL / 2);
      // pulo grande (ex.: ir ao fim): sem animação
      el.scrollTo?.({ left: target, behavior: Math.abs(target - left) > el.clientWidth ? 'auto' : 'smooth' });
    }
  }, [model.head]);

  return (
    <div ref={scroller} className="sim-tape-scroll">
      <div className={`sim-tape tone-${model.tone}${className ? ` ${className}` : ''}`} style={{ ['--cell' as string]: `${CELL}px`, ['--gap' as string]: `${GAP}px` }}>
        {empty ? (
          <div className="sim-cell is-epsilon" title="Palavra vazia">
            ε
          </div>
        ) : (
          model.cells.map((c, i) => <Cell key={i} index={i} ch={c.ch} kind={c.kind} foreign={c.foreign} />)
        )}
        <div className="sim-cell is-end" aria-hidden>
          ⊣
        </div>
        {model.head >= 0 && (
          <div
            className="sim-cursor"
            style={{ transform: `translateX(${(empty ? 1 : model.head) * (CELL + GAP)}px)` }}
            aria-hidden
          >
            <span className="sim-cursor-ring" />
            <span className="sim-cursor-tick" />
          </div>
        )}
      </div>
      <span className="sr-only">{n === 0 ? 'palavra vazia' : `cabeça na posição ${model.head + 1} de ${n}`}</span>
    </div>
  );
}
