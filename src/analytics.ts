/**
 * Cliques vão pro Workers Analytics Engine, não pro D1.
 *
 * É a mesma forma que Bitly (Kafka → ClickHouse) e Dub (Tinybird) usam, em
 * miniatura: o clique é um evento, não um contador. Ninguém incrementa nada, e
 * por isso não existe escrita concorrente pra se perder.
 *
 * A escrita é não-bloqueante: não custa latência ao redirect. Ler os cliques é
 * uma query SQL pela API da Cloudflare, que ninguém faz ainda.
 */
export function recordClick(
  dataset: AnalyticsEngineDataset,
  slug: string,
  country: string | null,
  referer: string | null,
): void {
  dataset.writeDataPoint({
    // index1 é a chave de amostragem: agrupa o histórico de um link.
    indexes: [slug],
    blobs: [slug, country ?? '', referer ?? ''],
  });
}
