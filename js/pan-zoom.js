const DRAG_THRESHOLD = 5;

/**
 * Arrastar, zoom (roda do mouse, pinça e botões) e foco em elementos.
 *
 * `stage` é transformado com translate + scale (origem no canto superior esquerdo)
 * e `stage.parentElement` é a área visível. A escala 1 corresponde ao mapa ajustado à tela.
 */
export function createPanZoom(stage, { minScale = 0.8, maxScale = 8 } = {}) {
  const viewport = stage.parentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = { x: 0, y: 0, scale: 1 };
  const pointers = new Map();
  let gesture = null;
  let dragged = false;
  let animationTimer;

  const clampScale = (value) => Math.min(Math.max(value, minScale), maxScale);

  function apply(animate = false) {
    clearTimeout(animationTimer);
    const shouldAnimate = animate && !reducedMotion.matches;
    stage.style.transition = shouldAnimate ? 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    stage.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  }

  /** Muda a escala mantendo fixo o ponto (cx, cy), em coordenadas da área visível. */
  function zoomAt(cx, cy, nextScale, animate = false) {
    const scale = clampScale(nextScale);
    const ratio = scale / state.scale;
    state.x = cx - (cx - state.x) * ratio;
    state.y = cy - (cy - state.y) * ratio;
    state.scale = scale;
    apply(animate);
  }

  function zoomBy(factor) {
    const { width, height } = viewport.getBoundingClientRect();
    zoomAt(width / 2, height / 2, state.scale * factor, true);
  }

  function reset() {
    Object.assign(state, { x: 0, y: 0, scale: 1 });
    apply(true);
  }

  /** Centraliza `element` na tela, com zoom para ele ocupar cerca de metade da área visível. */
  function focusOn(element, { fill = 0.5, minZoom = 1.5, maxZoom = 4 } = {}) {
    const view = viewport.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const fitted = Math.min(
      (view.width * fill) / (box.width / state.scale),
      (view.height * fill) / (box.height / state.scale),
    );
    const scale = Math.min(Math.max(fitted, minZoom), maxZoom);
    const px = (box.left + box.width / 2 - view.left - state.x) / state.scale;
    const py = (box.top + box.height / 2 - view.top - state.y) / state.scale;
    state.scale = clampScale(scale);
    state.x = view.width / 2 - px * state.scale;
    state.y = view.height / 2 - py * state.scale;
    apply(true);
  }

  function startGesture() {
    const [a, b] = [...pointers.values()];
    gesture = {
      x: state.x,
      y: state.y,
      scale: state.scale,
      origin: b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: a.x, y: a.y },
      distance: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
    };
  }

  viewport.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragged = false;
    startGesture();
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const [a, b] = [...pointers.values()];
    const center = b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
    const moved = Math.hypot(center.x - gesture.origin.x, center.y - gesture.origin.y);

    if (!dragged && (moved > DRAG_THRESHOLD || b)) {
      dragged = true;
      viewport.classList.add('is-dragging');
      // A captura só começa ao arrastar, para que um clique simples chegue ao elemento clicado.
      viewport.setPointerCapture(event.pointerId);
    }
    if (!dragged) return;

    const view = viewport.getBoundingClientRect();
    state.scale = b
      ? clampScale(gesture.scale * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance))
      : gesture.scale;
    const ratio = state.scale / gesture.scale;
    const ox = gesture.origin.x - view.left;
    const oy = gesture.origin.y - view.top;
    state.x = center.x - view.left - (ox - gesture.x) * ratio;
    state.y = center.y - view.top - (oy - gesture.y) * ratio;
    apply();
  });

  const release = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size) {
      startGesture();
    } else {
      gesture = null;
      viewport.classList.remove('is-dragging');
      // O "click" dispara logo após o pointerup; só depois disso um novo toque deixa de ser arrasto.
      setTimeout(() => {
        dragged = false;
      });
    }
  };
  viewport.addEventListener('pointerup', release);
  viewport.addEventListener('pointercancel', release);

  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const view = viewport.getBoundingClientRect();
      zoomAt(event.clientX - view.left, event.clientY - view.top, state.scale * Math.exp(-event.deltaY * 0.0015));
    },
    { passive: false },
  );

  apply();

  return { zoomBy, reset, focusOn, wasDragged: () => dragged };
}
