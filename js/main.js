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

    // ==========================================
    // BOTÃO DE LIMPEZA DE CACHE (GITHUB PAGES)
    // ==========================================
    const menuContainer = document.querySelector('#main-menu .menu-box');
    if (menuContainer) {
        const updateBtn = document.createElement('button');
        updateBtn.innerHTML = "🔄 Verificar Atualizações (Limpar Cache)";
        updateBtn.style.cssText = "background: rgba(0,0,0,0.5); border: 1px solid #7f8c8d; color: #bdc3c7; margin-top: 20px; font-size: 14px; transition: all 0.2s;";
        updateBtn.onmouseover = () => updateBtn.style.borderColor = '#bdc3c7';
        updateBtn.onmouseout = () => updateBtn.style.borderColor = '#7f8c8d';

        updateBtn.onclick = async () => {
            updateBtn.innerText = "Limpando...";
            // Limpa o Cache Storage (Service Workers/PWA)
            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                } catch (e) { console.error("Erro ao limpar cache:", e); }
            }
            // Limpa o LocalStorage de saves se quiser garantir (opcional, comente se não quiser)
            // localStorage.removeItem('ht_save_camp'); localStorage.removeItem('ht_save_rogue'); localStorage.removeItem('ht_save_duel');

            // Força o recarregamento com uma querystring nova para quebrar o cache de memória do navegador
            window.location.href = window.location.pathname + '?v=' + new Date().getTime();
        };
        menuContainer.appendChild(updateBtn);
    }

    // ==========================================
    // SISTEMA AVANÇADO DE ELEMENTOS E FURTIVIDADE
    // ==========================================

    if (typeof TERRAINS !== 'undefined') {
        if (TERRAINS.WATER) TERRAINS.ELECTRIC_WATER = { ...TERRAINS.WATER, id: 'ELECTRIC_WATER', name: 'Água Eletrizada' };
        if (TERRAINS.FOREST) TERRAINS.BURNING_FOREST = { ...TERRAINS.FOREST, id: 'BURNING_FOREST', name: 'Floresta em Chamas', col: '#d35400' };
        let baseLand = TERRAINS.LAND || TERRAINS.PLAINS || Object.values(TERRAINS)[0];
        if (!TERRAINS.ASHES) TERRAINS.ASHES = { ...baseLand, id: 'ASHES', name: 'Cinzas', col: '#555555' };
    }

    // 1. Ocultar unidades do Clique do Jogador
    const originalGetUnitAt = Game.prototype.getUnitAt;
    Game.prototype.getUnitAt = function (q, r) {
        let u = originalGetUnitAt.call(this, q, r);
        if (u && u.isHidden && u.faction !== 1) return null;
        return u;
    };

    // 2. MÁGICA DO PATHFINDER: Remove fisicamente as unidades do array por 1 milissegundo!
    const originalCalcReachable = Game.prototype.calculateReachable;
    Game.prototype.calculateReachable = function (unit) {
        let allUnitsBackup = [...this.units]; // Salva todas as unidades originais
        // Filtra as ocultas para fora da existência!
        this.units = this.units.filter(u => !(u.isHidden && u.faction !== 1));

        originalCalcReachable.call(this, unit); // O motor calcula a rota no mapa vazio

        this.units = allUnitsBackup; // Traz as tropas de volta da dimensão fantasma!
    };

    // 3. Bônus de Dano da Marca do Caçador
    const originalCalcDmg = Game.prototype.calcDmg;
    Game.prototype.calcDmg = function (attacker, defender) {
        let dmg = originalCalcDmg.call(this, attacker, defender);
        if (defender.status === 'marked' && attacker.tags && attacker.tags.includes('STALKER')) dmg = Math.floor(dmg * 2);
        return dmg;
    };

    // 4. Virada de Turno: Camuflagem Passiva e Espalhamento de Fogo
    const originalStartNextTurn = Game.prototype.startNextTurn;
    Game.prototype.startNextTurn = function () {
        let restedUnits = this.units.filter(u => u.mp === u.maxMp);
        originalStartNextTurn.call(this);

        this.units.forEach(u => {
            if (u.hp <= 0 || !u.abilities) return;
            let hex = this.map.get(`${u.q},${u.r}`);
            if (!hex) return;

            let isDive = u.abilities.includes('dive') && hex.terrain.id === 'WATER';
            let isCamo = u.abilities.includes('camouflage') && hex.terrain.id === 'FOREST';

            let enemiesAdj = false;
            Hex.getNeighbors(u.q, u.r).forEach(n => {
                let tU = this.units.find(x => x.q === n.q && x.r === n.r && x.hp > 0 && !x.isHidden);
                if (tU && tU.faction !== u.faction) enemiesAdj = true;
            });

            if (!enemiesAdj) {
                if (isDive || (isCamo && restedUnits.includes(u))) {
                    u.isHidden = true;
                    if (u.faction === 1) u.filter = 'opacity(0.5) sepia(100%)';
                }
            } else if (u.status !== 'digging') {
                u.isHidden = false; u.filter = 'none';
            }
        });

        let newFires = [];
        this.map.forEach(h => {
            if (h.terrain && h.terrain.id === 'BURNING_FOREST') {
                Hex.getNeighbors(h.q, h.r).forEach(n => {
                    let nH = this.map.get(`${n.q},${n.r}`);
                    if (nH && nH.terrain && nH.terrain.id === 'FOREST' && Math.random() < 0.3) newFires.push(nH);
                });
            }
        });
        newFires.forEach(nH => { nH.terrain = TERRAINS.BURNING_FOREST; nH.timer = 4; });
    };

    // 5. MÁGICA DA RENDERIZAÇÃO: Remove o desenho absoluto!
    const originalDraw = Renderer.prototype.draw;
    Renderer.prototype.draw = function () {
        if (!game || !game.units) return originalDraw.call(this);

        if (game.turnCount <= 1 && !game._stealthInit) {
            game._stealthInit = true;
            game.units.forEach(u => {
                if (!u.abilities) return;
                let hex = game.map.get(`${u.q},${u.r}`);
                if ((u.abilities.includes('dive') && hex?.terrain.id === 'WATER') || (u.abilities.includes('camouflage') && hex?.terrain.id === 'FOREST')) {
                    u.isHidden = true;
                    if (u.faction === 1) u.filter = 'opacity(0.5) sepia(100%)';
                }
            });
        }

        // Tira fisicamente as unidades inimigas do array ANTES de desenhar
        let allUnitsBackup = [...game.units];
        game.units = game.units.filter(u => !(u.isHidden && u.faction !== 1));

        originalDraw.call(this); // A tela é pintada com perfeição

        game.units = allUnitsBackup; // Retorna as unidades após a pintura

        this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        game.map.forEach(h => {
            const pos = this.getPos(h.q, h.r);
            if (h.terrain.id === 'ELECTRIC_WATER') { this.ctx.font = `${this.hexSize * 0.9}px Arial`; this.ctx.fillText('⚡', pos.x, pos.y + 4); }
            else if (h.terrain.id === 'BURNING_FOREST') { this.ctx.font = `${this.hexSize * 0.9}px Arial`; this.ctx.fillText('🔥', pos.x, pos.y + 4); }
            else if (h.terrain.id === 'ASHES') { this.ctx.font = `${this.hexSize * 0.7}px Arial`; this.ctx.fillText('💨', pos.x, pos.y + 4); }
        });
    };

    // 6. Armadilhas e Emboscadas Perfeitas (Com registro no LOG!)
    const originalMoveUnit = Game.prototype.moveUnit;
    Game.prototype.moveUnit = async function (unit, targetQ, targetR) {
        let isFlying = unit.abilities && unit.abilities.includes('flying');
        let finalQ = targetQ; let finalR = targetR;

        if (!isFlying && this.reachableHexes && this.reachableHexes.has(`${targetQ},${targetR}`)) {
            let path = []; let curr = `${targetQ},${targetR}`; let start = `${unit.q},${unit.r}`; let maxIter = 0;
            while (curr !== start && maxIter < 100) {
                path.unshift(curr);
                let [cq, cr] = curr.split(',').map(Number);
                let neighbors = typeof Hex !== 'undefined' && Hex.getNeighbors ? Hex.getNeighbors(cq, cr) : [{ q: cq + 1, r: cr }, { q: cq + 1, r: cr - 1 }, { q: cq, r: cr - 1 }, { q: cq - 1, r: cr }, { q: cq - 1, r: cr + 1 }, { q: cq, r: cr + 1 }];
                let bestN = null; let minCost = Infinity;
                for (let n of neighbors) {
                    let nKey = `${n.q},${n.r}`;
                    if (nKey === start) { bestN = nKey; minCost = -1; break; }
                    if (this.reachableHexes.has(nKey)) {
                        let cost = this.reachableHexes.get(nKey);
                        if (cost < minCost) { minCost = cost; bestN = nKey; }
                    }
                }
                if (!bestN) break; curr = bestN; maxIter++;
            }

            for (let step of path) {
                let [sq, sr] = step.split(',').map(Number);

                let ambusher = this.units.find(u => u.isHidden && u.faction !== unit.faction && Hex.distance({ q: sq, r: sr }, u) <= 1 && u.status !== 'digging');
                if (ambusher) {
                    if (sq === ambusher.q && sr === ambusher.r) {
                        if (step === path[0]) { finalQ = unit.q; finalR = unit.r; }
                        else { let [pq, pr] = path[path.indexOf(step) - 1].split(',').map(Number); finalQ = pq; finalR = pr; }
                    } else {
                        finalQ = sq; finalR = sr;
                    }

                    ambusher.isHidden = false; ambusher.filter = 'none';
                    if (typeof showPopup === 'function') showPopup("Emboscada! ⚠️", ambusher, '#e74c3c');

                    let dmg = Math.floor(this.calcDmg(ambusher, unit) * 1.5);
                    unit.hp -= dmg; unit.status = 'stun'; unit.mp = 0;
                    if (typeof showPopup === 'function') showPopup(`-${dmg} ⚔️`, unit, '#e74c3c');

                    // --- REGISTRO DE COMBATE NO LOG ---
                    let log = document.getElementById('combat-log');
                    if (log) {
                        let entry = document.createElement('div');
                        entry.style.marginBottom = '4px';
                        entry.innerHTML = `<span style="color:#e74c3c;font-weight:bold;">[EMBOSCADA]</span> ${ambusher.emoji} ${ambusher.name} surpreendeu ${unit.emoji} ${unit.name} causando ${dmg} de dano!`;
                        log.appendChild(entry);
                        log.scrollTop = log.scrollHeight;
                    }

                    if (unit.hp <= 0) this.handleDeath(unit, ambusher);
                    break;
                }

                let h = this.map.get(step);
                if (h && h.terrain.id === 'ELECTRIC_WATER') { finalQ = sq; finalR = sr; break; }
            }
        }

        await originalMoveUnit.call(this, unit, finalQ, finalR);

        let destHex = this.map.get(`${finalQ},${finalR}`);
        if (unit.isHidden && unit.status !== 'digging') {
            if (!(unit.abilities && unit.abilities.includes('dive') && destHex && destHex.terrain.id === 'WATER')) {
                unit.isHidden = false; unit.filter = 'none';
            }
        } else if (!unit.isHidden && unit.abilities && unit.abilities.includes('dive') && destHex && destHex.terrain.id === 'WATER') {
            let enemiesAdj = false;
            Hex.getNeighbors(finalQ, finalR).forEach(n => {
                let tU = this.units.find(x => x.q === n.q && x.r === n.r && x.hp > 0 && !x.isHidden);
                if (tU && tU.faction !== unit.faction) enemiesAdj = true;
            });
            if (!enemiesAdj) { unit.isHidden = true; if (unit.faction === 1) unit.filter = 'opacity(0.5) sepia(100%)'; }
        }

        if (destHex && unit.hp > 0) {
            if (destHex.terrain.id === 'ELECTRIC_WATER' && !isFlying) { unit.status = 'stun'; unit.mp = 0; if (typeof showPopup === 'function') showPopup("Zzz ⚡", unit, '#f1c40f'); }
            else if (destHex.terrain.id === 'BURNING_FOREST') { unit.hp -= 15; if (typeof showPopup === 'function') showPopup("-15 🔥", unit, '#e74c3c'); if (unit.hp <= 0) this.handleDeath(unit, { name: 'As Chamas', faction: -1 }); }
        }
    };

    // 7. MÁGICA DA IMUNIDADE: Oculta quem está cavando sem causar Game Over!
    const origRunAITurn = window.runAITurn;
    window.runAITurn = async function () {
        let diggingUnits = game.units.filter(u => u.status === 'digging');

        // Em vez de mudar a facção (o que mata o líder), jogamos eles para fora do mapa!
        // A IA vai calcular a distância como > 9000 e vai ignorá-los completamente.
        diggingUnits.forEach(u => {
            u._realQ = u.q; u._realR = u.r;
            u.q = -9999; u.r = -9999;
        });

        // A IA joga o turno dela sem enxergar quem está debaixo da terra
        if (origRunAITurn) await origRunAITurn.call(this);

        // Fim do turno da IA: devolve as criaturas para a posição exata do buraco
        diggingUnits.forEach(u => {
            if (u._realQ !== undefined) {
                u.q = u._realQ; u.r = u._realR;
                delete u._realQ; delete u._realR;
            }
        });
    };

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
        const ranges = { isca: 2, picanha: 2, rede: 3, feromonio: 3, potion: 2, bandage: 2, scroll: 4, sphere: 3, adrenalina: 2, apito: 2, trap_stun: 2, trap_teleport: 2, silence: 3 }; game.itemRange = ranges[type];

        // Seleciona o Líder automaticamente
        const leader = game.units.find(u => u.isLeader && u.faction === 1);
        if (leader) {
            game.selectedUnit = leader;
            game.calculateReachable(leader);
        }

        showMessage(`Selecione o alvo para: ${type.toUpperCase()}`, "#3498db");

        updateUI();
        renderer.draw();

        // BLINDAGEM: Esconde a bandeja de itens na hora, sem interrupções!
        setTimeout(() => {
            const menu = $('field-item-menu');
            if (menu) menu.classList.add('hidden');
        }, 50);
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
            if (game.activeItem && game.currentTurn === FACTIONS.PLAYER.id) {
                // Força o líder a ser o usuário do item, independente de quem você clicou
                if (!su || !su.isLeader) {
                    su = game.units.find(x => x.faction === 1 && x.isLeader);
                    game.selectedUnit = su;
                }
                if (!su) { showMessage("Líder não encontrado para usar o item!", "#e74c3c"); return; }

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
                } else if (game.activeItem === 'picanha') {
                    if (u) { showMessage("Selecione um chão vazio!", "#e74c3c"); return; }
                    if (dist > 2) { showMessage("Muito longe para jogar a picanha!", "#e74c3c"); return; }
                    cH.hasPremiumLure = true;
                    game.fieldItems.picanha--;
                    showMessage("Picanha posicionada!", "#e74c3c");
                    itemUsed = true;

                } else if (game.activeItem === 'feromonio') {
                    if (!u || u.faction === FACTIONS.PLAYER.id) { showMessage("Selecione uma fera inimiga!", "#e74c3c"); return; }
                    if (dist > 3) { showMessage("Fora do alcance!", "#e74c3c"); return; }
                    u.status = 'bind'; u.pheromone = true;
                    game.fieldItems.feromonio--;
                    if (typeof showPopup === 'function') showPopup("Preso e Encantado!", u, '#ff69b4');
                    itemUsed = true;

                } else if (game.activeItem === 'adrenalina') {
                    if (!u || u.faction !== FACTIONS.PLAYER.id) { showMessage("Selecione uma unidade aliada!", "#e74c3c"); return; }
                    if (dist > 2) { showMessage("Fora do alcance!", "#e74c3c"); return; }
                    u.hasAttacked = false; u.mp = u.maxMp;
                    game.fieldItems.adrenalina--;
                    if (typeof showPopup === 'function') showPopup("Turno Extra! 💉", u, '#f1c40f');
                    itemUsed = true;

                } else if (game.activeItem === 'apito') {
                    if (!u || u.faction === FACTIONS.PLAYER.id) { showMessage("Selecione uma fera inimiga!", "#e74c3c"); return; }
                    if (dist > 2) { showMessage("Fora de alcance!", "#e74c3c"); return; }
                    if (su.hasUsedApitoThisTurn) { showMessage("Apito já usado neste turno!", "#e74c3c"); return; }

                    game.fieldItems.apito--; itemUsed = true;
                    su.hasUsedApitoThisTurn = true;

                    // Guarda o estado original para o Apito não gastar a ação do líder
                    let originalHasAttacked = su.hasAttacked;
                    let originalMp = su.mp;

                    let success = await game.attemptTame(su, u);

                    su.hasAttacked = originalHasAttacked;
                    su.mp = originalMp;

                    if (!success && u.hp > 0) {
                        let dmg = game.calcDmg(u, su);
                        su.hp -= dmg;
                        if (typeof showPopup === 'function') showPopup(`Revide do Apito: -${dmg}!`, su, '#e74c3c');
                        if (su.hp <= 0) game.handleDeath(su, u);
                    }

                } else if (game.activeItem === 'trap_stun') {
                    if (u) { showMessage("Selecione um chão vazio!", "#e74c3c"); return; }
                    if (dist > 2) { showMessage("Muito longe!", "#e74c3c"); return; }
                    cH.hasStunTrap = true; game.fieldItems.trap_stun--;
                    showMessage("Armadilha Atordoante armada!", "#f1c40f"); itemUsed = true;

                } else if (game.activeItem === 'trap_teleport') {
                    if (u) { showMessage("Selecione um chão vazio!", "#e74c3c"); return; }
                    if (dist > 2) { showMessage("Muito longe!", "#e74c3c"); return; }
                    cH.hasTeleportTrap = true; game.fieldItems.trap_teleport--;
                    showMessage("Armadilha de Teleporte armada!", "#9b59b6"); itemUsed = true;

                } else if (game.activeItem === 'silence') {
                    if (!u) { showMessage("Selecione uma unidade!", "#e74c3c"); return; }
                    if (dist > 3) { showMessage("Muito longe!", "#e74c3c"); return; }
                    u.status = 'silenced'; game.fieldItems.silence--;
                    if (typeof showPopup === 'function') showPopup("Silenciado! 🔕", u, '#7f8c8d');
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
                if (su.status === 'silenced') { showMessage("Você está silenciado e não pode lançar magias!", "#e74c3c"); return; }
                const spell = SPELLS.find(s => s.id === game.activeSpell);
                if (spell) {
                    let spRange = spell.range !== undefined ? spell.range : 99;
                    let dist = Hex.distance(su, cH);
                    let isGlobal = ['sl_regen', 'sl_shadow_step', 'sl_primal_rage', 'sl_sandstorm', 'sl_inferno', 'sl_blizzard', 'sl_mass_venom', 'sl_storm_wing', 'sl_meteor', 'sl_tidal_wave', 'sl_apocalypse', 'sl_world_freeze', 'sl_soul_harvest', 'sl_phoenix_rebirth'].includes(spell.id);

                    if (!isGlobal) {
                        if (spRange === 0 && u !== su) { showMessage("Clique no próprio Conjurador!", "#e74c3c"); return; }
                        if (spRange > 0 && spRange < 99 && dist > spRange) { showMessage("Fora de alcance!", "#e74c3c"); return; }

                        if (spell.type === 'atk' && spRange > 0) {
                            // SE A MAGIA PODE MIRAR NO CHÃO:
                            if (spell.targetTerrain) {
                                if (u && u.faction === FACTIONS.PLAYER.id) { showMessage("Mire no inimigo ou chão vazio!", "#e74c3c"); return; }
                            } else {
                                // MAGIAS COMUNS (Obrigam a mirar num inimigo):
                                if (!u || u.faction === FACTIONS.PLAYER.id) { showMessage("Selecione um inimigo!", "#e74c3c"); return; }
                            }
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
                                // --- CHAMA A REAÇÃO ELEMENTAL AUTOMÁTICA ---
                                if (spell.tags) await game.triggerElementalReaction(cH, spell.tags);
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

                // --- MECÂNICA DE EMERGIR (ESCAVAR) ---
                if (su.status === 'digging') {
                    // BLINDAGEM: Verifica se ele está tentando sair no mesmo turno em que entrou!
                    if (su._digTurn === game.turnCount) {
                        if (typeof showMessage === 'function') showMessage("Você está cavando! Aguarde o próximo turno.", "#f39c12");
                        game.selectedUnit = null; game.reachableHexes.clear(); updateUI(); renderer.draw(); return;
                    }

                    if (Hex.distance(su, cH) <= (su.maxMp || 3)) {
                        su.status = null; su.isHidden = false; su.filter = 'none';
                        let targetU = game.units.find(x => x.q === cH.q && x.r === cH.r && x.hp > 0);

                        su.q = cH.q; su.r = cH.r;
                        su.vq = cH.q; su.vr = cH.r;

                        if (typeof showPopup === 'function') showPopup("Emergiu! 💥", su, '#e67e22');

                        if (targetU && targetU !== su) {
                            let pushNeighbors = Hex.getNeighbors(cH.q, cH.r);
                            let emptyN = pushNeighbors.find(n => !game.units.find(x => x.q === n.q && x.r === n.r) && game.map.get(`${n.q},${n.r}`));
                            if (emptyN) {
                                targetU.q = emptyN.q; targetU.r = emptyN.r;
                                targetU.vq = emptyN.q; targetU.vr = emptyN.r;
                            }
                            targetU.status = 'stun';
                            targetU.hp -= 20;
                            if (typeof showPopup === 'function') showPopup("-20 💥", targetU, '#e74c3c');
                            if (targetU.hp <= 0) game.handleDeath(targetU, su);
                        }

                        su.hasAttacked = true; su.mp = 0; game.selectedUnit = null;
                        game.reachableHexes.clear(); updateUI(); renderer.draw(); return;
                    } else {
                        if (typeof showMessage === 'function') showMessage("Muito longe para emergir!", "#e74c3c"); return;
                    }
                }
                // -------------------------------------
                const dist = u ? Hex.distance(su, u) : 0;

                if (u && u.faction !== FACTIONS.PLAYER.id && dist <= su.getEffectiveRange(game) && !su.hasAttacked) {

                    // --- SISTEMA DE DUPLO CLIQUE (SOMENTE MOBILE) ---
                    if (isTouch && window.pendingAttackTarget !== u) {
                        window.pendingAttackTarget = u;
                        handleCombatForecast(clientX, clientY, true, true);
                        if (typeof showMessage === 'function') showMessage("Toque novamente para Atacar!", "#f1c40f");
                        return;
                    }

                    window.pendingAttackTarget = null;
                    $('combat-forecast').style.display = 'none';

                    game.isAnimating = true;
                    if (game.tameMode && u.faction === FACTIONS.WILD.id && dist === 1) {
                        if (!su.isLeader) { showMessage("Apenas o Herói pode domar!", "#e74c3c"); return; }
                        await game.attemptTame(su, u);
                    }
                    else if (!game.tameMode) await game.executeCombat(su, u);

                    game.selectedUnit = null; game.tameMode = false; game.isAnimating = false;
                    game.reachableHexes.clear(); // NOVO: Limpa a pintura após atacar!

                } else if (!u && game.reachableHexes.has(cH.getKey())) {
                    window.pendingAttackTarget = null; $('combat-forecast').style.display = 'none';
                    saveSnapshot(); su.mp -= game.reachableHexes.get(cH.getKey()); game.isAnimating = true; await game.moveUnit(su, cH.q, cH.r); game.isAnimating = false; game.calculateReachable(su);
                } else {
                    game.selectedUnit = u;
                    if (u) game.calculateReachable(u);
                    else game.reachableHexes.clear(); // NOVO: Limpa a pintura ao clicar no chão vazio!
                }
            } else {
                game.selectedUnit = u;
                if (u && u.faction === FACTIONS.PLAYER.id) game.calculateReachable(u);
                else game.reachableHexes.clear(); // NOVO: Limpa a pintura ao selecionar aliado diferente!
            }
        } else {
            game.selectedUnit = null; game.activeSpell = null;
            window.pendingAttackTarget = null; $('combat-forecast').style.display = 'none';
            game.reachableHexes.clear(); // NOVO: Limpa a pintura ao clicar na escuridão fora do mapa!
        }
        updateUI(); renderer.draw();
    }

    // === BOTÕES DA INTERFACE ===

        // Dropdown de Recursos
    $('resources-trigger')?.addEventListener('click', (e) => {
        e.stopPropagation();
        $('resources-dropdown-list')?.classList.toggle('hidden');
        $('mana-dropdown-list')?.classList.add('hidden'); // Fecha a mana se estiver aberta
    });
    
    // Botão da Mochila de Itens de Campo
    $('btn-field-items')?.addEventListener('click', () => { 
        let menu = $('field-item-menu');
        
        // Se a div do menu não existir na tela, cria-a imediatamente
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'field-item-menu';
            menu.className = 'hidden';
            $('game-container').appendChild(menu);
        }
        
        // Alterna entre abrir e fechar
        menu.classList.toggle('hidden');
        
        // Se abriu, preenche com os itens da mochila
        if (!menu.classList.contains('hidden') && typeof renderFieldItemMenu === 'function') {
            renderFieldItemMenu(); 
        }
    });
    
    $('toggle-log-text')?.addEventListener('click', () => {
        const log = $('combat-log');
        const txt = $('toggle-log-text');
        if (!log || !txt) return;
        
        if (log.classList.contains('hidden')) {
            log.classList.remove('hidden');
            txt.innerHTML = '▼ Ocultar Log';
        } else {
            log.classList.add('hidden');
            txt.innerHTML = '▲ Mostrar Log';
        }
    });

    $('unit-portrait')?.addEventListener('click', () => {
        if (game && game.selectedUnit) { let u = game.selectedUnit; let template = ALL_BEASTS.find(x => x.name === u.baseName || x.name === u.name); if (!template && u.isLeader) { template = LEADERS.find(x => x.name === u.name); if (!template) { template = { name: u.name, emoji: u.emoji, hp: u.maxHp, mp: u.maxMp, atk: u.atk, range: u.range, filter: u.filter, fav: u.fav, isBoss: true }; } } if (template) { showBeastDetails(template, true); } }
    });

    $('btn-undo')?.addEventListener('click', () => {
        if (!lastState || game.isAnimating || game.currentTurn !== FACTIONS.PLAYER.id) return;
        game.units = lastState.u.map(u => new Unit({ ...u, isNew: false })); game.items = new Map(lastState.i); game.gold = lastState.g; game.hasKey = lastState.hk; game.hasEgg = lastState.he; game.manaPool = JSON.parse(JSON.stringify(lastState.mana)); game.spentMana = {};
        lastState.m.forEach(([k, o]) => game.map.get(k).owner = o);
        lastState = null; const btn = $('btn-undo'); if(btn) btn.disabled = true; game.selectedUnit = null; game.activeSpell = null; updateUI(); renderer.draw();
    });

    $('btn-next-unit')?.addEventListener('click', () => {
        if (game.isAnimating || game.currentTurn !== FACTIONS.PLAYER.id) return;
        const vU = game.units.filter(u => u.faction === FACTIONS.PLAYER.id && (u.mp > 0 || !u.hasAttacked) && u.status !== 'stun' && u.status !== 'bind');
        if (vU.length === 0) return;
        let idx = vU.indexOf(game.selectedUnit); let nU = vU[(idx + 1) % vU.length];
        game.selectedUnit = nU; game.calculateReachable(nU); renderer.centerOn(nU.vq, nU.vr); updateUI(); renderer.draw();
    });

    $('btn-end-turn')?.addEventListener('click', () => {
        if (!game.isAnimating) {
            if (typeof autoSave === 'function') autoSave();
            game.startNextTurn();
        }
    });

    $('btn-tame')?.addEventListener('click', () => { game.tameMode = !game.tameMode; updateUI(); renderer.draw(); });

    // Botões de Pausa e Popups
    $('btn-pause')?.addEventListener('click', () => { $('pause-menu').classList.remove('hidden'); });
    $('btn-resume')?.addEventListener('click', () => { $('pause-menu').classList.add('hidden'); });
    $('btn-close-details')?.addEventListener('click', () => { $('unit-details-modal').classList.add('hidden'); });
    $('btn-open-help')?.addEventListener('click', () => { $('help-screen').classList.remove('hidden'); });
    $('btn-help-pause')?.addEventListener('click', () => { $('pause-menu').classList.add('hidden'); $('help-screen').classList.remove('hidden'); });
    $('btn-close-help')?.addEventListener('click', () => { $('help-screen').classList.add('hidden'); if (!$('game-container').classList.contains('hidden')) $('pause-menu').classList.remove('hidden'); });

    $('btn-go-shop')?.addEventListener('click', openShop);
    $('btn-leave-shop')?.addEventListener('click', () => { openManagement(); });

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
    if (btnDuel) { btnDuel.addEventListener('click', () => { if (localStorage.getItem('ht_save_duel')) { if (!confirm("Existe um duelo salvo. Deseja iniciar um novo e perder o progresso atual?")) return; } openLeaderSelection(true, false, true); }); }

    const btnDuelHistory =
        $('btn-duel-history'); if (btnDuelHistory) { btnDuelHistory.addEventListener('click', openDuelHistory); }
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
    $('btn-hall-fame')?.addEventListener('click', openHallOfFame);

});
