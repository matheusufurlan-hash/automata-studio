/**
 * Moldura da janela:
 *  - <TopBar>          menu e abas
 *  - <Editor>          canvas
 *  - <SidePanel>       propriedades/definição
 *  - <SimulationPanel> simulação
 */
import { Editor } from '../editor/Editor';
import { SimulationPanel } from '../simulacao/SimulationPanel';
import { SidePanel } from '../ferramentas/SidePanel';
import { TopBar } from './TopBar';
import { useDesktopClose } from './useDesktopClose';

export function AppShell() {
  useDesktopClose();
  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] grid-cols-[1fr_auto]">
      <div className="col-span-2">
        <TopBar />
      </div>
      <main className="relative min-h-0 min-w-0">
        <Editor />
      </main>
      <aside className="row-span-2 min-h-0 border-l border-[var(--border)] bg-[var(--panel)]">
        <SidePanel />
      </aside>
      <footer className="border-t border-[var(--border)] bg-[var(--panel)]">
        <SimulationPanel />
      </footer>
    </div>
  );
}
