import { api, toast } from './shell';
import { build, showErrors, setBuilderContext } from './form-builder';
import { SETTINGS_FIELDS } from './settings-fields';

const el = document.getElementById('settings-ctx');
if (el) {
  const ctx = JSON.parse(el.textContent!) as { keys: string[]; values: Record<string, any>; media: Record<string, { thumb: string | null; name: string }> };
  setBuilderContext({ media: ctx.media });
  const host = document.querySelector<HTMLElement>('[data-settings]')!;
  for (const key of ctx.keys) {
    const spec = SETTINGS_FIELDS[key];
    const state = spec.list ? { items: ctx.values[key] } : ctx.values[key];
    const card = document.createElement('section');
    card.className = 'card';
    card.innerHTML = `<div class="card__head"><div><h2></h2><p></p></div><span class="badge badge--warn" hidden data-dirty>Unsaved</span></div><div class="card__body"></div><div class="card__foot"><button type="button" class="btn btn--primary">Save</button></div>`;
    card.querySelector('h2')!.textContent = spec.title;
    card.querySelector('p')!.textContent = spec.hint ?? '';
    const dirty = card.querySelector<HTMLElement>('[data-dirty]')!;
    const body = card.querySelector<HTMLElement>('.card__body')!;
    body.append(build(spec.fields, state, '', () => (dirty.hidden = false)));
    if (key === 'mail') {
      const extra = document.createElement('div');
      extra.className = 'stack';
      extra.style.marginTop = '1rem';
      extra.innerHTML = `<p class="muted">Password stored: <strong>${ctx.values.mail.has_password ? 'yes (encrypted)' : 'no'}</strong> · Active configuration: <strong>${ctx.values.mail.source}</strong></p>
        <div class="input-group" style="max-width:520px"><input class="input" type="email" placeholder="Send a test to (defaults to your email)" data-test-to><button class="btn" type="button" data-test>Send test email</button></div>`;
      body.append(extra);
      extra.querySelector('[data-test]')!.addEventListener('click', async (e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.classList.add('is-busy');
        try { const r = await api<{ message: string }>('/api/admin/settings/tools', { method: 'POST', json: { action: 'mail-test', to: extra.querySelector<HTMLInputElement>('[data-test-to]')!.value } }); toast(r.message); }
        catch (er) { toast((er as Error).message, 'err'); }
        finally { b.classList.remove('is-busy'); }
      });
    }
    if (key === 'analytics') {
      const btn = document.createElement('button');
      btn.className = 'btn btn--sm';
      btn.type = 'button';
      btn.textContent = 'Delete data older than the retention period now';
      btn.style.marginTop = '1rem';
      btn.addEventListener('click', async () => { try { const r = await api<{ message: string }>('/api/admin/settings/tools', { method: 'POST', json: { action: 'retention' } }); toast(r.message); } catch (er) { toast((er as Error).message, 'err'); } });
      body.append(btn);
    }
    card.querySelector('.card__foot .btn')!.addEventListener('click', async (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      b.classList.add('is-busy');
      const payload = spec.list ? { items: state.items } : { ...state };
      if (key === 'mail') { delete (payload as any).has_password; delete (payload as any).source; }
      try {
        await api(`/api/admin/settings/${key}`, { method: 'PUT', json: payload });
        dirty.hidden = true;
        showErrors(body, undefined);
        toast(`${spec.title} saved`);
        if (key === 'mail') (state as any).smtp_password = '';
      } catch (er) {
        showErrors(body, (er as { fields?: Record<string, string> }).fields, spec.list ? 'items' : '');
        toast((er as Error).message, 'err');
      } finally { b.classList.remove('is-busy'); }
    });
    host.append(card);
  }
}
