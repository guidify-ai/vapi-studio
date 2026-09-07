# UI and API identity

Hard rules for Studio UI ↔ Nest APIs and durable records. Applies to framework Studio SPA, app-served JSON, and any new FE surface.

## Rules (summary)

1. **External comms use UUID only** — paths, query params, request/response bodies, links, and client state identify records by `uuid`. Never send or accept numeric/`bigint` `id` from the FE (or any external client).
2. **BE stores `id` + `uuid`** — every durable entity has an internal integer/`bigint` primary key (`id`) for joins, filters, sorts, and indexes, and a unique `uuid` for all external identity. Services may use `id` internally; repositories that face HTTP resolve by `uuid`.
3. **Every exposed entity has a human `label`** — API DTOs return `label` so the UI can title rows, breadcrumbs, and headings **without** printing UUIDs. Prefer `label` in the UI; use `uuid` only as the opaque key (URL segment, React key, fetch param).

## Field contract

| Layer | Internal PK | External id | Human display |
| --- | --- | --- | --- |
| DB / TypeORM | `id` (`bigint` / serial) | `uuid` (unique, indexed) | `label` (varchar) and/or derived DTO `label` |
| HTTP JSON | **omit** | `uuid` | `label` (required on list + detail) |
| Studio UI | never | URL + API only | always show `label` |

Do **not** name the external field `id` in new APIs. Use `uuid` so clients never confuse it with the internal key.

```json
{
  "uuid": "4a13e554-972b-4713-b208-15b71bff0493",
  "label": "Sample Studio · ACTIVE · Sep 6, 1:30 PM",
  "status": "ACTIVE"
}
```

```http
GET /conversations/api/:uuid
```

Not: `GET /conversations/api/42` or `{ "id": 42 }`.

## Labels

- **Stable enough to read** — short title a human understands (project name, caller display, “Studio call · ended”, channel + time).
- **Not a dump of the UUID** — never use the raw uuid string as `label`.
- **Computed OK** — if there is no stored column, the service may build `label` when mapping to the DTO (must still always be present on FE responses).
- **UI rule** — list rows, page titles, and toasts use `label`; monospace UUID only in operator “copy id” / debug affordances if needed.

## Backend practice

- Joins, `ORDER BY`, range filters, analytics aggregations → `id` (and indexed columns).
- `findByUuid` / route params → `uuid`.
- Never leak `id` in JSON, logs meant for operators who share URLs, or Vapi-facing payloads that the FE might echo.
- Nested resources: parent and child both identified by `uuid` in URLs (`/…/:conversationUuid/events/:eventUuid`).

## Migration note

Older tables may still use UUID as `@PrimaryGeneratedColumn('uuid')` named `id`. Treat that as transitional: new entities follow `id` + `uuid` + `label`; when touching persistence for an existing entity, migrate toward this shape and rename API fields to `uuid` + `label` in the same change.
