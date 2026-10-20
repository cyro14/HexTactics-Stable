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

function New-TestPage([string[]]$Show, [string]$After) {
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
    # nome de arquivo seguro: apenas [a-zA-Z0-9] ('|' e outros chars sao
    # ilegais em nomes de arquivo no Windows)
    $safe = (($Show -join '+') + '|' + $After) -replace '[^a-zA-Z0-9]', ''
    if (-not $safe) { $safe = 'menu' }
    $name = '_test_tmp_' + $safe
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
    @{ id = 'leader-mobile'; kind = 'leader';     size = '400,800';  show = @(); after = 'openLeaderSelection(false, false)' }
)

$pages = @{}
foreach ($s in $screens) {
    $after = ''
    if ($s.after) { $after = $s.after }
    $key = ($s.show -join '+') + '|' + $after
    if (-not $pages.ContainsKey($key)) { $pages[$key] = New-TestPage $s.show $after }
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
