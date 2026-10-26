# RV slide-out load model

This change replaces the old `1 + 0.05 * slideCount` multiplier with measured rectangular slide geometry. It is a planning estimate, not a certified load calculation or evidence of real-RV accuracy. The attached “Engineering RV Slide-Outs Into an RV BTU Heating/Cooling Calculator” research informed the accounting and test cases; its sample code was reviewed rather than copied as a validated implementation.

## Scope and operation

Enter each slide in **Slide-outs** and choose **Apply slide-outs**. Length runs along the conditioned body; depth is the extension beyond the original body; height is the slide's conditioned height. Body width excludes slide extensions. Up to five slides are supported. No slide count or size is assumed from the RV type. Required length and depth have no guessed defaults.

Each deployed slide is open to the same conditioned cabin. Retracted slides contribute no deployed addition and use the base-box approximation; this does not simulate their actual retracted envelope or obstructed airflow. Unconditioned deployed rooms are unsupported because they need a separate thermal buffer-zone model. Current scope is full extension, rectangular boxes on the left or right sidewalls, and aligned floor levels.

Slide edits are a separate draft until Apply; Cancel restores the applied calculation. Applying or clearing main-RV Advanced options preserves measured slide inputs. Inherited slide properties follow the active main-RV properties. A body-dimension change that invalidates a slide hides the calculated recommendations and displays an error until corrected. No settings are persisted across page reloads, consistent with the prior calculator.

## Geometry and conservation

For length L, extension D and slide height H, in feet:

| Quantity | Calculation |
| --- | --- |
| Added conditioned floor, roof, exposed underside (each) | L × D |
| Added volume | L × D × H |
| Outer wall | L × H |
| Front and rear end walls combined | 2 × D × H |
| Main-wall attachment opening | L × H |
| Gross slide envelope | 2LD + LH + 2DH |
| Net additional envelope after removing opening | 2LD + 2DH |
| Moving-seal perimeter, informational only | 2(L + H) |

Subtract slide glazing from its own wall face. Remove the attachment opening **once** from the main body's opaque sidewall. There is no fourth exterior wall at the attachment. Roof and underside are both exposed to outdoor ambient temperature; neither is ground-contact floor area. A shorter slide uses its own height for volume and opening subtraction.

The opening is approximated as the same length and height as the outer slide face. Flanges, wall thickness, tapered/curved roofs, steps and actual rough-opening dimensions are not resolved. For 10 × 3 × 6.5 ft, the model adds 30 ft² floor, 195 ft³ volume, 65 ft² outer wall, 39 ft² end walls, 30 ft² roof and 30 ft² underside, then removes 65 ft² main wall. Twenty ft² of slide glazing leaves 84 ft² of opaque slide walls.

## Heating and cooling

Opaque heating uses `Q = A / R_effective × ΔT`. Window heating uses `Q = A × U × ΔT`. Slide heating is the new slide-wall, roof, underside and window loads minus the removed main-wall load, plus incremental outside-air and duct loads. Heating does not credit solar or internal gains. Keep signed deltas: a better-insulated replacement face can reduce the total load.

Cooling preserves the existing model: ambient conduction, simplified roof/wall solar temperature adders, window solar `A × SHGC × effective intensity × solar fraction`, outside-air sensible/latent heat, internal gains and duct allowance. New surfaces receive their own areas and thermal properties. The removed main-wall cooling term includes its existing wall solar adder. Shading affects solar only, not ambient conduction.

The existing mixed-sun defaults are 10°F roof adder, 3°F wall adder and 60 Btu/(h·ft²) effective window intensity. They are heuristic planning inputs, **not** location/orientation-specific ASHRAE design data. Solar fractions of 1 inherit mixed sun; 0 removes that surface's solar contribution. Window/end-wall orientations and coincident hourly peaks are not calculated. This is neither the complete ASHRAE Residential Load Factor method nor an hourly heat-balance implementation.

Airflow from the main-RV ACH uses **base volume plus added slide volumes once**. Additional slide-seal CFM is optional, defaults to zero, and is added once. Intentional ventilation is not duplicated. CFM must describe leakage at operating pressure; CFM50 or other blower-door test flows require a separate conversion and cannot be entered directly.

To preserve the audited base model, both main RV and slides use its customary coefficients: sensible `1.08 × densityRatio × CFM × ΔT` and latent cooling `0.68 × densityRatio × CFM × max(outdoorGrains − indoorGrains, 0)`. One grain is 1/7000 lb water per lb dry air. These rounded coefficients differ slightly from ASHRAE's rounded 1.1 sensible and 4840 humidity-ratio latent coefficients. Existing barometric-pressure, temperature-density and humidity functions are unchanged. Heating humidification is not modeled.

The existing duct percentage is an allowance on the subtotal, not a measured duct model. Apply it once to each signed increment; base plus increments then equals the expanded total. HVAC supply selection changes the airflow advisory, not capacity. Direct supply alone also does not establish airflow adequacy.

## Defaults, boundaries and validation

- Blank height, wall/roof/underside effective R, window U and SHGC inherit from the main RV. Construction presets remain assumptions, not manufacturer ratings.
- R is whole-assembly US R (h·ft²·°F/Btu); window U is Btu/(h·ft²·°F), including the frame. Entering advertised insulation-only R as effective R can underpredict load.
- The optional thermal-bridge multiplier defaults to 1 and increases slide opaque U only. A larger multiplier is an explicit user assumption for nominal R; no generic 1.15 RV correction is imposed. Do not apply it again to a known effective assembly R.
- Main-body window count/area **excludes slide windows**. Each slide has separate outer, front-end and rear-end glazing areas. The API uses separate fields rather than counting slide glass again in main glass.
- Glazing may not exceed its own wall face. Main windows plus the entry door and attachment openings may not exceed the main-body wall area. The main-window/door placement is not collected, so physical conflicts with individual attachment locations still require checking against plans.
- Sidewall opening intervals use length, side and offset from the body's front. Overlapping same-side openings, openings beyond the body, excess slide height, nonpositive dimensions/R/U, invalid enum values, out-of-range SHGC/shading, negative leakage, nonfinite inputs and more than five slides are rejected. Depth is limited to 10 ft. Touching opening boundaries and opposing slides are allowed.
- Legacy numeric `slides > 0` API overrides fail with a migration message. Use `slideOuts` with measured dimensions. `slides: 0` remains accepted for no-slide compatibility.

## Results and uncertainty

Results show base-RV load, signed aggregate slide contribution, total floor area, added volume, each slide's surfaces, the credited attachment opening, component heating/cooling loads and assumptions. The ordinary driver charts contain the expanded **physical component totals**; the per-slide table shows the deltas, avoiding counting those deltas a second time.

Low/expected/high preserve the existing scenario coefficients for effective insulation, window transfer, solar/internal gains, leakage and duct allowance. Extra seal CFM is also varied with leakage. These are sensitivity scenarios, not statistical confidence intervals or a demonstrated accuracy band. Defaults for unmeasured seal leakage do not imply airtight seals.

Unresolved validation gaps: measured slide assembly U/R and thermal bridges; operating leakage under wind/stack pressure; actual weather/design coincidence; orientation, solar absorptance and mutual shading; radiant sky/ground effects; shape and attachment details; duct/register flow and pressure balance; heat-soak/transient recovery; equipment performance at the selected weather/altitude. Capacity recommendations now use the separately [sourced equipment catalog](equipment-catalog.md); the load model does not recertify product ratings or installation compatibility. Validate against measured RV performance and OEM construction/airflow data before treating this as an equipment-selection calculation.

## Regression evidence and reproduction

Run `npm ci`, `npm test` and `npm run check` with Node 24.15 or later. The test-only jsdom dependency executes application interaction regressions. No runtime dependencies, package install or build step is required to use the calculator. Serve the repository root with any static server, for example `python -m http.server 8765 --bind 127.0.0.1`, and open the local URL. Deploy `index.html`, `calculator.js` and `slide-outs.js` together.

The committed fixtures were captured from original production commit `eaab2df70462e02f51f2b5f55bd445aaa034624a`, explicitly using zero slides. Seventeen input sets × three scenarios check exact unchanged totals, components, air properties and original geometry keys. New default results can differ from original defaults because RV types no longer silently assume one to three unmeasured slides.

Further tests check independent geometry/UA arithmetic, the research's 1,817.14 BTU/hr conductive winter delta, zero-depth cancellation, signed negative deltas, whole-volume ACH, explicit seal CFM, latent cooling, altitude, per-face glazing limits, glass-transfer accounting, different slide heights, multiple slides, invalid/overlapping geometry, inheritance, retraction and conservation of component totals. Air coefficients, density correction and duct allowance explain differences from the research's rounded total including leakage. DOM interaction tests cover add/edit/apply/cancel/remove, input errors and focus, retraction, Advanced inheritance/clear/cancel, stale-result suppression, equipment modes and original basic/help controls. These use jsdom and do not assert rendered layout. Passing these tests is not empirical validation of a real RV.

Earlier local validation on 2026-10-19 used Node 24.19.0 with a clean `npm ci`, syntax checks and passing regressions. Use the current test output for the present suite and pass counts. GitHub CI status is reported separately after commit.

## Engineering references

- [ASHRAE 2025 Handbook—Fundamentals, Chapter 17](https://handbook.ashrae.org/Handbooks/F25/IP/F25_Ch17/F25_Ch17_ip.aspx): envelope areas, assembly U, heating heat loss, fenestration, air loads and distribution principles. The implementation uses those physical relationships with the stated simplified cooling assumptions; it does not claim full-method compliance.
- [ASHRAE 2025 Handbook—Fundamentals, Chapter 16](https://handbook.ashrae.org/Handbooks/F25/IP/F25_Ch16/F25_Ch16_ip.aspx): leakage mechanisms and the distinction between test conditions and operating infiltration.
- [ACCA Manual J official scope](https://www.acca.org/standards/technical-manuals/manual-j): residential method context. No ACCA approval, Manual J compliance or certified RV accuracy is asserted.
