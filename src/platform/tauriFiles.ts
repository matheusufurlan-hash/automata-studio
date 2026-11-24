/**
 * Arquivos no app de DESKTOP (Tauri): diálogos nativos do sistema e gravação
 * no caminho que o usuário escolheu. Precisa dos plugins `dialog` e `fs`
 * registrados em src-tauri/src/lib.rs e liberados em src-tauri/capabilities/.
 */
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { baseName, FILE_EXTENSION, FileFormatError, parseAutomatonFile, serializeAutomatonFile } from './fileFormat';
import type { FilePlatform } from './files';

const AUTOMATON_FILTER = [{ name: 'Autômato (.automato.json)', extensions: ['json'] }];

/** "/home/x/termina em 01.automato.json" → "termina em 01.automato.json" */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Garante a extensão .automato.json (o diálogo do Linux nem sempre acrescenta). */
export function withAutomatonExtension(path: string): string {
  return path.toLowerCase().endsWith('.json') ? path : path + FILE_EXTENSION;
}

export const tauriFiles: FilePlatform = {
  kind: 'desktop',

  async open() {
    const path = await openDialog({ title: 'Abrir autômato', multiple: false, directory: false, filters: AUTOMATON_FILTER });
    if (typeof path !== 'string') return null;
    let text: string;
    try {
      text = await readTextFile(path);
    } catch {
      throw new FileFormatError('Não foi possível ler o arquivo.');
    }
    return { file: parseAutomatonFile(text, baseName(fileNameOf(path))), path };
  },

  async save(file, suggestedName, path) {
    let target = path;
    if (!target) {
      const chosen = await saveDialog({ title: 'Salvar autômato', defaultPath: suggestedName, filters: AUTOMATON_FILTER });
      if (!chosen) return null;
      target = withAutomatonExtension(chosen);
    }
    await writeTextFile(target, serializeAutomatonFile(file));
    return { fileName: fileNameOf(target), path: target };
  },

  async saveBlob(blob, name) {
    const ext = (name.split('.').pop() ?? '').toLowerCase();
    const chosen = await saveDialog({
      title: 'Exportar imagem',
      defaultPath: name,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (!chosen) return false;
    const target = chosen.toLowerCase().endsWith(`.${ext}`) ? chosen : `${chosen}.${ext}`;
    await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
    return true;
  },
};
