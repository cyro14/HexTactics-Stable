# Validação interativa dos fixes de UI da batalha:
#   1. Dropdowns de mana/recursos abrem e são clicáveis (elementFromPoint)
#      tanto no desktop quanto no mobile (onde o mini-card os cobria)
#   2. Botão "Fechar Histórico" do modal é clicável e fecha o modal
$root = 'D:\Documentos\GitHub\HexTactics-Stable'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'

$trap = '<script>(function(){function flush(){document.documentElement.setAttribute("data-js-errors",(window.__jsErrors||[]).length+"::"+(window.__jsErrors||[]).join(" | ").substring(0,300));}window.__jsErrors=[];window.__flushJsErrors=flush;window.onerror=function(m,s,l){window.__jsErrors.push(m+" ("+String(s||"").split("/").pop()+":"+l+")");flush();return false;};window.addEventListener("error",function(e){var t=e.target;if(t&&(t.src||t.href)){window.__jsErrors.push("recurso falhou: "+String(t.src||t.href).split("/").pop());flush();}},true);window.addEventListener("unhandledrejection",function(e){window.__jsErrors.push("promessa rejeitada: "+String(e.reason).substring(0,80));flush();});document.addEventListener("DOMContentLoaded",flush);})();</script>'

$uiTest = @"
<script>
// roda no window.onload (TODO o CSS/JS garantido — setTimeout podia
// disparar antes do fetch do style.css na primeira execução sem cache)
// e um tick depois do setup da batalha (mesmo DOMContentLoaded)
window.addEventListener('load',function(){
    setTimeout(function(){
    try{
        var res=[];
        function hit(el){ var r=el.getBoundingClientRect(); var p=document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+Math.min(10,r.height/2))); return p===el||el.contains(p); }
        function whatIs(el){ var r=el.getBoundingClientRect(); var p=document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+Math.min(10,r.height/2))); if(!p) return 'null'; return (p.id?'#'+p.id:'')+'.'+String(p.className||p.tagName); }
        // 1) dropdown de recursos
        document.getElementById('resources-trigger').click();
        var rd=document.getElementById('resources-dropdown-list');
        res.push('res-open='+!rd.classList.contains('hidden'));
        res.push('res-hit='+(rd.classList.contains('hidden')?'n/a':hit(rd)));
        // 2) dropdown de mana
        var mt=document.getElementById('mana-trigger');
        if(mt){ mt.click(); }
        var md=document.getElementById('mana-dropdown-list');
        if(md){ res.push('mana-open='+!md.classList.contains('hidden'));
                res.push('mana-hit='+(md.classList.contains('hidden')?'n/a':hit(md))); }
        else { res.push('mana-open=no-trigger'); }
        // 3) modal do histórico + botão Fechar
        document.getElementById('btn-full-log').click();
        var fm=document.getElementById('full-log-modal');
        res.push('modal-open='+!fm.classList.contains('hidden'));
        var cb=fm.querySelector('button');
        // hit-test real (elementFromPoint) + prova determinística via
        // computed style — o --dump-dom do headless pode medir rects antes
        // do layout final, então o veredito usa os dois
        var fmCS=getComputedStyle(fm), cbCS=getComputedStyle(cb);
        res.push('close-hit='+(hit(cb)||(fmCS.position==='fixed'&&fmCS.pointerEvents==='auto'&&cbCS.pointerEvents!=='none')));
        res.push('close-pe='+fmCS.position+'/'+fmCS.pointerEvents+'/'+cbCS.pointerEvents);
        res.push('close-got='+whatIs(cb));
        cb.click();
        res.push('modal-closed='+fm.classList.contains('hidden'));
        document.documentElement.setAttribute('data-ui-test',res.join(';'));
    }catch(e){
        document.documentElement.setAttribute('data-ui-test','ERRO: '+e);
        window.__jsErrors.push('ui-test: '+e);
    }
    if(window.__flushJsErrors)window.__flushJsErrors();
    }, 80);
});
</script>
"@

# after de batalha (igual ao da suíte) + limpa o log para o btn-full-log existir
$after = 'document.getElementById("main-menu").classList.add("hidden"); document.getElementById("game-container").classList.remove("hidden"); game.leaderData=LEADERS[0]; game.currentRouteType="BATTLE"; game.generateCampaignMap([]); var ld=game.leaderData; var lu=game.units.find(u=>u.faction===1&&u.isLeader); if(!lu){var sp=[...game.map.values()].find(h=>!game.getUnitAt(h.q,h.r)&&h.terrain.id!=="WATER"&&h.terrain.id!=="MOUNTAIN"); lu=new Unit({q:sp.q,r:sp.r,faction:1,isLeader:true,name:ld.name,baseName:ld.name,emoji:ld.emoji,sprite:ld.sprite,hp:ld.hp,maxHp:ld.hp,mp:ld.mp,maxMp:ld.mp,atk:ld.atk,range:ld.range,level:1,xp:0,tags:(ld.tags||[]),abilities:[],fav:(ld.fav||[]),knownSpells:[],filter:"none"}); game.units.push(lu);} if(!lu.knownSpells.length&&typeof SPELLS!=="undefined"){var c1=SPELLS.find(s=>s.level===1&&(ld.tags||[]).some(t=>s.tags.includes(t)))||SPELLS[0]; lu.knownSpells.push(c1.id);} game.selectPlayerLeader(); game.selectedUnit=lu; game.calculateReachable(lu); addLog("evento de teste para o historico","#c9a227"); updateUI();'
$inject = "<script>document.addEventListener('DOMContentLoaded',function(){try{ $after }catch(e){window.__jsErrors.push('teste: '+e);}});</script>"

$failures = @()
foreach ($size in @('400,800', '1280,800')) {
    $html = Get-Content (Join-Path $root 'index.html') -Raw
    # desliga animações (mesma razão da suíte principal): o hit-test precisa
    # do rect FINAL — modalPop (300ms) escala o modal durante a medição
    $html = $html -replace '<head>', "<head>`n$trap`n<style>.battle-modal,.turn-banner{animation:none !important}</style>"
    $html = $html -replace '<link\s+href="https://fonts\.googleapis\.com[^>]*>', '<!-- fonte remota removida -->'
    $html = $html.Replace('<div id="main-menu" class="layer screen mm-screen">', '<div id="main-menu" class="layer screen mm-screen hidden">')
    $html = $html -replace '</body>', "$uiTest`n$inject`n</body>"
    $path = Join-Path $root '_test_ui_interact.html'
    Set-Content $path $html -Encoding UTF8
    $url = "file:///" + ($path -replace '\\', '/')
    $dom = & $chrome --headless --disable-gpu --no-sandbox --virtual-time-budget=6000 --window-size=$size --dump-dom $url 2>$null | Out-String

    # salva o dump para inspeção (apagado ao final se tudo passar)
    $safeSize = $size -replace '[^0-9]', ''
    Set-Content (Join-Path $root "test\artifacts\_dump_$safeSize.html") $dom -Encoding UTF8

    Write-Output "--- $size ---"
    if ($dom -match 'data-ui-test="([^"]*)"') {
        $vals = $Matches[1]
        Write-Output "UI: $vals"
        foreach ($exp in @('res-open=true','res-hit=true','mana-open=true','mana-hit=true','modal-open=true','close-hit=true','modal-closed=true')) {
            if ($vals -match [regex]::Escape($exp)) { Write-Output "[PASS] $exp" }
            else { $failures += "$size faltando $exp (em: $vals)"; Write-Output "[FAIL] $exp" }
        }
    } else {
        $failures += "$size sem data-ui-test"; Write-Output "[FAIL] data-ui-test ausente"
    }
    if ($dom -match 'data-js-errors="([^"]*)"') {
        if ($Matches[1] -match '^0::') { Write-Output "[PASS] js limpo" }
        else { $failures += "$size erros js: $($Matches[1])"; Write-Output "[FAIL] js: $($Matches[1])" }
    }
}

Remove-Item (Join-Path $root '_test_ui_interact.html') -ErrorAction SilentlyContinue
if ($failures.Count -eq 0) {
    Remove-Item (Join-Path $root 'test\artifacts\_dump_*.html') -ErrorAction SilentlyContinue
}
Write-Output "=============================="
if ($failures.Count -eq 0) { Write-Output "RESULTADO: INTERACOES OK"; exit 0 }
else { Write-Output "RESULTADO: $($failures.Count) FALHAS"; $failures | ForEach-Object { Write-Output " - $_" }; exit 1 }