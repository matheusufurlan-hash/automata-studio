/**
 * Texto "de livro" (IDs, δ, regras): o ε com a cor própria e as setas da MT
 * (→ ←) um pouco maiores, como no rótulo das setas do canvas.
 */
import { Fragment } from 'react';

const TOKENS = /(ε|→|←)/;

export function MathText({ text }: { text: string }) {
  const parts = text.split(TOKENS);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p === 'ε' ? (
          <span key={i} className="eps">
            ε
          </span>
        ) : p === '→' || p === '←' ? (
          <span key={i} className="sim-arrow">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
