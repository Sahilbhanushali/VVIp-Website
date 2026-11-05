import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  // The file name (e.g. `blog-details-2.md`) becomes the entry id and therefore
  // the public URL (`/blog-details-2.html`) — identical to the legacy site.
  loader: glob({ pattern: '*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      /** Article headline (H1). */
      title: z.string(),
      /** Shorter headline used on listing cards. */
      cardTitle: z.string(),
      /** <title> tag. */
      seoTitle: z.string(),
      description: z.string(),
      excerpt: z.string(),
      keywords: z.string(),
      pubDate: z.coerce.date(),
      cover: image(),
      coverAlt: z.string(),
      order: z.number(),
    }),
});

export const collections = { blog };
