# Dometic RV BTU calculator

Static heating and cooling planning calculator with Dometic equipment comparisons and individual, measured RV slide-outs.

Open `index.html` or serve this directory with `python -m http.server 8765 --bind 127.0.0.1`. No build or runtime packages are required. Keep `index.html`, `calculator.js`, `slide-outs.js` and the `assets/products` folder together when deploying.

Install test-only dependencies with `npm ci`, then run regression tests with `npm test`; check JavaScript syntax with `npm run check` (Node 24.15+).

See [the slide-out engineering model](docs/slide-out-model.md) for geometry, heat transfer, inputs, API migration, assumptions, test coverage and remaining validation gaps. This is an RV planning model, not certified HVAC sizing software.

The catalog contains **20 Dometic products: eight A/C configurations and 12 furnaces**, with photos and official links. Browse by equipment type, model, SKU or capacity. Automatic suggestions retain the original three cooling and six delivered-heating capacity tiers; added models appear as same-capacity alternatives. Cooling selects the smallest sufficient single model first; larger loads use the fewest rooftop units, up to four, then the smallest sufficient combined capacity, up to 60,000 BTU/hr. A/C and furnace results share one product-card layout. Heating uses one furnace's published delivered output, up to 30,400 BTU/hr. The two added heat-pump configurations are compared by cooling capacity; their heating output is not used for sizing. These are capacity planning suggestions. See [equipment catalog and matching rules](docs/equipment-catalog.md) for sources, dates, the multi-unit selection policy and installation limits.
