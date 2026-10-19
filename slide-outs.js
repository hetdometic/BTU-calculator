"use strict";
/* Slide editor and result presentation; the load model lives in calculator.js. */
window.RVBTUSlides = Object.freeze({
  create({ state, currentInputs, render, fmt }) {
    const $ = (selector, root = document) => root.querySelector(selector);
    let editing = false;
    let draft = [];
    const fields = {
      lengthFt: ["Length along RV", "ft", 0.01, 60, "Measure"],
      depthFt: ["Extension depth", "ft", 0.01, 10, "Measure"],
      heightFt: ["Slide height", "ft", 0.01, 10, "Same as RV"],
      outerWindowAreaFt2: ["Outer-wall windows", "sq ft", 0, 600, "0"],
      offsetFt: ["Opening starts from front", "ft", 0, 60, "0"],
      end1WindowAreaFt2: ["Front end-wall windows", "sq ft", 0, 100, "0"],
      end2WindowAreaFt2: ["Rear end-wall windows", "sq ft", 0, 100, "0"],
      wallR: ["Wall effective insulation", "R", 0.01, 100, "Same as RV"],
      roofR: ["Roof effective insulation", "R", 0.01, 100, "Same as RV"],
      floorR: ["Underside effective insulation", "R", 0.01, 100, "Same as RV"],
      windowU: ["Window U-factor", "U", 0.01, 5, "Same as RV"],
      shgc: ["Window SHGC", "0–1", 0, 1, "Same as RV"],
      thermalBridgeFactor: ["Nominal-R bridge multiplier", "×", 1, 2, "1"],
      extraLeakageCfm: ["Extra seal leakage", "CFM", 0, 500, "0"],
      windowShading: ["Window solar fraction", "0–1", 0, 1, "1"],
      roofShading: ["Roof solar fraction", "0–1", 0, 1, "1"]
    };
    const signed = (value) => { const rounded = Math.round(value) || 0; return `${rounded > 0 ? "+" : ""}${fmt(rounded)}`; };

    function numericField(key, index) {
      const [label, unit, min, max, placeholder] = fields[key];
      const id = `slide-${index}-${key}`;
      return `<label class="slide-field" for="${id}"><span>${label}</span><span class="unit-input"><input id="${id}" data-field="${key}" type="number" min="${min}" max="${max}" step="any" placeholder="${placeholder}"><span>${unit}</span></span></label>`;
    }

    function selectField(key, index, label, options) {
      const id = `slide-${index}-${key}`;
      return `<label class="slide-field" for="${id}"><span>${label}</span><select id="${id}" data-field="${key}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>`;
    }

    function readDraft() {
      return Array.from(document.querySelectorAll(".slide-card")).map((card) => {
        const slide = {};
        card.querySelectorAll("[data-field]").forEach((input) => {
          slide[input.dataset.field] = input.type === "checkbox" ? input.checked : input.type === "number" ? (input.value.trim() === "" ? null : Number(input.value)) : input.value;
        });
        return slide;
      });
    }

    function drawEditor(focusIndex) {
      $("#slideEditor").hidden = false;
      $("#slideError").hidden = true;
      $("#editSlides").hidden = true;
      $("#slideCards").innerHTML = draft.map((slide, index) => `
        <fieldset class="slide-card" data-index="${index}">
          <legend class="visually-hidden">Slide ${index + 1}</legend>
          <div class="slide-card-head"><strong>Slide ${index + 1}</strong><label><input data-field="deployed" type="checkbox"> Deployed</label><button class="text-button" data-remove="${index}" type="button" aria-label="Remove slide ${index + 1}">Remove</button></div>
          <div class="slide-fields">${["lengthFt", "depthFt", "heightFt", "outerWindowAreaFt2"].map((key) => numericField(key, index)).join("")}</div>
          <details class="slide-thermal"><summary>Placement, insulation, glazing &amp; leakage</summary>
            <p class="slide-help">Openings on the same side must not overlap. Position is measured from the front of the conditioned RV body. Main-body window counts above exclude all slide windows.</p>
            <div class="slide-fields">
              ${selectField("side", index, "RV sidewall", [["left", "Left"], ["right", "Right"]])}
              ${["offsetFt", "end1WindowAreaFt2", "end2WindowAreaFt2", "wallR", "roofR", "floorR", "windowU", "shgc", "thermalBridgeFactor", "extraLeakageCfm", "windowShading", "roofShading"].map((key) => numericField(key, index)).join("")}
              ${selectField("supply", index, "HVAC supply to slide", [["unknown", "Unknown / verify airflow"], ["mixing", "Main-cabin air mixing"], ["direct", "Direct supply / verify airflow"]])}
            </div>
            <p class="slide-help">R-values are whole-assembly US R-values (h·ft²·°F/Btu); U-factor is Btu/(h·ft²·°F). Use a bridge multiplier of 1 for effective R. Any larger nominal-R correction is your assumption, not a validated RV constant.</p>
            <p class="slide-help">Extra leakage is operating-condition CFM beyond the main-RV ACH applied to added volume; do not enter blower-door CFM50. Zero means no extra seal leakage assumed. Solar fractions: 1 = inherited mixed sun, 0 = no direct solar gain. Roof shading does not remove ambient conduction.</p>
          </details>
        </fieldset>`).join("");
      draft.forEach((slide, index) => {
        const card = $(`.slide-card[data-index="${index}"]`);
        card.querySelectorAll("[data-field]").forEach((input) => {
          const value = slide[input.dataset.field];
          if (input.type === "checkbox") input.checked = value !== false;
          else input.value = value ?? "";
        });
      });
      $("#addSlide").disabled = draft.length >= 5;
      if (focusIndex != null) $(`#slide-${focusIndex}-lengthFt`)?.focus();
    }

    function startEditing() {
      if (editing) draft = readDraft();
      else { draft = structuredClone(state.slideOuts); editing = true; }
    }

    function closeEditor() {
      editing = false;
      draft = [];
      $("#slideEditor").hidden = true;
      $("#slideError").hidden = true;
      $("#addSlide").disabled = state.slideOuts.length >= 5;
      $("#editSlides").hidden = state.slideOuts.length === 0;
    }

    $("#addSlide").addEventListener("click", () => {
      startEditing();
      if (draft.length >= 5) return;
      const last = draft.filter((slide) => slide.side === "left" && slide.deployed).reduce((end, slide) => Math.max(end, (slide.offsetFt || 0) + (slide.lengthFt || 0)), 0);
      draft.push({ deployed: true, side: last >= state.length ? "right" : "left", offsetFt: last >= state.length ? 0 : last,
        lengthFt: null, depthFt: null, heightFt: null, outerWindowAreaFt2: 0, end1WindowAreaFt2: 0, end2WindowAreaFt2: 0,
        wallR: null, roofR: null, floorR: null, windowU: null, shgc: null,
        thermalBridgeFactor: 1, extraLeakageCfm: 0, windowShading: 1, roofShading: 1, supply: "unknown" });
      drawEditor(draft.length - 1);
    });
    $("#editSlides").addEventListener("click", () => { startEditing(); drawEditor(); });
    $("#slideCards").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove]");
      if (!button) return;
      draft = readDraft();
      draft.splice(Number(button.dataset.remove), 1);
      drawEditor();
      const next = $("[data-remove]", $("#slideCards"));
      (next || $("#applySlides")).focus();
    });
    $("#cancelSlides").addEventListener("click", () => { closeEditor(); $("#addSlide").focus(); });
    $("#applySlides").addEventListener("click", () => {
      draft = readDraft();
      const invalidField = Array.from(document.querySelectorAll(".slide-card input[type=number]")).find((input) => draft[Number(input.closest(".slide-card").dataset.index)].deployed && input.value !== "" && !input.validity.valid);
      if (invalidField) {
        const index = Number(invalidField.closest(".slide-card").dataset.index);
        const [label, , min, max] = fields[invalidField.dataset.field];
        $("#slideError").textContent = `Slide ${index + 1}: ${label.toLowerCase()} must be between ${min} and ${max}.`;
        $("#slideError").hidden = false;
        const details = invalidField.closest("details"); if (details) details.open = true;
        invalidField.focus();
        return;
      }
      try {
        window.RVBTUEngine.validateInputs({ ...currentInputs(), slideOuts: draft });
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        const match = /^slideOuts\.(\d+)\.(\w+)$/.exec(error.field || "");
        $("#slideError").textContent = match && fields[match[2]] ? error.message.replace(error.field, `Slide ${Number(match[1]) + 1}, ${fields[match[2]][0].toLowerCase()}`) : error.message;
        $("#slideError").hidden = false;
        const input = match ? $(`#slide-${match[1]}-${match[2]}`) : null;
        if (input) { const details = input.closest("details"); if (details) details.open = true; input.focus(); }
        return;
      }
      state.slideOuts = structuredClone(draft);
      state.selectedAc = null;
      state.selectedFurnace = null;
      closeEditor();
      render();
      $("#results").scrollIntoView({ behavior: "smooth", block: "center" });
      $("#results").setAttribute("tabindex", "-1");
      $("#results").focus({ preventScroll: true });
    });

    function renderResults(results) {
      const raw = results.breakdown;
      const active = raw.slideResults.filter((slide) => slide.deployed);
      const g = raw.geometry;
      $("#slideAppliedSummary").textContent = state.slideOuts.length ? `${active.length} deployed of ${state.slideOuts.length} slide-outs · ${fmt(g.slideFloorArea)} sq ft added` : "No slide-outs added. Enter measurements for each slide.";
      $("#editSlides").hidden = state.slideOuts.length === 0;
      $("#slideResult").hidden = raw.slideResults.length === 0;
      $("#slideGeometrySummary").textContent = `${fmt(g.mainFloorArea)} + ${fmt(g.slideFloorArea)} = ${fmt(g.floorArea)} sq ft conditioned floor. Added volume: ${fmt(g.slideVolume)} cu ft.`;
      const loads = [];
      if (state.mode !== "furnace") loads.push(["Cooling", raw.base.coolingTotal, raw.slideContribution.coolingTotal]);
      if (state.mode !== "ac") loads.push(["Heating", raw.base.heatingTotal, raw.slideContribution.heatingTotal]);
      $("#slideLoadSummary").replaceChildren();
      loads.forEach(([label, base, slide]) => {
        const row = document.createElement("div"); row.className = "slide-load-row";
        const text = document.createElement("span"); text.textContent = `${label} · base ${fmt(base)} BTU/hr`;
        const strong = document.createElement("strong"); strong.textContent = `${signed(slide)} from slides`;
        row.append(text, strong); $("#slideLoadSummary").append(row);
      });
      $("#slideResultDetails").replaceChildren();
      raw.slideResults.forEach((slide) => {
        const item = document.createElement("div"); item.className = "slide-detail";
        const title = document.createElement("strong"); title.textContent = `Slide ${slide.index + 1}${slide.deployed ? "" : " · retracted, no deployed addition"}`; item.append(title);
        if (slide.deployed) {
          const geo = slide.geometry;
          const p = document.createElement("p");
          p.textContent = `Floor / roof / underside: ${fmt(geo.addedFloorFt2)} sq ft each. Volume: ${fmt(geo.addedVolumeFt3)} cu ft. Outer wall: ${fmt(geo.outerWallFt2)} sq ft; end walls: ${fmt(geo.endWallsFt2)} sq ft; glass: ${fmt(geo.windowAreaFt2)} sq ft. Seal perimeter: ${fmt(geo.sealPerimeterFt)} ft.`; item.append(p);
          const credit = document.createElement("p"); credit.textContent = `Attachment opening: ${fmt(geo.attachmentOpeningFt2)} sq ft removed from main wall. Credit already included in wall delta: ${signed(-slide.removedMainWall.cooling)} cooling / ${signed(-slide.removedMainWall.heating)} heating BTU/hr.`; item.append(credit);
          const rows = [
            ["Walls incl. opening credit", slide.cooling.walls, slide.heating.walls],
            ["Roof", slide.cooling.roof, slide.heating.roof], ["Underside", slide.cooling.floor, slide.heating.floor],
            ["Window conduction", slide.cooling.windowConduction, slide.heating.windows], ["Window solar", slide.cooling.windowSolar, 0],
            ["Air sensible", slide.cooling.outsideAirSensible, slide.heating.outsideAir], ["Air latent", slide.cooling.outsideAirLatent, 0],
            ["Duct allowance", slide.cooling.duct, slide.heating.duct], ["Net slide BTU/hr", slide.coolingTotal, slide.heatingTotal]
          ];
          const table = document.createElement("table"); table.className = "load-table";
          table.innerHTML = `<thead><tr><th>Slide component</th>${state.mode !== "furnace" ? "<th>Cool</th>" : ""}${state.mode !== "ac" ? "<th>Heat</th>" : ""}</tr></thead>`;
          const body = document.createElement("tbody");
          rows.forEach(([label, cool, heat]) => {
            const row = document.createElement("tr");
            [label, ...(state.mode !== "furnace" ? [signed(cool)] : []), ...(state.mode !== "ac" ? [signed(heat)] : [])].forEach((value) => {
              const cell = document.createElement("td"); cell.textContent = value; row.append(cell);
            }); body.append(row);
          }); table.append(body); item.append(table);
        }
        const list = document.createElement("ul");
        slide.warnings.forEach((warning) => { const li = document.createElement("li"); li.textContent = warning; list.append(li); });
        item.append(list); $("#slideResultDetails").append(item);
      });
    }
    return Object.freeze({ renderResults });
  }
});
