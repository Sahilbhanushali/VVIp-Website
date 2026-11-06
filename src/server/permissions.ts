/** Modules × actions. Roles get a subset; every protected API checks `can()` server-side. */
export const MODULES = ['dashboard', 'pages', 'properties', 'media', 'inquiries', 'analytics', 'seo', 'navigation', 'settings', 'users', 'activity'] as const;
export const ACTIONS = ['create', 'read', 'update', 'delete', 'publish', 'export', 'manage'] as const;
export type Module = (typeof MODULES)[number];
export type Action = (typeof ACTIONS)[number];
export type PermissionSet = Set<string>;

export const perm = (m: Module, a: Action) => `${m}:${a}`;
export const can = (set: PermissionSet | undefined, m: Module, a: Action) => !!set?.has(perm(m, a));

/** Which actions make sense per module (used by the role editor and the seed). */
export const MODULE_ACTIONS: Record<Module, Action[]> = {
  dashboard: ['read'],
  pages: ['create', 'read', 'update', 'delete', 'publish'],
  properties: ['create', 'read', 'update', 'delete', 'publish', 'export'],
  media: ['create', 'read', 'update', 'delete'],
  inquiries: ['read', 'update', 'delete', 'export'],
  analytics: ['read', 'export'],
  seo: ['read', 'update'],
  navigation: ['read', 'update'],
  settings: ['read', 'manage'],
  users: ['create', 'read', 'update', 'delete', 'manage'],
  activity: ['read'],
};

const all = (mods: Module[] = [...MODULES]) => mods.flatMap((m) => MODULE_ACTIONS[m].map((a) => perm(m, a)));

export const DEFAULT_ROLES = [
  { slug: 'super_admin', name: 'Super Admin', description: 'Full access including users, roles and settings.', perms: all() },
  {
    slug: 'administrator',
    name: 'Administrator',
    description: 'Manages all content, leads and settings; cannot manage users or roles.',
    perms: all().filter((p) => !p.startsWith('users:')),
  },
  {
    slug: 'editor',
    name: 'Editor',
    description: 'Creates and edits pages, properties and media; publishing included.',
    perms: [
      'dashboard:read',
      ...all(['pages', 'properties', 'media']).filter((p) => !p.endsWith(':delete') && !p.endsWith(':export')),
      'seo:read', 'seo:update', 'navigation:read', 'inquiries:read',
    ],
  },
  { slug: 'analytics_viewer', name: 'Analytics Viewer', description: 'Read-only access to the dashboard and analytics.', perms: ['dashboard:read', 'analytics:read', 'analytics:export'] },
];
