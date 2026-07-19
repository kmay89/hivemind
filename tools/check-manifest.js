#!/usr/bin/env node
// Confirms manifest.webmanifest is valid JSON with the fields a PWA manifest
// needs — a malformed manifest fails silently in the browser (no install
// prompt, no error anyone sees). Dev-only.
'use strict';
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'manifest.webmanifest');
const REQUIRED = ['name', 'short_name', 'start_url', 'icons', 'display'];

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
} catch (e) {
  console.error('manifest.webmanifest is not valid JSON:\n' + e.message);
  process.exit(1);
}

const missing = REQUIRED.filter(k => !(k in manifest));
if (missing.length) {
  console.error('manifest.webmanifest is missing required field(s): ' + missing.join(', '));
  process.exit(1);
}
if (!Array.isArray(manifest.icons) || !manifest.icons.length) {
  console.error('manifest.webmanifest\'s "icons" must be a non-empty array');
  process.exit(1);
}
console.log('ok — manifest.webmanifest is valid JSON with the required fields');
