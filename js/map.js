import { createPanZoom } from './pan-zoom.js';
import { andarLabel, loadSalas } from './salas.js';

const FLOORS = [1, 2, 3, 4];
const VIEWBOX_PADDING = 0.03;
const LABEL_SIZE_TOLERANCE = 0.25;
const AUTO_ID = /^(path|rect|g|text|tspan|use)d*$/; // ids gerados pelo Inkscape

const params = new URLSearchParams(window.location.search);
let targetName = params.get('sala');
let targetBloco = params.get('bloco');
const initialFloor = FLOORS.includes(Number(params.get('andar'))) ? Number(params.get('andar')) : 1;

const stage = document.getElementById('stage');
const status = document.getElementById('status');
const tabs = document.querySelectorAll('.floor-tab');
const sheet = {
  root: document.getElementById('sheet'),
  meta: document.getElementById('sheet-meta'),
  title: document.getElementById('sheet-title'),
  text: document.getElementById('sheet-text'),
};

const panZoom = createPanZoom(stage, { minScale: 0.8, maxScale: 10 });
const svgCache = new Map();
let salasById = new Map();
let currentFloor = null;
let selected = null;
let targetRoom = null;

function describeLocation(andar, bloco) {
  const floor = andarLabel(andar);
  return bloco && bloco !== floor ? `${floor} · ${bloco}` : floor;
}

function describeRoute(sala, andar, bloco) {
  if (sala.includes('SALA')) {
    return `Vá para o ${andar}º andar no bloco ${bloco}, onde você irá achar a ${sala} no local destacado no mapa.`;
  }
  if (andar === 1) {
    return `Fique no 1º andar e vá para o bloco ${bloco}, onde você irá achar a sala ${sala} no local destacado no mapa.`;
  }
  if (andar === 4) {
    return `Vá para o prédio da pós e você irá achar a sala ${sala} no local destacado no mapa.`;
  }
  return `Vá para o ${andar}º andar, depois para o bloco ${bloco}, onde você irá achar a sala ${sala} no local destacado no mapa.`;
}

function showSheet({ meta, title, text }) {
  sheet.meta.textContent = meta;
  sheet.title.textContent = title;
  sheet.text.textContent = text;
  sheet.text.hidden = !text;
  sheet.root.hidden = false;
}

function select(room) {
  selected?.classList.remove('is-selected');
  selected = room;
  room?.classList.add('is-selected');
}

function setStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

async function fetchFloor(andar) {
  if (!svgCache.has(andar)) {
    const response = await fetch(`img/${andar}-andar.svg`);
    if (!response.ok) {
      throw new Error(`Falha ao carregar o mapa do ${andar}º andar (HTTP ${response.status})`);
    }
    svgCache.set(andar, await response.text());
  }
  return svgCache.get(andar);
}

/** Ajusta o viewBox ao desenho (as plantas vêm numa página A4 com muita margem vazia). */
function fitToContent(svg) {
  const box = svg.getBBox();
  const padX = box.width * VIEWBOX_PADDING;
  const padY = box.height * VIEWBOX_PADDING;
  svg.setAttribute('viewBox', `${box.x - padX} ${box.y - padY} ${box.width + padX * 2} ${box.height + padY * 2}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
}

/** Salas são formas invisíveis (fill:none) com nome próprio, sobre o desenho da planta. */
function isRoom(shape) {
  return (
    !shape.closest('defs') &&
    shape.getAttribute('style')?.includes('fill:none') &&
    !AUTO_ID.test(shape.id)
  );
}

/** Uniformiza o tamanho dos rótulos: os que fogem pouco do tamanho mais comum voltam a ele (títulos ficam como estão). */
function normalizeLabelSizes(svg) {
  const labels = [...svg.querySelectorAll('text, tspan')].filter((el) => parseFloat(el.style.fontSize));
  const counts = new Map();
  labels.forEach((el) => {
    const size = parseFloat(el.style.fontSize);
    counts.set(size, (counts.get(size) ?? 0) + 1);
  });
  const [base] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!base) return;

  labels.forEach((el) => {
    const size = parseFloat(el.style.fontSize);
    if (Math.abs(size - base) / base <= LABEL_SIZE_TOLERANCE) el.style.fontSize = `${base}px`;
  });
}

async function showFloor(andar) {
  currentFloor = andar;
  tabs.forEach((tab) => tab.setAttribute('aria-pressed', String(Number(tab.dataset.andar) === andar)));
  setStatus('Carregando mapa…');
  select(null);
  targetRoom = null;

  try {
    const markup = await fetchFloor(andar);
    if (currentFloor !== andar) return; // o usuário já trocou de andar

    const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').querySelector('svg');
    stage.replaceChildren(svg);
    fitToContent(svg);
    normalizeLabelSizes(svg);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Planta do ${andarLabel(andar)}`);
    svg.querySelectorAll('rect[id], path[id]').forEach((shape) => {
      if (isRoom(shape)) shape.classList.add('sala');
    });
    setStatus('');
    panZoom.reset();
  } catch (error) {
    console.error(error);
    setStatus('Não foi possível carregar o mapa. Tente novamente.');
    return;
  }

  const url = new URL(window.location);
  url.searchParams.set('andar', andar);
  history.replaceState(null, '', url);
}

function roomInfo(room) {
  const known = salasById.get(room.id);
  const bloco = known?.bloco ?? (room.id === targetName ? targetBloco : null);
  return {
    meta: describeLocation(currentFloor, bloco),
    title: room.id,
    text: '',
  };
}

function highlightTarget() {
  const room = [...stage.querySelectorAll('.sala')].find((el) => el.id === targetName);
  if (!room) {
    showSheet({
      meta: andarLabel(currentFloor),
      title: 'Sala não encontrada',
      text: `Não achamos “${targetName}” nesta planta. Use os andares acima para procurar.`,
    });
    return;
  }
  targetRoom = room;
  room.classList.add('is-target');
  select(room);
  const bloco = targetBloco ?? salasById.get(targetName)?.bloco ?? '';
  showSheet({
    meta: describeLocation(currentFloor, bloco),
    title: targetName,
    text: describeRoute(targetName, currentFloor, bloco),
  });
  panZoom.focusOn(room);
}

tabs.forEach((tab) => {
  tab.addEventListener('click', async () => {
    const andar = Number(tab.dataset.andar);
    if (andar === currentFloor) return;
    sheet.root.hidden = true;
    targetName = null;
    targetBloco = null;
    const url = new URL(window.location);
    url.searchParams.delete('sala');
    url.searchParams.delete('bloco');
    history.replaceState(null, '', url);
    await showFloor(andar);
  });
});

stage.addEventListener('click', (event) => {
  if (panZoom.wasDragged()) return;
  const room = event.target.closest('.sala');
  if (!room) {
    select(null);
    sheet.root.hidden = true;
    return;
  }
  select(room);
  if (room === targetRoom) {
    highlightTarget();
  } else {
    showSheet(roomInfo(room));
  }
});

document.getElementById('sheet-close').addEventListener('click', () => {
  sheet.root.hidden = true;
  select(null);
});
document.getElementById('zoom-in').addEventListener('click', () => panZoom.zoomBy(1.5));
document.getElementById('zoom-out').addEventListener('click', () => panZoom.zoomBy(1 / 1.5));
document.getElementById('zoom-reset').addEventListener('click', () => panZoom.reset());

try {
  salasById = new Map((await loadSalas()).map((sala) => [sala.id, sala]));
} catch (error) {
  console.error(error); // o mapa funciona sem a lista; só perde o nome do bloco
}

await showFloor(initialFloor);
if (targetName && currentFloor === initialFloor && stage.firstChild) {
  highlightTarget();
}
