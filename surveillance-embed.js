/**
 * Green loading spinner when the sketch has no active camera; iframe hidden so no black box.
 * When the camera is live, the sketch should postMessage so the iframe is shown.
 *
 * From https://kilianhoppner.github.io/surveillancecore-pt.1/ (or any trusted iframe origin):
 *
 *   window.parent.postMessage({ type: 'surveillancecore-pt1', phase: 'camera-active' }, '*');
 *
 * When camera is denied, stopped, or deactivated:
 *
 *   window.parent.postMessage({ type: 'surveillancecore-pt1', phase: 'camera-inactive' }, '*');
 *
 * Phases also accepted: tracking-ready → same as camera-active;
 * camera-denied, camera-error → same as camera-inactive.
 *
 * If the sketch never posts (old deploy), ~12s after iframe load we reveal the iframe anyway.
 */
(function () {
  var IFRAME_ORIGIN = 'https://kilianhoppner.github.io';
  var FALLBACK_MS = 12000;

  var fallbackTimers = new WeakMap();

  function clearFallback(embed) {
    var t = fallbackTimers.get(embed);
    if (t) clearTimeout(t);
    fallbackTimers.delete(embed);
  }

  function setCameraActive(embed, active) {
    embed.classList.toggle('surveillance-embed--camera-active', Boolean(active));
    if (active) clearFallback(embed);
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== IFRAME_ORIGIN) return;
    var data = event.data;
    if (data == null || typeof data !== 'object') return;
    if (data.type !== 'surveillancecore-pt1') return;

    var phase = data.phase;
    var active =
      phase === 'camera-active' ||
      phase === 'tracking-ready';
    var inactive =
      phase === 'camera-inactive' ||
      phase === 'camera-denied' ||
      phase === 'camera-error';

    if (!active && !inactive) return;

    document.querySelectorAll('.surveillance-embed iframe').forEach(function (iframe) {
      try {
        if (iframe.contentWindow !== event.source) return;
      } catch (e) {
        return;
      }
      var embed = iframe.closest('.surveillance-embed');
      if (!embed) return;
      if (active) setCameraActive(embed, true);
      if (inactive) setCameraActive(embed, false);
    });
  });

  /**
   * Re-arm the post-load fallback when the iframe slide is shown again (carousel) so a
   * finished load still gets a reveal timer if the sketch never postMessages.
   */
  function armSurveillanceEmbedFallback(embed) {
    if (!embed || embed.classList.contains('surveillance-embed--camera-active')) return;
    var iframe = embed.querySelector('iframe');
    if (!iframe || !iframe.getAttribute('src')) return;
    if (embed.dataset.surveillanceIframeLoaded !== '1') return;
    clearFallback(embed);
    var tid = setTimeout(function () {
      if (!embed.classList.contains('surveillance-embed--camera-active')) {
        setCameraActive(embed, true);
      }
      fallbackTimers.delete(embed);
    }, FALLBACK_MS);
    fallbackTimers.set(embed, tid);
  }

  window.armSurveillanceEmbedFallback = armSurveillanceEmbedFallback;

  function bindSurveillanceIframePlaceholders(root) {
    var base = root && root.querySelectorAll ? root : document;
    base.querySelectorAll('.surveillance-embed').forEach(function (embed) {
      if (embed.dataset.placeholderBound === '1') return;
      embed.dataset.placeholderBound = '1';

      var iframe = embed.querySelector('iframe');
      if (!iframe) return;

      if (!iframe.getAttribute('src')) {
        setCameraActive(embed, false);
        return;
      }

      setCameraActive(embed, false);

      iframe.addEventListener('load', function () {
        embed.dataset.surveillanceIframeLoaded = '1';
        clearFallback(embed);
        var tid = setTimeout(function () {
          if (!embed.classList.contains('surveillance-embed--camera-active')) {
            setCameraActive(embed, true);
          }
          fallbackTimers.delete(embed);
        }, FALLBACK_MS);
        fallbackTimers.set(embed, tid);
      });
    });
  }

  window.bindSurveillanceIframePlaceholders = bindSurveillanceIframePlaceholders;

  function boot() {
    bindSurveillanceIframePlaceholders(document.body);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
