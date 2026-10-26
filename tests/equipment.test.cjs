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

test('the supplied nine products retain their exact ratings within the expanded catalog', () => {
  const originalIds = ['fj11', 'fj135', 'fj15', 'f12', 'f18', 'f25', 'f30', 'f35', 'f40'];
  assert.deepEqual(c.models.filter(model => originalIds.includes(model.id)).map(({ kind, modelNumber, sku, capacity, input, output }) =>
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
  assert.equal(c.acSystems.length, 33);
  assert.equal(c.furnaceSystems.length, 6);
  assert.equal(c.models.length, 20);
});

test('verified additions retain exact model, SKU and rated capacities', () => {
  const originals = new Set(['fj11', 'fj135', 'fj15', 'f12', 'f18', 'f25', 'f30', 'f35', 'f40']);
  assert.deepEqual(c.models.filter(model => !originals.has(model.id)).map(model =>
    [model.modelNumber, model.sku, model.capacity ?? null, model.input ?? null, model.output ?? null]), [
    ['FJX3473M', '9600028598', 13500, null, null],
    ['FJX3573M', '9610007807', 15000, null, null],
    ['FJXM3573M', '9610007865', 15000, null, null],
    ['FJX5557MHP', '9620015926', 15000, null, null],
    ['FJX5557EHP', '9620017216', 15000, null, null],
    ['DFSAD12121', '9108923340', null, 12000, 9120],
    ['DFSD20121', '9108923341', null, 18000, 13680],
    ['DFMD25111', '9600000886', null, 25000, 19000],
    ['DFMD30111', '9600000923', null, 30000, 22800],
    ['DFMDH35111', '9610007792', null, 35000, 25840],
    ['DFLD40121', '9108923366', null, 40000, 30400]
  ]);
});

test('same-capacity variants do not create duplicate lower or higher tiers or change the preferred model', () => {
  assert.equal(new Set(c.acSystems.map(system => system.capacity)).size, c.acSystems.length);
  assert.equal(new Set(c.furnaceSystems.map(system => system.output)).size, c.furnaceSystems.length);
  assert.equal(c.recommendAc(13500).modelNumber, 'FJX5457M');
  assert.equal(c.recommendAc(15000).modelNumber, 'FJX5557M');
  assert.equal(c.recommendFurnace(9120).modelNumber, 'DFSAD12111');
  assert.equal(c.recommendFurnace(30400).modelNumber, 'DFLD40111');
  assert.equal(c.models.filter(model => model.heatPump).length, 2);
  assert.ok(c.models.filter(model => model.heatPump).every(model => model.output === undefined));
});

test('cooling plans use only the three preferred A/C models and preserve every component capacity', () => {
  assert.equal(c.maxAcUnits, 4);
  const byUnits = { 1: [], 2: [], 3: [], 4: [] };
  for (const system of c.acSystems) {
    assert.ok(Number.isInteger(system.unitCount) && system.unitCount >= 1 && system.unitCount <= c.maxAcUnits);
    const items = c.modelsFor(system);
    assert.equal(items.reduce((total, item) => total + item.quantity, 0), system.unitCount);
    assert.equal(items.reduce((total, { model, quantity }) => total + model.capacity * quantity, 0), system.capacity);
    assert.equal(system.approximate, items.some(({ model }) => model.approximate));
    for (const { model, quantity } of items) {
      assert.ok(c.models.includes(model));
      assert.ok(['fj11', 'fj135', 'fj15'].includes(model.id), model.modelNumber + ' is a preferred capacity model');
      assert.ok(Number.isInteger(quantity) && quantity > 0);
    }
    assert.equal(new Set(items.map(({ model }) => model.id)).size, items.length, 'repeated units are merged into one quantity');
    assert.equal(system.staged, system.unitCount > 1);
    byUnits[system.unitCount].push(system.capacity);
  }
  assert.deepEqual(byUnits, {
    1: [11000, 13500, 15000],
    2: [22000, 24500, 26000, 27000, 28500, 30000],
    3: [33000, 35500, 37000, 38000, 39500, 40500, 41000, 42000, 43500, 45000],
    // 4 x FJX5357MHE (44,000) is omitted: 3 x FJX5557M gives more capacity with fewer units.
    4: [46500, 48000, 49000, 50500, 51500, 52000, 53000, 54000, 54500, 55500, 56000, 57000, 58500, 60000]
  });
});

test('every listed combination beats all options with fewer units, so the list rises in capacity', () => {
  c.acSystems.forEach((system, index) => {
    if (index > 0) {
      assert.ok(system.capacity > c.acSystems[index - 1].capacity, system.id + ' increases capacity');
      assert.ok(system.unitCount >= c.acSystems[index - 1].unitCount, system.id + ' never needs fewer units');
    }
    const fewer = c.acSystems.filter(other => other.unitCount < system.unitCount);
    assert.ok(fewer.every(other => other.capacity < system.capacity), system.id + ' is not dominated');
  });
});

test('recommendations match a brute-force search for the fewest units, then the smallest total', () => {
  const preferred = c.models.filter(model => ['fj11', 'fj135', 'fj15'].includes(model.id));
  const options = [];
  (function build(units, start) {
    if (units.length) options.push({ unitCount: units.length, capacity: units.reduce((total, model) => total + model.capacity, 0) });
    if (units.length === c.maxAcUnits) return;
    for (let i = start; i < preferred.length; i++) build([...units, preferred[i]], i);
  })([], 0);
  for (let load = 0.5; load <= 62000; load += 97.3) {
    const fitting = options.filter(option => option.capacity >= load);
    const units = Math.min(...fitting.map(option => option.unitCount));
    const best = fitting.filter(option => option.unitCount === units).sort((a, b) => a.capacity - b.capacity)[0];
    const result = c.recommendAc(load);
    if (!best) { assert.equal(result, null, 'load ' + load); continue; }
    assert.equal(result.unitCount, best.unitCount, 'units for load ' + load);
    assert.equal(result.capacity, best.capacity, 'capacity for load ' + load);
  }
});

test('furnace recommendations remain single listed products sized by delivered output', () => {
  for (const system of c.furnaceSystems) {
    assert.equal(system.unitCount, 1);
    assert.equal(system.components.length, 1);
    const [{ model, quantity }] = c.modelsFor(system);
    assert.equal(quantity, 1);
    assert.ok(c.models.includes(model));
    assert.equal(model.kind, 'furnace');
    assert.equal(system.output, model.output);
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

test('zero load requires no equipment and demand beyond four units does not invent a larger plan', () => {
  assert.equal(c.recommendAc(0), null);
  assert.equal(c.recommendFurnace(0), null);
  assert.equal(c.recommendAc(60000.01), null);
  assert.equal(c.recommendFurnace(30400.01), null);
});

test('one fitting unit is preferred, then the smallest fitting combination with the fewest units', () => {
  for (const [load, capacity, components] of [
    [15000, 15000, [['FJX5557M', 1]]],
    [15000.01, 22000, [['FJX5357MHE', 2]]],
    [22000, 22000, [['FJX5357MHE', 2]]],
    [22000.01, 24500, [['FJX5357MHE', 1], ['FJX5457M', 1]]],
    [24500, 24500, [['FJX5357MHE', 1], ['FJX5457M', 1]]],
    [24500.01, 26000, [['FJX5357MHE', 1], ['FJX5557M', 1]]],
    [26000, 26000, [['FJX5357MHE', 1], ['FJX5557M', 1]]],
    [26000.01, 27000, [['FJX5457M', 2]]],
    [27000, 27000, [['FJX5457M', 2]]],
    [27000.01, 28500, [['FJX5457M', 1], ['FJX5557M', 1]]],
    [28500, 28500, [['FJX5457M', 1], ['FJX5557M', 1]]],
    [28500.01, 30000, [['FJX5557M', 2]]],
    [30000, 30000, [['FJX5557M', 2]]],
    [30000.01, 33000, [['FJX5357MHE', 3]]],
    [33000.01, 35500, [['FJX5357MHE', 2], ['FJX5457M', 1]]],
    [39500, 39500, [['FJX5357MHE', 1], ['FJX5457M', 1], ['FJX5557M', 1]]],
    [40000, 40500, [['FJX5457M', 3]]],
    [44000, 45000, [['FJX5557M', 3]]],
    [45000, 45000, [['FJX5557M', 3]]],
    [45000.01, 46500, [['FJX5357MHE', 3], ['FJX5457M', 1]]],
    [53500, 54000, [['FJX5457M', 4]]],
    [60000, 60000, [['FJX5557M', 4]]]
  ]) {
    const system = c.recommendAc(load);
    assert.equal(system.capacity, capacity, 'cooling load ' + load);
    assert.deepEqual(c.modelsFor(system).map(({ model, quantity }) => [model.modelNumber, quantity]), components);
    assert.equal(system.unitCount, components.reduce((total, [, quantity]) => total + quantity, 0));
    assert.equal(system.detail, components.map(([modelNumber, quantity]) => quantity + ' × ' + modelNumber).join(' + ').replace(/^1 × (\S+)$/, '$1'));
  }
  assert.equal(c.recommendAc(60000.01), null);
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
  assert.equal(c.recommendAc(22000).approximate, true);
  assert.equal(c.recommendAc(24500).approximate, true);
  assert.equal(c.recommendAc(26000).approximate, true);
  assert.equal(c.recommendAc(27000).approximate, false);
  assert.equal(c.recommendAc(30000).approximate, false);
});

test('increasing loads select equal or greater capacity until the supplied catalog is exceeded', () => {
  let lastAc = 0, lastHeat = 0;
  for (let load = .1; load <= 70000; load += 137.27) {
    const ac = c.recommendAc(load);
    if (ac) {
      assert.ok(ac.capacity >= load && ac.capacity >= lastAc);
      lastAc = ac.capacity;
    } else assert.ok(load > 60000);
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
    assert.ok(['2026-10-20', '2026-10-26'].includes(model.checkedAt));
    for (const key of ['productUrl', 'ratingSourceUrl', 'listingSourceUrl']) {
      const url = new URL(model[key]);
      assert.equal(url.protocol, 'https:');
      assert.ok(['www.dometic.com', 'media.dometic.com', 'documents.dometic.com'].includes(url.hostname));
    }
    if (model.kind === 'furnace') assert.match(model.ratingSourceUrl, /81453\.pdf#page=7$/);
    assert.ok(model.ratingBasis.length > 10 && model.configuration.length > 10);
    assert.equal(Object.hasOwn(model, 'inStock'), false);
  }
});

test('every product has a local image with matching alt text and manufacturer attribution', () => {
  const imageDirectory = path.join(__dirname, '..', 'assets', 'products') + path.sep;
  for (const model of c.models) {
    const filename = path.resolve(__dirname, '..', model.imageSrc);
    assert.ok(filename.startsWith(imageDirectory), model.modelNumber + ' uses a local product asset');
    const data = fs.readFileSync(filename);
    if (filename.endsWith('.png')) {
      assert.deepEqual(data.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      assert.ok(data.readUInt32BE(16) > 0 && data.readUInt32BE(20) > 0);
    } else {
      assert.ok(filename.endsWith('.webp'), model.modelNumber + ' has a supported product image');
      assert.equal(data.toString('ascii', 0, 4), 'RIFF');
      assert.equal(data.toString('ascii', 8, 12), 'WEBP');
    }
    assert.ok(model.imageAlt.includes(model.modelNumber));
    assert.match(model.imageNote, /Dometic/);
  }
});

test('the inline catalog is immutable and works in a browser without CommonJS or network calls', () => {
  assert.throws(() => { c.models[0].capacity = 1; }, TypeError);
  assert.throws(() => { c.acSystems[0].components[0].quantity = 2; }, TypeError);
  const browser = {};
  vm.runInNewContext(source, browser);
  assert.equal(browser.RVBTUEquipment.recommendFurnace(20000).modelNumber, 'DFMD30121');
  assert.equal(browser.RVBTUEquipment.recommendAc(13800).capacity, 15000);
  assert.equal(browser.RVBTUEquipment.recommendAc(30000).capacity, 30000);
  assert.equal(browser.RVBTUEquipment.recommendAc(30000.01).capacity, 33000);
  assert.equal(browser.RVBTUEquipment.recommendAc(60000).capacity, 60000);
  assert.equal(browser.RVBTUEquipment.recommendAc(60000.01), null);
});
