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
    @{ id = 'battle';      kind = 'battle';       size = '1280,800'; show = @(); after = 'document.getElementById("main-menu").classList.add("hidden"); document.getElementById("game-container").classList.remove("hidden"); game.leaderData=LEADERS[0]; game.currentRouteType="BATTLE"; game.generateCampaignMap([]); var ld=game.leaderData; var lu=game.units.find(u=>u.faction===1&&u.isLeader); if(!lu){var sp=[...game.map.values()].find(h=>!game.getUnitAt(h.q,h.r)&&h.terrain.id!=="WATER"&&h.terrain.id!=="MOUNTAIN"); lu=new Unit({q:sp.q,r:sp.r,faction:1,isLeader:true,name:ld.name,baseName:ld.name,emoji:ld.emoji,sprite:ld.sprite,hp:ld.hp,maxHp:ld.hp,mp:ld.mp,maxMp:ld.mp,atk:ld.atk,range:ld.range,level:1,xp:0,tags:(ld.tags||[]),abilities:[],fav:(ld.fav||[]),knownSpells:[],filter:"none"}); game.units.push(lu);} if(!lu.knownSpells.length&&typeof SPELLS!=="undefined"){var c1=SPELLS.find(s=>s.level===1&&(ld.tags||[]).some(t=>s.tags.includes(t)))||SPELLS[0]; lu.knownSpells.push(c1.id);} game.selectPlayerLeader(); game.selectedUnit=lu; game.calculateReachable(lu); updateUI();' },
    @{ id = 'battle-mobile'; kind = 'battle';    size = '400,800';  show = @(); after = 'document.getElementById("main-menu").classList.add("hidden"); document.getElementById("game-container").classList.remove("hidden"); game.leaderData=LEADERS[0]; game.currentRouteType="BATTLE"; game.generateCampaignMap([]); var ld=game.leaderData; var lu=game.units.find(u=>u.faction===1&&u.isLeader); if(!lu){var sp=[...game.map.values()].find(h=>!game.getUnitAt(h.q,h.r)&&h.terrain.id!=="WATER"&&h.terrain.id!=="MOUNTAIN"); lu=new Unit({q:sp.q,r:sp.r,faction:1,isLeader:true,name:ld.name,baseName:ld.name,emoji:ld.emoji,sprite:ld.sprite,hp:ld.hp,maxHp:ld.hp,mp:ld.mp,maxMp:ld.mp,atk:ld.atk,range:ld.range,level:1,xp:0,tags:(ld.tags||[]),abilities:[],fav:(ld.fav||[]),knownSpells:[],filter:"none"}); game.units.push(lu);} if(!lu.knownSpells.length&&typeof SPELLS!=="undefined"){var c1=SPELLS.find(s=>s.level===1&&(ld.tags||[]).some(t=>s.tags.includes(t)))||SPELLS[0]; lu.knownSpells.push(c1.id);} game.selectPlayerLeader(); game.selectedUnit=lu; game.calculateReachable(lu); updateUI();' }
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
    & $chrome --headless --disable-gpu --no-sandbox --screenshot="$img" --window-size=$($s.size) --virtual-time-budget=6000 $url 2>$null | Out-Null
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
    $dom = & $chrome --headless --disable-gpu --no-sandbox --virtual-time-budget=6000 --dump-dom $url 2>$null | Out-String
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
        if ($panelVisible -and $barsOk -and $chipsOk -and $terrainOk -and $actionOk -and $slotOk) { Write-Output "[PASS] painel lateral + action bar com detalhes da unidade" }
        else { $failures += "batalha sem detalhes (painel=$panelVisible barras=$barsOk chips=$chipsOk terreno=$terrainOk action=$actionOk slot=$slotOk)"; Write-Output "[FAIL] batalha sem detalhes (painel=$panelVisible barras=$barsOk chips=$chipsOk terreno=$terrainOk action=$actionOk slot=$slotOk)" }
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
