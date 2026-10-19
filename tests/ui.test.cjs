'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

// These are interaction/DOM regressions, not rendered browser or layout checks.
async function app(t) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = await JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: console,
    beforeParse(window) {
      window.structuredClone = structuredClone;
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    }
  });
  t.after(() => { dom.window.close(); assert.deepEqual(errors, [], 'no application script/resource errors'); });
  await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
  const window = dom.window;
  const $ = selector => window.document.querySelector(selector);
  const click = selector => { assert.ok($(selector), selector); $(selector).click(); };
  const fill = (selector, value, event = 'input') => {
    assert.ok($(selector), selector); $(selector).value = String(value);
    $(selector).dispatchEvent(new window.Event(event, { bubbles: true }));
  };
  const api = window.RVBTUCalculator;
  assert.ok(api, 'application initialized');
  return { window, $, click, fill, api };
}
function addSlide(a, index = 0) {
  a.click('#addSlide');
  for (const [field, value] of Object.entries({ lengthFt: 10, depthFt: 3, heightFt: 6.5, outerWindowAreaFt2: 20 })) a.fill(`#slide-${index}-${field}`, value);
}
function apply(a) { a.click('#applySlides'); assert.equal(a.$('#slideError').hidden, true, a.$('#slideError').textContent); }

test('DOM: initial screen has no inferred slides and retains Dometic equipment comparisons', async t => {
  const a = await app(t);
  assert.match(a.window.document.title, /Dometic/);
  assert.match(a.$('h1').textContent, /comfort system/);
  assert.equal(a.api.getState().slideOuts.length, 0);
  assert.equal(a.$('#slideResult').hidden, true);
  assert.equal(a.api.getAcSystems().at(-1).capacity, 45000);
  assert.equal(a.api.getFurnaceSystems().at(-1).output, 30400);
  assert.equal(a.window.document.querySelectorAll('.capacity-card').length, 6);
});
test('DOM: blank measured dimensions are rejected without changing results', async t => {
  const a = await app(t); const before = a.api.getResults().expected.heating;
  a.click('#addSlide'); a.click('#applySlides');
  assert.equal(a.$('#slideError').hidden, false);
  assert.match(a.$('#slideError').textContent, /length/);
  assert.equal(a.window.document.activeElement.id, 'slide-0-lengthFt');
  assert.equal(a.api.getResults().expected.heating, before);
});
test('DOM: measured slide produces floor/volume and both load contributions with visible opening credit', async t => {
  const a = await app(t); addSlide(a); apply(a);
  const r = a.api.getResults().breakdown;
  assert.equal(r.geometry.slideFloorArea, 30); assert.equal(r.geometry.slideVolume, 195);
  assert.equal(r.geometry.attachmentOpeningArea, 65);
  assert.equal(r.geometry.mainWindowArea, 80); assert.equal(r.geometry.windowArea, 100);
  assert.equal(a.$('#slideResult').hidden, false);
  assert.match(a.$('#slideGeometrySummary').textContent, /224 \+ 30 = 254/);
  assert.match(a.$('#slideResultDetails').textContent, /Attachment opening: 65 sq ft removed/);
  assert.match(a.$('#slideLoadSummary').textContent, /Cooling.*Heating/s);
  assert.match(a.$('#slideResultDetails').textContent, /seal leakage is unmeasured/);
});
test('DOM: canceling slide edits and changing equipment mode preserves applied slide dimensions', async t => {
  const a = await app(t); addSlide(a); apply(a); const original = a.api.getResults().expected.heating;
  a.click('#editSlides'); a.fill('#slide-0-depthFt', 4);
  a.click('[data-mode="ac"]'); assert.equal(a.api.getResults().expected.heating, original);
  a.click('#cancelSlides'); assert.equal(a.api.getState().slideOuts[0].depthFt, 3);
  assert.equal(a.$('#heatingResult').hidden, true);
  assert.doesNotMatch(a.$('#slideLoadSummary').textContent, /Heating/);
  a.click('[data-mode="furnace"]'); assert.equal(a.$('#coolingResult').hidden, true);
  assert.doesNotMatch(a.$('#slideLoadSummary').textContent, /Cooling/);
  a.click('[data-mode="both"]'); assert.equal(a.$('#heatingResult').hidden, false); assert.equal(a.$('#coolingResult').hidden, false);
});
test('DOM: overlap and per-face glazing errors open details and focus the offending field', async t => {
  const a = await app(t); addSlide(a); apply(a); addSlide(a, 1);
  a.fill('#slide-1-offsetFt', 5); a.click('#applySlides');
  assert.match(a.$('#slideError').textContent, /overlapping/);
  assert.equal(a.window.document.activeElement.id, 'slide-1-offsetFt');
  assert.equal(a.$('#slide-1-offsetFt').closest('details').open, true);
  a.fill('#slide-1-side', 'right', 'change'); a.fill('#slide-1-offsetFt', 0); a.fill('#slide-1-end1WindowAreaFt2', 20); a.click('#applySlides');
  assert.match(a.$('#slideError').textContent, /exceeds the end wall/);
  a.fill('#slide-1-end1WindowAreaFt2', 0); apply(a);
  assert.equal(a.api.getResults().breakdown.geometry.slideFloorArea, 60);
});
test('DOM: changing thermal, window, shade and leakage inputs reaches the model', async t => {
  const a = await app(t); addSlide(a);
  for (const [field, value] of Object.entries({ wallR: 9, roofR: 12, floorR: 8, windowU: .4, shgc: .2, extraLeakageCfm: 5, end1WindowAreaFt2: 3, end2WindowAreaFt2: 4, windowShading: .5, roofShading: 0, thermalBridgeFactor: 1.2 })) a.fill(`#slide-0-${field}`, value);
  a.fill('#slide-0-supply', 'direct', 'change'); apply(a);
  const r = a.api.getResults().breakdown;
  assert.equal(r.geometry.slideWindowArea, 27); assert.equal(r.geometry.extraSealCfm, 5);
  assert.equal(r.slideResults[0].effective.wallR, 7.5);
  assert.equal(r.slideResults[0].effective.windowU, .4);
  assert.equal(r.slideResults[0].cooling.windowSolar, 27 * .2 * 60 * .5);
});
test('DOM: invalid numeric ranges are rejected before apply', async t => {
  const a = await app(t); addSlide(a); a.fill('#slide-0-extraLeakageCfm', -1); a.click('#applySlides');
  assert.equal(a.$('#slideError').hidden, false); assert.match(a.$('#slideError').textContent, /extra seal leakage/);
  assert.equal(a.api.getState().slideOuts.length, 0);
});
test('DOM: retraction excludes a slide and removing the final slide restores no-slide results', async t => {
  const a = await app(t); const original = a.api.getResults().expected.heating;
  addSlide(a); apply(a);
  a.click('#editSlides'); a.click('.slide-card [data-field="deployed"]'); apply(a);
  assert.equal(a.api.getResults().expected.heating, original);
  assert.match(a.$('#slideAppliedSummary').textContent, /0 deployed of 1/);
  a.click('#editSlides'); a.click('[data-remove="0"]'); apply(a);
  assert.equal(a.api.getState().slideOuts.length, 0);
  assert.equal(a.$('#slideResult').hidden, true); assert.equal(a.$('#editSlides').hidden, true);
});
test('DOM: shrinking the body hides stale recommendations and restoring length recovers', async t => {
  const a = await app(t); addSlide(a); apply(a);
  a.fill('#lengthNumber', 8, 'change');
  assert.equal(a.api.getResults(), null); assert.equal(a.$('#geometryError').hidden, false);
  assert.equal(a.$('#resultContent').hidden, true); assert.equal(a.$('#comparison').hidden, true);
  assert.equal(a.$('#advancedPanel .drivers').hidden, true);
  a.fill('#lengthNumber', 28, 'change');
  assert.ok(a.api.getResults()); assert.equal(a.$('#geometryError').hidden, true); assert.equal(a.$('#resultContent').hidden, false);
});
test('DOM: main-RV Advanced apply/clear keeps measured slides and updates inherited insulation', async t => {
  const a = await app(t); addSlide(a); apply(a);
  a.click('#advancedShortcut'); a.fill('#advWallR', 10); a.click('#applyAdvanced');
  assert.equal(a.$('#advancedError').hidden, true, a.$('#advancedError').textContent);
  assert.equal(a.api.getState().advancedApplied, true); assert.equal(a.api.getState().slideOuts.length, 1);
  assert.equal(a.api.getResults().breakdown.slideResults[0].effective.wallR, 10);
  a.click('#clearAdvanced');
  assert.equal(a.api.getState().advancedApplied, false); assert.equal(a.api.getState().slideOuts[0].lengthFt, 10);
  assert.equal(a.api.getResults().breakdown.slideResults[0].effective.wallR, 6);
});
test('DOM: Advanced cancel restores prior inputs and blank zero-capable fields are rejected', async t => {
  const a = await app(t); a.click('#advancedShortcut'); a.fill('#advWallR', 15); a.click('#cancelAdvanced');
  assert.equal(a.api.getInputs().wallR, 6); assert.equal(a.$('#advWallR').value, '6');
  a.click('#advancedShortcut'); a.fill('#advVentCfm', ''); a.click('#applyAdvanced');
  assert.equal(a.$('#advancedError').hidden, false); assert.equal(a.api.getState().advancedApplied, false);
});
test('DOM: RV type, construction, dimension, window, people and help controls remain functional', async t => {
  const a = await app(t);
  for (const vehicle of ['fifth', 'motorhome', 'van', 'travel']) { a.click(`[data-vehicle="${vehicle}"]`); assert.equal(a.api.getState().vehicle, vehicle); assert.equal(a.api.getState().slideOuts.length, 0); }
  const original = a.api.getResults().expected.heating;
  a.fill('#construction', 'well', 'change'); assert.ok(a.api.getResults().expected.heating < original);
  a.fill('#widthNumber', 9, 'change'); assert.equal(a.api.getInputs().width, 9);
  a.fill('#heightNumber', 7, 'change'); assert.equal(a.api.getInputs().height, 7);
  a.click('#windowsPlus'); assert.equal(a.api.getState().windows, 11); a.click('#windowsMinus'); assert.equal(a.api.getState().windows, 10);
  a.click('#peoplePlus'); assert.equal(a.api.getState().people, 3); a.click('#peopleMinus'); assert.equal(a.api.getState().people, 2);
  a.click('[data-modal-target="howModal"]'); assert.equal(a.$('#howModal').open, true);
  a.click('#howModal [data-close-modal]'); assert.equal(a.$('#howModal').open, false);
});
test('DOM: external state snapshots cannot mutate applied slide inputs', async t => {
  const a = await app(t); addSlide(a); apply(a);
  const state = a.api.getState(); state.slideOuts[0].lengthFt = -1;
  const inputs = a.api.getInputs(); inputs.slideOuts[0].depthFt = -1;
  assert.equal(a.api.getState().slideOuts[0].lengthFt, 10); assert.equal(a.api.getInputs().slideOuts[0].depthFt, 3);
});

test('DOM: five-slide limit disables Add and removing a draft re-enables it', async t => {
  const a = await app(t);
  for (let i = 0; i < 5; i++) {
    addSlide(a, i); a.fill(`#slide-${i}-lengthFt`, 2); a.fill(`#slide-${i}-depthFt`, 1); a.fill(`#slide-${i}-outerWindowAreaFt2`, 0);
  }
  assert.equal(a.$('#addSlide').disabled, true);
  a.click('[data-remove="4"]'); assert.equal(a.$('#addSlide').disabled, false);
  apply(a); assert.equal(a.api.getState().slideOuts.length, 4);
  assert.equal(a.api.getResults().breakdown.geometry.slideFloorArea, 8);
});
