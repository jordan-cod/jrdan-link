export interface RedirectEnv {
  LINKS: KVNamespace;
}

export interface AdminEnv {
  LINKS: KVNamespace;
  BASE_URL: string;
  ADMIN_API_KEY: string;
  CF_ZONE_ID?: string;
  CF_API_TOKEN?: string;
}
