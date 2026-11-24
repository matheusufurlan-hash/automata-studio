/**
 * Teste em lote de AP e MT: uma palavra por linha (+ deve aceitar, - deve
 * rejeitar) e, na MT que calcula uma função (aceitação por parada),
 * "palavra => saída". Verde quando bate, vermelho quando não bate e amarelo
 * quando não dá para saber (a busca parou no limite) ou a MT não para.
 * Clicar num resultado carrega a palavra no simulador.
 */
import { useMemo } from 'react';
import { BookOpenCheck, Check, CircleAlert, ListRestart, Play, Wand2, X } from 'lucide-react';
import { EPSILON } from '../../core/common';
import { formalDefinition as tmFormalDefinition } from '../../core/tm';
import { useActiveDoc } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { examplesSamples } from '../ferramentas/actions';
import { formatSet, showWord } from '../ferramentas/format';
import { useTools } from '../ferramentas/store';
import { countWords } from './batch';
import type { MachineAutomaton } from './machine';
import type { MachineBatchResult, Outcome } from './machineBatch';
import { samplesToBatch, summarizeMachine } from './machineBatch';
import { machineSigma, useSimulation } from './store';

/** "1 aceita" / "3 aceitas". */
const count = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;

const PILL: Record<Outcome, { label: string; cls: string }> = {
  accepted: { label: 'ACEITA', cls: 'acc' },
  rejected: { label: 'REJEITA', cls: 'rej' },
  loop: { label: 'NÃO PARA', cls: 'und' },
  undecided: { label: 'INDEFINIDO', cls: 'und' },
};

function placeholder(halt: boolean): string {
  return halt
    ? `Uma palavra por linha:
0000100 => 00   deve parar com 00 na fita
+0001           deve aceitar (parar)
0101            só testar
ε => ε          palavra vazia, fita vazia`
    : `Uma palavra por linha:
+0110    deve aceitar
-011     deve rejeitar
0101     só testar
ε        palavra vazia`;
}

function Item({ r, halt }: { r: MachineBatchResult; halt: boolean }) {
  const sim = useSimulation.getState();
  const pill = PILL[r.outcome];
  const mark = r.ok === true ? 'ok' : r.ok === false ? 'bad' : r.outcome === 'undecided' && (r.expected !== null || r.expectedOutput !== undefined) ? 'und' : 'none';
  const expectedOut = r.expectedOutput !== undefined && r.output !== r.expectedOutput ? ` (esperava ${r.expectedOutput === '' ? EPSILON : r.expectedOutput})` : '';
  return (
    <button
      type="button"
      role="listitem"
      className={r.ok === false ? 'sim-batch-item is-bad' : 'sim-batch-item'}
      onClick={() => {
        sim.setTab('simulate');
        sim.load(r.word);
      }}
      title={`Linha ${r.line}: ${showWord(r.word)} — ${r.detail}${expectedOut}. Clique para simular passo a passo.`}
    >
      <span className={`mark ${mark}`}>
        {mark === 'ok' ? <Check size={13} /> : mark === 'bad' ? <X size={13} /> : mark === 'und' ? '?' : '•'}
      </span>
      <span className={r.word === '' ? 'word eps' : 'word'}>{showWord(r.word)}</span>
      {halt && r.output !== undefined && (
        <span className={r.output === '' ? 'out eps' : 'out'} title={`Saída (o que ficou na fita): ${r.output === '' ? EPSILON : r.output}`}>
          <span className="sim-arrow">→</span> {r.output === '' ? EPSILON : r.output}
        </span>
      )}
      <span className={`pill ${pill.cls}`}>{pill.label}</span>
    </button>
  );
}

export function MachineBatchView() {
  const doc = useActiveDoc();
  const text = useSimulation((s) => s.batchText);
  const results = useSimulation((s) => s.machineBatch);
  const batchOf = useSimulation((s) => s.machineBatchOf);
  const source = useSimulation((s) => s.batchSource);
  const progress = useSimulation((s) => s.batchProgress);
  const genLength = useSimulation((s) => s.genLength);
  const exampleId = useTools((s) => s.exampleOf[doc.id]);
  const sim = useSimulation.getState();
  const a = doc.automaton;
  const current = a.kind === 'pda' ? a.pda : a.kind === 'tm' ? a.tm : null;
  const sigma = useMemo(() => {
    const m: MachineAutomaton | null = a.kind === 'pda' ? { kind: 'pda', pda: a.pda } : a.kind === 'tm' ? { kind: 'tm', tm: a.tm } : null;
    return m ? machineSigma(m) : [];
  }, [a]);
  const guessed = useMemo(() => (a.kind === 'tm' ? tmFormalDefinition(a.tm).inputAlphabetGuessed : false), [a]);
  const halt = a.kind === 'tm' && a.tm.acceptance === 'HALT';
  const samples = exampleId ? examplesSamples(doc.id) : null;
  const stale = !!results && !progress && (batchOf !== current || source !== text);
  const summary = results ? summarizeMachine(results) : null;
  const lines = text.split('\n').filter((l) => l.trim() !== '').length;

  const generate = () => {
    const expected = countWords(sigma.length, genLength);
    const { count, truncated } = sim.generateBatch();
    if (truncated) {
      useEditorUi
        .getState()
        .toast(`Seriam ${Math.round(expected).toLocaleString('pt-BR')} palavras: parei nas primeiras ${count.toLocaleString('pt-BR')}.`, 'info');
    }
  };

  return (
    <div className="sim-batch">
      <div className="sim-batch-left">
        <textarea
          className="sim-batch-text"
          value={text}
          placeholder={placeholder(halt)}
          spellCheck={false}
          onChange={(e) => sim.setBatchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              sim.runBatch();
            }
          }}
          aria-label="Palavras para testar, uma por linha"
        />
        <div className="sim-batch-actions">
          <button type="button" className="ed-btn primary sm" onClick={() => sim.runBatch()} disabled={lines === 0}>
            <Play size={14} /> Testar tudo
          </button>
          <span
            className="sim-gen"
            data-tip={`Todas as palavras sobre Σ = ${formatSet(sigma, ', ')} com até n símbolos${guessed ? ' (Σ é um palpite)' : ''}`}
            data-tip-pos="top"
          >
            <button type="button" className="ed-btn sm" onClick={generate} disabled={sigma.length === 0}>
              <Wand2 size={14} /> Gerar até n =
            </button>
            <input
              type="number"
              className="sim-gen-n"
              min={0}
              max={12}
              value={genLength}
              onChange={(e) => sim.setGenLength(Number(e.target.value))}
              aria-label="Tamanho máximo n"
            />
          </span>
          {samples && (
            <button
              type="button"
              className="ed-btn sm"
              onClick={() => {
                sim.setBatchText(samplesToBatch(samples));
                sim.runBatch();
              }}
              data-tip="As palavras de teste do exemplo, com a resposta certa"
              data-tip-pos="top"
            >
              <BookOpenCheck size={14} /> Do exemplo
            </button>
          )}
          <button
            type="button"
            className="ed-icon-btn sm"
            onClick={() => sim.setBatchText('')}
            disabled={text === ''}
            aria-label="Limpar a lista"
            data-tip="Limpar"
            data-tip-pos="top"
          >
            <ListRestart size={15} />
          </button>
        </div>
      </div>

      <div className="sim-batch-right">
        {guessed && (
          <p className="sim-batch-warn">
            <CircleAlert size={14} /> Σ não foi informado: “Gerar” usa o palpite Γ − {'{B}'} = {formatSet(sigma, ', ')}. Informe Σ nas
            propriedades da MT (canto de cima do canvas).
          </p>
        )}
        {!results ? (
          <div className="sim-batch-empty">
            <p>
              Escreva as palavras à esquerda e clique em <b>Testar tudo</b> (Ctrl+Enter). Use <code>+</code> ou <code>-</code> no
              começo da linha para dizer o que você espera
              {halt ? (
                <>
                  {' '}
                  e <code>palavra =&gt; saída</code> para a saída esperada
                </>
              ) : null}
              ; as linhas que não baterem ficam em vermelho.
            </p>
            <p className="muted">
              {samples ? 'O botão “Do exemplo” traz as palavras de teste deste exemplo. ' : ''}Clique num resultado para simular passo a
              passo.
            </p>
          </div>
        ) : (
          <>
            <div className="sim-batch-summary">
              <span>
                <b>{summary!.total}</b> {summary!.total === 1 ? 'palavra' : 'palavras'}
              </span>
              <span className="acc">{count(summary!.accepted, 'aceita', 'aceitas')}</span>
              <span className="rej">{count(summary!.rejected, 'rejeitada', 'rejeitadas')}</span>
              {summary!.loop > 0 && <span className="und">{count(summary!.loop, 'não para', 'não param')}</span>}
              {summary!.undecided > 0 && <span className="und">{count(summary!.undecided, 'indefinida', 'indefinidas')}</span>}
              {progress ? (
                <span className="stale">
                  testando… {progress.done.toLocaleString('pt-BR')} de {progress.total.toLocaleString('pt-BR')}
                </span>
              ) : (
                summary!.passed + summary!.failed + summary!.unresolved > 0 &&
                (summary!.failed === 0 && summary!.unresolved === 0 ? (
                  <span className="ok">
                    <Check size={13} /> todas como esperado
                  </span>
                ) : summary!.failed === 0 ? (
                  <span className="und" title="As que não pararam ou ficaram indefinidas não contam como certas.">
                    <CircleAlert size={13} /> {summary!.passed} de {summary!.passed + summary!.unresolved} como esperado
                  </span>
                ) : (
                  <span className="bad">
                    <X size={13} /> {summary!.failed} diferente{summary!.failed === 1 ? '' : 's'} do esperado
                  </span>
                ))
              )}
              {stale && <span className="stale">desatualizado: teste de novo</span>}
            </div>
            <div className={stale ? 'sim-batch-list is-stale' : 'sim-batch-list'} role="list">
              {results.map((r) => (
                <Item key={r.line} r={r} halt={halt} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
