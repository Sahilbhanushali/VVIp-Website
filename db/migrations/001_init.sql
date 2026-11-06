-- VVIP CMS — initial schema (MariaDB 10.6+ / MySQL 8+)
-- All tables InnoDB, utf8mb4. Timestamps stored in UTC.

-- ───────────────────────────── Access control ─────────────────────────────
CREATE TABLE roles (
  id            SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug          VARCHAR(40)  NOT NULL,
  name          VARCHAR(80)  NOT NULL,
  description   VARCHAR(255) NULL,
  is_system     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_roles_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id      SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module  VARCHAR(40) NOT NULL,
  action  VARCHAR(20) NOT NULL,
  UNIQUE KEY uq_permissions (module, action)
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id       SMALLINT UNSIGNED NOT NULL,
  permission_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE admin_users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(190) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role_id         SMALLINT UNSIGNED NOT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  failed_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until    DATETIME     NULL,
  last_login_at   DATETIME     NULL,
  password_changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_email (email),
  KEY idx_admin_role (role_id),
  CONSTRAINT fk_admin_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB;

-- Session id = SHA-256 of the random cookie token (the raw token is never stored)
CREATE TABLE admin_sessions (
  id            CHAR(64)     NOT NULL PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  csrf_token    CHAR(64)     NOT NULL,
  ip_hash       CHAR(64)     NULL,
  user_agent    VARCHAR(255) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME     NOT NULL,
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_resets (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  CHAR(64)     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used_at     DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reset_token (token_hash),
  KEY idx_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE login_attempts (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(190) NOT NULL,
  ip_hash     CHAR(64)     NOT NULL,
  success     TINYINT(1)   NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attempts_ip (ip_hash, created_at),
  KEY idx_attempts_email (email, created_at)
) ENGINE=InnoDB;

CREATE TABLE activity_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NULL,
  action       VARCHAR(40)  NOT NULL,
  entity_type  VARCHAR(40)  NOT NULL,
  entity_id    VARCHAR(64)  NULL,
  summary      VARCHAR(255) NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_activity_created (created_at),
  KEY idx_activity_entity (entity_type, entity_id),
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ──────────────────────────────── Media ────────────────────────────────────
CREATE TABLE media (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  storage_key    VARCHAR(120) NOT NULL,          -- folder name inside UPLOAD_DIR
  original_name  VARCHAR(255) NOT NULL,
  kind           ENUM('image','video','icon') NOT NULL,
  mime           VARCHAR(80)  NOT NULL,
  size_bytes     INT UNSIGNED NOT NULL,
  width          SMALLINT UNSIGNED NULL,
  height         SMALLINT UNSIGNED NULL,
  alt            VARCHAR(255) NOT NULL DEFAULT '',
  description    VARCHAR(500) NULL,
  folder         VARCHAR(60)  NOT NULL DEFAULT 'general',
  variants       JSON         NOT NULL,          -- [{w, h, file, bytes}]
  created_by     INT UNSIGNED NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_media_key (storage_key),
  KEY idx_media_folder (folder, created_at),
  FULLTEXT KEY ft_media (original_name, alt, description),
  CONSTRAINT fk_media_user FOREIGN KEY (created_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────── Properties ────────────────────────────────
CREATE TABLE property_categories (
  id     SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name   VARCHAR(80) NOT NULL,
  slug   VARCHAR(80) NOT NULL,
  UNIQUE KEY uq_category_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE properties (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug             VARCHAR(140) NOT NULL,
  title            VARCHAR(160) NOT NULL,
  tagline          VARCHAR(255) NULL,
  summary          VARCHAR(600) NULL,
  description      MEDIUMTEXT   NULL,          -- Markdown
  property_type    VARCHAR(60)  NOT NULL DEFAULT 'Commercial',
  category_id      SMALLINT UNSIGNED NULL,
  developer        VARCHAR(120) NULL,
  location         VARCHAR(160) NULL,
  address          VARCHAR(255) NULL,
  latitude         DECIMAL(9,6) NULL,
  longitude        DECIMAL(9,6) NULL,
  price_amount     DECIMAL(14,2) NULL,
  price_label      VARCHAR(80)  NULL,          -- e.g. "Price on request"
  bedrooms         TINYINT UNSIGNED NULL,
  bathrooms        TINYINT UNSIGNED NULL,
  area             DECIMAL(12,2) NULL,
  area_unit        ENUM('sqft','sqm','acre','sqyd') NOT NULL DEFAULT 'sqft',
  availability     ENUM('available','upcoming','sold_out','on_request') NOT NULL DEFAULT 'available',
  is_featured      TINYINT(1)   NOT NULL DEFAULT 0,
  status           ENUM('draft','published') NOT NULL DEFAULT 'draft',
  main_image_id    INT UNSIGNED NULL,
  seo_title        VARCHAR(160) NULL,
  seo_description  VARCHAR(320) NULL,
  og_image_id      INT UNSIGNED NULL,
  published_at     DATETIME     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_property_slug (slug),
  KEY idx_property_status (status, is_featured),
  KEY idx_property_type (property_type, availability),
  FULLTEXT KEY ft_property (title, location, summary),
  CONSTRAINT fk_property_category FOREIGN KEY (category_id) REFERENCES property_categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_property_main FOREIGN KEY (main_image_id) REFERENCES media (id) ON DELETE SET NULL,
  CONSTRAINT fk_property_og FOREIGN KEY (og_image_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE property_images (
  property_id  INT UNSIGNED NOT NULL,
  media_id     INT UNSIGNED NOT NULL,
  position     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  caption      VARCHAR(160) NULL,
  category     VARCHAR(40)  NULL,             -- gallery filter group
  PRIMARY KEY (property_id, media_id),
  KEY idx_pi_order (property_id, position),
  CONSTRAINT fk_pi_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_media FOREIGN KEY (media_id) REFERENCES media (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE property_amenities (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id  INT UNSIGNED NOT NULL,
  name         VARCHAR(80)  NOT NULL,
  icon         VARCHAR(60)  NULL,
  media_id     INT UNSIGNED NULL,
  position     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_pa_order (property_id, position),
  CONSTRAINT fk_pa_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_media FOREIGN KEY (media_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE property_specs (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id  INT UNSIGNED NOT NULL,
  label        VARCHAR(80)  NOT NULL,
  value        VARCHAR(160) NOT NULL,
  position     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_ps_order (property_id, position),
  CONSTRAINT fk_ps_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────── Pages ──────────────────────────────────
-- Every public URL is a page with an explicit path (keeps legacy URLs intact).
CREATE TABLE pages (
  id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  path                   VARCHAR(190) NOT NULL,
  title                  VARCHAR(200) NOT NULL,
  template               ENUM('home','property','article','legal','standard') NOT NULL DEFAULT 'standard',
  status                 ENUM('draft','published') NOT NULL DEFAULT 'draft',
  visibility             ENUM('public','hidden') NOT NULL DEFAULT 'public',   -- hidden = reachable but excluded from listings/sitemap
  property_id            INT UNSIGNED NULL,
  excerpt                VARCHAR(800) NULL,
  body                   MEDIUMTEXT   NULL,                 -- Markdown (articles, legal, standard)
  cover_media_id         INT UNSIGNED NULL,
  cover_alt              VARCHAR(255) NULL,
  seo_title              VARCHAR(200) NULL,
  seo_description        VARCHAR(320) NULL,
  seo_keywords           VARCHAR(500) NULL,
  canonical_url          VARCHAR(255) NULL,
  og_title               VARCHAR(200) NULL,
  og_description         VARCHAR(320) NULL,
  og_image_id            INT UNSIGNED NULL,
  robots_index           TINYINT(1)   NOT NULL DEFAULT 1,
  robots_follow          TINYINT(1)   NOT NULL DEFAULT 1,
  is_system              TINYINT(1)   NOT NULL DEFAULT 0,   -- cannot be deleted (home, legal)
  published_revision_id  INT UNSIGNED NULL,
  published_at           DATETIME     NULL,
  display_date           DATE         NULL,                 -- article date / legal "last updated"
  sort_order             SMALLINT     NOT NULL DEFAULT 0,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by             INT UNSIGNED NULL,
  UNIQUE KEY uq_pages_path (path),
  UNIQUE KEY uq_pages_property (property_id),
  KEY idx_pages_template (template, status),
  CONSTRAINT fk_pages_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
  CONSTRAINT fk_pages_cover FOREIGN KEY (cover_media_id) REFERENCES media (id) ON DELETE SET NULL,
  CONSTRAINT fk_pages_og FOREIGN KEY (og_image_id) REFERENCES media (id) ON DELETE SET NULL,
  CONSTRAINT fk_pages_user FOREIGN KEY (updated_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Working copy of a page's sections (what editors change)
CREATE TABLE page_sections (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  page_id     INT UNSIGNED NOT NULL,
  type        VARCHAR(40)  NOT NULL,
  label       VARCHAR(120) NULL,
  position    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  enabled     TINYINT(1)   NOT NULL DEFAULT 1,
  data        JSON         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sections_page (page_id, position),
  CONSTRAINT fk_sections_page FOREIGN KEY (page_id) REFERENCES pages (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Immutable published snapshots (page fields + sections). Public site reads these.
CREATE TABLE page_revisions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  page_id       INT UNSIGNED NOT NULL,
  snapshot      JSON         NOT NULL,
  published_by  INT UNSIGNED NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_revisions_page (page_id, created_at),
  CONSTRAINT fk_revisions_page FOREIGN KEY (page_id) REFERENCES pages (id) ON DELETE CASCADE,
  CONSTRAINT fk_revisions_user FOREIGN KEY (published_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE pages
  ADD CONSTRAINT fk_pages_revision FOREIGN KEY (published_revision_id) REFERENCES page_revisions (id) ON DELETE SET NULL;

-- ─────────────────────────────── Navigation ────────────────────────────────
CREATE TABLE navigation_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  location      ENUM('header','footer','legal') NOT NULL,
  parent_id     INT UNSIGNED NULL,
  label         VARCHAR(80)  NOT NULL,
  url           VARCHAR(255) NOT NULL,
  position      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  enabled       TINYINT(1)   NOT NULL DEFAULT 1,
  new_tab       TINYINT(1)   NOT NULL DEFAULT 0,
  dropdown      ENUM('none','articles','properties') NOT NULL DEFAULT 'none',
  KEY idx_nav_order (location, parent_id, position),
  CONSTRAINT fk_nav_parent FOREIGN KEY (parent_id) REFERENCES navigation_items (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────── Settings ─────────────────────────────────
-- Typed values validated in the application layer; secrets never stored in plain text.
CREATE TABLE settings (
  setting_key  VARCHAR(80) NOT NULL PRIMARY KEY,
  value        JSON        NOT NULL,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by   INT UNSIGNED NULL,
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ──────────────────────────────── Inquiries ────────────────────────────────
CREATE TABLE inquiries (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(190) NOT NULL,
  phone          VARCHAR(30)  NOT NULL,
  subject        VARCHAR(120) NULL,
  message        TEXT         NOT NULL,
  property_id    INT UNSIGNED NULL,
  status         ENUM('new','contacted','qualified','follow_up','converted','closed','spam') NOT NULL DEFAULT 'new',
  follow_up_at   DATETIME     NULL,
  assigned_to    INT UNSIGNED NULL,
  source_path    VARCHAR(190) NULL,
  landing_path   VARCHAR(190) NULL,
  referrer_host  VARCHAR(190) NULL,
  utm_source     VARCHAR(100) NULL,
  utm_medium     VARCHAR(100) NULL,
  utm_campaign   VARCHAR(100) NULL,
  visitor_id     CHAR(32)     NULL,
  email_status   ENUM('pending','sent','failed','disabled') NOT NULL DEFAULT 'pending',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_inq_status (status, created_at),
  KEY idx_inq_created (created_at),
  KEY idx_inq_property (property_id),
  FULLTEXT KEY ft_inquiries (name, email, phone, message),
  CONSTRAINT fk_inq_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE SET NULL,
  CONSTRAINT fk_inq_assignee FOREIGN KEY (assigned_to) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE inquiry_notes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inquiry_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NULL,
  note        TEXT         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notes_inquiry (inquiry_id, created_at),
  CONSTRAINT fk_notes_inquiry FOREIGN KEY (inquiry_id) REFERENCES inquiries (id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE inquiry_history (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inquiry_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NULL,
  field       VARCHAR(40)  NOT NULL,
  old_value   VARCHAR(255) NULL,
  new_value   VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_history_inquiry (inquiry_id, created_at),
  CONSTRAINT fk_history_inquiry FOREIGN KEY (inquiry_id) REFERENCES inquiries (id) ON DELETE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────── Analytics ────────────────────────────────
-- Anonymous, first-party. No raw IPs; visitor id is a random value from the browser.
CREATE TABLE analytics_visitors (
  id            CHAR(32)  NOT NULL PRIMARY KEY,
  first_seen_at DATETIME  NOT NULL,
  last_seen_at  DATETIME  NOT NULL,
  session_count INT UNSIGNED NOT NULL DEFAULT 1,
  KEY idx_visitors_first (first_seen_at),
  KEY idx_visitors_last (last_seen_at)
) ENGINE=InnoDB;

CREATE TABLE analytics_sessions (
  id             CHAR(32)     NOT NULL PRIMARY KEY,
  visitor_id     CHAR(32)     NOT NULL,
  is_returning   TINYINT(1)   NOT NULL DEFAULT 0,
  started_at     DATETIME     NOT NULL,
  last_activity_at DATETIME   NOT NULL,
  landing_path   VARCHAR(190) NOT NULL,
  exit_path      VARCHAR(190) NOT NULL,
  pageviews      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  engaged_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  source_type    ENUM('direct','organic','social','referral','campaign','email') NOT NULL DEFAULT 'direct',
  referrer_host  VARCHAR(190) NULL,
  utm_source     VARCHAR(100) NULL,
  utm_medium     VARCHAR(100) NULL,
  utm_campaign   VARCHAR(100) NULL,
  device_type    ENUM('desktop','mobile','tablet') NOT NULL DEFAULT 'desktop',
  browser        VARCHAR(40)  NULL,
  os             VARCHAR(40)  NULL,
  screen_bucket  VARCHAR(20)  NULL,
  region         VARCHAR(60)  NULL,           -- from browser time zone, e.g. "Asia/Kolkata"
  KEY idx_sessions_started (started_at),
  KEY idx_sessions_visitor (visitor_id),
  CONSTRAINT fk_asess_visitor FOREIGN KEY (visitor_id) REFERENCES analytics_visitors (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE analytics_pageviews (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  CHAR(32)     NOT NULL,
  visitor_id  CHAR(32)     NOT NULL,
  path        VARCHAR(190) NOT NULL,
  title       VARCHAR(200) NULL,
  engaged_ms  INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL,
  KEY idx_pv_created (created_at),
  KEY idx_pv_path (path, created_at),
  KEY idx_pv_session (session_id),
  CONSTRAINT fk_pv_session FOREIGN KEY (session_id) REFERENCES analytics_sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE analytics_events (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  CHAR(32)     NOT NULL,
  visitor_id  CHAR(32)     NOT NULL,
  name        VARCHAR(40)  NOT NULL,   -- form_submit, phone_click, email_click, whatsapp_click, cta_click, …
  path        VARCHAR(190) NOT NULL,
  label       VARCHAR(160) NULL,
  dedupe_key  CHAR(40)     NOT NULL,
  created_at  DATETIME     NOT NULL,
  UNIQUE KEY uq_events_dedupe (dedupe_key),
  KEY idx_events_name (name, created_at),
  KEY idx_events_created (created_at),
  CONSTRAINT fk_ev_session FOREIGN KEY (session_id) REFERENCES analytics_sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB;
