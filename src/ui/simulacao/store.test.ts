import { FA_EXAMPLES } from '../../core/fa/examples';
import { useDocuments } from '../../store/documents';
import { useHighlight } from '../../store/highlight';
import { SPEEDS, useSimulation } from './store';

const example = (id: string) => FA_EXAMPLES.find((e) => e.id === id)!;
const sim = () => useSimulation.getState();
const hl = () => useHighlight.getState();

function openExample(id: string) {
  const e = example(id);
  useDocuments.getState().openInNewTab(e.name, structuredClone(e.fa), structuredClone(e.layout));
}

beforeEach(() => {
  vi.useFakeTimers();
  openExample('afd-so-01');
  sim().reset();
  sim().setWord('');
  sim().setSpeed(1);
});

afterEach(() => {
  sim().pause();
  vi.useRealTimers();
});

describe('simulação: passo, voltar, tocar', () => {
  it('load vai ao passo 0 e acende o inicial', () => {
    sim().load('01');
    expect(sim().step).toBe(0);
    expect(hl().active).toEqual(['q0']);
    expect(hl().status).toBe('running');
  });

  it('avançar / voltar / início / fim, sem passar dos limites', () => {
    sim().setWord('01');
    sim().next(); // sem simulação: carrega no passo 0
    expect(sim().step).toBe(0);
    sim().next();
    expect(sim().step).toBe(1);
    expect(hl().active).toEqual(['q1']);
    sim().next();
    sim().next();
    expect(sim().step).toBe(2);
    expect(hl().status).toBe('accepted');
    sim().prev();
    expect(sim().step).toBe(1);
    expect(hl().status).toBe('running');
    sim().first();
    expect(sim().step).toBe(0);
    sim().prev();
    expect(sim().step).toBe(0);
    sim().last();
    expect(sim().step).toBe(2);
    sim().goTo(1);
    expect(sim().step).toBe(1);
  });

  it('tocar avança sozinho e para no fim', () => {
    sim().setWord('01');
    sim().play();
    expect(sim().playing).toBe(true);
    expect(sim().step).toBe(0);
    vi.advanceTimersByTime(SPEEDS[1].ms);
    expect(sim().step).toBe(1);
    vi.advanceTimersByTime(SPEEDS[1].ms);
    expect(sim().step).toBe(2);
    expect(sim().playing).toBe(false);
    expect(hl().status).toBe('accepted');
    vi.advanceTimersByTime(10 * SPEEDS[1].ms);
    expect(sim().step).toBe(2);
  });

  it('pausar para o relógio; tocar no fim recomeça do início', () => {
    sim().load('01');
    sim().togglePlay();
    sim().togglePlay();
    expect(sim().playing).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(sim().step).toBe(0);
    sim().last();
    sim().play();
    expect(sim().step).toBe(0);
    expect(sim().playing).toBe(true);
  });

  it('a velocidade muda o intervalo', () => {
    sim().setSpeed(3);
    sim().load('01');
    sim().play();
    vi.advanceTimersByTime(SPEEDS[3].ms);
    expect(sim().step).toBe(1);
  });

  it('andar à mão pausa', () => {
    sim().load('01');
    sim().play();
    sim().next();
    expect(sim().playing).toBe(false);
  });

  it('palavra vazia: um passo só, já com o resultado', () => {
    sim().load('');
    expect(sim().step).toBe(0);
    expect(hl().status).toBe('rejected');
    sim().play();
    expect(sim().playing).toBe(false);
  });

  it('mudar a palavra tira a simulação e limpa o destaque', () => {
    sim().load('01');
    sim().setWord('0');
    expect(sim().result).toBeNull();
    expect(hl().active).toEqual([]);
  });

  it('editar o autômato reseta a simulação e limpa o destaque', () => {
    sim().load('01');
    sim().next();
    expect(hl().active).toEqual(['q1']);
    useDocuments.getState().toggleFinal('q1');
    expect(sim().result).toBeNull();
    expect(hl().active).toEqual([]);
    expect(sim().word).toBe('01');
  });

  it('trocar de aba reseta a simulação', () => {
    sim().load('01');
    openExample('afd-termina-01');
    expect(sim().result).toBeNull();
  });
});

describe('teste em lote no store', () => {
  it('runBatch guarda o resultado e o autômato usado', () => {
    sim().setBatchText('+01\n-0');
    sim().runBatch();
    expect(sim().batchResults!.map((r) => r.ok)).toEqual([true, true]);
    expect(sim().batchSource).toBe('+01\n-0');
  });
});
