/** Modal media picker used by every editor. Resolves with the chosen media DTO (or null). */
import { api, toast } from './shell';

export type MediaDto = {
  id: number; kind: string; original_name: string; alt: string; folder: string; width: number | null; height: number | null;
  size_bytes: number; thumb: string | null; url: string | null;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function openMediaPicker(opts: { kind?: 'image' | 'video' | '' } = {}): Promise<MediaDto | null> {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'a-dialog a-dialog--wide';
    d.innerHTML = `
      <div class="a-dialog__head"><h2>Choose media</h2><button type="button" class="btn btn--ghost btn--icon" data-x aria-label="Close">✕</button></div>
      <div class="toolbar">
        <input class="input grow" type="search" placeholder="Search by name or alt text" data-q />
        <label class="btn btn--accent" style="position:relative;overflow:hidden">Upload<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm" style="position:absolute;inset:0;opacity:0;cursor:pointer" data-up /></label>
      </div>
      <div class="media-grid" data-grid style="max-height:60vh;overflow:auto"></div>
      <div class="a-dialog__foot"><span class="muted" data-count style="margin-right:auto"></span><button type="button" class="btn" data-more hidden>Load more</button><button type="button" class="btn" data-x>Cancel</button></div>`;
    document.body.appendChild(d);
    const grid = d.querySelector<HTMLElement>('[data-grid]')!;
    const q = d.querySelector<HTMLInputElement>('[data-q]')!;
    const more = d.querySelector<HTMLButtonElement>('[data-more]')!;
    let page = 1;
    let done = false;
    const close = (v: MediaDto | null) => { done = true; d.close(); d.remove(); resolve(v); };

    const load = async (reset = false) => {
      if (reset) { page = 1; grid.innerHTML = ''; }
      const r = await api<{ items: MediaDto[]; total: number; pages: number }>(`/api/admin/media?kind=${opts.kind ?? ''}&q=${encodeURIComponent(q.value)}&page=${page}&perPage=48`);
      if (!r.items.length && page === 1) grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><strong>No media found</strong><span>Upload a file to get started.</span></div>';
      for (const m of r.items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'media-tile';
        b.innerHTML = `<span class="media-tile__img">${m.kind === 'video' ? `<video src="${esc(m.thumb ?? '')}" muted></video>` : `<img src="${esc(m.thumb ?? '')}" alt="" loading="lazy">`}</span>
          <span class="media-tile__name">${esc(m.original_name)}</span><span class="media-tile__meta">${m.width ? `${m.width}×${m.height}` : m.kind}${m.alt ? '' : ' · <b style="color:#a36207">no alt</b>'}</span>`;
        b.addEventListener('click', () => close(m));
        grid.appendChild(b);
      }
      d.querySelector('[data-count]')!.textContent = `${r.total} item${r.total === 1 ? '' : 's'}`;
      more.hidden = page >= r.pages;
    };
    let t = 0;
    q.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(() => load(true), 250); });
    more.addEventListener('click', () => { page++; load(); });
    d.querySelectorAll('[data-x]').forEach((x) => x.addEventListener('click', () => close(null)));
    d.addEventListener('close', () => { if (!done) close(null); });
    d.querySelector<HTMLInputElement>('[data-up]')!.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.files?.length) return;
      const fd = new FormData();
      [...input.files].forEach((f) => fd.append('files', f));
      fd.append('folder', 'uploads');
      try {
        const r = await api<{ created: MediaDto[]; errors: { name: string; error: string }[] }>('/api/admin/media', { method: 'POST', body: fd });
        r.errors.forEach((er) => toast(`${er.name}: ${er.error}`, 'err'));
        if (r.created.length) { toast(`Uploaded ${r.created.length} file(s)`); if (r.created.length === 1) return close(r.created[0]); load(true); }
      } catch (er) { toast((er as Error).message, 'err'); }
      input.value = '';
    });
    d.showModal();
    load(true).catch((er) => toast(er.message, 'err'));
  });
}
