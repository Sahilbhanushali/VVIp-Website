// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

export default defineConfig({
  site: 'https://vapisvip.com',
  // Emit `blog-details.html` instead of `blog-details/index.html` so every
  // legacy URL (index.html, blog-details*.html) keeps working unchanged.
  build: { format: 'file', inlineStylesheets: 'always' },
  trailingSlash: 'ignore',
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  image: { layout: 'constrained', responsiveStyles: false },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Montserrat',
      cssVariable: '--font-title',
      fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif'],
      options: {
        variants: [
          { src: ['@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2'], weight: '100 900', style: 'normal', display: 'swap' },
        ],
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
});
