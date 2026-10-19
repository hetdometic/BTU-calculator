/* Shared, dependency-free RV load model. See docs/slide-out-model.md. */
(function (root, factory) {
  "use strict";
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  else root.RVBTUEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const sum = (object) => Object.values(object).reduce((total, value) => total + value, 0);
  const scenarios = {
    low: { r: 1.20, ach: 0.70, u: 0.90, solar: 0.85, gains: 0.85, duct: -0.03 },
    expected: { r: 1, ach: 1, u: 1, solar: 1, gains: 1, duct: 0 },
    high: { r: 0.75, ach: 1.50, u: 1.10, solar: 1.15, gains: 1.15, duct: 0.05 }
  };

  function invalid(field, message) {
    const error = new RangeError(message);
    error.field = field;
    throw error;
  }

  function number(value, field, min = 0, max = Infinity, exclusiveMin = false) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (exclusiveMin && value === min)) {
      invalid(field, `${field}: enter a finite number ${exclusiveMin ? "greater than" : "at least"} ${min}${max < Infinity ? ` and at most ${max}` : ""}.`);
    }
    return value;
  }

  function atmosphericPressureKpa(altitudeFt) {
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
    return subtotal * clamp(lossFraction, 0, 0.30);
  }

  function normalizeSlide(raw, inputs, index) {
    const path = `slideOuts.${index}`;
    if (!raw || typeof raw !== "object") invalid(path, `Slide ${index + 1}: invalid slide data.`);
    if (raw.deployed != null && typeof raw.deployed !== "boolean") invalid(`${path}.deployed`, "Deployed must be true or false.");
    if (raw.conditioned != null && typeof raw.conditioned !== "boolean") invalid(`${path}.conditioned`, "Conditioned must be true or false.");
    if (raw.deployed === false) return { ...raw, deployed: false };
    if (raw.conditioned === false) invalid(path, "Unconditioned deployed slides require a separate buffer-zone model; this calculator supports slides open to the conditioned cabin.");
    const slide = { ...raw, deployed: true };
    const inherited = [];
    const positive = (key, fallback) => {
      if (slide[key] == null && fallback !== undefined) { slide[key] = fallback; inherited.push(key); }
      return number(slide[key], `${path}.${key}`, 0, Infinity, true);
    };
    slide.lengthFt = positive("lengthFt");
    slide.depthFt = positive("depthFt");
    if (slide.depthFt > 10) invalid(`${path}.depthFt`, `Slide ${index + 1}: extension depth must not exceed 10 ft.`);
    slide.heightFt = positive("heightFt", inputs.height);
    for (const key of ["wallR", "roofR", "floorR", "windowU"]) slide[key] = positive(key, inputs[key]);
    if (slide.shgc == null) { slide.shgc = inputs.shgc; inherited.push("shgc"); }
    number(slide.shgc, `${path}.shgc`, 0, 1);
    slide.thermalBridgeFactor = number(slide.thermalBridgeFactor ?? 1, `${path}.thermalBridgeFactor`, 1, 2);
    slide.windowShading = number(slide.windowShading ?? 1, `${path}.windowShading`, 0, 1);
    slide.roofShading = number(slide.roofShading ?? 1, `${path}.roofShading`, 0, 1);
    slide.extraLeakageCfm = number(slide.extraLeakageCfm ?? 0, `${path}.extraLeakageCfm`, 0, 500);
    slide.side = slide.side ?? "left";
    if (!["left", "right"].includes(slide.side)) invalid(`${path}.side`, "Choose the left or right RV sidewall.");
    slide.offsetFt = number(slide.offsetFt ?? 0, `${path}.offsetFt`);
    if (slide.offsetFt + slide.lengthFt > inputs.length + 1e-9) invalid(`${path}.offsetFt`, `Slide ${index + 1}: opening must fit along the RV body length.`);
    if (slide.heightFt > inputs.height) invalid(`${path}.heightFt`, `Slide ${index + 1}: slide height cannot exceed the RV interior height.`);
    slide.supply = slide.supply ?? "unknown";
    if (!["direct", "mixing", "unknown"].includes(slide.supply)) invalid(`${path}.supply`, "Choose an HVAC supply option.");
    for (const [key, area] of [["outerWindowAreaFt2", slide.lengthFt * slide.heightFt], ["end1WindowAreaFt2", slide.depthFt * slide.heightFt], ["end2WindowAreaFt2", slide.depthFt * slide.heightFt]]) {
      slide[key] = number(slide[key] ?? 0, `${path}.${key}`);
      if (slide[key] > area) invalid(`${path}.${key}`, `Slide ${index + 1}: window area exceeds the ${key === "outerWindowAreaFt2" ? "outer" : "end"} wall area (${area.toFixed(1)} sq ft).`);
    }
    slide.inherited = inherited;
    return slide;
  }

  function validateInputs(inputs) {
    if (!inputs || typeof inputs !== "object") invalid("inputs", "Provide RV inputs.");
    for (const key of ["length", "width", "height", "wallR", "roofR", "floorR", "doorR", "windowU"]) number(inputs[key], key, 0, Infinity, true);
    for (const key of ["windowArea", "ach", "ventilationCfm", "internalWatts", "internalDuty", "people"]) number(inputs[key], key);
    for (const key of ["coolIndoor", "coolOutdoor", "heatIndoor", "heatOutdoor"]) number(inputs[key], key, -100, 150);
    for (const key of ["indoorRh", "outdoorRh"]) number(inputs[key], key, 0, 100);
    number(inputs.shgc, "shgc", 0, 1);
    number(inputs.altitude, "altitude", 0, 14000);
    for (const key of ["coolDuctLoss", "heatDuctLoss"]) number(inputs[key], key, 0, 0.30);
    for (const key of ["roof", "wall", "window"]) number(inputs.sun?.[key], `sun.${key}`);
    if (inputs.slides != null && inputs.slides !== 0) invalid("slides", "Slide count alone is no longer supported. Provide measured slideOuts instead.");
    if (!Array.isArray(inputs.slideOuts ?? [])) invalid("slideOuts", "slideOuts must be an array.");
    if ((inputs.slideOuts ?? []).length > 5) invalid("slideOuts", "This calculator supports up to five slide-outs.");
    const slides = (inputs.slideOuts ?? []).map((slide, i) => normalizeSlide(slide, inputs, i));
    const active = slides.map((slide, i) => ({ slide, i })).filter(({ slide }) => slide.deployed);
    for (let a = 0; a < active.length; a += 1) {
      for (let b = a + 1; b < active.length; b += 1) {
        const first = active[a].slide;
        const second = active[b].slide;
        if (first.side === second.side && Math.min(first.offsetFt + first.lengthFt, second.offsetFt + second.lengthFt) - Math.max(first.offsetFt, second.offsetFt) > 1e-9) {
          invalid(`slideOuts.${active[b].i}.offsetFt`, `Slides ${active[a].i + 1} and ${active[b].i + 1} have overlapping openings on the ${first.side} sidewall.`);
        }
      }
    }
    const wallGross = 2 * (inputs.length + inputs.width) * inputs.height;
    const doorArea = Math.min(18, wallGross * 0.08);
    const openingArea = active.reduce((area, { slide }) => area + slide.lengthFt * slide.heightFt, 0);
    if (inputs.windowArea + doorArea + openingArea > wallGross + 1e-9) invalid("windowArea", "Main-body windows, entry door and slide attachment openings exceed the remaining RV wall area. Exclude slide windows from main-body windows.");
    return slides;
  }

  // Expects a normalized, deployed slide. No fourth wall exists at the attachment.
  function slideGeometry(slide) {
    const L = slide.lengthFt, D = slide.depthFt, H = slide.heightFt;
    const windows = slide.outerWindowAreaFt2 + slide.end1WindowAreaFt2 + slide.end2WindowAreaFt2;
    return {
      addedFloorFt2: L * D, addedVolumeFt3: L * D * H,
      roofFt2: L * D, undersideFt2: L * D,
      outerWallFt2: L * H, endWallsFt2: 2 * D * H,
      grossVerticalFt2: L * H + 2 * D * H,
      windowAreaFt2: windows, opaqueVerticalFt2: L * H + 2 * D * H - windows,
      attachmentOpeningFt2: L * H,
      grossEnvelopeFt2: 2 * L * D + L * H + 2 * D * H,
      netAddedEnvelopeFt2: 2 * L * D + 2 * D * H,
      sealPerimeterFt: 2 * (L + H)
    };
  }

  function calculateSlideGeometry(slide, inputs) {
    const normalized = normalizeSlide(slide, inputs, 0);
    if (!normalized.deployed) return null;
    return slideGeometry(normalized);
  }

  function calculateScenario(inputs, variant = "expected") {
    const scenario = scenarios[variant];
    if (!scenario) invalid("variant", "Choose low, expected, or high.");
    const slides = validateInputs(inputs);
    const floorArea = inputs.length * inputs.width;
    const roofArea = floorArea;
    const wallGross = 2 * (inputs.length + inputs.width) * inputs.height;
    const doorArea = Math.min(18, wallGross * 0.08);
    const windowArea = inputs.windowArea;
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
    const grainDifference = Math.max(humidityGrains(inputs.coolOutdoor, inputs.outdoorRh, inputs.altitude) - humidityGrains(inputs.coolIndoor, inputs.indoorRh, inputs.altitude), 0);

    // Preserve the previously audited no-slide model and component names.
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
    cooling.outsideAirLatent = 0.68 * coolDensity * outsideCfm * grainDifference;
    cooling.peopleLatent = 200 * inputs.people * scenario.gains;
    const coolingSubtotal = sum(cooling);
    cooling.duct = distributionLossAdder(coolingSubtotal, coolDuct);
    const heating = {
      walls: wallArea / (inputs.wallR * scenario.r) * heatDelta,
      roof: roofArea / (inputs.roofR * scenario.r) * heatDelta,
      floor: floorArea / (inputs.floorR * scenario.r) * heatDelta,
      door: doorArea / (inputs.doorR * scenario.r) * heatDelta,
      windows: windowArea * inputs.windowU * scenario.u * heatDelta,
      outsideAir: 1.08 * heatDensity * outsideCfm * heatDelta
    };
    const heatingSubtotal = sum(heating);
    heating.duct = distributionLossAdder(heatingSubtotal, heatDuct);
    const base = { coolingTotal: coolingSubtotal + cooling.duct, heatingTotal: heatingSubtotal + heating.duct };
    const geometry = { floorArea, roofArea, wallArea, windowArea, doorArea, volume, infiltrationCfm,
      mainFloorArea: floorArea, mainVolume: volume, mainWindowArea: windowArea,
      attachmentOpeningArea: 0, slideFloorArea: 0, slideVolume: 0,
      slideOuterWallArea: 0, slideEndWallArea: 0, slideRoofArea: 0, slideUndersideArea: 0,
      slideWindowArea: 0, extraSealCfm: 0 };
    const warnings = [];

    const slideResults = slides.map((slide, index) => {
      if (!slide.deployed) return { index, deployed: false, geometry: null, coolingTotal: 0, heatingTotal: 0, cooling: {}, heating: {}, warnings: ["Retracted slide excluded; retracted shell and interior airflow are approximated by the base RV box."] };
      const g = slideGeometry(slide);
      const bridge = slide.thermalBridgeFactor;
      const airCfm = (inputs.ach * g.addedVolumeFt3 / 60 + slide.extraLeakageCfm) * scenario.ach;
      const removedCool = g.attachmentOpeningFt2 / (inputs.wallR * scenario.r) * (coolDelta + inputs.sun.wall * scenario.solar);
      const removedHeat = g.attachmentOpeningFt2 / (inputs.wallR * scenario.r) * heatDelta;
      const c = {
        walls: bridge * g.opaqueVerticalFt2 / (slide.wallR * scenario.r) * (coolDelta + inputs.sun.wall * scenario.solar) - removedCool,
        roof: bridge * g.roofFt2 / (slide.roofR * scenario.r) * (coolDelta + inputs.sun.roof * slide.roofShading * scenario.solar),
        floor: bridge * g.undersideFt2 / (slide.floorR * scenario.r) * coolDelta,
        windowConduction: g.windowAreaFt2 * slide.windowU * scenario.u * coolDelta,
        windowSolar: g.windowAreaFt2 * slide.shgc * inputs.sun.window * slide.windowShading * scenario.solar,
        outsideAirSensible: 1.08 * coolDensity * airCfm * coolDelta,
        outsideAirLatent: 0.68 * coolDensity * airCfm * grainDifference
      };
      const h = {
        walls: bridge * g.opaqueVerticalFt2 / (slide.wallR * scenario.r) * heatDelta - removedHeat,
        roof: bridge * g.roofFt2 / (slide.roofR * scenario.r) * heatDelta,
        floor: bridge * g.undersideFt2 / (slide.floorR * scenario.r) * heatDelta,
        windows: g.windowAreaFt2 * slide.windowU * scenario.u * heatDelta,
        outsideAir: 1.08 * heatDensity * airCfm * heatDelta
      };
      c.duct = distributionLossAdder(sum(c), coolDuct);
      h.duct = distributionLossAdder(sum(h), heatDuct);
      for (const [key, value] of Object.entries(c)) cooling[key] += value;
      for (const [key, value] of Object.entries(h)) heating[key] += value;
      geometry.floorArea += g.addedFloorFt2;
      geometry.roofArea += g.roofFt2;
      geometry.wallArea += g.opaqueVerticalFt2 - g.attachmentOpeningFt2;
      geometry.windowArea += g.windowAreaFt2;
      geometry.volume += g.addedVolumeFt3;
      geometry.infiltrationCfm += airCfm;
      geometry.attachmentOpeningArea += g.attachmentOpeningFt2;
      geometry.slideFloorArea += g.addedFloorFt2;
      geometry.slideVolume += g.addedVolumeFt3;
      geometry.slideOuterWallArea += g.outerWallFt2;
      geometry.slideEndWallArea += g.endWallsFt2;
      geometry.slideRoofArea += g.roofFt2;
      geometry.slideUndersideArea += g.undersideFt2;
      geometry.slideWindowArea += g.windowAreaFt2;
      geometry.extraSealCfm += slide.extraLeakageCfm * scenario.ach;
      const notes = [];
      if (slide.inherited.length) notes.push(`Inherited from main RV: ${slide.inherited.map(key => ({ heightFt: "height", wallR: "wall insulation", roofR: "roof insulation", floorR: "underside insulation", windowU: "window U-factor", shgc: "window SHGC" })[key]).join(", ")}. Verify slide construction and glazing.`);
      notes.push("Slide windows must be measured separately from main-body windows; mixed-sun solar exposure is an assumption.");
      if (slide.extraLeakageCfm === 0) notes.push("Whole-RV ACH applies to added volume. No additional slide-seal leakage is assumed; seal leakage is unmeasured.");
      if (bridge > 1) notes.push("Thermal-bridge multiplier is user supplied; it is not an RV-validated coefficient.");
      if (slide.supply !== "direct") notes.push("Verify airflow into this slide. Adequate total capacity does not establish local comfort; no arbitrary capacity penalty is added.");
      return { index, deployed: true, geometry: g, coolingTotal: sum(c), heatingTotal: sum(h), cooling: c, heating: h,
        removedMainWall: { cooling: removedCool, heating: removedHeat }, infiltrationCfm: airCfm,
        effective: { wallR: slide.wallR / bridge, roofR: slide.roofR / bridge, floorR: slide.floorR / bridge, windowU: slide.windowU, shgc: slide.shgc }, warnings: notes };
    });
    const slideCooling = slideResults.reduce((total, slide) => total + slide.coolingTotal, 0);
    const slideHeating = slideResults.reduce((total, slide) => total + slide.heatingTotal, 0);
    if (slideResults.length) warnings.push("Rectangular, flush, fully extended slide geometry; all deployed slides share the conditioned cabin. Solar exposure, seals and actual assembly R-values need verification.");
    const coolingTotal = base.coolingTotal + slideCooling;
    const heatingTotal = base.heatingTotal + slideHeating;
    if (![coolingTotal, heatingTotal, ...Object.values(geometry), ...Object.values(cooling), ...Object.values(heating)].every(Number.isFinite)) invalid("inputs", "Inputs exceed the numerical range of this planning model.");
    return {
      coolingTotal, heatingTotal,
      cooling, heating, geometry, base, slideResults,
      slideContribution: { coolingTotal: slideCooling, heatingTotal: slideHeating }, warnings,
      air: { coolDensity, heatDensity, pressureKpa: atmosphericPressureKpa(inputs.altitude) }
    };
  }

  return Object.freeze({ calculateScenario, calculateSlideGeometry, validateInputs, atmosphericPressureKpa, airDensityRatio, humidityGrains });
});
