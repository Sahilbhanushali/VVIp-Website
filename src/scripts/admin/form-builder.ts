/** Schema-driven form builder shared by the page, section and property editors. */
import { api, toast, confirmAction } from './shell';
import { openMediaPicker } from './media-picker';
import type { Field } from './section-fields';

export type BuilderCtx = { media: Record<string, { thumb: string | null; name: string }>; properties: { id: number; title: string }[] };
const ctx: BuilderCtx = { media: {}, properties: [] };
export function setBuilderContext(c: Partial<BuilderCtx>) { Object.assign(ctx, c); }

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = '') => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (html) el.innerHTML = html;
  return el;
};
let uid = 0;

function fieldWrap(f: Field, path: string, control: HTMLElement) {
  const w = h('div', { class: 'field', 'data-path': path });
  const id = control.id || `f${++uid}`;
  control.id = id;
  w.append(h('label', { for: id }, esc(f.label)), control);
  if ('hint' in f && f.hint) w.append(h('small', {}, esc(f.hint)));
  w.append(h('p', { class: 'field__error', 'data-error': '' }));
  return w;
}
export function counter(input: HTMLInputElement | HTMLTextAreaElement, max?: number) {
  if (!max) return null;
  const c = h('span', { class: 'counter' });
  const upd = () => { c.textContent = `${input.value.length} / ${max}`; c.classList.toggle('is-over', input.value.length > max); };
  input.addEventListener('input', upd);
  upd();
  return c;
}
export function mediaControl(get: () => number | null, set: (v: number | null) => void, label: string) {
  const box = h('div', { class: 'img-field' });
  const render = () => {
    const id = get();
    const m = id ? ctx.media[id] : null;
    box.innerHTML = '';
    box.append(m?.thumb ? h('img', { class: 'img-field__preview', src: m.thumb, alt: '' }) : h('span', { class: 'img-field__empty' }, id ? `#${id}` : 'No image'));
    const actions = h('div', { style: 'display:flex;gap:.4rem;flex-wrap:wrap' });
    const pick = h('button', { type: 'button', class: 'btn btn--sm' }, id ? 'Replace' : `Choose ${label.toLowerCase()}`);
    pick.addEventListener('click', async () => {
      const chosen = await openMediaPicker({ kind: 'image' });
      if (chosen) { ctx.media[chosen.id] = { thumb: chosen.thumb, name: chosen.original_name }; set(chosen.id); render(); }
    });
    actions.append(pick);
    if (id) {
      const rm = h('button', { type: 'button', class: 'btn btn--sm btn--ghost' }, 'Remove');
      rm.addEventListener('click', () => { set(null); render(); });
      actions.append(rm);
    }
    box.append(actions);
  };
  render();
  return box;
}

export function build(fields: Field[], obj: Record<string, any>, base: string, onChange: () => void): HTMLElement {
  const grid = h('div', { class: 'form-grid' });
  for (const f of fields) {
    const path = base ? `${base}.${f.k}` : f.k;
    const set = (v: unknown) => { obj[f.k] = v; onChange(); };
    let node: HTMLElement;
    switch (f.t) {
      case 'text': case 'heading': case 'url': {
        const i = h('input', { class: 'input', type: 'text' }) as HTMLInputElement;
        i.value = obj[f.k] ?? '';
        if (f.max) i.maxLength = f.max;
        i.addEventListener('input', () => set(i.value));
        node = fieldWrap(f, path, i);
        const c = counter(i, f.max); if (c && f.t === 'heading') node.append(c);
        if (f.t === 'heading') node.classList.add('span-2');
        break;
      }
      case 'textarea': case 'markdown': {
        const t = h('textarea', { class: f.t === 'markdown' ? 'textarea textarea--code' : 'textarea' }) as HTMLTextAreaElement;
        t.value = obj[f.k] ?? '';
        if (f.max) t.maxLength = f.max;
        t.addEventListener('input', () => set(t.value));
        node = fieldWrap(f, path, t);
        node.classList.add('span-2');
        const c = counter(t, f.max); if (c) node.append(c);
        if (f.t === 'markdown') node.append(markdownPreview(t));
        break;
      }
      case 'bool': {
        const lab = h('label', { class: 'switch' });
        const i = h('input', { type: 'checkbox' }) as HTMLInputElement;
        i.checked = !!obj[f.k];
        i.addEventListener('change', () => set(i.checked));
        lab.append(i, document.createTextNode(f.label));
        node = h('div', { class: 'field span-2', 'data-path': path });
        node.append(lab);
        break;
      }
      case 'number': {
        const i = h('input', { class: 'input', type: 'number' }) as HTMLInputElement;
        i.value = String(obj[f.k] ?? '');
        if (f.min !== undefined) i.min = String(f.min);
        if (f.max !== undefined) i.max = String(f.max);
        i.step = String(f.step ?? 1);
        i.addEventListener('input', () => set(i.value === '' ? (f.nullable ? null : 0) : Number(i.value)));
        node = fieldWrap(f, path, i);
        break;
      }
      case 'select': {
        const s = h('select', { class: 'select' }) as HTMLSelectElement;
        s.innerHTML = f.options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
        s.value = obj[f.k] == null ? (f.options[0]?.[0] ?? '') : String(obj[f.k]);
        s.addEventListener('change', () => set(f.numeric ? (s.value ? Number(s.value) : null) : s.value));
        node = fieldWrap(f, path, s);
        break;
      }
      case 'property': {
        const s = h('select', { class: 'select' }) as HTMLSelectElement;
        s.innerHTML = `<option value="">— Automatic —</option>` + ctx.properties.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join('');
        s.value = obj[f.k] ? String(obj[f.k]) : '';
        s.addEventListener('change', () => set(s.value ? Number(s.value) : null));
        node = fieldWrap(f, path, s);
        break;
      }
      case 'media': {
        node = h('div', { class: 'field', 'data-path': path });
        node.append(h('span', { class: 'label' }, esc(f.label)), mediaControl(() => obj[f.k] ?? null, (v) => set(v), f.label), h('p', { class: 'field__error', 'data-error': '' }));
        break;
      }
      case 'image': {
        obj[f.k] ??= { media_id: null, alt: '', position: '' };
        const o = obj[f.k];
        node = h('div', { class: 'field span-2', 'data-path': path });
        node.append(h('span', { class: 'label' }, esc(f.label)), mediaControl(() => o.media_id, (v) => { o.media_id = v; onChange(); }, f.label));
        const sub: Field[] = [{ k: 'alt', t: 'text', label: 'Alt text (leave empty to use the library alt text)', max: 200 }];
        if (f.position) sub.push({ k: 'position', t: 'text', label: 'Focus point (CSS object-position, e.g. 40% 50%)', max: 30 });
        node.append(build(sub, o, path, onChange));
        break;
      }
      case 'cta': {
        obj[f.k] ??= { label: '', href: '', opens_visit: false };
        const o = obj[f.k];
        node = h('fieldset', { class: 'field span-2', 'data-path': path, style: 'border:1px solid var(--a-line);border-radius:8px;padding:.75rem' });
        node.append(h('legend', { class: 'label', style: 'padding:0 .35rem' }, esc(f.label)));
        const sub: Field[] = [
          { k: 'label', t: 'text', label: 'Label (empty hides the button)', max: 40 },
          { k: 'href', t: 'url', label: 'Link (/page.html, #anchor, https://, tel:, mailto:)', max: 255 },
        ];
        if (f.visit) sub.push({ k: 'opens_visit', t: 'bool', label: 'Open the “Schedule a visit” form instead of navigating' });
        node.append(build(sub, o, path, onChange));
        break;
      }
      case 'strings': {
        obj[f.k] ??= [];
        const arr: string[] = obj[f.k];
        node = h('div', { class: 'field span-2', 'data-path': path });
        node.append(h('span', { class: 'label' }, esc(f.label)));
        const list = h('div', { class: 'repeater' });
        const render = () => {
          list.innerHTML = '';
          arr.forEach((v, i) => {
            const row = h('div', { class: 'input-group', 'data-path': `${path}.${i}` });
            const inp = h('textarea', { class: 'textarea', rows: '2', style: 'min-height:42px;border-radius:8px 0 0 8px' }) as HTMLTextAreaElement;
            inp.value = v;
            inp.addEventListener('input', () => { arr[i] = inp.value; onChange(); });
            const rm = h('button', { type: 'button', class: 'btn', title: 'Remove', style: 'height:auto' }, '✕');
            rm.addEventListener('click', () => { arr.splice(i, 1); onChange(); render(); });
            row.append(inp, rm);
            list.append(row);
          });
          if (!f.max || arr.length < f.max) {
            const add = h('button', { type: 'button', class: 'btn btn--sm', style: 'justify-self:start' }, `+ ${esc(f.add)}`);
            add.addEventListener('click', () => { arr.push(''); onChange(); render(); });
            list.append(add);
          }
        };
        render();
        node.append(list);
        break;
      }
      case 'list': {
        obj[f.k] ??= [];
        const arr: Record<string, any>[] = obj[f.k];
        node = h('div', { class: 'field span-2', 'data-path': path });
        node.append(h('span', { class: 'label' }, `${esc(f.label)} <small class="muted">(${arr.length})</small>`));
        if (f.hint) node.append(h('small', {}, esc(f.hint)));
        const list = h('div', { class: 'repeater' });
        const render = () => {
          list.innerHTML = '';
          (node.querySelector('.label small') as HTMLElement).textContent = `(${arr.length})`;
          arr.forEach((item, i) => {
            const card = h('div', { class: 'repeater__item', 'data-path': `${path}.${i}` });
            const headEl = h('div', { class: 'repeater__head' });
            const title = h('span', {}, esc(item[f.item] || `Item ${i + 1}`));
            const toggle = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', 'aria-expanded': 'false' }, 'Edit');
            const up = h('button', { type: 'button', class: 'btn btn--ghost btn--icon', title: 'Move up', 'aria-label': 'Move up' }, '↑');
            const down = h('button', { type: 'button', class: 'btn btn--ghost btn--icon', title: 'Move down', 'aria-label': 'Move down' }, '↓');
            const rm = h('button', { type: 'button', class: 'btn btn--ghost btn--icon', title: 'Remove', 'aria-label': 'Remove' }, '✕');
            headEl.append(h('span', { class: 'muted', style: 'flex:none' }, String(i + 1).padStart(2, '0')), title, up, down, toggle, rm);
            const body = h('div', { class: 'repeater__body', hidden: '' });
            body.append(build(f.of, item, `${path}.${i}`, () => { title.textContent = item[f.item] || `Item ${i + 1}`; onChange(); }));
            toggle.addEventListener('click', () => { body.hidden = !body.hidden; toggle.setAttribute('aria-expanded', String(!body.hidden)); toggle.textContent = body.hidden ? 'Edit' : 'Close'; });
            up.addEventListener('click', () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; onChange(); render(); } });
            down.addEventListener('click', () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; onChange(); render(); } });
            rm.addEventListener('click', async () => { if (await confirmAction(`Remove “${item[f.item] || `item ${i + 1}`}”?`, 'Remove item', 'Remove')) { arr.splice(i, 1); onChange(); render(); } });
            card.append(headEl, body);
            list.append(card);
          });
          if (!f.max || arr.length < f.max) {
            const add = h('button', { type: 'button', class: 'btn btn--sm', style: 'justify-self:start' }, `+ ${esc(f.add)}`);
            add.addEventListener('click', () => {
              const blank: Record<string, any> = {};
              f.of.forEach((x) => (blank[x.k] = x.t === 'bool' ? false : x.t === 'number' ? 0 : x.t === 'media' || x.t === 'property' ? null : x.t === 'strings' ? [] : x.t === 'select' ? x.options[0][0] : ''));
              arr.push(blank);
              onChange();
              render();
              (list.querySelectorAll('.repeater__item')[arr.length - 1]?.querySelector('.repeater__head .btn--sm') as HTMLButtonElement)?.click();
            });
            list.append(add);
          }
        };
        render();
        node.append(list);
        break;
      }
    }
    grid.append(node!);
  }
  return grid;
}

export function markdownPreview(t: HTMLTextAreaElement) {
  const wrap = h('div', { style: 'display:grid;gap:.5rem' });
  const btn = h('button', { type: 'button', class: 'btn btn--sm', style: 'justify-self:start' }, 'Preview formatting');
  const out = h('div', { class: 'card', hidden: '', style: 'padding:1rem 1.25rem;max-height:420px;overflow:auto' });
  btn.addEventListener('click', async () => {
    if (!out.hidden) { out.hidden = true; btn.textContent = 'Preview formatting'; return; }
    try {
      const r = await api<{ html: string }>('/api/admin/markdown', { method: 'POST', json: { markdown: t.value } });
      out.innerHTML = `<div class="md-preview">${r.html}</div>`;
      out.hidden = false;
      btn.textContent = 'Hide preview';
    } catch (e) { toast((e as Error).message, 'err'); }
  });
  wrap.append(btn, out);
  return wrap;
}

export function showErrors(scope: HTMLElement, fields: Record<string, string> | undefined, prefix = '') {
  scope.querySelectorAll('.has-error').forEach((e) => e.classList.remove('has-error'));
  scope.querySelectorAll<HTMLElement>('[data-error]').forEach((e) => (e.textContent = ''));
  if (!fields) return;
  for (const [p, msg] of Object.entries(fields)) {
    const path = prefix ? p.replace(new RegExp(`^${prefix}\\.?`), '') : p;
    const el = scope.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`) ?? scope.querySelector<HTMLElement>(`[data-path="${CSS.escape(path.split('.').slice(0, -1).join('.'))}"]`);
    if (!el) continue;
    el.classList.add('has-error');
    const err = el.querySelector<HTMLElement>(':scope > [data-error]');
    if (err) err.textContent = msg;
    // reveal collapsed repeater items that contain errors
    el.closest<HTMLElement>('.repeater__body')?.removeAttribute('hidden');
  }
  scope.querySelector('.has-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

