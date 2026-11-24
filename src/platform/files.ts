/**
 * Acesso a arquivos, separado por plataforma.
 *
 * Duas versões:
 *  - navegador (este arquivo): `<input type=file>` para abrir e download para salvar;
 *  - desktop (./tauriFiles): diálogos nativos do sistema e gravação no caminho escolhido.
 * Quem usa deve importar `files` de ./index, que escolhe a certa.
 */
import type { AnyAutomatonFile } from '../core/automaton';
import { baseName, FileFormatError, parseAutomatonFile, serializeAutomatonFile } from './fileFormat';

export { FileFormatError } from './fileFormat';

/** Onde o arquivo foi gravado. `path` só existe no app de desktop. */
export interface SaveTarget {
  fileName: string;
  path?: string;
}

/** Arquivo aberto. `path` só existe no app de desktop (serve para o próximo "Salvar"). */
export interface OpenedFile {
  file: AnyAutomatonFile;
  path?: string;
}

export interface FilePlatform {
  /** 'browser': salvar = baixar; 'desktop': diálogos nativos e caminho de verdade. */
  kind: 'browser' | 'desktop';
  /** Abre um `.automato.json`. `null` = o usuário cancelou. Lança FileFormatError se o arquivo for inválido. */
  open(): Promise<OpenedFile | null>;
  /**
   * Grava o autômato. Com `path` (desktop), grava direto nele, sem perguntar.
   * Sem `path`, pergunta onde salvar (desktop) ou baixa com `suggestedName` (navegador).
   * `null` = o usuário cancelou: NADA foi gravado.
   */
  save(file: AnyAutomatonFile, suggestedName: string, path?: string): Promise<SaveTarget | null>;
  /** Salva qualquer conteúdo binário (PNG, SVG...). `false` = o usuário cancelou. */
  saveBlob(blob: Blob, name: string): Promise<boolean>;
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let done = false;
    const finish = (f: File | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(f);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const browserFiles: FilePlatform = {
  kind: 'browser',
  async open() {
    const file = await pickFile('.json,.automato.json,application/json');
    if (!file) return null;
    let text: string;
    try {
      text = await file.text();
    } catch {
      throw new FileFormatError('Não foi possível ler o arquivo.');
    }
    return { file: parseAutomatonFile(text, baseName(file.name)) };
  },
  async save(file, suggestedName) {
    // no navegador não dá para saber se o download foi cancelado: conta como salvo
    download(new Blob([serializeAutomatonFile(file)], { type: 'application/json' }), suggestedName);
    return { fileName: suggestedName };
  },
  async saveBlob(blob, name) {
    download(blob, name);
    return true;
  },
};

// A versão de desktop (Tauri) fica em ./tauriFiles e é escolhida em ./index.
