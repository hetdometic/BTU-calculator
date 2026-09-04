from pathlib import Path
import re

path = Path("index.html")
text = path.read_text(encoding="utf-8")
original = text

style_match = re.search(r"<style>.*?</style>", text, re.S)
assert style_match, "style block missing"
style_before = style_match.group(0)


def replace_once(old, new, label):
    global text
    count = text.count(old)
    assert count == 1, f"{label}: expected exactly one match, found {count}"
    text = text.replace(old, new, 1)


def replace_range(start, end, replacement, label):
    global text
    i = text.find(start)
    assert i >= 0, f"{label}: start not found"
    j = text.find(end, i)
    assert j >= 0, f"{label}: end not found"
    text = text[:i] + replacement + text[j:]


def remove_once_in_range(start, end, needle, label):
    global text
    i = text.find(start)
    assert i >= 0, f"{label}: start not found"
    j = text.find(end, i)
    assert j >= 0, f"{label}: end not found"
    chunk = text[i:j]
    count = chunk.count(needle)
    assert count == 1, f"{label}: expected one needle, found {count}"
    chunk = chunk.replace(needle, "", 1)
    text = text[:i] + chunk + text[j:]


replace_range(
    '      const acSystems = [',
    '      const furnaceSystems = [',
    '''      const acBaseUnits = [
        { id: "fj11", capacity: 11000, name: "FreshJet 5 HE ≈11K", approximate: true },
        { id: "fj135", capacity: 13500, name: "FreshJet 5 13.5K", approximate: false },
        { id: "fj15", capacity: 15000, name: "FreshJet 5 15K", approximate: false }
      ];

      function buildAcSystems() {
        const plans = [];
        const build = (unitCount, startIndex = 0, selected = []) => {
          if (selected.length === unitCount) {
            const capacity = selected.reduce((sum, unit) => sum + unit.capacity, 0);
            const approximate = selected.some((unit) => unit.approximate);
            plans.push({
              id: `ac-${selected.map((unit) => unit.id).join("-")}`,
              capacity,
              label: `${Number.isInteger(capacity / 1000) ? capacity / 1000 : (capacity / 1000).toFixed(1)}K BTU/hr`,
              detail: selected.map((unit) => unit.name).join(" + "),
              staged: unitCount > 1,
              unitCount,
              approximate
            });
            return;
          }
          for (let index = startIndex; index < acBaseUnits.length; index += 1) {
            selected.push(acBaseUnits[index]);
            build(unitCount, index, selected);
            selected.pop();
          }
        };
        for (let unitCount = 1; unitCount <= 3; unitCount += 1) build(unitCount);
        plans.sort((a, b) => a.capacity - b.capacity || a.unitCount - b.unitCount);
        const unique = new Map();
        plans.forEach((plan) => {
          if (!unique.has(plan.capacity)) unique.set(plan.capacity, plan);
        });
        return [...unique.values()];
      }

      const acSystems = buildAcSystems();

''',
    "A/C equipment plans"
)

text = text.replace(
    'https://media.dometic.com/externalassets/dometic-medium-furnace_9600000823_81453.pdf',
    'https://media.dometic.com/externalassets/dometic-medium-furnace_9610007793_81453.pdf'
)

replace_once(
    'Advisory only; no automatic derate',
    'Adjusts air properties; no automatic furnace derate',
    "altitude hint"
)
replace_once(
    'compares the expected continuous cooling load with 11K, 13.5K and 15K BTU/hr classes, plus common two-unit totals.',
    'compares the expected continuous cooling load with current FreshJet 5 ≈11K, 13.5K and 15K classes, including unique one-, two- and three-unit capacity plans.',
    "A/C sizing guide copy"
)

replace_range(
    '      function humidityGrains(',
    '      function calculateAll() {',
    '''      function atmosphericPressureKpa(altitudeFt) {
        const altitude = clamp(Number(altitudeFt) || 0, 0, 14000);
        return 101.325 * Math.pow(1 - altitude * 6.8754e-6, 5.2559);
      }

      function airDensityRatio(tempF, altitudeFt) {
        const absoluteTempR = Math.max(350, Number(tempF) + 459.67);
        return (atmosphericPressureKpa(altitudeFt) / 101.325) * (529.67 / absoluteTempR);
      }

      function humidityGrains(tempF, rhPercent, altitudeFt = 0) {
        const tempC = (tempF - 32) * 5 / 9;
        const saturationKpa = 0.61078 * Math.exp((17.2694 * tempC) / (tempC + 237.3));
        const vaporKpa = clamp(rhPercent / 100, 0, 1) * saturationKpa;
        const pressureKpa = atmosphericPressureKpa(altitudeFt);
        const humidityRatio = 0.62198 * vaporKpa / Math.max(0.1, pressureKpa - vaporKpa);
        return humidityRatio * 7000;
      }

      function distributionLossAdder(subtotal, lossFraction) {
        const loss = clamp(lossFraction, 0, 0.30);
        return loss > 0 ? subtotal * loss / (1 - loss) : 0;
      }

      function calculateScenario(inputs, variant = "expected") {
        const scenario = {
          low: { r: 1.20, ach: 0.70, u: 0.90, solar: 0.85, gains: 0.85, duct: -0.03 },
          expected: { r: 1, ach: 1, u: 1, solar: 1, gains: 1, duct: 0 },
          high: { r: 0.75, ach: 1.50, u: 1.10, solar: 1.15, gains: 1.15, duct: 0.05 }
        }[variant];

        const areaFactor = 1 + 0.05 * inputs.slides;
        const floorArea = inputs.length * inputs.width * areaFactor;
        const roofArea = floorArea;
        const wallGross = 2 * (inputs.length + inputs.width) * inputs.height * areaFactor;
        const doorArea = Math.min(18, wallGross * 0.08);
        const windowArea = clamp(inputs.windowArea, 0, Math.max(0, wallGross - doorArea));
        const wallArea = Math.max(0, wallGross - windowArea - doorArea);
        const volume = floorArea * inputs.height;
        const infiltrationCfm = inputs.ach * scenario.ach * volume / 60;
        const outsideCfm = infiltrationCfm + inputs.ventilationCfm;
        const coolDelta = Math.max(inputs.coolOutdoor - inputs.coolIndoor, 0);
        const heatDelta = Math.max(inputs.heatIndoor - inputs.heatOutdoor, 0);
        const coolDuct = clamp(inputs.coolDuctLoss + scenario.duct, 0, 0.30);
        const heatDuct = clamp(inputs.heatDuctLoss + scenario.duct, 0, 0.30);
        const coolDensity = airDensityRatio(inputs.coolOutdoor, inputs.altitude);
        const heatDensity = airDensityRatio(inputs.heatOutdoor, inputs.altitude);

        const cooling = {
          walls: wallArea / (inputs.wallR * scenario.r) * Math.max(coolDelta + inputs.sun.wall * scenario.solar, 0),
          roof: roofArea / (inputs.roofR * scenario.r) * Math.max(coolDelta + inputs.sun.roof * scenario.solar, 0),
          floor: floorArea / (inputs.floorR * scenario.r) * coolDelta,
          door: doorArea / (inputs.doorR * scenario.r) * coolDelta,
          windowConduction: windowArea * inputs.windowU * scenario.u * coolDelta,
          windowSolar: windowArea * inputs.shgc * inputs.sun.window * scenario.solar,
          outsideAirSensible: 1.08 * coolDensity * outsideCfm * coolDelta,
          peopleSensible: 230 * inputs.people * scenario.gains,
          internalSensible: inputs.internalWatts * 3.412 * inputs.internalDuty * scenario.gains
        };

        const grainDifference = Math.max(
          humidityGrains(inputs.coolOutdoor, inputs.outdoorRh, inputs.altitude) - humidityGrains(inputs.coolIndoor, inputs.indoorRh, inputs.altitude),
          0
        );
        cooling.outsideAirLatent = 0.68 * coolDensity * outsideCfm * grainDifference;
        cooling.peopleLatent = 200 * inputs.people * scenario.gains;
        const coolingSubtotal = Object.values(cooling).reduce((sum, value) => sum + value, 0);
        cooling.duct = distributionLossAdder(coolingSubtotal, coolDuct);
        const coolingTotal = coolingSubtotal + cooling.duct;

        const heating = {
          walls: wallArea / (inputs.wallR * scenario.r) * heatDelta,
          roof: roofArea / (inputs.roofR * scenario.r) * heatDelta,
          floor: floorArea / (inputs.floorR * scenario.r) * heatDelta,
          door: doorArea / (inputs.doorR * scenario.r) * heatDelta,
          windows: windowArea * inputs.windowU * scenario.u * heatDelta,
          outsideAir: 1.08 * heatDensity * outsideCfm * heatDelta
        };
        const heatingSubtotal = Object.values(heating).reduce((sum, value) => sum + value, 0);
        heating.duct = distributionLossAdder(heatingSubtotal, heatDuct);
        const heatingTotal = heatingSubtotal + heating.duct;

        return {
          coolingTotal,
          heatingTotal,
          cooling,
          heating,
          geometry: { floorArea, roofArea, wallArea, windowArea, doorArea, volume, infiltrationCfm },
          air: { coolDensity, heatDensity, pressureKpa: atmosphericPressureKpa(inputs.altitude) }
        };
      }

''',
    "thermal core"
)

replace_range(
    '      function calculateAll() {',
    '      function recommendAc(load) {',
    '''      function calculateAll() {
        const inputs = currentInputs();
        const lowRaw = calculateScenario(inputs, "low");
        const expectedRaw = calculateScenario(inputs, "expected");
        const highRaw = calculateScenario(inputs, "high");
        return {
          inputs,
          low: { cooling: round100(lowRaw.coolingTotal), heating: round100(lowRaw.heatingTotal) },
          expected: { cooling: round100(expectedRaw.coolingTotal), heating: round100(expectedRaw.heatingTotal) },
          high: { cooling: round100(highRaw.coolingTotal), heating: round100(highRaw.heatingTotal) },
          raw: { low: lowRaw, expected: expectedRaw, high: highRaw },
          breakdown: expectedRaw
        };
      }

''',
    "raw/display load split"
)

replace_range(
    '      function acFitText(',
    '      function renderCapacityCards(',
    '''      function acFitText(system, results) {
        const low = results.raw.low.coolingTotal;
        const expected = results.raw.expected.coolingTotal;
        const high = results.raw.high.coolingTotal;
        if (system.capacity < low) return "Likely undersized";
        if (system.capacity < expected) return "Fair-weather coverage";
        if (system.capacity < high) return "Typical-day fit";
        if (!system.staged && system.capacity > expected * 1.4) return "Oversizing caution";
        return system.staged ? "Staged peak coverage" : "Conservative coverage";
      }

      function furnaceFitText(system, results) {
        const low = results.raw.low.heatingTotal;
        const expected = results.raw.expected.heatingTotal;
        const high = results.raw.high.heatingTotal;
        if (system.output < low) return "Likely undersized";
        if (system.output < expected) return "Mild-weather coverage";
        if (system.output < high) return "Typical-day fit";
        if (system.output > expected * 1.4) return "Oversizing caution";
        return "Conservative coverage";
      }

''',
    "fit thresholds"
)

replace_once(
    '        const acRec = recommendAc(results.expected.cooling);\n        const furnaceRec = recommendFurnace(results.expected.heating);',
    '        const acRec = recommendAc(results.raw.expected.coolingTotal);\n        const furnaceRec = recommendFurnace(results.raw.expected.heatingTotal);',
    "raw recommendation thresholds"
)
replace_once(
    '        els.coolingMatch.textContent = acRec ? fmt(acRec.capacity) : ">30,000";',
    '        els.coolingMatch.textContent = acRec ? fmt(acRec.capacity) : `>${fmt(acSystems.at(-1).capacity)}`;',
    "dynamic cooling ceiling"
)
replace_once(
    '        if (!acRec && state.mode !== "furnace") alerts.push("Cooling exceeds the common two-unit comparison range; get a professional multi-zone assessment.");',
    '        if (!acRec && state.mode !== "furnace") alerts.push(`Cooling exceeds the ${fmt(acSystems.at(-1).capacity)} BTU/hr three-unit planning range; get a professional multi-zone assessment.`);\n        if (acRec?.unitCount > 1 && state.mode !== "furnace") alerts.push(`${acRec.unitCount}-unit FreshJet 5 capacity plan: verify roof openings, electrical service or generator capacity, ducts/air distribution, and controls/zoning.`);\n        if (results.inputs.coolOutdoor >= 100 && state.mode !== "furnace") alerts.push("Extreme cooling design temperature selected: verify actual FreshJet performance at the design condition; nameplate BTU/hr is nominal.");',
    "A/C capacity warnings"
)
replace_once(
    '        if (results.inputs.altitude >= 5000) alerts.push("High altitude selected: verify manufacturer-specific furnace derating and combustion requirements.");',
    '        if (results.inputs.altitude >= 5000) alerts.push("Elevation is included in outside-air load calculations; separately verify model-specific furnace combustion, installation, and altitude requirements.");',
    "altitude warning"
)

remove_once_in_range(
    '      const updateLength = (value) => {',
    '      els.lengthRange.addEventListener',
    '        invalidateAdvanced();\n',
    "length advanced-state preservation"
)
remove_once_in_range(
    '      $("#peopleMinus").addEventListener',
    '      $("#peoplePlus").addEventListener',
    '        invalidateAdvanced();\n',
    "traveler decrement advanced-state preservation"
)
remove_once_in_range(
    '      $("#peoplePlus").addEventListener',
    '      $("#seeRecommendation").addEventListener',
    '        invalidateAdvanced();\n',
    "traveler increment advanced-state preservation"
)

replace_once(
    '        getState: () => ({ ...state }),\n        getResults: () => state.lastResults',
    '        getState: () => ({ ...state }),\n        getResults: () => state.lastResults,\n        getAcSystems: () => acSystems.map((system) => ({ ...system })),\n        getFurnaceSystems: () => furnaceSystems.map((system) => ({ ...system }))',
    "test accessors"
)

style_after_match = re.search(r"<style>.*?</style>", text, re.S)
assert style_after_match, "style block missing after patch"
assert style_before == style_after_match.group(0), "DESIGN GUARD FAILED: CSS changed"
assert text.count('<dialog class="advanced-modal" id="advancedModal"') == 1, "Advanced modal structure changed"
assert '<script src=' not in text, "External JS dependency introduced"
assert '<link rel="stylesheet"' not in text, "External stylesheet introduced"
assert text != original, "No changes applied"

path.write_text(text, encoding="utf-8")
print("Guarded logic-only patch applied; CSS unchanged.")
