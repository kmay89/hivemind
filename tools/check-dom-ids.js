#!/usr/bin/env node
// Every `$('someId')` in the inline script should resolve to a real `id="someId"`
// in the markup — nothing enforces that today, so a rename on one side silently
// breaks whatever reads $(id) (returns null, next .property access throws or
// no-ops depending on the call site). This only catches literal string
// arguments — `$(prefix+'Review')`-style dynamic ids aren't statically
// checkable and are skipped. Dev-only; see CLAUDE.md.
'use strict';
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(indexPath, 'utf-8');

const referenced = new Set([...src.matchAll(/\$\(\s*'([a-zA-Z0-9_-]+)'\s*\)/g)].map(m => m[1]));
const declared = new Set([...src.matchAll(/\bid="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));

const missing = [...referenced].filter(id => !declared.has(id)).sort();

console.log(`${referenced.size} referenced $('id') literals, ${declared.size} declared id="…" attributes.`);
if (missing.length) {
  console.error(`\n${missing.length} referenced id(s) have no matching element:`);
  for (const id of missing) console.error(`  - $('${id}')`);
  process.exit(1);
} else {
  console.log('ok — every $(\'id\') literal resolves to a real element');
}
