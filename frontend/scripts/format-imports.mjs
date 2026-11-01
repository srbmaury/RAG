
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');

// Maximum line length for imports and destructured parameters.
const MAX_WIDTH = 240;

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
]);

let updatedFiles = 0;
let updatedImports = 0;
let updatedParameters = 0;

function getScriptKind(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function formatFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  );

  const edits = [];

  function addEdit(start, end, replacement, type) {
    if (content.slice(start, end) === replacement) return;

    edits.push({ start, end, replacement, type });
  }

  function visit(node) {
    // 1. Format named imports.
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      const namedImports = node.importClause.namedBindings;

      const original = content.slice(
        namedImports.getStart(sourceFile),
        namedImports.end,
      );

      if (!original.includes('//') && !original.includes('/*')) {
        const elements = namedImports.elements.map((element) =>
          element.getText(sourceFile),
        );

        const replacement = `{ ${elements.join(', ')} }`;

        if (replacement.length <= MAX_WIDTH) {
          addEdit(
            namedImports.getStart(sourceFile),
            namedImports.end,
            replacement,
            'import',
          );
        }
      }
    }

    // 2. Format destructured function parameters.
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isMethodSignature(node)
    ) {
      for (const parameter of node.parameters) {
        if (!ts.isObjectBindingPattern(parameter.name)) continue;

        const pattern = parameter.name;

        const original = content.slice(
          pattern.getStart(sourceFile),
          pattern.end,
        );

        // Avoid changing patterns containing comments.
        if (original.includes('//') || original.includes('/*')) continue;

        const elements = pattern.elements.map((element) =>
          element.getText(sourceFile),
        );

        const replacement = `{ ${elements.join(', ')} }`;

        if (replacement.length <= MAX_WIDTH) {
          addEdit(
            pattern.getStart(sourceFile),
            pattern.end,
            replacement,
            'parameter',
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Apply edits from the end to avoid shifting source positions.
  edits.sort((a, b) => b.start - a.start);

  let result = content;

  for (const edit of edits) {
    result =
      result.slice(0, edit.start) +
      edit.replacement +
      result.slice(edit.end);

    if (edit.type === 'import') updatedImports++;
    if (edit.type === 'parameter') updatedParameters++;
  }

  if (result !== content) {
    fs.writeFileSync(filePath, result, 'utf8');
    updatedFiles++;

    console.log(`Updated: ${path.relative(ROOT_DIR, filePath)}`);
  }
}

function processDirectory(directory) {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;

      processDirectory(fullPath);
      continue;
    }

    if (EXTENSIONS.has(path.extname(entry.name))) {
      formatFile(fullPath);
    }
  }
}

console.log('Starting formatting...\n');

processDirectory(ROOT_DIR);

console.log('\n------------------------------');
console.log('Formatting completed!');
console.log(`Files updated: ${updatedFiles}`);
console.log(`Imports updated: ${updatedImports}`);
console.log(`Parameters updated: ${updatedParameters}`);
console.log('------------------------------');
