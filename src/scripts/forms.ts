/**
 * Enquiry form submission → /api/inquiry (stored in the CMS, then emailed).
 * Same `{ success, message, errors }` contract as the original mail.php.
 */

type MailResponse = {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
};

// Same rules mail.php enforces server-side, so users get instant feedback.
const rules: Record<string, (v: string) => string | null> = {
  name: (v) => (!v ? 'Please enter your name' : v.length < 2 ? 'Name must be at least 2 characters' : null),
  email: (v) =>
    !v ? 'Please enter your email address' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Please enter a valid email address' : null,
  phone: (v) =>
    !v ? 'Please enter your phone number' : !/^\+?[0-9\s-]{7,15}$/.test(v) ? 'Please enter a valid phone number' : null,
  message: (v) => (!v ? 'Please enter your message' : v.length < 10 ? 'Message must be at least 10 characters' : null),
};

function safeGet(s: Storage, k: string): string {
  try { return s.getItem(k) ?? ''; } catch { return ''; }
}

function setFieldError(form: HTMLFormElement, name: string, msg: string | null) {
  const holder = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
  const control = form.elements.namedItem(name) as HTMLInputElement | null;
  if (holder) holder.textContent = msg ?? '';
  holder?.parentElement?.classList.toggle('is-invalid', Boolean(msg));
  control?.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function validate(form: HTMLFormElement): boolean {
  let firstInvalid: HTMLElement | null = null;
  for (const [name, rule] of Object.entries(rules)) {
    const control = form.elements.namedItem(name) as HTMLInputElement | null;
    const msg = rule((control?.value ?? '').trim());
    setFieldError(form, name, msg);
    if (msg && !firstInvalid) firstInvalid = control;
  }
  firstInvalid?.focus();
  return !firstInvalid;
}

function setStatus(form: HTMLFormElement, kind: 'success' | 'error' | '', text: string) {
  const status = form.querySelector<HTMLElement>('[data-status]');
  if (!status) return;
  status.classList.remove('is-success', 'is-error');
  if (kind) status.classList.add(`is-${kind}`);
  status.textContent = text;
}

export function initEnquiryForms() {
  document.querySelectorAll<HTMLFormElement>('form[data-enquiry]').forEach((form) => {
    // Re-validate a field as soon as the user fixes it.
    form.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const rule = rules[target.name];
      if (rule && target.getAttribute('aria-invalid') === 'true') setFieldError(form, target.name, rule(target.value.trim()));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus(form, '', '');
      if (!validate(form)) return;

      const button = form.querySelector<HTMLButtonElement>('[type="submit"]');
      const label = button?.querySelector<HTMLElement>('[data-label]');
      const original = label?.textContent ?? '';
      if (button) button.disabled = true;
      if (label) label.textContent = 'Sending…';

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new URLSearchParams(new FormData(form) as unknown as Record<string, string>),
          headers: {
            Accept: 'application/json',
            'X-Visitor-Id': safeGet(localStorage, 'vvip-vid'),
            'X-Attribution': safeGet(sessionStorage, 'vvip-attr'),
          },
        });
        let data: MailResponse | null = null;
        try {
          data = (await res.json()) as MailResponse;
        } catch {
          data = null;
        }

        if (data?.success) {
          setStatus(form, 'success', data.message ?? 'Thank you! Your message has been sent successfully.');
          form.reset();
          window.dispatchEvent(new CustomEvent('vvip:track', { detail: { name: 'form_submit', label: form.closest('dialog') ? 'visit dialog' : location.pathname } }));
          try {
            sessionStorage.setItem('formSubmitted', 'true');
          } catch {
            /* storage unavailable */
          }
        } else if (data?.errors && Object.keys(data.errors).length) {
          for (const [name, msg] of Object.entries(data.errors)) setFieldError(form, name, msg);
          setStatus(form, 'error', data.message ?? 'Please correct the errors below');
        } else {
          setStatus(form, 'error', data?.message ?? 'Oops! An error occurred. Please try again.');
        }
      } catch {
        setStatus(form, 'error', 'Oops! An error occurred. Please try again.');
      } finally {
        if (button) button.disabled = false;
        if (label) label.textContent = original;
      }
    });
  });
}
