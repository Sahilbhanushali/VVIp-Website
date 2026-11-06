/**
 * UI description of every predefined section (mirrors src/server/sections.ts).
 * The section editor renders forms from this; the server re-validates with Zod.
 */
export type Field =
  | { k: string; t: 'text' | 'heading' | 'textarea' | 'markdown' | 'url'; label: string; max?: number; hint?: string }
  | { k: string; t: 'bool'; label: string; hint?: string }
  | { k: string; t: 'number'; label: string; min?: number; max?: number; step?: number; hint?: string; nullable?: boolean }
  | { k: string; t: 'select'; label: string; options: [string, string][]; hint?: string; numeric?: boolean }
  | { k: string; t: 'image'; label: string; position?: boolean; hint?: string }
  | { k: string; t: 'media'; label: string; hint?: string }
  | { k: string; t: 'cta'; label: string; visit?: boolean; hint?: string }
  | { k: string; t: 'list'; label: string; of: Field[]; item: string; add: string; max?: number; hint?: string }
  | { k: string; t: 'strings'; label: string; add: string; max?: number }
  | { k: string; t: 'property'; label: string; hint?: string };

const head = (eyebrow = true, lead = true): Field[] => [
  ...(eyebrow ? [{ k: 'eyebrow', t: 'text', label: 'Eyebrow (small label)', max: 80 } as Field] : []),
  { k: 'title', t: 'heading', label: 'Heading', max: 160, hint: 'Wrap words in *asterisks* to highlight them in bronze.' },
  ...(lead ? [{ k: 'lead', t: 'textarea', label: 'Introduction', max: 800 } as Field] : []),
];
const img = (k = 'image', label = 'Image', position = true): Field => ({ k, t: 'image', label, position });
const items = (k: string, label: string, of: Field[], item: string, add: string, max = 20): Field => ({ k, t: 'list', label, of, item, add, max });
const source: Field = { k: 'source', t: 'select', label: 'Content source', options: [['property', 'From a property (managed in Properties)'], ['custom', 'Custom items below']] };

export const SECTION_FIELDS: Record<string, Field[]> = {
  hero: [
    ...head(true, false),
    { k: 'lead', t: 'textarea', label: 'Introduction', max: 400 },
    img('image', 'Background image'),
    { k: 'primary', t: 'cta', label: 'Primary button', visit: true },
    { k: 'secondary', t: 'cta', label: 'Secondary button', visit: true },
    { k: 'card_enabled', t: 'bool', label: 'Show glass information card (desktop)' },
    { k: 'card_kicker', t: 'text', label: 'Card label', max: 40 },
    { k: 'card_title', t: 'text', label: 'Card title', max: 80 },
    { k: 'card_text', t: 'text', label: 'Card text', max: 200 },
    { k: 'card_link', t: 'cta', label: 'Card link' },
    items('stats', 'Statistics', [
      { k: 'value', t: 'number', label: 'Value', min: 0, step: 0.1 },
      { k: 'decimals', t: 'number', label: 'Decimals', min: 0, max: 2 },
      { k: 'suffix', t: 'text', label: 'Suffix (e.g. +)', max: 4 },
      { k: 'label', t: 'text', label: 'Label', max: 40 },
    ], 'label', 'Add statistic', 6),
  ],
  campaign: [
    { k: 'label', t: 'text', label: 'Accessible name', max: 80 },
    { k: 'interval_ms', t: 'number', label: 'Time per slide (ms)', min: 2500, max: 20000, step: 100 },
    items('slides', 'Slides', [{ k: 'media_id', t: 'media', label: 'Artwork' }, { k: 'alt', t: 'text', label: 'Alt text', max: 200 }], 'alt', 'Add slide', 10),
  ],
  about: [
    ...head(),
    img(),
    { k: 'caption_left', t: 'text', label: 'Caption (left)', max: 60 },
    { k: 'caption_right', t: 'text', label: 'Caption (right)', max: 80 },
    { k: 'card_title', t: 'text', label: 'Story card title', max: 160 },
    { k: 'card_paragraphs', t: 'strings', label: 'Story card paragraphs', add: 'Add paragraph', max: 4 },
    { k: 'card_link', t: 'cta', label: 'Story card link' },
  ],
  featured_property: [
    ...head(),
    { k: 'property_id', t: 'property', label: 'Featured property', hint: 'Leave empty to use the first featured, published property.' },
    { k: 'badge', t: 'text', label: 'Badge', max: 30 },
    { k: 'description', t: 'textarea', label: 'Card description (defaults to the property summary)', max: 400 },
    { k: 'primary', t: 'cta', label: 'Primary button' },
    { k: 'secondary', t: 'cta', label: 'Secondary link' },
    { k: 'experiences_label', t: 'text', label: 'Experiences label', max: 80 },
    items('experiences', 'Signature experiences', [
      { k: 'subtitle', t: 'text', label: 'Subtitle', max: 60 },
      { k: 'title', t: 'text', label: 'Title', max: 120 },
      { k: 'text', t: 'textarea', label: 'Text', max: 400 },
      { k: 'media_id', t: 'media', label: 'Image' },
      { k: 'alt', t: 'text', label: 'Alt text', max: 200 },
    ], 'title', 'Add experience', 8),
  ],
  towers: [
    ...head(),
    items('tabs', 'Tabs', [
      { k: 'code', t: 'text', label: 'Large letter/number', max: 3 },
      { k: 'kicker', t: 'text', label: 'Kicker', max: 40 },
      { k: 'title', t: 'text', label: 'Title', max: 120 },
      { k: 'text', t: 'textarea', label: 'Text', max: 500 },
      { k: 'media_id', t: 'media', label: 'Image' },
      { k: 'position', t: 'text', label: 'Image focus (CSS object-position, e.g. 50% 30%)', max: 30 },
      { k: 'tags', t: 'strings', label: 'Tags', add: 'Add tag', max: 6 },
    ], 'title', 'Add tab', 6),
    { k: 'link', t: 'cta', label: 'Link below the explorer' },
  ],
  gallery: [
    ...head(),
    source,
    { k: 'property_id', t: 'property', label: 'Property', hint: 'Images, captions and categories are edited on the property.' },
    items('items', 'Custom images', [
      { k: 'media_id', t: 'media', label: 'Image' },
      { k: 'title', t: 'text', label: 'Caption', max: 120 },
      { k: 'category', t: 'text', label: 'Filter category', max: 40 },
      { k: 'shape', t: 'select', label: 'Tile shape', options: [['std', 'Standard'], ['wide', 'Wide'], ['tall', 'Tall']] },
    ], 'title', 'Add image', 40),
  ],
  amenities: [
    ...head(),
    source,
    { k: 'property_id', t: 'property', label: 'Property' },
    items('items', 'Custom amenities', [
      { k: 'name', t: 'text', label: 'Name', max: 60 },
      { k: 'icon', t: 'select', label: 'Icon', options: [['', 'None'], ...['art-gallery', 'car-lift', 'cctv', 'check-in', 'drop-off', 'fire-safety', 'lifts', 'lobby', 'podium', 'security', 'valet', 'ventilated', 'wide-passage'].map((i) => [i, i.replace('-', ' ')] as [string, string])] },
      { k: 'media_id', t: 'media', label: 'Image' },
    ], 'name', 'Add amenity', 30),
  ],
  brand_story: [...head(), { k: 'text', t: 'textarea', label: 'Body text', max: 800 }, img('image', 'Image', false), { k: 'primary', t: 'cta', label: 'Primary button', visit: true }, { k: 'secondary', t: 'cta', label: 'Secondary link' }],
  insights: [...head(), { k: 'count', t: 'number', label: 'Number of articles', min: 1, max: 12 }],
  contact: [...head(), { k: 'card_title', t: 'text', label: 'Form card title', max: 80 }, { k: 'show_map', t: 'bool', label: 'Show map (embed from Settings → Contact)' }],
  faq: [...head(), items('items', 'Questions', [{ k: 'q', t: 'text', label: 'Question', max: 200 }, { k: 'a', t: 'textarea', label: 'Answer', max: 1200 }], 'q', 'Add question', 30)],
  location: [
    ...head(true, false),
    { k: 'show_map', t: 'bool', label: 'Show map' },
    items('items', 'Connectivity points', [{ k: 'title', t: 'text', label: 'Title', max: 80 }, { k: 'text', t: 'textarea', label: 'Text', max: 400 }], 'title', 'Add point', 12),
  ],
  property_overview: [
    ...head(),
    { k: 'text', t: 'textarea', label: 'Body text', max: 1500 },
    img('image_a', 'Large image', false),
    img('image_b', 'Overlapping image', false),
    { k: 'quote', t: 'text', label: 'Quote', max: 160 },
    { k: 'show_stats', t: 'bool', label: 'Show company statistics (from the homepage hero)' },
  ],
  experiences_grid: [
    ...head(),
    items('items', 'Experiences', [
      { k: 'subtitle', t: 'text', label: 'Subtitle', max: 60 },
      { k: 'title', t: 'text', label: 'Title', max: 120 },
      { k: 'text', t: 'textarea', label: 'Text', max: 400 },
      { k: 'media_id', t: 'media', label: 'Image' },
      { k: 'alt', t: 'text', label: 'Alt text', max: 200 },
    ], 'title', 'Add experience', 8),
  ],
  testimonials: [
    { k: 'eyebrow', t: 'text', label: 'Eyebrow', max: 80 },
    { k: 'title', t: 'heading', label: 'Heading', max: 120 },
    items('items', 'Testimonials', [{ k: 'quote', t: 'textarea', label: 'Quote', max: 600 }, { k: 'name', t: 'text', label: 'Name', max: 80 }, { k: 'role', t: 'text', label: 'Role / company', max: 80 }], 'name', 'Add testimonial', 12),
  ],
  rich_text: [{ k: 'eyebrow', t: 'text', label: 'Eyebrow', max: 80 }, { k: 'title', t: 'heading', label: 'Heading', max: 160 }, { k: 'body', t: 'markdown', label: 'Content (Markdown)', max: 20000 }],
  property_list: [...head(), { k: 'show_filters', t: 'bool', label: 'Show search & filters' }],
};
