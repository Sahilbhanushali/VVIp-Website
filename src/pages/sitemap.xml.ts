import type { APIRoute } from 'astro';
import { getPosts } from '../utils/blog';
import { site } from '../data/site';

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${site.url}/`, lastmod: today, changefreq: 'weekly', priority: '1.0' },
    ...posts.map((p) => ({
      loc: `${site.url}/${p.id}.html`,
      lastmod: p.data.pubDate.toISOString().slice(0, 10),
      changefreq: 'monthly',
      priority: '0.6',
    })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
