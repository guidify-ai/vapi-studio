#!/usr/bin/env node
/**
 * Runs on `@guidify-ai/vapi-studio` install. Ensures the consuming app has agent-visible
 * pointers to docs/best-practices (Cursor rule + stamped AGENTS.md block).
 *
 * Yarn/npm set INIT_CWD to the project that invoked install.
 */
const fs = require('fs');
const path = require('path');

const pkgRoot = path.resolve(__dirname, '..');
const consumerRoot = path.resolve(process.env.INIT_CWD || process.cwd());
const PKG = '@guidify-ai/vapi-studio';

function isSameDir(a, b) {
  return path.resolve(a) === path.resolve(b);
}

/** Skip when installing the framework package itself. */
if (isSameDir(consumerRoot, pkgRoot)) {
  process.exit(0);
}

/** Skip if this does not look like an app that depends on us. */
const consumerPkgPath = path.join(consumerRoot, 'package.json');
if (!fs.existsSync(consumerPkgPath)) {
  process.exit(0);
}

let consumerPkg;
try {
  consumerPkg = JSON.parse(fs.readFileSync(consumerPkgPath, 'utf8'));
} catch {
  process.exit(0);
}

const deps = {
  ...(consumerPkg.dependencies || {}),
  ...(consumerPkg.devDependencies || {}),
};
if (!deps[PKG]) {
  process.exit(0);
}

const BEGIN = '<!-- VAPI-STUDIO-BEST-PRACTICES:BEGIN -->';
const END = '<!-- VAPI-STUDIO-BEST-PRACTICES:END -->';

const agentsBlock = `${BEGIN}
## Vapi Studio best practices

This app depends on \`@guidify-ai/vapi-studio\`. CLI / coding agents **must** read the
framework best-practice guides before changing conversation copy, agent steps,
listens, extracts, or identity flows:

- \`node_modules/@guidify-ai/vapi-studio/docs/best-practices/README.md\`
- \`node_modules/@guidify-ai/vapi-studio/agent/AGENTS.md\`
- Cursor rule: \`.cursor/rules/vapi-studio-best-practices.mdc\` (installed with the package)

Hard rules (summary): **one CTA per turn**; conversations **must end** (limits always on);
constrained fields **fail closed**; short listen timeouts for digits; never store ASR junk
as PII; soft affirmatives on multi-choice → local re-ask; silent handoffs; analytics
\`funnels[]\` on milestones (omit when standalone); update the matching doc layer in the
same change. Runtime contracts: \`docs/reference/runtime-api.md\`.
${END}
`;

function writeCursorRule() {
  const src = path.join(pkgRoot, 'agent', 'cursor', 'vapi-studio-best-practices.mdc');
  const destDir = path.join(consumerRoot, '.cursor', 'rules');
  const dest = path.join(destDir, 'vapi-studio-best-practices.mdc');
  if (!fs.existsSync(src)) {
    console.warn('[vapi-studio] agent cursor rule template missing; skip');
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('[vapi-studio] wrote', path.relative(consumerRoot, dest) || dest);
}

function upsertAgentsMd() {
  const dest = path.join(consumerRoot, 'AGENTS.md');
  let existing = '';
  if (fs.existsSync(dest)) {
    existing = fs.readFileSync(dest, 'utf8');
  }

  const blockPattern = new RegExp(
    `${escapeRegExp(BEGIN)}[\\s\\S]*?${escapeRegExp(END)}`,
  );

  if (blockPattern.test(existing)) {
    const next = existing.replace(blockPattern, agentsBlock.trim());
    fs.writeFileSync(dest, ensureTrailingNewline(next));
    console.log('[vapi-studio] refreshed AGENTS.md block');
    return;
  }

  if (!existing.trim()) {
    const body = `# Agents\n\nProject-specific agent notes for this app.\n\n${agentsBlock}\n`;
    fs.writeFileSync(dest, body);
    console.log('[vapi-studio] created AGENTS.md');
    return;
  }

  fs.writeFileSync(
    dest,
    ensureTrailingNewline(`${existing.trimEnd()}\n\n${agentsBlock}\n`),
  );
  console.log('[vapi-studio] appended block to AGENTS.md');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureTrailingNewline(s) {
  return s.endsWith('\n') ? s : `${s}\n`;
}

try {
  writeCursorRule();
  upsertAgentsMd();
} catch (err) {
  console.warn('[vapi-studio] install-agent-refs failed (non-fatal):', err.message);
  process.exit(0);
}
