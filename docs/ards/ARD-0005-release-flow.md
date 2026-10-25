# ARD-0005: Release flow — sign off on real apps before npm

- **Status:** Accepted
- **Date:** 2026-10-25
- **Tags:** release | process

## Context

0.1.2 shipped a correct Supervisor routing fix that broke a behaviour the
landing-page sample relied on. Nobody noticed: the maintainer-owned apps stayed
on 0.1.1 and only met the new version long after it was public. Unit tests in
this repo cannot catch an app that depended on old behaviour; only the apps can.

A published npm version cannot be changed. The check against real apps has to
happen **before** publish, while the change is still on `develop`.

## Decision

A version moves through five stages. Each stage gates the next.

1. **Develop.** Feature PRs merge into `develop`. The version in `package.json`
   is the *next* version (semver: before 1.0, breaking changes bump the minor).
   **Nothing is published to npm from `develop`.**
2. **Apps on local files.** Every maintainer-owned app that depends on Studio
   points at the local checkout as the next version:
   `"@guidify-ai/vapi-studio": "file:../vapi-studio"` (app Dockerfiles build the
   sibling framework when the dependency is `file:`). Each app is adapted to any
   breaking change, type-checks, builds, and passes its tests against `develop`.
3. **Sign-off.** The maintainer runs the reference apps and makes real calls:
   the **production reference app** and the **landing-page sample**
   (`vapi-studio-sample-landing-llm`) are the required checks. The release is
   **ready** only when the maintainer says so. Defects found here are fixed on
   `develop` (framework) or in the app, then re-checked.
4. **Release.** PR `develop` → `master` (enforced by `master-from-develop.yml`),
   then an annotated tag `vX.Y.Z` on the master merge commit (`tag-on-master.yml`
   removes tags elsewhere), then `npm publish` from a clean checkout of that tag,
   built on the supported Node version.
5. **Apps on the published version.** Immediately after publish, every app
   switches from `file:` to the exact published version (no `^`/`~`), with the
   adaptations from stage 2.

## Consequences

- **Positive:** Breaking changes and behavioural regressions surface in real
  calls before they are public. Apps are never left on an old version.
- **Negative / trade-offs:** A release waits for the maintainer's calls. App
  repos carry `file:` dependencies while a release is in progress, so they can't
  merge to their own release branches until stage 5.
- **Follow-ups:** If an app can't run against `develop` (missing secrets,
  infrastructure), that is a release blocker, not a skip.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Publish, then upgrade apps | How 0.1.2 slipped through; npm versions can't be fixed after the fact |
| Prerelease tags (`0.2.0-rc.1`) on npm | Publishes before sign-off and leaves extra versions on npm; `file:` gives the same check with nothing public |
| CI-only sign-off (app test suites) | App tests passed 0.1.2 for routing they didn't cover; voice behaviour needs a call |

## References

- `.github/workflows/master-from-develop.yml`, `.github/workflows/tag-on-master.yml`
- [CONTRIBUTING.md](../../CONTRIBUTING.md#releases)
