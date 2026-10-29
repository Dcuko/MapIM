import { andarLabel, loadSalas, normalize, searchSalas } from './salas.js';

const form = document.getElementById('form');
const input = document.getElementById('search');
const list = document.getElementById('results');
const errorMessage = document.getElementById('search-error');

let salas = [];
let results = [];
let active = -1;

function highlight(text, query) {
  const fragment = document.createDocumentFragment();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const folded = normalize(text);
  // `normalize` preserva o comprimento aqui (só remove marcas combinantes já decompostas),
  // então os índices da versão sem acento valem para o texto original.
  const aligned = folded.length === text.length;
  const first = aligned ? terms.map((term) => folded.indexOf(term)).filter((i) => i >= 0).sort((a, b) => a - b)[0] : undefined;

  if (first === undefined) {
    fragment.append(text);
    return fragment;
  }
  const term = terms.find((t) => folded.indexOf(t) === first);
  const mark = document.createElement('mark');
  mark.textContent = text.slice(first, first + term.length);
  fragment.append(text.slice(0, first), mark, text.slice(first + term.length));
  return fragment;
}

function setActive(index) {
  active = index;
  [...list.children].forEach((item, i) => {
    const isActive = i === index;
    item.setAttribute('aria-selected', String(isActive));
    if (isActive) {
      input.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({ block: 'nearest' });
    }
  });
  if (index < 0) input.removeAttribute('aria-activedescendant');
}

function closeList() {
  list.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  setActive(-1);
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
  input.setAttribute('aria-invalid', String(Boolean(message)));
}

function renderResults() {
  results = searchSalas(salas, input.value);
  list.replaceChildren(
    ...results.map((sala, index) => {
      const item = document.createElement('li');
      item.id = `result-${index}`;
      item.role = 'option';

      const name = document.createElement('span');
      name.className = 'result-name';
      name.append(highlight(sala.id, input.value));

      const meta = document.createElement('span');
      meta.className = 'result-meta';
      meta.textContent = `${andarLabel(sala.andar)} · ${sala.bloco}`;

      item.append(name, meta);
      item.addEventListener('pointerdown', (event) => {
        event.preventDefault(); // mantém o foco no campo
        goTo(sala);
      });
      return item;
    }),
  );
  list.hidden = results.length === 0;
  input.setAttribute('aria-expanded', String(results.length > 0));
  setActive(-1);
}

function goTo(sala) {
  const params = new URLSearchParams({ sala: sala.id, andar: sala.andar, bloco: sala.bloco });
  window.location.href = `mapa.html?${params}`;
}

input.addEventListener('input', () => {
  showError('');
  renderResults();
});

input.addEventListener('focus', () => {
  if (input.value) renderResults();
});

input.addEventListener('blur', closeList);

input.addEventListener('keydown', (event) => {
  if (list.hidden || !results.length) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setActive((active + 1) % results.length);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    setActive((active - 1 + results.length) % results.length);
  } else if (event.key === 'Escape') {
    closeList();
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  const matches = active >= 0 ? [results[active]] : searchSalas(salas, query, 1);
  if (!matches.length) {
    showError(`Nenhuma sala encontrada para “${query}”. Tente outro nome.`);
    return;
  }
  goTo(matches[0]);
});

try {
  salas = await loadSalas();
} catch (error) {
  console.error(error);
  showError('Não foi possível carregar a lista de salas. Recarregue a página.');
}
