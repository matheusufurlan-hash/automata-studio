/** Escolhe a plataforma de arquivos: desktop (Tauri) ou navegador. */
import { isTauri } from '@tauri-apps/api/core';
import { browserFiles, type FilePlatform } from './files';
import { tauriFiles } from './tauriFiles';

export { FileFormatError } from './fileFormat';
export type { FilePlatform, OpenedFile, SaveTarget } from './files';

export const files: FilePlatform = isTauri() ? tauriFiles : browserFiles;
