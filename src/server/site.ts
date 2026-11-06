/** Everything the public layout needs on every page, loaded once per render. */
import { getSettings, type Settings } from './settings.ts';
import { getNavigation, listArticles, listPublishedProperties, type NavItem, type ArticleCard, type PropertyCard } from './content.ts';
import { getMediaMany, type Media } from './media.ts';

export type SiteContext = {
  settings: Settings;
  header: NavItem[];
  footer: NavItem[];
  legal: NavItem[];
  articles: ArticleCard[];
  properties: PropertyCard[];
  logo: Media | null;
  ogDefault: Media | null;
};

export async function loadSiteContext(): Promise<SiteContext> {
  const settings = await getSettings();
  const [header, footer, legal, articles, properties, media] = await Promise.all([
    getNavigation('header'),
    getNavigation('footer'),
    getNavigation('legal'),
    listArticles(12),
    listPublishedProperties(),
    getMediaMany([settings.site.logo_media_id ?? 0, settings.seo.default_og_image_id ?? 0]),
  ]);
  return {
    settings, header, footer, legal, articles, properties,
    logo: settings.site.logo_media_id ? media.get(settings.site.logo_media_id) ?? null : null,
    ogDefault: settings.seo.default_og_image_id ? media.get(settings.seo.default_og_image_id) ?? null : null,
  };
}
