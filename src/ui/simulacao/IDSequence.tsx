/**
 * A sequência de descrições instantâneas no formato do livro, com ⊢:
 * (q0, 0110, Z) ⊢ (q0, 110, 0Z) ⊢ …   ou   q00011 ⊢ Xq1011 ⊢ …
 * Clicar numa ID vai para aquele passo. Uma MT pode ter 10000 passos: só uma
 * janela em volta do passo atual é desenhada.
 */
import { memo, useEffect, useMemo, useRef } from 'react';
import type { IDItem, MachineRun, VerdictTone } from './machine';
import { idItem, idWindow, stepCount } from './machine';
import { MathText } from './MathText';

/** A ID: no AP, o texto (ε com cor); na MT, o estado destacado entre os dois lados da fita. */
export function IDText({ item }: { item: Pick<IDItem, 'text' | 'parts'> }) {
  if (item.parts) {
    return (
      <>
        {item.parts.left}
        <span className="sim-id-state">{item.parts.state}</span>
        {item.parts.right}
      </>
    );
  }
  return <MathText text={item.text ?? ''} />;
}

const Chip = memo(function Chip({
  item,
  cls,
  first,
  future,
  onPick,
}: {
  item: IDItem;
  cls: string;
  first: boolean;
  future: boolean;
  onPick(step: number): void;
}) {
  return (
    <>
      {!first && (
        <span className={future ? 'sim-id-turn is-future' : 'sim-id-turn'} title={item.rule ? `regra ${item.rule}` : undefined} aria-hidden>
          ⊢
        </span>
      )}
      <button
        type="button"
        role="listitem"
        className={cls}
        onClick={() => onPick(item.index)}
        title={`Passo ${item.index}${item.rule ? ` (regra ${item.rule})` : ': início'}`}
      >
        <IDText item={item} />
      </button>
    </>
  );
});

export function IDSequence({
  run,
  step,
  tone,
  onPick,
}: {
  run: MachineRun | null;
  step: number;
  tone: VerdictTone | 'running';
  onPick(step: number): void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const total = stepCount(run);
  const { start, end } = idWindow(total, step, 40);
  const items = useMemo(() => {
    if (!run) return [];
    const out: IDItem[] = [];
    for (let i = start; i <= end; i++) out.push(idItem(run, i));
    return out;
  }, [run, start, end]);

  // mantém a ID atual à vista (só rola a própria fileira); de novo se ela
  // mudar de tamanho (a fonte termina de carregar, por exemplo). Suave ao
  // andar um passo; direto numa simulação nova ou num pulo
  const seen = useRef<{ run: MachineRun | null; step: number } | null>(null);
  useEffect(() => {
    const before = seen.current;
    seen.current = { run, step };
    const stepped = !!before && before.run === run && Math.abs(before.step - step) === 1;
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('.sim-id.is-current');
    if (!box || !el) return;
    const reveal = (smooth: boolean) => {
      const left = el.offsetLeft;
      const right = left + el.offsetWidth;
      if (left < box.scrollLeft + 8 || right > box.scrollLeft + box.clientWidth - 8) {
        const target = Math.max(0, left - box.clientWidth / 2 + el.offsetWidth / 2);
        const far = Math.abs(target - box.scrollLeft) > box.clientWidth;
        box.scrollTo?.({ left: target, behavior: smooth && !far ? 'smooth' : 'auto' });
      }
    };
    reveal(stepped);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => reveal(stepped));
    ro.observe(el);
    return () => ro.disconnect();
  }, [step, start, run]);

  if (!run || total === 0) {
    return (
      <div className="sim-ids sim-tl-empty">
        {run ? 'Nenhuma ID: a simulação nem começou.' : 'A sequência de descrições instantâneas (IDs) aparece aqui.'}
      </div>
    );
  }

  const last = total - 1;
  const loopAt = run.kind === 'tm' && run.result.stop === 'LOOP' && !run.path ? run.result.loopStart : undefined;
  return (
    <div ref={scroller} className="sim-ids" role="list" aria-label="Sequência de descrições instantâneas">
      {start > 0 && (
        <button type="button" className="sim-id-more" onClick={() => onPick(0)} title="Ir para o início">
          ⋯ {start.toLocaleString('pt-BR')} antes
        </button>
      )}
      {items.map((it) => {
        const i = it.index;
        const cls = ['sim-id'];
        if (i === step) cls.push('is-current');
        if (i > step) cls.push('is-future');
        // MT em laço: a configuração que se repetiu (no passo loopStart e no último)
        if (loopAt !== undefined && (i === loopAt || i === last)) cls.push('is-loop');
        if (i === last && i === step && tone !== 'running') cls.push(`is-${tone}`);
        return <Chip key={i} item={it} cls={cls.join(' ')} first={i === 0} future={i > step} onPick={onPick} />;
      })}
      {end < last && (
        <button type="button" className="sim-id-more" onClick={() => onPick(last)} title="Ir para o fim">
          ⊢ ⋯ mais {(last - end).toLocaleString('pt-BR')}
        </button>
      )}
    </div>
  );
}
