/**
 * A fita da MT: infinita para os dois lados. Cada célula tem posição
 * ABSOLUTA (a célula 0 é a 1ª letra da entrada), então a fita não "pula":
 * a cabeça anda de célula em célula e a vista acompanha com rolagem suave
 * quando a cabeça chega perto da borda. O branco aparece com o símbolo da MT,
 * mais apagado. Só as células perto da cabeça são desenhadas.
 */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TMConfig } from '../../core/tm/types';
import { cellAt, headPos, tapeWindow } from './machine';

const CELL = 40;
const GAP = 4;
const PITCH = CELL + GAP;
/** Margem (em células) antes de a vista rolar. */
const EDGE = 2;

export type TapeTone = 'idle' | 'running' | 'accepted' | 'rejected' | 'undecided';

const Cell = memo(function Cell({
  pos,
  sym,
  blank,
  written,
  inkKey,
}: {
  pos: number;
  sym: string;
  blank: boolean;
  written: boolean;
  inkKey: number;
}) {
  return (
    <div
      className={`sim-tm-cell${blank ? ' is-blank' : ''}${written ? ' is-written' : ''}`}
      style={{ transform: `translateX(${pos * PITCH}px)` }}
      title={`célula ${pos}`}
    >
      {written ? (
        <span key={inkKey} className="sim-tm-ink">
          {sym}
        </span>
      ) : (
        sym
      )}
    </div>
  );
});

export function TuringTape({
  config,
  prev,
  blank,
  state,
  tone,
  stepKey,
}: {
  config: TMConfig;
  /** Configuração do passo anterior, só quando andou 1 passo para a frente (anima a escrita). */
  prev: TMConfig | null;
  blank: string;
  /** Nome do estado (aparece em cima da cabeça). */
  state: string;
  tone: TapeTone;
  /** Muda a cada passo (refaz a animação da célula escrita). */
  stepKey: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const cam = useRef<number | null>(null);
  const [visible, setVisible] = useState(20);
  const head = headPos(config);

  // quantas células cabem na largura
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setVisible(Math.max(5, Math.floor((el.clientWidth - 24) / PITCH))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a "câmera" (1ª célula à vista) segue a cabeça: rola quando ela chega perto da borda
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) return;
    let c = cam.current;
    let jump = false;
    if (c === null) {
      // primeira vista: o começo do trecho escrito (com 2 brancos antes), sem tirar a cabeça da zona confortável
      c = Math.min(head - EDGE, Math.max(config.origin - 2, head - visible + 1 + EDGE));
      jump = true;
    } else if (head < c + EDGE || head > c + visible - 1 - EDGE) {
      const target = head - Math.floor(visible / 2);
      jump = Math.abs(target - c) > visible;
      c = target;
    }
    cam.current = c;
    el.style.transition = jump ? 'none' : '';
    el.style.transform = `translateX(${12 - c * PITCH}px)`;
  }, [head, visible, config.origin]);

  const radius = visible + 4;
  const cells = useMemo(() => tapeWindow(config, head - radius, head + radius, blank), [config, head, radius, blank]);
  // célula escrita no passo: onde estava a cabeça, se o símbolo mudou
  const writtenAt = useMemo(() => {
    if (!prev) return null;
    const p = headPos(prev);
    const before = cellAt(Array.from(prev.tape), prev, p, blank);
    const after = cellAt(Array.from(config.tape), config, p, blank);
    return before === after ? null : p;
  }, [prev, config, blank]);

  return (
    <div ref={box} className={`sim-tm-tape tone-${tone}`} style={{ ['--cell' as string]: `${CELL}px` }}>
      <div ref={strip} className="sim-tm-strip">
        {cells.map((c) => (
          <Cell key={c.pos} pos={c.pos} sym={c.sym} blank={c.blank} written={c.pos === writtenAt} inkKey={stepKey} />
        ))}
        <div className="sim-tm-head" style={{ transform: `translateX(${head * PITCH}px)` }} aria-hidden>
          <span className="sim-tm-state">{state}</span>
          <span className="sim-tm-tick" />
          <span className="sim-tm-ring" />
        </div>
      </div>
      <span className="sr-only">
        cabeça na célula {head}, estado {state}
      </span>
    </div>
  );
}
