#!/usr/bin/env node
/**
 * One-time / maintenance codemod: explicit public|private|protected on class members;
 * explicit types on properties when missing (from initializer inference).
 */
import { Project, SyntaxKind, Node } from 'ts-morph';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const project = new Project({
  tsConfigFilePath: path.join(root, 'tsconfig.json'),
});

function hasAccessModifier(node) {
  return (
    node.hasModifier(SyntaxKind.PublicKeyword) ||
    node.hasModifier(SyntaxKind.PrivateKeyword) ||
    node.hasModifier(SyntaxKind.ProtectedKeyword)
  );
}

function ensurePublic(node) {
  if (!hasAccessModifier(node)) {
    node.toggleModifier('public', true);
  }
}

function typeTextFromInitializer(init) {
  if (!init) return null;
  if (init.getKind() === SyntaxKind.TrueKeyword || init.getKind() === SyntaxKind.FalseKeyword) {
    return 'boolean';
  }
  if (Node.isNumericLiteral(init)) return 'number';
  if (Node.isStringLiteral(init)) {
    const parentInit = init.getParent();
    if (
      parentInit &&
      Node.isAsExpression(parentInit) &&
      parentInit.getTypeNode()?.getText() === 'const'
    ) {
      return init.getLiteralText(); // keep literal for `as const` fields
    }
    return 'string';
  }
  const t = init.getType();
  const text = t.getText(init, undefined, undefined);
  if (!text || text === 'any' || text.includes('import(')) return null;
  if (text === 'true' || text === 'false') return 'boolean';
  return text;
}

for (const sf of project.getSourceFiles('src/**/*.ts')) {
  let changed = false;

  for (const cls of sf.getClasses()) {
    for (const member of cls.getMembers()) {
      if (
        Node.isPropertyDeclaration(member) ||
        Node.isMethodDeclaration(member) ||
        Node.isGetAccessorDeclaration(member) ||
        Node.isSetAccessorDeclaration(member) ||
        Node.isConstructorDeclaration(member)
      ) {
        ensurePublic(member);
        changed = true;
      }

      if (Node.isPropertyDeclaration(member) && !member.getTypeNode()) {
        const inferred = typeTextFromInitializer(member.getInitializer());
        if (inferred) {
          member.setType(inferred);
          changed = true;
        }
      }
    }
  }

  if (changed) {
    sf.saveSync();
  }
}

console.log('Access modifiers and property types updated under src/');
