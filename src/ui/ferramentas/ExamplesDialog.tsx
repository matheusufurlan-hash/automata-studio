/**
 * Galeria de exemplos (os do YAAS), em três seções: autômatos finitos (AF),
 * autômatos com pilha (AP) e máquinas de Turing (MT). Abre na seção do tipo
 * da aba ativa; cada exemplo abre numa aba nova.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AutomatonKind } from '../../core/automaton';
import type { GraphLike, Layout } from '../../core/common';
import { classify } from '../../core/fa';
import type { FAExample } from '../../core/fa/examples';
import { FA_EXAMPLES } from '../../core/fa/examples';
import { classify as classifyPDA } from '../../core/pda';
import { PDA_EXAMPLES } from '../../core/pda/examples';
import type { PDAExample } from '../../core/pda/types';
import { classify as classifyTM } from '../../core/tm';
import { TM_EXAMPLES } from '../../core/tm/examples';
import type { TMExample } from '../../core/tm/types';
import { useActiveKind } from '../../store/documents';
import { KindBadge } from '../editor/KindBadge';
import { openExample } from './actions';
import { MachineTypeBadge } from './MachineSide';
import { TypeBadge } from './TypeBadge';
import { Modal } from './Modal';
import { useTools } from './store';
import { Thumbnail } from './Thumbnail';

interface Group {
  title: string;
  hint: string;
  items: FAExample[];
}

/** Agrupa pelo começo do id (afd-, afn-, enfa-, minimizacao-). */
export function groupExamples(examples: readonly FAExample[]): Group[] {
  const groups: Group[] = [
    { title: 'AFD', hint: 'Determinísticos: bons para simular passo a passo.', items: [] },
    { title: 'AFN', hint: 'Não determinísticos: bons para AFN → AFD.', items: [] },
    { title: 'ε-AFN', hint: 'Com transições ε: veja o fecho-ε na simulação.', items: [] },
    { title: 'Minimização', hint: 'Bons para ver a tabela de pares em escada.', items: [] },
  ];
  for (const e of examples) {
    if (e.id.includes('minimizacao')) groups[3]!.items.push(e);
    else if (e.id.startsWith('enfa-')) groups[2]!.items.push(e);
    else if (e.id.startsWith('afn-')) groups[1]!.items.push(e);
    else groups[0]!.items.push(e);
  }
  return groups.filter((g) => g.items.length > 0);
}

/** "AFD: contém 01" → "Contém 01" (o tipo já aparece no selo). */
export function cardTitle(name: string): string {
  const m = /^(?:AFD|AFN|ε-AFN)( parcial)?: (.*)$/.exec(name);
  if (!m) return name;
  const t = m[2]!.charAt(0).toUpperCase() + m[2]!.slice(1);
  return m[1] ? `${t} (parcial)` : t;
}

/**
 * "AP: 0ⁿ1ⁿ" → "0ⁿ1ⁿ"; "MTN: contém 00" → "Contém 00"; "AP de teste: cada 0…" →
 * "Cada 0… (teste)" (o tipo já aparece no selo). Linguagens como aⁿbⁿcⁿ e wcwᴿ
 * ficam como estão (maiúscula mudaria a notação).
 */
export function machineCardTitle(name: string): string {
  const m = /^(?:AP|APD|MT|MTN)( de teste)?: (.*)$/.exec(name);
  if (!m) return name;
  const rest = m[2]!;
  const word = /^[a-zà-ÿ]{2,}(\s|$)/.test(rest);
  const t = word ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest;
  return m[1] ? `${t} (teste)` : t;
}

interface MachineGroup<E> {
  title: string;
  hint: string;
  items: E[];
}

/** AP: por estado final, por pilha vazia e os determinísticos (APD). */
export function groupPDAExamples(examples: readonly PDAExample[]): MachineGroup<PDAExample>[] {
  const groups: MachineGroup<PDAExample>[] = [
    { title: 'Por estado final', hint: 'L(P): aceita ao ler a palavra toda e parar num estado final.', items: [] },
    { title: 'Por pilha vazia', hint: 'N(P): aceita ao ler a palavra toda com a pilha vazia.', items: [] },
    { title: 'APD', hint: 'Determinísticos (seção 6.4): nunca há duas escolhas.', items: [] },
  ];
  for (const e of examples) {
    if (classifyPDA(e.pda) === 'DPDA' && e.id.startsWith('apd-')) groups[2]!.items.push(e);
    else if (e.pda.acceptance === 'EMPTY_STACK') groups[1]!.items.push(e);
    else groups[0]!.items.push(e);
  }
  return groups.filter((g) => g.items.length > 0);
}

/** MT: as que reconhecem linguagens, as que calculam funções e a não determinística. */
export function groupTMExamples(examples: readonly TMExample[]): MachineGroup<TMExample>[] {
  const groups: MachineGroup<TMExample>[] = [
    { title: 'Reconhecem linguagens', hint: 'Aceitam ao entrar num estado final (Exemplo 8.2 e outras).', items: [] },
    { title: 'Calculam funções', hint: 'Aceitação por parada: a resposta é o que fica na fita.', items: [] },
    { title: 'Não determinística', hint: 'Veja a árvore de IDs na simulação.', items: [] },
  ];
  for (const e of examples) {
    if (classifyTM(e.tm) === 'NTM') groups[2]!.items.push(e);
    else if (e.tm.acceptance === 'HALT') groups[1]!.items.push(e);
    else groups[0]!.items.push(e);
  }
  return groups.filter((g) => g.items.length > 0);
}

const SECTIONS: Array<{ kind: AutomatonKind; label: string; count: number }> = [
  { kind: 'fa', label: 'Autômatos finitos', count: FA_EXAMPLES.length },
  { kind: 'pda', label: 'Autômatos com pilha', count: PDA_EXAMPLES.length },
  { kind: 'tm', label: 'Máquinas de Turing', count: TM_EXAMPLES.length },
];

function Card({
  id,
  graph,
  layout,
  title,
  badge,
  description,
  meta,
  onOpen,
}: {
  id: string;
  graph: GraphLike;
  layout: Layout;
  title: string;
  badge: ReactNode;
  description: string;
  meta: string;
  onOpen(id: string): void;
}) {
  return (
    <button type="button" className="fx-card" onClick={() => onOpen(id)}>
      <div className="fx-card-thumb">
        <Thumbnail fa={graph} layout={layout} />
      </div>
      <div className="fx-card-body">
        <div className="fx-card-title">
          <span>{title}</span>
          {badge}
        </div>
        <p>{description}</p>
        <span className="fx-card-meta">{meta}</span>
      </div>
    </button>
  );
}

function GroupView({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="fx-gallery-group">
      <header>
        <h3>{title}</h3>
        <span>{hint}</span>
      </header>
      <div className="fx-gallery-grid">{children}</div>
    </section>
  );
}

const states = (n: number) => `${n} ${n === 1 ? 'estado' : 'estados'}`;

export function ExamplesDialog() {
  const close = useTools((s) => s.closeDialog);
  const asked = useTools((s) => (s.dialog?.kind === 'examples' ? s.dialog.section : undefined));
  const activeKind = useActiveKind();
  const [section, setSection] = useState<AutomatonKind>(asked ?? activeKind);
  const groups = useMemo(() => groupExamples(FA_EXAMPLES), []);
  const pdaGroups = useMemo(() => groupPDAExamples(PDA_EXAMPLES), []);
  const tmGroups = useMemo(() => groupTMExamples(TM_EXAMPLES), []);
  const open = (id: string) => {
    close();
    openExample(id);
  };

  return (
    <Modal label="Exemplos" onClose={close} className="fx-gallery">
      <h2>Exemplos</h2>
      <p className="sub">Autômatos prontos do YAAS (Prof. David Buzatto). Cada um abre numa aba nova.</p>
      <div className="fx-gallery-tabs" role="tablist" aria-label="Tipo de autômato">
        {SECTIONS.map((s) => (
          <button
            key={s.kind}
            type="button"
            role="tab"
            aria-selected={section === s.kind}
            className={section === s.kind ? 'is-on' : undefined}
            onClick={() => setSection(s.kind)}
          >
            <KindBadge kind={s.kind} /> {s.label} <span className="n">{s.count}</span>
          </button>
        ))}
      </div>
      <div className="fx-gallery-scroll">
        {section === 'fa' &&
          groups.map((g) => (
            <GroupView key={g.title} title={g.title} hint={g.hint}>
              {g.items.map((e) => (
                <Card
                  key={e.id}
                  id={e.id}
                  graph={e.fa}
                  layout={e.layout}
                  title={cardTitle(e.name)}
                  badge={<TypeBadge type={classify(e.fa)} small />}
                  description={e.description}
                  meta={states(e.fa.states.length)}
                  onOpen={open}
                />
              ))}
            </GroupView>
          ))}
        {section === 'pda' &&
          pdaGroups.map((g) => (
            <GroupView key={g.title} title={g.title} hint={g.hint}>
              {g.items.map((e) => (
                <Card
                  key={e.id}
                  id={e.id}
                  graph={e.pda}
                  layout={e.layout}
                  title={machineCardTitle(e.name)}
                  badge={<MachineTypeBadge type={classifyPDA(e.pda)} small />}
                  description={e.description}
                  meta={`${states(e.pda.states.length)} · ${e.pda.acceptance === 'EMPTY_STACK' ? 'por pilha vazia' : 'por estado final'}`}
                  onOpen={open}
                />
              ))}
            </GroupView>
          ))}
        {section === 'tm' &&
          tmGroups.map((g) => (
            <GroupView key={g.title} title={g.title} hint={g.hint}>
              {g.items.map((e) => (
                <Card
                  key={e.id}
                  id={e.id}
                  graph={e.tm}
                  layout={e.layout}
                  title={machineCardTitle(e.name)}
                  badge={<MachineTypeBadge type={classifyTM(e.tm)} small />}
                  description={e.description}
                  meta={`${states(e.tm.states.length)} · ${e.tm.acceptance === 'HALT' ? 'por parada' : 'por estado final'}`}
                  onOpen={open}
                />
              ))}
            </GroupView>
          ))}
      </div>
    </Modal>
  );
}
