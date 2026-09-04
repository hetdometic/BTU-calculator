(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DometicSizingV2 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LINEUP_AS_OF = "2026-09-04";

  const BASE_AC_UNITS = Object.freeze([
    Object.freeze({ id: "fj5-he", family: "FreshJet 5", variant: "High Efficiency", capacity: 11000, approximate: true }),
    Object.freeze({ id: "fj5-135", family: "FreshJet 5", variant: "13.5K", capacity: 13500, approximate: false }),
    Object.freeze({ id: "fj5-15", family: "FreshJet 5", variant: "15K", capacity: 15000, approximate: false })
  ]);

  const FURNACE_SYSTEMS = Object.freeze([
    Object.freeze({ id: "fe12", capacity: 12000, output: 12000, label: "12K BTU/hr", detail: "Furnace Essential · 12K heating capacity", family: "Furnace Essential" }),
    Object.freeze({ id: "fe18", capacity: 18000, output: 18000, label: "18K BTU/hr", detail: "Furnace Essential · 18K heating capacity", family: "Furnace Essential" }),
    Object.freeze({ id: "fe25", capacity: 25000, output: 25000, label: "25K BTU/hr", detail: "Furnace Essential · 25K heating capacity", family: "Furnace Essential" }),
    Object.freeze({ id: "fe30", capacity: 30000, output: 30000, label: "30K BTU/hr", detail: "Furnace Essential · 30K heating capacity", family: "Furnace Essential" }),
    Object.freeze({ id: "fe35", capacity: 35000, output: 35000, label: "35K BTU/hr", detail: "Furnace Essential · 35K heating capacity", family: "Furnace Essential" }),
    Object.freeze({ id: "fe40", capacity: 40000, output: 40000, label: "40K BTU/hr", detail: "Furnace Essential · 40K heating capacity", family: "Furnace Essential" })
  ]);

  const SCENARIOS = Object.freeze({
    low: Object.freeze({ r: 1.20, ach: 0.70, u: 0.90, solar: 0.85, gains: 0.85, ductDelta: -0.03 }),
    expected: Object.freeze({ r: 1.00, ach: 1.00, u: 1.00, solar: 1.00, gains: 1.00, ductDelta: 0.00 }),
    high: Object.freeze({ r: 0.75, ach: 1.50, u: 1.10, solar: 1.15, gains: 1.15, ductDelta: 0.05 })
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const round100 = (value) => Math.max(0, Math.round(value / 100) * 100);

  function combinationsWithReplacement(items, count, start = 0, prefix = [], out = []) {
    if (prefix.length === count) {
      out.push(prefix.slice());
      return out;
    }
    for (let i = start; i < items.length; i += 1) {
      prefix.push(items[i]);
      combinationsWithReplacement(items, count, i, prefix, out);
      prefix.pop();
    }
    return out;
  }

  function formatCapacity(capacity) {
    const k = capacity / 1000;
    return `${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}K BTU/hr`;
  }

  function componentName(unit) {
    if (unit.id === "fj5-he") return "FreshJet 5 HE (≈11K)";
    return `FreshJet 5 ${unit.variant}`;
  }

  function buildAcSystems(maxUnits = 3) {
    const systems = [];
    const max = clamp(Math.round(maxUnits), 1, 4);
    for (let count = 1; count <= max; count += 1) {
      const combos = combinationsWithReplacement(BASE_AC_UNITS, count);
      for (const combo of combos) {
        const capacity = combo.reduce((sum, unit) => sum + unit.capacity, 0);
        const ids = combo.map((unit) => unit.id);
        const detail = count === 1
          ? componentName(combo[0])
          : combo.map(componentName).join(" + ");
        systems.push({
          id: `ac-${ids.join("-")}`,
          capacity,
          label: formatCapacity(capacity),
          detail,
          staged: count > 1,
          unitCount: count,
          components: ids,
          family: "FreshJet 5"
        });
      }
    }
    systems.sort((a, b) => a.capacity - b.capacity || a.unitCount - b.unitCount || a.id.localeCompare(b.id));

    // For equal total capacity, keep the configuration with fewer rooftop units.
    const byCapacity = new Map();
    for (const system of systems) {
      if (!byCapacity.has(system.capacity)) byCapacity.set(system.capacity, system);
    }
    return Array.from(byCapacity.values());
  }

  const AC_SYSTEMS = Object.freeze(buildAcSystems(3).map(Object.freeze));

  function atmosphericPressureKpa(altitudeFt = 0) {
    const altitude = clamp(Number(altitudeFt) || 0, 0, 20000);
    // U.S. Standard Atmosphere approximation in the troposphere.
    return 101.325 * Math.pow(1 - 6.87535e-6 * altitude, 5.2559);
  }

  function airDensityRatio(tempF, altitudeFt = 0) {
    const tempR = Math.max(350, Number(tempF) + 459.67);
    const pressureRatio = atmosphericPressureKpa(altitudeFt) / 101.325;
    // 70°F at sea level is the reference behind the familiar 1.08 sensible-air coefficient.
    return pressureRatio * (529.67 / tempR);
  }

  function saturationPressureKpa(tempF) {
    const tempC = (Number(tempF) - 32) * 5 / 9;
    return 0.61078 * Math.exp((17.2694 * tempC) / (tempC + 237.3));
  }

  function humidityRatio(tempF, rhPercent, altitudeFt = 0) {
    const p = atmosphericPressureKpa(altitudeFt);
    const pws = saturationPressureKpa(tempF);
    const pv = clamp(Number(rhPercent) / 100, 0, 1) * pws;
    return 0.62198 * pv / Math.max(0.1, p - pv);
  }

  function humidityGrains(tempF, rhPercent, altitudeFt = 0) {
    return humidityRatio(tempF, rhPercent, altitudeFt) * 7000;
  }

  function distributionLossAdder(subtotal, lossFraction) {
    const loss = clamp(Number(lossFraction) || 0, 0, 0.45);
    if (loss === 0) return 0;
    // If L is the fraction lost in distribution, equipment must supply load/(1-L).
    return subtotal * (loss / (1 - loss));
  }

  function sanitizeInputs(raw) {
    const inputs = { ...raw };
    const numeric = [
      "length", "width", "height", "slides", "wallR", "roofR", "floorR", "doorR",
      "windowArea", "windowU", "shgc", "ach", "coolOutdoor", "outdoorRh", "heatOutdoor",
      "coolIndoor", "indoorRh", "heatIndoor", "ventilationCfm", "coolDuctLoss", "heatDuctLoss",
      "internalWatts", "internalDuty", "altitude", "people"
    ];
    for (const key of numeric) {
      inputs[key] = Number(inputs[key]);
      if (!Number.isFinite(inputs[key])) throw new TypeError(`Invalid numeric input: ${key}`);
    }

    if (inputs.length <= 0 || inputs.width <= 0 || inputs.height <= 0) throw new RangeError("RV dimensions must be positive.");
    if (inputs.wallR <= 0 || inputs.roofR <= 0 || inputs.floorR <= 0 || inputs.doorR <= 0) throw new RangeError("R-values must be positive.");
    if (inputs.windowArea < 0 || inputs.ach < 0 || inputs.ventilationCfm < 0 || inputs.people < 0) throw new RangeError("Area, leakage, ventilation and occupants cannot be negative.");
    if (inputs.coolDuctLoss < 0 || inputs.coolDuctLoss >= 0.5 || inputs.heatDuctLoss < 0 || inputs.heatDuctLoss >= 0.5) throw new RangeError("Duct/distribution loss must be between 0 and 50%.");
    if (inputs.outdoorRh < 0 || inputs.outdoorRh > 100 || inputs.indoorRh < 0 || inputs.indoorRh > 100) throw new RangeError("Relative humidity must be between 0 and 100%.");
    if (inputs.altitude < 0 || inputs.altitude > 20000) throw new RangeError("Altitude must be between 0 and 20,000 ft for this model.");
    if (!inputs.sun || !Number.isFinite(Number(inputs.sun.roof)) || !Number.isFinite(Number(inputs.sun.wall)) || !Number.isFinite(Number(inputs.sun.window))) {
      throw new TypeError("Sun profile must contain numeric roof, wall and window values.");
    }
    return inputs;
  }

  function calculateScenario(rawInputs, variant = "expected") {
    const inputs = sanitizeInputs(rawInputs);
    const scenario = SCENARIOS[variant];
    if (!scenario) throw new RangeError(`Unknown scenario: ${variant}`);

    // Basic mode only knows slide count, not slide dimensions. Preserve a deliberately modest 5% area
    // heuristic per slide, but keep floor area and volume geometrically consistent.
    const slideAreaFactor = 1 + 0.05 * inputs.slides;
    const floorArea = inputs.length * inputs.width * slideAreaFactor;
    const roofArea = floorArea;
    const wallGross = 2 * (inputs.length + inputs.width) * inputs.height * slideAreaFactor;
    const doorArea = Math.min(18, wallGross * 0.08); // one typical RV entry door; do not scale door with slides
    const windowArea = clamp(inputs.windowArea, 0, Math.max(0, wallGross - doorArea));
    const wallArea = Math.max(0, wallGross - windowArea - doorArea);
    const volume = floorArea * inputs.height;

    const infiltrationCfm = inputs.ach * scenario.ach * volume / 60;
    const outsideCfm = infiltrationCfm + inputs.ventilationCfm;
    const coolDelta = Math.max(inputs.coolOutdoor - inputs.coolIndoor, 0);
    const heatDelta = Math.max(inputs.heatIndoor - inputs.heatOutdoor, 0);
    const coolDuctLoss = clamp(inputs.coolDuctLoss + scenario.ductDelta, 0, 0.45);
    const heatDuctLoss = clamp(inputs.heatDuctLoss + scenario.ductDelta, 0, 0.45);
    const coolDensity = airDensityRatio((inputs.coolOutdoor + inputs.coolIndoor) / 2, inputs.altitude);
    const heatDensity = airDensityRatio((inputs.heatOutdoor + inputs.heatIndoor) / 2, inputs.altitude);

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
      humidityGrains(inputs.coolOutdoor, inputs.outdoorRh, inputs.altitude) -
      humidityGrains(inputs.coolIndoor, inputs.indoorRh, inputs.altitude),
      0
    );
    cooling.outsideAirLatent = 0.68 * coolDensity * outsideCfm * grainDifference;
    cooling.peopleLatent = 200 * inputs.people * scenario.gains;
    const coolingSubtotal = Object.values(cooling).reduce((sum, value) => sum + value, 0);
    cooling.duct = distributionLossAdder(coolingSubtotal, coolDuctLoss);
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
    heating.duct = distributionLossAdder(heatingSubtotal, heatDuctLoss);
    const heatingTotal = heatingSubtotal + heating.duct;

    return {
      coolingTotal,
      heatingTotal,
      cooling,
      heating,
      geometry: { floorArea, roofArea, wallArea, windowArea, doorArea, volume, infiltrationCfm, outsideCfm },
      air: { pressureKpa: atmosphericPressureKpa(inputs.altitude), coolDensityRatio: coolDensity, heatDensityRatio: heatDensity },
      scenario: variant
    };
  }

  function calculateAll(inputs) {
    const low = calculateScenario(inputs, "low");
    const expected = calculateScenario(inputs, "expected");
    const high = calculateScenario(inputs, "high");
    return {
      low: { cooling: round100(low.coolingTotal), heating: round100(low.heatingTotal) },
      expected: { cooling: round100(expected.coolingTotal), heating: round100(expected.heatingTotal) },
      high: { cooling: round100(high.coolingTotal), heating: round100(high.heatingTotal) },
      breakdown: expected
    };
  }

  function recommendAc(load) {
    const value = Math.max(0, Number(load) || 0);
    return AC_SYSTEMS.find((system) => system.capacity >= value) || null;
  }

  function recommendFurnace(load) {
    const value = Math.max(0, Number(load) || 0);
    return FURNACE_SYSTEMS.find((system) => system.output >= value) || null;
  }

  function recommendationSummary(results) {
    const coolingExpected = Number(results?.expected?.cooling) || 0;
    const coolingHigh = Number(results?.high?.cooling) || 0;
    const heatingExpected = Number(results?.expected?.heating) || 0;
    const heatingHigh = Number(results?.high?.heating) || 0;
    return {
      acExpected: recommendAc(coolingExpected),
      acHigh: recommendAc(coolingHigh),
      furnaceExpected: recommendFurnace(heatingExpected),
      furnaceHigh: recommendFurnace(heatingHigh)
    };
  }

  return Object.freeze({
    LINEUP_AS_OF,
    baseAcUnits: BASE_AC_UNITS,
    acSystems: AC_SYSTEMS,
    furnaceSystems: FURNACE_SYSTEMS,
    scenarios: SCENARIOS,
    buildAcSystems,
    atmosphericPressureKpa,
    airDensityRatio,
    humidityRatio,
    humidityGrains,
    distributionLossAdder,
    sanitizeInputs,
    calculateScenario,
    calculateAll,
    recommendAc,
    recommendFurnace,
    recommendationSummary
  });
});
