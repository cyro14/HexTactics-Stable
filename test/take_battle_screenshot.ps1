# Gera screenshot da tela de batalha para validação visual
$root = 'D:\Documentos\GitHub\HexTactics-Stable'
$artDir = Join-Path $root 'test\artifacts'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'

# HTML da armadilha de erros
$trap = '<script>(function(){function flush(){document.documentElement.setAttribute("data-js-errors",(window.__jsErrors||[]).length+"::"+(window.__jsErrors||[]).join(" | ").substring(0,300));}window.__jsErrors=[];window.__flushJsErrors=flush;window.onerror=function(m,s,l){window.__jsErrors.push(m+" ("+String(s||"").split("/").pop()+":"+l+")");flush();return false;};window.addEventListener("error",function(e){var t=e.target;if(t&&(t.src||t.href)){window.__jsErrors.push("recurso falhou: "+String(t.src||t.href).split("/").pop());flush();}},true);window.addEventListener("unhandledrejection",function(e){window.__jsErrors.push("promessa rejeitada: "+String(e.reason).substring(0,80));flush();});document.addEventListener("DOMContentLoaded",flush);})();</script>'

# Lê o index.html
$html = Get-Content (Join-Path $root 'index.html') -Raw

# Injeta armadilha e desliga animações
$html = $html -replace '<head>', "<head>`n$trap`n<style>.mm-content,.save-chooser-card,.turn-banner{animation:none !important}</style>"
$html = $html -replace '<link\s+href="https://fonts\.googleapis\.com[^>]*>', '<!-- fonte remota removida pelo teste -->'

# Esconde menu principal, mostra game-container
$html = $html.Replace('<div id="main-menu" class="layer screen mm-screen">', '<div id="main-menu" class="layer screen mm-screen hidden">')
$html = $html.Replace('<div id="game-container" class="hidden">', '<div id="game-container" class="">')

# Inicialização da batalha: cria um líder do jogador (generateCampaignMap
# com roster vazio não cria nenhum), dá uma magia a ele e renderiza painel +
# action bar com slots de magia
$inject = @"
<script>
document.addEventListener('DOMContentLoaded',function(){
    try{
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        game.leaderData=LEADERS[0];
        game.currentRouteType='BATTLE';
        game.generateCampaignMap([]);
        var ld=game.leaderData;
        var lu=game.units.find(u=>u.faction===1&&u.isLeader);
        if(!lu){
            var sp=[...game.map.values()].find(h=>!game.getUnitAt(h.q,h.r)&&h.terrain.id!=="WATER"&&h.terrain.id!=="MOUNTAIN");
            lu=new Unit({q:sp.q,r:sp.r,faction:1,isLeader:true,name:ld.name,baseName:ld.name,emoji:ld.emoji,sprite:ld.sprite,hp:ld.hp,maxHp:ld.hp,mp:ld.mp,maxMp:ld.mp,atk:ld.atk,range:ld.range,level:1,xp:0,tags:(ld.tags||[]),abilities:[],fav:(ld.fav||[]),knownSpells:[],filter:"none"});
            game.units.push(lu);
        }
        if(!lu.knownSpells.length&&typeof SPELLS!=="undefined"){
            var c1=SPELLS.find(s=>s.level===1&&(ld.tags||[]).some(t=>s.tags.includes(t)))||SPELLS[0];
            lu.knownSpells.push(c1.id);
        }
        game.selectPlayerLeader();
        game.selectedUnit=lu;
        game.calculateReachable(lu);
        updateUI();
    }catch(e){
        window.__jsErrors.push('teste: '+e);
    }
    if(window.__flushJsErrors)window.__flushJsErrors();
});
</script>
"@

$html = $html -replace '</body>', "$inject`n</body>"

# Salva página de teste
$path = Join-Path $root '_test_battle_visual.html'
Set-Content $path $html -Encoding UTF8

# Tira screenshot (desktop)
$url = "file:///" + ($path -replace '\\', '/')
$img = Join-Path $artDir 'battle_visual.png'
& $chrome --headless --disable-gpu --no-sandbox --screenshot="$img" --window-size=1280,800 --virtual-time-budget=8000 $url 2>$null | Out-Null

# Tira screenshot (mobile) para validar o layout compacto
$imgMobile = Join-Path $artDir 'battle_visual_mobile.png'
& $chrome --headless --disable-gpu --no-sandbox --screenshot="$imgMobile" --window-size=400,800 --virtual-time-budget=8000 $url 2>$null | Out-Null

# Valida erros de JS via dump-dom
$dom = & $chrome --headless --disable-gpu --no-sandbox --virtual-time-budget=8000 --dump-dom $url 2>$null | Out-String
if ($dom -match 'data-js-errors="([^"]*)"') {
    Write-Output "Erros de JS: $($Matches[1])"
} else {
    Write-Output "Armadilha de erros ausente"
}

Write-Output "Screenshot salvo em: $img"
Write-Output "Screenshot salvo em: $imgMobile"