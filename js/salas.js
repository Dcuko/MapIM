/** Carrega a lista de salas ({ id, andar, bloco }) de data/salas.json. */
export async function loadSalas() {
  const response = await fetch('data/salas.json');
  if (!response.ok) {
    throw new Error(`Falha ao carregar salas (HTTP ${response.status})`);
  }
  return response.json();
}

/** Minúsculas e sem acentos, para comparar textos digitados pelo usuário. */
export function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

/** Busca uma sala pelo nome exato, ignorando maiúsculas, acentos e espaços nas pontas. */
export function findSala(salas, name) {
  const wanted = normalize(name);
  return salas.find((sala) => normalize(sala.id) === wanted);
}

/** Salas cujo nome contém todas as palavras da consulta, as que começam pela consulta primeiro. */
export function searchSalas(salas, query, limit = 8) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  const matches = [];
  for (const sala of salas) {
    const name = normalize(sala.id);
    if (terms.every((term) => name.includes(term))) {
      matches.push({ sala, startsWith: name.startsWith(terms[0]) });
    }
  }
  matches.sort((a, b) => Number(b.startsWith) - Number(a.startsWith));
  return matches.slice(0, limit).map(({ sala }) => sala);
}

export function andarLabel(andar) {
  return Number(andar) === 4 ? 'Pós-Graduação' : `${andar}º andar`;
}
