/** Barra de cima: menu e abas. */
import { FileMenu } from '../editor/FileMenu';
import { AlgorithmsMenu } from '../ferramentas/AlgorithmsMenu';

export function TopBar() {
  return (
    <header className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel)] px-3 py-1.5">
      <span className="font-semibold tracking-tight">Automata Studio</span>
      <FileMenu />
      <AlgorithmsMenu />
    </header>
  );
}
