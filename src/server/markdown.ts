/**
 * Markdown → HTML for CMS content. Raw HTML in the source is escaped (not
 * rendered) and link/image URLs are restricted to safe schemes, so editor
 * input cannot inject script into public pages.
 */
import { Marked, type Tokens } from 'marked';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const safeUrl = (u: string) => (/^(https?:|mailto:|tel:|\/|#)/i.test(u.trim()) ? u.trim() : '#');

const md = new Marked({ gfm: true, breaks: false });
md.use({
  renderer: {
    html(token: Tokens.HTML | Tokens.Tag) {
      return esc(token.text);
    },
    link(token: Tokens.Link) {
      const href = safeUrl(token.href);
      const external = /^https?:/i.test(href) && !/vapisvip\.com/i.test(href);
      const text = this.parser.parseInline(token.tokens);
      return `<a href="${esc(href)}"${token.title ? ` title="${esc(token.title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
    },
    image(token: Tokens.Image) {
      const src = safeUrl(token.href);
      // Media-library images get a responsive srcset from their sibling variants.
      const m = src.match(/^\/media\/([a-z0-9-]+)\/w\d+\.webp$/);
      const srcset = m ? [480, 960, 1600].map((w) => `/media/${m[1]}/w${w}.webp ${w}w`).join(', ') : '';
      return `<img src="${esc(src)}" alt="${esc(token.text)}" loading="lazy" decoding="async"${srcset ? ` srcset="${srcset}" sizes="(min-width: 1100px) 720px, 100vw"` : ''} />`;
    },
  },
});

export function renderMarkdown(src: string | null | undefined): string {
  return src ? (md.parse(src, { async: false }) as string) : '';
}
