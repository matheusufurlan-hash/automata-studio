/**
 * Aba "Árvore de IDs" (AP e MT não determinística), como a figura 6.4 do
 * Hopcroft, deitada: a raiz à esquerda e cada ramo lido como a sequência de
 * IDs com ⊢. Cada nó mostra a ID no formato do livro; a ligação com o pai, a
 * regra usada; o status tem cor + ícone + legenda.
 *
 * O caminho mostrado (o da resposta, ou o do nó clicado) fica destacado e o
 * nó do passo atual brilha. Clicar num nó mostra o caminho até ele no canvas
 * e na sequência de IDs. Árvores grandes não travam a tela: começam com
 * poucos níveis abertos ("+N" abre o resto) e só os nós à vista são desenhados.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronsDownUp, ChevronsUpDown, CircleCheck, CircleDashed, CircleDot, CircleX, LocateFixed, Repeat, Search } from 'lucide-react';
import type { IDStatus } from '../../core/common';
import type { PDAConfig } from '../../core/pda/types';
import type { TMConfig } from '../../core/tm/types';
import { useActiveKind } from '../../store/documents';
import { formatPDARule, formatTMRule } from '../editor/rules';
import { Transport, WordField } from './Controls';
import { IDText } from './IDSequence';
import type { IDItem, MachineRun } from './machine';
import { isRunFinished, MAX_NODES_CAP, pdaIdText, pdaRuleOf, stepTone, tmIdParts, tmRuleOf, treeOf } from './machine';

import { MathText } from './MathText';
import { useSimulation } from './store';
import type { LaidNode, TreeNodeLike } from './tree';
import { allOpen, defaultOpen, layoutTree, NODE_H, openBelow, visibleNodes } from './tree';
import './tree.css';

export const STATUS_LABEL: Record<IDStatus, string> = {
  ACCEPTING: 'aceita',
  EXPANDED: 'expandida',
  DEAD: 'morreu',
  REPEATED: 'repetida',
  UNEXPLORED: 'não explorada',
};

const STATUS_HINT: Record<IDStatus, string> = {
  ACCEPTING: 'a palavra é aceita nesta ID',
  EXPANDED: 'alguma regra se aplica: a ID tem filhas',
  DEAD: 'nenhuma regra se aplica e a ID não aceita: o ramo morre',
  REPEATED: 'esta ID já apareceu antes na árvore: não é expandida de novo',
  UNEXPLORED: 'a busca parou antes de expandir esta ID',
};

export const STATUS_ICON: Record<IDStatus, ReactNode> = {
  ACCEPTING: <CircleCheck size={14} strokeWidth={2.4} />,
  EXPANDED: <CircleDot size={14} strokeWidth={2.2} />,
  DEAD: <CircleX size={14} strokeWidth={2.4} />,
  REPEATED: <Repeat size={13} strokeWidth={2.4} />,
  UNEXPLORED: <CircleDashed size={14} strokeWidth={2.2} />,
};

const ORDER: IDStatus[] = ['ACCEPTING', 'EXPANDED', 'DEAD', 'REPEATED', 'UNEXPLORED'];

/* ------------------------------------------------------------------ */
/* Medida do texto (a caixa de cada ID tem a largura certa)            */
/* ------------------------------------------------------------------ */

const NODE_FONT = "600 12.5px 'Inter Variable', sans-serif";
const RULE_FONT = "600 11px 'Inter Variable', sans-serif";
const widths = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null | undefined;

/** Largura do texto na fonte da tela (com folga); sem canvas, uma estimativa generosa. */
function measure(text: string, font: string): number {
  const key = `${font}\u0000${text}`;
  const hit = widths.get(key);
  if (hit !== undefined) return hit;
  if (ctx === undefined) {
    try {
      // jsdom (testes) não tem canvas: usa a estimativa
      const real = typeof document !== 'undefined' && !/jsdom/i.test(navigator.userAgent);
      ctx = real ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      ctx = null;
    }
  }
  const size = font === NODE_FONT ? 12.5 : 11;
  const estimate = Array.from(text).length * size * 0.62;
  let w = estimate;
  if (ctx) {
    ctx.font = font;
    // a fonte não foi aceita (o canvas ficou no padrão de 10px): usa a estimativa
    if (ctx.font.includes(`${size}px`)) w = Math.max(ctx.measureText(text).width, estimate * 0.8);
  }
  w = Math.ceil(w * 1.06) + 3;
  widths.set(key, w);
  return w;
}

/** Carrega a fonte das IDs e avisa quando der para medir de novo. */
function whenFontsLoad(done: () => void): () => void {
  let alive = true;
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (fonts?.load) {
    Promise.all([fonts.load(NODE_FONT), fonts.load(RULE_FONT)])
      .then(() => {
        if (!alive) return;
        widths.clear();
        done();
      })
      .catch(() => {});
  }
  return () => {
    alive = false;
  };
}

/* ------------------------------------------------------------------ */
/* Textos de cada nó                                                   */
/* ------------------------------------------------------------------ */

interface NodeText {
  item: Pick<IDItem, 'text' | 'parts'>;
  plain: string;
  rule: string | null;
}

function nodeTexts(run: MachineRun): (i: number) => NodeText {
  const cache = new Map<number, NodeText>();
  return (i) => {
    const hit = cache.get(i);
    if (hit) return hit;
    const tree = treeOf(run)!;
    const n = tree[i]!;
    let t: NodeText;
    if (run.kind === 'pda') {
      const text = pdaIdText(run.pda, n.config as PDAConfig);
      const used = n.via ? pdaRuleOf(run.pda, n.via) : null;
      t = { item: { text }, plain: text, rule: used ? formatPDARule(used.rule) : null };
    } else {
      const parts = tmIdParts(run.tm, n.config as TMConfig);
      const used = n.via ? tmRuleOf(run.tm, n.via) : null;
      t = { item: { parts }, plain: `${parts.left}${parts.state}${parts.right}`, rule: used ? formatTMRule(used.rule) : null };
    }
    cache.set(i, t);
    return t;
  };
}

/* ------------------------------------------------------------------ */
/* Desenho                                                             */
/* ------------------------------------------------------------------ */

function edgePath(p: LaidNode, c: LaidNode): string {
  const x1 = p.x + p.w;
  const y1 = p.y + NODE_H / 2;
  const x2 = c.x;
  const y2 = c.y + NODE_H / 2;
  // termina na horizontal, para o rótulo da regra ficar em cima da linha
  const end = x2 - c.ruleW - 14;
  const mid = x1 + Math.max(10, (end - x1) / 2);
  return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${Math.max(mid, end)},${y2} L${x2},${y2}`;
}

interface OpenState {
  tree: readonly TreeNodeLike[];
  path: readonly number[] | null;
  open: Set<number>;
}

function TreeCanvas({ run, step }: { run: MachineRun; step: number }) {
  const tree = treeOf(run)! as readonly (TreeNodeLike & { config: unknown })[];
  const path = run.path;
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, w: 900, h: 300 });
  // a largura das IDs é medida com a fonte da tela: quando ela termina de carregar, mede de novo
  const [fontsVersion, setFontsVersion] = useState(0);
  useEffect(() => whenFontsLoad(() => setFontsVersion((v) => v + 1)), []);

  // nós abertos: começam com poucos níveis + o caminho; uma árvore nova
  // recomeça; um caminho novo (nó clicado) abre o que faltar até ele
  const [state, setState] = useState<OpenState>(() => ({ tree, path, open: defaultOpen(tree, path ?? []) }));
  let current = state;
  if (state.tree !== tree) {
    current = { tree, path, open: defaultOpen(tree, path ?? []) };
    setState(current);
  } else if (state.path !== path) {
    const open = new Set(state.open);
    for (const i of path ?? []) if (tree[i] && tree[i]!.children.length > 0 && i !== path![path!.length - 1]) open.add(i);
    current = { tree, path, open };
    setState(current);
  }
  const open = current.open;
  const setOpen = (next: Set<number>) => setState({ tree, path, open: next });

  const text = useMemo(() => nodeTexts(run), [run]);
  const layout = useMemo(
    () =>
      layoutTree(
        tree,
        open,
        (i) => measure(text(i).plain, NODE_FONT) + 40,
        (i) => {
          const r = text(i).rule;
          return r ? measure(r, RULE_FONT) + 12 : 0;
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fontsVersion: medir de novo depois que a fonte carrega
    [tree, open, text, fontsVersion],
  );
  const shown = useMemo(() => visibleNodes(layout, view), [layout, view]);
  const onPath = useMemo(() => new Set(path ?? []), [path]);
  const currentNode = path ? (path[Math.max(0, Math.min(step, path.length - 1))] ?? null) : null;
  const finished = isRunFinished(run, step);
  const tone = stepTone(run, step);

  // tamanho e rolagem da área (só os nós à vista são desenhados)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setView({ x: el.scrollLeft, y: el.scrollTop, w: el.clientWidth, h: el.clientHeight });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => onScroll());
      ro.observe(el);
    }
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // o nó do passo atual fica à vista: rolagem suave ao andar um passo; ao
  // abrir a aba ou quando o desenho muda (a fonte carregou), vai direto
  const shownNode = useRef<number | null>(null);
  useEffect(() => {
    const el = scroller.current;
    const n = currentNode === null ? null : layout.at.get(currentNode);
    const stepped = shownNode.current !== null && shownNode.current !== currentNode;
    shownNode.current = currentNode;
    if (!el || !n) return;
    const margin = 40;
    const left = el.scrollLeft;
    const top = el.scrollTop;
    const inX = n.x >= left + margin && n.x + n.w <= left + el.clientWidth - margin;
    const inY = n.y >= top + 8 && n.y + NODE_H <= top + el.clientHeight - 8;
    if (inX && inY) return;
    const x = inX ? left : Math.max(0, n.x + n.w / 2 - el.clientWidth / 2);
    const y = inY ? top : Math.max(0, n.y + NODE_H / 2 - el.clientHeight / 2);
    const far = Math.abs(x - left) > el.clientWidth || Math.abs(y - top) > el.clientHeight;
    el.scrollTo?.({ left: x, top: y, behavior: stepped && !far ? 'smooth' : 'auto' });
  }, [currentNode, layout]);

  const focusNode = useSimulation.getState().focusNode;

  return (
    <div className="sim-tree-wrap">
    <div ref={scroller} className="sim-tree-scroll" role="tree" aria-label="Árvore de descrições instantâneas">
      <div className="sim-tree-canvas" style={{ width: layout.width, height: layout.height }}>
        <svg className="sim-tree-edges" width={layout.width} height={layout.height} aria-hidden>
          {shown.map((n) => {
            const p = n.parent === null ? null : layout.at.get(n.parent);
            if (!p) return null;
            const lit = onPath.has(n.index) && onPath.has(p.index);
            return <path key={n.index} className={lit ? 'is-path' : undefined} d={edgePath(p, n)} />;
          })}
        </svg>
        {shown.map((n) => {
          const t = text(n.index);
          const lit = onPath.has(n.index);
          const cls = ['sim-tree-node', `st-${n.status.toLowerCase()}`];
          if (lit) cls.push('is-path');
          if (n.index === currentNode) cls.push('is-current', `tone-${finished ? tone : 'running'}`);
          if (n.index === run.focus) cls.push('is-focus');
          return (
            <div key={n.index} className="sim-tree-item">
              {t.rule && (
                <span
                  className={lit && n.parent !== null && onPath.has(n.parent) ? 'sim-tree-rule is-path' : 'sim-tree-rule'}
                  style={{ left: n.x - n.ruleW - 8, top: n.y + NODE_H / 2 - 9, width: n.ruleW }}
                >
                  <MathText text={t.rule} />
                </span>
              )}
              <button
                type="button"
                role="treeitem"
                aria-selected={n.index === run.focus}
                aria-expanded={n.hasChildren ? n.open : undefined}
                className={cls.join(' ')}
                style={{ left: n.x, top: n.y, width: n.w }}
                onClick={() => focusNode(n.index)}
                title={`${t.plain}\n${STATUS_LABEL[n.status]}: ${STATUS_HINT[n.status]}${t.rule ? `\nregra usada: ${t.rule}` : ''}\nclique para ver o caminho até aqui`}
              >
                <span className="ico">{STATUS_ICON[n.status]}</span>
                <span className="txt">
                  <IDText item={t.item} />
                </span>
              </button>
              {n.hidden > 0 && (
                <button
                  type="button"
                  className="sim-tree-toggle"
                  style={{ left: n.x + n.w + 6, top: n.y + 3 }}
                  onClick={() => setOpen(openBelow(tree, open, n.index))}
                  title={`Mostrar as IDs abaixo desta (${n.hidden})`}
                >
                  +{n.hidden.toLocaleString('pt-BR')}
                </button>
              )}
              {n.open && n.index !== 0 && (
                <button
                  type="button"
                  className="sim-tree-toggle is-close"
                  style={{ left: n.x + n.w + 4, top: n.y + 5 }}
                  onClick={() => {
                    const next = new Set(open);
                    next.delete(n.index);
                    setOpen(next);
                  }}
                  title="Esconder as IDs abaixo desta"
                  aria-label="Esconder as IDs abaixo desta"
                >
                  −
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
    <TreeActions
      onAll={() => setOpen(allOpen(tree))}
      onDefault={() => setOpen(defaultOpen(tree, path ?? []))}
      onLocate={() => {
        const el = scroller.current;
        const n = currentNode === null ? null : layout.at.get(currentNode);
        if (el && n) el.scrollTo?.({ left: Math.max(0, n.x + n.w / 2 - el.clientWidth / 2), top: Math.max(0, n.y - el.clientHeight / 2), behavior: 'smooth' });
      }}
      allShown={layout.nodes.length === tree.length}
    />
    </div>
  );
}

/** Botões flutuantes no canto da árvore. */
function TreeActions({ onAll, onDefault, onLocate, allShown }: { onAll(): void; onDefault(): void; onLocate(): void; allShown: boolean }) {
  return (
    <div className="sim-tree-actions">
      <button type="button" className="ed-icon-btn sm" onClick={onLocate} aria-label="Ir para o passo atual" data-tip="Ir para o passo atual" data-tip-pos="top">
        <LocateFixed size={15} />
      </button>
      {allShown ? (
        <button type="button" className="ed-icon-btn sm" onClick={onDefault} aria-label="Recolher" data-tip="Recolher" data-tip-pos="top" data-tip-align="end">
          <ChevronsDownUp size={15} />
        </button>
      ) : (
        <button type="button" className="ed-icon-btn sm" onClick={onAll} aria-label="Abrir todas as IDs" data-tip="Abrir todas as IDs" data-tip-pos="top" data-tip-align="end">
          <ChevronsUpDown size={15} />
        </button>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="sim-tree-legend" aria-label="Legenda">
      {ORDER.map((s) => (
        <span key={s} className={`st-${s.toLowerCase()}`} title={STATUS_HINT[s]}>
          {STATUS_ICON[s]} {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;

export function TreeView() {
  const kind = useActiveKind();
  const machine = useSimulation((s) => s.machine);
  const step = useSimulation((s) => s.step);
  const treeAll = useSimulation((s) => s.treeAll);
  const sim = useSimulation.getState();
  const tree = machine ? treeOf(machine) : null;
  const limitReached = !!machine && (machine.kind === 'pda' ? machine.result.limitReached : !!machine.result.limitReached);
  // buscar mais só adianta se quem parou foi o limite de IDs (não a memória) e ainda não chegamos ao teto
  const canSearchMore =
    limitReached && !!machine && !machine.result.memoryLimit && machine.limits.maxNodes < MAX_NODES_CAP;
  const levels = useMemo(() => (tree ? tree.reduce((m, n) => Math.max(m, n.depth), 0) + 1 : 0), [tree]);
  const unexplored = useMemo(() => (tree ? tree.some((n) => n.status === 'UNEXPLORED') : false), [tree]);
  const dtm = kind === 'tm' && !!machine && !tree;

  return (
    <div className="sim-tree">
      <div className="sim-tree-head">
        <WordField />
        <Transport />
        {tree && tree.length > 0 && (
          <span className="sim-tree-stats">
            <b>{count(tree.length, 'ID', 'IDs')}</b> · {count(levels, 'nível', 'níveis')}
            {limitReached && (
              <span className="sim-tree-limit">
                {machine?.result.memoryLimit ? ' · a busca parou para não acabar a memória' : ' · a busca parou no limite'}
              </span>
            )}
          </span>
        )}
        <span className="grow" />
        {(kind === 'pda' || !dtm) && (
          <label className="sim-check" title="Continua a busca depois de aceitar, para montar a árvore inteira (até o limite de IDs)">
            <input type="checkbox" checked={treeAll} onChange={(e) => sim.setTreeAll(e.target.checked)} />
            Mostrar a árvore inteira
          </label>
        )}
        {canSearchMore && (
          <button type="button" className="ed-btn sm" onClick={() => sim.searchMore()} title="Simula de novo com 4 vezes mais IDs">
            <Search size={14} /> Buscar mais
          </button>
        )}
      </div>
      {!machine ? (
        <div className="sim-tree-empty">
          Digite uma palavra e aperte <b>Enter</b> (ou ▶): a árvore mostra todas as descrições instantâneas que a busca visitou,
          a partir de {kind === 'tm' ? 'q0w (a MT em q0, com a cabeça na 1ª letra de w) — numa MT não determinística' : '(q0, w, Z0)'}.
        </div>
      ) : dtm ? (
        <div className="sim-tree-empty">
          Esta MT é <b>determinística</b> (MTD): de cada ID sai no máximo uma, então a “árvore” é uma linha só, a sequência de IDs
          da aba Simulação. A árvore aparece nas MT não determinísticas (MTN), como a do exemplo “MTN: contém 00”.
        </div>
      ) : !tree || tree.length === 0 ? (
        <div className="sim-tree-empty">Nenhuma ID: sem estado inicial, a simulação nem começa.</div>
      ) : (
        <>
          <TreeCanvas run={machine} step={step} />
          <div className="sim-tree-foot">
            <Legend />
            {machine.focus !== null ? (
              <button type="button" className="sim-link" onClick={() => sim.focusNode(null)}>
                voltar ao caminho da resposta
              </button>
            ) : (
              unexplored &&
              !treeAll &&
              !limitReached && <span className="sim-tree-hint">A busca parou ao aceitar: marque “Mostrar a árvore inteira” para ver o resto.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
