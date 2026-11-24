/** Abas dos documentos (acima do canvas, com o selo AF/AP/MT) + botão Novo + botão de tema. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Moon, Plus, Sun, X } from 'lucide-react';
import { useDocuments } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { useTheme } from '../../store/theme';
import { requestClose } from './fileActions';
import { KIND_NAME, KindBadge } from './KindBadge';
import { NewMenu } from './NewMenu';

export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="ed-icon-btn"
      onClick={toggle}
      data-tip={dark ? 'Tema claro' : 'Tema escuro'}
      data-tip-align="end"
      aria-label={dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

function Tab({ id }: { id: string }) {
  const doc = useDocuments((s) => s.docs.find((d) => d.id === id));
  const active = useDocuments((s) => s.activeId === id);
  const [editing, setEditing] = useState(false);
  if (!doc) return null;
  const cls = ['ed-tab'];
  if (active) cls.push('is-active');
  if (doc.dirty) cls.push('is-dirty');
  return (
    <div
      role="tab"
      aria-selected={active}
      className={cls.join(' ')}
      onPointerDown={(e) => {
        if (e.button === 0) useDocuments.getState().setActive(id);
      }}
      onAuxClick={(e) => {
        if (e.button === 1) requestClose(id);
      }}
      onDoubleClick={() => setEditing(true)}
      title={`${doc.name} · ${KIND_NAME[doc.automaton.kind]}${doc.dirty ? ' (não salvo)' : ''}`}
    >
      <KindBadge kind={doc.automaton.kind} />
      {editing ? (
        <input
          className="ed-tab-input"
          defaultValue={doc.name}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            useDocuments.getState().renameDoc(id, e.currentTarget.value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="Nome do documento"
        />
      ) : (
        <span className="ed-tab-name">{doc.name}</span>
      )}
      <button
        type="button"
        className="ed-tab-close"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => requestClose(id)}
        aria-label={`Fechar ${doc.name}`}
      >
        <span className="ed-tab-dot" />
        <X className="ed-tab-x" size={14} />
      </button>
    </div>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

export function TabBar() {
  const ids = useDocuments((s) => s.docs.map((d) => d.id).join('\u0000'));
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const plus = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const openMenu = useCallback(() => {
    const r = plus.current?.getBoundingClientRect();
    if (r) setMenu({ x: r.left, y: r.bottom + 6 });
  }, []);

  // `?menu=novo` (só para print): abre o menu depois que a janela assenta
  useEffect(() => {
    let wanted = false;
    try {
      wanted = new URLSearchParams(window.location.search).get('menu') === 'novo';
    } catch {
      /* URL inválida: ignora */
    }
    if (!wanted) return;
    const t = setTimeout(openMenu, 400);
    return () => clearTimeout(t);
  }, [openMenu]);

  // Alt+N abre o menu Novo (Ctrl+N o navegador não deixa usar)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.code !== 'KeyN') return;
      if (isTyping(e.target) || useEditorUi.getState().dialog) return;
      e.preventDefault();
      openMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMenu]);

  return (
    <div className="ed-tabs">
      <div className="ed-tabs-list" role="tablist" aria-label="Documentos abertos">
        {ids.split('\u0000').map((id) => (
          <Tab key={id} id={id} />
        ))}
      </div>
      <button
        ref={plus}
        type="button"
        className={menu ? 'ed-icon-btn sm is-on' : 'ed-icon-btn sm'}
        style={{ alignSelf: 'center' }}
        onClick={() => (menu ? setMenu(null) : openMenu())}
        data-tip="Novo: AF, AP ou MT (Alt+N)"
        aria-label="Novo autômato"
        aria-haspopup="menu"
        aria-expanded={!!menu}
      >
        <Plus size={16} />
      </button>
      {menu && <NewMenu x={menu.x} y={menu.y} onClose={closeMenu} ignore={plus} />}
      <div className="ed-tabs-end">
        <ThemeToggle />
      </div>
    </div>
  );
}
