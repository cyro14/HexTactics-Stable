# Gera paginas de teste a partir do index.html e valida com headless Chrome + asserts de pixels.
param([switch]$KeepArtifacts)

# NAO usar ErrorActionPreference='Stop' no PS 5.1: stderr de programas nativos
# (como o Chrome) vira ErrorRecord e encerra o script. Erros reais sao
# tratados explicitamente abaixo.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$artDir = Join-Path $PSScriptRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $artDir | Out-Null
if (-not $KeepArtifacts) { Remove-Item "$artDir\*.png" -ErrorAction SilentlyContinue }
# paginas temporarias ficam na RAIZ do projeto para que os caminhos
# relativos do jogo (css/, js/, img/) continuem validos
Remove-Item (Join-Path $root '_test_tmp_*.html') -ErrorAction SilentlyContinue

# ---------- ferramentas ----------
$candidates = @(
    "C:\Users\CYRO\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$py = @($candidates | Where-Object { $_ -like "*python*" -and (Test-Path $_) })[0]
if (-not $py) { $py = (Get-Command python -ErrorAction SilentlyContinue).Source }
$chrome = @($candidates | Where-Object { $_ -notlike "*python*" -and (Test-Path $_) })[0]
if (-not $py -or -not $chrome) { Write-Output "FALHA: python ou navegador headless nao encontrados"; exit 2 }
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = "C:\Users\CYRO\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" }

$failures = @()

# ---------- armadilha de erros JS (grava no DOM; lida via --dump-dom) ----------
$trap = '<script>(function(){function flush(){document.documentElement.setAttribute("data-js-errors",(window.__jsErrors||[]).length+"::"+(window.__jsErrors||[]).join(" | ").substring(0,300));}window.__jsErrors=[];window.__flushJsErrors=flush;window.onerror=function(m,s,l){window.__jsErrors.push(m+" ("+String(s||"").split("/").pop()+":"+l+")");flush();return false;};window.addEventListener("error",function(e){var t=e.target;if(t&&(t.src||t.href)){window.__jsErrors.push("recurso falhou: "+String(t.src||t.href).split("/").pop());flush();}},true);window.addEventListener("unhandledrejection",function(e){window.__jsErrors.push("promessa rejeitada: "+String(e.reason).substring(0,80));flush();});document.addEventListener("DOMContentLoaded",flush);})();</script>'

# ---------- estado de visibilidade por tela ----------
# id da tela -> @{ show = divs para exibir; hide = divs para esconder; pre = HTML fixo exigido }
$visRules = @{
    'main-menu'    = @{ match = '<div id="main-menu" class="layer screen mm-screen">'; }
    'mode-screen'  = @{ match = '<div id="mode-screen" class="layer screen mm-screen hidden">'; }
    'save-chooser' = @{ match = '<div id="save-chooser" class="layer screen save-chooser-screen hidden">'; }
}

function New-TestPage([string[]]$Show, [string]$After, [string]$Tag = '') {
    $html = Get-Content (Join-Path $root 'index.html') -Raw
    # injeta a armadilha de erros + desliga animações de entrada (determinismo
    # do screenshot) e remove a fonte remota (evita flake de rede; o layout
    # dos textos é validado com a fonte de fallback)
    $html = $html -replace '<head>', "<head>`n$trap`n<style>.mm-content,.save-chooser-card{animation:none !important}</style>"
    $html = $html -replace '<link\s+href="https://fonts\.googleapis\.com[^>]*>', '<!-- fonte remota removida pelo teste -->'
    if ($Show.Count -gt 0) {
        # esconde o menu principal quando outra tela for exibida
        $html = $html.Replace($visRules['main-menu'].match, '<div id="main-menu" class="layer screen mm-screen hidden">')
    }
    foreach ($scr in $Show) {
        $rule = $visRules[$scr]
        if (-not $html.Contains($rule.match)) { throw "marcador HTML nao encontrado para '$scr' (index.html mudou? atualize test/run-tests.ps1)" }
        $html = $html.Replace($rule.match, $rule.match.Replace(' hidden', ''))
    }
    # telas inicializadas por JS (ex.: seleção de líder) usam $After para
    # chamar a função real em vez de só expor a div via classe
    if ($After) {
        $inject = "<script>document.addEventListener('DOMContentLoaded',function(){try{ $After }catch(e){window.__jsErrors.push('teste: '+e);}if(window.__flushJsErrors)window.__flushJsErrors();});</script>"
        $html = $html -replace '</body>', "$inject`n</body>"
    }
    # nome de arquivo: tag curta e determinística (scripts $After longos
    # geravam nomes >260 chars e estouravam o limite de caminho do Windows);
    # fallback legível para páginas sem tag
    if ($Tag) {
        $name = '_test_tmp_' + $Tag
    } else {
        $safe = (($Show -join '+') + '|' + $After) -replace '[^a-zA-Z0-9]', ''
        if (-not $safe) { $safe = 'menu' }
        if ($safe.Length -gt 40) { $safe = $safe.Substring(0, 40) }
        $name = '_test_tmp_' + $safe
    }
    $path = Join-Path $root ($name + '.html')
    Set-Content $path $html -Encoding UTF8
    return $path
}

# ---------- 1. sintaxe de todos os JS ----------
Write-Output "=== 1. SINTAXE JS ==="
foreach ($js in (Get-ChildItem (Join-Path $root 'js') -Filter *.js) + (Get-Item (Join-Path $root 'sw.js'))) {
    & $node --check $js.FullName 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $failures += "SINTAXE: $($js.Name)"; Write-Output "[FAIL] sintaxe $($js.Name)" }
    else { Write-Output "[PASS] sintaxe $($js.Name)" }
}

# ---------- 2. telas: screenshot + asserts ----------
Write-Output "=== 2. TELAS (screenshot + pixels) ==="

# Setup de batalha compartilhado: abre a batalha de verdade (game-container
# visível), cria um líder do jogador com uma magia e seleciona — assim o
# painel/card, a action bar e os slots LoL são exercitados em cada execução
$battleSetup = 'document.getElementById("main-menu").classList.add("hidden"); document.getElementById("game-container").classList.remove("hidden"); game.leaderData=LEADERS[0]; game.currentRouteType="BATTLE"; game.generateCampaignMap([]); var ld=game.leaderData; var lu=game.units.find(u=>u.faction===1&&u.isLeader); if(!lu){var sp=[...game.map.values()].find(h=>!game.getUnitAt(h.q,h.r)&&h.terrain.id!=="WATER"&&h.terrain.id!=="MOUNTAIN"); lu=new Unit({q:sp.q,r:sp.r,faction:1,isLeader:true,name:ld.name,baseName:ld.name,emoji:ld.emoji,sprite:ld.sprite,hp:ld.hp,maxHp:ld.hp,mp:ld.mp,maxMp:ld.mp,atk:ld.atk,range:ld.range,level:1,xp:0,tags:(ld.tags||[]),abilities:[],fav:(ld.fav||[]),knownSpells:[],filter:"none"}); game.units.push(lu);} if(!lu.knownSpells.length&&typeof SPELLS!=="undefined"){var c1=SPELLS.find(s=>s.level===1&&(ld.tags||[]).some(t=>s.tags.includes(t)))||SPELLS[0]; lu.knownSpells.push(c1.id);} game.selectPlayerLeader(); game.selectedUnit=lu; game.calculateReachable(lu); var wf=[...game.map.values()].find(h=>!game.getUnitAt(h.q,h.r)&&h.terrain.id!=="WATER"&&h.terrain.id!=="MOUNTAIN"&&Hex.distance(h,lu)===1); if(wf){ var lw=new Unit({q:wf.q,r:wf.r,faction:1,name:"Lobo de Mana",baseName:"Lobo de Mana",emoji:"\u{1F43A}",sprite:"img/units/lobo.png",filter:"saturate(280%) hue-rotate(200deg) brightness(110%)",hp:35,maxHp:35,mp:4,maxMp:4,atk:12,range:1,abilities:["dodge"],tags:["MYSTIC"],isNew:false}); lw.knownSpells=lu.knownSpells; game.units.push(lw); game.selectedUnit=lw; game.calculateReachable(lw); document.documentElement.setAttribute("data-wolf","ok"); } updateUI(); showPopup("\u{1F6A9} Vila conquistada!", lu, "#c9a227"); addLog("\u{1F6A9} Teste: cr\xF3nica com \xEDcone", "#c9a227"); document.documentElement.setAttribute("data-fx", (document.querySelector(".dmg-popup .fx-ico") && document.querySelector("#combat-log .fx-ico")) ? "ok" : "none"); setTimeout(function(){ var foe=game.units.find(u=>u.faction===2&&u.isLeader); var expTut=Math.max(1,Math.floor(((game.rivalLeader?game.rivalLeader.hp:60)+20)*0.55)); document.documentElement.setAttribute("data-tuto", (game.isTutorialStage() && game.currentObjective==="DEFEAT_LEADER" && foe && foe.maxHp===expTut) ? "ok" : "fail"); }, 700);'

$screens = @(
    @{ id = 'menu';        kind = 'menu';         size = '1280,800'; show = @() },
    @{ id = 'menu-wide';   kind = 'menu';         size = '1920,1080'; show = @() },
    @{ id = 'menu-mobile'; kind = 'menu';         size = '400,800';  show = @() },
    @{ id = 'mode';        kind = 'mode';         size = '1280,800'; show = @('mode-screen') },
    @{ id = 'mode-mobile'; kind = 'mode-mobile';  size = '400,800';  show = @('mode-screen') },
    @{ id = 'chooser';     kind = 'chooser';      size = '1280,800'; show = @('mode-screen', 'save-chooser') },
    @{ id = 'leader';      kind = 'leader';       size = '1280,800'; show = @(); after = 'openLeaderSelection(false, false)' },
    @{ id = 'leader-mobile'; kind = 'leader';     size = '400,800';  show = @(); after = 'openLeaderSelection(false, false)' },
    @{ id = 'hexis';       kind = 'hexis';        size = '1280,800'; show = @(); after = 'game.leaderData=LEADERS[0]; game.conqueredRegions=["WEST","NW"]; openContinentMap();' },
    @{ id = 'hexis-mobile'; kind = 'hexis';       size = '400,800';  show = @(); after = 'game.leaderData=LEADERS[0]; game.conqueredRegions=["WEST","NW"]; openContinentMap();' },
    @{ id = 'route';       kind = 'route';        size = '1280,800'; show = @(); after = 'game.leaderData=LEADERS[0]; generateRouteMap(); renderRouteMap();' },
    @{ id = 'route-mobile'; kind = 'route';       size = '400,800';  show = @(); after = 'game.leaderData=LEADERS[0]; generateRouteMap(); renderRouteMap();' },
    @{ id = 'prep';        kind = 'prep';         size = '1280,800'; show = @(); after = 'game.currentRouteType="ELITE"; openManagement();' },
    @{ id = 'prep-mobile'; kind = 'prep';         size = '400,800';  show = @(); after = 'game.currentRouteType="ELITE"; openManagement();' },
    @{ id = 'battle';      kind = 'battle';       size = '1280,800'; show = @(); after = $battleSetup },
    @{ id = 'battle-mobile'; kind = 'battle';     size = '400,800';  show = @(); after = $battleSetup },
    @{ id = 'battle-details'; kind = 'battle-details'; size = '400,800'; show = @(); after = "$battleSetup showBeastDetails(lu, true);" },
    @{ id = 'pause';       kind = 'pause';        size = '1280,800'; show = @(); after = "$battleSetup document.documentElement.setAttribute('data-esc0', document.getElementById('pause-menu').classList.contains('hidden')); document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true})); document.documentElement.setAttribute('data-esc1', document.getElementById('pause-menu').classList.contains('hidden')); document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true})); document.documentElement.setAttribute('data-esc2', document.getElementById('pause-menu').classList.contains('hidden')); document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true})); document.documentElement.setAttribute('data-esc3', document.getElementById('pause-menu').classList.contains('hidden'));" }
)

$pages = @{}
$pageSeq = 0
foreach ($s in $screens) {
    $after = ''
    if ($s.after) { $after = $s.after }
    $key = ($s.show -join '+') + '|' + $after
    if (-not $pages.ContainsKey($key)) { $pageSeq++; $pages[$key] = New-TestPage $s.show $after ("p" + $pageSeq) }
    $page = $pages[$key]
    $img = Join-Path $artDir "$($s.id).png"
    $url = "file:///" + ($page -replace '\\', '/')
    & $chrome --headless --disable-gpu --no-sandbox --allow-file-access-from-files --screenshot="$img" --window-size=$($s.size) --virtual-time-budget=6000 $url 2>$null | Out-Null
    & $py (Join-Path $PSScriptRoot 'verify.py') $img $s.kind | ForEach-Object {
        Write-Output $_
        if ($_ -match '\[FAIL\]') { $failures += "$($s.id): $_" }
    }
}

# ---------- 3. erros de JS por tela (dump-dom + armadilha) ----------
Write-Output "=== 3. ERROS DE JS ==="
foreach ($key in $pages.Keys) {
    $page = $pages[$key]
    $url = "file:///" + ($page -replace '\\', '/')
    $dom = & $chrome --headless --disable-gpu --no-sandbox --allow-file-access-from-files --virtual-time-budget=6000 --dump-dom $url 2>$null | Out-String
    if ($dom -match 'data-js-errors="([^"]*)"') {
        $errs = $Matches[1]
        if ($errs -match '^0::') { Write-Output "[PASS] js limpo ($key)" }
        else { $failures += "JS ERRORS ($key): $errs"; Write-Output "[FAIL] ($key): $errs" }
    } else {
        $failures += "armadilha de erros ausente ($key)"
        Write-Output "[FAIL] armadilha de erros ausente ($key)"
    }
    # check de título duplicado na tela de líder (regressão do bug dos 2 títulos)
    if ($key -match 'openLeaderSelection') {
        $titleCount = ([regex]::Matches($dom, [regex]::Escape('Selecione seu'))).Count
        if ($titleCount -eq 1) { Write-Output "[PASS] titulo unico na selecao de lider" }
        else { $failures += "titulo duplicado/ausente na selecao de lider ($titleCount)"; Write-Output "[FAIL] titulo duplicado/ausente na selecao de lider ($titleCount)" }
    }
    # check de integridade do mapa de rotas (nos e linhas renderizados)
    if ($key -match 'renderRouteMap') {
        $nodeCount = ([regex]::Matches($dom, 'class="map-node ')).Count
        $lineCount = ([regex]::Matches($dom, '<line ')).Count
        if ($nodeCount -ge 20 -and $lineCount -ge 10) { Write-Output "[PASS] mapa de rotas completo ($nodeCount nos, $lineCount linhas)" }
        else { $failures += "mapa de rotas incompleto ($nodeCount nos, $lineCount linhas)"; Write-Output "[FAIL] mapa de rotas incompleto ($nodeCount nos, $lineCount linhas)" }
    }
    # check do bloco "Status Atual" do modal de detalhes (a "outra tela"
    # dos stats no modo retrato — clicar na foto do card abre isto)
    if ($key -match 'showBeastDetails') {
        $statsVisible = ($dom -notmatch 'id="bd-stats" class="bd-stats hidden"')
        $statsFilled = ($dom -match 'bds-portrait') -and ($dom -match 'bds-name')
        if ($statsVisible -and $statsFilled) { Write-Output "[PASS] modal de detalhes com status atual da unidade" }
        else { $failures += "modal de detalhes sem status atual (visivel=$statsVisible populado=$statsFilled)"; Write-Output "[FAIL] modal de detalhes sem status atual (visivel=$statsVisible populado=$statsFilled)" }
    }
    # check do menu de pausa: ESC abre -> fecha -> reabre, status da
    # campanha preenchido e confirmacao de abandono presente no DOM
    if ($key -match 'KeyboardEvent') {
        $escOk = ($dom -match 'data-esc0="true"') -and ($dom -match 'data-esc1="false"') -and ($dom -match 'data-esc2="true"') -and ($dom -match 'data-esc3="false"')
        $statusOk = ($dom -match 'id="pause-objective">[^<]+') -and ($dom -match 'id="pause-turn">[^<]+')
        $confirmOk = ($dom -match 'id="pause-quit-confirm"') -and ($dom -match 'id="btn-quit-yes"')
        if ($escOk -and $statusOk -and $confirmOk) { Write-Output "[PASS] menu de pausa: ESC funcional, status preenchido, confirmacao presente" }
        else { $failures += "menu de pausa com defeito (esc=$escOk status=$statusOk confirm=$confirmOk)"; Write-Output "[FAIL] menu de pausa com defeito (esc=$escOk status=$statusOk confirm=$confirmOk)" }
    }
    # check do lobo invocado (sprite procedural): o trap de 404 pega
    # sprite quebrado; data-wolf confirma que a unidade entrou no jogo
    if ($key -match 'data-wolf') {
        if ($dom -match 'data-wolf="ok"') { Write-Output "[PASS] lobo de mana invocado no tabuleiro (sprite procedural carregado)" }
        else { $failures += "lobo de mana nao invocado (data-wolf != ok)"; Write-Output "[FAIL] lobo de mana nao invocado (data-wolf != ok)" }
    }
    # TUTORIAL: o primeiro nó sempre tem missão DERROTAR O INIMIGO e
    # inimigos com HP reduzido (55%) — validado via data-tuto
    if ($key -match 'data-tuto') {
        if ($dom -match 'data-tuto="ok"') { Write-Output "[PASS] tutorial: missao derrotar inimigo + HP do adversario reduzido" }
        else { $failures += "tutorial incorreto (data-tuto != ok)"; Write-Output "[FAIL] tutorial incorreto (data-tuto != ok)" }
    }
    # check do efeito visual: popup com ícone SVG (emoji 🚩 substituído) e
    # crônica com ícone — prova o pipeline replaceEffectIcons end-to-end
    if ($key -match 'data-fx') {
        if ($dom -match 'data-fx="ok"') { Write-Output "[PASS] efeitos: popup + cronica com icones SVG (sem emojis)" }
        else { $failures += "efeitos sem icone SVG (data-fx != ok)"; Write-Output "[FAIL] efeitos sem icone SVG (data-fx != ok)" }
    }
    # check do painel lateral + action bar da batalha: unidade selecionada
    # DEVE renderizar retrato + barras HP/MP/XP + chips de combate, e as
    # magias aparecem como slots horizontais na action bar (pega crash do updateUI)
    if ($key -match 'generateCampaignMap') {
        $panelVisible = ($dom -notmatch 'battle-side-panel hidden')
        $barsOk = ($dom -match 'stat-bar-side-fill')
        $chipsOk = ($dom -match 'sc-chip-side')
        $terrainOk = ($dom -match 'terrain-chip')
        $actionOk = ($dom -match 'id="action-bar"')
        $slotOk = ($dom -match 'spell-slot-lol')
        # ícones de atributos: espada (ATK), alvo (ALC), bota (MOV) + preenchidos
        # harmonizados: coração (HP), ampulheta (Pronto), moeda (recursos)
        $iconsOk = ($dom -match 'M14\.5 17\.5 3 6') -and ($dom -match 'r="4\.5"') -and ($dom -match 'V21H6z') -and ($dom -match 'g-hp') -and ($dom -match 'M7 3h10v4') -and ($dom -match 'g-coin')
        if ($panelVisible -and $barsOk -and $chipsOk -and $terrainOk -and $actionOk -and $slotOk -and $iconsOk) { Write-Output "[PASS] painel lateral + action bar com detalhes da unidade (icones: espada/alvo/bota)" }
        else { $failures += "batalha sem detalhes (painel=$panelVisible barras=$barsOk chips=$chipsOk terreno=$terrainOk action=$actionOk slot=$slotOk icones=$iconsOk)"; Write-Output "[FAIL] batalha sem detalhes (painel=$panelVisible barras=$barsOk chips=$chipsOk terreno=$terrainOk action=$actionOk slot=$slotOk icones=$iconsOk)" }
    }
}

# ---------- resumo ----------
Write-Output "=============================="
if ($failures.Count -eq 0) {
    Write-Output "RESULTADO: TODOS OS TESTES PASSARAM"
    Remove-Item (Join-Path $root '_test_tmp_*.html') -ErrorAction SilentlyContinue
    exit 0
} else {
    Write-Output "RESULTADO: $($failures.Count) FALHAS"
    $failures | ForEach-Object { Write-Output " - $_" }
    Write-Output "Artifacts em: $artDir"
    exit 1
}
