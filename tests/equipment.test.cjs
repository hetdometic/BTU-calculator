'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const c = require('../equipment-catalog.js');

test('a 13,800 BTU/hr cooling load selects a real 15K FJX5557M, never an undersized 13.5K unit', () => {
  const result = c.recommendAc(13800);
  assert.equal(result.capacity, 15000);
  assert.equal(c.modelsFor(result)[0].model.modelNumber, 'FJX5557M');
  assert.equal(c.modelsFor(result)[0].model.sku, '9620015927');
});
test('a 20,000 BTU/hr heating load uses delivered output and selects DFMD30121', () => {
  const result = c.recommendFurnace(20000);
  assert.equal(result.modelNumber, 'DFMD30121');
  assert.equal(result.output, 22800); assert.equal(result.input, 30000);
  assert.notEqual(result.modelNumber, 'DFMD25121');
});
for (const [code, input, output] of [
  ['DFSAD12111', 12000, 9120], ['DFSD20111', 18000, 13680],
  ['DFMD25121', 25000, 19000], ['DFMD30121', 30000, 22800],
  ['DFMDH35121', 35000, 25840], ['DFLD40111', 40000, 30400]
]) test(`official DF manual output regression: ${code}`, () => {
  const model = c.models.find(m => m.modelNumber === code);
  assert.equal(model.input, input); assert.equal(model.output, output);
  assert.match(model.ratingSourceUrl, /81453\.pdf#page=7$/);
});
test('the DFSD20 identifier is not incorrectly interpreted as 20,000 input BTU/hr', () => {
  assert.equal(c.recommendFurnace(13000).modelNumber, 'DFSD20111');
  assert.equal(c.recommendFurnace(13000).input, 18000);
});
test('zero calculated load does not recommend equipment and excess demand does not invent a model', () => {
  assert.equal(c.recommendAc(0), null); assert.equal(c.recommendFurnace(0), null);
  assert.equal(c.recommendAc(45000.01), null); assert.equal(c.recommendFurnace(30400.01), null);
});
for (const bad of [-1, Infinity, NaN, undefined, null, '13800']) test(`invalid catalog load is rejected: ${String(bad)}`, () => {
  assert.throws(() => c.recommendAc(bad), RangeError);
  assert.throws(() => c.recommendFurnace(bad), RangeError);
});
test('every AC capacity boundary uses unrounded load; crossing the boundary selects the next real plan', () => {
  c.acSystems.forEach((plan, i) => {
    assert.equal(c.recommendAc(plan.capacity).id, plan.id);
    assert.equal(c.recommendAc(plan.capacity - .01).id, plan.id);
    assert.equal(c.recommendAc(plan.capacity + .01)?.id ?? null, c.acSystems[i + 1]?.id ?? null);
  });
});
test('every furnace delivered-output boundary uses the next model only when needed', () => {
  c.furnaceSystems.forEach((model, i) => {
    assert.equal(c.recommendFurnace(model.output).modelNumber, model.modelNumber);
    assert.equal(c.recommendFurnace(model.output + .01)?.modelNumber ?? null, c.furnaceSystems[i + 1]?.modelNumber ?? null);
  });
});
test('all single and multi-unit plans contain real catalog components and their summed capacities conserve BTU/hr', () => {
  const capacities = new Set();
  for (const plan of c.acSystems) {
    assert.ok(plan.unitCount >= 1 && plan.unitCount <= 3);
    const items = c.modelsFor(plan);
    assert.equal(items.reduce((sum, { quantity }) => sum + quantity, 0), plan.unitCount);
    assert.equal(items.reduce((sum, { model, quantity }) => sum + model.capacity * quantity, 0), plan.capacity);
    for (const { model } of items) assert.equal(model.kind, 'ac');
    assert.equal(capacities.has(plan.capacity), false); capacities.add(plan.capacity);
    assert.equal(plan.approximate, items.some(({ model }) => model.approximate));
  }
  assert.equal(c.acSystems.at(-1).capacity, 45000);
});
test('30K cooling is a 2 × 15K capacity plan with the real model code, not an invented 30K unit', () => {
  const r = c.recommendAc(30000);
  assert.equal(r.unitCount, 2); assert.match(r.detail, /2 × FJX5557M/);
  assert.equal(c.modelsFor(r)[0].quantity, 2);
});
test('approximately 11K is explicitly approximate, including plans containing that model', () => {
  const r = c.recommendAc(10000);
  assert.equal(r.approximate, true); assert.ok(r.label.startsWith('≈'));
  assert.match(c.modelsFor(r)[0].model.ratingNote, /approximately/);
  assert.equal(c.recommendAc(15000).approximate, false);
  assert.equal(c.recommendAc(22000).approximate, true);
});
test('higher loads never select a smaller nominal capacity or delivered furnace output', () => {
  let lastAc = 0, lastHeat = 0;
  for (let load = .1; load <= 45000; load += 137.27) {
    const ac = c.recommendAc(load);
    assert.ok(ac.capacity >= load && ac.capacity >= lastAc); lastAc = ac.capacity;
    const heat = c.recommendFurnace(load);
    if (heat) { assert.ok(heat.output >= load && heat.output >= lastHeat); lastHeat = heat.output; }
    else assert.ok(load > 30400);
  }
});
test('catalog provenance distinguishes dated official listings from live stock', () => {
  assert.equal(c.models.length, 9);
  const ids = new Set(), skus = new Set();
  for (const model of c.models) {
    assert.equal(ids.has(model.id), false); ids.add(model.id);
    assert.equal(skus.has(model.sku), false); skus.add(model.sku);
    assert.match(model.sku, /^\d{10}$/);
    assert.equal(model.market, 'US'); assert.equal(model.listingStatus, 'listed');
    assert.equal(model.checkedAt, '2026-10-20');
    for (const key of ['productUrl', 'ratingSourceUrl', 'listingSourceUrl']) {
      const url = new URL(model[key]); assert.equal(url.protocol, 'https:');
      assert.ok(url.hostname === 'www.dometic.com' || url.hostname === 'media.dometic.com');
    }
    assert.ok(model.ratingBasis.length > 10 && model.configuration.length > 10);
    assert.equal(Object.hasOwn(model, 'inStock'), false);
  }
});
test('catalog is immutable and works in a browser without CommonJS or runtime network calls', () => {
  assert.throws(() => { c.models[0].capacity = 1; }, TypeError);
  const browser = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../equipment-catalog.js'), 'utf8'), browser);
  assert.equal(browser.RVBTUEquipment.recommendFurnace(20000).modelNumber, 'DFMD30121');
  assert.equal(browser.RVBTUEquipment.recommendAc(13800).capacity, 15000);
});
