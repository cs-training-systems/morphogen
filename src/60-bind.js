
  // ---- declarative controls ---------------------------------------------------------------------------------
  function fmtStep(v, step) { var d = step >= 1 ? 0 : Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9))); return v.toFixed(d); }
  function fmt2(v) { return v.toFixed(2); }
  function $(scope, role) { return scope.querySelector("[data-rd='" + role + "']"); }
  function $$(scope, role) { return scope.querySelectorAll("[data-rd='" + role + "']"); }

  function bind(scope, field) {
    var familyBtns = $$(scope, "family"), presets = $$(scope, "preset"), notes = $$(scope, "note");
    var p1Range = $(scope, "feed-range"), p1Number = $(scope, "feed-number");
    var p2Range = $(scope, "kill-range"), p2Number = $(scope, "kill-number");
    var scaleRange = $(scope, "scale-range"), scaleNumber = $(scope, "scale-number");
    var pauseBtn = $(scope, "pause"), resetBtn = $(scope, "reset"), seedBtn = $(scope, "seed");
    var colorsToggle = $(scope, "colors-toggle"), colorsMenu = $(scope, "colors-menu"), paletteRadios = $$(scope, "palette-option");
    var motionBtn = $(scope, "motion"), motionCheck = $(scope, "motion-check"), quality = $(scope, "quality"), measure = $(scope, "measure"), stateLine = $(scope, "state");
    var hoverBtn = $(scope, "hover"), hoverCheck = $(scope, "hover-check");
    var modeWord = $(scope, "mode"), loading = $(scope, "loading"), brushSel = $(scope, "brush");
    var status = $(scope, "status"), steps = $(scope, "steps");
    var current = null, currentFamily = null, currentPalette = null, thumbs = [], seedClicks = 0;
    // Speed rides a logarithmic slider centred on the preset's own speed: the slider runs 0 … 1 and maps to
    // speedDef / 5 … speedDef × 5, so every preset starts mid-range (owner ruling 2026-10-09)
    var speedDef = DEFAULTS.timeScale, SPEED_K = 5;
    function speedFromSlider(s) { return speedDef * Math.pow(SPEED_K, (s - 0.5) * 2); }
    function sliderFromSpeed(v) { return clamp(0.5 + Math.log(v / speedDef) / Math.log(SPEED_K) / 2, 0, 1); }

    function say(text) { if (status) status.textContent = text; }
    function labelFor(el) { return el && el.id ? scope.querySelector("label[for='" + el.id + "']") : null; }
    var p1Label = labelFor(p1Range), p2Label = labelFor(p2Range), p1NumLabel = labelFor(p1Number), p2NumLabel = labelFor(p2Number);
    function familyName(id) { for (var i = 0; i < FAMILIES.length; i++) if (FAMILIES[i].id === id) return FAMILIES[i].name; return id; }
    function paramsText() {
      var m = field.model(), P = field.params(), a = m.params[0], b = m.params[1];
      return a.label.toLowerCase() + " " + fmtStep(P[a.key], a.step) + ", " + b.label.toLowerCase() + " " + fmtStep(P[b.key], b.step) + ", speed " + fmt2(field.getParams().timeScale);
    }
    // the two sliders take the model's own parameters: names, ranges, steps. For a reaction–diffusion preset the
    // range is tailored to the preset: its default ± 40 %, so the default sits at the centre (owner, 2026-10-09)
    function setSliders(preset) {
      var m = field.model(), P = field.params();
      function range(el, d, lo, hi) { if (el) { el.min = String(lo); el.max = String(hi); el.step = String(d.step); } }
      m.params.forEach(function (d, i) {
        var lo = d.min, hi = d.max, def = P[d.key];
        if (preset && d.step < 1 && !d.fixedRange) { lo = Math.max(d.min, +(def * 0.6).toFixed(6)); hi = Math.min(d.max, +(def * 1.4).toFixed(6)); }
        range(i ? p2Range : p1Range, d, lo, hi); range(i ? p2Number : p1Number, d, lo, hi);
      });
      if (p1Label) p1Label.textContent = m.params[0].label + ":"; if (p2Label) p2Label.textContent = m.params[1].label + ":";
      if (p1NumLabel) p1NumLabel.textContent = m.params[0].label + ", exact value"; if (p2NumLabel) p2NumLabel.textContent = m.params[1].label + ", exact value";
      if (scaleRange) { scaleRange.min = "0"; scaleRange.max = "1"; scaleRange.step = "0.005"; }
      if (scaleNumber) { scaleNumber.min = String(+(speedDef / SPEED_K).toFixed(3)); scaleNumber.max = String(+(speedDef * SPEED_K).toFixed(3)); scaleNumber.step = "0.005"; }
    }
    function syncInputs() {
      var m = field.model(), P = field.params(), a = m.params[0], b = m.params[1], t = field.getParams().timeScale;
      if (p1Range) p1Range.value = fmtStep(P[a.key], a.step); if (p1Number) p1Number.value = fmtStep(P[a.key], a.step);
      if (p2Range) p2Range.value = fmtStep(P[b.key], b.step); if (p2Number) p2Number.value = fmtStep(P[b.key], b.step);
      if (scaleRange) scaleRange.value = sliderFromSpeed(t).toFixed(3); if (scaleNumber) scaleNumber.value = t.toFixed(3);
    }
    function currentName() { return current ? current.name : "custom"; }
    function updateState() {
      if (!stateLine) return;
      stateLine.textContent = (current ? familyName(current.family) + " · " + current.name + " pattern" : "Custom settings") + " · " + (currentPalette || "Canopy") + " colors · " +
        (field.reducedMotion() ? "Reduced motion on: one still frame, seed at the left, full emergence at the right" : (field.isPaused() ? "paused" : "animating"));
    }
    function markPreset(preset) {
      current = preset;
      for (var i = 0; i < presets.length; i++) presets[i].setAttribute("aria-pressed", preset && presets[i].getAttribute("data-rd-id") === preset.id ? "true" : "false");
      for (var j = 0; j < notes.length; j++) notes[j].hidden = !(preset && notes[j].getAttribute("data-rd-for") === preset.id);
      if (modeWord) modeWord.textContent = (preset ? familyName(preset.family).toUpperCase() + ": " + preset.name.toUpperCase() : "CUSTOM");
      updateState();
    }
    function selectOption(sel, value) { if (!sel) return; for (var i = 0; i < sel.options.length; i++) if (parseFloat(sel.options[i].value) === value) { sel.selectedIndex = i; return; } }
    // A tile selects: the field clears to black, the preset's recipe loads (model, parameters, speed, brush,
    // colours), and nothing appears until the visitor paints or presses Seed. In reduced motion the chronogram is
    // computed for the new regime from the preset's own seeding.
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
      if (announce) say(preset.name + " pattern selected: " + paramsText() + ". " + (field.reducedMotion() ? "Still image." : "The field is black; press Seed, or click and drag on it, to start."));
    }
    // the family row filters the tiles; choosing a family selects its default (or first) tile
    function showFamily(id, announce) {
      currentFamily = id;
      for (var i = 0; i < familyBtns.length; i++) familyBtns[i].setAttribute("aria-pressed", familyBtns[i].getAttribute("data-rd-id") === id ? "true" : "false");
      var first = null, def = null;
      for (var j = 0; j < presets.length; j++) {
        var pr = presetById(presets[j].getAttribute("data-rd-id")), li = presets[j].closest ? presets[j].closest("li") || presets[j] : presets[j], show = pr && pr.family === id;
        li.hidden = !show;
        if (show) { if (!first) first = pr; if (presets[j].hasAttribute("data-rd-default")) def = pr; }
      }
      if (def || first) applyPreset(def || first, announce);
    }
    for (var f = 0; f < familyBtns.length; f++) (function (btn) { btn.addEventListener("click", function () { showFamily(btn.getAttribute("data-rd-id"), true); }); })(familyBtns[f]);
    for (var i = 0; i < presets.length; i++) (function (btn) {
      var preset = presetById(btn.getAttribute("data-rd-id")); if (!preset) return;
      btn.addEventListener("click", function () { applyPreset(preset, true); });
      var thumb = btn.querySelector("[data-rd='thumb']");
      if (thumb && thumb.getContext) thumbs.push({ preset: preset, canvas: thumb, data: null });
    })(presets[i]);

    function paintThumbs() { var lut = field.lut(); for (var t = 0; t < thumbs.length; t++) { var th = thumbs[t]; if (th.data) paintArray(th.data.V, th.data.W, th.data.H, th.canvas.getContext("2d", { alpha: false }), lut); } }
    (function renderThumbsLazily() {               // never during page load: after `load`, one tile per idle slot on the graphics processor (a few ms of main-thread work per slot on the processor path)
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
      if (which === "p1") field.setParams(v); else if (which === "p2") field.setParams(undefined, v); else field.setTimeScale(el === scaleRange ? speedFromSlider(v) : v);
      if (which !== "scale") markPreset(null); else updateState();
      syncInputs();
      say((which === "scale" ? currentName() + " pattern" : "Custom") + ": " + paramsText() + "." + (field.isAlive() ? "" : " The field is quiet; press Seed, paint on it, or choose a pattern."));
    }
    if (p1Range) p1Range.addEventListener("input", function () { onParam("p1", p1Range); });
    if (p1Number) p1Number.addEventListener("change", function () { onParam("p1", p1Number); });
    if (p2Range) p2Range.addEventListener("input", function () { onParam("p2", p2Range); });
    if (p2Number) p2Number.addEventListener("change", function () { onParam("p2", p2Number); });
    if (scaleRange) scaleRange.addEventListener("input", function () { onParam("scale", scaleRange); });
    if (scaleNumber) scaleNumber.addEventListener("change", function () { onParam("scale", scaleNumber); });

    function setPauseState(playing) { if (!pauseBtn) return; pauseBtn.textContent = playing ? "⏸ PAUSE" : "▶ PLAY"; pauseBtn.setAttribute("aria-label", playing ? "Pause the field" : "Play the field"); updateState(); }
    if (pauseBtn) { setPauseState(true); pauseBtn.addEventListener("click", function () { if (field.isPaused()) { field.play(); setPauseState(true); say("Playing."); } else { field.pause(); setPauseState(false); say("Paused."); } }); }
    if (resetBtn) resetBtn.addEventListener("click", function () { field.clear(); seedClicks = 0; say("Field reset to black."); });
    if (seedBtn) seedBtn.addEventListener("click", function () {
      var q = field.quality(), m = field.model(), first = seedClicks === 0;
      field.seed(first ? q.width / 2 : Math.random() * q.width, first ? q.height / 2 : Math.random() * q.height, (m.grid === "pixels" || m.sized) ? undefined : 4 * q.width / 320);
      seedClicks++; if (field.isPaused()) { field.play(); setPauseState(true); }
      say("Seeded" + (first ? " at the center" : " one point at random") + ": " + currentName() + ", " + paramsText() + ".");
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
      measure.textContent = q.lattice[0] + " × " + q.lattice[1] + (m.grid === "pixels" ? " px" : "") + " · " + (field.reducedMotion() ? "still" : (field.isAlive() ? Math.round(q.fps) + " fps" : "idle")) +
        " · brush " + (field.brush() * 100).toFixed(field.brush() < 0.01 ? 1 : 0) + "%" + (m.sized ? " · crystal " + Math.round(q.radius) + " px" : "");
      setTimeout(readout, 500);
    })();

    field.on(function (type) {
      if (type === "quiet") say("The pattern has faded; the field is quiet.");
      if (type === "motion") setMotionState();
      if (type === "clear") seedClicks = 0;
      if (loading && type === "busy") loading.hidden = false;
      if (loading && (type === "still" || type === "motion" && !field.reducedMotion())) loading.hidden = true;
    });

    // the initial state: the default family (data-rd-default on a family button, else the first), its default tile
    var initialFamily = null;
    for (var n = 0; n < familyBtns.length; n++) if (familyBtns[n].hasAttribute("data-rd-default")) initialFamily = familyBtns[n].getAttribute("data-rd-id");
    if (!initialFamily && familyBtns.length) initialFamily = familyBtns[0].getAttribute("data-rd-id");
    if (initialFamily) showFamily(initialFamily, false);
    else { var initial = null; for (var q2 = 0; q2 < presets.length; q2++) if (presets[q2].hasAttribute("data-rd-default")) initial = presetById(presets[q2].getAttribute("data-rd-id")); if (initial) applyPreset(initial, false); else { setSliders(null); syncInputs(); } }
    setMotionState();
    say((current ? current.name + " pattern: " : "") + paramsText() + ". The field is black until you press Seed or click and drag on it.");
  }
