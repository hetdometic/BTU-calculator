'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const inline = html.match(/<script\b[^>]*\bid=["']equipmentCatalog["'][^>]*>([\s\S]*?)<\/script>/i);
assert.ok(inline, 'the fixed equipment catalog is embedded in index.html');
const source = inline[1];
const catalogModule = { exports: {} };
vm.runInThisContext('(function(module, exports) {\n' + source + '\n})', { filename: 'index.html#equipmentCatalog' })(catalogModule, catalogModule.exports);
const c = catalogModule.exports;

test('the supplied nine products and their exact ratings are the complete catalog', () => {
  assert.deepEqual(c.models.map(({ kind, modelNumber, sku, capacity, input, output }) =>
    [kind, modelNumber, sku, capacity ?? null, input ?? null, output ?? null]), [
    ['ac', 'FJX5357MHE', '9620015929', 11000, null, null],
    ['ac', 'FJX5457M', '9620015924', 13500, null, null],
    ['ac', 'FJX5557M', '9620015927', 15000, null, null],
    ['furnace', 'DFSAD12111', '9108923336', null, 12000, 9120],
    ['furnace', 'DFSD20111', '9600001165', null, 18000, 13680],
    ['furnace', 'DFMD25121', '9600000890', null, 25000, 19000],
    ['furnace', 'DFMD30121', '9600000926', null, 30000, 22800],
    ['furnace', 'DFMDH35121', '9610007794', null, 35000, 25840],
    ['furnace', 'DFLD40111', '9108923369', null, 40000, 30400]
  ]);
  assert.equal(c.acSystems.length, 3);
  assert.equal(c.furnaceSystems.length, 6);
});

test('every suggested system is one listed product with quantity one', () => {
  for (const system of [...c.acSystems, ...c.furnaceSystems]) {
    assert.equal(system.unitCount, 1);
    assert.equal(system.components.length, 1);
    const [{ model, quantity }] = c.modelsFor(system);
    assert.equal(quantity, 1);
    assert.ok(c.models.includes(model));
    assert.equal(system.kind === 'furnace' ? system.output : system.capacity,
      model.kind === 'furnace' ? model.output : model.capacity);
  }
});

test('a 13,800 BTU/hr cooling load selects FJX5557M rather than an undersized 13.5K unit', () => {
  const result = c.recommendAc(13800);
  assert.equal(result.capacity, 15000);
  assert.equal(c.modelsFor(result)[0].model.modelNumber, 'FJX5557M');
  assert.equal(c.modelsFor(result)[0].model.sku, '9620015927');
});

test('heating demand uses delivered output rather than fuel input or the model identifier', () => {
  assert.equal(c.recommendFurnace(12000).modelNumber, 'DFSD20111');
  assert.equal(c.recommendFurnace(13000).input, 18000);
  const result = c.recommendFurnace(20000);
  assert.equal(result.modelNumber, 'DFMD30121');
  assert.equal(result.output, 22800);
  assert.equal(result.input, 30000);
  assert.equal(c.recommendFurnace(25000).modelNumber, 'DFMDH35121');
  assert.equal(c.recommendFurnace(25840).modelNumber, 'DFMDH35121');
  assert.equal(c.recommendFurnace(25840.01).modelNumber, 'DFLD40111');
});

test('zero load requires no equipment and excess demand does not invent units or combinations', () => {
  assert.equal(c.recommendAc(0), null);
  assert.equal(c.recommendFurnace(0), null);
  assert.equal(c.recommendAc(15000.01), null);
  assert.equal(c.recommendAc(30000), null);
  assert.equal(c.recommendFurnace(30400.01), null);
});

for (const bad of [-1, Infinity, NaN, undefined, null, '13800']) {
  test('invalid recommendation load is rejected: ' + String(bad), () => {
    assert.throws(() => c.recommendAc(bad), RangeError);
    assert.throws(() => c.recommendFurnace(bad), RangeError);
  });
}

test('every cooling capacity boundary compares the unrounded load', () => {
  c.acSystems.forEach((system, i) => {
    assert.equal(c.recommendAc(system.capacity).id, system.id);
    assert.equal(c.recommendAc(system.capacity - .01).id, system.id);
    assert.equal(c.recommendAc(system.capacity + .01)?.id ?? null, c.acSystems[i + 1]?.id ?? null);
  });
});

test('every delivered heating output boundary compares the unrounded load', () => {
  c.furnaceSystems.forEach((system, i) => {
    assert.equal(c.recommendFurnace(system.output).modelNumber, system.modelNumber);
    assert.equal(c.recommendFurnace(system.output - .01).modelNumber, system.modelNumber);
    assert.equal(c.recommendFurnace(system.output + .01)?.modelNumber ?? null,
      c.furnaceSystems[i + 1]?.modelNumber ?? null);
  });
});

test('the first cooling model keeps its explicitly approximate 11K rating', () => {
  const result = c.recommendAc(10000);
  assert.equal(result.approximate, true);
  assert.ok(result.label.startsWith('\u2248'));
  assert.match(c.modelsFor(result)[0].model.ratingNote, /approximately/);
  assert.equal(c.recommendAc(15000).approximate, false);
});

test('increasing loads select equal or greater capacity until the supplied catalog is exceeded', () => {
  let lastAc = 0, lastHeat = 0;
  for (let load = .1; load <= 45000; load += 137.27) {
    const ac = c.recommendAc(load);
    if (ac) {
      assert.ok(ac.capacity >= load && ac.capacity >= lastAc);
      lastAc = ac.capacity;
    } else assert.ok(load > 15000);
    const heat = c.recommendFurnace(load);
    if (heat) {
      assert.ok(heat.output >= load && heat.output >= lastHeat);
      lastHeat = heat.output;
    } else assert.ok(load > 30400);
  }
});

test('the snapshot retains dated official provenance without implying live stock', () => {
  const ids = new Set(), skus = new Set();
  for (const model of c.models) {
    assert.equal(ids.has(model.id), false); ids.add(model.id);
    assert.equal(skus.has(model.sku), false); skus.add(model.sku);
    assert.match(model.sku, /^\d{10}$/);
    assert.equal(model.market, 'US');
    assert.equal(model.listingStatus, 'listed');
    assert.equal(model.checkedAt, '2026-10-20');
    for (const key of ['productUrl', 'ratingSourceUrl', 'listingSourceUrl']) {
      const url = new URL(model[key]);
      assert.equal(url.protocol, 'https:');
      assert.ok(url.hostname === 'www.dometic.com' || url.hostname === 'media.dometic.com');
    }
    if (model.kind === 'furnace') assert.match(model.ratingSourceUrl, /81453\.pdf#page=7$/);
    assert.ok(model.ratingBasis.length > 10 && model.configuration.length > 10);
    assert.equal(Object.hasOwn(model, 'inStock'), false);
  }
});

test('the inline catalog is immutable and works in a browser without CommonJS or network calls', () => {
  assert.throws(() => { c.models[0].capacity = 1; }, TypeError);
  assert.throws(() => { c.acSystems[0].components[0].quantity = 2; }, TypeError);
  const browser = {};
  vm.runInNewContext(source, browser);
  assert.equal(browser.RVBTUEquipment.recommendFurnace(20000).modelNumber, 'DFMD30121');
  assert.equal(browser.RVBTUEquipment.recommendAc(13800).capacity, 15000);
  assert.equal(browser.RVBTUEquipment.recommendAc(30000), null);
});
