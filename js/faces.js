// Caras animadas de los fundadores (mejora progresiva).
// Sin JS, sin soporte de VP9 con alfa (Safari / WebKit) o con movimiento reducido: se ve solo el póster.
// Con soporte: alterna los clips «neutra» y «fiesta» y solo reproduce mientras la insignia está en pantalla.

function supportsAlphaWebm() {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return false;
  // WebKit (Safari y cualquier navegador de iOS) no pinta bien el canal alfa de VP9.
  if (/Apple/.test(navigator.vendor || '')) return false;
  const probe = document.createElement('video');
  return typeof probe.canPlayType === 'function' && probe.canPlayType('video/webm; codecs="vp9"') !== '';
}

function setupBadge(badge) {
  const clips = Array.from(badge.querySelectorAll('video'));
  if (clips.length === 0) return null;
  let current = 0;
  let wanted = false; // true mientras la insignia está en pantalla

  const show = (i) => clips.forEach((v, k) => v.classList.toggle('is-on', k === i));
  const safePlay = (v) => {
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return p;
  };

  function onEnded(e) {
    if (!wanted) return;
    const prev = clips.indexOf(e.currentTarget);
    if (prev !== current) return;
    const next = (current + 1) % clips.length;
    const v = clips[next];
    v.currentTime = 0;
    const p = safePlay(v);
    const swap = () => { current = next; show(next); };
    if (p && typeof p.then === 'function') p.then(swap, () => { clips[prev].currentTime = 0; safePlay(clips[prev]); });
    else swap();
  }

  clips.forEach((v) => {
    v.loop = clips.length === 1; // con dos clips se alternan al terminar cada uno
    v.addEventListener('ended', onEnded);
  });

  return {
    play() {
      wanted = true;
      clips.forEach((v) => { if (v.preload === 'none') v.preload = 'auto'; });
      safePlay(clips[current]);
    },
    pause() {
      wanted = false;
      clips.forEach((v) => v.pause());
    },
    reset() {
      wanted = false;
      clips.forEach((v) => {
        v.removeEventListener('ended', onEnded);
        v.pause();
        v.loop = true;
      });
      current = 0;
      show(0);
      // Vuelve a mostrar el póster si el primer clip ya había cargado fotogramas.
      if (clips[0].readyState > 0) {
        clips[0].preload = 'none';
        clips[0].load();
      }
    },
  };
}

/**
 * @param {Iterable<Element>} badges  elementos .face-badge
 * @param {{ animate: boolean }} opts
 * @returns {{ stop(): void }}
 */
export function startFaces(badges, { animate }) {
  const list = Array.from(badges || []);
  if (!animate || list.length === 0 || typeof IntersectionObserver === 'undefined' || !supportsAlphaWebm()) {
    return { stop() {} };
  }

  const controllers = new Map();
  list.forEach((b) => {
    const c = setupBadge(b);
    if (c) controllers.set(b, c);
  });

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const c = controllers.get(e.target);
      if (!c) continue;
      if (e.isIntersecting) c.play();
      else c.pause();
    }
  }, { threshold: 0.25 });
  controllers.forEach((_, b) => io.observe(b));

  return {
    stop() {
      io.disconnect();
      controllers.forEach((c) => c.reset());
      controllers.clear();
    },
  };
}
