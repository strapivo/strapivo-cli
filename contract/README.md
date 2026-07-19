# Strapivo API compatibility snapshot

`strapivo-openapi.yaml` is the API contract accepted by this CLI. It is a compatibility baseline, not the canonical specification.

Canonical source: [`strapivo/strapivo`](https://github.com/strapivo/strapivo), `docs/api/openapi.yaml`.

Check another contract against the baseline:

```sh
npm run api:check -- ../strapivo/docs/api/openapi.yaml
```

Update the snapshot only after reviewing API changes and adapting CLI behavior and tests.
