'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('../calculator.js');
const fixture = require('./legacy-no-slide.json');
const base = { ...fixture.cases[1].inputs, slideOuts: [] };
const slide = { lengthFt: 10, depthFt: 3, heightFt: 6.5, outerWindowAreaFt2: 20, side: 'left', offsetFt: 0 };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const calculate = (slides = [slide], overrides = {}, variant = 'expected') => engine.calculateScenario({ ...base, ...overrides, slideOuts: slides }, variant);
const net = (slides = [slide], overrides = {}, variant = 'expected') => calculate(slides, overrides, variant).slideContribution;

for (const [index, entry] of fixture.cases.entries()) {
  for (const variant of ['low', 'expected', 'high']) test(`original no-slide case ${index + 1}, ${variant}: exact numerical regression`, () => {
    const actual = engine.calculateScenario(entry.inputs, variant);
    const expected = entry.expected[variant];
    for (const key of ['coolingTotal', 'heatingTotal', 'cooling', 'heating', 'air']) assert.deepEqual(actual[key], expected[key]);
    for (const [key, value] of Object.entries(expected.geometry)) assert.equal(actual.geometry[key], value);
  });
}

test('10 × 3 × 6.5 slide has exactly three exterior walls and one attachment opening', () => {
  assert.deepEqual(engine.calculateSlideGeometry(slide, base), {
    addedFloorFt2: 30, addedVolumeFt3: 195, roofFt2: 30, undersideFt2: 30,
    outerWallFt2: 65, endWallsFt2: 39, grossVerticalFt2: 104,
    windowAreaFt2: 20, opaqueVerticalFt2: 84, attachmentOpeningFt2: 65,
    grossEnvelopeFt2: 164, netAddedEnvelopeFt2: 99, sealPerimeterFt: 33
  });
});
test('research winter example: independently calculated UA delta is 1,817.14 BTU/hr before air and duct allowance', () => {
  const s = { ...slide, wallR: 7, roofR: 7, floorR: 5, windowU: 1, thermalBridgeFactor: 1.15 };
  const r = calculate([s], { wallR: 7, roofR: 7, floorR: 5, ach: 0, heatIndoor: 70, heatOutdoor: 20, heatDuctLoss: 0 });
  const expected = (1.15 * (84 / 7 + 30 / 7 + 30 / 5) + 20 - 65 / 7) * 50;
  close(r.slideContribution.heatingTotal, 1817.142857142857);
  close(r.slideContribution.heatingTotal, expected);
  close(r.slideResults[0].removedMainWall.heating, 65 / 7 * 50);
});
test('operating seal CFM uses the same altitude and temperature corrected air coefficients as the main RV', () => {
  const bare = calculate([slide]);
  const leaky = calculate([{ ...slide, extraLeakageCfm: 5 }]);
  close(leaky.heatingTotal - bare.heatingTotal, 1.08 * bare.air.heatDensity * 5 * 48 * 1.08);
  const humidityDelta = Math.max(0, engine.humidityGrains(95, 55, 1000) - engine.humidityGrains(75, 50, 1000));
  const sensible = 1.08 * bare.air.coolDensity * 5 * 20;
  const latent = .68 * bare.air.coolDensity * 5 * humidityDelta;
  close(leaky.coolingTotal - bare.coolingTotal, (sensible + latent) * 1.08);
});
test('added-volume ACH is applied once and intentional ventilation is not multiplied by slide count', () => {
  const r = calculate([slide], { ach: .8, ventilationCfm: 20 });
  close(r.slideResults[0].infiltrationCfm, .8 * 195 / 60);
  close(r.geometry.infiltrationCfm, .8 * (base.length * base.width * base.height + 195) / 60);
  close(calculate([slide], { ventilationCfm: 100 }).slideContribution.coolingTotal, net().coolingTotal);
});
test('slide height determines added volume independently of RV height', () => {
  const r = calculate([slide]);
  assert.equal(r.geometry.volume, base.length * base.width * base.height + 195);
  assert.equal(r.geometry.floorArea, base.length * base.width + 30);
});
test('surface accounting removes openings and glazing exactly once', () => {
  const r = calculate([{ ...slide, end1WindowAreaFt2: 3, end2WindowAreaFt2: 4 }]);
  const mainGross = 2 * (base.length + base.width) * base.height;
  assert.equal(r.geometry.wallArea, mainGross - 18 - base.windowArea - 65 + 104 - 27);
  assert.equal(r.geometry.windowArea, base.windowArea + 27);
  assert.equal(r.geometry.attachmentOpeningArea, 65);
  assert.equal(r.geometry.roofArea, base.length * base.width + 30);
  assert.equal(r.geometry.slideUndersideArea, 30);
});
test('slide-glass transfer from main window input preserves physical glazing instead of doubling it', () => {
  const moved = calculate([{ ...slide, depthFt: 1e-8 }], { windowArea: base.windowArea - 20, ach: 0 });
  const original = calculate([], { ach: 0 });
  assert.equal(moved.geometry.windowArea, original.geometry.windowArea);
  close(moved.heatingTotal, original.heatingTotal, 1e-7);
  close(moved.coolingTotal, original.coolingTotal, 1e-7);
});
test('zero-depth limit cancels the replacement wall rather than leaving a phantom fourth wall', () => {
  const r = net([{ ...slide, depthFt: 1e-9, outerWindowAreaFt2: 0 }], { ach: 0 });
  assert.ok(Math.abs(r.heatingTotal) < 1e-5);
  assert.ok(Math.abs(r.coolingTotal) < 1e-5);
});
test('retracted slide contributes no deployed surfaces, glazing, volume, or leakage', () => {
  const inactive = calculate([{ ...slide, deployed: false, extraLeakageCfm: 50 }]);
  const original = calculate([]);
  assert.deepEqual(inactive.cooling, original.cooling);
  assert.deepEqual(inactive.heating, original.heating);
  assert.deepEqual(inactive.geometry, original.geometry);
  assert.deepEqual(inactive.slideContribution, { coolingTotal: 0, heatingTotal: 0 });
  assert.equal(inactive.slideResults[0].geometry, null);
});
test('two identical opposing slides add exactly twice the independent load in all scenarios', () => {
  for (const variant of ['low', 'expected', 'high']) {
    const one = net([slide], {}, variant);
    const two = net([slide, { ...slide, side: 'right' }], {}, variant);
    close(two.heatingTotal, 2 * one.heatingTotal);
    close(two.coolingTotal, 2 * one.coolingTotal);
  }
});
test('different slides have independent thermal properties', () => {
  const second = { ...slide, lengthFt: 8, depthFt: 2, wallR: 10, roofR: 14, floorR: 9, windowU: .4, shgc: .3, side: 'right' };
  const both = net([slide, second]);
  close(both.heatingTotal, net([slide]).heatingTotal + net([second]).heatingTotal);
  close(both.coolingTotal, net([slide]).coolingTotal + net([second]).coolingTotal);
});
test('base plus per-slide deltas equals total; total components remain nonnegative', () => {
  for (const variant of ['low', 'expected', 'high']) {
    const r = calculate([slide, { ...slide, side: 'right' }], {}, variant);
    close(r.coolingTotal, r.base.coolingTotal + sum(Object.fromEntries(r.slideResults.map((s, i) => [i, s.coolingTotal]))));
    close(r.heatingTotal, r.base.heatingTotal + r.slideResults.reduce((a, s) => a + s.heatingTotal, 0));
    close(sum(r.cooling), r.coolingTotal);
    close(sum(r.heating), r.heatingTotal);
    for (const component of [...Object.values(r.cooling), ...Object.values(r.heating)]) assert.ok(component >= -1e-8);
  }
});
test('a better replacement wall can produce a signed negative delta; no premature zero clamp', () => {
  const r = calculate([{ ...slide, depthFt: .01, wallR: 100000, roofR: 100000, floorR: 100000, outerWindowAreaFt2: 0 }], { ach: 0 });
  assert.ok(r.slideContribution.heatingTotal < 0);
  assert.ok(r.slideContribution.coolingTotal < 0);
  assert.ok(r.heatingTotal > 0 && r.coolingTotal > 0);
});
test('more effective insulation reduces heating load', () => {
  assert.ok(net([{ ...slide, wallR: 15, roofR: 15, floorR: 15 }]).heatingTotal < net([{ ...slide, wallR: 3, roofR: 3, floorR: 3 }]).heatingTotal);
});
test('infinite-R limit drives each added opaque conductive term toward zero', () => {
  const s = calculate([{ ...slide, wallR: 1e12, roofR: 1e12, floorR: 1e12 }]).slideResults[0];
  assert.ok(s.heating.roof < 1e-7 && s.heating.floor < 1e-7);
  close(s.heating.walls, -s.removedMainWall.heating, 1e-8);
});
test('window-heavy slides and higher U increase heating', () => {
  assert.ok(net([{ ...slide, outerWindowAreaFt2: 50 }]).heatingTotal > net([{ ...slide, outerWindowAreaFt2: 0 }]).heatingTotal);
  assert.ok(net([{ ...slide, windowU: 1.2 }]).heatingTotal > net([{ ...slide, windowU: .4 }]).heatingTotal);
});
test('SHGC zero, no windows, and zero solar fraction eliminate their solar term', () => {
  for (const s of [{ ...slide, shgc: 0 }, { ...slide, outerWindowAreaFt2: 0 }, { ...slide, windowShading: 0 }]) assert.equal(calculate([s]).slideResults[0].cooling.windowSolar, 0);
});
test('roof shade removes solar adder but retains ambient heat conduction', () => {
  const r = calculate([{ ...slide, roofShading: 0 }]).slideResults[0];
  close(r.cooling.roof, 30 / base.roofR * 20);
});
test('additional seal leakage increases both heating and humid cooling', () => {
  const a = net([{ ...slide, extraLeakageCfm: 0 }]);
  const b = net([{ ...slide, extraLeakageCfm: 10 }]);
  assert.ok(b.heatingTotal > a.heatingTotal && b.coolingTotal > a.coolingTotal);
});
test('dry outside air has no latent infiltration penalty', () => {
  assert.equal(calculate([{ ...slide, extraLeakageCfm: 10 }], { outdoorRh: 0 }).slideResults[0].cooling.outsideAirLatent, 0);
});
test('higher altitude decreases the slide sensible air term', () => {
  const sea = calculate([{ ...slide, extraLeakageCfm: 10 }], { altitude: 0 }).slideResults[0];
  const high = calculate([{ ...slide, extraLeakageCfm: 10 }], { altitude: 8000 }).slideResults[0];
  assert.ok(high.heating.outsideAir < sea.heating.outsideAir);
});
test('zero heating temperature difference gives no slide heating demand', () => {
  assert.equal(net([slide], { heatIndoor: 68, heatOutdoor: 70 }).heatingTotal, 0);
});
test('missing slide properties inherit effective main-RV inputs and extra seal leakage defaults to zero', () => {
  const a = calculate([slide]);
  const b = calculate([{ ...slide, wallR: base.wallR, roofR: base.roofR, floorR: base.floorR, windowU: base.windowU, shgc: base.shgc, thermalBridgeFactor: 1, extraLeakageCfm: 0 }]);
  assert.deepEqual(a.slideContribution, b.slideContribution);
  assert.equal(a.geometry.extraSealCfm, 0);
  assert.ok(a.slideResults[0].warnings.some(w => w.includes('Inherited')));
});
test('HVAC supply status only changes advisory, never capacity', () => {
  const a = calculate([{ ...slide, supply: 'direct' }]);
  const b = calculate([{ ...slide, supply: 'mixing' }]);
  assert.deepEqual(a.slideContribution, b.slideContribution);
  assert.ok(b.slideResults[0].warnings.some(w => w.includes('airflow')));
});
test('touching sidewall openings are allowed; opposite sides may share an offset', () => {
  assert.doesNotThrow(() => calculate([slide, { ...slide, offsetFt: 10 }]));
  assert.doesNotThrow(() => calculate([slide, { ...slide, side: 'right' }]));
});

for (const [label, change] of [
  ['zero length', { lengthFt: 0 }], ['negative depth', { depthFt: -1 }], ['excessive depth', { depthFt: 11 }], ['blank required length', { lengthFt: null }],
  ['NaN length', { lengthFt: NaN }], ['infinite depth', { depthFt: Infinity }], ['zero height', { heightFt: 0 }],
  ['too tall', { heightFt: 20 }], ['zero R', { wallR: 0 }], ['negative R', { roofR: -1 }],
  ['zero U', { windowU: 0 }], ['excessive SHGC', { shgc: 1.1 }], ['negative SHGC', { shgc: -.1 }],
  ['negative leakage', { extraLeakageCfm: -1 }], ['infinite leakage', { extraLeakageCfm: Infinity }],
  ['invalid side', { side: 'rear' }], ['invalid supply', { supply: 'magical' }], ['invalid deployed flag', { deployed: 'false' }], ['invalid conditioned flag', { conditioned: 'false' }],
  ['negative offset', { offsetFt: -1 }], ['opening past RV end', { offsetFt: 25 }],
  ['outer glazing larger than wall', { outerWindowAreaFt2: 66 }], ['end glazing larger than its own wall', { end1WindowAreaFt2: 20 }],
  ['negative windows', { end2WindowAreaFt2: -1 }], ['nominal multiplier below one', { thermalBridgeFactor: .5 }],
  ['shading above one', { windowShading: 2 }], ['unconditioned deployed room', { conditioned: false }]
]) test(`validation rejects ${label}`, () => assert.throws(() => calculate([{ ...slide, ...change }]), RangeError));

test('overlapping openings are rejected with an actionable field path', () => {
  assert.throws(() => calculate([slide, { ...slide, offsetFt: 5 }]), e => e instanceof RangeError && e.field === 'slideOuts.1.offsetFt' && /overlapping/.test(e.message));
});
test('main windows cannot occupy walls already removed by attachments', () => {
  assert.throws(() => calculate([slide, { ...slide, side: 'right' }], { windowArea: 500 }), /remaining RV wall area/);
});
test('a numeric slide count cannot silently reintroduce the old approximation', () => {
  assert.throws(() => calculate([], { slides: 2 }), /count alone/);
});
test('invalid arrays and too many slides are rejected', () => {
  assert.throws(() => engine.calculateScenario({ ...base, slideOuts: 2 }), /array/);
  assert.throws(() => calculate(Array.from({ length: 6 }, () => ({ deployed: false }))), /five/);
});
test('invalid variant and parent physics inputs are rejected', () => {
  assert.throws(() => engine.calculateScenario(base, 'typo'), /Choose/);
  for (const extra of [{ length: NaN }, { windowArea: -1 }, { ach: -1 }, { altitude: Infinity }, { coolDuctLoss: .5 }, { sun: { wall: 3, roof: 10, window: NaN } }]) assert.throws(() => calculate([], extra), RangeError);
});
test('calculating never mutates caller data', () => {
  const input = { ...base, slideOuts: [structuredClone(slide)] };
  const original = structuredClone(input);
  const freeze = (o) => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); };
  freeze(input); engine.calculateScenario(input); assert.deepEqual(input, original);
});
test('browser script and CommonJS exports use the identical model', () => {
  const sandbox = {}; vm.runInNewContext(fs.readFileSync(require.resolve('../calculator.js'), 'utf8'), sandbox);
  close(sandbox.RVBTUEngine.calculateScenario(base).coolingTotal, engine.calculateScenario(base).coolingTotal);
});
test('production HTML loads both modules and inline script parses', () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  assert.ok(html.includes('<script src="calculator.js"></script>'));
  assert.ok(html.includes('<script src="slide-outs.js"></script>'));
  assert.ok(!html.includes('advSlides') && !html.includes('areaFactor'));
  for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new vm.Script(script[1]));
});

test('nonfinite derived loads from extreme finite inputs fail explicitly', () => {
  assert.throws(() => calculate([], { length: 1e308, width: 1e308 }), /numerical range/);
});
