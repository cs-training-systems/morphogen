
  // ---- declarative controls ---------------------------------------------------------------------------------
  function fmtStep(v, step) { var d = step >= 1 ? 0 : Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9))); return v.toFixed(d); }
  function fmt2(v) { return v.toFixed(2); }
  function $(scope, role) { return scope.querySelector("[data-rd='" + role + "']"); }
  function $$(scope, role) { return scope.querySelectorAll("[data-rd='" + role + "']"); }

  // The page's control vocabulary (0.7.0, owner rulings 2026-10-11): `category` buttons (stepwise | flowing | chance), `tile`
  // buttons that are NAMED MODELS, `chips` holding one `chip` per preset of the active tile, `note` elements keyed by tile that
  // stay visible while the visitor changes settings, p1 … p3 rows that take each model's own variables with their units, a
  // `rule` box and `dimension` select for models that declare them, and a `seed-value` box with `seed-reroll`. The 0.4–0.6 roles
  // (`family`, `preset` as tiles, `note` keyed by preset) still bind, so a page written against them keeps working.
  function bind(scope, field) {
    var catBtns = $$(scope, "category"); if (!catBtns.length) catBtns = $$(scope, "family");
    var tileBtns = $$(scope, "tile"), legacy = false; if (!tileBtns.length) { tileBtns = $$(scope, "preset"); legacy = true; }
    var notes = $$(scope, "note"), chipsBox = $(scope, "chips"), presetLine = $(scope, "preset-line");
    var scaleRange = $(scope, "scale-range"), scaleNumber = $(scope, "scale-number");
    var pauseBtn = $(scope, "pause"), resetBtn = $(scope, "reset"), seedBtn = $(scope, "seed");
    var colorsToggle = $(scope, "colors-toggle"), colorsMenu = $(scope, "colors-menu"), paletteRadios = $$(scope, "palette-option");
    var motionBtn = $(scope, "motion"), motionCheck = $(scope, "motion-check"), quality = $(scope, "quality"), measure = $(scope, "measure"), stateLine = $(scope, "state");
    var hoverBtn = $(scope, "hover"), hoverCheck = $(scope, "hover-check");
    var modeWord = $(scope, "mode"), loading = $(scope, "loading"), brushSel = $(scope, "brush");
    var status = $(scope, "status"), steps = $(scope, "steps");
    var modelControls = $(scope, "model-controls"), dimSel = $(scope, "dimension"), ruleBox = $(scope, "rule"), ruleLabel = $(scope, "rule-label");
    var seedInput = $(scope, "seed-value"), seedReroll = $(scope, "seed-reroll");
    var current = null, currentTile = null, currentCategory = null, currentPalette = null, thumbs = [], seedClicks = 0;
    // Speed rides a logarithmic slider centred on the preset's own speed: the slider runs 0 … 1 and maps to
    // speedDef / 5 … speedDef × 5, so every preset starts mid-range (owner ruling 2026-10-09)
    var speedDef = DEFAULTS.timeScale, SPEED_K = 5;
    function speedFromSlider(s) { return speedDef * Math.pow(SPEED_K, (s - 0.5) * 2); }
    function sliderFromSpeed(v) { return clamp(0.5 + Math.log(v / speedDef) / Math.log(SPEED_K) / 2, 0, 1); }

    function say(text) { if (status) status.textContent = text; }
    function labelFor(el) { return el && el.id ? scope.querySelector("label[for='" + el.id + "']") : null; }
    // the parameter rows, p1 … p3 (`feed-*` and `kill-*` remain the names of p1 and p2 for pages written against 0.1–0.3):
    // a model declares one to three parameters; a row the model does not use is hidden
    var PR = [];
    for (var pi = 0; pi < 3; pi++) {
      var rg = $(scope, "p" + (pi + 1) + "-range") || (pi === 0 ? $(scope, "feed-range") : (pi === 1 ? $(scope, "kill-range") : null));
      var nb = $(scope, "p" + (pi + 1) + "-number") || (pi === 0 ? $(scope, "feed-number") : (pi === 1 ? $(scope, "kill-number") : null));
      PR.push({ range: rg, number: nb, unit: $(scope, "p" + (pi + 1) + "-unit"), label: labelFor(rg), numLabel: labelFor(nb), row: (rg && rg.closest) ? rg.closest(".rd__param") : null });
    }
    function categoryName(id) { var c = categoryById(id); return c ? c.name : id; }
    function tileOf(preset) { return (preset && preset.tile) ? tileById(preset.tile) : null; }
    function tileName() { return currentTile ? currentTile.name : (current ? current.name : "custom"); }
    function paramsText() {
      var m = field.model(), P = field.params(), parts = [];
      m.params.forEach(function (d) { parts.push(d.label.toLowerCase() + " " + fmtStep(P[d.key], d.step)); });
      return parts.join(", ") + ", speed " + fmt2(field.getParams().timeScale);
    }
    // the sliders take the model's own parameters: names, units, ranges, steps. A linear track is built SYMMETRIC about the
    // preset's default (± 40 % on the input's own step grid) so the default sits at the track's spatial centre (owner 2026-10-10);
    // a parameter declared `fixedRange` keeps the model's own range (its default must then be at that range's centre, or it carries
    // `log: K`, a logarithmic track a factor K each way around the default); a preset's `logRange` makes every sub-unit parameter
    // logarithmic. Real numbers are what is read: the value box, the min/default/max labels, and the slider's value text.
    function setSliders(preset) {
      var m = field.model(), P = field.params();
      function range(el, d, lo, hi) { if (el) { el.min = String(lo); el.max = String(hi); el.step = String(d.step); } }
      PR.forEach(function (pr, i) {
        var d = m.params[i];
        if (pr.row) pr.row.hidden = !d;
        if (!d) return;
        var lo = d.min, hi = d.max, def = P[d.key];
        pr.K = 0; pr.def = def; pr.step = d.step;
        var K = (preset && preset.logRange && d.step < 1) ? preset.logRange : (d.log || 0);
        if (K) {
          pr.K = K; lo = +(def / K).toFixed(6); hi = +(def * K).toFixed(6);
          if (d.fixedRange) { lo = Math.max(lo, d.min); hi = Math.min(hi, d.max); }
          if (pr.range) { pr.range.min = "0"; pr.range.max = "1"; pr.range.step = "0.002"; }
          range(pr.number, d, lo, hi);
        } else {
          if (preset && d.step < 1 && !d.fixedRange && def > 0) { var span = Math.max(1, Math.round(Math.min(0.4 * def, def) / d.step)) * d.step; lo = +(def - span).toFixed(6); hi = +(def + span).toFixed(6); }
          range(pr.range, d, lo, hi); range(pr.number, d, lo, hi);
        }
        if (pr.label) pr.label.textContent = d.label + ":"; if (pr.numLabel) pr.numLabel.textContent = d.label + ", exact value" + (d.unit ? ", in " + d.unit : "");
        if (pr.unit) pr.unit.textContent = d.unit || "";
      });
      if (scaleRange) { scaleRange.min = "0"; scaleRange.max = "1"; scaleRange.step = "0.005"; }
      if (scaleNumber) { scaleNumber.min = String(+(speedDef / SPEED_K).toFixed(3)); scaleNumber.max = String(+(speedDef * SPEED_K).toFixed(3)); scaleNumber.step = "0.005"; }
    }
    function syncInputs() {
      var m = field.model(), P = field.params(), t = field.getParams().timeScale;
      PR.forEach(function (pr, i) {
        var d = m.params[i]; if (!d) return;
        if (pr.range) pr.range.value = pr.K ? clamp(0.5 + Math.log(P[d.key] / pr.def) / Math.log(pr.K) / 2, 0, 1).toFixed(3) : fmtStep(P[d.key], d.step);
        if (pr.range) pr.range.setAttribute("aria-valuetext", fmtStep(P[d.key], d.step) + (d.unit ? " " + d.unit : ""));
        if (pr.number) pr.number.value = fmtStep(P[d.key], d.step);
      });
      if (scaleRange) { scaleRange.value = sliderFromSpeed(t).toFixed(3); scaleRange.setAttribute("aria-valuetext", t.toFixed(3) + " × 8 steps per frame"); }
      if (scaleNumber) scaleNumber.value = t.toFixed(3);
      syncModelControls(); syncSeed();
    }
    // the model's own controls: the dimension select and the rule box (the cellular automaton), shown only when declared
    function syncModelControls() {
      var m = field.model(), P = field.params(), has = m.controls || [];
      if (modelControls) modelControls.hidden = !has.length;
      if (dimSel) { dimSel.hidden = has.indexOf("dimension") < 0; if (dimSel.closest) { var dr = dimSel.closest("label"); if (dr) dr.hidden = dimSel.hidden; } dimSel.value = String(P.dim >= 1.5 ? 2 : 1); }
      if (ruleBox) {
        ruleBox.hidden = has.indexOf("rule") < 0; var rr = ruleBox.closest ? ruleBox.closest("label") : null; if (rr) rr.hidden = ruleBox.hidden;
        if (!ruleBox.hidden) {
          if (P.dim >= 1.5) { ruleBox.value = lifeRuleString(P.bmask | 0, P.smask | 0, P.states | 0); ruleBox.setAttribute("pattern", "B[0-8]*/S[0-8]*(/C[0-9]+)?"); if (ruleLabel) ruleLabel.textContent = "Rule (B/S/C)"; }
          else { ruleBox.value = String(P.rule | 0); ruleBox.setAttribute("pattern", "[0-9]{1,3}"); if (ruleLabel) ruleLabel.textContent = "Rule (0–255)"; }
        }
      }
    }
    function syncSeed() { if (seedInput) seedInput.value = String(field.seedValue()); }
    function updateState() {
      if (!stateLine) return;
      var what = currentTile ? categoryName(currentTile.category) + " · " + currentTile.name + (current ? " · " + current.name : " · custom settings") : (current ? current.name + " pattern" : "Custom settings");
      stateLine.textContent = what + " · " + (currentPalette || "Canopy") + " colors · seed " + field.seedValue() + " · " +
        (field.reducedMotion() ? "Reduced motion on: one still frame, seed at the left, full emergence at the right" : (field.isPaused() ? "paused" : "animating"));
    }
    // the tile's note stays while the visitor changes settings (owner ruling 2026-10-11); the preset line says which preset, or
    // "custom settings", and whether the box around it is provisional
    function markTile(tile) {
      currentTile = tile;
      for (var i = 0; i < tileBtns.length; i++) {
        var id = tileBtns[i].getAttribute("data-rd-id"), on = tile ? (legacy ? (current && id === current.id) : id === tile.id) : false;
        tileBtns[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
      for (var j = 0; j < notes.length; j++) {
        var f = notes[j].getAttribute("data-rd-for");
        notes[j].hidden = !((tile && f === tile.id) || (legacy && current && f === current.id));
      }
      if (modeWord) modeWord.textContent = tile ? (categoryName(tile.category).toUpperCase() + " · " + tile.name.toUpperCase()) : (current ? current.name.toUpperCase() : "CUSTOM");
    }
    function markPreset(preset) {
      current = preset;
      if (chipsBox) { var chips = chipsBox.querySelectorAll("[data-rd='chip']"); for (var c = 0; c < chips.length; c++) chips[c].setAttribute("aria-pressed", preset && chips[c].getAttribute("data-rd-preset") === preset.id ? "true" : "false"); }
      if (presetLine) presetLine.textContent = preset ? ("Preset · " + preset.name + (preset.provisional ? " · slider box provisional, awaiting the range bench" : "")) : "Custom settings";
      if (legacy) markTile(currentTile);
      updateState();
    }
    function selectOption(sel, value) { if (!sel) return; for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === String(value) || parseFloat(sel.options[i].value) === value) { sel.selectedIndex = i; return; } }
    // A preset loads its whole recipe (model, parameters, speed, brush, colours, resolution); the field clears and nothing
    // appears until the visitor paints or presses Seed. In reduced motion the chronogram is computed from the preset's seeding.
    function applyPreset(preset, announce) {
      field.setModel(preset.model, preset.params);
      speedDef = preset.timeScale || DEFAULTS.timeScale;
      field.setDiffusionScale(preset.dscale || 1); field.setStepScale(preset.stepScale || 1); field.setTimeScale(speedDef);
      var brush = preset.brush || DEFAULTS.brush; field.setBrush(brush); selectOption(brushSel, brush);
      var qual = preset.quality || 320; field.setQuality(qual); selectOption(quality, qual);
      if (preset.palette) { for (var r = 0; r < paletteRadios.length; r++) if (paletteRadios[r].value === preset.palette) { paletteRadios[r].checked = true; currentPalette = paletteRadios[r].getAttribute("data-rd-name") || preset.palette; field.setPalette(preset.palette); paintThumbs(); } }
      setSliders(preset); markPreset(preset); syncInputs();
      var spec = {}; for (var kk in preset.seed) spec[kk] = preset.seed[kk]; spec.chrono = preset.chrono;
      field.setChronoSpec(spec); field.setFirstMark(preset.firstSeed === "spec" || preset.firstSeed === "every" ? spec : null, preset.firstSeed === "every"); field.clear(); seedClicks = 0;
      if (announce) say(tileName() + ", " + preset.name + " preset: " + paramsText() + ". " + (field.reducedMotion() ? "Still image." : "The field is black; press Seed, or click and drag on it, to start."));
    }
    // the chips: one per preset of the active tile, rebuilt when the tile changes
    function buildChips(tile) {
      if (!chipsBox) return;
      while (chipsBox.firstChild) chipsBox.removeChild(chipsBox.firstChild);
      if (!tile) return;
      tile.presets.forEach(function (pid) {
        var p = presetById(pid); if (!p) return;
        var b = global.document.createElement("button"); b.type = "button"; b.className = "rd__chip"; b.setAttribute("data-rd", "chip"); b.setAttribute("data-rd-preset", p.id); b.setAttribute("aria-pressed", "false"); b.textContent = p.name;
        b.addEventListener("click", function () { applyPreset(p, true); });
        chipsBox.appendChild(b);
      });
      chipsBox.hidden = tile.presets.length < 2;
    }
    function selectTile(tile, announce) {
      markTile(tile); buildChips(tile);
      var def = presetById(tile.presets[0]); if (def) applyPreset(def, announce);
    }
    // the category row filters the tiles; choosing a category selects its default (or first) tile
    function showCategory(id, announce) {
      currentCategory = id;
      for (var i = 0; i < catBtns.length; i++) catBtns[i].setAttribute("aria-pressed", catBtns[i].getAttribute("data-rd-id") === id ? "true" : "false");
      var first = null, def = null;
      for (var j = 0; j < tileBtns.length; j++) {
        var tid = tileBtns[j].getAttribute("data-rd-id"), li = tileBtns[j].closest ? tileBtns[j].closest("li") || tileBtns[j] : tileBtns[j];
        var item = legacy ? presetById(tid) : tileById(tid), cat = item ? (legacy ? item.family : item.category) : null, show = cat === id;
        li.hidden = !show;
        if (show) { if (!first) first = item; if (tileBtns[j].hasAttribute("data-rd-default")) def = item; }
      }
      // the planned slots: greyed tiles naming models not yet built, shown with their category (owner 2026-10-12)
      var planned = $$(scope, "planned");
      for (var p = 0; p < planned.length; p++) { var pli = planned[p].closest ? planned[p].closest("li") || planned[p] : planned[p]; pli.hidden = planned[p].getAttribute("data-rd-category") !== id; }
      var pick = def || first; if (!pick) return;
      if (legacy) applyPreset(pick, announce); else selectTile(pick, announce);
    }
    for (var f = 0; f < catBtns.length; f++) (function (btn) { btn.addEventListener("click", function () { showCategory(btn.getAttribute("data-rd-id"), true); }); })(catBtns[f]);
    for (var i = 0; i < tileBtns.length; i++) (function (btn) {
      var id = btn.getAttribute("data-rd-id"), tile = legacy ? null : tileById(id), preset = legacy ? presetById(id) : (tile ? presetById(tile.presets[0]) : null);
      if (!preset) return;
      btn.addEventListener("click", function () { if (legacy) applyPreset(preset, true); else selectTile(tile, true); });
      var thumb = btn.querySelector("[data-rd='thumb']");
      if (thumb && thumb.getContext) thumbs.push({ preset: preset, canvas: thumb, data: null });
    })(tileBtns[i]);

    function paintThumbs() { var lut = field.lut(); for (var t = 0; t < thumbs.length; t++) { var th = thumbs[t]; if (th.data) paintArray(th.data.V, th.data.W, th.data.H, th.canvas.getContext("2d", { alpha: false }), lut); } }
    (function renderThumbsLazily() {               // never during page load: after `load`, one tile per idle slot on the graphics processor
      var i = 0, size = field.thumbSize(), job = null, BUDGET_MS = 8, useGpu = field.backend() === "gpu";
      var idle = global.requestIdleCallback ? function (fn) { global.requestIdleCallback(fn, { timeout: 1500 }); } : function (fn) { setTimeout(fn, 50); };
      function next() {
        if (i >= thumbs.length) { scope.setAttribute("data-rd-thumbs", "done"); return; }
        var th = thumbs[i], t0 = defaultClock(), done = false;
        if (!job) job = thumbJob(th.preset, size, useGpu);
        if (useGpu) done = job.advance(1e9);
        else do { done = job.advance(1); } while (!done && defaultClock() - t0 < BUDGET_MS);
        if (done) { th.data = job.result(); th.canvas.width = th.data.W; th.canvas.height = th.data.H; paintThumbs(); job = null; i++; }
        idle(next);
      }
      function start() { if (thumbs.length) idle(next); }
      if (global.document && global.document.readyState !== "complete" && global.addEventListener) global.addEventListener("load", start, { once: true }); else start();
    })();

    function onParam(which, el) {
      var v = parseFloat(el.value); if (isNaN(v)) return;
      if (which === "scale") field.setTimeScale(el === scaleRange ? speedFromSlider(v) : v);
      else {
        var d = field.model().params[which], pr = PR[which]; if (!d) return;
        if (pr.K && el === pr.range) { v = pr.def * Math.pow(pr.K, (v - 0.5) * 2); v = +fmtStep(v, d.step); }   // the logarithmic track → the real value, on the parameter's step
        field.setParam(d.key, v);
      }
      if (which !== "scale") markPreset(null); else updateState();
      syncInputs();
      say((which === "scale" ? tileName() : tileName() + ", custom settings") + ": " + paramsText() + "." + (field.isAlive() ? "" : " The field is quiet; press Seed, paint on it, or choose a preset."));
    }
    PR.forEach(function (pr, i) {
      if (pr.range) pr.range.addEventListener("input", function () { onParam(i, pr.range); });
      if (pr.number) pr.number.addEventListener("change", function () { onParam(i, pr.number); });
    });
    if (scaleRange) scaleRange.addEventListener("input", function () { onParam("scale", scaleRange); });
    if (scaleNumber) scaleNumber.addEventListener("change", function () { onParam("scale", scaleNumber); });
    // the rule box: a Wolfram number in one dimension, a B/S/C string in two; the dimension select switches the lattice and clears
    if (ruleBox) ruleBox.addEventListener("change", function () {
      var P = field.params();
      if (P.dim >= 1.5) { var r = parseLifeRule(ruleBox.value); if (!r) { say("The rule is written like B3/S23, or B2/S/C3 for dying states."); syncModelControls(); return; } field.setParam("bmask", r.bmask); field.setParam("smask", r.smask); field.setParam("states", r.states); }
      else { var n = parseInt(ruleBox.value, 10); if (isNaN(n) || n < 0 || n > 255) { say("A one-dimensional rule is a number from 0 to 255."); syncModelControls(); return; } field.setParam("rule", n); }
      markPreset(null); syncInputs(); say("Rule " + ruleBox.value + ".");
    });
    if (dimSel) dimSel.addEventListener("change", function () {
      var dim = parseInt(dimSel.value, 10) === 2 ? 2 : 1; field.setParam("dim", dim);
      if (dim === 2 && field.params().density < 0.02) field.setParam("density", 0.35);
      field.clear(); markPreset(null); syncInputs(); say(dim === 2 ? "Two dimensions: a Life-like rule on the plane. The field is black; press Seed or paint." : "One dimension: a Wolfram rule, rows stacking in time. The field is black; press Seed or paint.");
    });
    // the seed value: typed, or rerolled; the field clears so the new stream starts clean
    if (seedInput) seedInput.addEventListener("change", function () { var n = parseInt(seedInput.value, 10); if (isNaN(n)) { syncSeed(); return; } field.setSeed(n); seedClicks = 0; syncSeed(); updateState(); say("Seed value " + field.seedValue() + ". The field is black; press Seed or paint."); });
    if (seedReroll) seedReroll.addEventListener("click", function () { field.setSeed(Math.floor(Math.random() * 1000000)); seedClicks = 0; syncSeed(); updateState(); say("Seed value " + field.seedValue() + ". The field is black; press Seed or paint."); });

    function setPauseState(playing) { if (!pauseBtn) return; pauseBtn.textContent = playing ? "⏸ PAUSE" : "▶ PLAY"; pauseBtn.setAttribute("aria-label", playing ? "Pause the field" : "Play the field"); updateState(); }
    if (pauseBtn) { setPauseState(true); pauseBtn.addEventListener("click", function () { if (field.isPaused()) { field.play(); setPauseState(true); say("Playing."); } else { field.pause(); setPauseState(false); say("Paused."); } }); }
    if (resetBtn) resetBtn.addEventListener("click", function () { field.clear(); seedClicks = 0; say("Field reset to black."); });
    if (seedBtn) seedBtn.addEventListener("click", function () {
      var q = field.quality(), m = field.model(), first = seedClicks === 0;
      field.seed(first ? q.width / 2 : field.random() * q.width, first ? q.height / 2 : field.random() * q.height, (m.grid === "pixels" || m.sized) ? undefined : 4 * q.width / 320);
      seedClicks++; if (field.isPaused()) { field.play(); setPauseState(true); }
      say("Seeded" + (first ? " at the center" : " one point at random") + ": " + tileName() + ", " + paramsText() + ".");
    });

    function setColorsOpen(open) {
      if (!colorsToggle || !colorsMenu) return;
      colorsMenu.classList.toggle("is-open", open); colorsToggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { var checked = colorsMenu.querySelector("input:checked") || colorsMenu.querySelector("input"); if (checked) checked.focus(); }
    }
    if (colorsToggle && colorsMenu) {
      colorsToggle.addEventListener("click", function () { setColorsOpen(colorsToggle.getAttribute("aria-expanded") !== "true"); });
      colorsMenu.addEventListener("keydown", function (e) { if (e.key === "Escape") { setColorsOpen(false); colorsToggle.focus(); } });
      scope.addEventListener("focusout", function (e) { var to = e.relatedTarget; if (colorsMenu.classList.contains("is-open") && to && !colorsMenu.contains(to) && to !== colorsToggle) setColorsOpen(false); });
      global.document.addEventListener("pointerdown", function (e) { if (colorsMenu.classList.contains("is-open") && !colorsMenu.contains(e.target) && e.target !== colorsToggle) setColorsOpen(false); });
    }
    for (var j = 0; j < paletteRadios.length; j++) (function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        currentPalette = radio.getAttribute("data-rd-name") || radio.value;
        field.setPalette(radio.value); paintThumbs(); updateState(); say("Colors: " + currentPalette + ".");
        if (colorsMenu && colorsMenu.classList.contains("is-open")) { setColorsOpen(false); if (colorsToggle) colorsToggle.focus(); }
      });
      if (radio.checked) { currentPalette = radio.getAttribute("data-rd-name") || radio.value; field.setPalette(radio.value); }
    })(paletteRadios[j]);

    function setMotionState() { var on = field.reducedMotion(); if (motionBtn) motionBtn.setAttribute("aria-pressed", on ? "true" : "false"); if (motionCheck) motionCheck.checked = on; updateState(); }
    function toggleMotion() { var on = !field.reducedMotion(); field.setReducedMotion(on); setMotionState(); say(on ? "Reduced motion on: one still frame, seed at the left, full emergence at the right." : "Reduced motion off: animating."); }
    if (motionBtn) motionBtn.addEventListener("click", toggleMotion);
    if (motionCheck) motionCheck.addEventListener("change", function () { if (motionCheck.checked !== field.reducedMotion()) toggleMotion(); });
    function setHoverState() { var on = field.hover(); if (hoverBtn) hoverBtn.setAttribute("aria-pressed", on ? "true" : "false"); if (hoverCheck) hoverCheck.checked = on; }
    function toggleHover() { var on = !field.hover(); field.setHover(on); setHoverState(); say(on ? "Hover mode on: moving the pointer over the field paints." : "Hover mode off: click and drag on the field to paint."); }
    if (hoverBtn) hoverBtn.addEventListener("click", toggleHover);
    if (hoverCheck) hoverCheck.addEventListener("change", function () { if (hoverCheck.checked !== field.hover()) toggleHover(); });
    setHoverState();
    if (quality) { quality.addEventListener("change", function () { field.setQuality(quality.value); say("Resolution " + quality.options[quality.selectedIndex].text + "."); }); field.setQuality(quality.value); }
    if (brushSel) brushSel.addEventListener("change", function () { field.setBrush(parseFloat(brushSel.value)); say("Brush width " + brushSel.options[brushSel.selectedIndex].text + "."); });
    if (steps) steps.addEventListener("change", function () { field.setSteps(parseInt(steps.value, 10)); });
    if (measure) (function readout() {
      var q = field.quality(), m = field.model();
      measure.textContent = q.lattice[0] + " × " + q.lattice[1] + (m.grid === "pixels" ? " px" : " cells") + " · " + (field.reducedMotion() ? "still" : (field.isAlive() ? Math.round(q.fps) + " fps" : "idle")) +
        " · " + q.steps.toFixed(1) + " steps/frame · brush " + (field.brush() * 100).toFixed(field.brush() < 0.01 ? 1 : 0) + "%" + (m.sized ? " · crystal " + Math.round(q.radius) + " px" : "");
      setTimeout(readout, 500);
    })();

    field.on(function (type) {
      if (type === "quiet") say("The pattern has faded; the field is quiet.");
      if (type === "motion") setMotionState();
      if (type === "clear") seedClicks = 0;
      if (type === "seed-value") syncSeed();
      if (loading && type === "busy") loading.hidden = false;
      if (loading && (type === "still" || type === "motion" && !field.reducedMotion())) loading.hidden = true;
    });

    // the initial state: the default category (data-rd-default on a category button, else the first), its default tile
    var initialCategory = null;
    for (var n = 0; n < catBtns.length; n++) if (catBtns[n].hasAttribute("data-rd-default")) initialCategory = catBtns[n].getAttribute("data-rd-id");
    if (!initialCategory && catBtns.length) initialCategory = catBtns[0].getAttribute("data-rd-id");
    if (initialCategory) showCategory(initialCategory, false);
    else { var initial = null; for (var q2 = 0; q2 < tileBtns.length; q2++) if (tileBtns[q2].hasAttribute("data-rd-default")) initial = legacy ? presetById(tileBtns[q2].getAttribute("data-rd-id")) : tileById(tileBtns[q2].getAttribute("data-rd-id")); if (initial) { if (legacy) applyPreset(initial, false); else selectTile(initial, false); } else { setSliders(null); syncInputs(); } }
    setMotionState();
    say((currentTile ? currentTile.name + (current ? ", " + current.name + " preset: " : ": ") : "") + paramsText() + ". The field is black until you press Seed or click and drag on it.");
  }
