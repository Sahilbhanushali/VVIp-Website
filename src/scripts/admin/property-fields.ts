import type { Field } from './section-fields';

const ICONS: [string, string][] = [['', 'None'], ...['art-gallery', 'car-lift', 'cctv', 'check-in', 'drop-off', 'fire-safety', 'lifts', 'lobby', 'podium', 'security', 'valet', 'ventilated', 'wide-passage'].map((i) => [i, i.replace('-', ' ')] as [string, string])];

export const propertyGroups = (categories: [string, string][]): { title: string; hint?: string; fields: Field[] }[] => [
  { title: 'Details', fields: [
    { k: 'title', t: 'text', label: 'Property name', max: 160 },
    { k: 'slug', t: 'text', label: 'URL slug (page is /slug.html)', max: 120, hint: 'Changing it moves the public page; menu links are updated automatically.' },
    { k: 'tagline', t: 'text', label: 'Tagline', max: 255 },
    { k: 'property_type', t: 'text', label: 'Property type (e.g. Commercial, Residential)', max: 60 },
    { k: 'category_id', t: 'select', label: 'Category', options: [['', '— None —'], ...categories], numeric: true },
    { k: 'developer', t: 'text', label: 'Developer', max: 120 },
    { k: 'summary', t: 'textarea', label: 'Summary (listing cards & featured section)', max: 600 },
    { k: 'description', t: 'markdown', label: 'Full description (Markdown)', max: 100000 },
  ] },
  { title: 'Price, size & layout', hint: 'Leave blank what doesn’t apply — empty values are hidden on the website.', fields: [
    { k: 'price_amount', t: 'number', label: 'Price (₹)', min: 0, step: 1000, nullable: true },
    { k: 'price_label', t: 'text', label: 'Price label (overrides the amount, e.g. “Price on request”)', max: 80 },
    { k: 'area', t: 'number', label: 'Area', min: 0, step: 1, nullable: true },
    { k: 'area_unit', t: 'select', label: 'Area unit', options: [['sqft', 'sq.ft'], ['sqm', 'm²'], ['sqyd', 'sq.yd'], ['acre', 'acres']] },
    { k: 'bedrooms', t: 'number', label: 'Bedrooms', min: 0, max: 255, nullable: true },
    { k: 'bathrooms', t: 'number', label: 'Bathrooms', min: 0, max: 255, nullable: true },
  ] },
  { title: 'Location', fields: [
    { k: 'location', t: 'text', label: 'Area / city (shown on cards)', max: 160 },
    { k: 'address', t: 'textarea', label: 'Full address', max: 255 },
    { k: 'latitude', t: 'number', label: 'Latitude', step: 0.000001, nullable: true },
    { k: 'longitude', t: 'number', label: 'Longitude', step: 0.000001, nullable: true },
  ] },
  { title: 'Images', hint: 'The main image is the hero and the card photo. Gallery images feed every gallery section that uses this property.', fields: [
    { k: 'main_image_id', t: 'media', label: 'Main image' },
    { k: 'images', t: 'list', label: 'Gallery', item: 'caption', add: 'Add gallery image', max: 80, of: [
      { k: 'media_id', t: 'media', label: 'Image' },
      { k: 'caption', t: 'text', label: 'Caption', max: 160 },
      { k: 'category', t: 'text', label: 'Filter category (e.g. Architecture, Interiors)', max: 40 },
      { k: 'shape', t: 'select', label: 'Tile shape', options: [['std', 'Standard'], ['wide', 'Wide (2 columns)'], ['tall', 'Tall (2 rows)']] },
    ] },
  ] },
  { title: 'Amenities', fields: [
    { k: 'amenities', t: 'list', label: 'Amenities', item: 'name', add: 'Add amenity', max: 60, of: [
      { k: 'name', t: 'text', label: 'Name', max: 80 },
      { k: 'icon', t: 'select', label: 'Icon', options: ICONS },
      { k: 'media_id', t: 'media', label: 'Card image' },
    ] },
  ] },
  { title: 'Specifications', hint: 'Shown in the key-facts bar. A spec labelled “Spaces” (comma-separated) becomes chips on the featured card.', fields: [
    { k: 'specs', t: 'list', label: 'Specifications', item: 'label', add: 'Add specification', max: 40, of: [
      { k: 'label', t: 'text', label: 'Label', max: 80 },
      { k: 'value', t: 'text', label: 'Value', max: 160 },
    ] },
  ] },
  { title: 'SEO & sharing', fields: [
    { k: 'seo_title', t: 'text', label: 'SEO title', max: 160 },
    { k: 'seo_description', t: 'textarea', label: 'Meta description', max: 320 },
    { k: 'og_image_id', t: 'media', label: 'Social sharing image' },
  ] },
];
