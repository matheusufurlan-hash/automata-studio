/** Menu "Arquivo" da barra de cima: Novo (AF, AP, MT), Abrir, Salvar, Salvar como, Exportar PNG/SVG. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, FileCode, FileImage, FolderOpen, Save, SaveAll, X } from 'lucide-react';
import { useDocuments } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { exportImage, newDocument, openDocument, requestClose, saveDocument, saveDocumentAs } from './fileActions';
import { KindBadge } from './KindBadge';
import { MenuItem, MenuSeparator, MenuSurface } from './Menu';

export function FileMenu() {
  const [open, setOpen] = useState<{ x: number; y: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(null), []);
  const run = (fn: () => unknown) => () => {
    setOpen(null);
    void fn();
  };

  // atalhos de arquivo (o navegador não deixa usar Ctrl+N / Ctrl+W)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (useEditorUi.getState().dialog) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        if (e.shiftKey) saveDocumentAs();
        else void saveDocument();
      } else if (k === 'o') {
        e.preventDefault();
        void openDocument();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={open ? 'ed-menubtn is-open' : 'ed-menubtn'}
        aria-haspopup="menu"
        aria-expanded={!!open}
        onClick={() => {
          if (open) return setOpen(null);
          const r = button.current!.getBoundingClientRect();
          setOpen({ x: r.left, y: r.bottom + 6 });
        }}
      >
        Arquivo <ChevronDown size={14} />
      </button>
      {open && (
        <MenuSurface x={open.x} y={open.y} onClose={close} ignore={button}>
          <MenuItem icon={<KindBadge kind="fa" />} label="Novo autômato finito" onSelect={run(() => newDocument('fa'))} />
          <MenuItem icon={<KindBadge kind="pda" />} label="Novo autômato com pilha" onSelect={run(() => newDocument('pda'))} />
          <MenuItem icon={<KindBadge kind="tm" />} label="Nova máquina de Turing" onSelect={run(() => newDocument('tm'))} />
          <MenuSeparator />
          <MenuItem icon={<FolderOpen size={16} />} label="Abrir…" keys={['Ctrl', 'O']} onSelect={run(openDocument)} />
          <MenuSeparator />
          <MenuItem icon={<Save size={16} />} label="Salvar" keys={['Ctrl', 'S']} onSelect={run(() => saveDocument())} />
          <MenuItem
            icon={<SaveAll size={16} />}
            label="Salvar como…"
            keys={['Ctrl', 'Shift', 'S']}
            onSelect={run(() => saveDocumentAs())}
          />
          <MenuSeparator />
          <MenuItem icon={<FileImage size={16} />} label="Exportar PNG" onSelect={run(() => exportImage('png'))} />
          <MenuItem icon={<FileCode size={16} />} label="Exportar SVG" onSelect={run(() => exportImage('svg'))} />
          <MenuSeparator />
          <MenuItem
            icon={<X size={16} />}
            label="Fechar aba"
            onSelect={run(() => requestClose(useDocuments.getState().activeId))}
          />
        </MenuSurface>
      )}
    </>
  );
}
