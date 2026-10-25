# ARD-0007: Every release ships an article; every feature carries its reasoning

- **Status:** Accepted
- **Date:** 2026-10-25
- **Tags:** release | docs | process | speckit

## Context

Studio records single decisions in ARDs and single changes in commits and PRs.
Nothing records a **release** as a whole: what a version contains, why each part
is there, what an upgrading app must change, and how the version was tested.
That knowledge lived in chat threads and the maintainer's head.

Four readers need it:

- **App developers** upgrading: what breaks, what to change, what they gain.
- **The public**: articles are published on LinkedIn as well as in the repo.
- **Anyone following the project's evolution**: read in order, the articles show
  how the maintainer's thinking about the framework changed — what was assumed,
  what broke, what was decided instead.
- **Future contributors and SpecKit work (SDD)**: why the framework looks the way
  it does, version by version, so specs build on decisions instead of
  rediscovering them.

A change nobody can explain is a liability: it can't be reviewed against the
constitution, defended in a support thread, or safely removed later.

## Decision

1. **One article per release**, `docs/releases/vX.Y.Z.md`, from
   [`.specify/templates/release-article-template.md`](../../.specify/templates/release-article-template.md).
   It is release notes, upgrade guide, test record, and announcement text in
   one human-readable page. Patch releases get one too (short is fine).
2. **Every feature has reasoning.** Each feature section states **Why** — the
   problem it solves and why this shape — and links its ARD or PR. **A feature
   without reasoning does not ship:** give it reasoning or take it out of the
   release. The article's *Reasoning check* table lists every user-visible
   change against its reason; an empty cell blocks the release.
3. **Written as the release grows.** Each feature PR into `develop` adds or
   updates its section in the upcoming article. At sign-off the maintainer
   reviews the article with the calls ([ARD-0005](./ARD-0005-release-flow.md)
   stage 3).
4. **Required sections:** announcement, summary, one section per feature
   (what / why / trade-offs / reference), how this version was tested
   (automated, app suites, evals, manual calls — including what was *not*
   tested), upgrade guide, reasoning check, open questions.
5. **Open questions block the tag.** Assumptions made while drafting go into
   *Open questions*; the maintainer answers, the article and code are reworked,
   and the section is empty when the release is tagged.
6. **Status line:** `Draft` while on `develop`, `Released YYYY-MM-DD` after
   `npm publish`. The announcement section is the source text for the GitHub
   release and any public post.
7. **No project names.** Articles never name or identify the projects built on
   Studio — not customers, not proofs of concept, not samples, and no details
   that point to one (industry, intention names, counts). Say "projects built on
   Studio". Early versions were proven through such projects; say that, without
   naming them.
8. **Written for a series.** Articles are for `vapi-studio` (app repos don't get
   them). Each opens with *Where we were* — the state and assumptions before the
   release — so it reads on its own years later and the sequence shows the
   evolution. Mistakes and regressions are stated plainly; they are the most
   useful history.
9. **A LinkedIn post per article** (*LinkedIn post* section): plain text, no
   tables or markdown, under 3,000 characters, first person (the maintainer),
   ending with the link to the article on `master`. It tells the story — what
   I believed, what changed my mind, what shipped — not the full feature list.
   Framework first: no company or services promotion, no personal backstory.
10. **Backfill:** versions before ARD-0007 get short retrospective articles,
    marked *Retrospective*, written from commits and ARDs.

## Consequences

- **Positive:** One page answers "what changed and why" per version; upgrades
  come with a checklist; the test record shows what sign-off actually covered;
  SDD gets a version-by-version decision history; reasonless changes are caught
  before release instead of after.
- **Negative / trade-offs:** Each feature PR carries a little writing. A release
  can wait on the article as it waits on sign-off calls.
- **Follow-ups:** `CONTRIBUTING.md` asks feature PRs for their article entry.
  Released articles are not rewritten; corrections go into the next article.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Auto-generated `CHANGELOG.md` from commits | Lists *what*, never *why*; no upgrade guide or test record |
| GitHub release notes only | Outside the repo, invisible to SpecKit and to docs readers; written after the fact |
| ARDs alone | One decision each, not one version; no upgrade path, no test record, no announcement |
| Write the article at tag time | Reasoning is freshest in the feature PR; at tag time it is reconstructed from memory |

## References

- [ARD-0005](./ARD-0005-release-flow.md) — release flow and sign-off
- [`docs/releases/`](../releases/README.md)
