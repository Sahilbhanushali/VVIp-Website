/**
 * First-party, anonymous analytics (≈2 KB). No cookies, no IPs, no third
 * parties. Respects Global Privacy Control and the consent setting.
 */
type Cfg = { analytics: boolean; consentRequired: boolean };
const cfg: Cfg = (window as unknown as { __vvip?: Cfg }).__vvip ?? { analytics: false, consentRequired: false };
const SESSION_MS = 30 * 60 * 1000;
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
const store = {
  get: (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } },
  set: (s: Storage, k: string, v: string) => { try { s.setItem(k, v); } catch { /* storage blocked */ } },
};

function ids() {
  let vid = store.get(localStorage, 'vvip-vid');
  if (!vid || !/^[a-f0-9]{32}$/.test(vid)) { vid = rid(); store.set(localStorage, 'vvip-vid', vid); }
  let sid = store.get(sessionStorage, 'vvip-sid');
  const last = Number(store.get(sessionStorage, 'vvip-last') ?? 0);
  let fresh = false;
  if (!sid || Date.now() - last > SESSION_MS) {
    sid = rid();
    fresh = true;
    store.set(sessionStorage, 'vvip-sid', sid);
    const sp = new URLSearchParams(location.search);
    store.set(sessionStorage, 'vvip-attr', JSON.stringify({
      landing: location.pathname, ref: document.referrer || '',
      utm_source: sp.get('utm_source') ?? undefined, utm_medium: sp.get('utm_medium') ?? undefined, utm_campaign: sp.get('utm_campaign') ?? undefined,
    }));
  }
  store.set(sessionStorage, 'vvip-last', String(Date.now()));
  return { vid, sid, fresh };
}

function send(payload: Record<string, unknown>, beacon = false) {
  const body = JSON.stringify(payload);
  if (beacon && navigator.sendBeacon) { navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' })); return; }
  fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
}

function start() {
  const { vid, sid, fresh } = ids();
  const attr = JSON.parse(store.get(sessionStorage, 'vvip-attr') ?? '{}');
  const base = { vid, sid, path: location.pathname.slice(0, 190) };
  const pv = () =>
    send({
      ...base, t: 'pv', new_session: fresh, title: document.title.slice(0, 200), ref: fresh ? attr.ref : undefined,
      utm_source: attr.utm_source, utm_medium: attr.utm_medium, utm_campaign: attr.utm_campaign,
      sw: Math.round(window.innerWidth), tz: Intl.DateTimeFormat().resolvedOptions().timeZone?.slice(0, 60),
    });
  // Defer the first beacon until the browser is idle so it never competes with rendering.
  ('requestIdleCallback' in window ? requestIdleCallback : setTimeout)(pv as () => void, { timeout: 3000 } as never);

  // Engaged time = time the tab is visible.
  let visibleSince = document.visibilityState === 'visible' ? performance.now() : 0;
  let engaged = 0;
  const flush = () => {
    if (visibleSince) { engaged += performance.now() - visibleSince; visibleSince = 0; }
    if (engaged > 500) send({ ...base, t: 'ping', ms: Math.round(engaged) }, true);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else { visibleSince = performance.now(); store.set(sessionStorage, 'vvip-last', String(Date.now())); }
  });
  window.addEventListener('pagehide', flush);
  // Heartbeat: unload beacons are not guaranteed, so report cumulative engaged time
  // every 15 s while the tab is visible (the server keeps the maximum per page view).
  window.setInterval(() => {
    if (document.visibilityState !== 'visible' || !visibleSince) return;
    const total = engaged + (performance.now() - visibleSince);
    if (total > 500) send({ ...base, t: 'ping', ms: Math.round(total) });
    store.set(sessionStorage, 'vvip-last', String(Date.now()));
  }, 15_000);

  const event = (name: string, label?: string) => send({ ...base, t: 'ev', name, label: label?.slice(0, 160) }, true);
  document.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('a, button');
    if (!el) return;
    const href = el.getAttribute('href') ?? '';
    const explicit = el.getAttribute('data-track');
    if (explicit) return event(explicit, el.textContent?.trim());
    if (href.startsWith('tel:')) return event('phone_click', href.slice(4));
    if (href.startsWith('mailto:')) return event('email_click', href.slice(7));
    if (/wa\.me|whatsapp/i.test(href)) return event('whatsapp_click', href);
    if (el.hasAttribute('data-open-visit')) return event('visit_open', el.textContent?.trim());
    if (el.hasAttribute('data-cta')) return event('cta_click', el.getAttribute('data-cta') ?? undefined);
  }, { capture: true });
  window.addEventListener('vvip:track', (e) => {
    const d = (e as CustomEvent<{ name: string; label?: string }>).detail;
    if (d?.name) event(d.name, d.label);
  });
}

const gpc = (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
if (cfg.analytics && !gpc) {
  if (!cfg.consentRequired) start();
  else {
    const choice = store.get(localStorage, 'vvip-consent');
    if (choice === 'yes') start();
    else if (choice !== 'no') {
      const banner = document.querySelector<HTMLElement>('[data-consent]');
      if (banner) {
        banner.hidden = false;
        banner.addEventListener('click', (e) => {
          const c = (e.target as HTMLElement).closest<HTMLElement>('[data-consent-choice]')?.dataset.consentChoice;
          if (!c) return;
          store.set(localStorage, 'vvip-consent', c);
          banner.hidden = true;
          if (c === 'yes') start();
        });
      }
    }
  }
}
