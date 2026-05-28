// ==========================================
// INICIALIZAÇÃO E EVENTOS DE INPUT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    loadMeta();
    game = new Game();
    renderer = new Renderer($('gameCanvas'), game);
    let isDragging = false, startX, startY, initOffX, initOffY;
    let initialPinchDist = null, initialHexSize = null;
    let lastForecastTarget = null;
    let lastForecastAttacker = null;
    window.pendingAttackTarget = null; // Guarda o alvo do primeiro clique

    function handleCombatForecast(clientX, clientY, isTouch = false, isPinned = false) {
        const fc = $('combat-forecast');
        if (!fc) return;
        // Se já tem um alvo travado pelo clique e essa chamada foi apenas um hover/mouse, ignora.
        if (window.pendingAttackTarget && !isPinned) return;

        if (!game || !game.selectedUnit || game.selectedUnit.faction !== 1 || game.isAnimating || isDragging) {
            fc.style.display = 'none'; lastForecastTarget = null; window.pendingAttackTarget = null; return;
        }

        const rect = $('gameCanvas').getBoundingClientRect();
        let x = clientX - rect.left, y = clientY - rect.top;

        let hoveredHex = null, mD = 999;
        game.map.forEach(h => {
            const p = renderer.getPos(h.q, h.r);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < mD && d < renderer.hexSize) { mD = d; hoveredHex = h; }
        });

        if (hoveredHex) {
            let target = game.getUnitAt(hoveredHex.q, hoveredHex.r);
            let dist = Hex.distance(game.selectedUnit, hoveredHex);

            if (target && target.faction !== 1 && dist <= game.selectedUnit.getEffectiveRange(game) && !game.selectedUnit.hasAttacked) {

                // --- PREVISÃO DE CAPTURA (DOMA) ---
                if (game.tameMode && target.faction === 0) {
                    // Consulta a matemática real e exata do motor do jogo
                    let chance = game.calculateTameChance(game.selectedUnit, target) * 100;

                    fc.innerHTML = `
                        <div class="forecast-side" style="width:140px">
                            <span class="forecast-emoji">${target.emoji}</span>
                            <span class="forecast-stat">Chance de Captura</span>
                            <span class="forecast-dmg" style="color:#1abc9c">${Math.min(100, Math.floor(chance))}%</span>
                        </div>
                    `;
                    fc.style.display = 'flex';
                }
                // --- PREVISÃO DE COMBATE ---
                else {
                    if (target !== lastForecastTarget || game.selectedUnit !== lastForecastAttacker) {
                        let dmgDealt = game.calcDmg(game.selectedUnit, target);
                        let dmgTaken = 0;
                        if (target.getEffectiveRange(game) >= dist) {
                            dmgTaken = Math.floor(game.calcDmg(target, game.selectedUnit) * 0.6);
                            if (target.abilities.includes('counter')) dmgTaken = Math.floor(dmgTaken * 1.2);
                        }
                        let dodgeC = target.abilities.includes('dodge') ? 30 : 0;
                        if (target.abilities.includes('flying')) dodgeC += 25;

                        fc.innerHTML = `
                            <div class="forecast-side">
                                <span class="forecast-emoji" style="filter:${game.selectedUnit.filter}">${game.selectedUnit.emoji}</span>
                                <span class="forecast-stat">HP: ${game.selectedUnit.hp}</span>
                                <span class="forecast-dmg">⚔️ ${dmgDealt}</span>
                            </div>
                            <div class="forecast-vs">VS</div>
                            <div class="forecast-side">
                                <span class="forecast-emoji" style="filter:${target.filter}">${target.emoji}</span>
                                <span class="forecast-stat">HP: ${target.hp}</span>
                                <span class="forecast-dmg" style="color:#f39c12">🛡️ ${dmgTaken}</span>
                                <span class="forecast-stat" style="color:#00ffff; margin-top:3px;">Esq: ${dodgeC}%</span>
                            </div>
                        `;
                        lastForecastTarget = target;
                        lastForecastAttacker = game.selectedUnit;
                    }
                }

                fc.style.display = 'flex';
                let yOffset = isTouch ? 200 : -20;
                let xOffset = isTouch ? 80 : -20;
                fc.style.left = (clientX - xOffset) + 'px';
                fc.style.top = (clientY - yOffset) + 'px';
            }
        } else {
            if (!window.pendingAttackTarget) { fc.style.display = 'none'; lastForecastTarget = null; }
        }
    }

    window.useFieldItem = function (type) {
        if (game.fieldItems[type] <= 0) return;

        // Trava o modo item
        game.activeItem = type;
        game.activeSpell = null;

        // Define o alcance baseado no item
        const ranges = { isca: 2, rede: 3, potion: 2, bandage: 2, scroll: 4, sphere: 3 };
        game.itemRange = ranges[type];

        // SELECIONA O LÍDER AUTOMATICAMENTE
        const leader = game.units.find(u => u.isLeader && u.faction === 1);
        if (leader) {
            game.selectedUnit = leader;
            game.calculateReachable(leader);
        }
        const menu = $('field-item-menu');
        showMessage(`Selecione o alvo para: ${type.toUpperCase()}`, "#3498db");
        updateUI();
        renderer.draw();
    };

    // EVENTOS DE MOUSE (PC)
    $('gameCanvas').addEventListener('mousedown', e => {
        if (game.currentTurn !== FACTIONS.PLAYER.id || game.gameOver || game.isAnimating) return;
        isDragging = false; startX = e.clientX; startY = e.clientY;
        initOffX = renderer.offsetX; initOffY = renderer.offsetY;
    });

    window.addEventListener('mousemove', e => {
        if (startX !== undefined) {
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) isDragging = true;
            if (isDragging) { renderer.offsetX = initOffX + dx; renderer.offsetY = initOffY + dy; renderer.draw(); }
            if (!window.pendingAttackTarget) $('combat-forecast').style.display = 'none';
            return;
        }
        handleCombatForecast(e.clientX, e.clientY, false, false);
    });

    window.addEventListener('mouseup', e => {
        if (startX === undefined) return;
        let wasDragging = isDragging;
        isDragging = false; startX = undefined;
        if (wasDragging) return;
        processHexClick(e.clientX, e.clientY);
    });

    $('gameCanvas').addEventListener('wheel', e => {
        if (game.currentTurn !== FACTIONS.PLAYER.id || game.gameOver || game.isAnimating) return;
        e.preventDefault();
        renderer.hexSize = Math.max(20, Math.min(renderer.hexSize + (e.deltaY > 0 ? -5 : 5), 120));
        renderer.draw();
    }, { passive: false });

    // EVENTOS DE TOQUE (MOBILE)
    $('gameCanvas').addEventListener('touchstart', e => {
        if (game.currentTurn !== FACTIONS.PLAYER.id || game.gameOver || game.isAnimating) return;
        if (e.touches.length === 2) {
            initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            initialHexSize = renderer.hexSize;
        } else if (e.touches.length === 1) {
            isDragging = false; startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            initOffX = renderer.offsetX; initOffY = renderer.offsetY;
        }
    }, { passive: false });

    $('gameCanvas').addEventListener('touchmove', e => {
        if (e.touches.length === 2 && initialPinchDist) {
            e.preventDefault();
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            renderer.hexSize = Math.max(20, Math.min(initialHexSize * (dist / initialPinchDist), 120));
            renderer.draw();
        } else if (e.touches.length === 1 && startX !== undefined) {
            const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
            if (Math.abs(dx) > 15 || Math.abs(dy) > 15) isDragging = true;
            if (isDragging) {
                e.preventDefault();
                renderer.offsetX = initOffX + dx; renderer.offsetY = initOffY + dy; renderer.draw();
                if (!window.pendingAttackTarget) $('combat-forecast').style.display = 'none';
            }
        }
        // Removemos o gatilho de hover no Touchmove para o celular ficar livre de bugs
    }, { passive: false });

    $('gameCanvas').addEventListener('touchend', e => {
        if (e.touches.length === 0) initialPinchDist = null;

        if (startX === undefined) return;
        let wasDragging = isDragging;
        isDragging = false; startX = undefined;

        if (!wasDragging && e.changedTouches.length === 1) {
            e.preventDefault();
            processHexClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY, true);
        }
    });

    async function processHexClick(clientX, clientY, isTouch = false) {
        if (game.isAnimating) return;
        const rect = $('gameCanvas').getBoundingClientRect();
        let x = clientX - rect.left, y = clientY - rect.top;

        let cH = null, mD = 999;

        // 1. PRIMEIRO o jogo calcula onde você clicou
        game.map.forEach(h => {
            const p = renderer.getPos(h.q, h.r);
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < mD && d < renderer.hexSize) { mD = d; cH = h; }
        });

        // 2. SE clicou fora do mapa (no escuro), cancela tudo (Magias, Itens, Seleções)
        if (!cH) {
            game.selectedHex = null;
            game.selectedUnit = null;
            game.activeSpell = null;
            game.activeItem = null;
            updateUI(); renderer.draw();
            return;
        }

        // 3. SE clicou em um hexágono válido, continua o jogo normalmente
        game.selectedHex = cH;
        const u = game.getUnitAt(cH.q, cH.r);
        const su = game.selectedUnit;

        if (cH) {
            game.selectedHex = cH;
            const u = game.getUnitAt(cH.q, cH.r);
            const su = game.selectedUnit;

            // --- USO DE ITENS DE CAMPO EXPANDIDO ---
            if (game.activeItem && su && su.isLeader && game.currentTurn === FACTIONS.PLAYER.id) {
                let dist = Hex.distance(su, cH);
                let itemUsed = false;

                if (game.activeItem === 'isca') {
                    if (u) { showMessage("Selecione um chão vazio!", "#e74c3c"); return; }
                    if (dist > 2) { showMessage("Muito longe para jogar a isca!", "#e74c3c"); return; }
                    cH.hasLure = true;
                    game.fieldItems.isca--;
                    showMessage("Isca posicionada!", "#e67e22");
                    itemUsed = true;

                } else if (game.activeItem === 'rede') {
                    if (!u || u.faction === FACTIONS.PLAYER.id) { showMessage("Selecione uma fera inimiga!", "#e74c3c"); return; }
                    if (dist > 3) { showMessage("Fora do alcance da rede!", "#e74c3c"); return; }
                    u.status = 'bind';
                    game.fieldItems.rede--;
                    if (typeof showPopup === 'function') showPopup("Preso na Rede!", u, '#9b59b6');
                    itemUsed = true;

                } else if (game.activeItem === 'potion') {
                    if (!u || u.faction !== FACTIONS.PLAYER.id) { showMessage("Selecione uma unidade aliada!", "#e74c3c"); return; }
                    if (dist > 2) { showMessage("Muito longe para usar a poção!", "#e74c3c"); return; }
                    u.hp = Math.min(u.maxHp, u.hp + 30); // Cura fixa de 30 HP
                    game.fieldItems.potion--;
                    if (typeof showPopup === 'function') showPopup("+30 HP 🧪", u, '#2ecc71');
                    itemUsed = true;

                } else if (game.activeItem === 'bandage') {
                    if (!u || u.faction !== FACTIONS.PLAYER.id) { showMessage("Selecione uma unidade aliada!", "#e74c3c"); return; }
                    if (dist > 2) { showMessage("Muito longe para usar a atadura!", "#e74c3c"); return; }
                    u.hp = Math.min(u.maxHp, u.hp + 15);
                    if (u.status === 'poison') u.status = null; // Remove veneno
                    game.fieldItems.bandage--;
                    if (typeof showPopup === 'function') showPopup("+15 HP 🩹", u, '#2ecc71');
                    itemUsed = true;

                } else if (game.activeItem === 'scroll') {
                    if (!u || u.faction === FACTIONS.PLAYER.id) { showMessage("Selecione um inimigo!", "#e74c3c"); return; }
                    if (dist > 4) { showMessage("Fora de alcance!", "#e74c3c"); return; }
                    u.hp -= 25; // Dano fixo puro mágico de 25
                    game.fieldItems.scroll--;
                    if (typeof showPopup === 'function') showPopup("-25 HP 📜", u, '#9b59b6');
                    if (u.hp <= 0) game.handleDeath(u, su);
                    itemUsed = true;

                } else if (game.activeItem === 'sphere') {
                    if (!u || u.faction === FACTIONS.PLAYER.id) { showMessage("Selecione um inimigo!", "#e74c3c"); return; }
                    if (dist > 3) { showMessage("Fora de alcance!", "#e74c3c"); return; }
                    // Sorteia um efeito negativo para debilitar o alvo
                    const statusPool = ['stun', 'bind', 'chilled', 'poison'];
                    u.status = statusPool[Math.floor(Math.random() * statusPool.length)];
                    game.fieldItems.sphere--;
                    if (typeof showPopup === 'function') showPopup("🔮 Caos Elemental!", u, '#00ffff');
                    itemUsed = true;
                }

                if (itemUsed) {
                    let usedType = game.activeItem; // Salva qual foi o item usado
                    game.activeItem = null;

                    // Rede e Isca agora são Ações Livres! Não gastam o ataque.
                    if (usedType !== 'rede' && usedType !== 'isca') {
                        su.hasAttacked = true;
                    } else {
                        if (typeof showMessage === 'function') showMessage("Ação Rápida (Turno não consumido)!", "#2ecc71");
                    }

                    if (typeof renderFieldItemMenu === 'function') renderFieldItemMenu(); // Atualiza a mochila na hora
                    updateUI(); renderer.draw();
                }
                return;
            }

            // Cancela a previsão pendente se clicou em outro lugar
            if (window.pendingAttackTarget && window.pendingAttackTarget !== u) {
                window.pendingAttackTarget = null;
                $('combat-forecast').style.display = 'none';
            }

            if (game.activeSpell && su && game.currentTurn === FACTIONS.PLAYER.id) {
                const spell = SPELLS.find(s => s.id === game.activeSpell);
                if (spell) {
                    let spRange = spell.range !== undefined ? spell.range : 99;
                    let dist = Hex.distance(su, cH);
                    let isGlobal = ['sl_regen', 'sl_shadow_step', 'sl_primal_rage', 'sl_sandstorm', 'sl_inferno', 'sl_blizzard', 'sl_mass_venom', 'sl_storm_wing', 'sl_meteor', 'sl_tidal_wave', 'sl_apocalypse', 'sl_world_freeze', 'sl_soul_harvest', 'sl_phoenix_rebirth'].includes(spell.id);

                    if (!isGlobal) {
                        if (spRange === 0 && u !== su) { showMessage("Clique no próprio Conjurador!", "#e74c3c"); return; }
                        if (spRange > 0 && spRange < 99 && dist > spRange) { showMessage("Fora de alcance!", "#e74c3c"); return; }

                        if (spell.type === 'atk' && spRange > 0) {
                            if (!u || u.faction === FACTIONS.PLAYER.id) { showMessage("Selecione um inimigo!", "#e74c3c"); return; }
                        } else if (spell.type === 'def' && spRange > 0) {
                            if (spell.tags.includes('MYSTIC') && spRange === 1) {
                                if (u) { showMessage("Selecione um espaço vazio!", "#e74c3c"); return; }
                                if (Hex.distance(su, cH) > 1) { showMessage("Muito longe!", "#e74c3c"); return; }
                            } else if (spell.id === 'sl_resurrection' || spell.id === 'sl_erguer_esq') {
                                if (u) { showMessage("Escolha um espaço vazio!", "#e74c3c"); return; }
                            }

                            else {
                                if (!u || u.faction !== FACTIONS.PLAYER.id) { showMessage("Selecione um aliado!", "#e74c3c"); return; }
                            }
                        }
                    }

                    if (game.spellCooldowns[spell.id] > 0) {
                        showMessage(`Em recarga (${game.spellCooldowns[spell.id]} turnos)`, '#f39c12');
                        game.activeSpell = null; renderSpellBar(); return;
                    }

                    let canCast = false;

                    // Lógica de Custo - Feras gastam 0!
                    if (!su.isLeader) {
                        canCast = true;
                    } else if (su.baseName === 'Rei Bárbaro') {
                        let totalMana = Object.values(spell.cost).reduce((a, b) => a + b, 0);
                        let hpCost = totalMana * 10;
                        if (su.hp > hpCost) { su.hp -= hpCost; if (typeof showPopup === 'function') showPopup(`-${hpCost} 🩸`, su, '#e74c3c'); canCast = true; }
                    } else { canCast = spendMana(spell.cost); }

                    if (canCast) {
                        game.isAnimating = true;
                        try {
                            const ok = await spell.effect(game, su, u, cH);
                            if (ok) {
                                // Aplica a exaustão da ação
                                if (su.isLeader) {
                                    su.spellsCast = (su.spellsCast || 0) + 1;
                                } else {
                                    su.hasAttacked = true; // Consome o turno da fera
                                    su.mp = 0;
                                }
                                game.spellCooldowns[spell.id] = spell.level > 1 ? spell.level : 0;
                                lastState = null; const undoBtn = $('btn-undo'); if (undoBtn) undoBtn.disabled = true;
                                await sleep(800);
                            } else {
                                if (su.isLeader && su.baseName !== 'Rei Bárbaro') {
                                    Object.entries(spell.cost).forEach(([tag, amt]) => { game.spentMana[tag] = (game.spentMana[tag] || 0) - amt; if (game.spentMana[tag] < 0) game.spentMana[tag] = 0; });
                                }
                            }
                        } catch (err) {
                            console.error("Erro na magia:", err);
                            if (su.isLeader && su.baseName !== 'Rei Bárbaro') {
                                Object.entries(spell.cost).forEach(([tag, amt]) => { game.spentMana[tag] = (game.spentMana[tag] || 0) - amt; if (game.spentMana[tag] < 0) game.spentMana[tag] = 0; });
                            }
                        }
                        game.isAnimating = false; game.activeSpell = null;
                        if (su && su.mp > 0) game.calculateReachable(su);
                        updateUI(); renderer.draw(); return;
                    }
                }
                game.activeSpell = null; renderSpellBar(); return;
            }

            if (su && su.faction === FACTIONS.PLAYER.id && su.status !== 'stun' && su.status !== 'bind') {
                const dist = u ? Hex.distance(su, u) : 0;

                if (u && u.faction !== FACTIONS.PLAYER.id && dist <= su.getEffectiveRange(game) && !su.hasAttacked) {

                    // --- SISTEMA DE DUPLO CLIQUE (SOMENTE MOBILE) ---
                    if (isTouch && window.pendingAttackTarget !== u) {
                        window.pendingAttackTarget = u;
                        handleCombatForecast(clientX, clientY, true, true);
                        if (typeof showMessage === 'function') showMessage("Toque novamente para Atacar!", "#f1c40f");
                        return;
                    }

                    // Segundo Clique: Executa o Combate!
                    window.pendingAttackTarget = null;
                    $('combat-forecast').style.display = 'none';

                    game.isAnimating = true;
                    if (game.tameMode && u.faction === FACTIONS.WILD.id && dist === 1) await game.attemptTame(su, u);
                    else if (!game.tameMode) await game.executeCombat(su, u);
                    game.selectedUnit = null; game.tameMode = false; game.isAnimating = false;

                } else if (!u && game.reachableHexes.has(cH.getKey())) {
                    window.pendingAttackTarget = null; $('combat-forecast').style.display = 'none';
                    saveSnapshot(); su.mp -= game.reachableHexes.get(cH.getKey()); game.isAnimating = true; await game.moveUnit(su, cH.q, cH.r); game.isAnimating = false; game.calculateReachable(su);
                } else {
                    game.selectedUnit = u; if (u) game.calculateReachable(u);
                }
            } else {
                game.selectedUnit = u; if (u && u.faction === FACTIONS.PLAYER.id) game.calculateReachable(u);
            }
        } else {
            game.selectedUnit = null; game.activeSpell = null;
            window.pendingAttackTarget = null; $('combat-forecast').style.display = 'none';
        }
        updateUI(); renderer.draw();
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

    $('unit-portrait').addEventListener('click', () => {
        if (game && game.selectedUnit) { let u = game.selectedUnit; let template = ALL_BEASTS.find(x => x.name === u.baseName || x.name === u.name); if (!template && u.isLeader) { template = LEADERS.find(x => x.name === u.name); if (!template) { template = { name: u.name, emoji: u.emoji, hp: u.maxHp, mp: u.maxMp, atk: u.atk, range: u.range, filter: u.filter, fav: u.fav, isBoss: true }; } } if (template) { showBeastDetails(template, true); } }
    });

    $('btn-undo').addEventListener('click', () => {
        if (!lastState || game.isAnimating || game.currentTurn !== FACTIONS.PLAYER.id) return;
        game.units = lastState.u.map(u => new Unit({ ...u, isNew: false })); game.items = new Map(lastState.i); game.gold = lastState.g; game.hasKey = lastState.hk; game.hasEgg = lastState.he; game.manaPool = JSON.parse(JSON.stringify(lastState.mana)); game.spentMana = {};
        lastState.m.forEach(([k, o]) => game.map.get(k).owner = o);
        lastState = null; $('btn-undo').disabled = true; game.selectedUnit = null; game.activeSpell = null; updateUI(); renderer.draw();
    });

    $('btn-next-unit').addEventListener('click', () => {
        if (game.isAnimating || game.currentTurn !== FACTIONS.PLAYER.id) return;
        const vU = game.units.filter(u => u.faction === FACTIONS.PLAYER.id && (u.mp > 0 || !u.hasAttacked) && u.status !== 'stun' && u.status !== 'bind');
        if (vU.length === 0) return;
        let idx = vU.indexOf(game.selectedUnit); let nU = vU[(idx + 1) % vU.length];
        game.selectedUnit = nU; game.calculateReachable(nU); renderer.centerOn(nU.vq, nU.vr); updateUI(); renderer.draw();
    });

    $('btn-end-turn').addEventListener('click', () => {
        if (!game.isAnimating) {
            if (typeof autoSave === 'function') autoSave();
            game.startNextTurn();
        }
    });

    $('btn-tame').addEventListener('click', () => { game.tameMode = !game.tameMode; updateUI(); renderer.draw(); });

    // Botões de Pausa e Popups
    $('btn-pause').addEventListener('click', () => { $('pause-menu').classList.remove('hidden'); });
    $('btn-resume').addEventListener('click', () => { $('pause-menu').classList.add('hidden'); });
    $('btn-close-details').addEventListener('click', () => { $('unit-details-modal').classList.add('hidden'); });
    $('btn-open-help').addEventListener('click', () => { $('help-screen').classList.remove('hidden'); });
    $('btn-help-pause').addEventListener('click', () => { $('pause-menu').classList.add('hidden'); $('help-screen').classList.remove('hidden'); });
    $('btn-close-help').addEventListener('click', () => { $('help-screen').classList.add('hidden'); if (!$('game-container').classList.contains('hidden')) $('pause-menu').classList.remove('hidden'); });

    $('btn-go-shop').addEventListener('click', openShop);
    $('btn-leave-shop').addEventListener('click', () => { openManagement(); });

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

    $('btn-quit').addEventListener('click', () => { location.reload(); });
    $('btn-menu-from-lose').addEventListener('click', () => { location.reload(); });
    $('btn-play').addEventListener('click', () => { $('main-menu').classList.add('hidden'); $('mode-screen').classList.remove('hidden'); });
    $('btn-close-mode').addEventListener('click', () => { $('mode-screen').classList.add('hidden'); $('main-menu').classList.remove('hidden'); });

    $('btn-campaign').addEventListener('click', () => { if (localStorage.getItem('ht_save_camp')) { if (!confirm("Existe um jogo salvo. Deseja iniciar uma nova campanha e perder o progresso?")) return; } openLeaderSelection(false); });
    $('btn-roguelite').addEventListener('click', () => { if (localStorage.getItem('ht_save_rogue')) { if (!confirm("Existe uma Run salva. Deseja iniciar uma nova e perder o progresso atual?")) return; } openLeaderSelection(true); });
    const btnDuel = $('btn-duel');
    if (btnDuel) {btnDuel.addEventListener('click', () => { if (localStorage.getItem('ht_save_duel')) { if (!confirm("Existe um duelo salvo. Deseja iniciar um novo e perder o progresso atual?")) return; } openLeaderSelection(true, false, true); });}

    const btnDuelHistory = 
    $('btn-duel-history'); if (btnDuelHistory) {btnDuelHistory.addEventListener('click', openDuelHistory);}
    $('btn-load-campaign')?.addEventListener('click', () => { startGame(true, false); });
    $('btn-load-roguelite')?.addEventListener('click', () => { startGame(true, true); });
    $('btn-load-duel')?.addEventListener('click', () => { startGame(true, false, true); });
    
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

    $('btn-retry').addEventListener('click', () => {
        if (game.isRoguelite) { if (confirm("Iniciar Nova Run? Seu Ouro e Exército serão perdidos!")) { localStorage.removeItem('ht_save_rogue'); openLeaderSelection(true); } }
        else { $('result-screen').classList.add('hidden'); $('game-container').classList.remove('hidden'); $('turn-blocker').style.display = 'none'; const r = deployedRoster.map(m => new Unit({ ...m, q: 0, r: 0, hasAttacked: false, status: null, isNew: false })); game.generateCampaignMap(r); renderer.initCamera(true); updateUI(); }
    });

    $('btn-save').addEventListener('click', () => {
        if (game.currentTurn !== FACTIONS.PLAYER.id || game.isAnimating) { showMessage("Salve no seu turno livre!", '#f39c12'); return; }
        autoSave(); $('pause-menu').classList.add('hidden'); loadMeta(); showMessage("Progresso Salvo!", '#c9a227'); setTimeout(() => location.reload(), 1500);
    });
  // --- BOTÕES FINAIS PROTEGIDOS COM OPTIONAL CHAINING (?.) ---
    $('btn-open-bestiary')?.addEventListener('click', openBestiary);
    $('btn-open-bestiary-pause')?.addEventListener('click', () => { $('pause-menu').classList.add('hidden'); openBestiary(); });
    $('btn-close-bestiary')?.addEventListener('click', () => { $('bestiary-screen').classList.add('hidden'); if (!$('game-container').classList.contains('hidden')) $('pause-menu').classList.remove('hidden'); else $('main-menu').classList.remove('hidden'); });
    $('btn-close-evo')?.addEventListener('click', () => $('evo-modal').classList.add('hidden'));
    $('btn-close-beast-details')?.addEventListener('click', () => { $('beast-details-modal').classList.add('hidden'); });
    $('btn-open-reliquary')?.addEventListener('click', () => openReliquary(false));
    $('btn-open-reliquary-pause')?.addEventListener('click', () => { $('pause-menu').classList.add('hidden'); openReliquary(true); });
    $('btn-close-reliquary')?.addEventListener('click', () => { $('reliquary-screen').classList.add('hidden'); if (!$('game-container').classList.contains('hidden')) $('pause-menu').classList.remove('hidden'); else $('main-menu').classList.remove('hidden'); });
    $('btn-toggle-reliquary')?.addEventListener('click', () => { reliquaryViewMode = reliquaryViewMode === 'camp' ? 'rogue' : 'camp'; openReliquary(false); });
    $('btn-refresh-shop')?.addEventListener('click', () => { if (game.gold >= 2) { game.gold -= 2; $('shop-gold-display').innerText = game.gold; generateShopItems(); renderShop(); } else { alert("Ouro insuficiente!"); } });
    $('btn-grimoire')?.addEventListener('click', () => { openGrimoire(); });
    $('btn-close-grimoire')?.addEventListener('click', () => { $('grimoire-screen').classList.add('hidden'); });
    $('btn-toggle-spells')?.addEventListener('click', () => {
        const bar = $('spell-bar');
        if (bar.classList.contains('hidden')) {
            bar.classList.remove('hidden');
            renderSpellBar(); 
        } else {
            bar.classList.add('hidden');
        }
    });
    $('btn-duel')?.addEventListener('click', () => { 
        if (confirm("Iniciar Modo Duelo (Fase de Compra + Arena Simétrica)?")) {
            openLeaderSelection(false, true); 
        }
    });
    $('btn-duel-history')?.addEventListener('click', openDuelHistory);
});