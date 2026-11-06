/** Admin shell: sidebar toggle, profile menu, logout, toasts, confirm dialog, CSRF-aware fetch. */
const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

export async function api<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-CSRF-Token', csrf);
  headers.set('Accept', 'application/json');
  let body = init.body;
  if (init.json !== undefined) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(init.json); }
  const res = await fetch(url, { ...init, headers, body, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) location.href = `/admin/login?next=${encodeURIComponent(location.pathname)}`;
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { fields: data.fields, status: res.status });
  return data as T;
}

export function toast(message: string, kind: 'ok' | 'err' = 'ok') {
  const host = document.querySelector<HTMLElement>('[data-toasts]');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 250); }, kind === 'err' ? 6000 : 3500);
}

export function confirmAction(text: string, title = 'Are you sure?', okLabel = 'Confirm'): Promise<boolean> {
  const d = document.querySelector<HTMLDialogElement>('[data-confirm]');
  if (!d) return Promise.resolve(window.confirm(text));
  d.querySelector('[data-confirm-title]')!.textContent = title;
  d.querySelector('[data-confirm-text]')!.textContent = text;
  d.querySelector('[data-confirm-ok]')!.textContent = okLabel;
  d.showModal();
  return new Promise((resolve) => d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true }));
}

const shell = document.querySelector<HTMLElement>('[data-shell]');
const scrim = document.querySelector<HTMLElement>('[data-scrim]');
if (document.documentElement.dataset.collapsed === '1') shell?.classList.add('is-collapsed');
document.querySelector('[data-side-toggle]')?.addEventListener('click', () => {
  if (window.matchMedia('(max-width: 960px)').matches) {
    const open = shell!.classList.toggle('is-open');
    if (scrim) scrim.hidden = !open;
  } else {
    const c = shell!.classList.toggle('is-collapsed');
    try { localStorage.setItem('vvip-admin-collapsed', c ? '1' : '0'); } catch { /* ignore */ }
  }
});
scrim?.addEventListener('click', () => { shell?.classList.remove('is-open'); scrim.hidden = true; });

const profileBtn = document.querySelector<HTMLButtonElement>('[data-profile]');
const profileMenu = document.querySelector<HTMLElement>('[data-profile-menu]');
profileBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = profileMenu!.hidden;
  profileMenu!.hidden = !open;
  profileBtn.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', () => { if (profileMenu) profileMenu.hidden = true; });

document.querySelector('[data-logout]')?.addEventListener('click', async () => {
  try { await api('/api/admin/auth/logout', { method: 'POST' }); } catch { /* session may already be gone */ }
  location.href = '/admin/login';
});

Object.assign(window, { vvipAdmin: { api, toast, confirmAction } });

/* Global search (press “/” to focus) */
const search = document.querySelector<HTMLElement>('[data-search]');
if (search) {
  const input = search.querySelector<HTMLInputElement>('input')!;
  const box = search.querySelector<HTMLElement>('.a-search__results')!;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  let t = 0;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = window.setTimeout(async () => {
      if (input.value.trim().length < 2) { box.hidden = true; return; }
      try {
        const r = await api<{ results: { type: string; title: string; sub: string; href: string }[] }>(`/api/admin/search?q=${encodeURIComponent(input.value)}`);
        box.innerHTML = r.results.length ? r.results.map((x) => `<a href="${esc(x.href)}" role="option"><span><span class="badge badge--plain">${esc(x.type)}</span> ${esc(x.title)}</span><small>${esc(x.sub)}</small></a>`).join('') : '<p>No results</p>';
        box.hidden = false;
      } catch { box.hidden = true; }
    }, 200);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); box.querySelector<HTMLElement>('a')?.focus(); }
    if (e.key === 'Escape') { box.hidden = true; input.blur(); }
  });
  box.addEventListener('keydown', (e) => {
    const a = document.activeElement as HTMLElement;
    if (e.key === 'ArrowDown') { e.preventDefault(); (a.nextElementSibling as HTMLElement)?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); ((a.previousElementSibling as HTMLElement) ?? input).focus(); }
  });
  document.addEventListener('click', (e) => { if (!search.contains(e.target as Node)) box.hidden = true; });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); input.focus(); }
  });
}
