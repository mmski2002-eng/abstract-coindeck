import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dir, '../src/app/globals.css'), 'utf-8');

let pass = 0, fail = 0;

function extractBlock(selector) {
  const idx = css.indexOf(selector);
  if (idx === -1) return '';
  const start = css.indexOf('{', idx) + 1;
  let depth = 1, i = start;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

function getVar(block, name) {
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`);
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function check(label, actual, expected) {
  const ok = actual?.toLowerCase() === expected.toLowerCase();
  console.log(`${ok ? '✓' : '✗'} ${label}: ${actual ?? 'NOT FOUND'} ${ok ? '' : `(expected ${expected})`}`);
  ok ? pass++ : fail++;
}

const root = extractBlock(':root');
const dark = extractBlock('html[data-theme="dark"]');

console.log('\n── :root ──');
check('--ink (light)',   getVar(root, '--ink'),   '#0F1115');
check('--ink-2 (light)', getVar(root, '--ink-2'), '#3A4049');
check('--ink-3 (light)', getVar(root, '--ink-3'), '#7A828D');

console.log('\n── dark theme ──');
check('--ink (dark)',     getVar(dark, '--ink'),     '#E8EEF5');
check('--ink-2 (dark)',   getVar(dark, '--ink-2'),   '#C8D0DA');
check('--ink-3 (dark)',   getVar(dark, '--ink-3'),   '#7A8A99');
check('--paper (dark)',   getVar(dark, '--paper'),   '#0E141A');
check('--outline (dark)', getVar(dark, '--outline'), '#9AA3AE');
check('--shadow-sticker (dark)', getVar(dark, '--shadow-sticker'), '4px 4px 0 #9AA3AE');

console.log(`\n${pass + fail} checks: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
