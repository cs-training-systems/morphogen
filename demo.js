// demo.js — the Morphogen demo page's own wiring: the measurement readout and the reduced-motion
// toggle. The component needs none of this; its controls are declarative (data-rd roles).
(function () {
  "use strict";
  var canvas = document.getElementById("rd-field");
  var out = document.getElementById("fps");
  var motionBtn = document.getElementById("motion");
  function tick() {
    var field = ReactionDiffusion.get(canvas);
    if (field) {
      var q = field.quality();
      out.value = (field.reducedMotion() ? "still" : (field.isAlive() ? Math.round(field.fps()) + " fps" : "idle")) +
        " · " + q.width + "×" + q.height + (q.auto ? " auto" : "") + " · " + q.ms.toFixed(1) + " ms/frame · " + q.steps.toFixed(1) + " steps/frame";
    }
    setTimeout(tick, 500);
  }
  tick();
  motionBtn.addEventListener("click", function () {
    var field = ReactionDiffusion.get(canvas);
    var on = !field.reducedMotion();
    field.setReducedMotion(on);
    motionBtn.setAttribute("aria-pressed", on ? "true" : "false");
    motionBtn.textContent = on ? "Reduced motion: on (simulated)" : "Reduced motion: off";
  });
})();
