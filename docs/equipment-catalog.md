# Match calculated loads to Dometic equipment

The calculator keeps the calculated RV load and equipment suggestion separate. A calculated load such as 13,800 BTU/hr comes from the heat-transfer model. Suggestions use the nine products hardcoded in `index.html`: one A/C where sufficient, a two-A/C planning combination for higher cooling loads, or one furnace matched by delivered heat output.

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

The HE capacity is explicitly approximate in Dometic's description. Its display, any pair containing it, and its capacity margin carry the approximation. The two other listed capacities are nominal ratings; actual design-condition performance still needs verification. Selected configurations need the appropriate distribution box or return grille and control kit; these may be sold separately.

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
2. For positive cooling loads up to 15,000 BTU/hr, select the smallest listed single A/C capacity at or above the load. Only when no single model covers the load, consider every unordered pair of the three listed models, allowing two of the same model. Select the pair with the smallest summed nominal capacity at or above the load.
3. Above 30,000 cooling BTU/hr, no combination in this two-unit planning scope covers the load. Show no recommended cooling match and identify the remaining shortfall.
4. For heating, select the smallest of the six furnaces whose **delivered output** meets the load. Above 30,400 delivered heating BTU/hr, show no listed furnace match and call for a professional assessment of a larger or zoned heating system. Do not generate furnace combinations.
5. Show neighboring capacity choices and label any selected insufficient choice explicitly. For an exactly zero load, show no equipment recommendation. Reject negative/nonfinite/non-numeric loads.
6. Display each selected product's quantity, model number and SKU, with its product and rating-source links. A pair is a planning sum of two listed products, not a new model or an installed-zone sizing guarantee. Keep the existing source snapshot date and scope visible.

The available pair totals are:

| A/C combination | Combined cooling BTU/hr |
| --- | ---: |
| 2 x FJX5357MHE | approximately 22,000 |
| FJX5357MHE + FJX5457M | approximately 24,500 |
| FJX5357MHE + FJX5557M | approximately 26,000 |
| 2 x FJX5457M | 27,000 |
| FJX5457M + FJX5557M | 28,500 |
| 2 x FJX5557M | 30,000 |

Examples: 13,800 cooling selects one FJX5557M. A 27,000 cooling load selects two FJX5457M units; 28,000 selects FJX5457M plus FJX5557M. A 20,000 heating load selects DFMD30121 (22,800 delivered), because DFMD25121 delivers 19,000 despite its 25K input label.

## Basis and limits of the two-A/C policy

The single-first rule and sorted pair sums are this calculator's transparent planning policy. They are not a manufacturer-prescribed combination list or a universal sizing rule. Dometic's [RV A/C buying guide](https://www.dometic.com/en-us/lp/ac-buying-guide2) explains that vehicle size, insulation and air distribution affect the choice and that some RVs need more than one unit. The [FreshJet mechanical installation manual](https://media.dometic.com/externalassets/dometic-freshjet-3-series-13-5k_9600028598_107740.pdf) requires suitable roof support/openings and electrical provision; adding capacities does not verify those requirements or each zone's load and airflow.

Mixed-capacity designs exist in OEM practice: the [2026 Jayco Precept](https://www.jayco.com/rvs/class-a-motorhomes/2026-precept/) lists a 15,000 BTU A/C with heat pump and a second 13,500 BTU A/C. That is a different vehicle and equipment configuration, not certification of any Dometic pair proposed here.

The exact [FJX5357MHE](https://www.dometic.com/en/product/dometic-freshjet-5-series-mechanical-high-efficiency-75), [FJX5457M](https://www.dometic.com/en-us/product/dometic-freshjet-5-series-mechanical-13-5k-4) and [FJX5557M](https://www.dometic.com/en-us/product/dometic-freshjet-5-series-15k-4) product pages specify cooling-only configurations. Their cooling capacities are never counted toward heating. A/C and furnace recommendations are independent capacity matches. The app does not certify a compatible thermostat/control pairing, roof opening, electrical service, gas system, duct/static-pressure setup, venting, installation, staging or performance at the chosen weather/altitude. An installer must verify those details. Higher-than-needed capacities retain the existing oversizing cautions.

Product images are sourced from the exact SKU pages; see [image provenance](../assets/products/README.md). Dometic reuses FreshJet 5 and medium-furnace family imagery for some variants, so model numbers and SKUs identify the actual recommendation. The nine allowed products and capacity ratings in the supplied table remain unchanged.

## Maintenance and validation

The website has no runtime network or catalog service dependency. Publish `index.html`, `calculator.js`, `slide-outs.js` and the `assets/products` folder together. Edit the inline catalog in `index.html` to change the allowed products. Reverify the official listing and rating sources before updating records, adding variants or treating the snapshot as current at a later date; update `checkedAt` and the source documentation together. Remove a delisted/unverified record from automatic matching rather than guessing its replacement or delivered output. Keep capacity class, SKU variant, approximate status and source distinct.

Run `npm ci`, `npm run check` and `npm test` with Node 24.15+. Catalog and interaction checks cover the supplied product ratings, exact capacity thresholds, invalid/zero/excess loads, model/SKU/source provenance, approximate HE ratings, single-first and two-unit cooling suggestions, selected-product links, insufficient-selection messaging, equipment modes and immutable API snapshots. Use the current test output for pass counts.

DOM tests validate script loading and interactions. They do not establish dealer stock or empirical HVAC performance.
