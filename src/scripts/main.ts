/**
 * Site-wide behaviour. Vanilla TypeScript, no dependencies — replaces the
 * original jQuery + Bootstrap + Swiper + CounterUp stack.
 */
import { initEnquiryForms } from './forms';

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------------------------------------------------------- header */
function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  const scrollTopBtn = document.querySelector<HTMLElement>('.scroll-top');
  const progress = scrollTopBtn?.querySelector<SVGElement>('[data-progress]');
  if (!header) return;

  let lastY = window.scrollY;
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const menuOpen = document.querySelector('#site-menu[open]');

    header.classList.toggle('is-solid', y > 40);
    // Hide on scroll down, reveal on scroll up (never while the menu is open).
    if (!menuOpen) header.classList.toggle('is-hidden', y > 400 && y > lastY + 2);
    if (y < lastY - 2) header.classList.remove('is-hidden');
    lastY = y;

    if (scrollTopBtn) {
      scrollTopBtn.classList.toggle('is-visible', y > 700);
      progress?.style.setProperty('--progress', (y / max).toFixed(3));
    }
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();

  // Header elements must not be hidden while keyboard users tab through it.
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
}

/* ---------------------------------------------------------- scroll to top */
function initScrollTop() {
  document.querySelectorAll<HTMLElement>('[data-scroll-top]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      document.querySelector<HTMLElement>('.site-header__brand')?.focus({ preventScroll: true });
    });
  });
}

/* ------------------------------------------------------- full-screen menu */
function initMenu() {
  const menu = document.querySelector<HTMLDialogElement>('#site-menu');
  const openBtn = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  if (!menu || !openBtn) return;

  const open = () => {
    menu.showModal();
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => menu.classList.add('is-open'));
  };
  const close = (immediate = false) => {
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    menu.classList.remove('is-open');
    if (immediate || reducedMotion.matches) menu.close();
    else window.setTimeout(() => menu.close(), 650);
  };

  openBtn.addEventListener('click', open);
  menu.querySelector('[data-menu-close]')?.addEventListener('click', () => close());
  menu.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // Close before following an in-page link so the browser can scroll the page.
  menu.querySelectorAll('[data-menu-link]').forEach((link) => {
    link.addEventListener('click', () => close(true));
  });
}

/* ------------------------------------------------------- visit dialog */
function initVisitDialog() {
  const dialog = document.querySelector<HTMLDialogElement>('#visit-dialog');
  if (!dialog) return;
  let lastTrigger: HTMLElement | null = null;

  document.querySelectorAll<HTMLElement>('[data-open-visit]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      lastTrigger = trigger;
      const menu = document.querySelector<HTMLDialogElement>('#site-menu[open]');
      menu?.close();
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      dialog.querySelector<HTMLInputElement>('input:not([type="hidden"]):not([tabindex="-1"])')?.focus({ preventScroll: true });
    });
  });

  dialog.querySelector('[data-visit-close]')?.addEventListener('click', () => dialog.close());
  // Click on the backdrop closes the dialog.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    lastTrigger?.focus({ preventScroll: true });
  });
}

/* ------------------------------------------------------- reveal on scroll */
function initReveal() {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal], [data-split]');
  if (!targets.length) return;

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }

  // A fully clipped element (clip-path: inset(100%…)) never reports as
  // intersecting, so clip reveals are observed through their parent.
  const watchers = new Map<Element, HTMLElement[]>();
  targets.forEach((el) => {
    const watched = el.dataset.reveal === 'clip' && el.parentElement ? el.parentElement : el;
    watchers.set(watched, [...(watchers.get(watched) ?? []), el]);
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          watchers.get(entry.target)?.forEach((el) => el.classList.add('is-in'));
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
  );

  const start = () => watchers.forEach((_, el) => io.observe(el));
  // On the home page wait for the intro curtain to lift before animating.
  if (root.classList.contains('has-intro')) window.addEventListener('intro:done', start, { once: true });
  else start();
}

/* ------------------------------------------------------------- parallax */
function initParallax() {
  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
  if (!items.length || reducedMotion.matches) return;

  const visible = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target as HTMLElement);
      else visible.delete(e.target as HTMLElement);
    }
    schedule();
  });
  items.forEach((el) => io.observe(el));

  let raf = 0;
  const frame = () => {
    raf = 0;
    const vh = window.innerHeight;
    for (const el of visible) {
      const r = el.getBoundingClientRect();
      // -1 when the element enters from the bottom, +1 when it leaves at the top
      const p = (vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2);
      el.style.setProperty('--p', Math.max(-1, Math.min(1, p)).toFixed(4));
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

/* -------------------------------------------------------------- counters */
function initCounters() {
  const counters = document.querySelectorAll<HTMLElement>('[data-count]');
  if (!counters.length) return;

  const run = (el: HTMLElement) => {
    const target = Number(el.dataset.count);
    const decimals = Number(el.dataset.decimals ?? 0);
    const fmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (reducedMotion.matches) {
      el.textContent = fmt.format(target);
      return;
    }
    const duration = 1600;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      // ~30fps is visually identical for a count-up and halves layout work
      if (frame++ % 2 === 0 || t === 1) el.textContent = fmt.format(target * (1 - Math.pow(1 - t, 4)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          run(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.6 },
  );
  const start = () => counters.forEach((el) => io.observe(el));
  if (root.classList.contains('has-intro')) window.addEventListener('intro:done', start, { once: true });
  else start();
}

/* ----------------------------------------------- active section in nav */
function initActiveNav() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')).filter((a) =>
    a.getAttribute('href')?.startsWith('#'),
  );
  if (!links.length) return;
  const map = new Map<Element, HTMLAnchorElement>();
  for (const a of links) {
    const section = document.querySelector(a.getAttribute('href')!);
    if (section) map.set(section, a);
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((l) => l.removeAttribute('aria-current'));
        map.get(e.target)?.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  map.forEach((_, section) => io.observe(section));
}

initHeader();
initScrollTop();
initMenu();
initVisitDialog();
initReveal();
initParallax();
initCounters();
initActiveNav();
initEnquiryForms();
