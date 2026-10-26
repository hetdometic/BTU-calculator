'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));
const tags = pattern => [...head.matchAll(pattern)].map(match => match[0]);
const attr = (tag, name) => tag.match(new RegExp('\\b' + name + '="([^"]*)"'))?.[1];
const meta = (key, value) => attr(tags(new RegExp('<meta\\b[^>]*' + key + '="' + value + '"[^>]*>', 'g'))[0] ?? '', 'content');
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function pngSize(data) {
  assert.deepEqual(data.subarray(0, 8), PNG);
  return data.readUInt32BE(16) + 'x' + data.readUInt32BE(20);
}
function linked(rel, match = () => true) {
  const tag = tags(/<link\b[^>]*>/g).find(link => attr(link, 'rel') === rel && match(link));
  assert.ok(tag, 'the page declares a ' + rel + ' link');
  return path.join(root, attr(tag, 'href'));
}

test('the favicon set resolves to local files at their declared sizes', () => {
  const ico = fs.readFileSync(linked('icon', link => attr(link, 'href').endsWith('.ico')));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1, 'ICO type');
  const sizes = [];
  for (let i = 0; i < ico.readUInt16LE(4); i++) {
    const entry = 6 + i * 16, size = ico.readUInt8(entry) || 256, offset = ico.readUInt32LE(entry + 12);
    assert.equal(pngSize(ico.subarray(offset, offset + ico.readUInt32LE(entry + 8))), size + 'x' + size);
    sizes.push(size);
  }
  assert.ok(sizes.includes(16) && sizes.includes(32), 'favicon.ico holds 16 and 32 px images');
  const svg = fs.readFileSync(linked('icon', link => attr(link, 'type') === 'image/svg+xml'), 'utf8');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">/);
  assert.equal(pngSize(fs.readFileSync(linked('apple-touch-icon'))), '180x180');
});

test('the web manifest matches the page and lists existing 192 and 512 px icons', () => {
  const file = linked('manifest');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(manifest.name && manifest.short_name && manifest.start_url && manifest.display);
  assert.equal(manifest.theme_color, meta('name', 'theme-color'));
  for (const icon of manifest.icons) assert.equal(pngSize(fs.readFileSync(path.join(path.dirname(file), icon.src))), icon.sizes, icon.src);
  assert.deepEqual([...new Set(manifest.icons.map(icon => icon.sizes))], ['192x192', '512x512']);
});

test('title, description and Open Graph tags describe the page consistently', () => {
  const title = head.match(/<title>([^<]+)<\/title>/)[1];
  assert.match(title, /Dometic/);
  const description = meta('name', 'description');
  assert.ok(description.length >= 50 && description.length <= 160, 'description length ' + description.length);
  assert.equal(meta('property', 'og:title'), title);
  assert.equal(meta('property', 'og:description'), description);
  assert.equal(meta('property', 'og:type'), 'website');
  assert.ok(meta('property', 'og:site_name'));
});
