/**
 * Painel de simulação (embaixo do canvas):
 *  - aba Simulação: palavra, ⏮ ◀ ▶/⏸ ▶ ⏭, velocidade, fita, linha do tempo e
 *    o cartão com a explicação do passo e o selo ACEITA/REJEITA;
 *  - aba Teste em lote.
 * Aba de AP ou MT: o painel deles (MachinePanel.tsx), com a pilha, a fita da
 * MT, a sequência de IDs e a árvore de IDs.
 * Atalhos (fora de campos de texto): Espaço toca/pausa, ← → passo a passo.
 */
import { useMemo } from 'react';
import { ChevronDown, ChevronUp, CircleCheck, CircleX, ListChecks, Footprints } from 'lucide-react';
import { alphabet, EPSILON } from '../../core/fa';
import { EMPTY_FA, faOf, isEmptyDoc, useActiveDoc, useActiveKind } from '../../store/documents';
import { Kbd } from '../editor/Menu';
import { showWord } from '../ferramentas/format';
import './simulacao.css';
import { BatchView } from './BatchView';
import { Speed, Transport, useShortcuts, WordField } from './Controls';
import { explainStep, isFinished, lastStep, tapeModel, timeline } from './logic';
import { MachinePanel } from './MachinePanel';
import { REASON_TITLE, verdictText } from './reasons';
import { useSimulation } from './store';
import { Tape } from './Tape';
import { Timeline } from './Timeline';

function StatusCard() {
  const doc = useActiveDoc();
  const result = useSimulation((s) => s.result);
  const fa = useSimulation((s) => s.fa);
  const step = useSimulation((s) => s.step);
  const simWord = useSimulation((s) => s.simWord);

  if (!result || !fa) {
    const empty = isEmptyDoc(doc);
    return (
      <div className="sim-card is-idle">
        <div className="sim-card-eyebrow">Como simular</div>
        {empty ? (
          <p>Desenhe um autômato (ou abra um em Exemplos) e digite uma palavra.</p>
        ) : (
          <p>
            Digite a palavra e aperte <Kbd keys={['Enter']} /> ou ▶. Depois, ande passo a passo com <Kbd keys={['←']} />{' '}
            <Kbd keys={['→']} /> e toque/pause com <Kbd keys={['Espaço']} />.
          </p>
        )}
      </div>
    );
  }

  const finished = isFinished(result, step);
  const total = Math.max(0, lastStep(result));
  const exp = explainStep(fa, result, step);
  const accepted = result.accepted;

  return (
    <div className={finished ? `sim-card is-${accepted ? 'accepted' : 'rejected'}` : 'sim-card'} aria-live="polite">
      <div className="sim-card-eyebrow">
        <span className="sim-card-step">{result.steps.length > 0 ? `Passo ${Math.max(0, step)} de ${total}` : 'Simulação'}</span>
        <span className="sim-card-word">w = {showWord(simWord)}</span>
      </div>
      {!finished && exp && <div className="sim-card-title">{exp.title}</div>}
      {exp && (
        <div className={finished ? 'sim-card-math is-small' : 'sim-card-math'}>
          {exp.lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}
      {finished && (
        <div className="sim-verdict">
          <span className={accepted ? 'sim-seal is-accepted' : 'sim-seal is-rejected'}>
            {accepted ? <CircleCheck size={20} strokeWidth={2.4} /> : <CircleX size={20} strokeWidth={2.4} />}
            {accepted ? 'ACEITA' : 'REJEITA'}
          </span>
          <p className="sim-reason">
            {!accepted && result.reason && <b>{REASON_TITLE[result.reason]}: </b>}
            {verdictText(fa, simWord, result)}.
          </p>
        </div>
      )}
    </div>
  );
}

function SimulateView() {
  const doc = useActiveDoc();
  const word = useSimulation((s) => s.word);
  const result = useSimulation((s) => s.result);
  const fa = useSimulation((s) => s.fa);
  const simWord = useSimulation((s) => s.simWord);
  const step = useSimulation((s) => s.step);
  const goTo = useSimulation((s) => s.goTo);
  const docFa = faOf(doc) ?? EMPTY_FA;
  const sigma = useMemo(() => alphabet(docFa), [docFa]);
  // ε digitado é a palavra vazia: não aparece como célula da fita
  const shownWord = result ? simWord : word.split(EPSILON).join('');
  const tape = useMemo(() => tapeModel(shownWord, sigma, result, step), [shownWord, sigma, result, step]);
  const items = useMemo(() => (result && fa ? timeline(fa, result) : []), [fa, result]);
  const tone = tape.tone === 'idle' ? 'running' : tape.tone;

  return (
    <div className="sim-body">
      <div className="sim-main">
        <div className="sim-controls">
          <WordField />
          <Transport />
          <Speed />
        </div>
        <Tape model={tape} empty={shownWord === ''} />
        <Timeline items={items} step={step} tone={tone} onPick={goTo} />
      </div>
      <StatusCard />
    </div>
  );
}

export function SimulationPanel() {
  const tab = useSimulation((s) => s.tab);
  const collapsed = useSimulation((s) => s.collapsed);
  const result = useSimulation((s) => s.result);
  const step = useSimulation((s) => s.step);
  const setTab = useSimulation((s) => s.setTab);
  const setCollapsed = useSimulation((s) => s.setCollapsed);
  const kind = useActiveKind();
  useShortcuts();

  // AP e MT: pilha, fita infinita, sequência de IDs e árvore
  if (kind !== 'fa') return <MachinePanel kind={kind} />;

  const finished = result && isFinished(result, step);

  return (
    <section className={collapsed ? 'sim is-collapsed' : 'sim'} aria-label="Simulação">
      <header className="sim-head">
        <div className="sim-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'simulate'} className={tab === 'simulate' ? 'sim-tab is-on' : 'sim-tab'} onClick={() => setTab('simulate')}>
            <Footprints size={15} /> Simulação
          </button>
          <button type="button" role="tab" aria-selected={tab === 'batch'} className={tab === 'batch' ? 'sim-tab is-on' : 'sim-tab'} onClick={() => setTab('batch')}>
            <ListChecks size={15} /> Teste em lote
          </button>
        </div>
        {collapsed && result && (
          <span className="sim-mini">
            {finished ? (
              <span className={result.accepted ? 'sim-seal sm is-accepted' : 'sim-seal sm is-rejected'}>{result.accepted ? 'ACEITA' : 'REJEITA'}</span>
            ) : (
              `Passo ${Math.max(0, step)} de ${Math.max(0, lastStep(result))}`
            )}
          </span>
        )}
        <span className="grow" />
        <button
          type="button"
          className="ed-icon-btn sm"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Mostrar o painel de simulação' : 'Recolher o painel de simulação'}
          data-tip={collapsed ? 'Mostrar' : 'Recolher'}
          data-tip-pos="top"
          data-tip-align="end"
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </header>
      {!collapsed && (tab === 'batch' ? <BatchView /> : <SimulateView />)}
    </section>
  );
}
