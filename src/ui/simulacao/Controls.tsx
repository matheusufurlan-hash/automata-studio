/**
 * Controles da simulação, iguais para AF, AP e MT: a palavra, ⏮ ◀ ▶/⏸ ▶ ⏭
 * e a velocidade. Também os atalhos de teclado (Espaço, ← e →).
 */
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEditorUi } from '../../store/editorUi';
import { lastStep } from './logic';
import { lastIndex } from './machine';
import { SPEEDS, useSimulation } from './store';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/** Atalhos globais da simulação (AF, AP e MT). */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isTyping(e.target)) return;
      const el = e.target as HTMLElement | null;
      // estado/transição com foco: as setas movem o estado e o Espaço seleciona (React Flow)
      if (el?.closest?.('.react-flow__node, .react-flow__edge, [role="dialog"], [role="menu"]')) return;
      const ui = useEditorUi.getState();
      if (ui.dialog || ui.menu || document.querySelector('[role="menu"]')) return;
      const sim = useSimulation.getState();
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        sim.togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        sim.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        sim.prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function WordField() {
  const word = useSimulation((s) => s.word);
  const sim = useSimulation.getState();
  return (
    <label className="sim-word">
      <span className="sim-word-label">w =</span>
      <input
        value={word}
        onChange={(e) => sim.setWord(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            sim.load();
            sim.play();
          }
        }}
        placeholder="ε (palavra vazia)"
        spellCheck={false}
        autoComplete="off"
        aria-label="Palavra para simular"
      />
    </label>
  );
}

export function Transport() {
  const loaded = useSimulation((s) => !!s.result || !!s.machine);
  const last = useSimulation((s) => (s.machine ? lastIndex(s.machine) : lastStep(s.result)));
  const step = useSimulation((s) => s.step);
  const playing = useSimulation((s) => s.playing);
  const sim = useSimulation.getState();
  const atStart = !loaded || step <= 0;
  const atEnd = loaded && step >= last;
  return (
    <div className="sim-transport" role="group" aria-label="Controles da simulação">
      <button type="button" className="ed-icon-btn" onClick={sim.first} disabled={atStart} aria-label="Início" data-tip="Início" data-tip-pos="top">
        <SkipBack size={17} />
      </button>
      <button type="button" className="ed-icon-btn" onClick={sim.prev} disabled={atStart} aria-label="Voltar um passo" data-tip="Voltar (←)" data-tip-pos="top">
        <ChevronLeft size={19} />
      </button>
      <button
        type="button"
        className="sim-play"
        onClick={sim.togglePlay}
        aria-label={playing ? 'Pausar' : 'Tocar'}
        data-tip={playing ? 'Pausar (Espaço)' : 'Tocar (Espaço)'}
        data-tip-pos="top"
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
      <button type="button" className="ed-icon-btn" onClick={sim.next} disabled={atEnd} aria-label="Avançar um passo" data-tip="Avançar (→)" data-tip-pos="top">
        <ChevronRight size={19} />
      </button>
      <button type="button" className="ed-icon-btn" onClick={sim.last} disabled={atEnd} aria-label="Fim" data-tip="Fim" data-tip-pos="top">
        <SkipForward size={17} />
      </button>
    </div>
  );
}

export function Speed() {
  const speed = useSimulation((s) => s.speed);
  const setSpeed = useSimulation((s) => s.setSpeed);
  return (
    <div className="sim-speed" role="radiogroup" aria-label="Velocidade">
      <span className="sim-speed-label">Velocidade</span>
      <div className="sim-seg">
        {SPEEDS.map((s, i) => (
          <button key={s.label} type="button" role="radio" aria-checked={speed === i} className={speed === i ? 'is-on' : undefined} onClick={() => setSpeed(i)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
