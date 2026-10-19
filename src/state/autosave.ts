/** Autosave: every change is written to IndexedDB shortly after it happens. */
import { saveProject } from './db';
import { lastProjectId } from './prefs';
import { useStore } from './store';

let timer: ReturnType<typeof setTimeout> | undefined;
let pending = false;

async function flush() {
  const { project, identities, setSaveStatus } = useStore.getState();
  if (!project) return;
  pending = false;
  try {
    await saveProject(project, identities);
    lastProjectId.set(project.id);
    setSaveStatus('saved');
  } catch {
    setSaveStatus('error');
  }
}

export function startAutosave(): void {
  let lastRevision = useStore.getState().revision;
  useStore.subscribe((s) => {
    if (!s.project || s.revision === lastRevision) return;
    lastRevision = s.revision;
    pending = true;
    if (s.saveStatus !== 'saving') s.setSaveStatus('saving');
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
  });
  window.addEventListener('beforeunload', () => {
    if (pending) void flush();
  });
}
