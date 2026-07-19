#!/usr/bin/env node
// Catches a syntax error in the inline gameplay script before it ships — there
// is currently no other compile step between a commit and Netlify serving it
// live. Dev-only; doesn't touch netlify.toml or the deploy path.
'use strict';
const vm = require('vm');
const path = require('path');
const { extractGameScript } = require('./extract-script');

try {
  const script = extractGameScript(path.join(__dirname, '..', 'index.html'));
  new vm.Script(script, { filename: 'index.html (inline script)' });
  console.log('ok — inline script parses cleanly');
} catch (e) {
  console.error('SYNTAX ERROR in the inline script:\n' + (e.stack || e));
  process.exit(1);
}
