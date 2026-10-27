/// <reference path="../.sst/platform/config.d.ts" />

/**
 * O único lugar do projeto que sai do vocabulário do SST.
 *
 * `sst.cloudflare.binding()` cobre 13 tipos de binding e Analytics Engine não é
 * um deles, então o binding é acrescentado direto no recurso do Pulumi que o
 * componente cria. Se o SST passar a suportá-lo, é este arquivo que morre.
 *
 * O dataset não é criado aqui: a Cloudflare o cria sozinha na primeira escrita,
 * então tudo que existe do lado da infra é o nome.
 */
export function bindAnalytics(name: string, dataset: string) {
  return (args: cloudflare.WorkersScriptArgs): undefined => {
    args.bindings = $output(args.bindings).apply((bindings) => [
      ...(bindings ?? []),
      { type: 'analytics_engine', name, dataset },
    ]);
  };
}
