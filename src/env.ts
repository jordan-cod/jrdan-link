/**
 * Bindings dos workers, escritos à mão.
 *
 * Dá pra derivar esses tipos da declaração de infra, mas custa um kit inteiro
 * pra economizar doze linhas — e um `Env` errado quebra no primeiro deploy, não
 * em produção seis meses depois.
 */

export interface RedirectEnv {
  Db: D1Database;
  Cache: KVNamespace;
  Analytics: AnalyticsEngineDataset;
}

export interface ApiEnv {
  Db: D1Database;
  Cache: KVNamespace;
  ApiKey: string;
  /** Origem dos links curtos, pra montar o `short_url` da resposta. */
  BASE_URL: string;
}
