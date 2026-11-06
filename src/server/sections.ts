/**
 * Predefined section types. Each maps 1:1 to an Astro component in
 * src/components/sections and has a strict schema, so editors change content
 * — never markup — and the design system stays intact.
 *
 * Headings support *asterisks* to mark the bronze-highlighted words.
 */
import { z } from 'astro/zod';

const str = (max: number) => z.string().trim().max(max).default('');
const req = (max: number) => z.string().trim().min(1, 'Required').max(max);
const mediaId = z.number().int().positive().nullable().default(null);
const href = z
  .string()
  .trim()
  .max(255)
  .refine((v) => v === '' || /^(\/|#|https?:\/\/|tel:|mailto:)/.test(v), 'Use a path (/…), #anchor, https://, tel: or mailto: link')
  .default('');
const cta = z.object({ label: str(40), href, opens_visit: z.boolean().default(false) }).prefault({});
const image = z.object({ media_id: mediaId, alt: str(200), position: str(30) }).prefault({});

export const SECTION_SCHEMAS = {
  hero: z.object({
    eyebrow: str(80), title: req(120), lead: str(400), image, primary: cta, secondary: cta,
    card_enabled: z.boolean().default(true), card_kicker: str(40), card_title: str(80), card_text: str(200), card_link: cta,
    stats: z.array(z.object({ value: z.number().min(0).max(1e9), decimals: z.number().int().min(0).max(2).default(0), suffix: str(4), label: req(40) })).max(6).default([]),
  }),
  campaign: z.object({
    label: str(80),
    slides: z.array(z.object({ media_id: mediaId, alt: str(200) })).max(10).default([]),
    interval_ms: z.number().int().min(2500).max(20000).default(5200),
  }),
  about: z.object({
    eyebrow: str(80), title: req(160), lead: str(800), image, caption_left: str(60), caption_right: str(80),
    card_title: str(160), card_paragraphs: z.array(str(600)).max(4).default([]), card_link: cta,
  }),
  featured_property: z.object({
    eyebrow: str(80), title: req(120), lead: str(400),
    property_id: z.number().int().positive().nullable().default(null),
    badge: str(30), description: str(400), primary: cta, secondary: cta,
    experiences_label: str(80),
    experiences: z.array(z.object({ subtitle: str(60), title: req(120), text: str(400), media_id: mediaId, alt: str(200) })).max(8).default([]),
  }),
  towers: z.object({
    eyebrow: str(80), title: req(160), lead: str(500),
    tabs: z.array(z.object({ code: str(3), kicker: str(40), title: req(120), text: str(500), media_id: mediaId, position: str(30), tags: z.array(str(40)).max(6).default([]) })).max(6).default([]),
    link: cta,
  }),
  gallery: z.object({
    eyebrow: str(80), title: req(120), lead: str(400),
    source: z.enum(['custom', 'property']).default('custom'),
    property_id: z.number().int().positive().nullable().default(null),
    items: z.array(z.object({ media_id: mediaId, title: str(120), category: str(40), shape: z.enum(['std', 'wide', 'tall']).default('std') })).max(40).default([]),
  }),
  amenities: z.object({
    eyebrow: str(80), title: req(120), lead: str(400),
    source: z.enum(['custom', 'property']).default('custom'),
    property_id: z.number().int().positive().nullable().default(null),
    items: z.array(z.object({ name: req(60), icon: str(40), media_id: mediaId })).max(30).default([]),
  }),
  brand_story: z.object({ eyebrow: str(80), title: req(160), lead: str(800), text: str(800), image, primary: cta, secondary: cta }),
  insights: z.object({ eyebrow: str(80), title: req(120), lead: str(400), count: z.number().int().min(1).max(12).default(3) }),
  contact: z.object({ eyebrow: str(80), title: req(120), lead: str(400), card_title: str(80), show_map: z.boolean().default(true) }),
  faq: z.object({ eyebrow: str(80), title: req(120), lead: str(400), items: z.array(z.object({ q: req(200), a: req(1200) })).max(30).default([]) }),
  location: z.object({ eyebrow: str(80), title: req(120), items: z.array(z.object({ title: req(80), text: str(400) })).max(12).default([]), show_map: z.boolean().default(true) }),
  property_overview: z.object({ eyebrow: str(80), title: req(160), lead: str(800), text: str(1500), image_a: image, image_b: image, quote: str(160), show_stats: z.boolean().default(true) }),
  experiences_grid: z.object({
    eyebrow: str(80), title: req(120), lead: str(400),
    items: z.array(z.object({ subtitle: str(60), title: req(120), text: str(400), media_id: mediaId, alt: str(200) })).max(8).default([]),
  }),
  testimonials: z.object({
    eyebrow: str(80), title: req(120),
    items: z.array(z.object({ quote: req(600), name: req(80), role: str(80) })).max(12).default([]),
  }),
  rich_text: z.object({ eyebrow: str(80), title: str(160), body: z.string().max(20000).default('') }),
  property_list: z.object({ eyebrow: str(80), title: req(120), lead: str(400), show_filters: z.boolean().default(true) }),
} as const;

export type SectionType = keyof typeof SECTION_SCHEMAS;
export type SectionData<T extends SectionType = SectionType> = z.infer<(typeof SECTION_SCHEMAS)[T]>;

export const SECTION_LABELS: Record<SectionType, { name: string; hint: string; templates: Array<'home' | 'property' | 'standard'> }> = {
  hero: { name: 'Hero', hint: 'Full-screen opening with heading, CTAs, glass card and statistics', templates: ['home', 'standard'] },
  campaign: { name: 'Campaign carousel', hint: 'Cross-fading full-width campaign artwork', templates: ['home', 'standard', 'property'] },
  about: { name: 'About / story', hint: 'Heading, wide image and overlapping story card', templates: ['home', 'standard'] },
  featured_property: { name: 'Featured property', hint: 'Listing card plus signature-experience selector', templates: ['home', 'standard'] },
  towers: { name: 'Tower explorer', hint: 'Tabbed image stage with information panels', templates: ['home', 'property', 'standard'] },
  gallery: { name: 'Gallery', hint: 'Filterable masonry grid with lightbox', templates: ['home', 'property', 'standard'] },
  amenities: { name: 'Amenities strip', hint: 'Scrollable amenity cards with icons', templates: ['home', 'property', 'standard'] },
  brand_story: { name: 'Brand story', hint: 'Image with heading, text and CTAs', templates: ['home', 'standard'] },
  insights: { name: 'Latest articles', hint: 'Featured article plus recent posts', templates: ['home', 'standard'] },
  contact: { name: 'Contact & enquiry form', hint: 'Contact details, enquiry form and map', templates: ['home', 'property', 'standard'] },
  faq: { name: 'FAQ', hint: 'Accordion of questions and answers', templates: ['home', 'property', 'standard'] },
  location: { name: 'Location & connectivity', hint: 'Connectivity points and map', templates: ['home', 'property', 'standard'] },
  property_overview: { name: 'Property overview', hint: 'Overview text, stats and two overlapping images', templates: ['property'] },
  experiences_grid: { name: 'Experiences grid', hint: 'Grid of image cards with titles', templates: ['home', 'property', 'standard'] },
  testimonials: { name: 'Testimonials', hint: 'Client quotes (add only genuine testimonials)', templates: ['home', 'property', 'standard'] },
  rich_text: { name: 'Rich text', hint: 'Formatted Markdown content block', templates: ['home', 'property', 'standard'] },
  property_list: { name: 'Property listing', hint: 'All published properties with search and filters', templates: ['home', 'standard'] },
};

export function parseSection(type: string, data: unknown) {
  const schema = SECTION_SCHEMAS[type as SectionType];
  if (!schema) throw new Error(`Unknown section type “${type}”`);
  return schema.parse(data ?? {});
}
export function safeSection(type: string, data: unknown) {
  const schema = SECTION_SCHEMAS[type as SectionType];
  if (!schema) return null;
  const r = schema.safeParse(data ?? {});
  return r.success ? r.data : null;
}
/** Starter content for a newly added section (valid but clearly a draft). */
export function emptySection(type: SectionType) {
  const base: Record<string, unknown> = { title: `New ${SECTION_LABELS[type].name.toLowerCase()} section` };
  if (type === 'faq') base.items = [];
  return SECTION_SCHEMAS[type].parse(base);
}

/** Collect every media id referenced anywhere in a JSON payload. */
export function collectMediaIds(v: unknown, out: number[] = []): number[] {
  if (Array.isArray(v)) v.forEach((x) => collectMediaIds(x, out));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      if (k.endsWith('media_id') && typeof x === 'number') out.push(x);
      else collectMediaIds(x, out);
    }
  return out;
}
