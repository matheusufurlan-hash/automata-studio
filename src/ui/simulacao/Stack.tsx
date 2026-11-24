/**
 * A pilha do AP, na vertical, com o TOPO EM CIMA e o Z0 no fundo.
 * Ao andar um passo para a frente, o que entrou desce de cima (empilhar) e o
 * que saiu sobe e some (desempilhar). Pilha grande: o topo, "⋮ +N" e o fundo
 * (quantos cabem depende da altura do painel).
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { stackView } from './machine';

/** Altura de uma célula + o espaço entre elas (ver machine.css). */
const ROW = 26;

export const Stack = memo(function Stack({
  stack,
  prev,
  z0,
  animKey,
  dimmed = false,
  tone,
}: {
  /** A pilha do passo (topo primeiro). */
  stack: string;
  /** A pilha do passo anterior, só quando andou 1 passo para a frente (anima). */
  prev: string | null;
  z0: string;
  /** Muda a cada passo animado (refaz a animação do que saiu). */
  animKey: number;
  /** Antes de simular: a pilha inicial (só Z0), mais apagada. */
  dimmed?: boolean;
  tone: 'running' | 'accepted' | 'rejected' | 'undecided';
}) {
  const well = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(6);
  useEffect(() => {
    const el = well.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setCapacity(Math.max(3, Math.floor((el.clientHeight - 6) / ROW))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const view = useMemo(() => stackView(prev, stack, z0, capacity), [prev, stack, z0, capacity]);

  const { cells, hidden, popped, size } = view;
  const animate = prev !== null;
  const last = cells.length - 1;
  const items: ReactNode[] = [];
  if (animate) {
    popped.forEach((sym, i) =>
      items.push(
        <div key={`pop-${animKey}-${i}`} className="sim-stack-cell is-popped" aria-hidden>
          {sym}
        </div>,
      ),
    );
  }
  cells.forEach((c, i) => {
    if (hidden > 0 && i === last) {
      items.push(
        <div key="hidden" className="sim-stack-more" title={`mais ${hidden} símbolos no meio da pilha`}>
          ⋮ +{hidden}
        </div>,
      );
    }
    const cls = ['sim-stack-cell'];
    if (i === 0) cls.push('is-top');
    if (c.bottom && i === last) cls.push('is-bottom');
    if (animate && c.pushed) cls.push('is-pushed');
    items.push(
      <div
        key={c.key}
        role="listitem"
        className={cls.join(' ')}
        title={i === 0 ? 'topo da pilha' : c.bottom && i === last ? 'fundo da pilha (Z₀)' : undefined}
      >
        {c.sym}
      </div>,
    );
  });
  return (
    <div className={`sim-stack tone-${tone}${dimmed ? ' is-dimmed' : ''}`} aria-label="Pilha (topo em cima)">
      <div className="sim-lane-label">
        pilha <span className="sim-stack-size">{size === 0 ? 'vazia' : `${size}`}</span>
      </div>
      <div ref={well} className="sim-stack-well" role="list">
        {items}
        {size === 0 && (
          <div className="sim-stack-empty" title="A pilha está vazia (γ = ε)">
            ε
          </div>
        )}
      </div>
    </div>
  );
});
