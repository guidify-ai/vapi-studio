# Optional event hooks

`register.ts` may load private modules next to this file (gitignored) that
subscribe to `onStudioEvent`. Without those modules, the app uses the
framework Node bus only.

See `docs/guides/extending-events.md`.
