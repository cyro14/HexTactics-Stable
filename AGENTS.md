# AGENTS.md — Biomancer Tactics

Guia obrigatório para agentes de IA (e humanos) trabalhando neste repositório.

## O que é

Jogo de estratégia tática em grid hexagonal, 100% front-end (HTML + CSS + JS puro, sem build, sem framework). O nome do jogo é **Biomancer Tactics** (era "Hex Tactics"). As chaves de save/localStorage ainda usam os prefixos antigos (`ht_save_*`, `HexTactics_*`) — **não renomear**, isso quebraria os saves existentes dos jogadores.

## Estrutura

| Caminho        | Conteúdo                                                            |
| -------------- | ------------------------------------------------------------------- |
| `index.html`   | Todas as telas do jogo (padrão: `div.layer.screen` + classe `hidden`) |
| `css/style.css`| Todo o estilo                                                       |
| `js/data.js`   | Helpers globais (`$()`, `hide()`) e constantes                      |
| `js/menu-bg.js`| Fundo animado procedural compartilhado (céu, lua, ilhas hex)        |
| `js/engine.js` | Regras do jogo                                                      |
| `js/ui.js`     | Lógica/renderização de telas                                        |
| `js/main.js`   | Eventos de input, handlers de botões, inicialização                 |
| `img/`         | Arte do jogo (sprites, retratos, ícones)                            |
| `test/`        | Suíte de testes automáticos (ver abaixo)                            |

## Regras críticas de UI

1. **IDs de botões são a API entre HTML e JS.** Nunca remova/renomeie um `id` sem atualizar todos os handlers em `js/main.js`/`js/ui.js`.
2. **Telas** seguem o padrão `<div id="x-screen" class="layer screen [classes-estilo] hidden">`. Mostrar/esconder é sempre `classList` de `hidden` — nunca `display` inline.
3. **Fundo animado**: adicione `<canvas class="mm-bg-canvas"></canvas>` como primeiro filho da `.layer`. O `menu-bg.js` pinta automaticamente toda `.mm-bg-canvas` cuja tela dona não esteja `hidden`. A tela precisa de `background` opaco escuro no CSS (ex.: `#06070d`).
4. **Ícones**: SVG inline com `class="mm-ico"` (usa `stroke: currentColor`), desenhados no padrão de linha dourada. Não usar emoji na UI.
5. **Botões de menu**: `class="mm-btn"` (+ variantes `mm-btn-primary`, `mm-btn-danger`, e acentos `mm-btn-relic/bestiary/help/editor/hall`).
6. **z-index**: `.screen` = 300. Modais sobre telas usam **320+** (ex.: `#save-chooser`).
7. **Specificidade**: o `button:hover:not(:disabled)` global (css/style.css) tem especificidade `(0,2,1)`. Hovers customizados devem usar `.classe:hover:not(:disabled)` para vencer.
8. **Saves**: o seletor de save (`#save-chooser`) aparece DEPOIS da tela de modos, quando o modo clicado tem save (`ht_save_camp` / `ht_save_rogue` / `ht_save_duel`).

## 🧪 Testes automáticos — OBRIGATÓRIOS a cada função nova

Após **qualquer** alteração (nova tela, novo botão, mudança de estilo, refatoração, troca de imagem), rode:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File test/run-tests.ps1
```

**Só considere o trabalho concluído com todos os testes passando (exit 0).**

### O que a suíte valida

1. **Sintaxe de todo o JS** (`node --check` em cada arquivo, incluindo `sw.js`).
2. **Telas visuais**: gera páginas de teste (cópias do `index.html` com telas expostas), tira screenshots headless no Chrome em 6 combinações de tela/resolução e valida com asserts de pixels (`test/verify.py`):
   - `menu` — 1280×800, 1920×1080, 400×800: céu pintado, lua, logo na metade superior, botão JOGAR dourado
   - `mode` — 1280×800: título, acentos azul/vermelho/laranja dos cards, artes, botões inferiores
   - `mode-mobile` — 400×800: cards empilhados
   - `chooser` — 1280×800: botões Continuar/Começar Novamente, fundo animado atrás do backdrop
3. **Erros de JS e recursos 404 por tela**: uma armadilha `window.onerror` é injetada na página e lida via `--dump-dom` (atributo `data-js-errors`). Qualquer erro de runtime, promise rejeitada ou recurso quebrado (`.js`, `.css`, imagem) **falha a suíte**.

### Quando algo quebra

- Os screenshots ficam em `test/artifacts/` para comparação visual.
- Falhas de pixel geralmente significam: tela esqueceu `mm-bg-canvas`, cor/posição mudou (atualize o assert em `verify.py`), ou conteúdo sumiu (bug real).
- Falha "marcador HTML não encontrado" = o marcador da div mudou (edite `$visRules` em `run-tests.ps1`).

### Ao adicionar tela nova na suíte

1. Em `test/run-tests.ps1`: registre o marcador da div em `$visRules` e adicione uma entrada em `$screens` (com `id`, `kind` e resolução).
2. Em `test/verify.py`: adicione os asserts do novo `kind` (copie um existente como base; prefira checks de cor com tolerância).
3. Rode a suíte até tudo passar.

### Limitações conhecidas

- A suíte valida **estado inicial das telas**, não cliques/gameplay (não há automação de interação ainda).
- Chrome headless é obrigatório (o script tenta Edge como fallback). Python precisa de `Pillow`.
- Rodar em `powershell` 5.1 (não usar `$ErrorActionPreference='Stop'` no script — stderr de programas nativos encerra o PS 5.1).

## Checklist a cada mudança

- [ ] Li as Regras críticas acima
- [ ] Rodei `test/run-tests.ps1` **antes de entregar**
- [ ] Se adicionei tela/botão: adicionei na suíte (`$visRules`/`$screens`/`verify.py`)
- [ ] Se mudei cores/layout: ajustei os asserts afetados
- [ ] Nenhum emoji novo na UI (usar SVG `mm-ico`)
- [ ] Não quebrei IDs existentes nem chaves de save
