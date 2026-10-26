# Match calculated loads to Dometic equipment

The calculator keeps the calculated RV load and equipment recommendation separate. A calculated load such as 13,800 BTU/hr comes from the heat-transfer model. Recommendations select only individual products from the nine-model list hardcoded in `index.html`; no combined-unit capacity plans are generated.

The inline `<script id="equipmentCatalog">` in `index.html` contains the supplied three A/C models and six furnaces below. Its source snapshot was checked on **2026-10-20**, using official manufacturer pages and furnace technical-data tables. That existing date is retained; this change does not reverify the ratings. The slide-out and base-load equations in `calculator.js` are unchanged.

## Verified scope

The automatic catalog covers three low-profile FreshJet 5 rooftop model types and six representative **12 V DC, LP-gas** furnace models listed in Dometic's US catalog. It is a subset of Dometic's offerings, not a complete worldwide catalog. Different colors, control configurations, door variants, heat-pump versions, other families, OEM bulk packs and 120 V AC furnaces are not interchangeable selections in this snapshot.

“Listed” means observed on the official catalog/product pages at the check date. It does not mean live dealer stock, an explicit manufacturer lifecycle guarantee, a complete installation package, or confirmed suitability for a particular RV. Prices and rebate offers are not used.

## Rooftop cooling models

| Model on manufacturer listing | Representative SKU | Nominal cooling BTU/hr | Manufacturer product / rating page |
| --- | --- | ---: | --- |
| FJX5357MHE | 9620015929 | approximately 11,000 | [FreshJet 5 Mechanical High Efficiency](https://www.dometic.com/en/product/dometic-freshjet-5-series-mechanical-high-efficiency-75) |
| FJX5457M | 9620015924 | 13,500 | [FreshJet 5 Mechanical 13.5K](https://www.dometic.com/en-us/product/dometic-freshjet-5-series-mechanical-13-5k-4) |
| FJX5557M | 9620015927 | 15,000 | [FreshJet 5 Series 15K](https://www.dometic.com/en-us/product/dometic-freshjet-5-series-15k-4) |

The [US rooftop category at the snapshot date](https://www.dometic.com/en-us/category/rv-and-van/rv-air-conditioners/rooftop-rv-air-conditioners) lists these FreshJet 5 capacity classes. The HE product's official global-English detail page supplies its code, SKU and approximate capacity; its 115 V / 60 Hz configuration and US family listing were cross-checked. Dometic's [2026 model/SKU sheet, page 3](https://mediabank.dometic.com/deployedFiles/4510414325f2f5f0efab6bb8cb10162e.pdf?v=20260327204754#page=3) independently pairs these model numbers with their item numbers. That sheet's rebate period has expired; no rebate is represented as current.

The HE capacity is explicitly approximate in Dometic's description. Its display and capacity margin carry the approximation. The two other listed capacities are nominal ratings; actual design-condition performance still needs verification. Selected configurations need the appropriate distribution box or return grille and control kit; these may be sold separately.

## Furnace models and delivered heat

All six were observed in the [US furnace category at the snapshot date](https://www.dometic.com/en-us/category/rv-and-van/heating-solutions/rv-furnaces). Input is fuel consumption; output is the published heat-delivery rating used by the matcher.

| Selected model / product page | SKU | Fuel input BTU/hr | Delivered output BTU/hr | Manual table |
| --- | --- | ---: | ---: | --- |
| [DFSAD12111](https://www.dometic.com/en-us/product/dometic-dfsad12111-small-furnace-9108923336) | 9108923336 | 12,000 | 9,120 | 2: DFSAD12 |
| [DFSD20111](https://www.dometic.com/en-us/product/dometic-dfsd20111-small-furnace-9600001165) | 9600001165 | 18,000 | 13,680 | 2: DFSD20 |
| [DFMD25121](https://www.dometic.com/en-us/product/dometic-dfmd25121-medium-furnace-9600000890) | 9600000890 | 25,000 | 19,000 | 3: DFMD25 |
| [DFMD30121](https://www.dometic.com/en-us/product/dometic-dfmd30121-medium-furnace-9600000926) | 9600000926 | 30,000 | 22,800 | 3: DFMD30 |
| [DFMDH35121](https://www.dometic.com/en-us/product/dometic-dfmdh35121-medium-35k-furnace-essential-9610007794) | 9610007794 | 35,000 | 25,840 | 3: DFMDH35 |
| [DFLD40111](https://www.dometic.com/en-us/product/dometic-dfld40111-large-furnace-9108923369) | 9108923369 | 40,000 | 30,400 | 4: DFLD40 |

Rating source: [Dometic DF Series Operating Manual, English technical data, page 7 / Tables 2–4](https://media.dometic.com/externalassets/dometic-medium-furnace_9610007793_81453.pdf#page=7). The tables were visually checked to confirm column alignment. Model prefixes connect the full product number to the table's family. DFSD20 has 18,000 input, not an inferred 20,000. Table 3 explicitly includes DFMDH35; its stated output is used directly rather than calculating output from the web page's efficiency percentage. Final variant/data-plate confirmation remains necessary.

## Selection rules

1. Read the **unrounded expected load** from the existing physics model. Rounded display values do not decide a capacity threshold.
2. For A/C, select the smallest compared nominal capacity at or above that load. For heating, select the smallest published **delivered output** at or above the required heat.
3. Each choice is one of the three listed A/C models or six listed furnaces. No additional capacities or multi-unit combinations are generated.
4. Show the neighboring lower and higher capacity choices. If the user selects an insufficient option, say explicitly that it does not cover the expected load. Above the largest listed product of that type, show no recommended match; a highest-option comparison remains labeled insufficient. The maximum listed capacities are 15,000 cooling and 30,400 delivered heating BTU/hr.
5. For an exactly zero load, show no equipment recommendation. Reject negative/nonfinite/non-numeric loads.
6. Link each selected product to its product page and rating source, displaying its model number, SKU and configuration. Keep the source snapshot date and scope visible.

Examples: 13,800 cooling selects the 15,000-rated FJX5557M. A 30,000 cooling load has no matching product. A 20,000 heating load selects DFMD30121 (22,800 delivered), because DFMD25121 delivers only 19,000 despite its 25K input label.

A/C and furnace recommendations are independent capacity matches. The app does not certify a compatible thermostat/control pairing, roof opening, electrical service, gas system, duct/static-pressure setup, venting, installation, staging or performance at the chosen weather/altitude. An installer must verify those details. Higher-than-needed capacities retain the existing oversizing cautions.

Product images are sourced from the exact SKU pages; see [image provenance](../assets/products/README.md). Dometic reuses FreshJet 5 and medium-furnace family imagery for some variants, so model numbers and SKUs identify the actual recommendation. The nine allowed products and capacity ratings in the supplied table remain unchanged.

## Maintenance and validation

The website has no runtime network or catalog service dependency. Publish `index.html`, `calculator.js`, `slide-outs.js` and the `assets/products` folder together. Edit the inline catalog in `index.html` to change the allowed products. Reverify the official listing and rating sources before updating records, adding variants or treating the snapshot as current at a later date; update `checkedAt` and the source documentation together. Remove a delisted/unverified record from automatic matching rather than guessing its replacement or delivered output. Keep capacity class, SKU variant, approximate status and source distinct.

Run `npm ci`, `npm run check` and `npm test` with Node 24.15+. Catalog and interaction checks cover the supplied product ratings, exact capacity thresholds, invalid/zero/excess loads, model/SKU/source provenance, approximate HE ratings, single-model suggestions, selected-product links, insufficient-selection messaging, equipment modes and immutable API snapshots. Use the current test output for pass counts.

DOM tests validate script loading and interactions. They do not establish dealer stock or empirical HVAC performance.
