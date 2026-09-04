# Dometic Climate Sizer — 2026 Lineup & Logic Audit

**Audit date:** 2026-09-04  
**Scope:** `index.html` on `main` at commit `d404b8ca60ccdb984afa6216f2aa0ceaeb8eaa45`  
**Status:** Review branch only; production `main` remains unchanged.

## Executive finding

The largest error in the existing calculator is the furnace equipment table. The calculator uses **legacy DF-series delivered-output values** (for example 35K -> 25.84K and 40K -> 30.4K) while presenting the recommendation as a current Dometic furnace match. Dometic's current Furnace Essential messaging instead describes the family by **heating output/capacity** classes of **12K, 18K, 25K, 30K, 35K and 40K BTU/hr**. The current 35K Essential product page explicitly states **Heating Capacity: 35,000 BTU**.

That mismatch makes the existing tool oversize furnace recommendations and makes its upper heating limit look much lower than Dometic's current 40K class.

## Current Dometic product basis

### Rooftop A/C

Current Dometic US rooftop listings center the **FreshJet 5 Series** around these cooling classes:

- FreshJet 5 High Efficiency — **approximately 11,000 BTU/hr**
- FreshJet 5 — **13,500 BTU/hr**
- FreshJet 5 — **15,000 BTU/hr**

The V2 engine uses those three physical unit capacities and builds unique one-, two-, and three-unit capacity plans. This closes the current calculator's major **15K -> 27K** gap. For example, a 15,100 BTU/hr expected load can now compare against **2 x ~11K = ~22K** instead of jumping directly to 27K.

A multi-unit capacity match is only a planning result. Roof openings, electrical service, ducting, controls, zoning and installation compatibility still have to be verified.

### Furnace

The current Furnace Essential family is modeled as these Dometic-published heating-capacity classes:

- 12K
- 18K
- 25K
- 30K
- 35K
- 40K BTU/hr

**Important:** the legacy DF input/output table is not deleted from history; it is simply not valid as the capacity basis for a current Essential-series recommendation. If a future version supports legacy replacement sizing, legacy DF should be a separate compatibility dataset keyed by exact model, because even the old 35K value varied by furnace size/configuration.

## Logic audit

| Area | Existing behavior | V2 decision | Why |
|---|---|---|---|
| Furnace capacities | 12K input -> 9.12K output through 40K input -> 30.4K output | Current Essential: 12/18/25/30/35/40K heating capacity | Prevents mixing legacy DF delivered-output data with current Essential marketing/spec data |
| A/C equipment steps | 11, 13.5, 15, 27, 28.5, 30K | FreshJet 5 base units plus unique 1-3 unit combinations up to 45K | Removes the 15K-to-27K recommendation cliff |
| Recommendation target | First capacity >= expected load | Kept | Expected case is the center planning case; high case remains visible instead of forcing every user into a severe-case oversize |
| High-load handling | Text labels can imply a typical fit even when high case exceeds equipment | Labels now explicitly say expected is met but high case may exceed | More truthful communication |
| Envelope conduction | Simplified U*A*delta-T | Kept | Appropriate for a planning model when R-values and geometry are approximate |
| Roof/wall solar | Fixed sol-air-style temperature adders | Kept, documented as heuristic | Useful first-order proxy, but not an orientation-specific Manual J solar model |
| Floor cooling | Uses `max(cooling delta - 5F, 0)` | Uses full cooling delta | Removes an undocumented hidden 5F assumption |
| Slide-outs | 5% area and 6% volume increase per slide | 5% area heuristic; volume is now `floor area * height` | Keeps the simple basic input while restoring geometric consistency |
| Door area | Door area grows with slide count | One typical 18 sq ft door, not multiplied by slides | A slide-out does not create an additional entry door |
| Infiltration | ACH * volume / 60 | Kept | Correct conversion from air changes per hour to CFM |
| Altitude | Input is advisory only; calculations stay at sea-level pressure | Atmospheric pressure, humidity ratio and air-density terms now use altitude | Makes the altitude field mathematically real instead of cosmetic |
| Sensible outside-air load | Fixed 1.08 coefficient | 1.08 adjusted by air-density ratio | Avoids treating high-altitude air as sea-level density |
| Latent outside-air load | 0.68 * CFM * grain difference at fixed sea-level pressure | Grain difference uses local barometric pressure and latent coefficient is density-adjusted | Better psychrometric consistency at elevation |
| Duct loss | Adds `subtotal * loss%` | Solves `required = load / (1-loss)` | If 8% of supplied output is lost, 9,200 load requires 10,000 supplied, not 9,936 |
| Heating internal gains | No credit for people/cooking/sun | Kept | Conservative for a cold-night furnace planning case |
| Travelers + Advanced | Changing traveler count clears all Advanced settings | Fixed in preview | Traveler count changes people gains; it should not erase weather/insulation/duct inputs |
| Extreme ambient A/C | Nameplate capacity treated as exact | Warning added at >=100F design condition | Actual equipment performance can differ from nominal/nameplate capacity |
| Multi-unit A/C | No compatibility warning | Warning added | Total BTU alone does not confirm a valid multi-zone installation |

## What is intentionally still an estimate

This is **not** a Dometic-certified Manual J implementation and should not pretend to be one. These inputs remain heuristics unless the user enters measured/OEM data:

- RV construction R-values and ACH
- slide-out geometry from only a slide count
- solar exposure/orientation/shading
- window U-factor and SHGC profile
- internal appliance duty cycle
- duct/distribution loss
- exact design-weather selection

The V2 engine preserves low / expected / high scenarios because those assumptions are uncertain. They are **scenario bounds, not a statistical confidence interval**.

## Product/installation limits the calculator must not infer

The calculator can size a thermal capacity, but it must not claim that a result proves:

- roof opening or structural fit
- available 120 V branch-circuit / shore / generator capacity
- duct or air-distribution compatibility
- thermostat/control-zone compatibility
- LP gas supply, combustion-air or venting suitability
- altitude approval for a specific furnace SKU
- exact A/C capacity at an extreme outdoor condition

Those are product-selection and installation checks, not heat-load math.

## Verification tests included on this branch

`dometic-core-v2.test.js` covers:

- all current Essential furnace recommendation boundaries through 40K
- FreshJet 5 single/multi-unit boundaries, including the old 15K -> 27K gap
- altitude pressure and density behavior
- latent psychrometrics remaining finite at high temperature/RH/elevation
- distribution-loss algebra
- slide/door geometry behavior
- expected directional behavior for temperature, ventilation, people, glazing and insulation
- low < expected < high ordering for a representative RV
- invalid R-values, humidity, dimensions, altitude and duct-loss inputs

## Public Dometic sources used

- Current rooftop A/C category: https://www.dometic.com/en-us/category/rv-and-van/rv-air-conditioners/rooftop-rv-air-conditioners
- FreshJet 5 High Efficiency (~11K): https://www.dometic.com/en-us/product/dometic-freshjet-5-series-high-efficiency-4
- FreshJet 5 15K example: https://www.dometic.com/en-us/product/dometic-freshjet-5-series-15k-4
- Furnace Essential family: https://www.dometic.com/en-us/lp/rv-furnaces
- Furnace Essential lineup page: https://www.dometic.com/en-us/lp/furnace-essential-lineup
- Current 35K Essential example: https://www.dometic.com/en-us/product/dometic-dfmdh35121-medium-35k-furnace-essential-9610007794
- Current 35K Essential leaflet: https://media.dometic.com/externalassets/dometic-medium-furnace_9610007792_124655.pdf

## Production recommendation

Do **not** merge the V2 preview blindly. First have Dometic Product/Engineering confirm two internal-data questions that public pages do not fully answer:

1. Whether the public 12/18/25/30/35/40K Essential values should be treated as the official sizing **heating output/capacity** for every planned SKU, not merely family/model-class labels.
2. What multi-zone FreshJet 5 combinations Dometic wants the customer-facing selector to permit based on controls, electrical architecture and intended vehicle applications.

Once those two points are internally confirmed, the current `index.html` can be migrated from the runtime preview patch to the V2 engine directly.
