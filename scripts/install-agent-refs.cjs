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
- Cursor rule: \`.cursor/rules/ui-and-api-identity.mdc\` (UUID externally; \`id\`+\`uuid\` in DB; human \`label\`)
- Claude Code: \`CLAUDE.md\` + \`.claude/rules/\` (same doctrine; installed with the package)

Hard rules (summary): **one CTA per turn**; conversations **must end** (limits always on);
constrained fields **fail closed**; short listen timeouts for digits; never store ASR junk
as PII; soft affirmatives on multi-choice → local re-ask; silent handoffs; FE uses **uuid**
only (never internal id) and DTOs include human **label**; update the matching doc layer in the
same change. Runtime contracts: \`docs/reference/runtime-api.md\`.
${END}
`;

const CLAUDE_BEGIN = '<!-- VAPI-STUDIO-CLAUDE:BEGIN -->';
const CLAUDE_END = '<!-- VAPI-STUDIO-CLAUDE:END -->';

const claudeBlock = `${CLAUDE_BEGIN}
# Vapi Studio (Claude Code)

Import the shared agent handbook (same content Cursor loads via AGENTS.md):

@node_modules/@guidify-ai/vapi-studio/agent/AGENTS.md

Rules installed by postinstall:

- \`.claude/rules/vapi-studio-best-practices.md\`
- \`.claude/rules/ui-and-api-identity.md\`

Doctrine index: \`node_modules/@guidify-ai/vapi-studio/docs/best-practices/README.md\`.
${CLAUDE_END}
`;

function writeCursorRules() {
  const destDir = path.join(consumerRoot, '.cursor', 'rules');
  fs.mkdirSync(destDir, { recursive: true });
  const files = [
    'vapi-studio-best-practices.mdc',
    'ui-and-api-identity.mdc',
  ];
  for (const name of files) {
    const src = path.join(pkgRoot, 'agent', 'cursor', name);
    const dest = path.join(destDir, name);
    if (!fs.existsSync(src)) {
      console.warn('[vapi-studio] agent cursor rule template missing:', name);
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log('[vapi-studio] wrote', path.relative(consumerRoot, dest) || dest);
  }
}

function writeClaudeRules() {
  const destDir = path.join(consumerRoot, '.claude', 'rules');
  fs.mkdirSync(destDir, { recursive: true });
  const files = [
    'vapi-studio-best-practices.md',
    'ui-and-api-identity.md',
  ];
  for (const name of files) {
    const src = path.join(pkgRoot, 'agent', 'claude', 'rules', name);
    const dest = path.join(destDir, name);
    if (!fs.existsSync(src)) {
      console.warn('[vapi-studio] agent claude rule template missing:', name);
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log('[vapi-studio] wrote', path.relative(consumerRoot, dest) || dest);
  }
}

function upsertMarkdownBlock(destPath, begin, end, block, emptyTitle) {
  let existing = '';
  if (fs.existsSync(destPath)) {
    existing = fs.readFileSync(destPath, 'utf8');
  }

  const blockPattern = new RegExp(
    `${escapeRegExp(begin)}[\\s\\S]*?${escapeRegExp(end)}`,
  );

  if (blockPattern.test(existing)) {
    const next = existing.replace(blockPattern, block.trim());
    fs.writeFileSync(destPath, ensureTrailingNewline(next));
    console.log('[vapi-studio] refreshed', path.basename(destPath), 'block');
    return;
  }

  if (!existing.trim()) {
    fs.writeFileSync(
      destPath,
      ensureTrailingNewline(`${emptyTitle}\n\n${block}\n`),
    );
    console.log('[vapi-studio] created', path.basename(destPath));
    return;
  }

  fs.writeFileSync(
    destPath,
    ensureTrailingNewline(`${existing.trimEnd()}\n\n${block}\n`),
  );
  console.log('[vapi-studio] appended block to', path.basename(destPath));
}

function upsertAgentsMd() {
  upsertMarkdownBlock(
    path.join(consumerRoot, 'AGENTS.md'),
    BEGIN,
    END,
    agentsBlock,
    '# Agents\n\nProject-specific agent notes for this app.',
  );
}

function upsertClaudeMd() {
  upsertMarkdownBlock(
    path.join(consumerRoot, 'CLAUDE.md'),
    CLAUDE_BEGIN,
    CLAUDE_END,
    claudeBlock,
    '# Agents\n\nProject notes for Claude Code. Shared handbook is imported below.',
  );
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureTrailingNewline(s) {
  return s.endsWith('\n') ? s : `${s}\n`;
}

try {
  writeCursorRules();
  writeClaudeRules();
  upsertAgentsMd();
  upsertClaudeMd();
} catch (err) {
  console.warn('[vapi-studio] install-agent-refs failed (non-fatal):', err.message);
  process.exit(0);
}
