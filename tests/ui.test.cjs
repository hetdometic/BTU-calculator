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
  assert.equal(a.api.getAcSystems().at(-1).capacity, 30000);
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

test('DOM: recommendations show model codes and separate calculated load from catalog capacity', async t => {
  const a = await app(t); a.click('[data-vehicle="van"]');
  const raw = a.api.getResults().raw.expected;
  const ac = a.api.getAcSystems().find(s => s.capacity >= raw.coolingTotal);
  const heat = a.api.getFurnaceSystems().find(s => s.output >= raw.heatingTotal);
  assert.match(a.$('#coolingModelMatch').textContent, new RegExp(ac.detail));
  assert.match(a.$('#furnaceMatch').textContent, new RegExp(heat.modelNumber));
  assert.match(a.$('#furnaceMatch').textContent, /delivered/);
  assert.match(a.$('#catalogStatus').textContent, /2026-10-20/);
  assert.match(a.$('#catalogStatus').textContent, /not live stock/);
  assert.equal(a.api.getEquipmentCatalog().models.length, 9);
  const capacity = Number(a.$('#coolingMatch').textContent.replace(/[^\d]/g, ''));
  assert.equal(capacity, ac.capacity); assert.ok(capacity >= raw.coolingTotal);
  for (const [selector, system] of [['#coolingProduct', ac], ['#heatingProduct', heat]]) {
    const model = a.api.getEquipmentCatalog().models.find(model => model.id === system.components[0].modelId);
    const card = a.$(selector);
    assert.equal(card.querySelector('h3.product-model').textContent, model.modelNumber);
    assert.ok(card.querySelector('.product-sku').textContent.includes(model.sku));
    const photo = card.querySelector('.recommended-product-photo');
    assert.equal(photo.getAttribute('src'), model.imageSrc);
    assert.equal(photo.alt, model.imageAlt);
    assert.equal(photo.closest('a').href, model.productUrl);
    const product = card.querySelector('.recommended-product-link');
    assert.equal(product.href, model.productUrl);
    assert.equal(product.target, '_blank');
    assert.ok(product.rel.includes('noopener'));
  }
});

test('DOM: a failed product photo exposes an accessible fallback and keeps the official product link', async t => {
  const a = await app(t); a.click('[data-vehicle="van"]');
  const photo = a.$('#coolingProduct .recommended-product-photo');
  const fallback = a.$('#coolingProduct .product-image-fallback');
  const modelNumber = a.$('#coolingProduct .product-model').textContent;
  const productUrl = a.$('#coolingProduct .recommended-product-link').href;
  assert.equal(photo.hidden, false);
  assert.equal(fallback.hidden, true);
  photo.dispatchEvent(new a.window.Event('error'));
  assert.equal(photo.hidden, true);
  assert.equal(fallback.hidden, false);
  assert.equal(fallback.getAttribute('role'), 'img');
  assert.equal(fallback.getAttribute('aria-label'), modelNumber + ': product image unavailable');
  assert.match(fallback.textContent, /Product image unavailable/);
  assert.equal(a.$('#coolingProduct .recommended-product-link').href, productUrl);
});

test('DOM: selecting a different capacity updates linked models and labels an undersized selection', async t => {
  const a = await app(t);
  const originalPhoto = a.$('#acModelReference .selected-product-visual img').getAttribute('src');
  const lower = a.$('#acCompareOptions .capacity-card:not(.recommended):not(.unavailable)');
  assert.ok(lower); lower.click();
  const chosen = a.api.getAcSystems().find(s => s.id === lower.dataset.systemId);
  assert.match(a.$('#acModelReference').textContent, new RegExp(chosen.detail));
  const code = chosen.components[0].modelId;
  const model = a.api.getEquipmentCatalog().models.find(m => m.id === code);
  assert.equal(lower.querySelector('.capacity-image img').getAttribute('src'), model.imageSrc);
  assert.ok(lower.querySelector('.capacity-sku').textContent.includes(model.sku));
  const photo = a.$('#acModelReference .selected-product-visual img');
  assert.equal(photo.getAttribute('src'), model.imageSrc);
  assert.notEqual(photo.getAttribute('src'), originalPhoto);
  assert.equal(photo.alt, model.imageAlt);
  assert.equal(a.$('#acModelReference .selected-product-link').href, model.productUrl);
  const product = a.$('#acModelReference a');
  assert.equal(product.href, model.productUrl);
  assert.equal(product.target, '_blank'); assert.ok(product.rel.includes('noopener'));
  assert.equal(a.window.document.querySelectorAll('.capacity-card a').length, 0, 'links are not nested in buttons');
  if (chosen.capacity < a.api.getResults().raw.expected.coolingTotal) assert.match(a.$('#acModelReference .capacity-deficit').textContent, /does not cover/);
});
test('DOM: model details link furnace delivered ratings to the manufacturer manual', async t => {
  const a = await app(t);
  assert.match(a.$('#furnaceModelReference').textContent, /fuel input → .*delivered heat/);
  const links = [...a.window.document.querySelectorAll('#furnaceModelReference a')];
  assert.ok(links.some(link => link.href.endsWith('81453.pdf#page=7')));
});
test('DOM: zero heating load gives no furnace recommendation or false capacity-exceeded alert', async t => {
  const a = await app(t); a.click('[data-mode="furnace"]');
  a.click('#advancedShortcut'); a.fill('#advHeatTemp', 68); a.click('#applyAdvanced');
  assert.equal(a.api.getResults().raw.expected.heatingTotal, 0);
  assert.match(a.$('#furnaceMatch').textContent, /No heating demand/);
  assert.equal(a.$('#capacityAlert').hidden, true);
  assert.equal(a.api.getState().selectedFurnace, null);
  assert.equal(a.window.document.querySelectorAll('#furnaceCompareOptions .unavailable').length, 3);
  assert.match(a.$('#furnaceModelReference').textContent, /No equipment capacity/);
  assert.ok(a.$('#heatingProduct .product-empty'));
  assert.equal(a.$('#heatingProduct .recommended-product-photo'), null);
  assert.equal(a.$('#heatingProduct .recommended-product-link'), null);
});
test('DOM: beyond-catalog loads remain explicit and the highest option is labeled insufficient', async t => {
  const a = await app(t);
  a.click('[data-vehicle="van"]');
  assert.ok(a.$('#coolingProduct .recommended-product-photo'));
  assert.ok(a.$('#heatingProduct .recommended-product-photo'));
  a.fill('#lengthNumber', 60, 'change'); a.fill('#widthNumber', 10, 'change'); a.fill('#heightNumber', 10, 'change'); a.fill('#construction', 'older', 'change');
  a.click('#advancedShortcut'); a.fill('#advCoolTemp', 125); a.fill('#advOutdoorRh', 90); a.fill('#advHeatTemp', -40); a.click('#applyAdvanced');
  const r = a.api.getResults().raw.expected;
  assert.ok(r.coolingTotal > 30000 && r.heatingTotal > 30400);
  assert.equal(a.window.document.querySelectorAll('.capacity-card.recommended').length, 0);
  assert.match(a.$('#coolingModelMatch').textContent, /No listed one- or two-unit option meets this load/);
  assert.match(a.$('#furnaceMatch').textContent, /No listed furnace meets this load/);
  assert.match(a.$('#acModelReference').textContent, /does not cover/);
  assert.match(a.$('#furnaceModelReference').textContent, /does not cover/);
  for (const selector of ['#coolingProduct', '#heatingProduct']) {
    assert.ok(a.$(selector + ' .product-empty'));
    assert.equal(a.$(selector + ' .recommended-product-photo'), null);
    assert.equal(a.$(selector + ' .recommended-product-link'), null);
  }
});
test('DOM: cooling above a single unit shows actual quantities, photos, SKUs and links for a two-unit option', async t => {
  const a = await app(t);
  a.fill('#lengthNumber', 50, 'change');
  const load = a.api.getResults().raw.expected.coolingTotal;
  assert.ok(load > 15000 && load < 22000);
  assert.equal(a.api.getAcSystems().length, 9);
  assert.equal(a.window.document.querySelectorAll('#acCompareOptions .recommended').length, 1);
  const pair = a.$('#coolingProduct .recommended-pair');
  assert.ok(pair);
  assert.match(pair.querySelector('.pair-total').textContent, /≈22,000 BTU\/hr/);
  assert.match(pair.querySelector('.pair-total').textContent, /Combined nominal cooling/);
  assert.match(pair.querySelector('.product-model').textContent, /2 × FJX5357MHE/);
  assert.match(pair.querySelector('.product-sku').textContent, /9620015929/);
  assert.match(pair.querySelector('.pair-unit-rating').textContent, /≈11,000 BTU\/hr per unit/);
  const model = a.api.getEquipmentCatalog().models.find(m => m.modelNumber === 'FJX5357MHE');
  assert.equal(pair.querySelector('img').getAttribute('src'), model.imageSrc);
  assert.equal(pair.querySelector('.recommended-product-link').href, model.productUrl);
  assert.match(pair.querySelector('.pair-notice').textContent, /each cooling zone.*power for simultaneous operation/);
  assert.match(a.$('#coolingModelMatch').textContent, /2 × FJX5357MHE.*2-unit option.*22,000/);
  assert.match(a.$('#acModelReference').textContent, /2 × FJX5357MHE/);
  assert.doesNotMatch(a.$('#results').textContent, /undefined/);
  a.click('[data-vehicle="van"]');
  assert.equal(a.$('#coolingProduct .recommended-pair'), null);
  assert.equal(a.$('#coolingProduct .product-model').textContent, 'FJX5357MHE');
  assert.match(a.$('#coolingMatch').textContent, /11,000/);
});

test('DOM: mixed two-unit options list each exact product and update comparison details without stale units', async t => {
  const a = await app(t);
  a.fill('#lengthNumber', 60, 'change');
  a.click('#advancedShortcut'); a.fill('#advCoolTemp', 100); a.click('#applyAdvanced');
  const load = a.api.getResults().raw.expected.coolingTotal;
  assert.ok(load > 22000 && load < 24500);
  const rows = [...a.window.document.querySelectorAll('#coolingProduct .pair-product')];
  assert.equal(rows.length, 2);
  for (const [index, number] of ['FJX5357MHE', 'FJX5457M'].entries()) {
    const model = a.api.getEquipmentCatalog().models.find(m => m.modelNumber === number);
    assert.equal(rows[index].querySelector('.product-model').textContent, '1 × ' + number);
    assert.ok(rows[index].querySelector('.product-sku').textContent.includes(model.sku));
    assert.equal(rows[index].querySelector('img').getAttribute('src'), model.imageSrc);
    assert.equal(rows[index].querySelector('.recommended-product-link').href, model.productUrl);
    assert.equal(rows[index].querySelector('.recommended-product-link').target, '_blank');
  }
  assert.match(a.$('#coolingProduct .pair-total').textContent, /≈24,500/);
  const recommended = a.$('#acCompareOptions .recommended');
  assert.match(recommended.querySelector('.capacity-sku').textContent, /2 rooftop units/);
  const lower = a.$('#acCompareOptions .capacity-card:not(.recommended):not(.unavailable)');
  lower.click();
  assert.match(a.$('#acModelReference .capacity-deficit').textContent, /does not cover/);
  assert.equal(a.window.document.querySelectorAll('#acModelReference .selected-product-visual').length, 1);
  a.click('#acCompareOptions .recommended');
  assert.equal(a.window.document.querySelectorAll('#acModelReference .selected-product-visual').length, 2);
  const detailLinks = [...a.window.document.querySelectorAll('#acModelReference .selected-product-link')];
  assert.deepEqual(detailLinks.map(link => link.href), rows.map(row => row.querySelector('.recommended-product-link').href));
  assert.doesNotMatch(a.$('#acModelReference').textContent, /undefined/);

  a.click('#advancedShortcut'); a.fill('#advCoolTemp', 110); a.click('#applyAdvanced');
  assert.match(a.$('#coolingProduct .pair-total').textContent, /^30,000/);
  assert.equal(a.window.document.querySelectorAll('#coolingProduct .pair-product').length, 1);
  assert.equal(a.$('#coolingProduct .product-model').textContent, '2 × FJX5557M');
  a.click('#advancedShortcut'); a.fill('#advCoolTemp', 115); a.click('#applyAdvanced');
  assert.ok(a.api.getResults().raw.expected.coolingTotal > 30000);
  assert.equal(a.$('#coolingProduct .recommended-pair'), null);
  assert.equal(a.$('#coolingProduct .recommended-product-link'), null);
  assert.match(a.$('#coolingProduct .product-empty').textContent, /No listed one- or two-unit option.*30,000/s);
});

test('DOM: heating overflow never substitutes cooling-only A/C capacity or suppresses a valid cooling pair', async t => {
  const a = await app(t);
  a.fill('#lengthNumber', 60, 'change');
  a.click('#advancedShortcut'); a.fill('#advCoolTemp', 100); a.fill('#advHeatTemp', -20); a.click('#applyAdvanced');
  assert.ok(a.api.getResults().raw.expected.heatingTotal > 30400);
  assert.ok(a.$('#coolingProduct .recommended-pair'));
  assert.ok(a.$('#heatingProduct .product-empty'));
  assert.equal(a.$('#heatingProduct .recommended-product-link'), null);
  assert.match(a.$('#heatingProduct').textContent, /cooling-only.*cannot be used for heating/);
  assert.ok(a.api.getFurnaceSystems().every(system => system.unitCount === 1));
  a.click('[data-mode="furnace"]');
  assert.equal(a.$('#coolingResult').hidden, true);
  assert.equal(a.$('#heatingResult').hidden, false);
});
test('DOM: catalog API snapshots do not allow callers to mutate model ratings', async t => {
  const a = await app(t);
  const snapshot = a.api.getEquipmentCatalog(); snapshot.models[0].capacity = -1;
  const plans = a.api.getAcSystems(); plans[0].components[0].quantity = 99;
  assert.equal(a.api.getEquipmentCatalog().models[0].capacity, 11000);
  assert.equal(a.api.getAcSystems()[0].components[0].quantity, 1);
});
