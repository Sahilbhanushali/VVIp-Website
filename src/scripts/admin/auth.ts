/** Auth forms (login / forgot / reset / logout): JSON POST with inline errors. */
document.querySelectorAll<HTMLFormElement>('[data-auth-form]').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector<HTMLElement>('[data-error]');
    const ok = form.querySelector<HTMLElement>('[data-success-box]');
    const btn = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    if (err) err.textContent = '';
    if ('confirm' in data && data.confirm !== data.password) { if (err) err.textContent = 'Passwords do not match.'; return; }
    btn.classList.add('is-busy');
    try {
      const res = await fetch(form.dataset.authForm!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(form.dataset.csrf ? { 'X-CSRF-Token': form.dataset.csrf } : {}) },
        body: JSON.stringify(data),
        credentials: 'same-origin',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong.');
      if (form.dataset.redirect) { location.href = form.dataset.redirect; return; }
      if (ok) { ok.textContent = form.dataset.success ?? 'Done.'; ok.hidden = false; form.reset(); }
    } catch (e2) {
      if (err) err.textContent = (e2 as Error).message;
    } finally {
      btn.classList.remove('is-busy');
    }
  });
});
