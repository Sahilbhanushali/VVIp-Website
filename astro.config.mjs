// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import node from '@astrojs/node';

// Hosts whose Host / X-Forwarded-* headers Astro may trust (drives Astro.url and
// the built-in cross-site form protection). Extra hosts: ALLOWED_HOSTS=a.com,b.com at build time.
const extraHosts = (process.env.ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
const allowedDomains = [
  { hostname: 'vapisvip.com', protocol: 'https' },
  { hostname: 'www.vapisvip.com', protocol: 'https' },
  ...extraHosts.map((hostname) => ({ hostname, protocol: 'https' })),
  { hostname: 'localhost' },
  { hostname: '127.0.0.1' },
];

export default defineConfig({
  site: 'https://vapisvip.com',
  // Public pages and the admin are rendered by the Node server; public HTML
  // is cached in memory and purged whenever content is published.
  output: 'server',
  adapter: node({ mode: 'standalone', bodySizeLimit: 100 * 1024 * 1024 }), // matches Nginx client_max_body_size
  security: { checkOrigin: true, allowedDomains },
  build: { inlineStylesheets: 'always' },
  trailingSlash: 'ignore',
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Montserrat',
      cssVariable: '--font-title',
      fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif'],
      options: {
        variants: [{ src: ['@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2'], weight: '100 900', style: 'normal', display: 'swap' }],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Open Sans',
      cssVariable: '--font-body',
      fallbacks: ['Segoe UI', 'Arial', 'sans-serif'],
      options: {
        variants: [
          { src: ['@fontsource-variable/open-sans/files/open-sans-latin-wght-normal.woff2'], weight: '300 800', style: 'normal', display: 'swap' },
          { src: ['@fontsource-variable/open-sans/files/open-sans-latin-wght-italic.woff2'], weight: '300 800', style: 'italic', display: 'swap' },
        ],
      },
    },
  ],
  vite: { ssr: { external: ['@node-rs/argon2', 'sharp', 'mysql2', 'nodemailer'] } },
});
