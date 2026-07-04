export interface RedirectEnv {
  LINKS: KVNamespace;
  DB: D1Database;
}

export interface AdminEnv {
  LINKS: KVNamespace;
  DB: D1Database;
  BASE_URL: string;
  ADMIN_API_KEY: string;
  CF_ZONE_ID?: string;
  CF_API_TOKEN?: string;
}
