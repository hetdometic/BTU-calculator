# Dometic RV BTU calculator

Static heating and cooling planning calculator with Dometic equipment comparisons and individual, measured RV slide-outs.

Open `index.html` or serve this directory with `python -m http.server 8765 --bind 127.0.0.1`. No build or runtime packages are required. Keep `index.html`, `calculator.js` and `slide-outs.js` together when deploying.

Install test-only dependencies with `npm ci`, then run regression tests with `npm test`; check JavaScript syntax with `npm run check` (Node 24.15+).

See [the slide-out engineering model](docs/slide-out-model.md) for geometry, heat transfer, inputs, API migration, assumptions, test coverage and remaining validation gaps. This is an RV planning model, not certified HVAC sizing software.
