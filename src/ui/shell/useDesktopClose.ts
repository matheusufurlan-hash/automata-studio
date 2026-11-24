/**
 * No app de desktop (Tauri) o `beforeunload` do navegador não funciona.
 * Este gancho intercepta o fechamento da janela e pergunta antes de perder
 * alterações não salvas.
 */
import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/plugin-dialog';
import { isEmptyDoc, useDocuments } from '../../store/documents';

export function useDesktopClose() {
  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void win
      .onCloseRequested(async (event) => {
        const unsaved = useDocuments.getState().docs.filter((d) => d.dirty && !isEmptyDoc(d));
        if (unsaved.length === 0) return;
        event.preventDefault();
        const names = unsaved.map((d) => `“${d.name}”`).join(', ');
        const ok = await ask(`Há alterações não salvas em ${names}.\nFechar mesmo assim?`, {
          title: 'Alterações não salvas',
          kind: 'warning',
          okLabel: 'Fechar sem salvar',
          cancelLabel: 'Voltar',
        });
        if (ok) await win.destroy();
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
