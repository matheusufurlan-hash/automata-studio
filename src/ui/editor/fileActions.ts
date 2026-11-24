/** Comandos do menu Arquivo (e das abas). */
import type { AutomatonKind } from '../../core/automaton';
import { baseName, fileNameFor } from '../../platform/fileFormat';
import { FileFormatError, files } from '../../platform';
import { getActiveDoc, isEmptyDoc, useDocuments } from '../../store/documents';
import { useEditorUi } from '../../store/editorUi';
import { exportPngBlob, exportSvgBlob } from './exportImage';

const docs = () => useDocuments.getState();
const ui = () => useEditorUi.getState();

/** Aba nova e vazia: AF (padrão), AP ou MT. */
export function newDocument(kind: AutomatonKind = 'fa') {
  docs().newDoc(undefined, kind);
}

export async function openDocument() {
  try {
    const opened = await files.open();
    if (!opened) return;
    docs().loadFile(opened.file, { path: opened.path });
    ui().toast(`“${opened.file.name}” aberto.`, 'success');
  } catch (e) {
    const msg = e instanceof FileFormatError ? e.message : 'Não foi possível abrir o arquivo.';
    ui().toast(msg, 'error');
  }
}

/**
 * Salva com o nome do documento.
 *  - desktop: com caminho conhecido grava direto; sem caminho abre o diálogo nativo;
 *  - navegador: sem arquivo ainda, pergunta o nome antes (janela "Salvar como").
 */
export async function saveDocument(docId?: string, closeAfter = false) {
  const st = docs();
  const doc = st.docs.find((d) => d.id === docId) ?? getActiveDoc();
  const meta = st.meta[doc.id];
  if (files.kind === 'desktop') {
    await writeDocument(doc.id, doc.name, closeAfter, meta?.path);
    return;
  }
  if (!meta?.hasFile) {
    ui().openDialog({ kind: 'save-as', docId: doc.id, closeAfter });
    return;
  }
  await writeDocument(doc.id, doc.name, closeAfter);
}

export function saveDocumentAs(docId?: string) {
  const doc = docs().docs.find((d) => d.id === docId) ?? getActiveDoc();
  // no desktop o próprio diálogo nativo pergunta nome e pasta
  if (files.kind === 'desktop') void writeDocument(doc.id, doc.name);
  else ui().openDialog({ kind: 'save-as', docId: doc.id });
}

/**
 * Grava de fato (chamado também pela janela "Salvar como" do navegador).
 * Só marca como salvo — e só fecha a aba — se o arquivo foi gravado mesmo.
 */
export async function writeDocument(docId: string, name: string, closeAfter = false, path?: string) {
  const clean = name.trim() || 'automato';
  try {
    const file = { ...docs().toFile(docId), name: clean };
    const target = await files.save(file, fileNameFor(clean), path);
    if (!target) {
      ui().toast('Salvamento cancelado: nada foi gravado.', 'info');
      return;
    }
    // no desktop o nome do documento acompanha o arquivo escolhido
    const savedName = target.path ? baseName(target.fileName) : clean;
    docs().markSaved(docId, savedName, target.path);
    ui().toast(`Salvo como “${target.fileName}”.`, 'success');
    if (closeAfter) docs().closeDoc(docId);
  } catch {
    ui().toast('Não foi possível salvar o arquivo.', 'error');
  }
}

export async function exportImage(kind: 'png' | 'svg') {
  const doc = getActiveDoc();
  if (isEmptyDoc(doc)) {
    ui().toast('Nada para exportar: o autômato está vazio.', 'info');
    return;
  }
  try {
    const blob = kind === 'png' ? await exportPngBlob(doc.automaton, doc.layout) : exportSvgBlob(doc.automaton, doc.layout);
    const name = fileNameFor(doc.name, `.${kind}`);
    if (!(await files.saveBlob(blob, name))) return;
    ui().toast(`Imagem exportada: “${name}”.`, 'success');
  } catch {
    ui().toast('Não foi possível exportar a imagem.', 'error');
  }
}

/** Fecha a aba; se houver alterações não salvas, pergunta antes. */
export function requestClose(docId: string) {
  const doc = docs().docs.find((d) => d.id === docId);
  if (!doc) return;
  if (doc.dirty && !isEmptyDoc(doc)) ui().openDialog({ kind: 'confirm-close', docId });
  else docs().closeDoc(docId);
}
