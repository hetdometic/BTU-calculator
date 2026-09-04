const assert = require('node:assert/strict');
const core = require('./dometic-core-v2.js');

const base = {
  length: 28, width: 8, height: 8, slides: 1,
  wallR: 6, roofR: 7, floorR: 5, doorR: 2.5,
  windowArea: 80, windowU: 1.1, shgc: 0.70, ach: 0.75,
  coolOutdoor: 95, outdoorRh: 55, heatOutdoor: 20,
  coolIndoor: 75, indoorRh: 50, heatIndoor: 68,
  ventilationCfm: 0, coolDuctLoss: 0.08, heatDuctLoss: 0.08,
  internalWatts: 175, internalDuty: 1, altitude: 1000,
  people: 2, sun: { roof: 10, wall: 3, window: 60 }
};

const scenario = (overrides = {}, variant = 'expected') => core.calculateScenario({ ...base, ...overrides }, variant);
const all = (overrides = {}) => core.calculateAll({ ...base, ...overrides });

assert.equal(core.LINEUP_AS_OF, '2026-09-04');
assert.deepEqual(core.baseAcUnits.map(x => x.capacity), [11000, 13500, 15000]);
assert.deepEqual(core.furnaceSystems.map(x => x.output), [12000, 18000, 25000, 30000, 35000, 40000]);
assert(core.furnaceSystems.every(x => x.family === 'Furnace Essential'));

assert.equal(core.recommendAc(1).capacity, 11000);
assert.equal(core.recommendAc(15000).capacity, 15000);
assert.equal(core.recommendAc(15001).capacity, 22000);
assert.equal(core.recommendAc(22001).capacity, 24500);
assert.equal(core.recommendAc(30001).capacity, 33000);
assert.equal(core.recommendAc(45000).capacity, 45000);
assert.equal(core.recommendAc(45001), null);
assert.equal(new Set(core.acSystems.map(x => x.capacity)).size, core.acSystems.length);

assert.equal(core.recommendFurnace(12000).output, 12000);
assert.equal(core.recommendFurnace(12001).output, 18000);
assert.equal(core.recommendFurnace(18001).output, 25000);
assert.equal(core.recommendFurnace(30401).output, 35000);
assert.equal(core.recommendFurnace(35001).output, 40000);
assert.equal(core.recommendFurnace(40001), null);

assert(Math.abs(core.atmosphericPressureKpa(0) - 101.325) < 0.001);
assert(core.atmosphericPressureKpa(5000) < core.atmosphericPressureKpa(0));
assert(core.atmosphericPressureKpa(10000) < core.atmosphericPressureKpa(5000));
assert(core.airDensityRatio(70, 10000) < core.airDensityRatio(70, 0));
assert(core.humidityGrains(95, 55, 10000) > core.humidityGrains(95, 55, 0));
assert(Number.isFinite(core.humidityGrains(125, 100, 14000)));

assert.equal(core.distributionLossAdder(9200, 0), 0);
assert.equal(core.distributionLossAdder(9200, 0.08), 800);
assert.equal(Math.round(core.distributionLossAdder(7500, 0.25)), 2500);

const g0 = scenario({ slides: 0 }).geometry;
const g3 = scenario({ slides: 3 }).geometry;
assert.equal(g0.doorArea, 18);
assert.equal(g3.doorArea, 18);
assert.equal(g3.volume, g3.floorArea * base.height);
assert(g3.floorArea > g0.floorArea);

const normal = scenario();
assert(normal.coolingTotal > 0 && normal.heatingTotal > 0);
assert(scenario({ coolOutdoor: 105 }).coolingTotal > normal.coolingTotal);
assert(scenario({ heatOutdoor: 0 }).heatingTotal > normal.heatingTotal);
assert(scenario({ people: 6 }).coolingTotal > normal.coolingTotal);
assert(scenario({ windowArea: 140 }).coolingTotal > normal.coolingTotal);
assert(scenario({ ventilationCfm: 50 }).heatingTotal > normal.heatingTotal);
assert(scenario({ wallR: 10, roofR: 14, floorR: 10 }).heatingTotal < normal.heatingTotal);
assert(scenario({ wallR: 10, roofR: 14, floorR: 10 }).coolingTotal < normal.coolingTotal);
assert(scenario({ altitude: 10000 }).cooling.outsideAirSensible < normal.cooling.outsideAirSensible);
assert(scenario({ altitude: 10000 }).heating.outsideAir < normal.heating.outsideAir);

const ranges = all();
assert(ranges.low.cooling < ranges.expected.cooling && ranges.expected.cooling < ranges.high.cooling);
assert(ranges.low.heating < ranges.expected.heating && ranges.expected.heating < ranges.high.heating);

const recs = core.recommendationSummary(ranges);
assert.equal(recs.acExpected.capacity, 13500);
assert.equal(recs.furnaceExpected.output, 18000);
assert(recs.acHigh.capacity >= ranges.high.cooling);
assert(recs.furnaceHigh.output >= ranges.high.heating);

assert.throws(() => scenario({ wallR: 0 }), /R-values/);
assert.throws(() => scenario({ width: 0 }), /dimensions/);
assert.throws(() => scenario({ outdoorRh: 101 }), /humidity/i);
assert.throws(() => scenario({ coolDuctLoss: 0.5 }), /Duct\/distribution/);
assert.throws(() => scenario({ altitude: 25000 }), /Altitude/);
assert.doesNotThrow(() => scenario({ people: 0, ventilationCfm: 0, outdoorRh: 100, altitude: 14000 }));

console.log(`PASS: ${core.acSystems.length} A/C capacity plans, ${core.furnaceSystems.length} Essential furnace classes, representative load ${ranges.expected.cooling}/${ranges.expected.heating} BTU/hr.`);
