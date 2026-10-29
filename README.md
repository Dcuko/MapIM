# MapIM

Site do mapa do campus de Nova Iguaçu (IM) da UFRRJ. É possível pesquisar salas e departamentos ou navegar pelo mapa de cada andar.

Disponível em: https://www.dcc.ufrrj.br/mapaim

API usada: https://github.com/gusropdev/MapIM-API

## Estrutura

```
index.html        página de busca (campo com sugestões)
mapa.html         mapa dos andares: navegação livre ou rota até uma sala (?sala=&andar=&bloco=)
mapa2.html        redireciona para mapa.html (mantém links antigos)
css/              base.css (tokens e botões), home.css e map.css
js/               módulos ES: home, map, salas (dados/busca) e pan-zoom (arrastar/zoom/foco)
data/salas.json   lista de salas ({ id, andar, bloco })
img/              plantas (SVG) e imagens
```

## Executando localmente

O site usa módulos ES e `fetch`, então precisa ser servido por HTTP (não abre via `file://`):

```
python -m http.server 8000
```

Depois acesse http://localhost:8000.

## Adicionando uma sala

Inclua um objeto em `data/salas.json`. O `id` deve ser igual ao `id` do elemento correspondente no SVG do andar.
