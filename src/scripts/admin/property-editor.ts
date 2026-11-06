import { api, toast, confirmAction } from './shell';
import { build, showErrors, setBuilderContext } from './form-builder';
import { propertyGroups } from './property-fields';

const el = document.getElementById('property-ctx');
if (el) {
  const ctx = JSON.parse(el.textContent!);
  setBuilderContext({ media: ctx.media, properties: [] });
  const state = ctx.property;
  let dirty = false;
  const mark = () => { dirty = true; const b = document.querySelector<HTMLElement>('[data-dirty]'); if (b) b.hidden = false; };
  const host = document.querySelector<HTMLElement>('[data-groups]')!;
  for (const g of propertyGroups(ctx.categories)) {
    const card = document.createElement('section');
    card.className = 'card';
    card.innerHTML = `<div class="card__head"><div><h2></h2>${g.hint ? '<p></p>' : ''}</div></div><div class="card__body"></div>`;
    card.querySelector('h2')!.textContent = g.title;
    if (g.hint) card.querySelector('p')!.textContent = g.hint;
    card.querySelector('.card__body')!.append(build(g.fields, state, '', mark));
    host.append(card);
  }
  // Sidebar controls bound to the same state
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-bind]').forEach((c) => {
    const k = c.dataset.bind!;
    if (c instanceof HTMLInputElement && c.type === 'checkbox') c.checked = !!state[k]; else c.value = state[k] ?? '';
    c.addEventListener('change', () => { state[k] = c instanceof HTMLInputElement && c.type === 'checkbox' ? c.checked : c.value; mark(); });
  });
  // Auto-slug while the property is new and the slug was never edited
  const save = async () => {
    const btn = document.querySelector<HTMLButtonElement>('[data-save]')!;
    btn.classList.add('is-busy');
    try {
      await api(`/api/admin/properties/${ctx.property.id}`, { method: 'PUT', json: state });
      dirty = false;
      showErrors(document.body, undefined);
      toast(state.status === 'published' ? 'Saved — the live site is updated' : 'Saved as draft');
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      showErrors(host, (e as { fields?: Record<string, string> }).fields);
      toast((e as Error).message, 'err');
    } finally { btn.classList.remove('is-busy'); }
  };
  document.querySelector('[data-save]')?.addEventListener('click', save);
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } });
  window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
  document.querySelector('[data-duplicate]')?.addEventListener('click', async () => {
    try { const r = await api<{ id: number }>(`/api/admin/properties/${ctx.property.id}`, { method: 'POST' }); location.href = `/admin/properties/${r.id}`; } catch (e) { toast((e as Error).message, 'err'); }
  });
  document.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!(await confirmAction('This permanently deletes the property, its page and its gallery links (media files stay in the library).', `Delete “${state.title}”?`, 'Delete'))) return;
    try { await api(`/api/admin/properties/${ctx.property.id}`, { method: 'DELETE' }); dirty = false; location.href = '/admin/properties'; } catch (e) { toast((e as Error).message, 'err'); }
  });
  document.querySelector('[data-add-category]')?.addEventListener('click', async () => {
    const name = prompt('New category name');
    if (!name) return;
    try { await api('/api/admin/categories', { method: 'POST', json: { name } }); toast('Category added — reloading'); setTimeout(() => location.reload(), 500); } catch (e) { toast((e as Error).message, 'err'); }
  });
}
