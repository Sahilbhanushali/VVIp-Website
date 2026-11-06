/** Page editor: page fields, publish actions and the structured section editor. */
import { api, toast, confirmAction } from './shell';
import { SECTION_FIELDS } from './section-fields';
import { build, counter, markdownPreview, mediaControl, showErrors, setBuilderContext } from './form-builder';

type Ctx = {
  pageId: number;
  path: string;
  media: Record<string, { thumb: string | null; name: string }>;
  properties: { id: number; title: string }[];
  sectionLabels: Record<string, { name: string; hint: string }>;
};
const root = document.querySelector<HTMLElement>('[data-page-editor]');
const ctx: Ctx = JSON.parse(document.getElementById('editor-ctx')?.textContent ?? '{}');
setBuilderContext({ media: ctx.media ?? {}, properties: ctx.properties ?? [] });

/* ───────────────────────── sections ───────────────────────── */
const dirty = new Set<number>();
window.addEventListener('beforeunload', (e) => { if (dirty.size || pageDirty) { e.preventDefault(); } });

function initSection(el: HTMLElement) {
  const id = Number(el.dataset.sectionId);
  const type = el.dataset.type!;
  const data = JSON.parse(el.querySelector<HTMLScriptElement>('script[type="application/json"]')!.textContent!);
  const body = el.querySelector<HTMLElement>('.sec__body')!;
  const formHost = body.querySelector<HTMLElement>('[data-form]')!;
  const saveBtn = body.querySelector<HTMLButtonElement>('[data-save]')!;
  const state = el.querySelector<HTMLElement>('[data-state]')!;
  let built = false;
  const markDirty = () => { dirty.add(id); state.hidden = false; state.textContent = 'Unsaved changes'; state.className = 'badge badge--warn'; };

  el.querySelector('[data-toggle]')!.addEventListener('click', () => {
    if (!built) { formHost.append(build(SECTION_FIELDS[type] ?? [], data, '', markDirty)); built = true; }
    body.hidden = !body.hidden;
    el.querySelector('[data-toggle]')!.setAttribute('aria-expanded', String(!body.hidden));
  });
  saveBtn.addEventListener('click', async () => {
    saveBtn.classList.add('is-busy');
    const label = body.querySelector<HTMLInputElement>('[data-label]')!.value;
    try {
      await api(`/api/admin/sections/${id}`, { method: 'PUT', json: { data, label } });
      dirty.delete(id);
      state.textContent = 'Saved'; state.className = 'badge badge--ok';
      el.querySelector('.sec__title strong')!.textContent = label || ctx.sectionLabels[type]?.name || type;
      showErrors(formHost, undefined);
      markPageChanged();
      toast('Section saved as draft');
    } catch (e) {
      showErrors(formHost, (e as { fields?: Record<string, string> }).fields, 'data');
      toast((e as Error).message, 'err');
    } finally { saveBtn.classList.remove('is-busy'); }
  });
  el.querySelector<HTMLInputElement>('[data-enabled]')!.addEventListener('change', async (e) => {
    const on = (e.target as HTMLInputElement).checked;
    try {
      await api(`/api/admin/sections/${id}`, { method: 'PUT', json: { enabled: on } });
      el.classList.toggle('is-disabled', !on);
      markPageChanged();
      toast(on ? 'Section enabled (publish to make it live)' : 'Section hidden (publish to apply)');
    } catch (er) { (e.target as HTMLInputElement).checked = !on; toast((er as Error).message, 'err'); }
  });
  el.querySelector('[data-dup]')!.addEventListener('click', async () => {
    try { await api(`/api/admin/sections/${id}`, { method: 'POST' }); location.reload(); } catch (e) { toast((e as Error).message, 'err'); }
  });
  el.querySelector('[data-del]')!.addEventListener('click', async () => {
    if (!(await confirmAction('The section will be removed from the draft. The live page changes when you publish.', 'Delete this section?', 'Delete'))) return;
    try { await api(`/api/admin/sections/${id}`, { method: 'DELETE' }); el.remove(); markPageChanged(); toast('Section deleted'); } catch (e) { toast((e as Error).message, 'err'); }
  });
  el.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((b) => b.addEventListener('click', () => {
    const dir = Number(b.dataset.move);
    const sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    if (!sib) return;
    dir < 0 ? sib.before(el) : sib.after(el);
    saveOrder();
    b.focus();
  }));
  // Drag & drop (grip only, so text selection inside forms keeps working)
  const grip = el.querySelector<HTMLElement>('.sec__grip')!;
  grip.addEventListener('pointerdown', () => (el.draggable = true));
  el.addEventListener('dragstart', (e) => { el.classList.add('is-dragging'); e.dataTransfer!.effectAllowed = 'move'; e.dataTransfer!.setData('text/plain', String(id)); });
  el.addEventListener('dragend', () => { el.classList.remove('is-dragging'); el.draggable = false; document.querySelectorAll('.is-drop-before,.is-drop-after').forEach((x) => x.classList.remove('is-drop-before', 'is-drop-after')); });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const before = e.clientY < r.top + r.height / 2;
    el.classList.toggle('is-drop-before', before);
    el.classList.toggle('is-drop-after', !before);
  });
  el.addEventListener('dragleave', () => el.classList.remove('is-drop-before', 'is-drop-after'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    const dragged = document.querySelector<HTMLElement>(`[data-section-id="${e.dataTransfer!.getData('text/plain')}"]`);
    if (!dragged || dragged === el) return;
    el.classList.contains('is-drop-before') ? el.before(dragged) : el.after(dragged);
    el.classList.remove('is-drop-before', 'is-drop-after');
    saveOrder();
  });
}

async function saveOrder() {
  const ids = [...document.querySelectorAll<HTMLElement>('[data-section-id]')].map((s) => Number(s.dataset.sectionId));
  try { await api(`/api/admin/pages/${ctx.pageId}/reorder`, { method: 'POST', json: { ids } }); markPageChanged(); toast('Order saved (publish to apply)'); }
  catch (e) { toast((e as Error).message, 'err'); }
}
function markPageChanged() {
  const b = document.querySelector<HTMLElement>('[data-live-state]');
  if (b && b.dataset.status === 'published') { b.textContent = 'Unpublished changes'; b.className = 'badge badge--warn'; }
}

/* ───────────────────────── page fields + actions ───────────────────────── */
let pageDirty = false;
function initPageForm() {
  const form = document.querySelector<HTMLFormElement>('[data-page-form]');
  if (!form) return;
  form.addEventListener('input', () => (pageDirty = true));
  form.querySelectorAll<HTMLTextAreaElement>('textarea[data-markdown]').forEach((t) => t.after(markdownPreview(t)));
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-max]').forEach((i) => { const c = counter(i, Number(i.dataset.max)); if (c) i.after(c); });
  form.querySelectorAll<HTMLElement>('[data-media-field]').forEach((wrap) => {
    const hidden = wrap.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    wrap.append(mediaControl(() => (hidden.value ? Number(hidden.value) : null), (v) => { hidden.value = v ? String(v) : ''; pageDirty = true; }, wrap.dataset.mediaField!));
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = (e.submitter as HTMLButtonElement) ?? form.querySelector('[type=submit]');
    btn?.classList.add('is-busy');
    const fd = new FormData(form);
    const body: Record<string, unknown> = Object.fromEntries(fd.entries());
    body.robots_index = fd.get('robots_index') === 'on';
    body.robots_follow = fd.get('robots_follow') === 'on';
    try {
      await api(`/api/admin/pages/${ctx.pageId}`, { method: 'PUT', json: body });
      pageDirty = false;
      showErrors(form, undefined);
      markPageChanged();
      toast('Draft saved');
      if (body.path !== ctx.path) setTimeout(() => location.reload(), 500);
    } catch (er) {
      showErrors(form, (er as { fields?: Record<string, string> }).fields);
      toast((er as Error).message, 'err');
    } finally { btn?.classList.remove('is-busy'); }
  });
}

function initActions() {
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((b) =>
    b.addEventListener('click', async () => {
      const action = b.dataset.action!;
      if (dirty.size || pageDirty) {
        if (!(await confirmAction('Some changes are not saved yet. Continue without them?', 'Unsaved changes', 'Continue'))) return;
      }
      if (action === 'delete') {
        if (!(await confirmAction('This permanently deletes the page and its sections.', 'Delete this page?', 'Delete'))) return;
        try { await api(`/api/admin/pages/${ctx.pageId}`, { method: 'DELETE' }); location.href = '/admin/pages'; } catch (e) { toast((e as Error).message, 'err'); }
        return;
      }
      if (action === 'unpublish' && !(await confirmAction('Visitors will get “page not found” until you publish again.', 'Unpublish this page?', 'Unpublish'))) return;
      const revision = b.dataset.revision;
      if (action === 'restore' && !(await confirmAction('The draft will be replaced with this published version. Publish afterwards to make it live.', 'Restore this version?', 'Restore'))) return;
      b.classList.add('is-busy');
      try {
        const r = await api<{ id?: number }>(`/api/admin/pages/${ctx.pageId}/${action}`, { method: 'POST', json: revision ? { revision_id: Number(revision) } : {} });
        dirty.clear(); pageDirty = false;
        if (action === 'duplicate' && r.id) { location.href = `/admin/pages/${r.id}`; return; }
        toast(action === 'publish' ? 'Published — the live site is updated' : action === 'unpublish' ? 'Unpublished' : 'Done');
        setTimeout(() => location.reload(), 600);
      } catch (e) { toast((e as Error).message, 'err'); b.classList.remove('is-busy'); }
    }),
  );
  const add = document.querySelector<HTMLDialogElement>('[data-add-dialog]');
  document.querySelector('[data-add-open]')?.addEventListener('click', () => add?.showModal());
  add?.querySelectorAll<HTMLButtonElement>('[data-add-type]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        const r = await api<{ id: number }>(`/api/admin/pages/${ctx.pageId}/add-section`, { method: 'POST', json: { type: b.dataset.addType } });
        location.href = `${location.pathname}?tab=sections&open=${r.id}#section-${r.id}`;
      } catch (e) { toast((e as Error).message, 'err'); }
    }),
  );
}

if (root) {
  document.querySelectorAll<HTMLElement>('[data-section-id]').forEach(initSection);
  initPageForm();
  initActions();
  const open = new URLSearchParams(location.search).get('open');
  if (open) document.querySelector<HTMLButtonElement>(`[data-section-id="${open}"] [data-toggle]`)?.click();
}
