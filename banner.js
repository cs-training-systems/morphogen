/* banner.js — the demo's loop banner: fourteen silent, looping, self-hosted videos that behave as ONE unit. Nothing
   plays until the visitor presses Play; Play starts every loop from its first frame; Stop pauses every loop and returns
   it to its first frame, which is its poster, so stopped and still agree. The control reports its state in a live
   region. Progressive enhancement: without this script the posters stand as stills. (The site's loops.js precedent,
   ADR 0292, with Stop in place of Pause: owner ruling 2026-10-10.) */
(function () {
  "use strict";
  var banners = document.querySelectorAll("[data-loops]");
  Array.prototype.forEach.call(banners, function (banner) {
    var videos = banner.querySelectorAll("video"), toggle = banner.querySelector("[data-loops-toggle]"), status = banner.querySelector("[data-loops-status]");
    if (!toggle) return;
    var playing = false;
    function setState(on) {
      playing = on;
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
      toggle.textContent = on ? "⏹ STOP" : "▶ PLAY";
      if (status) status.textContent = on ? "All fourteen loops are playing from their first frame." : "All fourteen loops are stopped on their first frame.";
    }
    function playAll() {
      Array.prototype.forEach.call(videos, function (v) {
        try { v.currentTime = 0; } catch (_e) { /* not yet loaded: play() starts at 0 */ }
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      });
      setState(true);
    }
    function stopAll() {
      Array.prototype.forEach.call(videos, function (v) { v.pause(); try { v.currentTime = 0; v.load(); } catch (_e) { /* ignore */ } });   // load() puts the poster back
      setState(false);
    }
    toggle.addEventListener("click", function () { if (playing) stopAll(); else playAll(); });
    setState(false);
  });
})();
