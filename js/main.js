// ==========================================
// INICIALIZAÇÃO E EVENTOS DE INPUT
// ==========================================
document.addEventListener("DOMContentLoaded",()=>{
    loadMeta();
    game=new Game();
    renderer=new Renderer($('gameCanvas'),game);
    let isDragging=false,startX,startY,initOffX,initOffY;

    $('gameCanvas').addEventListener('mousedown',e=>{if(game.currentTurn!==FACTIONS.PLAYER.id||game.gameOver||game.isAnimating)return;isDragging=false;startX=e.clientX;startY=e.clientY;initOffX=renderer.offsetX;initOffY=renderer.offsetY;});
    window.addEventListener('mousemove',e=>{if(startX===undefined)return;const dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)>10||Math.abs(dy)>10)isDragging=true;if(isDragging){renderer.offsetX=initOffX+dx;renderer.offsetY=initOffY+dy;renderer.draw();}});
    window.addEventListener('mouseup',e=>{if(startX===undefined)return;startX=undefined;if(isDragging)return;processHexClick(e.clientX,e.clientY);});
    $('gameCanvas').addEventListener('wheel',e=>{if(game.currentTurn!==FACTIONS.PLAYER.id||game.gameOver||game.isAnimating)return;e.preventDefault();renderer.hexSize=Math.max(20,Math.min(renderer.hexSize+(e.deltaY>0?-5:5),120));renderer.draw();},{passive:false});

    let initialPinchDist=null,initialHexSize=null;
    $('gameCanvas').addEventListener('touchstart',e=>{if(game.currentTurn!==FACTIONS.PLAYER.id||game.gameOver||game.isAnimating)return;if(e.touches.length===2){initialPinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);initialHexSize=renderer.hexSize;}else if(e.touches.length===1){isDragging=false;startX=e.touches[0].clientX;startY=e.touches[0].clientY;initOffX=renderer.offsetX;initOffY=renderer.offsetY;}},{passive:false});
    $('gameCanvas').addEventListener('touchmove',e=>{e.preventDefault();if(e.touches.length===2&&initialPinchDist){const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);renderer.hexSize=Math.max(20,Math.min(initialHexSize*(dist/initialPinchDist),120));renderer.draw();}else if(e.touches.length===1&&startX!==undefined){const dx=e.touches[0].clientX-startX,dy=e.touches[0].clientY-startY;if(Math.abs(dx)>15||Math.abs(dy)>15)isDragging=true;renderer.offsetX=initOffX+dx;renderer.offsetY=initOffY+dy;renderer.draw();}},{passive:false});
    $('gameCanvas').addEventListener('touchend',e=>{if(e.touches.length===0)initialPinchDist=null;if(startX===undefined)return;if(!isDragging&&e.changedTouches.length===1)processHexClick(e.changedTouches[0].clientX,e.changedTouches[0].clientY);startX=undefined;});

    async function processHexClick(x,y){
        if(game.isAnimating)return;
        const rect=$('gameCanvas').getBoundingClientRect();x-=rect.left;y-=rect.top;
        let cH=null,mD=999;game.map.forEach(h=>{const p=renderer.getPos(h.q,h.r);const d=Math.hypot(p.x-x,p.y-y);if(d<mD&&d<renderer.hexSize){mD=d;cH=h;}});

        if(cH){
            game.selectedHex=cH;const u=game.getUnitAt(cH.q,cH.r);const su=game.selectedUnit;
            
            if(game.activeSpell && su && su.isLeader && game.currentTurn === FACTIONS.PLAYER.id){
                const spell = SPELLS.find(s=>s.id===game.activeSpell);
                if(spell && canAffordSpell(spell, su)){
                    let spRange = spell.range !== undefined ? spell.range : 99;
                    let dist = Hex.distance(su, cH);
                    let isGlobal = ['sl_regen','sl_shadow_step','sl_primal_rage','sl_sandstorm','sl_inferno','sl_blizzard','sl_mass_venom','sl_storm_wing','sl_meteor','sl_tidal_wave','sl_apocalypse','sl_world_freeze','sl_soul_harvest','sl_phoenix_rebirth'].includes(spell.id);
                    
                    if (!isGlobal) {
                        if (spRange === 0 && u !== su) { showMessage("Clique no próprio Herói!", "#e74c3c"); return; }
                        if (spRange > 0 && spRange < 99 && dist > spRange) { showMessage("Fora de alcance!", "#e74c3c"); return; }

                        if (spell.type === 'atk' && spRange > 0) {
                            if (!u || u.faction === FACTIONS.PLAYER.id) { showMessage("Selecione um inimigo!", "#e74c3c"); return; }
                        } else if (spell.type === 'def' && spRange > 0) {
                            if (spell.id === 'sl_resurrection') {
                                if (u) { showMessage("Escolha um espaço vazio!", "#e74c3c"); return; }
                            } else {
                                if (!u || u.faction !== FACTIONS.PLAYER.id) { showMessage("Selecione um aliado!", "#e74c3c"); return; }
                            }
                        }
                    }

                    if(game.spellCooldowns[spell.id] > 0) {
                        showMessage(`Em recarga (${game.spellCooldowns[spell.id]} turnos)`, '#f39c12');
                        game.activeSpell=null; renderSpellBar(); return;
                    }
                    
                    if(spendMana(spell.cost)){
                        game.isAnimating = true; 
                        try {
                            const ok = await spell.effect(game, su, u, cH);
                            if(ok){
                                su.spellsCast = (su.spellsCast || 0) + 1;
                                game.spellCooldowns[spell.id] = spell.level > 1 ? spell.level : 0;
                                lastState=null; 
                                const undoBtn = $('btn-undo'); if(undoBtn) undoBtn.disabled=true;
                                await sleep(800); 
                            } else {
                                Object.entries(spell.cost).forEach(([tag,amt])=>{game.spentMana[tag]=(game.spentMana[tag]||0)-amt;if(game.spentMana[tag]<0)game.spentMana[tag]=0;});
                            }
                        } catch(err) {
                            console.error("Erro na magia:", err);
                            Object.entries(spell.cost).forEach(([tag,amt])=>{game.spentMana[tag]=(game.spentMana[tag]||0)-amt;if(game.spentMana[tag]<0)game.spentMana[tag]=0;});
                        }
                        
                        game.isAnimating = false; 
                        game.activeSpell=null; 
                        if (su && su.mp > 0) game.calculateReachable(su);
                        updateUI(); renderer.draw(); return;
                    }
                }
                game.activeSpell=null; renderSpellBar(); return;
                $('spell-bar').classList.add('hidden');
            }

            if(su&&su.faction===FACTIONS.PLAYER.id&&su.status!=='stun'&&su.status!=='bind'){
                const dist=u?Hex.distance(su,u):0;
                if(u&&u.faction!==FACTIONS.PLAYER.id&&dist<=su.getEffectiveRange(game)&&!su.hasAttacked){
                    game.isAnimating=true;
                    if(game.tameMode&&u.faction===FACTIONS.WILD.id&&dist===1)await game.attemptTame(su,u);
                    else if(!game.tameMode)await game.executeCombat(su,u);
                    game.selectedUnit=null;game.tameMode=false;game.isAnimating=false;
                } else if(!u&&game.reachableHexes.has(cH.getKey())){
                    saveSnapshot();su.mp-=game.reachableHexes.get(cH.getKey());game.isAnimating=true;await game.moveUnit(su,cH.q,cH.r);game.isAnimating=false;game.calculateReachable(su);
                } else{game.selectedUnit=u;if(u)game.calculateReachable(u);}
            } else{game.selectedUnit=u;if(u&&u.faction===FACTIONS.PLAYER.id)game.calculateReachable(u);}
        } else{game.selectedUnit=null;game.activeSpell=null;}
        updateUI();renderer.draw();
    }

    // === BOTÕES DA INTERFACE ===

    $('toggle-log-text').addEventListener('click', () => {
        const log = $('combat-log');
        const txt = $('toggle-log-text');
        
        if (log.classList.contains('hidden')) {
            log.classList.remove('hidden');
            txt.innerHTML = '▼ Ocultar Log';
        } else {
            log.classList.add('hidden');
            txt.innerHTML = '▲ Mostrar Log';
        }
    });
    
    $('unit-portrait').addEventListener('click',()=>{
        if(game&&game.selectedUnit){let u=game.selectedUnit;let template=ALL_BEASTS.find(x=>x.name===u.baseName||x.name===u.name);if(!template&&u.isLeader){template=LEADERS.find(x=>x.name===u.name);if(!template){template={name:u.name,emoji:u.emoji,hp:u.maxHp,mp:u.maxMp,atk:u.atk,range:u.range,filter:u.filter,fav:u.fav,isBoss:true};}}if(template){showBeastDetails(template,true);}}
    });

    $('btn-undo').addEventListener('click',()=>{
        if(!lastState||game.isAnimating||game.currentTurn!==FACTIONS.PLAYER.id)return;
        game.units=lastState.u.map(u=>new Unit({...u,isNew:false}));game.items=new Map(lastState.i);game.gold=lastState.g;game.hasKey=lastState.hk;game.hasEgg=lastState.he;game.manaPool=JSON.parse(JSON.stringify(lastState.mana));game.spentMana={};
        lastState.m.forEach(([k,o])=>game.map.get(k).owner=o);
        lastState=null;$('btn-undo').disabled=true;game.selectedUnit=null;game.activeSpell=null;updateUI();renderer.draw();
    });

    $('btn-next-unit').addEventListener('click',()=>{
        if(game.isAnimating||game.currentTurn!==FACTIONS.PLAYER.id)return;
        const vU=game.units.filter(u=>u.faction===FACTIONS.PLAYER.id&&(u.mp>0||!u.hasAttacked)&&u.status!=='stun'&&u.status!=='bind');
        if(vU.length===0)return;
        let idx=vU.indexOf(game.selectedUnit);let nU=vU[(idx+1)%vU.length];
        game.selectedUnit=nU;game.calculateReachable(nU);renderer.centerOn(nU.vq,nU.vr);updateUI();renderer.draw();
    });

    $('btn-end-turn').addEventListener('click',()=>{if(!game.isAnimating)game.startNextTurn();});
    $('btn-tame').addEventListener('click',()=>{game.tameMode=!game.tameMode;updateUI();renderer.draw();});
    
    // Botões de Pausa e Popups
    $('btn-pause').addEventListener('click',()=>{$('pause-menu').classList.remove('hidden');});
    $('btn-resume').addEventListener('click',()=>{$('pause-menu').classList.add('hidden');});
    $('btn-close-details').addEventListener('click',()=>{$('unit-details-modal').classList.add('hidden');});
    $('btn-open-help').addEventListener('click',()=>{$('help-screen').classList.remove('hidden');});
    $('btn-help-pause').addEventListener('click',()=>{$('pause-menu').classList.add('hidden');$('help-screen').classList.remove('hidden');});
    $('btn-close-help').addEventListener('click',()=>{$('help-screen').classList.add('hidden');if(!$('game-container').classList.contains('hidden'))$('pause-menu').classList.remove('hidden');});
    
    $('btn-go-shop').addEventListener('click',openShop);
    $('btn-leave-shop').addEventListener('click',()=>{openManagement();});

   // === CÓDIGO SEGURO DOS BOTÕES DO GERENCIAMENTO E PAUSA ===
    const btnStart = $('btn-start-stage');
    if (btnStart) {
        btnStart.onclick = () => { advanceCampaign(); };
    }

    if ($('btn-team-pause')) {
        $('btn-team-pause').addEventListener('click', openTeamView);
    }
    
    // -->OUVINTE DO BOTÃO NA TELA:
    if ($('btn-ingame-team')) {
        $('btn-ingame-team').addEventListener('click', openTeamView);
    }

    if ($('btn-close-team')) {
        $('btn-close-team').addEventListener('click', () => { 
            hide('management-screen'); 
            $('pause-menu').classList.remove('hidden'); 
        });
    }
    
    // Botão de verificar exército de dentro do Mapa de Rotas
    if ($('btn-map-manage')) {
        $('btn-map-manage').addEventListener('click', () => { 
            hide('route-map-screen'); 
            openManagement(); 
            // Modifica o botão Avançar Combate temporariamente para voltar ao Mapa
            const b = $('btn-start-stage');
            b.innerText = "← Voltar ao Mapa";
            b.onclick = () => {
                b.innerText = "Avançar Combate →";
                b.onclick = () => { advanceCampaign(); }; // Retorna ao original
                hide('management-screen');
                show('route-map-screen');
            };
        });
    }

    $('btn-quit').addEventListener('click',()=>{location.reload();});
    $('btn-menu-from-lose').addEventListener('click',()=>{location.reload();});
    $('btn-play').addEventListener('click',()=>{$('main-menu').classList.add('hidden');$('mode-screen').classList.remove('hidden');});
    $('btn-close-mode').addEventListener('click',()=>{$('mode-screen').classList.add('hidden');$('main-menu').classList.remove('hidden');});

    $('btn-campaign').addEventListener('click',()=>{if(localStorage.getItem('ht_save_camp')){if(!confirm("Existe um jogo salvo. Deseja iniciar uma nova campanha e perder o progresso?"))return;}openLeaderSelection(false);});
    $('btn-roguelite').addEventListener('click',()=>{if(localStorage.getItem('ht_save_rogue')){if(!confirm("Existe uma Run salva. Deseja iniciar uma nova e perder o progresso atual?"))return;}openLeaderSelection(true);});
    $('btn-load-campaign').addEventListener('click',()=>{startGame(true,false);});
    $('btn-load-roguelite').addEventListener('click',()=>{startGame(true,true);});

    $('btn-toggle-build').addEventListener('click', () => {
        const menu = $('building-menu');
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            renderBuildingMenu();
        } else {
            menu.classList.add('hidden');
        }
    });

    $('btn-leave-kingdom').addEventListener('click', () => {
        hide('kingdom-screen');
        renderRouteMap(); // Sai do reino e volta para escolher a próxima rota
    });
    
    $('btn-retry').addEventListener('click',()=>{
        if(game.isRoguelite){if(confirm("Iniciar Nova Run? Seu Ouro e Exército serão perdidos!")){localStorage.removeItem('ht_save_rogue');openLeaderSelection(true);}}
        else{$('result-screen').classList.add('hidden');$('game-container').classList.remove('hidden');$('turn-blocker').style.display='none';const r=deployedRoster.map(m=>new Unit({...m,q:0,r:0,hasAttacked:false,status:null,isNew:false}));game.generateCampaignMap(r);renderer.initCamera(true);updateUI();}
    });

    $('btn-save').addEventListener('click',()=>{
        if(game.currentTurn!==FACTIONS.PLAYER.id||game.isAnimating){showMessage("Salve no seu turno livre!",'#f39c12');return;}
        autoSave();$('pause-menu').classList.add('hidden');loadMeta();showMessage("Progresso Salvo!",'#c9a227');setTimeout(()=>location.reload(),1500);
    });

    $('btn-open-bestiary').addEventListener('click',openBestiary);
    $('btn-open-bestiary-pause').addEventListener('click',()=>{$('pause-menu').classList.add('hidden');openBestiary();});
    $('btn-close-bestiary').addEventListener('click',()=>{$('bestiary-screen').classList.add('hidden');if(!$('game-container').classList.contains('hidden'))$('pause-menu').classList.remove('hidden');else $('main-menu').classList.remove('hidden');});
    $('btn-close-evo').addEventListener('click',()=>$('evo-modal').classList.add('hidden'));
    $('btn-close-beast-details').addEventListener('click',()=>{$('beast-details-modal').classList.add('hidden');});

    $('btn-open-reliquary').addEventListener('click',()=>openReliquary(false));
    $('btn-open-reliquary-pause').addEventListener('click',()=>{$('pause-menu').classList.add('hidden');openReliquary(true);});
    $('btn-close-reliquary').addEventListener('click',()=>{$('reliquary-screen').classList.add('hidden');if(!$('game-container').classList.contains('hidden'))$('pause-menu').classList.remove('hidden');else $('main-menu').classList.remove('hidden');});
    $('btn-toggle-reliquary').addEventListener('click',()=>{reliquaryViewMode=reliquaryViewMode==='camp'?'rogue':'camp';openReliquary(false);});

    $('btn-refresh-shop').addEventListener('click',()=>{if(game.gold>=2){game.gold-=2;$('shop-gold-display').innerText=game.gold;generateShopItems();renderShop();}else{alert("Ouro insuficiente!");}});

    $('btn-grimoire').addEventListener('click',()=>{openGrimoire();});
    $('btn-close-grimoire').addEventListener('click',()=>{$('grimoire-screen').classList.add('hidden');});

    // Alternar visualização do menu de magias em combate (Estilo Reino)
    $('btn-toggle-spells').addEventListener('click', () => {
        const bar = $('spell-bar');
        if (bar.classList.contains('hidden')) {
            bar.classList.remove('hidden');
            renderSpellBar(); // Renderiza as magias disponíveis atualizadas
        } else {
            bar.classList.add('hidden');
        }
    });
});
