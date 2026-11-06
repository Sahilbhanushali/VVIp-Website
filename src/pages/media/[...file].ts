/** Serves media-library files from UPLOAD_DIR (in production Nginx can serve this path directly). */
import type { APIRoute } from 'astro';
import { Readable } from 'node:stream';
import { createReadStream, resolveMediaFile } from '../../server/media.ts';

export const prerender = false;

export const GET: APIRoute = ({ params, request }) => {
  const [key, file, ...rest] = (params.file ?? '').split('/');
  if (!key || !file || rest.length) return new Response('Not found', { status: 404 });
  const f = resolveMediaFile(key, file);
  if (!f) return new Response('Not found', { status: 404 });
  const headers: Record<string, string> = {
    'Content-Type': f.type,
    'Cache-Control': 'public, max-age=31536000, immutable', // files are never modified in place; replacements get a new key
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  };
  const range = request.headers.get('range');
  if (range && f.type.startsWith('video/')) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), f.size - 1) : f.size - 1;
    if (start > end || start >= f.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${f.size}` } });
    return new Response(Readable.toWeb(createReadStream(f.path, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${f.size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(createReadStream(f.path)) as ReadableStream, { headers: { ...headers, 'Content-Length': String(f.size) } });
};
