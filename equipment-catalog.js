/* Curated Dometic US catalog snapshot. Sources and scope: docs/equipment-catalog.md. */
(function (root, factory) {
  "use strict";
  const catalog = factory();
  if (typeof module === "object" && module.exports) module.exports = catalog;
  else root.RVBTUEquipment = catalog;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const checkedAt = "2026-10-20";
  const acListing = "https://www.dometic.com/en-us/category/rv-and-van/rv-air-conditioners/rooftop-rv-air-conditioners";
  const furnaceListing = "https://www.dometic.com/en-us/category/rv-and-van/heating-solutions/rv-furnaces";
  const furnaceManual = "https://media.dometic.com/externalassets/dometic-medium-furnace_9610007793_81453.pdf#page=7";
  const freeze = (object) => {
    for (const value of Object.values(object)) if (value && typeof value === "object") freeze(value);
    return Object.freeze(object);
  };
  const acModels = [
    {
      id: "fj11", modelNumber: "FJX5357MHE", sku: "9620015929",
      name: "Dometic FreshJet 5 High Efficiency", capacity: 11000, approximate: true,
      configuration: "White · mechanical-ready · 115 V AC, 60 Hz · R32",
      productUrl: "https://www.dometic.com/en/product/dometic-freshjet-5-series-mechanical-high-efficiency-75",
      ratingNote: "Dometic describes this as approximately 11,000 BTU/hr. It is an approximate capacity class.",
      ratingBasis: "Manufacturer product description and Cooling Capacity Display; approximate",
      listingSourceUrl: acListing
    },
    {
      id: "fj135", modelNumber: "FJX5457M", sku: "9620015924",
      name: "Dometic FreshJet 5 Mechanical 13.5K", capacity: 13500, approximate: false,
      configuration: "White · mechanical-ready · 115 V AC, 60 Hz · R32",
      productUrl: "https://www.dometic.com/en-us/product/dometic-freshjet-5-series-mechanical-13-5k-4",
      ratingNote: "13,500 BTU/hr nominal cooling. Required air distribution box or return grille/control kit is sold separately.",
      ratingBasis: "Manufacturer product description: 13,500 BTU",
      listingSourceUrl: acListing
    },
    {
      id: "fj15", modelNumber: "FJX5557M", sku: "9620015927",
      name: "Dometic FreshJet 5 Mechanical 15K", capacity: 15000, approximate: false,
      configuration: "Black · mechanical-ready · 115 V AC, 60 Hz · R32 · cool only",
      productUrl: "https://www.dometic.com/en-us/product/dometic-freshjet-5-series-15k-4",
      ratingNote: "15,000 BTU/hr nominal cooling. Required air distribution box or return grille/control kit is sold separately.",
      ratingBasis: "Manufacturer product description: 15,000 BTU",
      listingSourceUrl: acListing
    }
  ].map((model) => ({ ...model, kind: "ac", market: "US", listingStatus: "listed", checkedAt, ratingSourceUrl: model.productUrl }));

  const furnaceModels = [
    {
      id: "f12", modelNumber: "DFSAD12111", sku: "9108923336",
      name: "Dometic DFSAD12111 Small Furnace", input: 12000, output: 9120,
      configuration: "Doored · LP gas · 12 V DC · low amp",
      productUrl: "https://www.dometic.com/en-us/product/dometic-dfsad12111-small-furnace-9108923336",
      ratingBasis: "DF series operating manual, Table 2: DFSAD12"
    },
    {
      id: "f18", modelNumber: "DFSD20111", sku: "9600001165",
      name: "Dometic DFSD20111 Small Furnace", input: 18000, output: 13680,
      configuration: "Doored · LP gas · 12 V DC",
      productUrl: "https://www.dometic.com/en-us/product/dometic-dfsd20111-small-furnace-9600001165",
      ratingBasis: "DF series operating manual, Table 2: DFSD20 (18,000 input, despite model number)"
    },
    {
      id: "f25", modelNumber: "DFMD25121", sku: "9600000890",
      name: "Dometic DFMD25121 Medium Furnace", input: 25000, output: 19000,
      configuration: "Doorless · LP gas · 12 V DC",
      productUrl: "https://www.dometic.com/en-us/product/dometic-dfmd25121-medium-furnace-9600000890",
      ratingBasis: "DF series operating manual, Table 3: DFMD25"
    },
    {
      id: "f30", modelNumber: "DFMD30121", sku: "9600000926",
      name: "Dometic DFMD30121 Medium Furnace", input: 30000, output: 22800,
      configuration: "Doorless · LP gas · 12 V DC",
      productUrl: "https://www.dometic.com/en-us/product/dometic-dfmd30121-medium-furnace-9600000926",
      ratingBasis: "DF series operating manual, Table 3: DFMD30"
    },
    {
      id: "f35", modelNumber: "DFMDH35121", sku: "9610007794",
      name: "Dometic DFMDH35121 Furnace Essential", input: 35000, output: 25840,
      configuration: "Doorless · LP gas · 12 V DC · Hall Effect Sensor / Soft Start",
      productUrl: "https://www.dometic.com/en-us/product/dometic-dfmdh35121-medium-35k-furnace-essential-9610007794",
      ratingBasis: "DF series operating manual, Table 3 explicitly includes DFMDH35; delivered output is not inferred from web-page efficiency"
    },
    {
      id: "f40", modelNumber: "DFLD40111", sku: "9108923369",
      name: "Dometic DFLD40111 Large Furnace", input: 40000, output: 30400,
      configuration: "Doored · LP gas · 12 V DC",
      productUrl: "https://www.dometic.com/en-us/product/dometic-dfld40111-large-furnace-9108923369",
      ratingBasis: "DF series operating manual, Table 4: DFLD40"
    }
  ].map((model) => ({ ...model, kind: "furnace", market: "US", listingStatus: "listed", checkedAt,
    listingSourceUrl: furnaceListing, ratingSourceUrl: furnaceManual,
    ratingNote: "Match required heat against delivered output. Input BTU/hr describes fuel consumption, not heat delivered to the RV." }));

  const models = freeze([...acModels, ...furnaceModels]);
  const byId = new Map(models.map((model) => [model.id, model]));

  function buildAcSystems() {
    const plans = [];
    const build = (unitCount, startIndex = 0, selected = []) => {
      if (selected.length === unitCount) {
        const capacity = selected.reduce((total, model) => total + model.capacity, 0);
        const approximate = selected.some((model) => model.approximate);
        const counts = new Map();
        selected.forEach((model) => counts.set(model.id, (counts.get(model.id) || 0) + 1));
        const components = [...counts].map(([modelId, quantity]) => ({ modelId, quantity }));
        plans.push({
          id: `ac-${selected.map((model) => model.id).join("-")}`, capacity, approximate,
          label: `${approximate ? "≈" : ""}${Number.isInteger(capacity / 1000) ? capacity / 1000 : (capacity / 1000).toFixed(1)}K BTU/hr`,
          detail: components.map(({ modelId, quantity }) => `${quantity > 1 ? `${quantity} × ` : ""}${byId.get(modelId).modelNumber}`).join(" + "),
          staged: unitCount > 1, unitCount, components,
          planType: unitCount > 1 ? "Multi-unit capacity plan" : "Single catalog model"
        });
        return;
      }
      for (let index = startIndex; index < acModels.length; index += 1) build(unitCount, index, [...selected, acModels[index]]);
    };
    for (let count = 1; count <= 3; count += 1) build(count);
    plans.sort((a, b) => a.capacity - b.capacity || a.unitCount - b.unitCount);
    const unique = new Map();
    plans.forEach((plan) => { if (!unique.has(plan.capacity)) unique.set(plan.capacity, plan); });
    return freeze([...unique.values()]);
  }
  const acSystems = buildAcSystems();
  const furnaceSystems = freeze(furnaceModels.map((model) => ({ ...model, label: `${model.input / 1000}K input`,
    detail: `${model.modelNumber} · ${model.output.toLocaleString("en-US")} BTU/hr delivered`,
    components: [{ modelId: model.id, quantity: 1 }], unitCount: 1 })));

  function select(load, systems, key) {
    if (typeof load !== "number" || !Number.isFinite(load) || load < 0) throw new RangeError("Calculated load must be a finite, nonnegative BTU/hr value.");
    if (load === 0) return null;
    return systems.find((system) => system[key] >= load) || null;
  }
  function modelsFor(system) {
    return system ? system.components.map(({ modelId, quantity }) => ({ model: byId.get(modelId), quantity })) : [];
  }
  return freeze({ checkedAt, models, acSystems, furnaceSystems, acListing, furnaceListing,
    recommendAc: (load) => select(load, acSystems, "capacity"),
    recommendFurnace: (load) => select(load, furnaceSystems, "output"), modelsFor });
});
