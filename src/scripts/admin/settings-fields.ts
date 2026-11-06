import type { Field } from './section-fields';
const link = (label: string, hrefLabel: string): Field[] => [{ k: 'label', t: 'text', label, max: 80 }, { k: 'href', t: 'text', label: hrefLabel, max: 255 }];
export const SETTINGS_FIELDS: Record<string, { title: string; hint?: string; fields: Field[]; list?: boolean }> = {
  site: { title: 'General', fields: [
    { k: 'name', t: 'text', label: 'Website name', max: 80 },
    { k: 'tagline', t: 'text', label: 'Tagline (menu & key visuals)', max: 120 },
    { k: 'developer', t: 'text', label: 'Developer / company', max: 120 },
    { k: 'logo_media_id', t: 'media', label: 'Logo (transparent PNG/WebP recommended)' },
    { k: 'menu_about', t: 'textarea', label: 'About text in the full-screen menu', max: 800 },
  ] },
  contact: { title: 'Contact details', hint: 'Used in the header, menu, footer, contact sections and structured data.', fields: [
    { k: 'address', t: 'textarea', label: 'Address', max: 255 },
    { k: 'phones', t: 'list', label: 'Phone numbers (first one is shown in the header)', item: 'label', add: 'Add phone', max: 6, of: link('Display text (e.g. +91 968 766 4411)', 'Link (tel:+919687664411)') },
    { k: 'emails', t: 'list', label: 'Email addresses', item: 'label', add: 'Add email', max: 6, of: link('Display text', 'Link (mailto:…)') },
    { k: 'whatsapp', t: 'text', label: 'WhatsApp number with country code (shown when set)', max: 20 },
    { k: 'maps_url', t: 'text', label: 'Google Maps link (“Get directions”)', max: 500 },
    { k: 'map_embed', t: 'textarea', label: 'Google Maps embed URL (src of the embed iframe)', max: 1200 },
    { k: 'hours', t: 'list', label: 'Office hours', item: 'days', add: 'Add row', max: 7, of: [{ k: 'days', t: 'text', label: 'Days', max: 60 }, { k: 'time', t: 'text', label: 'Time', max: 60 }] },
  ] },
  social: { title: 'Social media', list: true, fields: [
    { k: 'items', t: 'list', label: 'Profiles', item: 'name', add: 'Add profile', max: 8, of: [
      { k: 'name', t: 'text', label: 'Name', max: 40 },
      { k: 'href', t: 'text', label: 'Profile URL (https://…)', max: 255 },
      { k: 'icon', t: 'select', label: 'Icon', options: [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['x', 'X (Twitter)']] },
    ] },
  ] },
  header: { title: 'Header', fields: [
    { k: 'show_phone', t: 'bool', label: 'Show the first phone number in the header (large screens)' },
    { k: 'cta_enabled', t: 'bool', label: 'Show the header button (opens the visit form)' },
    { k: 'cta_label', t: 'text', label: 'Header button label', max: 40 },
  ] },
  footer: { title: 'Footer', hint: 'The copyright year always shows the current year automatically.', fields: [
    { k: 'statement', t: 'textarea', label: 'Closing statement', max: 300 },
    { k: 'statement_highlight', t: 'text', label: 'Highlighted ending (bronze)', max: 120 },
    { k: 'about', t: 'textarea', label: 'Footer description', max: 500 },
    { k: 'copyright_name', t: 'text', label: 'Copyright name', max: 80 },
    { k: 'credit', t: 'text', label: 'Credit (“All rights reserved By …”)', max: 120 },
  ] },
  mail: { title: 'Email notifications', hint: 'New inquiries are always saved first; email is a notification. SMTP_* values in the server .env take precedence over these fields.', fields: [
    { k: 'enabled', t: 'bool', label: 'Send an email for every new inquiry' },
    { k: 'notify_to', t: 'text', label: 'Send notifications to (comma-separated)', max: 400 },
    { k: 'from', t: 'text', label: 'From address (e.g. VVIP Website <noreply@vapisvip.com>)', max: 200 },
    { k: 'smtp_host', t: 'text', label: 'SMTP host', max: 190 },
    { k: 'smtp_port', t: 'number', label: 'SMTP port', min: 1, max: 65535 },
    { k: 'smtp_secure', t: 'bool', label: 'Use TLS from the start (port 465)' },
    { k: 'smtp_user', t: 'text', label: 'SMTP username', max: 190 },
    { k: 'smtp_password', t: 'text', label: 'SMTP password (write-only — leave empty to keep the saved one)', max: 300 },
  ] },
  analytics: { title: 'Analytics', fields: [
    { k: 'enabled', t: 'bool', label: 'Record anonymous first-party analytics' },
    { k: 'retention_days', t: 'number', label: 'Keep analytics data for (days, 30–1095)', min: 30, max: 1095 },
    { k: 'require_consent', t: 'bool', label: 'Only track visitors who accept the consent banner' },
  ] },
  cookie_consent: { title: 'Consent banner', fields: [
    { k: 'enabled', t: 'bool', label: 'Show the consent banner' },
    { k: 'message', t: 'textarea', label: 'Banner text', max: 400 },
  ] },
  maintenance: { title: 'Maintenance mode', hint: 'Visitors see a “back soon” page (HTTP 503). Signed-in admins still see the full site.', fields: [
    { k: 'enabled', t: 'bool', label: 'Put the public website in maintenance mode' },
    { k: 'message', t: 'textarea', label: 'Message', max: 400 },
  ] },
  enquiry_types: { title: 'Enquiry form options', list: true, fields: [{ k: 'items', t: 'strings', label: '“Interested in” options', add: 'Add option', max: 20 }] },
  seo: { title: 'Global SEO', fields: [
    { k: 'site_title', t: 'text', label: 'Site title (appended to page titles)', max: 120 },
    { k: 'default_description', t: 'textarea', label: 'Default meta description', max: 320 },
    { k: 'default_og_image_id', t: 'media', label: 'Default social sharing image' },
    { k: 'canonical_domain', t: 'text', label: 'Canonical domain (https://…)', max: 255 },
    { k: 'allow_indexing', t: 'bool', label: 'Allow search engines to index the site' },
    { k: 'sitemap_enabled', t: 'bool', label: 'Publish /sitemap.xml' },
    { k: 'organization_name', t: 'text', label: 'Organisation name (structured data)', max: 120 },
    { k: 'organization_description', t: 'textarea', label: 'Organisation description', max: 500 },
    { k: 'rating_value', t: 'number', label: 'Aggregate rating value (only if you hold genuine reviews)', min: 0, max: 5, step: 0.1, nullable: true },
    { k: 'rating_count', t: 'number', label: 'Number of reviews', min: 0, nullable: true },
    { k: 'gsc_site_url', t: 'text', label: 'Google Search Console property (e.g. sc-domain:vapisvip.com)', max: 255 },
  ] },
};
