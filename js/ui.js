// ==========================================
// 1. FUNÇÕES ÚTEIS E SISTEMA DE LOGS
// ==========================================
let selectedInventoryIndex = null;

window.checkAdjacency = function (id1, id2) {
    if (!game || !game.kingdomMap) return false;
    let found = false;
    game.kingdomMap.forEach(h1 => {
        if (h1.building === id1 || h1.building === id2) {
            let neighbors = Hex.getNeighbors(h1.q, h1.r);
            neighbors.forEach(n => {
                let h2 = game.kingdomMap.get(`${n.q},${n.r}`);
                if (h2 && ((h1.building === id1 && h2.building === id2) || (h1.building === id2 && h2.building === id1))) {
                    found = true;
                }
            });
        }
    });
    return found;
};

window.countKingdomBuildings = function (buildingId) {
    if (!game || !game.kingdomMap) return 0;
    let count = 0;
    game.kingdomMap.forEach(h => { if (h.building === buildingId) count += (h.bLevel || 1); });
    return count;
};

window.getMaxBoxLimit = function () {
    if (!game || !game.leaderData) return 6;
    let base = game.leaderData.limit || 6;
    if (typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_crown')) base += 1;
    base += window.countKingdomBuildings('VILLAGE'); // Bônus da Vila
    return base;
};

function saveSnapshot() {
    lastState = {
        u: game.units.map(u => new Unit({ ...u })),
        i: new Map(game.items),
        g: game.gold,
        hk: game.hasKey,
        he: game.hasEgg,
        m: Array.from(game.map.entries()).map(([k, v]) => [k, v.owner]),
        mana: JSON.parse(JSON.stringify(game.manaPool))
    };
    const undoBtn = $('btn-undo');
    if (undoBtn) undoBtn.disabled = false;
}

function showZeldaPopup(icon, title, desc, showCancel = false) {
    return new Promise(r => {
        $('item-popup-icon').innerText = icon;
        $('item-popup-title').innerText = title;
        $('item-popup-desc').innerText = desc;

        let oldCancel = $('btn-cancel-item-popup');
        if (oldCancel) oldCancel.remove();

        if (showCancel) {
            let btn = document.createElement('button');
            btn.id = 'btn-cancel-item-popup';
            btn.className = 'btn-danger';
            btn.style.width = '100%';
            btn.style.marginTop = '10px';
            btn.innerText = 'Deixar no chão';
            btn.onclick = () => { hide('item-popup'); r(false); };
            $('item-popup').querySelector('.modal-card').appendChild(btn);
        }

        show('item-popup');
        $('btn-close-item-popup').onclick = () => { hide('item-popup'); r(true); };
    });
}

function autoSave() {
    if (game && !game.gameOver) {
        // CORREÇÃO: Chave única e isolada para cada modo de jogo
        const sk = game.isDuel ? 'ht_save_duel' : (game.isRoguelite ? 'ht_save_rogue' : 'ht_save_camp');
        const sv = {
            resources: game.resources,
            kingdomMap: Array.from(game.kingdomMap.entries()),
            level: game.currentLevel, cols: game.cols, rows: game.rows, gold: game.gold,
            dna: game.dna || 0,
            isRoguelite: game.isRoguelite,
            isDuel: game.isDuel, // Salva o estado do modo de jogo
            hasKey: game.hasKey, hasEgg: game.hasEgg,
            leaderId: game.leaderData.id,
            opponentId: game.opponentId || null,
            conqueredRegions: game.conqueredRegions || [],
            currentRegionId: game.currentRegionId || null,
            map: Array.from(game.map.values()).map(h => ({ q: h.q, r: h.r, tId: h.terrain.id, owner: h.owner, hasLure: h.hasLure })),
            items: Array.from(game.items.entries()),
            units: game.units.map(u => ({ ...u })),
            rosterMemory: rosterMemory.map(u => ({ ...u })),
            deployedRoster: deployedRoster.map(u => ({ ...u })),
            manaPool: game.manaPool, spentMana: game.spentMana, spellCooldowns: game.spellCooldowns,
            fieldItems: game.fieldItems,
            routeMap: game.routeMap, currentFloor: game.currentFloor, inventory: game.inventory,
            isBossStage: game.isBossStage || false,
            currentRouteType: game.currentRouteType || 'BATTLE'
        };
        //Salva os pergaminhos aprendidos
        if (typeof RECIPES !== 'undefined') {
            sv.unlockedRecipes = {};
            Object.keys(RECIPES).forEach(k => { sv.unlockedRecipes[k] = RECIPES[k].isLocked; });
        }
        localStorage.setItem(sk, JSON.stringify(sv));
    }
}

function unlockInBestiary(n) {
    if (!unlockedBeasts.includes(n)) {
        unlockedBeasts.push(n);
        localStorage.setItem('ht_bestiary', JSON.stringify(unlockedBeasts));
    }
}

function loadMeta() {
    try {
        const s = localStorage.getItem('ht_stats'); if (s) stats = JSON.parse(s) || stats;
        const b = localStorage.getItem('ht_bestiary'); if (b) unlockedBeasts = JSON.parse(b) || [];
        const ac = localStorage.getItem('ht_artifacts_camp'); if (ac) activeArtifactsCamp = JSON.parse(ac) || [];
        const ar = localStorage.getItem('ht_artifacts_rogue'); if (ar) activeArtifactsRogue = JSON.parse(ar) || [];
    } catch (e) { }
    $('btn-load-campaign').classList.toggle('hidden', !localStorage.getItem('ht_save_camp'));
    $('btn-load-roguelite').classList.toggle('hidden', !localStorage.getItem('ht_save_rogue'));
}

window.fullCombatHistory = []; // Memória global do log

function addLog(msg, col = '#9a8a6a') {
    // Trava de segurança: garante que a memória existe antes de tentar salvar
    if (!window.fullCombatHistory) window.fullCombatHistory = [];

    const e = document.createElement('div');
    e.className = 'log-entry';
    e.style.borderLeftColor = col;
    e.innerText = msg;

    window.fullCombatHistory.push({ text: msg, color: col });

    const combatLog = document.getElementById('combat-log');
    if (combatLog) {
        combatLog.appendChild(e);
        if (combatLog.childNodes.length > 5) combatLog.removeChild(combatLog.firstChild);
    }
}

function showPopup(txt, target, col) {
    if (!renderer) return;
    const p = renderer.getPos(target.vq || target.q, target.vr || target.r);
    const el = document.createElement('div');
    el.className = 'dmg-popup';
    el.innerText = txt;
    el.style.color = col;

    const randomOffsetX = (Math.random() - 0.5) * 30;
    el.style.left = (p.x + randomOffsetX) + 'px';
    el.style.top = (p.y - 25) + 'px';

    el.style.transition = 'top 2.5s ease-out, opacity 2.5s ease-out';
    $('popup-layer').appendChild(el);

    setTimeout(() => {
        el.style.top = (p.y - 85) + 'px';
        el.style.opacity = '0';
    }, 50);

    setTimeout(() => el.remove(), 2500);
}

function showMessage(txt, col) {
    const msgEl = $('messages');
    if (msgEl) {
        msgEl.innerText = txt;
        msgEl.style.color = col;
        msgEl.style.opacity = '1';
        msgEl.style.transition = 'opacity 0.5s';
        setTimeout(() => { msgEl.style.opacity = '0'; }, 2500);
    }
}

window.giveRandomArtifact = function (rarity) {
    return new Promise(async (resolve) => {
        let pool = ARTIFACTS.filter(a => a.rarity === rarity && !getActiveArtifacts().includes(a.id) && a.id !== 'art_omega');
        if (pool.length === 0) pool = ARTIFACTS.filter(a => !getActiveArtifacts().includes(a.id) && a.id !== 'art_omega');
        if (pool.length > 0) {
            let art = pool[Math.floor(Math.random() * pool.length)];
            let myA = getActiveArtifacts(); myA.push(art.id);
            localStorage.setItem(game.isRoguelite ? 'ht_artifacts_rogue' : 'ht_artifacts_camp', JSON.stringify(myA));
            if (art.id === 'art_hp') { rosterMemory.forEach(u => { u.maxHp += 15; u.hp += 15; }); deployedRoster.forEach(u => { u.maxHp += 15; u.hp += 15; }); }
            if (art.id === 'art_atk') { rosterMemory.forEach(u => u.atk += 8); deployedRoster.forEach(u => u.atk += 8); }
            if (art.id === 'art_move') { let l = deployedRoster.find(u => u.isLeader); if (l) { l.maxMp++; l.mp++; } }
            if (art.id === 'art_crystal') { let l = deployedRoster.find(u => u.isLeader); if (l) { l.range++; l.atk += 5; } }
            if (art.id === 'art_umbral_seal') { deployedRoster.forEach(u => { if (!u.tags.includes('UMBRAL')) u.tags.push('UMBRAL'); }); }
            if (art.id === 'art_celestial_seal') { deployedRoster.forEach(u => { if (!u.tags.includes('CELESTIAL')) u.tags.push('CELESTIAL'); }); }
            await showZeldaPopup(art.icon, `Novo Artefato!`, `${art.name}: ${art.desc}`);
        }
        resolve();
    });
};

// ==========================================
// 2. MANA, MAGIAS E GRIMÓRIO
// ==========================================
function computeManaIncome() {
    let counts = {};
    const all = [...deployedRoster, ...(game ? game.units.filter(u => u.faction === 1) : [])];
    const seen = new Set();
    all.forEach(u => {
        if (seen.has(u.name + u.q + u.r)) return;
        seen.add(u.name + u.q + u.r);
        (u.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    return counts;
}

function collectMana() {
    if (!game) return;
    let income = computeManaIncome();
    Object.entries(income).forEach(([tag, count]) => {
        // Agora gera 1 inteiro por tag!
        if (MANA_TYPES[tag]) { game.manaPool[tag] = (game.manaPool[tag] || 0) + count; }
    });
    updateManaUI();
}

function spendMana(cost) {
    for (let [tag, amt] of Object.entries(cost)) {
        let avail = Math.floor((game.manaPool[tag] || 0) - (game.spentMana[tag] || 0));
        if (avail < amt) return false;
    }
    for (let [tag, amt] of Object.entries(cost)) {
        game.spentMana[tag] = (game.spentMana[tag] || 0) + amt;
    }
    updateManaUI(); return true;
}

function canAffordSpell(spell, leader) {
    if (!game) return false;
    let maxS = (leader && leader.name === 'Arquimago') ? 2 : 1;
    if (leader && (leader.spellsCast || 0) >= maxS) return false;
    for (let [tag, amt] of Object.entries(spell.cost)) {
        let avail = Math.floor((game.manaPool[tag] || 0) - (game.spentMana[tag] || 0));
        if (avail < amt) return false;
    }
    return true;
}

function resetSpentMana() { game.spentMana = {}; updateManaUI(); }

function updateManaUI() {
    if (!game) return;
    const container = $('mana-bar-container');
    if (!container) return;

    let totalAvailable = 0;
    let listHtml = '';
    let hasMana = false;

    // Varre a pool de mana calculando os saldos reais disponíveis
    Object.entries(game.manaPool).forEach(([tag, total]) => {
        if (total <= 0) return;
        const mt = MANA_TYPES[tag]; if (!mt) return;
        const spent = game.spentMana[tag] || 0;
        let available = Math.floor(total - spent);
        if (available <= 0 && Math.floor(total) <= 0) return;

        hasMana = true;
        if (available > 0) totalAvailable += available;

        // Monta as linhas da lista (1 coluna com as manas existentes)
        listHtml += `
            <div style="display:flex; align-items:center; gap:8px; padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05); color:${mt.col}; font-size:11px; font-weight:bold; white-space:nowrap;">
                <span style="font-size:13px;">${mt.icon}</span>
                <span style="flex:1; text-align:left; color:#ddd; font-family:sans-serif; font-weight:normal;">${mt.name}</span>
                <span style="color:#fff; background:rgba(255,255,255,0.1); padding:1px 5px; border-radius:3px;">${available}</span>
            </div>`;
    });

    // Injeta o gatilho compacto e a caixinha absoluta oculta
    container.innerHTML = `
        <div id="mana-trigger" style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:12px; font-weight:bold; color:var(--gold-light); padding:2px 4px; user-select:none;">
            <img src="img/icone-mana.png" style="width: 16px; height: 16px;"> <span>Mana: ${totalAvailable}</span> <small style="font-size:8px; opacity:0.5; transform:scale(0.8);">▼</small>
        </div>
        <div id="mana-dropdown-list" class="hidden" style="position:absolute; top:32px; left:0; background:rgba(10,10,15,0.98); border:1px solid var(--gold-dark); border-radius:6px; box-shadow:0 4px 20px rgba(0,0,0,0.9); z-index:2500; min-width:150px; display:flex; flex-direction:column; backdrop-filter:blur(10px);">
            ${hasMana ? listHtml : '<div style="color:#666; padding:10px; font-size:11px; font-style:italic; text-align:center;">Sem Mana</div>'}
        </div>
    `;

    // Gerencia a abertura/fechamento do painel ao clicar
    $('mana-trigger')?.addEventListener('click', (e) => {
        e.stopPropagation();
        $('mana-dropdown-list')?.classList.toggle('hidden');
    });

    // Garante que o menu feche se o jogador clicar em qualquer outro ponto do mapa
    window.addEventListener('click', () => {
        $('mana-dropdown-list')?.classList.add('hidden');
    });

    renderSpellBar();
}

function renderSpellBar() {
    const bar = $('spell-bar');
    if (!bar) return;
    bar.innerHTML = '';
    if (!game || game.currentTurn !== 1) return;

    // Se a unidade selecionada não tiver magias, não mostramos as magias do líder por engano!
    let caster = game.selectedUnit;
    if (!caster || caster.faction !== 1) return;
    if (!caster.knownSpells || caster.knownSpells.length === 0) return;

    caster.knownSpells.forEach(sid => {
        const spell = typeof SPELLS !== 'undefined' ? SPELLS.find(s => s.id === sid) : null;
        if (!spell) return;
        const cd = game.spellCooldowns[sid] || 0;

        let can = false;
        if (caster.isLeader) {
            can = canAffordSpell(spell, caster) && !game.isAnimating && cd === 0;
        } else {
            // Feras não gastam mana
            can = !caster.hasAttacked && !game.isAnimating && cd === 0;
        }

        const isActive = game.activeSpell === sid;

        let costHtml = caster.isLeader ? Object.entries(spell.cost).map(([tag, amt]) => {
            const mt = MANA_TYPES[tag]; if (!mt) return '';
            return `<span style="color:${mt.col};font-size:9px;">${mt.icon}x${amt}</span>`;
        }).join(' ') : `<span style="color:#2ecc71;font-size:9px;">Custo: 0 (Ação)</span>`;

        let cdText = cd > 0 ? `<span style="color:#f39c12; font-weight:bold;">[CD: ${cd}]</span> ` : '';
        const btn = document.createElement('div');
        btn.style.flexShrink = '0';
        btn.className = `spell-btn ${isActive ? 'spell-active' : ''} ${!can ? 'spell-disabled' : ''}`;
        btn.innerHTML = `<span style="font-size:16px;">${spell.icon}</span><div style="flex:1; line-height:1.2; text-align:left;"><div style="font-family:Cinzel,serif;font-size:11px;color:${isActive ? '#ff8888' : 'var(--gold-light)'};">${cdText}${spell.name}</div><div style="font-size:9px;color:#888;">Nv${spell.level} · ${costHtml}</div></div>`;

        btn.title = spell.desc;

        if (can) {
            btn.addEventListener('click', () => {
                if (game.isAnimating) return;

                if (game.activeSpell === sid) {
                    game.activeSpell = null;
                } else {
                    game.activeSpell = sid;
                    game.selectedUnit = caster; // Crava o conjurador como alvo selecionado
                    game.calculateReachable(caster);
                    updateUI();
                    if (typeof renderer !== 'undefined') renderer.draw();
                    showMessage(`✨ ${spell.name}: ${spell.desc}`, '#e8c84a');

                    // BLINDAGEM: Força o fechamento da barra com delay de segurança!
                    setTimeout(() => {
                        const b = $('spell-bar');
                        if (b) b.classList.add('hidden');
                    }, 50);
                }
                renderSpellBar();
            });
        }
        bar.appendChild(btn);
    });
}

function openGrimoire() {
    const leader = game && game.units.find(u => u.isLeader && u.faction === 1);
    $('grimoire-subtitle').innerText = leader ? `${leader.emoji} ${leader.name} — Nível ${leader.level}` : 'Grimório';
    const manaDiv = $('grimoire-mana-display'); manaDiv.innerHTML = '';

    if (game) {
        let income = computeManaIncome();
        Object.entries(game.manaPool).forEach(([tag, total]) => {
            if (total <= 0) return;
            const mt = MANA_TYPES[tag]; if (!mt) return;
            const spent = game.spentMana[tag] || 0;
            const inc = income[tag] ? ` (+${income[tag]}/t)` : '';
            const el = document.createElement('span');
            el.style.cssText = `background:${mt.col}22;border:1px solid ${mt.col}66;border-radius:4px;padding:3px 8px;font-size:12px;color:${mt.col};`;
            el.innerText = `${mt.icon} ${mt.name}: ${Math.floor(total - spent)}/${Math.floor(total)}${inc}`;
            manaDiv.appendChild(el);
        });
    }

    const grid = $('grimoire-grid');
    grid.innerHTML = '';
    const grimTags = leader ? (leader.grimTags || []) : [];
    const known = leader ? (leader.knownSpells || []) : [];

    for (let lvl = 1; lvl <= 5; lvl++) {
        const spellsOfLevel = SPELLS.filter(s => { return s.tags.some(t => grimTags.includes(t)); }).filter(s => s.level === lvl);
        if (!spellsOfLevel.length) continue;
        const hdr = document.createElement('div');
        hdr.style.cssText = `grid-column:1/-1;font-family:Cinzel,serif;font-size:12px;color:var(--gold);border-bottom:1px solid var(--gold-dark);padding-bottom:4px;margin-top:8px;`;
        hdr.innerText = `── Nível ${lvl} ──`;
        grid.appendChild(hdr);
        spellsOfLevel.forEach(spell => {
            const isKnown = known.includes(spell.id); const mt = MANA_TYPES[Object.keys(spell.cost)[0]]; const borderCol = mt ? mt.col : '#888';
            const card = document.createElement('div'); card.className = `grimoire-card ${isKnown ? 'known' : ''}`; card.style.borderColor = isKnown ? borderCol : borderCol + '44'; card.style.opacity = isKnown ? '1' : '0.5';
            let costHtml = Object.entries(spell.cost).map(([tag, amt]) => {
                const mtt = MANA_TYPES[tag]; if (!mtt) return '';
                return `<span style="color:${mtt.col};font-size:10px;">${mtt.icon}×${amt}</span>`;
            }).join(' ');
            card.innerHTML = `<span class="grimoire-level-badge" style="background:${borderCol}22;color:${borderCol};border-color:${borderCol}88;">Nível ${spell.level}</span>
                <div style="font-size:28px;margin:6px 0;">${spell.icon}</div>
                <div style="font-family:Cinzel,serif;font-size:13px;color:${isKnown ? 'var(--gold-light)' : '#888'};margin-bottom:6px;">${spell.name}</div>
                <div style="font-size:11px;color:#aaa;line-height:1.4;margin-bottom:8px;">${spell.desc}</div>
                <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">${costHtml}</div>
                ${isKnown ? '<div style="font-size:9px;color:var(--success);margin-top:6px;">✔ Aprendida</div>' : '<div style="font-size:9px;color:#555;margin-top:6px;">Não aprendida ainda</div>'}`;
            grid.appendChild(card);
        });
    }
    hide('pause-menu'); show('grimoire-screen');
}

async function showSpellLearnModal(leader, level) {
    const grimTags = leader.grimTags || [];
    const alreadyKnown = leader.knownSpells || [];
    let candidates = SPELLS.filter(s => {
        if (s.level !== level) return false;
        if (alreadyKnown.includes(s.id)) return false;
        return s.tags.some(t => grimTags.includes(t));
    });
    if (!candidates.length) { candidates = SPELLS.filter(s => s.level === level && !alreadyKnown.includes(s.id)); }
    if (!candidates.length) return;
    candidates = candidates.sort(() => Math.random() - 0.5).slice(0, 3);
    return new Promise(resolve => {
        $('slm-subtitle').innerText = `${leader.emoji} ${leader.name} atingiu Nível ${level}! Grimório disponível:`;
        const container = $('slm-options');
        container.innerHTML = '';
        candidates.forEach(spell => {
            let costHtml = Object.entries(spell.cost).map(([tag, amt]) => {
                const mt = MANA_TYPES[tag]; if (!mt) return '';
                return `<span class="mana-pip available" style="background:${mt.col}44;color:${mt.col};border-color:${mt.col}88;width:auto;padding:0 5px;">${mt.icon} ×${amt}</span>`;
            }).join('');
            const card = document.createElement('div');
            card.className = 'spell-option-card';
            card.style.borderColor = Object.keys(spell.cost).map(t => MANA_TYPES[t]?.col || '#888')[0] || '#888';
            card.innerHTML = `<span class="spell-option-icon">${spell.icon}</span>
                <div class="spell-option-name" style="color:var(--gold-light);">${spell.name}</div>
                <div class="spell-option-desc">${spell.desc}</div>
                <div class="spell-option-cost">${costHtml}</div>`;
            card.addEventListener('click', () => {
                leader.knownSpells.push(spell.id);
                addLog(`✨ ${leader.name} aprendeu ${spell.name}!`, '#c9a227');
                hide('spell-learn-modal');
                renderSpellBar();
                resolve(spell.id);
            });
            container.appendChild(card);
        });
        $('btn-slm-skip').onclick = () => { hide('spell-learn-modal'); resolve(null); };
        show('spell-learn-modal');
    });
}

// ==========================================
// 3. UNIDADES E INTERFACE DO JOGO
// ==========================================
function getTagHTML(t) {
    let tDef = typeof TAGS !== 'undefined' ? TAGS[t] : null;
    let col = tDef ? tDef.col : '#888';
    let name = tDef ? tDef.name : t;
    let desc = tDef ? tDef.desc : 'Sem descrição.';
    // Envolve a tag na classe qol-tooltip
    return `<div class="qol-tooltip tag-badge" style="background:rgba(20,20,30,0.9); border:1px solid ${col}; color:${col}; font-size:9px; padding:2px 6px; border-radius:4px; box-shadow:0 0 5px ${col}40; text-shadow:0 0 2px ${col}80;">
                ${name}
                <span class="qol-tooltiptext">${desc}</span>
            </div>`;
}

window.promptSelectUnit = function (title, unitsToSelectFrom) {
    return new Promise(resolve => {
        if (!unitsToSelectFrom || unitsToSelectFrom.length === 0) return resolve(null);
        $('usm-title').innerText = title;
        const grid = $('usm-grid');
        grid.innerHTML = '';

        unitsToSelectFrom.forEach(u => {
            const card = document.createElement('div');
            card.className = 'beast-card unlocked';
            let xpText = (!u.isBoss) ? `<div class="beast-stats" style="color:var(--success); margin-top:2px;">XP: ${u.xp}/${u.maxXp}</div>` : '';
            card.innerHTML = `<span class="beast-icon" style="filter:${u.filter}">${u.emoji}</span>
                              <div class="beast-name">${u.name} <span style="color:var(--gold);">Lv${u.level}</span></div>
                              <div class="beast-stats">HP: ${u.hp}/${u.maxHp} | ATK: ${u.atk}</div>
                              ${xpText}`;
            card.onclick = () => { hide('unit-select-modal'); resolve(u); };
            grid.appendChild(card);
        });

        // --- NOVO: BOTÃO DE CANCELAR ---
        let oldCancel = $('btn-cancel-usm');
        if (oldCancel) oldCancel.remove(); // Evita duplicar o botão se reabrir

        let cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-cancel-usm';
        cancelBtn.className = 'btn-danger';
        cancelBtn.style.width = '100%';
        cancelBtn.style.marginTop = '15px';
        cancelBtn.innerText = '✕ Cancelar / Voltar';
        cancelBtn.onclick = () => { hide('unit-select-modal'); resolve(null); };

        grid.parentElement.appendChild(cancelBtn);
        // -------------------------------

        show('unit-select-modal');
    });
};


window.learnAbility = async function (u, newA) {
    if (u.abilities.includes(newA)) { showMessage("Já possui essa habilidade!", "#f39c12"); return false; }
    if (u.abilities.length < 2) { u.abilities.push(newA); showPopup("Habilidade Aprendida!", u, "#2ecc71"); return true; }
    return new Promise(resolve => {
        $('arm-desc').innerText = `${u.name} quer aprender ${ABILITY_DESCRIPTIONS[newA].split(':')[0]}. Escolha uma para esquecer:`; $('arm-options').innerHTML = '';
        u.abilities.forEach((ab, idx) => { let btn = document.createElement('button'); btn.innerText = `Esquecer: ${ABILITY_DESCRIPTIONS[ab].split(':')[0]}`; btn.onclick = () => { u.abilities[idx] = newA; hide('ability-replace-modal'); showPopup("Substituída!", u, "#2ecc71"); resolve(true); }; $('arm-options').appendChild(btn); });
        $('btn-arm-cancel').onclick = () => { hide('ability-replace-modal'); resolve(false); }; show('ability-replace-modal');
    });
}

window.showAbility = function (id, e, n, f = 'none') {
    document.getElementById('unit-details-modal').classList.remove('hidden');
    document.getElementById('ud-icon').innerText = e; document.getElementById('ud-icon').style.filter = f;
    document.getElementById('ud-name').innerText = n;
    document.getElementById('ud-desc').innerText = ABILITY_DESCRIPTIONS[id] || 'Mistério.';
}

window.showBeastDetails = function (b, bypassUnlock = false) {
    const isUnlocked = bypassUnlock || unlockedBeasts.includes(b.name);
    if (!isUnlocked && !bypassUnlock) return;
    let evArr = EVOS[b.name] || [b.name + ' Alfa', b.name + ' Supremo'];
    let e1 = b.e || b.emoji, n1 = b.name, f1 = b.filter || 'none';
    let e2 = e1, n2 = evArr[0], f2 = f1; let e3 = e1, n3 = evArr[1], f3 = f1;
    const evs2 = {
        '🐺': () => { if (f2 === 'none') f2 = 'saturate(200%) hue-rotate(330deg)'; },
        '🐗': () => e2 = '🦏',
        '🐻': () => e2 = '🐼',
        '🐭': () => e2 = '🐀',
        '🐢': () => { e2 = '🦕'; n2 = "Dinossauro Escudo"; },
        '🐴': () => { e2 = '🦄'; n2 = "Unicórnio Místico"; },
        '🐍': () => { e2 = '🐍'; n2 = "Basilisco"; },
        '🦂': () => { e2 = '🦂'; n2 = "Imperador do Deserto"; },
        '🐒': () => { e2 = '🦍'; n2 = "Gorila Rei"; },
        '🦊': () => { e2 = '🦊'; n2 = "Raposa de Nove Caudas"; },
        '🐸': () => { e2 = '🐸'; n2 = "Sapo-Boi Gigante"; },
        '🐦': () => { e2 = '🦅'; n2 = "Fênix"; }
    };
    if (evs2[e1]) evs2[e1]();

    let displayEvos = [{ name: n1, e: e1, f: f1 }, { name: n2, e: e2, f: f2 }, { name: n3, e: e3, f: f3 }];
    let evoHtml = '';
    displayEvos.forEach((ev, idx) => {
        const isBoss = b.maxLevel !== undefined || b.isBoss || b.desc !== undefined;
        if (isBoss && idx > 0) return;
        const isUnl = bypassUnlock || unlockedBeasts.includes(ev.name);
        let flt = isUnl ? ev.f : 'brightness(0) invert(0.15)';
        let cName = isUnl ? ev.name : '???';
        evoHtml += `<div style="text-align:center;position:relative;flex:1;"><div style="font-size:32px;filter:${flt};margin-bottom:5px;">${ev.e}</div><div style="font-size:10px;color:var(--gold-light);font-family:Cinzel,serif;">${idx === 0 ? 'Base' : `Nível ${idx + 1}`}</div><div style="font-size:10px;color:${isUnl ? '#fff' : '#888'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cName}</div></div>`;
        if (idx < 2 && !isBoss) evoHtml += `<div style="color:var(--gold-dark);font-size:16px;align-self:center;">➔</div>`;
    });

    let tagsDisplayHtml = `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:4px; margin-bottom:15px;">${(b.tags || []).map(t => getTagHTML(t)).join('')}</div>`;
    $('bd-evos').innerHTML = `<div style="width:100%;">${tagsDisplayHtml}</div><div style="display:flex; width:100%;">${evoHtml}</div>`;

    let terHtml = '';
    Object.values(TERRAINS).forEach(t => {
        let defV = t.def; let costV = t.cost; let isFav = (b.fav || []).includes(t.id);
        if (isFav) { defV += 0.2; costV = 1; }

        // NOVO: Ajuste visual para o Almirante na Água (Custo 1)
        if ((b.name === 'Almirante' || b.baseName === 'Almirante') && t.id === 'WATER') {
            costV = 1;
        }

        // NOVO: Ajuste visual para criaturas Abissais na Água (+30% de Defesa)
        if ((b.tags && b.tags.includes('ABYSSAL')) && t.id === 'WATER') {
            defV += 0.30;
        }

        let defCol = defV > 0 ? 'var(--success)' : (defV < 0 ? 'var(--enemy-color)' : '#aaa');
        let costCol = costV === 1 ? 'var(--success)' : (costV >= 3 ? 'var(--enemy-color)' : '#aaa');
        terHtml += `<div style="background:rgba(20,20,30,0.8);border:1px solid var(--gold-dark);border-radius:4px;padding:6px;text-align:center;"><div style="font-size:16px;margin-bottom:2px;">${t.icon || '⬛'}</div><div style="font-size:9px;color:#ddd;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.name}</div><div style="font-size:10px;"><span title="Defesa" style="color:${defCol}">🛡️ ${Math.round(defV * 100)}%</span><br><span title="Custo" style="color:${costCol}">🥾 ${costV}</span></div></div>`;
    });
    $('bd-terrains').innerHTML = terHtml; $('beast-details-modal').classList.remove('hidden');
}

function updateUI() {
    if (!$('combat-forecast')) {
        let fc = document.createElement('div');
        fc.id = 'combat-forecast';
        document.body.appendChild(fc);
    }

    // ==========================================
    // CONTROLE DO BOTÃO DE CANCELAR AÇÃO
    // ==========================================
    const btnCancel = $('btn-cancel-action');
    if (btnCancel) {
        if ((game && game.activeSpell) || (game && game.activeItem)) {
            btnCancel.classList.remove('hidden');
        } else {
            btnCancel.classList.add('hidden');
        }
    }
    // ==========================================

    // Atualiza os contadores individuais de Ouro e DNA
    const goldDisplay = $('ui-gold');
    if (goldDisplay && game) {
        goldDisplay.innerText = game.gold;
        // ADICIONE ESTA LINHA:
        if ($('ui-gold-trigger')) $('ui-gold-trigger').innerText = game.gold;
    }

    const dnaDisplay = $('ui-dna');
    if (dnaDisplay && game) dnaDisplay.innerText = game.dna || 0;

    let res = game.resources || {};
    if ($('ui-dna')) $('ui-dna').innerText = game.dna || 0;
    if ($('res-wood')) $('res-wood').innerText = res.wood || 0;
    if ($('res-stone')) $('res-stone').innerText = res.stone || 0;
    if ($('res-scales')) $('res-scales').innerText = res.scales || 0;
    if ($('res-sand')) $('res-sand').innerText = res.sand || 0;

    updateManaUI();
    if (game && game.selectedUnit) {
        $('bottom-hud').classList.remove('hidden'); // Exibe a HUD inferior

        const u = game.selectedUnit;
        const col = u.faction === 1 ? '#4a9edd' : u.faction === 2 ? '#c0392b' : '#27ae60';

        // Aplica uma máscara (overflow: hidden) na caixinha do retrato
        $('unit-portrait').style.cssText = `border-color:${col}; box-shadow:0 0 10px ${col}40; filter:${u.filter}; overflow: hidden; display: flex; align-items: flex-start; justify-content: center;`;

        if (u.sprite) {
            // Se tiver sprite, dá um zoom de 1.8x e foca no topo (rosto) do personagem
            $('unit-portrait').innerHTML = `<img src="${u.sprite}" style="width: 100%; height: 100%; object-fit: cover; object-position: center 10%; transform: scale(1.8); transform-origin: top center; pointer-events: none;">`;
        } else {
            // Mantém o emoji se não houver arte
            $('unit-portrait').innerHTML = u.emoji;
        }

        $('unit-portrait').onclick = () => { window.showBeastDetails(u, true); };

        let starIcon = u.starLevel === 2 ? '🥉' : u.starLevel === 3 ? '🥈' : u.starLevel >= 4 ? '🌟' : '';
        $('unit-name').innerHTML = `${u.name} <span style="color:#aaa; font-size:11px;">Lv${u.level}${starIcon}</span>`;

        // Barras Compactas (HP, MP, XP)
        let hpHtml = `<div class="stat-bar-row"><span style="width:18px;color:#e74c3c;">HP</span><div class="stat-bar-bg"><div class="stat-bar-fill fill-hp" style="width:${(u.hp / u.maxHp) * 100}%"></div></div><span style="width:35px;text-align:right;">${Math.floor(u.hp)}/${u.maxHp}</span></div>`;
        let mpHtml = `<div class="stat-bar-row"><span style="width:18px;color:#3498db;">MP</span><div class="stat-bar-bg"><div class="stat-bar-fill fill-mp" style="width:${(u.mp / u.maxMp) * 100}%"></div></div><span style="width:35px;text-align:right;">${Math.floor(u.mp)}/${u.maxMp}</span></div>`;
        let xpHtml = u.faction === 1 && !u.isBoss ? `<div class="stat-bar-row"><span style="width:18px;color:#2ecc71;">XP</span><div class="stat-bar-bg"><div class="stat-bar-fill fill-xp" style="width:${(u.xp / u.maxXp) * 100}%"></div></div><span style="width:35px;text-align:right;">${u.xp}/${u.maxXp}</span></div>` : '';
        $('unit-bars').innerHTML = hpHtml + mpHtml + xpHtml;

        // Status de Combate
        let defInfo = ''; const uH = game.map.get(`${u.q},${u.r}`);
        if (uH) { let defV = uH.terrain.def; if (u.fav.includes(uH.terrain.id)) defV += 0.2; defInfo = `<br>📍 ${uH.terrain.icon} Def: ${Math.round(defV * 100)}%`; }
        $('unit-combat-stats').innerHTML = `<strong style="color:#fff;">ATK:</strong> ${u.getEffectiveAtk(game)} &nbsp;|&nbsp; <strong style="color:#fff;">ALC:</strong> ${u.getEffectiveRange(game)}${defInfo}`;

        // Mapeamento das Habilidades e Tags para Ícones Limpos
        const ABILITY_ICONS = {
            dodge: '💨', lifesteal: '🦇', poison: '☠️', stun: '⚡', bind: '🕸️', burn: '🔥', pierce: '🗡️', counter: '↩️', freeze: '🧊', leadership: '👑', electric: '🌩️', hit_run: '🐎', swift: '🐇', crystal_skin: '💎', corte_amplo: '🪓', carapace: '🐢', flying: '🪽', frost_armor: '🛡️', camouflage: '🍃', dive: '🌊'
        };

        const getIconHTML = (icon, title, desc) => `<div class="qol-tooltip icon-badge">${icon}<span class="qol-tooltiptext" style="font-family:sans-serif; text-align:left;"><strong>${title}</strong><br>${desc}</span></div>`;

        let iconsHtml = '';

        // Efeitos Negativos (Debuffs visíveis primeiro)
        if (u.status === 'poison') iconsHtml += getIconHTML('🤢', 'Envenenado', 'Perde HP a cada turno.');
        if (u.status === 'stun') iconsHtml += getIconHTML('💫', 'Atordoado', 'Perde o turno atual.');
        if (u.status === 'bind') iconsHtml += getIconHTML('⛓️', 'Preso', 'Movimento 0.');
        if (u.status === 'silenced') iconsHtml += getIconHTML('🔕', 'Silenciado', 'Não pode lançar magias.');
        if (u.faction === 0 && u.alerted) iconsHtml += getIconHTML('⚠️', 'Alerta', 'Em estado de agressão.');

        // Tags e Habilidades
        (u.tags || []).forEach(t => { let tDef = TAGS[t]; if (tDef) iconsHtml += getIconHTML(MANA_TYPES[t]?.icon || '✨', tDef.name, tDef.desc); });
        u.abilities.forEach(ab => { if (ABILITY_DESCRIPTIONS[ab]) iconsHtml += getIconHTML(ABILITY_ICONS[ab] || '📖', ab.toUpperCase(), ABILITY_DESCRIPTIONS[ab]); });

        $('unit-tags-abilities').innerHTML = iconsHtml || '<span style="font-size:10px; color:#555;">Normal</span>';

        if (u.isLeader && u.faction === 1 && !u.hasAttacked && u.status !== 'stun' && u.status !== 'bind') { show('btn-tame'); $('btn-tame').classList.toggle('active', game.tameMode); } else { hide('btn-tame'); }

    } else if (game && game.selectedHex) {
        $('bottom-hud').classList.remove('hidden');
        const h = game.selectedHex, t = h.terrain;
        $('unit-portrait').style.cssText = `border-color:#555; background:#222;`; $('unit-portrait').innerText = t.icon || '⬛';
        $('unit-name').innerHTML = `${t.name}`;
        $('unit-bars').innerHTML = `<div style="font-size:12px; color:#aaa; margin-top:5px;">Custo Mov: ${t.cost}<br>Defesa Base: ${Math.round(t.def * 100)}%</div>`;
        $('unit-combat-stats').innerHTML = ''; $('unit-tags-abilities').innerHTML = ''; hide('btn-tame');
        $('unit-portrait').onclick = null;
    } else {
        $('bottom-hud').classList.add('hidden'); // Esconde a HUD inteira se clicar no nada!
    }
    // Garante que os menus fechem se o jogador clicar em qualquer outro ponto do mapa
    window.addEventListener('click', () => {
        $('mana-dropdown-list')?.classList.add('hidden');
        $('resources-dropdown-list')?.classList.add('hidden'); // <-- Adicione esta linha!
    });

}

// ==========================================
// 4. LOJA, GERENCIAMENTO E INVENTÁRIO
// ==========================================
function generateShopItems() {
    shopItems = [];
    let arts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : [];
    let bLvl = game && game.currentLevel ? game.currentLevel : 1;

    // ==========================================
    // 1. LOJA EXCLUSIVA DO MODO DUELO
    // ==========================================
    if (game && game.isDuel) {
        let tags = game.leaderData.tags || [];
        let pool = [...BEASTS.LAND, ...BEASTS.WATER, ...BEASTS.SNOW].filter(b => b.tags && b.tags.some(t => tags.includes(t)) && !b.minLevel);
        if (pool.length === 0) pool = BEASTS.LAND;

        // Gera 6 Contratos Exclusivos da Tag do Líder
        for (let i = 0; i < 6; i++) {
            let rB = pool[Math.floor(Math.random() * pool.length)];
            shopItems.push({
                name: `Contrato: ${rB.name}`, icon: rB.e, desc: `Adiciona ${rB.name} à Box.`, cost: 10, rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'consumable', filter: rB.filter || 'none',
                action: async () => {
                    // Mágica das Passivas no Duelo!
                    let newAbilities = [...(rB.abilities || [])];
                    let newTags = [...(rB.tags || [])];
                    let newFilter = rB.filter || 'none';

                    if (game && game.leaderData) {
                        if (game.leaderData.name === 'Piromante' && !newAbilities.includes('burn')) newAbilities.push('burn');
                        if (game.leaderData.name === 'Doutor da Praga' && !newTags.includes('POISON')) {
                            newTags.push('POISON');
                            newFilter = newFilter === 'none' ? 'sepia(100%) hue-rotate(50deg) saturate(200%)' : newFilter + ' sepia(100%) hue-rotate(50deg) saturate(200%)';
                        }
                    }

                    rosterMemory.push(new Unit({ q: 0, r: 0, faction: 1, isLeader: false, name: rB.name, baseName: rB.name, emoji: rB.e, hp: rB.hp, maxHp: rB.hp, mp: rB.mp, maxMp: rB.mp, atk: rB.atk, range: rB.range, level: 1, abilities: newAbilities, isNew: true, filter: newFilter, tags: newTags, fav: rB.fav || [] }));
                    return true;
                }
            });
        }

        shopItems.push({ name: "Fruta da Evolução", icon: "🍎", desc: "+100 XP a uma fera.", cost: 8, rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'consumable', filter: 'none', action: async () => { let m = [...rosterMemory, ...deployedRoster].filter(u => !u.isLeader); if (m.length === 0) { alert("Nenhuma fera!"); return false; } let r = await window.promptSelectUnit("Quem receberá XP?", m); if (r) { r.addXp(100); return true; } return false; } });

        let gearPool = ['SWORD', 'SHIELD', 'BOOTS', 'BOW'];
        let randomGear = gearPool.sort(() => Math.random() - 0.5).slice(0, 2);
        randomGear.forEach(gId => {
            let iDef = typeof ITEMS !== 'undefined' ? ITEMS[gId] : null;
            if (iDef) shopItems.push({ name: iDef.name, icon: iDef.icon, desc: iDef.desc, cost: 12, rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'equip', filter: 'none', action: async () => { game.inventory.push({ id: gId, level: 1 }); return true; } });
        });

        return; // ENCERRA A FUNÇÃO AQUI SE FOR DUELO
    }


    // ==========================================
    // 2. LOJA PADRÃO (CAMPANHA E ROGUELITE)
    // ==========================================
    const rB = BEASTS.LAND[Math.floor(Math.random() * BEASTS.LAND.length)];
    let bName = rB.name;
    let bAtk = rB.atk + (bLvl - 1) * 6;
    let bHp = rB.hp + (bLvl - 1) * 20;
    if (bLvl >= 2) {
        let evArr = EVOS[rB.name] || [rB.name + ' Alfa', rB.name + ' Supremo'];
        bName = bLvl === 2 ? evArr[0] : (evArr[1] || evArr[0]);
    }

    // A AÇÃO DE COMPRA DA FERA CORRIGIDA! Tudo acontece aqui dentro:
    shopItems.push({
        name: `Contrato: ${bName}`, icon: rB.e, desc: `Adiciona fera Lv${bLvl} à Box.`, cost: 10 + (bLvl * 2), rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'consumable', filter: rB.filter || 'none',
        action: async () => {
            let newAbilities = [...(rB.abilities || [])];
            let newTags = [...(rB.tags || [])];
            let newFilter = rB.filter || 'none';

            if (game && game.leaderData) {
                // --- PASSIVA DO PIROMANTE ---
                if (game.leaderData.name === 'Piromante' && !newAbilities.includes('burn')) {
                    newAbilities.push('burn');
                }

                // --- PASSIVA DO DOUTOR DA PRAGA ---
                if (game.leaderData.name === 'Doutor da Praga' && !newTags.includes('POISON')) {
                    newTags.push('POISON');
                    if (newFilter === 'none') {
                        newFilter = 'sepia(100%) hue-rotate(50deg) saturate(200%)';
                    } else {
                        newFilter += ' sepia(100%) hue-rotate(50deg) saturate(200%)';
                    }
                }
            }

            // Cria a unidade e envia para a Box SOMENTE quando o jogador pagar e clicar!
            rosterMemory.push(new Unit({
                q: 0, r: 0, faction: 1, isLeader: false,
                name: bName, baseName: rB.name, emoji: rB.e,
                hp: bHp, maxHp: bHp, mp: rB.mp, maxMp: rB.mp,
                atk: bAtk, range: rB.range, level: bLvl,
                abilities: newAbilities,
                isNew: true,
                filter: newFilter,
                tags: newTags,
                fav: rB.fav || []
            }));

            return true;
        }
    });


    // Contrato Épico (Chefe) - 15% de chance de aparecer na loja!
    if (Math.random() < 0.15) {
        let bossPool = BEASTS.BOSSES.filter(b => !b.minLevel || bLvl >= b.minLevel);
        if (bossPool.length > 0) {
            let rBoss = bossPool[Math.floor(Math.random() * bossPool.length)];
            let bossHp = rBoss.hp + ((bLvl - 1) * 30);
            let bossAtk = rBoss.atk + ((bLvl - 1) * 8);
            shopItems.push({
                name: `Contrato Épico: ${rBoss.name}`, icon: rBoss.e, desc: `Adiciona um CHEFE Lv${bLvl} à Box.`,
                cost: 40 + (bLvl * 5), rarity: 'legendary', color: '#ff00ff', type: 'consumable', filter: rBoss.filter || 'none',
                action: async () => { rosterMemory.push(new Unit({ q: 0, r: 0, faction: 1, isLeader: false, name: rBoss.name, baseName: rBoss.name, emoji: rBoss.e, hp: bossHp, maxHp: bossHp, mp: rBoss.mp, maxMp: rBoss.mp, atk: bossAtk, range: rBoss.range, level: bLvl, abilities: [...rBoss.abilities], isNew: true, filter: rBoss.filter, tags: rBoss.tags || [], fav: rBoss.fav || [], isBoss: true })); return true; }
            });
        }
        // Centro Comercial: 2 Mercados adjacentes = 30% OFF em tudo!
        if (typeof checkAdjacency === 'function' && checkAdjacency('MARKET', 'MARKET')) {
            shopItems.forEach(item => {
                item.cost = Math.max(1, Math.floor(item.cost * 0.7));
                item.name += " (Promoção)";
            });
        }
    }

    // Bônus do Estábulo
    if (typeof countKingdomBuildings === 'function') {
        let stableLvl = window.countKingdomBuildings('STABLE');
        if (stableLvl > 0) {
            let horse = BEASTS.LAND.find(b => b.name === 'Cavalo');
            if (horse) {
                let hLevel = Math.min(3, stableLvl); // Limita ao Nv3
                let hHp = horse.hp + ((hLevel - 1) * 20);
                let hAtk = horse.atk + ((hLevel - 1) * 6);
                let hName = horse.name;
                if (hLevel >= 2) {
                    let evArr = EVOS[horse.name] || [horse.name + ' Alfa', horse.name + ' Supremo'];
                    hName = hLevel === 2 ? evArr[0] : (evArr[1] || evArr[0]);
                }
                shopItems.push({
                    name: `Cavalo do Estábulo (Nv${hLevel})`, icon: horse.e, desc: `Adiciona um ${hName} Nv${hLevel} à Box.`,
                    cost: 10 + ((hLevel - 1) * 5), rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'consumable', filter: 'none',
                    action: async () => {
                        let u = new Unit({ q: 0, r: 0, faction: 1, isLeader: false, name: hName, baseName: horse.name, emoji: horse.e, hp: hHp, maxHp: hHp, mp: horse.mp, maxMp: horse.mp, atk: hAtk, range: horse.range, level: hLevel, abilities: [...horse.abilities], isNew: true, filter: horse.filter, tags: horse.tags || [], fav: horse.fav || [] });
                        rosterMemory.push(u); return true;
                    }
                });
            }
        }

    }

    // --- 2. CONSUMÍVEIS DE STATUS (Embaralha e pega 2 aleatórios por loja) ---
    let consumablesPool = [
        { name: "Fruta da Evolução", icon: "🍎", desc: "+100 XP a uma fera.", cost: 8, rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'consumable', filter: 'none', action: async () => { let m = [...rosterMemory, ...deployedRoster].filter(u => !u.isLeader); if (m.length === 0) { alert("Nenhuma fera em campo ou na Box!"); return false; } let r = await window.promptSelectUnit("Quem receberá +100 XP?", m); if (r) { r.addXp(100); return true; } return false; } },
        { name: "Frasco de Fúria", icon: "🧪", desc: "+5 ATK permanente (fera).", cost: 10, rarity: 'rare', color: 'var(--rarity-rare)', type: 'consumable', filter: 'hue-rotate(90deg)', action: async () => { let m = [...rosterMemory, ...deployedRoster].filter(u => !u.isLeader); if (m.length === 0) { alert("Nenhuma fera!"); return false; } let r = await window.promptSelectUnit("Quem receberá +5 ATK?", m); if (r) { r.atk += 5; return true; } return false; } },
        { name: "Grimório de Táticas", icon: "📘", desc: "+200 XP para o Herói Líder.", cost: 15, rarity: 'epic', color: 'var(--rarity-epic)', type: 'consumable', filter: 'none', action: async () => { let l = deployedRoster.find(u => u.isLeader); if (l) { l.addXp(200); return true; } return false; } },
        { name: "Poção de Exército", icon: "🧪", desc: "Cura 30 HP de todos.", cost: 4, rarity: 'common', color: 'var(--rarity-common)', type: 'consumable', filter: 'none', action: async () => { rosterMemory.forEach(u => u.hp = Math.min(u.maxHp, u.hp + 30)); deployedRoster.forEach(u => u.hp = Math.min(u.maxHp, u.hp + 30)); return true; } }
    ];
    consumablesPool.sort(() => Math.random() - 0.5).slice(0, 2).forEach(item => shopItems.push(item));

    // --- 3. ITENS DE CAMPO PARA MOCHILA (Embaralha e pega 2 aleatórios por loja) ---
    let fieldItemsPool = [
        { id: 'isca', name: 'Isca de Carne', icon: '🍖', desc: 'Atrai feras e dobra a chance de doma.', cost: 5, rarity: 'common', color: 'var(--rarity-common)' },
        { id: 'rede', name: 'Rede Hexagonal', icon: '🕸️', desc: 'Prende uma fera, quebrando sua vontade.', cost: 6, rarity: 'uncommon', color: 'var(--rarity-uncommon)' },
        { id: 'potion', name: 'Poção de Cura', icon: '🧪', desc: 'Cura 30 HP de um aliado no campo.', cost: 4, rarity: 'common', color: 'var(--rarity-common)' },
        { id: 'bandage', name: 'Atadura Médica', icon: '🩹', desc: 'Cura 15 HP e remove Veneno.', cost: 3, rarity: 'common', color: 'var(--rarity-common)' },
        { id: 'scroll', name: 'Pergaminho Arcano', icon: '📜', desc: 'Causa 25 de dano mágico.', cost: 8, rarity: 'rare', color: 'var(--rarity-rare)' },
        { id: 'sphere', name: 'Esfera Elemental', icon: '🔮', desc: 'Aplica status negativo num inimigo.', cost: 7, rarity: 'rare', color: 'var(--rarity-rare)' },
        { id: 'adrenalina', name: 'Frasco de Adrenalina', icon: '💉', desc: 'Concede turno extra a um aliado.', cost: 15, rarity: 'epic', color: 'var(--rarity-epic)' },
        { id: 'apito', name: 'Apito Ancestral', icon: '🪈', desc: 'Doma livre (1x ao turno). Risco alto de contra-ataque!', cost: 15, rarity: 'epic', color: 'var(--rarity-epic)' },
        { id: 'trap_stun', name: 'Armadilha Atordoante', icon: '⚡', desc: 'Atordoa quem pisar nela.', cost: 8, rarity: 'uncommon', color: 'var(--rarity-uncommon)' },
        { id: 'trap_teleport', name: 'Armadilha de Teleporte', icon: '🌀', desc: 'Teleporta o alvo aleatoriamente.', cost: 10, rarity: 'rare', color: 'var(--rarity-rare)' },
        { id: 'silence', name: 'Selo de Silêncio', icon: '🔕', desc: 'Bloqueia magias e doma do alvo.', cost: 8, rarity: 'uncommon', color: 'var(--rarity-uncommon)' }
    ];
    fieldItemsPool.sort(() => Math.random() - 0.5).slice(0, 2).forEach(fi => {
        shopItems.push({
            name: fi.name, icon: fi.icon, desc: fi.desc, cost: fi.cost, rarity: fi.rarity, color: fi.color, type: 'consumable', filter: 'none',
            action: async () => {
                if (!game.fieldItems) game.fieldItems = { isca: 0, rede: 0, potion: 0, bandage: 0, scroll: 0, sphere: 0 };
                game.fieldItems[fi.id] = (game.fieldItems[fi.id] || 0) + 1;
                return true;
            }
        });
    });

    // --- 4. EQUIPAMENTOS (Embaralha e pega 2 para irem direto para o Inventário) ---
    let gearPool = ['RUSTY_SWORD', 'WOODEN_SHIELD', 'SWORD', 'SHIELD', 'BOOTS', 'BOW', 'WINGS_ICARUS', 'CATALYST'];
    let randomGear = gearPool.sort(() => Math.random() - 0.5).slice(0, 2);
    randomGear.forEach(gId => {
        let iDef = typeof ITEMS !== 'undefined' ? ITEMS[gId] : null;
        if (iDef) {
            shopItems.push({
                name: iDef.name, icon: iDef.icon, desc: iDef.desc, cost: 12, rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'equip', filter: 'none',
                action: async () => {
                    game.inventory.push({ id: gId, level: 1 });
                    return true;
                }
            });
            // ==========================================
            // NOVO: PERGAMINHOS DE RECEITA NO MERCADO (CORRIGIDO)
            // ==========================================
            if (typeof RECIPES !== 'undefined') {
                Object.keys(RECIPES).forEach(key => {
                    let rec = RECIPES[key];

                    // TRAVA DE SEGURANÇA: Só tenta ler a mochila se o jogo e a mochila já existirem!
                    let hasInBag = false;
                    if (typeof game !== 'undefined' && game && game.inventory) {
                        hasInBag = game.inventory.some(i => i.isScroll && i.recipeKey === key);
                    }

                    if (rec.isLocked && !hasInBag && Math.random() < 0.4) {
                        shopItems.push({
                            name: `Planta: ${rec.name}`, icon: '📜', desc: `Aprenda a forjar: ${rec.name}`, cost: 40, rarity: 'rare', color: 'var(--rarity-rare)', type: 'consumable', filter: 'none',
                            action: async () => {
                                // Garante que a mochila existe na hora de entregar o item
                                if (typeof game !== 'undefined' && game && game.inventory) {
                                    game.inventory.push({ id: `SCROLL_${key}`, isScroll: true, recipeKey: key, level: 1 });
                                }
                                return true;
                            }
                        });
                    }
                });
            }
        }
    });

    // --- 5. ARTEFATOS (Apenas 1 por loja, sem repetir) ---
    let aA = ARTIFACTS.filter(a => !arts.includes(a.id) && a.id !== 'art_omega').sort(() => Math.random() - 0.5);
    for (let i = 0; i < 1; i++) {
        if (aA[i]) {
            let art = aA[i];
            shopItems.push({
                name: art.name, icon: art.icon, desc: art.desc, cost: art.cost, rarity: art.rarity, color: art.color, type: 'artifact', filter: 'none', action: async () => {
                    let myA = getActiveArtifacts(); myA.push(art.id);
                    localStorage.setItem(game.isRoguelite ? 'ht_artifacts_rogue' : 'ht_artifacts_camp', JSON.stringify(myA));
                    if (art.id === 'art_hp') { rosterMemory.forEach(u => { u.maxHp += 15; u.hp += 15; }); deployedRoster.forEach(u => { u.maxHp += 15; u.hp += 15; }); }
                    if (art.id === 'art_atk') { rosterMemory.forEach(u => u.atk += 8); deployedRoster.forEach(u => u.atk += 8); }
                    if (art.id === 'art_move') { let l = deployedRoster.find(u => u.isLeader); if (l) { l.maxMp++; l.mp++; } }
                    if (art.id === 'art_crystal') { let l = deployedRoster.find(u => u.isLeader); if (l) { l.range++; l.atk += 5; } }
                    if (art.id === 'art_umbral_seal') { deployedRoster.forEach(u => { if (!u.tags.includes('UMBRAL')) u.tags.push('UMBRAL'); }); }
                    if (art.id === 'art_celestial_seal') { deployedRoster.forEach(u => { if (!u.tags.includes('CELESTIAL')) u.tags.push('CELESTIAL'); }); }
                    await showZeldaPopup(art.icon, `Novo Artefato!`, `${art.name}: ${art.desc}`);
                    return true;
                }
            });
        }
    }

    // Centro Comercial: 2 Mercados adjacentes = 30% OFF em tudo!
    if (typeof checkAdjacency === 'function' && checkAdjacency('MARKET', 'MARKET')) {
        shopItems.forEach(item => {
            item.cost = Math.max(1, Math.floor(item.cost * 0.7));
            item.name += " (Promoção)";
        });
    }
}

function renderShop() {
    const grid = $('shop-grid'); grid.innerHTML = '';
    shopItems.forEach((item, index) => {
        const card = document.createElement('div'); card.className = `shop-card`; card.style.borderColor = item.color; let tB = item.type === 'artifact' ? 'Artefato' : 'Consumível';
        card.innerHTML = `<div><span class="shop-icon" style="filter:${item.filter}">${item.icon}</span><div class="shop-title" style="color:${item.color}">${item.name}</div><div style="font-size:9px;color:#888;text-transform:uppercase;margin-bottom:6px;">${tB}</div><div class="shop-desc">${item.desc}</div></div><button id="btn-buy-${index}" style="margin-top:10px;border-color:${item.color}">Comprar (-${item.cost}💰)</button>`;
        grid.appendChild(card);
        $(`btn-buy-${index}`).onclick = async function () { if (game.gold >= item.cost) { let res = await item.action(); if (res !== false) { game.gold -= item.cost; $('shop-gold-display').innerText = game.gold; this.innerText = "Comprado"; this.disabled = true; this.style.borderColor = "var(--success)"; this.style.color = "var(--success)"; } } else { alert("Ouro insuficiente!"); } };
    });
}

function openShop() { hide('result-screen'); show('shop-screen'); $('shop-gold-display').innerText = game.gold; generateShopItems(); renderShop(); }

function calculateSynergies(roster) { let counts = {}; roster.forEach(u => { (u.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }); }); return counts; }

function renderManagement(mode = 'prep') {
    let isBattle = (mode === 'battle');
    let readOnly = (mode === 'readonly');

    let arts = getActiveArtifacts();
    let maxLimit = window.getMaxBoxLimit();
    $('mgmt-limit').innerText = `${deployedRoster.filter(u => !u.isLeader).length}/${maxLimit}`;

    const invGrid = $('mgmt-inv-grid');
    if (invGrid) {
        game.inventory.forEach((item, idx) => {
            // Puxa a definição correta do item ou pergaminho
            let iDef = item.isScroll ? { icon: '📜', name: `Planta: ${RECIPES[item.recipeKey].name}` } : ITEMS[item.id];
            if (!iDef) return;

            let el = document.createElement('div');
            el.className = 'beast-card unlocked';
            el.style.padding = '8px';
            if (selectedInventoryIndex === idx) el.style.borderColor = 'var(--success)';

            // Renderiza o visual na grade
            let lvlStr = item.isScroll ? `<span style="color:#aaa;">Consumível</span>` : `Lv${item.level}`;
            el.innerHTML = `<span style="font-size:24px;">${iDef.icon}</span><div style="font-size:9px; color:var(--gold);">${lvlStr}</div>`;

            el.onclick = () => {
                if (typeof readOnly !== 'undefined' && readOnly) return;

                if (item.isScroll) {
                    if (typeof useRecipeScroll === 'function') useRecipeScroll(item.recipeKey, idx);
                } else {
                    // Direciona o jogador para a mecânica correta
                    showMessage("Clique em um personagem para gerenciar equipamentos!", '#f39c12');
                }
            };

            invGrid.appendChild(el);
        });
    }

    const renderBeast = (u, container, isBox) => {
        let card = document.createElement('div');
        card.className = 'beast-card unlocked';
        card.style.background = u.isLeader ? 'rgba(40,30,10,0.9)' : 'rgba(20,16,8,.8)';
        card.style.paddingBottom = "18px";

        let tagsHtml = `<div style="margin-top:4px;display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">${(u.tags || []).map(t => getTagHTML(t)).join('')}</div>`;

        let equipsHtml = '';
        (u.equipment || []).forEach((eq, eqIdx) => {
            let eqDef = ITEMS[eq.id];
            equipsHtml += `<span class="equip-badge" data-idx="${eqIdx}" style="cursor:pointer; background:rgba(0,0,0,0.5); padding:2px; border-radius:3px; border:1px solid #555; margin-right: 2px;">${eqDef.icon}<span style="font-size:7px;color:var(--gold);">Lv${eq.level}</span></span>`;
        });

        let starIcon = u.starLevel === 2 ? '🥉' : u.starLevel === 3 ? '🥈' : u.starLevel >= 4 ? '🌟' : '';
        card.innerHTML = `<span class="beast-icon" style="filter:${u.filter}">${u.emoji}</span><div class="beast-name">${u.name} <span style="color:#c9a227">Lv${u.level}${starIcon}</span></div><div class="beast-stats">HP:${u.hp}/${u.maxHp} | ATK:${u.atk}</div>${tagsHtml}<div class="unit-equip-icons" style="bottom:2px; left:0; width:100%; position:absolute;">${equipsHtml}</div>`;

        card.onclick = (e) => {
            if (readOnly) return;
            // Agora o clique abre a interface de personagem ao invés de mover pro time automaticamente
            openCharacterScreen(u, isBox, mode);
        }
        container.appendChild(card);
    };

    let depGrid = $('mgmt-deploy-grid'); depGrid.innerHTML = '';
    deployedRoster.forEach(u => renderBeast(u, depGrid, false));

    let boxGrid = $('mgmt-box-grid'); boxGrid.innerHTML = '';
    rosterMemory.forEach(u => renderBeast(u, boxGrid, true));

    let synList = $('mgmt-synergy-list'); synList.innerHTML = '';
    let sys = calculateSynergies(deployedRoster);
    Object.keys(TAGS).forEach(tag => {
        let tData = TAGS[tag]; let count = sys[tag] || 0;
        if (count > 0) { let active = count >= tData.req; let el = document.createElement('div'); el.className = 'syn-item'; el.innerHTML = `<span style="color:${tData.col};${active ? 'font-weight:bold;text-shadow:0 0 5px ' + tData.col : ''}">${tData.name} (${count}/${tData.req})</span><span style="font-size:9px;flex:1;text-align:right;margin-left:10px;color:${active ? '#fff' : '#666'}">${tData.desc}</span>`; synList.appendChild(el); }
    });
}

function openManagement() {
    hide('shop-screen');
    show('management-screen');
    hide('btn-close-team');
    show('btn-start-stage');

    // CORREÇÃO: Declaramos a variável 'btn' antes de tentar mudar o texto dela!
    const btn = $('btn-start-stage');
    if (btn) {
        btn.innerText = "Avançar Combate →";
        btn.onclick = () => { advanceCampaign(); };
    }

    renderManagement('prep');
}

function openTeamView() {
    if (game && !game.gameOver) {
        deployedRoster = game.units.filter(u => u.faction === 1);
    }
    const pm = $('pause-menu'); if (pm) pm.classList.add('hidden');
    show('management-screen');
    hide('btn-start-stage');
    show('btn-close-team');
    renderManagement('battle');
}

// ==========================================
// 5. TELAS EXTRAS (Seleção, Bestiário, Relicário)
// ==========================================
function openLeaderSelection(isRoguelite, isDuel = false, pickingOpponentFor = null) {
    $('mode-screen').classList.add('hidden');
    const leaderScreen = $('leader-selection');
    leaderScreen.classList.remove('hidden');

    // Busca o título existente ou cria um novo corretamente
    let titleEl = leaderScreen.querySelector('h2');
    if (!titleEl) {
        titleEl = document.createElement('h2');
        leaderScreen.insertBefore(titleEl, leaderScreen.firstChild);
    }
    titleEl.style.cssText = 'text-align:center; color:var(--gold); font-family:Cinzel,serif; margin-bottom:10px;';
    titleEl.innerText = pickingOpponentFor ? "Selecione o Líder Adversário" : "Selecione seu Líder";

    // Remove o filtro antigo se existir
    let oldFilter = $('leader-filter-container');
    if (oldFilter) oldFilter.remove();

    // Puxa as tags de todos os líderes
    let allTags = new Set();
    LEADERS.forEach(l => { (l.tags || []).forEach(t => allTags.add(t)); });
    let uniqueTags = Array.from(allTags).sort();

    // Cria a UI dos botões de Tag (Tag Cloud)
    let filterDiv = document.createElement('div');
    filterDiv.id = 'leader-filter-container';
    filterDiv.style.cssText = 'display:flex; flex-wrap:wrap; justify-content:center; gap:6px; margin-bottom:15px; width: 100%;';

    const container = $('leader-list');
    leaderScreen.insertBefore(filterDiv, container);

    let activeFilter = 'ALL';

    // Função que redesenha os botões do filtro para mostrar qual está "Aceso"
    const updateFilterUI = () => {
        filterDiv.innerHTML = '';

        // Botão "TODOS"
        let allBtn = document.createElement('div');
        allBtn.innerHTML = '✦ TODOS';
        let allIsActive = activeFilter === 'ALL';
        allBtn.style.cssText = `background:rgba(20,20,30,0.9); border:1px solid var(--gold-light); color:var(--gold-light); font-size:10px; padding:4px 8px; border-radius:4px; cursor:pointer; text-shadow:0 0 2px var(--gold); opacity:${allIsActive ? '1' : '0.4'}; box-shadow:${allIsActive ? '0 0 8px var(--gold-dark)' : 'none'}; transition:all 0.2s ease;`;
        allBtn.onclick = () => { activeFilter = 'ALL'; renderList(); updateFilterUI(); };
        filterDiv.appendChild(allBtn);

        // Gera as Tags Estilizadas Dinamicamente
        uniqueTags.forEach(t => {
            let tDef = typeof TAGS !== 'undefined' ? TAGS[t] : null;
            let col = tDef ? tDef.col : '#888';
            let tName = tDef ? tDef.name : t;
            let isActive = activeFilter === t;

            let tagBtn = document.createElement('div');
            tagBtn.innerHTML = tName;
            tagBtn.style.cssText = `background:rgba(20,20,30,0.9); border:1px solid ${col}; color:${col}; font-size:10px; padding:4px 8px; border-radius:4px; cursor:pointer; box-shadow:${isActive ? '0 0 10px ' + col : '0 0 2px ' + col + '40'}; text-shadow:0 0 2px ${col}80; opacity:${isActive ? '1' : '0.4'}; transition:all 0.2s ease;`;

            tagBtn.onclick = () => { activeFilter = t; renderList(); updateFilterUI(); };
            filterDiv.appendChild(tagBtn);
        });
    };

    // Função que lista os líderes de acordo com o filtro selecionado
    const renderList = () => {
        container.innerHTML = '';
        let filteredLeaders = LEADERS;

        if (activeFilter !== 'ALL') {
            filteredLeaders = LEADERS.filter(l => (l.tags || []).includes(activeFilter));
        }

        filteredLeaders.forEach(l => {
            const btn = document.createElement('button');
            let gTags = l.tags || [];
            if (typeof LEADER_GRIMOIRE_TAGS !== 'undefined' && LEADER_GRIMOIRE_TAGS[l.id]) {
                gTags = LEADER_GRIMOIRE_TAGS[l.id];
            }
            const grimTags = gTags.map(t => getTagHTML(t)).join('');

            btn.style.cssText = 'display:block; width:100%; text-align:left; background:rgba(20,20,30,0.8); border:1px solid #444; border-radius:8px; padding:12px; margin-bottom:10px; cursor:pointer; transition:border 0.2s, background 0.2s;';
            btn.onmouseover = () => { btn.style.borderColor = 'var(--gold-light)'; btn.style.background = 'rgba(40,30,10,0.9)'; };
            btn.onmouseout = () => { btn.style.borderColor = '#444'; btn.style.background = 'rgba(20,20,30,0.8)'; };

            btn.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                    <span style="font-size:42px; filter:${l.filter || 'none'}; text-shadow: 2px 2px 5px #000;">${l.emoji}</span>
                    <div style="font-size:18px; color:var(--gold-light); font-weight:bold;">${l.name}</div>
                </div>
                <div style="font-size:12px; text-transform:none; color:#aaa; font-weight:normal; margin-bottom:8px; line-height:1.4;">${l.desc}</div>
                <div style="display:flex; flex-wrap:wrap; gap:3px;">${grimTags}</div>
            `;

            btn.onclick = () => {
                if (isDuel && !pickingOpponentFor) {
                    // Selecionou o Jogador, agora reabre para escolher o Inimigo!
                    openLeaderSelection(false, true, l.id);
                } else {
                    $('leader-selection').classList.add('hidden');
                    // Se for duelo, passa o jogador e o oponente.
                    startGame(false, isRoguelite, pickingOpponentFor || l.id, isDuel, pickingOpponentFor ? l.id : null);
                }
            };
            container.appendChild(btn);
        });

        if (filteredLeaders.length === 0) {
            container.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px; font-style:italic;">Nenhum líder encontrado com essa especialidade.</div>';
        }
    };

    // Inicia os estados
    updateFilterUI();
    renderList();

    $('btn-close-leader').onclick = () => {
        $('leader-selection').classList.add('hidden');
        $('mode-screen').classList.remove('hidden');
    };
}

function openBestiary() {
    $('main-menu').classList.add('hidden'); $('bestiary-screen').classList.remove('hidden');
    const grid = $('bestiary-grid'); grid.innerHTML = '';
    const uniqueBeasts = []; const seen = new Set();
    ALL_BEASTS.forEach(b => { if (!seen.has(b.name)) { seen.add(b.name); uniqueBeasts.push(b); } });
    uniqueBeasts.forEach(b => {
        const isUnlocked = unlockedBeasts.includes(b.name);
        const card = document.createElement('div'); card.className = `beast-card ${isUnlocked ? 'unlocked' : 'locked'}`;
        const icon = `<span class="beast-icon ${!isUnlocked ? 'locked-icon' : ''}" style="filter:${isUnlocked ? (b.filter || 'none') : 'none'}">${b.e}</span>`;
        const name = `<div class="beast-name">${isUnlocked ? b.name : '???'}</div>`;
        const stats = isUnlocked ? `<div class="beast-stats">HP:${b.hp}|ATK:${b.atk}<br>Alc:${b.range}|Mov:${b.mp}</div>` : `<div class="beast-stats">Desconhecido</div>`;
        const tags = isUnlocked ? `<div style="margin-top:4px;display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">${(b.tags || []).map(t => getTagHTML(t)).join('')}</div>` : '';
        card.innerHTML = icon + name + stats + tags;
        if (isUnlocked) card.onclick = () => showBeastDetails(b);
        grid.appendChild(card);
    });
}

function openReliquary(fromPause = false) {
    $('main-menu').classList.add('hidden'); $('reliquary-screen').classList.remove('hidden');
    const grid = $('reliquary-grid'); grid.innerHTML = ''; let arts = [];
    if (fromPause && game) { $('btn-toggle-reliquary').classList.add('hidden'); arts = getActiveArtifacts(); $('reliquary-subtitle').innerText = game.isRoguelite ? "Artefatos Atuais (Roguelite)" : "Artefatos Atuais (Campanha)"; }
    else { $('btn-toggle-reliquary').classList.remove('hidden'); arts = reliquaryViewMode === 'camp' ? activeArtifactsCamp : activeArtifactsRogue; $('reliquary-subtitle').innerText = reliquaryViewMode === 'camp' ? "Todos os Artefatos (Campanha)" : "Todos os Artefatos (Roguelite)"; $('btn-toggle-reliquary').innerText = reliquaryViewMode === 'camp' ? "🔄 Ver Roguelite" : "🔄 Ver Campanha"; }
    if (arts.length === 0) { grid.innerHTML = '<div style="color:#aaa;grid-column:1/-1;text-align:center;padding:20px;">Nenhum artefato adquirido neste modo.</div>'; return; }
    arts = [...new Set(arts)];
    ARTIFACTS.forEach(art => { if (arts.includes(art.id)) { const card = document.createElement('div'); card.className = `shop-card rarity-${art.rarity}`; card.style.borderColor = art.color; card.innerHTML = `<span class="shop-icon">${art.icon}</span><div class="shop-title" style="color:${art.color}">${art.name}</div><div class="shop-desc" style="margin-bottom:0;">${art.desc}</div>`; grid.appendChild(card); } });
}

// ==========================================
// 6. MAPA DE ROTAS E EVENTOS
// ==========================================

// NOVO: Função do Laboratório Quimérico
async function openLaboratory() {
    $('ev-icon').innerText = '🧬';
    $('ev-title').innerText = 'Laboratório Quimérico';
    $('ev-desc').innerText = `Crie abominações perfeitas fundindo ou evoluindo suas feras.\nVocê possui: ${game.dna || 0} 🧬 DNA.`;

    const opts = $('ev-options');
    opts.innerHTML = '';

    // COMBINAÇÃO
    const btnComb = document.createElement('button');
    btnComb.className = 'event-choice-btn';
    btnComb.innerHTML = `<div class="event-choice-title">Combinação (Custo: 2 🧬)</div><div class="event-choice-desc">Sacrifica uma cópia exata para aumentar a Estrela 🌟 da fera base (+Status).</div>`;
    btnComb.disabled = (game.dna || 0) < 2;
    btnComb.onclick = async () => {
        let m = [...rosterMemory, ...deployedRoster].filter(u => !u.isLeader);
        let base = await window.promptSelectUnit("Selecione a Fera Base", m);
        if (!base) return;
        let copies = m.filter(u => u !== base && u.baseName === base.baseName);
        if (copies.length === 0) { alert("Você não possui nenhuma cópia desta fera!"); openLaboratory(); return; }
        let sac = await window.promptSelectUnit("Selecione o Sacrifício", copies);
        if (!sac) { openLaboratory(); return; }

        game.dna -= 2;
        base.starLevel = (base.starLevel || 1) + 1;
        base.maxHp += Math.floor(sac.maxHp * 0.5);
        base.hp = base.maxHp;
        base.atk += Math.floor(sac.atk * 0.5);

        let unlockMsg = "";

        // --- SISTEMA DE COMBINAÇÃO AVANÇADA (SKILL TREE) ---
        let pTag = (base.tags && base.tags.length > 0) ? base.tags[0] : null;

        if (base.starLevel === 2 && pTag) {
            if (!base.knownSpells) base.knownSpells = [];
            let sp1 = SPELLS.filter(s => s.level === 1 && s.tags.includes(pTag));
            sp1.forEach(s => { if (!base.knownSpells.includes(s.id)) base.knownSpells.push(s.id); });
            unlockMsg = "\n✨ Magias Nv1 Liberadas (Custo: 0)!";
        }
        else if (base.starLevel === 3 && pTag) {
            let tagAbilities = {
                'FIRE': 'burn', 'ICE': 'freeze', 'VENOM': 'poison', 'ROCK': 'counter', 'SAND': 'dodge',
                'CARAPACE': 'counter', 'WING': 'swift', 'SILVESTRE': 'swift', 'UMBRAL': 'lifesteal',
                'CELESTIAL': 'leadership', 'PRIMAL': 'corte_amplo', 'STALKER': 'hit_run', 'ABYSSAL': 'dodge'
            };
            let newAb = tagAbilities[pTag] || 'pierce';
            if (!base.abilities.includes(newAb)) base.abilities.push(newAb);
            unlockMsg = `\n🧬 Nova Passiva de Elite Adquirida!`;
        }
        else if (base.starLevel >= 4 && pTag && base.starLevel === 4) {
            if (!base.knownSpells) base.knownSpells = [];
            let tagUltimates = {
                'FIRE': 'sl_meteor', 'ICE': 'sl_world_freeze', 'VENOM': 'sl_mass_venom', 'ROCK': 'sl_sandstorm', 'SAND': 'sl_sandstorm',
                'CARAPACE': 'sl_primal_rage', 'WING': 'sl_storm_wing', 'SILVESTRE': 'sl_regen', 'UMBRAL': 'sl_apocalypse',
                'CELESTIAL': 'sl_resurrection', 'PRIMAL': 'sl_primal_rage', 'STALKER': 'sl_shadow_step', 'ABYSSAL': 'sl_tidal_wave'
            };
            let newUlt = tagUltimates[pTag] || 'sl_meteor';
            if (!base.knownSpells.includes(newUlt)) base.knownSpells.push(newUlt);
            unlockMsg = `\n🔥 Magia ULTIMATE Liberada!`;
        }

        if (rosterMemory.includes(sac)) rosterMemory.splice(rosterMemory.indexOf(sac), 1);
        if (deployedRoster.includes(sac)) deployedRoster.splice(deployedRoster.indexOf(sac), 1);

        alert(`Sucesso! ${base.name} alcançou Estrela ${base.starLevel}!${unlockMsg}`);
        openLaboratory();
    };
    opts.appendChild(btnComb);

    // FUSÃO
    const btnFus = document.createElement('button');
    btnFus.className = 'event-choice-btn';
    btnFus.innerHTML = `<div class="event-choice-title">Fusão Sombria (Custo: 3 🧬)</div><div class="event-choice-desc">Sacrifica qualquer fera para transferir 1 Tag, 1 Habilidade e Status para a base.</div>`;
    btnFus.disabled = (game.dna || 0) < 3;
    btnFus.onclick = async () => {
        let m = [...rosterMemory, ...deployedRoster].filter(u => !u.isLeader);
        let base = await window.promptSelectUnit("Selecione o Hospedeiro", m);
        if (!base) return;
        let sacs = m.filter(u => u !== base);
        if (sacs.length === 0) { alert("Não há feras suficientes para sacrificar."); openLaboratory(); return; }
        let sac = await window.promptSelectUnit("Selecione o Sacrifício", sacs);
        if (!sac) { openLaboratory(); return; }

        game.dna -= 3;
        base.maxHp += Math.floor(sac.maxHp * 0.3);
        base.hp += Math.floor(sac.maxHp * 0.3);
        base.atk += Math.floor(sac.atk * 0.3);

        let newTags = sac.tags.filter(t => !base.tags.includes(t));
        if (newTags.length > 0) base.tags.push(newTags[Math.floor(Math.random() * newTags.length)]);

        let newAbs = sac.abilities.filter(a => !base.abilities.includes(a));
        if (newAbs.length > 0) base.abilities.push(newAbs[Math.floor(Math.random() * newAbs.length)]);

        if (rosterMemory.includes(sac)) rosterMemory.splice(rosterMemory.indexOf(sac), 1);
        if (deployedRoster.includes(sac)) deployedRoster.splice(deployedRoster.indexOf(sac), 1);

        alert(`Fusão Concluída! ${base.name} absorveu ${sac.name}.`);
        openLaboratory();
    };
    opts.appendChild(btnFus);

    // SAIR
    const btnLeave = document.createElement('button');
    btnLeave.className = 'event-choice-btn';
    btnLeave.innerHTML = `<div class="event-choice-title">Sair do Laboratório</div><div class="event-choice-desc">Voltar para o mapa.</div>`;
    btnLeave.onclick = () => {
        hide('event-screen');
        renderRouteMap();
    };
    opts.appendChild(btnLeave);

    hide('management-screen');
    hide('route-map-screen');
    show('event-screen');
}

function showRandomEvent() {
    let ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    $('ev-icon').innerText = ev.icon || '❓';
    $('ev-title').innerText = ev.title;
    $('ev-desc').innerText = ev.desc;
    const opts = $('ev-options');
    opts.innerHTML = '';

    ev.choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'event-choice-btn';
        btn.innerHTML = `<div class="event-choice-title">${c.text}</div><div class="event-choice-desc">${c.desc}</div>`;
        if (!c.req()) btn.disabled = true;

        btn.onclick = async () => {
            await c.action();
            hide('event-screen');
            renderRouteMap();
        };
        opts.appendChild(btn);
    });

    hide('management-screen');
    hide('route-map-screen');
    show('event-screen');
}

function generateRouteMap() {
    const map = [];
    const numFloors = 8; // Total de andares até o Boss

    // 1. Geração de Nós (Roteiro Fixo Tensão/Alívio para AMBOS os modos)
    for (let i = 0; i < numFloors; i++) {
        let numNodes = (i === numFloors - 1) ? 1 : 3;
        let floor = [];

        for (let j = 0; j < numNodes; j++) {
            let type = 'BATTLE';

            // Andar 0: Batalha Inicial
            // Andar 1: Respiro (Evento/Loja/Lab)
            // Andar 2: Batalha ou Elite
            // Andar 3: Respiro (Evento/Loja/Lab)
            // Andar 4: Batalha ou Elite
            // Andar 5: Respiro + Tesouro
            // Andar 6: Elite (Mini-Boss de preparo) ou Tesouro
            // Andar 7: Boss
            if (i === 0) {
                type = 'BATTLE';
            } else if (i === 1 || i === 3) {
                const pool = ['EVENT', 'SHOP', 'LAB'];
                type = pool[Math.floor(Math.random() * pool.length)];
            } else if (i === 2 || i === 4) {
                type = Math.random() < 0.7 ? 'BATTLE' : 'ELITE';
            } else if (i === 5) {
                const pool = ['EVENT', 'SHOP', 'LAB', 'TREASURE'];
                type = pool[Math.floor(Math.random() * pool.length)];
            } else if (i === 6) {
                type = j === 1 ? 'TREASURE' : 'ELITE';
            } else if (i === 7) {
                type = 'BOSS';
            }

            floor.push({ id: `f${i}_n${j}`, floor: i, pos: j, type: type, next: [], status: i === 0 ? 'reachable' : 'locked' });
        }
        map.push(floor);
    }

    // 2. Travas de Segurança (Garante que todo andar de respiro tenha opções vitais)
    [1, 3, 5].forEach(fIdx => {
        let floor = map[fIdx];
        if (!floor.some(n => n.type === 'SHOP')) floor[0].type = 'SHOP'; // Força Loja na esquerda
        if (!floor.some(n => n.type === 'LAB')) floor[2].type = 'LAB';   // Força Lab na direita
    });

    // 3. Criação das conexões (As teias de aranha entre os nós)
    for (let i = 0; i < numFloors - 1; i++) {
        let currentFloor = map[i];
        let nextFloor = map[i + 1];
        currentFloor.forEach((node, j) => {
            if (nextFloor.length === 1) { node.next.push(nextFloor[0].id); }
            else {
                node.next.push(nextFloor[j].id);
                // 40% de chance de cruzar caminhos com os nós dos lados
                if (j > 0 && Math.random() < 0.4) node.next.push(nextFloor[j - 1].id);
                if (j < nextFloor.length - 1 && Math.random() < 0.4) node.next.push(nextFloor[j + 1].id);
            }
        });
    }

    game.routeMap = map;
    game.currentFloor = -1;
}

function renderRouteMap() {
    const container = $('map-nodes-container');
    const svg = $('map-lines');
    container.innerHTML = '';
    svg.innerHTML = '';

    const nodeElements = {};
    game.routeMap.forEach(floor => {
        const floorDiv = document.createElement('div');
        floorDiv.className = 'map-floor';

        floor.forEach(node => {
            const nType = NODE_TYPES[node.type];
            const btn = document.createElement('div');
            btn.className = `map-node ${node.status}`;
            btn.id = `node_${node.id}`;
            btn.innerHTML = `${nType.icon}<div class="node-name" style="color:${nType.color}">${nType.name}</div>`;

            if (node.status === 'reachable') {
                btn.onclick = () => activateNode(node);
            }

            floorDiv.appendChild(btn);
            nodeElements[node.id] = { el: btn, data: node };
        });
        container.appendChild(floorDiv);
    });

    setTimeout(() => {
        const svgRect = svg.getBoundingClientRect();
        let linesHTML = '';
        game.routeMap.forEach(floor => {
            floor.forEach(node => {
                const startEl = $(`node_${node.id}`);
                node.next.forEach(nextId => {
                    const endEl = $(`node_${nextId}`);
                    if (startEl && endEl) {
                        const sRect = startEl.getBoundingClientRect();
                        const eRect = endEl.getBoundingClientRect();
                        const sx = sRect.left - svgRect.left + (sRect.width / 2);
                        const sy = sRect.top - svgRect.top + (sRect.height / 2);
                        const ex = eRect.left - svgRect.left + (eRect.width / 2);
                        const ey = eRect.top - svgRect.top + (eRect.height / 2);

                        let isActiveLine = (node.status === 'completed' && nodeElements[nextId].data.status !== 'locked');
                        let lineClass = isActiveLine ? 'map-line active' : 'map-line';

                        linesHTML += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" class="${lineClass}"></line>`;
                    }
                });
            });
        });
        svg.innerHTML = linesHTML;
    }, 100);

    hide('game-container');
    hide('result-screen');
    hide('management-screen');
    hide('shop-screen');
    show('route-map-screen');
}

async function activateNode(node) {
    game.routeMap.forEach(floor => floor.forEach(n => {
        if (n.status === 'reachable') n.status = 'locked';
    }));
    node.status = 'completed';
    game.currentFloor = node.floor;
    game.currentRouteType = node.type;

    node.next.forEach(nextId => {
        let nData = game.routeMap.flat().find(x => x.id === nextId);
        if (nData) nData.status = 'reachable';
    });

    autoSave();
    hide('route-map-screen');

    if (!game.eventFlags) game.eventFlags = {};

    if (node.type === 'BATTLE' || node.type === 'ELITE' || node.type === 'BOSS') {
        if (node.type === 'BATTLE') game.eventFlags.easyBattle = true;
        if (node.type === 'ELITE') game.eventFlags.eliteNode = true;
        if (node.type === 'BOSS') game.isBossStage = true;

        openManagement();
    }
    else if (node.type === 'EVENT') { showRandomEvent(); }
    else if (node.type === 'TREASURE') {
        let lockedKeys = typeof RECIPES !== 'undefined' ? Object.keys(RECIPES).filter(k => RECIPES[k].isLocked && !game.inventory.some(i => i.isScroll && i.recipeKey === k)) : []; if (lockedKeys.length > 0 && Math.random() < 0.5) { // 50% de chance de ser uma Planta
            let rKey = lockedKeys[Math.floor(Math.random() * lockedKeys.length)];
            game.inventory.push({ id: `SCROLL_${rKey}`, isScroll: true, recipeKey: rKey, level: 1 });
            if (typeof showZeldaPopup === 'function') await showZeldaPopup('📜', "Planta Encontrada!", `Você achou o projeto arcano para: ${RECIPES[rKey].name}`);
        } else {
            await window.giveRandomArtifact('rare');
        }
        renderRouteMap();
    }
    else if (node.type === 'SHOP') {
        openShop();
        const btnL = $('btn-leave-shop');
        if (btnL) {
            btnL.innerText = "Voltar ao Mapa →";
            btnL.onclick = () => { renderRouteMap(); };
        }
    }
    // CHAMA O NOVO LABORATÓRIO!
    else if (node.type === 'LAB') {
        openLaboratory();
    }
}

// ==========================================
// 7. FLUXO DE JOGO E FINAIS DOS ATOS
// ==========================================
function triggerStageEnd(win) {
    let pL = game.units.find(u => u.isLeader && u.faction === 1) || { name: game.leaderData?.name || 'Líder', emoji: game.leaderData?.emoji || '👑', level: game.leaderData?.level || 1 };

    // --- 1. REGISTRO DE HISTÓRICO PARA TODOS OS MODOS ---
    if (game && game.isDuel) {
        let history = JSON.parse(localStorage.getItem('ht_duel_history') || '[]');
        let eL = game.units.find(u => u.isLeader && u.faction === 2) || { name: 'CPU', emoji: '💀' };
        history.unshift({ date: new Date().toLocaleString(), win: win, pName: pL.name, pEmoji: pL.emoji, eName: eL.name, eEmoji: eL.emoji });
        if (history.length > 20) history.pop();
        localStorage.setItem('ht_duel_history', JSON.stringify(history));

        // APAGA O SAVE DO DUELO IMEDIATAMENTE APÓS TERMINAR!
        localStorage.removeItem('ht_save_duel');

        show('result-screen'); hide('rs-menu-win'); hide('rs-menu-lose');
        $('rs-title').innerText = win ? "Vitória no Duelo!" : "Derrota no Duelo";
        $('rs-title').style.color = win ? '#4a9edd' : '#c0392b';
        $('rs-desc').innerText = win ? "Você esmagou o adversário com maestria tática na Arena!" : "Sua equipe foi superada. Estude uma nova formação.";
        show('rs-menu-win');

        let btn = $('btn-go-shop');
        let novoBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(novoBtn, btn);
        btn = novoBtn;
        btn.innerText = "Voltar ao Menu Principal";
        btn.onclick = () => location.reload();
        return;
    } else {
        // Registro de histórico de Campanha / Roguelite (Igual ao sistema do Duelo)
        let hKey = game.isRoguelite ? 'ht_rogue_history' : 'ht_camp_history';
        let history = JSON.parse(localStorage.getItem(hKey) || '[]');
        history.unshift({
            date: new Date().toLocaleString(),
            win: win,
            level: game.currentLevel,
            floor: game.currentFloor + 1,
            pName: pL.name,
            pEmoji: pL.emoji
        });
        if (history.length > 20) history.pop();
        localStorage.setItem(hKey, JSON.stringify(history));
    }

    show('result-screen'); hide('rs-menu-win'); hide('rs-menu-lose');
    if (win) {
        // --- 2. VERIFICAÇÃO DE VITÓRIA TOTAL NO JOGO (ATO 5 CHEFE) ---
        if (game.isBossStage && game.currentLevel >= 5) {
            let hof = JSON.parse(localStorage.getItem('ht_hall_of_fame') || '[]');

            // Grava os detalhes riquíssimos das feras implantadas no mapa da vitória
            hof.unshift({
                date: new Date().toLocaleString(),
                mode: game.isRoguelite ? 'Roguelite' : 'Campanha',
                leader: { name: pL.name, emoji: pL.emoji, level: pL.level },
                team: game.units.filter(u => u.faction === 1 && !u.isLeader).map(u => ({
                    name: u.name,
                    emoji: u.emoji,
                    level: u.level,
                    starLevel: u.starLevel || 1,
                    filter: u.filter || 'none',
                    equipment: (u.equipment || []).map(eq => ({ id: eq.id, level: eq.level }))
                }))
            });
            localStorage.setItem('ht_hall_of_fame', JSON.stringify(hof));

            // Limpa o save do modo correspondente por concluir com sucesso
            localStorage.removeItem(game.isRoguelite ? 'ht_save_rogue' : 'ht_save_camp');
        }

        // ========================================================
        // DROP DO ARTEFATO ÔMEGA (SE FOR NÓ DE CHEFE)
        // ========================================================
        if (game.currentRouteType === 'BOSS' || game.isBossStage) {
            let omegaArt = ARTIFACTS.find(a => a.tier === 'omega' && a.region === game.currentRegionId);

            if (omegaArt) {
                // BLINDAGEM 1: Cria a mochila da partida atual se ela não existir
                if (!game.activeArtifacts) game.activeArtifacts = [];

                // Verifica se o jogador já não tem esse artefato
                if (!game.activeArtifacts.includes(omegaArt.id)) {
                    game.activeArtifacts.push(omegaArt.id);

                    // BLINDAGEM 2: Cria o inventário global (Hall da Fama) se não existir
                    if (typeof stats !== 'undefined') {
                        if (!stats.unlockedArtifacts) stats.unlockedArtifacts = [];

                        if (!stats.unlockedArtifacts.includes(omegaArt.id)) {
                            stats.unlockedArtifacts.push(omegaArt.id);
                            localStorage.setItem('ht_stats', JSON.stringify(stats));
                        }
                    }

                    // Dispara um alerta visual ÉPICO para o jogador
                    setTimeout(() => {
                        let div = document.createElement('div');
                        div.style.cssText = `position:fixed; top:40%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.9); border:2px solid var(--gold); padding:30px; text-align:center; z-index:10000; color:white; border-radius:10px; box-shadow: 0 0 30px var(--gold); animation: cineFade 4s forwards; pointer-events:none;`;
                        div.innerHTML = `
                            <h3 style="color:var(--gold); margin:0 0 10px 0; font-family:'Cinzel', serif;">ARTEFATO ÔMEGA OBTIDO!</h3>
                            <div style="font-size:40px; margin-bottom:10px;">${omegaArt.icon}</div>
                            <h2 style="margin:0 0 10px 0;">${omegaArt.name}</h2>
                            <p style="color:#ccc; font-size:14px; max-width:300px; margin:0 auto;">${omegaArt.desc}</p>
                        `;
                        document.body.appendChild(div);
                        setTimeout(() => div.remove(), 4500);
                    }, 1000);
                }
            }
        }

        if (typeof countKingdomBuildings === 'function' && game.kingdomMap) {
            let pWood = window.countKingdomBuildings('LUMBERMILL') * 3;
            let pStone = 0, pFerro = 0, pMineGold = 0;
            game.kingdomMap.forEach(h => {
                if (h.building === 'MINE') {
                    let lvl = h.bLevel || 1;
                    pStone += 3;
                    if (lvl >= 2) pFerro += 2;
                    if (lvl >= 3) pMineGold += 5;
                }
            });
            let pScales = window.countKingdomBuildings('FISHINGCAMP') * 3;
            let pSand = window.countKingdomBuildings('SANDPIT') * 3;
            let pGold = (window.countKingdomBuildings('MINE') * 10) + (window.countKingdomBuildings('PORT') * 5);

            // --- NOVO: COLETA DA BIBLIOTECA E ARMADILHEIRO ---
            let pDna = window.countKingdomBuildings('LIBRARY') * 1;
            let pTraps = window.countKingdomBuildings('TRAP_MAKER') * 1;

            if (!game.resources) game.resources = {};
            game.resources.wood = (game.resources.wood || 0) + pWood;
            game.resources.stone = (game.resources.stone || 0) + pStone;
            game.resources.scales = (game.resources.scales || 0) + pScales;
            game.resources.sand = (game.resources.sand || 0) + pSand;
            game.gold = (game.gold || 0) + pGold;

            game.dna = (game.dna || 0) + pDna;

            let extraMsg = "";
            if (pDna > 0) extraMsg += ` | +${pDna} 🧬`;
            if (pTraps > 0) {
                if (!game.fieldItems) game.fieldItems = { isca: 0, rede: 0, potion: 0, bandage: 0, scroll: 0, sphere: 0 };
                game.fieldItems.isca += pTraps;
                game.fieldItems.rede += pTraps;
                extraMsg += ` | +${pTraps}🍖/🕸️`;
            }

            if (pWood || pStone || pScales || pSand || pGold || pDna || pTraps) {
                setTimeout(() => showMessage(`Reino: ${pWood}🌲 ${pStone}⛰️ ${pScales}🐟 ${pSand}⏳ ${pGold}💰${extraMsg}`, '#2ecc71'), 1500);
            }
        }

        if (game.pendingDrop) {
            if (typeof window.giveRandomArtifact === 'function') window.giveRandomArtifact(game.pendingDrop);
            game.pendingDrop = null;
        }

        $('rs-title').innerText = "Vitória!"; $('rs-title').style.color = '#c9a227';
        show('rs-menu-win');
        let survivors = game.units.filter(u => u.faction === 1);
        deployedRoster = survivors.map(u => { u.furyAtk = 0; u.hasAttacked = false; u.status = null; u.spellsCast = 0; return u; });

        let btn = $('btn-go-shop');
        let novoBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(novoBtn, btn);
        btn = novoBtn;

        if (game.isBossStage || game.currentRouteType === 'BOSS') {
            // MARCA A REGIÃO COMO DOMINADA!
            if (game.currentRegionId && !game.conqueredRegions.includes(game.currentRegionId)) {
                game.conqueredRegions.push(game.currentRegionId);
            }

            if (game.currentRegionId !== 'CENTER') {
                $('rs-desc').innerText = `O Líder rival caiu e o setor foi purificado!\nVocê conquistou recursos abundantes.`;
                btn.innerText = "Retornar ao Tabuleiro Hexis 🌍";
                btn.onclick = () => {
                    game.currentFloor = -1;
                    game.isBossStage = false;
                    game.currentRegionId = null;
                    autoSave();
                    // Volta para escolher o próximo território!
                    openContinentMap();
                };
            } else {
                $('rs-desc').innerText = `PARABÉNS! Você derrotou o Leviatã Umbral e restaurou o Coração do Infinito!\nO Tabuleiro de Hexis foi unificado.`;
                btn.innerText = "🏆 Finalizar Jornada";

                let rogs = JSON.parse(localStorage.getItem('ht_artifacts_rogue') || '[]');
                if (!rogs.includes('art_omega')) {
                    rogs.push('art_omega');
                    localStorage.setItem('ht_artifacts_rogue', JSON.stringify(rogs));
                }

                btn.onclick = () => {
                    const sk = game.isRoguelite ? 'ht_save_rogue' : 'ht_save_camp';
                    localStorage.removeItem(sk);
                    location.reload();
                };
            }
        } else {
            $('rs-desc').innerText = `Avançando pelas linhas inimigas...`;
            btn.innerText = "Retornar ao Acampamento 🏰";
            btn.onclick = () => { openKingdom(); };
        }
    } else {
        $('rs-title').innerText = "Derrota"; $('rs-title').style.color = '#c0392b';
        if (game.isRoguelite) { $('rs-desc').innerText = 'Seu líder caiu. Fim da Run.'; $('btn-retry').innerText = '↺ Iniciar Nova Run'; localStorage.removeItem('ht_save_rogue'); }
        else { $('rs-desc').innerText = 'Seu exército recuou. Tente a fase novamente.'; $('btn-retry').innerText = '↺ Tentar Novamente'; }
        show('rs-menu-lose');
    }
}

function advanceCampaign() {
    game.isAnimating = true; // Trava o jogo imediatamente!
    const tb = $('turn-blocker');
    if (tb) tb.style.display = 'block'; // Impede ações do usuário
    lastState = null;
    const undoBtn = $('btn-undo');
    if (undoBtn) undoBtn.disabled = true;

    if (game.currentLevel > stats.maxLevel) {
        stats.maxLevel = game.currentLevel;
        localStorage.setItem('ht_stats', JSON.stringify(stats));
    }

    game.spellCooldowns = {};

    // BLINDAGEM MÁXIMA DE TELAS
    hide('management-screen');
    hide('route-map-screen');
    hide('event-screen');
    hide('continent-map-screen');
    hide('kingdom-screen');
    show('game-container');

    setTimeout(async () => {
        const r = deployedRoster.map(m => new Unit({ ...m, q: 0, r: 0, hasAttacked: false, status: null, isNew: false }));
        game.generateCampaignMap(r);
        renderer.initCamera(true);
        updateUI();
        autoSave();

        // ========================================================
        // CINEMÁTICA DE AURA: BOSS E ELITE
        // ========================================================
        let epicUnit = game.units.find(u => u.faction === 0 && (u.isBoss || u.isElite));

        if (epicUnit) {
            game.isAnimating = true;
            // 1. Foca a câmera brutalmente no monstrão
            renderer.centerOn(epicUnit.q, epicUnit.r);

            // 2. Injeta CSS das animações (Tremor e FadeIn 3D) se não existir
            if (!document.getElementById('cinematic-styles')) {
                let style = document.createElement('style');
                style.id = 'cinematic-styles';
                style.innerHTML = `
                    @keyframes cineFade {
                        0% { opacity: 0; transform: scale(0.8) translateY(-20px) rotateX(20deg); filter: blur(10px); }
                        15% { opacity: 1; transform: scale(1) translateY(0) rotateX(0deg); filter: blur(0px); }
                        85% { opacity: 1; transform: scale(1.05) translateY(0); filter: blur(0px); }
                        100% { opacity: 0; transform: scale(1.1) translateY(30px); filter: blur(10px); }
                    }
                    @keyframes screenShake {
                        0%, 100% { transform: translate(0, 0); }
                        10%, 50%, 90% { transform: translate(-3px, 2px); }
                        30%, 70% { transform: translate(3px, -2px); }
                    }
                    .shake-active { animation: screenShake 0.4s ease-in-out infinite; }
                `;
                document.head.appendChild(style);
            }

            // 3. Fundo escurecendo com Vignette
            let overlay = document.createElement('div');
            overlay.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle, transparent 20%, rgba(0,0,0,0.8) 80%); z-index:9998; opacity:0; transition: opacity 0.5s; pointer-events:none;`;
            document.body.appendChild(overlay);
            setTimeout(() => overlay.style.opacity = '1', 50);

            // 4. Texto Épico flutuando na tela
            let cine = document.createElement('div');
            let titleType = epicUnit.isBoss ? "GUARDIÃO DO DOMÍNIO" : "AMEAÇA ELITE";
            let titleColor = epicUnit.isBoss ? "var(--gold)" : "#e74c3c";

            cine.style.cssText = `position:fixed; top:35%; left:0; width:100%; text-align:center; z-index:9999; pointer-events:none; animation: cineFade 4s cubic-bezier(0.1, 0.8, 0.2, 1) forwards; perspective: 500px;`;
            cine.innerHTML = `
                <div style="font-family: 'Cinzel', serif; font-size: 16px; letter-spacing: 10px; color: ${titleColor}; text-shadow: 0 0 10px rgba(0,0,0,0.8); margin-bottom: -15px; opacity:0.8;">${titleType}</div>
                <div style="font-family: 'Cinzel', serif; font-size: 70px; font-weight: bold; color: #fff; text-shadow: 0px 5px 30px ${titleColor}, 0 0 50px #000; letter-spacing: 3px; text-transform: uppercase;">${epicUnit.name}</div>
            `;
            document.body.appendChild(cine);

            // 5. O Impacto: Treme a tela (Canvas) levemente!
            let canvas = $('gameCanvas');
            canvas.classList.add('shake-active');
            setTimeout(() => canvas.classList.remove('shake-active'), 800); // Treme só no impacto inicial da leitura do nome

            // 6. Espera os 4 segundos da glória
            await sleep(4000);

            // Limpa a tela
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 500);
            cine.remove();

            // Volta a câmera focando no Herói do jogador
            let pL = game.units.find(u => u.isLeader && u.faction === 1);
            if (pL) renderer.centerOn(pL.q, pL.r);
        }

        // Libera as travas pro jogador jogar
        game.isAnimating = false;
        if (tb) tb.style.display = 'none';
    }, 50);
}

function startGame(load, isRoguelite = false, leaderId = null, isDuel = false, opponentId = null) {
    game.isDuel = isDuel;
    game.opponentId = opponentId;
    hide('mode-screen'); hide('main-menu'); hide('result-screen');
    const sk = isDuel ? 'ht_save_duel' : (isRoguelite ? 'ht_save_rogue' : 'ht_save_camp'); game.isAnimating = false; const tb = $('turn-blocker'); if (tb) tb.style.display = 'none';
    lastState = null; const undoBtn = $('btn-undo'); if (undoBtn) undoBtn.disabled = true;
    game.manaPool = {}; game.spentMana = {}; game.spellCooldowns = {}; game.activeSpell = null; game.lastDeadAlly = null; game.turnCount = 0;
    window.fullCombatHistory = [];
    game.isDuel = isDuel;

    if (!ARTIFACTS.find(a => a.id === 'art_omega')) {
        ARTIFACTS.push({ id: 'art_omega', name: 'Coração do Infinito', icon: '🌌', desc: '+20 HP, +5 ATK e +1 Limite de Exército.', cost: 999, rarity: 'legendary', color: '#ff00ff', type: 'equip', onEquip: (u, lvl) => { u.maxHp += 20 * lvl; u.hp += 20 * lvl; u.atk += 5 * lvl; }, onUnequip: (u, lvl) => { u.maxHp -= 20 * lvl; u.atk -= 5 * lvl; u.hp = Math.min(u.hp, u.maxHp); } });
    }

    if (load) {
        const d = JSON.parse(localStorage.getItem(sk));
        game.resources = d.resources || { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 };
        game.kingdomMap = new Map(d.kingdomMap || []);
        game.currentLevel = d.level; game.cols = d.cols; game.rows = d.rows; game.gold = d.gold || 0;
        game.dna = d.dna || 0;
        game.isRoguelite = d.isRoguelite || false;
        game.conqueredRegions = d.conqueredRegions || [];
        game.currentRegionId = d.currentRegionId || null;
        game.routeMap = d.routeMap; game.currentFloor = d.currentFloor; game.inventory = d.inventory || [];
        game.isBossStage = d.isBossStage || false; game.currentRouteType = d.currentRouteType || 'BATTLE';
        game.manaPool = d.manaPool || {};
        game.spentMana = d.spentMana || {};
        game.spellCooldowns = d.spellCooldowns || {};
        // <-- CARREGA A MOCHILA (ou cria vazia)
        game.fieldItems = d.fieldItems || { isca: 0, rede: 0, potion: 0, bandage: 0, scroll: 0, sphere: 0, picanha: 0, feromonio: 0, adrenalina: 0, apito: 0, trap_stun: 0, trap_teleport: 0, silence: 0 };

        // Carrega os pergaminhos aprendidos
        if (d.unlockedRecipes && typeof RECIPES !== 'undefined') {
            Object.keys(d.unlockedRecipes).forEach(k => {
                if (RECIPES[k]) RECIPES[k].isLocked = d.unlockedRecipes[k];
            });
        }

        const stInd = $('stage-indicator'); if (stInd) stInd.innerText = `ATO ${toRoman(game.currentLevel)} - NÓ ${game.currentFloor + 1}`;
        game.map.clear();
        if (d.leaderId) game.leaderData = LEADERS.find(l => l.id === d.leaderId) || LEADERS[0];
        d.map.forEach(h => game.map.set(`${h.q},${h.r}`, new Hex(h.q, h.r, TERRAINS[h.tId], h.owner)));
        game.units = d.units.map(u => new Unit({ ...u, isNew: false }));
        rosterMemory = (d.rosterMemory || []).map(u => new Unit({ ...u, isNew: false }));
        deployedRoster = (d.deployedRoster || game.units.filter(u => u.faction === 1)).map(u => new Unit({ ...u, isNew: false }));
        if (d.items) d.items.forEach(([k, v]) => game.items.set(k, v));

        game.currentTurn = 1; game.gameOver = false; game.selectPlayerLeader();
        updateUI(); renderer.initCamera(true); show('game-container');
    } else {
        if (localStorage.getItem(sk)) localStorage.removeItem(sk);
        game.currentLevel = 1; game.gold = 0; game.dna = 0; game.isRoguelite = isRoguelite; rosterMemory = []; deployedRoster = []; game.inventory = [];
        game.conqueredRegions = [];
        game.currentRegionId = null;
        // SE FOR DUELO, COMEÇA COM 50 DE OURO
        game.gold = isDuel ? 50 : 0;

        game.resources = { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 };
        game.generateKingdomMap();
        game.kingdomMap = new Map();
        if (leaderId) game.leaderData = LEADERS.find(l => l.id === leaderId) || LEADERS[0];

        generateRouteMap();

        let lD = game.leaderData;
        let initialSpells = [];

        // 1. Mapeamento de Assinaturas (O que é ÚNICO de cada líder)
        const assinaturas = {
            'Metamorfo': ['sl_forma_urso', 'sl_forma_falcao', 'sl_forma_dragao'],
            'Carrasco': ['sl_execucao'],
            'Invocador': ['sl_evocar_dragao', 'sl_evocar_lobo', 'sl_evocar_golem'],
            'Sereia': ['sl_cancao_sereia'],
            'Bruxa': ['sl_caldeirao'],
            'Fada': ['sl_turno_extra'],
            'Lord Vampiro': ['sl_mordida_vamp'],
            'Paladina': ['sl_bencao_paladina'],
            'Almirante': ['sl_bombardeio'],
            'Arqueira': ['sl_tiro_preciso'],
            'Piromante': ['sl_bola_fogo'],
            'Chefe Orc': ['sl_grito_orc'],
            'Necromante': ['sl_erguer_esq'],
            'Arquimago': ['sl_explosao_arcana'],
            'Rainha do Gelo': ['sl_barreira_gelo'],
            'Matriarca Harpia': ['sl_vendaval'],
            'Xamã da Tempestade': ['sl_furia_tempestade']
        };

        // Criamos uma lista de TODAS as magias assinaturas para garantir que ninguém mais as tenha
        const todasAssinaturas = Object.values(assinaturas).flat();

        // 2. Adiciona as Assinaturas do Líder escolhido
        if (assinaturas[lD.name]) {
            initialSpells = [...assinaturas[lD.name]];
        }

        // 3. Adiciona magias genéricas de Nível 1
        // REGRAS:
        // - Tem que ser Nível 1
        // - Tem que bater com as tags do líder
        // - NÃO pode ser uma magia de assinatura de outro líder
        // 3. Adiciona magias genéricas de Nível 1
        if (lD.tags) {
            SPELLS.forEach(s => {
                // Descobre quem é o verdadeiro dono dessa magia (se houver)
                let donoDaAssinatura = Object.keys(assinaturas).find(k => assinaturas[k].includes(s.id));

                // Filtros rigorosos
                const ehCompativel = s.level === 1 && s.tags.some(t => lD.tags.includes(t)) && !s.noStart;
                const podeAprender = !donoDaAssinatura || (donoDaAssinatura === lD.baseName);

                if (ehCompativel && podeAprender && !initialSpells.includes(s.id)) {
                    initialSpells.push(s.id);
                }
            });
        }


        deployedRoster.push(new Unit({
            q: 0, r: 0,
            faction: 1,
            isLeader: true,
            name: lD.name,
            emoji: lD.emoji,
            hp: lD.hp,
            maxHp: lD.hp,
            abilities: [...(lD.abilities || [])],
            mp: lD.mp || 3,
            maxMp: lD.mp || 3,
            atk: lD.atk,
            range: lD.range,
            isNew: true,
            tags: lD.tags || [],
            fav: lD.fav || [],
            knownSpells: initialSpells,
            grimTags: [...(lD.tags || [])]
        }));

        if (isDuel) {
            // Vai direto pro Mercador!
            openShop();
            const btnL = document.getElementById('btn-leave-shop');
            btnL.innerText = "⚔️ Ir para a Arena";
            btnL.onclick = () => {
                // 1. AUTO-DEPLOY: Pega tudo que você comprou na Box e joga para o Campo automaticamente
                rosterMemory.forEach(u => {
                    if (!deployedRoster.includes(u)) {
                        deployedRoster.push(u);
                    }
                });
                rosterMemory = []; // Esvazia a box para o duelo iniciar limpo

                hide('shop-screen');

                // 2. GERA O MAPA PRIMEIRO: Popula as unidades do jogador e da IA em game.units
                game.generateDuelMap();

                // 3. TELA VERSUS
                window.showVersusScreen(() => {
                    show('game-container');
                    renderer.initCamera(true);
                    updateUI();
                });
            };
        } else {
            openContinentMap();
        }
    }

}

// ==========================================
// SISTEMA DE GERENCIAMENTO DO REINO 2.0
// ==========================================

window.buildingImageCache = window.buildingImageCache || {};

window.getBuildingImage = function (id, level, rendererInstance) {
    let key = `${id}_${level}`;
    if (window.buildingImageCache[key]) return window.buildingImageCache[key];

    let img = new Image();
    let basePath = `img/buildings/${id.toLowerCase()}`;
    img.src = `${basePath}_${level}.jpeg`;

    img.onload = () => {
        // Quando a imagem baixar pela primeira vez, força o canvas do reino a atualizar!
        if (rendererInstance) rendererInstance.draw();
    };

    img.onerror = () => {
        // Fallback Inteligente: Se não achar nv 2 ou 3, tenta forçar o nv 1
        if (level > 1 && img.src.includes(`_${level}.jpeg`)) {
            img.src = `${basePath}_1.jpeg`;
        }
    };

    window.buildingImageCache[key] = img;
    return img;
};

let kingdomHexSize = 45;
let kingdomOffsetX = 0, kingdomOffsetY = 0;
let selectedBuilding = null;
let kRenderer = null;
let isKDragging = false;
let startKX, startKY, initKOffX, initKOffY;
let initKPinch = null, initKSize = null;

// Função para popups de recursos flutuantes na tela do Reino
window.showKingdomPopup = function (txt, hex, col) {
    if (!kRenderer) return;
    const p = kRenderer.getPos(hex.q, hex.r);
    const el = document.createElement('div');
    el.className = 'dmg-popup';
    el.innerText = txt;
    el.style.color = col;
    el.style.left = p.x + 'px';
    el.style.top = (p.y - 20) + 'px';
    el.style.transition = 'top 1.5s ease-out, opacity 1.5s ease-out';
    $('popup-layer').appendChild(el);
    setTimeout(() => { el.style.top = (p.y - 70) + 'px'; el.style.opacity = '0'; }, 50);
    setTimeout(() => el.remove(), 1500);
};

window.updateKingdomResourcesUI = function () {
    let res = game.resources || {};
    if ($('k-res-gold')) $('k-res-gold').innerText = game.gold || 0;
    if ($('k-res-wood')) $('k-res-wood').innerText = res.wood || 0;
    if ($('k-res-stone')) $('k-res-stone').innerText = res.stone || 0;
    if ($('k-res-scales')) $('k-res-scales').innerText = res.scales || 0;
    if ($('k-res-sand')) $('k-res-sand').innerText = res.sand || 0;
    if ($('k-res-garras')) $('k-res-garras').innerText = res.garras || 0;
    if ($('k-res-asas')) $('k-res-asas').innerText = res.asas || 0;
    if ($('k-res-ferro')) $('k-res-ferro').innerText = res.ferro || 0;
    if ($('k-res-ervas')) $('k-res-ervas').innerText = res.ervas || 0;
    if ($('k-res-po_magico')) $('k-res-po_magico').innerText = res.po_magico || 0;
};

function openKingdom() {
    hide('result-screen');
    hide('route-map-screen');
    hide('game-container');
    show('kingdom-screen');
    updateKingdomResourcesUI();

    // 1. Gera o mapa do Reino se não existir no save
    if (!game.kingdomMap || game.kingdomMap.size === 0) {
        game.kingdomMap = new Map();
        const kCols = 13, kRows = 9;
        for (let r = 0; r < kRows; r++) {
            const off = Math.floor(r / 2);
            for (let q = -off; q < kCols - off; q++) {
                const rnd = Math.random();
                let t = TERRAINS.PLAINS;
                if (rnd > 0.90) t = TERRAINS.MOUNTAIN;
                else if (rnd > 0.80) t = TERRAINS.SNOW;
                else if (rnd > 0.65) t = TERRAINS.WATER;
                else if (rnd > 0.50) t = TERRAINS.FOREST;
                else if (rnd > 0.35) t = TERRAINS.DESERT;
                game.kingdomMap.set(`${q},${r}`, { q: q, r: r, terrain: t, building: null, bLevel: null });
            }
        }
    }

    // Garante apenas um Castelo Real no centro do mapa (coordenadas 4,4)
    let hasCastle = Array.from(game.kingdomMap.values()).some(h => h.building === 'CASTLE');
    if (!hasCastle) {
        let centerHex = game.kingdomMap.get("4,4") || Array.from(game.kingdomMap.values())[0];
        if (centerHex) { centerHex.building = 'CASTLE'; centerHex.bLevel = 1; }
    }

    // Atualiza os contadores de recursos na tela
    let res = game.resources || {};
    if ($('k-res-gold')) $('k-res-gold').innerText = game.gold || 0;
    if ($('k-res-dna')) $('k-res-dna').innerText = game.dna || 0;
    if ($('k-res-wood')) $('k-res-wood').innerText = res.wood || 0;
    if ($('k-res-stone')) $('k-res-stone').innerText = res.stone || 0;
    if ($('k-res-scales')) $('k-res-scales').innerText = res.scales || 0;
    if ($('k-res-sand')) $('k-res-sand').innerText = res.sand || 0;

    // Inicializa o motor gráfico e os inputs de câmera livre
    setTimeout(() => {
        const canvasEl = $('kingdomCanvas');
        if (!canvasEl) return;

        if (!kRenderer) {
            kRenderer = new KingdomRenderer(canvasEl, game);

            // --- MOTOR DE PARTÍCULAS E SINALIZADORES VISUAIS ---
            kRenderer.currentEffect = null;
            kRenderer.animateHex = function (hex, type = "build") {
                let startTime = Date.now();
                let duration = 500;
                let color = type === "build" ? "#2ecc71" : "var(--gold-light)";
                let interval = setInterval(() => {
                    let elapsed = Date.now() - startTime;
                    if (elapsed >= duration || !kRenderer || $('kingdom-screen').classList.contains('hidden')) {
                        clearInterval(interval);
                        kRenderer.currentEffect = null;
                        kRenderer.draw();
                        return;
                    }
                    kRenderer.currentEffect = { hex: hex, progress: elapsed / duration, color: color, type: type };
                    kRenderer.draw();
                }, 1000 / 30);
            };

            // Injeta o renderizador de efeitos e imagens sobre o desenho do mapa original
            let originalDraw = kRenderer.draw.bind(kRenderer);
            kRenderer.draw = function () {
                // 1. Oculta os emojis temporariamente pro motor base não desenhá-los!
                let tempIcons = {};
                game.kingdomMap.forEach((h, key) => {
                    if (h.building && BUILDINGS[h.building]) {
                        tempIcons[key] = BUILDINGS[h.building].icon;
                        BUILDINGS[h.building].icon = '';
                    }
                });

                // 2. Chama a renderização do fundo (A grama, fumaças, rios)
                originalDraw();

                // 3. Devolve os ícones imediatamente para não perder dados da memória
                game.kingdomMap.forEach((h, key) => {
                    if (h.building && tempIcons[key] !== undefined) {
                        BUILDINGS[h.building].icon = tempIcons[key];
                    }
                });

                let ctx = this.ctx;

                // 4. Desenha nossos novos Sprites das Construções por cima!
                game.kingdomMap.forEach(h => {
                    if (h.building) {
                        let p = this.getPos(h.q, h.r);
                        let lvl = h.bLevel || 1;
                        let img = window.getBuildingImage(h.building, lvl, this);

                        if (img.complete && img.naturalWidth > 0) {
                            let w = this.hexSize * 1.6; // Ajuste este valor se as casas ficarem muito grandes ou pequenas
                            let hImg = w;
                            ctx.drawImage(img, p.x - w / 2, p.y - hImg / 2 - (this.hexSize * 0.1), w, hImg);
                        } else {
                            // Se a imagem ainda está baixando, renderiza o Emoji padrão como "Loading"
                            ctx.font = `${this.hexSize * 0.8}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(BUILDINGS[h.building].icon, p.x, p.y);
                        }
                    }
                });

                // 5. Continua o efeito normal de expansão / shockwave verde ao construir (Seu código já existente)
                if (this.currentEffect) {
                    let eff = this.currentEffect;
                    let p = this.getPos(eff.hex.q, eff.hex.r);
                    ctx.save();
                    ctx.beginPath();
                    let radius = this.hexSize * (1 + eff.progress * 1.3);
                    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = eff.color;
                    ctx.lineWidth = 5 * (1 - eff.progress);
                    ctx.globalAlpha = 1 - eff.progress;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(p.x, p.y, this.hexSize * (1 - eff.progress), 0, Math.PI * 2);
                    ctx.fillStyle = eff.color;
                    ctx.globalAlpha = (1 - eff.progress) * 0.2;
                    ctx.fill();
                    ctx.restore();
                }
            };

            // --- CONTROLES DE MOUSE (PC) ---
            canvasEl.addEventListener('mousedown', e => {
                isKDragging = false;
                startKX = e.clientX; startKY = e.clientY;
                initKOffX = kRenderer.offsetX; initKOffY = kRenderer.offsetY;
            });

            window.addEventListener('mousemove', e => {
                if (startKX === undefined || !kRenderer || $('kingdom-screen').classList.contains('hidden')) return;
                const dx = e.clientX - startKX;
                const dy = e.clientY - startKY;
                if (Math.abs(dx) > 8 || Math.abs(dy) > 8) isKDragging = true;
                if (isKDragging) {
                    kRenderer.offsetX = initKOffX + dx;
                    kRenderer.offsetY = initKOffY + dy;
                    kRenderer.draw();
                }
            });

            window.addEventListener('mouseup', e => {
                if (startKX === undefined) return;
                startKX = undefined;
                if (!isKDragging) {
                    const rect = canvasEl.getBoundingClientRect();
                    processKingdomClick(e.clientX - rect.left, e.clientY - rect.top);
                }
            });

            canvasEl.addEventListener('wheel', e => {
                if ($('kingdom-screen').classList.contains('hidden')) return;
                e.preventDefault();
                kRenderer.hexSize = Math.max(25, Math.min(kRenderer.hexSize + (e.deltaY > 0 ? -4 : 4), 100));
                kRenderer.draw();
            }, { passive: false });

            // --- CONTROLES DE TOQUE (MOBILE) ---
            canvasEl.addEventListener('touchstart', e => {
                if (e.touches.length === 2) {
                    initKPinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                    initKSize = kRenderer.hexSize;
                } else if (e.touches.length === 1) {
                    isKDragging = false;
                    startKX = e.touches[0].clientX; startKY = e.touches[0].clientY;
                    initKOffX = kRenderer.offsetX; initKOffY = kRenderer.offsetY;
                }
            }, { passive: false });

            canvasEl.addEventListener('touchmove', e => {
                if ($('kingdom-screen').classList.contains('hidden')) return;
                e.preventDefault();
                if (e.touches.length === 2 && initKPinch) {
                    const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                    kRenderer.hexSize = Math.max(25, Math.min(initKSize * (dist / initKPinch), 100));
                    kRenderer.draw();
                } else if (e.touches.length === 1 && startKX !== undefined) {
                    const dx = e.touches[0].clientX - startKX;
                    const dy = e.touches[0].clientY - startKY;
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) isKDragging = true;
                    if (isKDragging) {
                        kRenderer.offsetX = initKOffX + dx;
                        kRenderer.offsetY = initKOffY + dy;
                        kRenderer.draw();
                    }
                }
            }, { passive: false });

            canvasEl.addEventListener('touchend', e => {
                if (e.touches.length === 0) initKPinch = null;
                if (startKX === undefined) return;
                if (!isKDragging && e.changedTouches.length === 1) {
                    const rect = canvasEl.getBoundingClientRect();
                    processKingdomClick(e.changedTouches[0].clientX - rect.left, e.changedTouches[0].clientY - rect.top);
                }
                startKX = undefined;
            });
        }

        function processKingdomClick(x, y) {
            let clickedHex = null, minDist = 999;
            game.kingdomMap.forEach(h => {
                const p = kRenderer.getPos(h.q, h.r);
                const d = Math.hypot(p.x - x, p.y - y);
                if (d < kRenderer.hexSize && d < minDist) { minDist = d; clickedHex = h; }
            });
            kRenderer.selectedHex = clickedHex;
            kRenderer.draw();
            if ($('building-menu')) {
                $('building-menu').classList.remove('hidden');
                renderBuildingMenu();
            }
        }

        kRenderer.initCamera();
        kRenderer.draw();
        if ($('building-menu')) hide('building-menu');
    }, 150);
}

// Mecânica Unificada de Trocas Selecionadas do Mercado Global
window.executeMarketTrade = function (resType, amount, goldChange) {
    if (goldChange < 0 && game.gold < Math.abs(goldChange)) { alert("Ouro insuficiente!"); return; }
    if (amount < 0 && game.resources[resType] < Math.abs(amount)) { alert("Recursos insuficientes!"); return; }

    game.resources[resType] = (game.resources[resType] || 0) + amount;
    game.gold = (game.gold || 0) + goldChange;

    let hex = kRenderer.selectedHex;
    let icon = resType === 'wood' ? '🌲' : resType === 'stone' ? '⛰️' : resType === 'scales' ? '🐟' : '⏳';

    // Feedback visual instantâneo por popup flutuante
    if (amount > 0) {
        window.showKingdomPopup(`+${amount} ${icon} / ${goldChange}💰`, hex, 'var(--success)');
    } else {
        window.showKingdomPopup(`${amount} ${icon} / +${goldChange}💰`, hex, 'var(--gold-light)');
    }

    // Atualiza contadores numéricos
    let resObj = game.resources || {};
    if ($('k-res-gold')) $('k-res-gold').innerText = game.gold;
    if ($('k-res-wood')) $('k-res-wood').innerText = resObj.wood || 0;
    if ($('k-res-stone')) $('k-res-stone').innerText = resObj.stone || 0;
    if ($('k-res-scales')) $('k-res-scales').innerText = resObj.scales || 0;
    if ($('k-res-sand')) $('k-res-sand').innerText = resObj.sand || 0;

    kRenderer.animateHex(hex, "build");
    autoSave();
    renderBuildingMenu();
};

function renderBuildingMenu() {
    const menu = $('building-menu');
    menu.innerHTML = '';

    if (!kRenderer) return;
    const hex = kRenderer.selectedHex;

    if (!hex) { menu.innerHTML = '<div style="color:#aaa; padding:10px;">Selecione um lote no mapa para interagir.</div>'; return; }

    // === MENU DE UPGRADE (Se o lote já tiver uma construção) ===
    if (hex.building) {
        let bData = BUILDINGS[hex.building];
        if (!bData) { menu.innerHTML = '<div style="color:var(--warning); padding:10px;">Estrutura desconhecida.</div>'; return; }

        let bLvl = hex.bLevel || 1;
        let maxLvl = bData.id === 'CASTLE' ? 1 : 3;

        // URL das Imagens com Fallback HTML
        let imgSrc = `img/buildings/${bData.id.toLowerCase()}_${bLvl}.png`;
        let fallbackSrc = `img/buildings/${bData.id.toLowerCase()}_1.png`;

        let html = `<div style="display:flex; flex-direction:column; min-width:170px; background:rgba(15,15,20,0.95); border:1px solid var(--gold-dark); padding:8px 12px; border-radius:8px; box-shadow: 0 5px 15px rgba(0,0,0,0.9); backdrop-filter:blur(5px);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <div style="position:relative; width:40px; height:40px; border-radius:5px; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; overflow:hidden;">
                    <img src="${imgSrc}" onerror="this.onerror=null; this.src='${fallbackSrc}';" style="width:100%; height:100%; object-fit:contain; z-index:2;">
                    <span style="font-size:26px; position:absolute; z-index:1; opacity:0.3;">${bData.icon}</span>
                </div>
                <div style="text-align:left; line-height:1.2;">
                    <span style="font-size:12px; color:var(--gold-light); font-weight:bold;">${bData.name}</span><br>
                    <span style="color:#fff; background:#444; padding:1px 4px; border-radius:4px; font-size:9px;">Nv ${bLvl}</span>
                </div>
            </div>
            <div style="font-size:9px; color:#aaa; margin-bottom:6px; text-align:center; line-height:1.2;">${bData.desc}</div>`;

        if (bLvl < maxLvl) {
            let nextLvl = bLvl + 1;
            let canAfford = Object.entries(bData.cost).every(([res, amt]) => (game.resources[res] || 0) >= (amt * nextLvl));

            let costHtml = Object.entries(bData.cost).map(([res, amt]) => {
                let icon = res === 'wood' ? '🌲' : res === 'stone' ? '⛰️' : res === 'scales' ? '🐟' : res === 'sand' ? '⏳' : '🩸';
                let reqAmt = amt * nextLvl;
                let color = (game.resources[res] || 0) >= reqAmt ? '#fff' : 'var(--enemy-color)';
                return `<span style="color:${color}; font-size:11px; font-weight:bold;">${icon}${reqAmt}</span>`;
            }).join(' ');

            html += `<div style="margin-bottom:4px; font-size:9px; color:var(--gold-dark); text-transform:uppercase;">Melhoria para Nv ${nextLvl}:</div>
                     <div style="display:flex; gap:8px; margin-bottom:8px; background:rgba(0,0,0,0.5); padding:4px 8px; border-radius:4px;">${costHtml}</div>
                     <button id="btn-upgrade-b" class="btn-warning" style="padding:6px 12px; font-size:10px; cursor:${canAfford ? 'pointer' : 'not-allowed'}; opacity:${canAfford ? '1' : '0.5'};">⬆️ Dar Upgrade</button>`;
        } else {
            html += `<div style="color:var(--success); font-size:11px; font-weight:bold; margin-top:6px; letter-spacing:1px;">NÍVEL MÁXIMO</div>`;
        }

        // --- ADIÇÃO DOS PAINÉIS INTERATIVOS REFORMULADOS ---
        let actsHtml = '';
        if (bData.id === 'MARKET') {
            actsHtml += `<hr style="border-color:#444; width:100%; margin:8px 0;">
                         <div style="font-size:9px; color:var(--gold-dark); margin-bottom:4px; text-transform:uppercase;">Vender (1 Unidade ➔ +5💰)</div>
                         <div style="display:flex; gap:4px; margin-bottom:8px; width:100%;">
                             <button onclick="executeMarketTrade('wood', -1, 5)" class="btn-success" style="flex:1; padding:4px 0; font-size:11px;">🌲</button>
                             <button onclick="executeMarketTrade('stone', -1, 5)" class="btn-success" style="flex:1; padding:4px 0; font-size:11px;">⛰️</button>
                             <button onclick="executeMarketTrade('scales', -1, 5)" class="btn-success" style="flex:1; padding:4px 0; font-size:11px;">🐟</button>
                             <button onclick="executeMarketTrade('sand', -1, 5)" class="btn-success" style="flex:1; padding:4px 0; font-size:11px;">⏳</button>
                         </div>
                         <div style="font-size:9px; color:var(--gold-dark); margin-bottom:4px; text-transform:uppercase;">Comprar (-10💰 ➔ +2 Unidades)</div>
                         <div style="display:flex; gap:4px; width:100%;">
                             <button onclick="executeMarketTrade('wood', 2, -10)" class="btn-warning" style="flex:1; padding:4px 0; font-size:11px;">🌲</button>
                             <button onclick="executeMarketTrade('stone', 2, -10)" class="btn-warning" style="flex:1; padding:4px 0; font-size:11px;">⛰️</button>
                             <button onclick="executeMarketTrade('scales', 2, -10)" class="btn-warning" style="flex:1; padding:4px 0; font-size:11px;">🐟</button>
                             <button onclick="executeMarketTrade('sand', 2, -10)" class="btn-warning" style="flex:1; padding:4px 0; font-size:11px;">⏳</button>
                         </div>`;
        } else if (bData.id === 'FORGE') {
            actsHtml += `<hr style="border-color:#444; width:100%; margin:8px 0;">
                <div style="font-size:9px; color:var(--gold-dark); text-transform:uppercase; margin:4px 0;">O Coração da Indústria</div>
                <button onclick="openArcaneForge()" class="btn-warning" style="width:100%; padding:10px; font-weight:bold; letter-spacing:1px; box-shadow:0 0 10px rgba(243, 156, 18, 0.5);">🔨 ABRIR FORJA ARCANA</button>
            `;
        } else if (bData.id === 'BARRACKS') {
            actsHtml += `<hr style="border-color:#444; width:100%; margin:8px 0;">`;

            // --- MOSTRAR SINERGIAS ATIVAS ---
            let syns = [];
            if (checkAdjacency('BARRACKS', 'FORGE')) syns.push("🛡️ Pedra/Carapaça (Forja)");
            if (checkAdjacency('BARRACKS', 'CRYSTAL_TOWER')) syns.push("🔮 Místicas (Torre)");
            if (checkAdjacency('BARRACKS', 'PORT')) syns.push("🌊 Aquáticas (Porto)");
            if (checkAdjacency('BARRACKS', 'TRAP_MAKER')) syns.push("🗡️ Stalkers (Armadilha)");
            if (checkAdjacency('BARRACKS', 'SHADOW_ALTAR')) syns.push("🦇 Umbrais (Altar)");

            if (syns.length > 0) {
                actsHtml += `<div style="font-size:9px; color:#3498db; margin-bottom:6px; text-align:center; line-height:1.4;">Sinergias Ativas:<br><span style="color:#fff;">${syns.join(' | ')}</span></div>`;
            }

            actsHtml += `<div style="display:flex; gap:4px; width:100%;">
                             <button id="btn-barracks" class="btn-success" style="flex:2; font-size:10px; padding:6px;">Recrutar (-20💰)</button>
                             <button id="btn-barracks-pool" class="btn-primary" style="flex:1; font-size:10px; padding:6px; background:#2980b9;">Ver Tropas</button>
                         </div>`;
        } else if (bData.id === 'BLACKSMITH') { // O FERREIRO COM OURO
            actsHtml += `<hr style="border-color:#444; width:100%; margin:8px 0;">
                <div style="font-size:9px; color:var(--gold-light); text-transform:uppercase; margin:4px 0;">Forja a Ouro</div>
                <button onclick="craftGoldItem('RUSTY_SWORD', 10)" class="btn-warning" style="margin-bottom:4px;width:100%;font-size:10px;">🗡️ Espada Enferrujada (-10💰)</button>
                <button onclick="craftGoldItem('WOODEN_SHIELD', 10)" class="btn-warning" style="margin-bottom:4px;width:100%;font-size:10px;">🛡️ Escudo de Madeira (-10💰)</button>
                <button onclick="craftGoldItem('SWORD', 25)" class="btn-warning" style="margin-bottom:4px;width:100%;font-size:10px;">🗡️ Espada Longa (-25💰)</button>
                <button onclick="craftGoldItem('SHIELD', 25)" class="btn-warning" style="margin-bottom:4px;width:100%;font-size:10px;">🛡️ Escudo de Aço (-25💰)</button>
            `;

        } else if (bData.id === 'FORGE') { // A NOVA FORJA DE MONSTROS (CRAFT ESTRATÉGICO)
            actsHtml += `<hr style="border-color:#444; width:100%; margin:8px 0;">
                <div style="font-size:9px; color:var(--gold-dark); text-transform:uppercase; margin:4px 0;">Forja Sinergética</div>
                <button onclick="craftSpecialItem('BOOTS', {asas: 2, couro: 0})" class="btn-primary" style="margin-bottom:4px;width:100%;font-size:10px;">👢 Botas Aladas (-2 Asas)</button>
                <button onclick="craftSpecialItem('SWORD', {garras: 2, wood: 1})" class="btn-primary" style="margin-bottom:4px;width:100%;font-size:10px;">🗡️ Espada Feroz (-2 Garras, 1 Madeira)</button>
                <button onclick="craftSpecialItem('SHIELD', {ferro: 2})" class="btn-primary" style="margin-bottom:4px;width:100%;font-size:10px;">🛡️ Escudo Pesado (-2 Ferro)</button>
                <button onclick="craftSpecialItem('WINGS_ICARUS', {asas: 3, po_magico: 1})" class="btn-primary" style="margin-bottom:4px;width:100%;font-size:10px;">🪽 Asas de Ícaro (-3 Asas, 1 Pó)</button>
            `;
        } else if (bData.id === 'APOTHECARY') { // A BOTICA DE ITENS DE CAMPO
            actsHtml += `<hr style="border-color:#444; width:100%; margin:8px 0;">
                <div style="font-size:9px; color:#2ecc71; text-transform:uppercase; margin:4px 0;">Alquimia (Itens de Mochila)</div>
                <button onclick="craftFieldItem('potion', {ervas: 2})" class="btn-success" style="margin-bottom:4px;width:100%;font-size:10px;">🧪 Poção de Cura (-2 Ervas)</button>
                <button onclick="craftFieldItem('bandage', {ervas: 1})" class="btn-success" style="margin-bottom:4px;width:100%;font-size:10px;">🩹 Atadura (-1 Erva)</button>
                <button onclick="craftFieldItem('sphere', {po_magico: 2})" class="btn-info" style="margin-bottom:4px;width:100%;font-size:10px; background:#8e44ad;">🔮 Esfera Elemental (-2 Pó Mágico)</button>
                <button onclick="craftFieldItem('isca', {garras: 1})" class="btn-warning" style="margin-bottom:4px;width:100%;font-size:10px;">🍖 Isca de Carne (-1 Garra)</button>
            `;
        } else if (bData.id === 'BIOTERIUM') { // O INCRÍVEL BIOTÉRIO
            actsHtml += `<hr style="border-color:#444; width:100%; margin:8px 0;">
                <button id="btn-bioterium" class="btn-success" style="width:100%; font-size:10px; padding:6px; background:#27ae60;">🐾 Alocar fera da Box para Descansar</button>
            `;
        }

        html += actsHtml;
        html += `</div>`;
        menu.innerHTML = html;

        // Atribuição de ouvintes de eventos para botões estáticos pós-injeção
        if (bLvl < maxLvl) {
            const btnU = $('btn-upgrade-b');
            if (btnU) {
                btnU.onclick = () => {
                    let nextLvl = bLvl + 1;
                    let canAfford = Object.entries(bData.cost).every(([res, amt]) => (game.resources[res] || 0) >= (amt * nextLvl));
                    if (canAfford) {
                        Object.entries(bData.cost).forEach(([res, amt]) => game.resources[res] -= (amt * nextLvl));
                        hex.bLevel = nextLvl;

                        if (bData.id === 'FARM') {
                            [...rosterMemory, ...deployedRoster].forEach(u => { u.maxHp += 10; u.hp += 10; });
                            window.showKingdomPopup("🌾 Exército +10 HP!", hex, '#2ecc71');
                        }

                        let resObj = game.resources || {};
                        if ($('k-res-wood')) $('k-res-wood').innerText = resObj.wood || 0;
                        if ($('k-res-stone')) $('k-res-stone').innerText = resObj.stone || 0;
                        if ($('k-res-scales')) $('k-res-scales').innerText = resObj.scales || 0;
                        if ($('k-res-sand')) $('k-res-sand').innerText = resObj.sand || 0;
                        if ($('k-res-gold')) $('k-res-gold').innerText = game.gold;

                        kRenderer.animateHex(hex, "upgrade"); // Dispara o shockwave de melhoria
                        window.showKingdomPopup("⬆️ Nível Expandido!", hex, 'var(--gold-light)');
                        autoSave();
                        renderBuildingMenu();
                    }
                };
            }
        }
        if ($('btn-forge-gold')) {
            $('btn-forge-gold').onclick = async () => {
                if (game.gold >= 25) {
                    let gearPool = ['RUSTY_SWORD', 'WOODEN_SHIELD', 'SWORD', 'SHIELD', 'BOOTS', 'BOW'];
                    let forgedId = gearPool[Math.floor(Math.random() * gearPool.length)];
                    game.inventory.push({ id: forgedId, level: 1 });
                    game.gold -= 25;
                    updateKingdomResourcesUI();
                    kRenderer.animateHex(hex, "upgrade");
                    window.showKingdomPopup("Arma Comum Forjada!", hex, '#f1c40f');
                    autoSave(); renderBuildingMenu();
                } else { alert("Ouro insuficiente!"); }
            };
        }

        // Funções de Craft global
        window.craftSpecialItem = function (itemId, costObj) {
            for (let [res, amt] of Object.entries(costObj)) {
                if ((game.resources[res] || 0) < amt) { alert(`Falta ${res.toUpperCase()}! Você precisa de ${amt}.`); return; }
            }
            for (let [res, amt] of Object.entries(costObj)) { game.resources[res] -= amt; }
            game.inventory.push({ id: itemId, level: 1 });
            window.showKingdomPopup("Item Forjado!", kRenderer.selectedHex, '#f1c40f');
            updateKingdomResourcesUI(); autoSave();
        };

        // Crafting exclusivo do Ferreiro (Usa apenas Ouro)
        window.craftGoldItem = function (itemId, goldCost) {
            if ((game.gold || 0) < goldCost) { alert(`Ouro insuficiente! Você precisa de ${goldCost}💰.`); return; }
            game.gold -= goldCost;
            game.inventory.push({ id: itemId, level: 1 });
            window.showKingdomPopup("Equipamento Comprado!", kRenderer.selectedHex, '#f1c40f');
            updateKingdomResourcesUI(); autoSave();
        };

        window.craftFieldItem = function (itemId, costObj) {
            for (let [res, amt] of Object.entries(costObj)) {
                if ((game.resources[res] || 0) < amt) { alert(`Falta ${res.toUpperCase()}! Você precisa de ${amt}.`); return; }
            }
            for (let [res, amt] of Object.entries(costObj)) { game.resources[res] -= amt; }
            if (!game.fieldItems) game.fieldItems = {};
            game.fieldItems[itemId] = (game.fieldItems[itemId] || 0) + 1;
            window.showKingdomPopup("Medicina Criada!", kRenderer.selectedHex, '#2ecc71');
            updateKingdomResourcesUI(); autoSave();
        };

        // BIOTÉRIO
        if ($('btn-bioterium')) {
            $('btn-bioterium').onclick = async () => {
                // Junta a Box e a Equipe Ativa (excluindo apenas o Líder)
                let m = [...rosterMemory, ...deployedRoster.filter(u => !u.isLeader)];

                if (m.length === 0) { alert("Nenhuma fera disponível para alocar!"); return; }
                let u = await window.promptSelectUnit("Selecione a fera para o Biotério", m);
                if (u) {
                    u.hp = u.maxHp; // Cura Máxima

                    // Adquire a passiva de Terreno Baseado no Chão da Construção
                    let tId = hex.terrain.id || hex.terrain;
                    if (!u.fav) u.fav = [];
                    if (!u.fav.includes(tId)) {
                        u.fav.push(tId);
                    }

                    window.showKingdomPopup(`🐾 Adaptou-se a ${tId}!`, hex, '#2ecc71');
                    kRenderer.animateHex(hex, "build");
                    if (typeof showZeldaPopup === 'function') await showZeldaPopup(u.emoji, "Mutação Genética!", `${u.name} descansou e agora possui afinidade com: ${tId}`);
                    autoSave();
                }
            };
        }

        if ($('btn-forge')) {
            $('btn-forge').onclick = async () => {
                let cost = parseInt($('btn-forge').getAttribute('data-cost'));
                if (game.gold >= cost) {
                    let gearPool = ['RUSTY_SWORD', 'WOODEN_SHIELD', 'SWORD', 'SHIELD', 'BOOTS', 'BOW'];
                    let forgedId = gearPool[Math.floor(Math.random() * gearPool.length)];
                    let iDef = typeof ITEMS !== 'undefined' ? ITEMS[forgedId] : { icon: '🗡️', name: 'Arma', desc: 'Item.' };
                    game.inventory.push({ id: forgedId, level: 1 });
                    game.gold -= cost;
                    if ($('k-res-gold')) $('k-res-gold').innerText = game.gold;
                    kRenderer.animateHex(hex, "upgrade");
                    if (typeof showZeldaPopup === 'function') await showZeldaPopup(iDef.icon, "Equipamento Forjado!", `Você forjou: ${iDef.name}\n${iDef.desc}`);
                    autoSave(); renderBuildingMenu();
                } else { alert("Ouro insuficiente!"); }
            };
        }

        if ($('btn-barracks')) {
            $('btn-barracks').onclick = async () => { // Adicionado o async aqui!
                if (game.gold >= 20) {
                    let tags = game.leaderData.tags || [];
                    let masterPool = [...BEASTS.LAND, ...BEASTS.WATER, ...BEASTS.SNOW];
                    let pool = masterPool.filter(b => b.tags && b.tags.some(t => tags.includes(t)) && !b.minLevel);

                    if (checkAdjacency('BARRACKS', 'CRYSTAL_TOWER')) pool.push(...masterPool.filter(b => b.tags && b.tags.includes('MYSTIC') && !b.minLevel));
                    if (checkAdjacency('BARRACKS', 'PORT')) pool.push(...masterPool.filter(b => b.tags && b.tags.includes('WATER') && !b.minLevel));
                    if (checkAdjacency('BARRACKS', 'TRAP_MAKER')) pool.push(...masterPool.filter(b => b.tags && b.tags.includes('STALKER') && !b.minLevel));
                    if (checkAdjacency('BARRACKS', 'FORGE')) pool.push(...masterPool.filter(b => b.tags && (b.tags.includes('ROCK') || b.tags.includes('CARAPACE')) && !b.minLevel));
                    if (checkAdjacency('BARRACKS', 'SHADOW_ALTAR')) pool.push(...masterPool.filter(b => b.tags && b.tags.includes('UMBRAL') && !b.minLevel));

                    if (pool.length === 0) pool = BEASTS.LAND;
                    let b = pool[Math.floor(Math.random() * pool.length)];
                    let maxL = typeof window.getMaxBoxLimit === 'function' ? window.getMaxBoxLimit() : 6;
                    let newUnit = new Unit({ q: 0, r: 0, faction: 1, name: b.name, baseName: b.name, emoji: b.e, hp: b.hp, maxHp: b.hp, mp: b.mp, maxMp: b.mp, atk: b.atk, range: b.range, level: 1, abilities: [...b.abilities], isNew: true, filter: b.filter, tags: b.tags || [], fav: b.fav || [] });

                    if (deployedRoster.filter(u => !u.isLeader).length >= maxL) {
                        rosterMemory.push(newUnit);
                        if (typeof showZeldaPopup === 'function') await showZeldaPopup(b.e, 'Tropa na Box!', `O ${b.name} foi enviado para a sua Box porque o exército está cheio!`);
                    } else {
                        deployedRoster.push(newUnit);
                        if (typeof showZeldaPopup === 'function') await showZeldaPopup(b.e, 'Tropa Recrutada!', `O ${b.name} juntou-se ao seu exército em campo!`);
                    }
                    game.gold -= 20;
                    if ($('k-res-gold')) $('k-res-gold').innerText = game.gold;

                    kRenderer.animateHex(hex, "build");
                    autoSave(); renderBuildingMenu();
                } else { alert("Ouro insuficiente!"); }
            };
        }

        if ($('btn-barracks-pool')) {
            $('btn-barracks-pool').onclick = async () => {
                let tags = game.leaderData.tags || [];
                let masterPool = [...BEASTS.LAND, ...BEASTS.WATER, ...BEASTS.SNOW];
                let pool = masterPool.filter(b => b.tags && b.tags.some(t => tags.includes(t)) && !b.minLevel);

                if (checkAdjacency('BARRACKS', 'CRYSTAL_TOWER')) pool.push(...masterPool.filter(b => b.tags && b.tags.includes('MYSTIC') && !b.minLevel));
                if (checkAdjacency('BARRACKS', 'PORT')) pool.push(...masterPool.filter(b => b.tags && b.tags.includes('WATER') && !b.minLevel));
                if (checkAdjacency('BARRACKS', 'TRAP_MAKER')) pool.push(...masterPool.filter(b => b.tags && b.tags.includes('STALKER') && !b.minLevel));
                if (checkAdjacency('BARRACKS', 'FORGE')) pool.push(...masterPool.filter(b => b.tags && (b.tags.includes('ROCK') || b.tags.includes('CARAPACE')) && !b.minLevel));
                if (checkAdjacency('BARRACKS', 'SHADOW_ALTAR')) pool.push(...masterPool.filter(b => b.tags && b.tags.includes('UMBRAL') && !b.minLevel));

                if (pool.length === 0) pool = BEASTS.LAND;

                // Extrai apenas nomes e ícones únicos
                let uniqueNames = [];
                pool.forEach(b => {
                    let str = `${b.e} ${b.name}`;
                    if (!uniqueNames.includes(str)) uniqueNames.push(str);
                });

                if (typeof showZeldaPopup === 'function') {
                    await showZeldaPopup('⛺', 'Tropas do Quartel', 'Feras baseadas nas tags do líder e nas sinergias adjacentes:\n\n' + uniqueNames.join(' | '));
                }
            };
        }

        if ($('btn-altar-sac')) {
            $('btn-altar-sac').onclick = async () => {
                let m = [...rosterMemory, ...deployedRoster].filter(u => !u.isLeader);
                if (m.length === 0) { alert("Nenhuma fera disponível na Box para o sacrifício!"); return; }
                let sac = await window.promptSelectUnit("Selecione o Sacrifício Sombrio", m);
                if (sac) {
                    if (rosterMemory.includes(sac)) rosterMemory.splice(rosterMemory.indexOf(sac), 1);
                    if (deployedRoster.includes(sac)) deployedRoster.splice(deployedRoster.indexOf(sac), 1);
                    game.resources.wood += 5; game.resources.stone += 5; game.resources.scales += 5; game.resources.sand += 5;

                    kRenderer.animateHex(hex, "upgrade");
                    window.showKingdomPopup(`🪦 Sacrificado! +5 Recursos`, hex, 'var(--blood-light)');

                    let resObj = game.resources || {};
                    if ($('k-res-wood')) $('k-res-wood').innerText = resObj.wood || 0;
                    if ($('k-res-stone')) $('k-res-stone').innerText = resObj.stone || 0;
                    if ($('k-res-scales')) $('k-res-scales').innerText = resObj.scales || 0;
                    if ($('k-res-sand')) $('k-res-sand').innerText = resObj.sand || 0;
                    autoSave(); renderBuildingMenu();
                }
            };
        }
        return;
    }

    // === MENU DE CONSTRUÇÃO (Lote Vazio) ===
    let hasOptions = false;
    let tId = 'PLAINS';
    if (hex.terrain) {
        if (hex.terrain.id) tId = hex.terrain.id;
        else if (typeof hex.terrain === 'string') tId = hex.terrain;
    }
    tId = tId.toUpperCase();

    // 1. Filtra as permitidas, Checa Unicidade e Ordena
    let availableBuildings = Object.values(BUILDINGS).filter(b => b.id !== 'CASTLE' && b.terrains && b.terrains.includes(tId));
    const nonUnique = ['MINE', 'LUMBERMILL', 'FISHINGCAMP', 'SANDPIT', 'FARM', 'RESIDENCE', 'MARKET', 'VILLAGE'];

    let bOpts = availableBuildings.map(b => {
        let isUnique = !nonUnique.includes(b.id);
        let alreadyHas = isUnique && Array.from(game.kingdomMap.values()).some(h => h.building === b.id);
        let canAfford = Object.entries(b.cost).every(([res, amt]) => (game.resources[res] || 0) >= amt);
        return { b, isUnique, alreadyHas, canAfford };
    });

    // 2. Ordena (Pode Comprar > Sem Recurso > Já Construído (Bloqueado))
    bOpts.sort((x, y) => {
        if (x.alreadyHas !== y.alreadyHas) return x.alreadyHas ? 1 : -1;
        if (x.canAfford !== y.canAfford) return x.canAfford ? -1 : 1;
        return 0;
    });

    bOpts.forEach(opt => {
        let b = opt.b;
        hasOptions = true;
        const btn = document.createElement('button');

        let btnStyle = opt.canAfford ? 'var(--success)' : '#555';
        let cursor = opt.canAfford ? 'pointer' : 'not-allowed';
        let opacity = 1;
        if (opt.alreadyHas) { btnStyle = '#e74c3c'; cursor = 'not-allowed'; opacity = 0.5; }

        // Deixei o botão um pouquinho mais largo (110px) para a descrição caber melhor
        btn.style.cssText = `display:flex; flex-direction:column; align-items:center; min-width:115px; max-width:125px; background:rgba(20,20,30,0.95); border:1px solid ${btnStyle}; padding:6px; border-radius:8px; cursor:${cursor}; opacity:${opacity}; box-shadow: 0 4px 10px rgba(0,0,0,0.6); backdrop-filter:blur(5px); transition: transform 0.1s;`;

        let costHtml = opt.alreadyHas
            ? `<span style="color:#e74c3c; font-size:9px; font-weight:bold;">LIMITE ÚNICO</span>`
            : Object.entries(b.cost).map(([res, amt]) => {
                let icon = res === 'wood' ? '🌲' : res === 'stone' ? '⛰️' : res === 'scales' ? '🐟' : res === 'sand' ? '⏳' : '🩸';
                let color = (game.resources[res] || 0) >= amt ? '#fff' : 'var(--enemy-color)';
                return `<span style="color:${color}; font-size:9px; font-weight:bold;">${icon}${amt}</span>`;
            }).join(' ');

        let imgSrc = `img/buildings/${b.id.toLowerCase()}_1.png`;

        btn.innerHTML = `<div style="position:relative; width:35px; height:35px; margin-bottom:2px; display:flex; justify-content:center; align-items:center;">
                             <img src="${imgSrc}" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='block';" style="width:100%; height:100%; object-fit:contain;">
                             <span style="font-size:24px; display:none;">${b.icon}</span>
                         </div>
                         <span style="font-size:10px; color:var(--gold-light); font-weight:bold; text-align:center; line-height:1.1;">${b.name}</span>
                         <div style="display:flex; gap:3px; margin:4px 0; flex-wrap:wrap; justify-content:center;">${costHtml}</div>
                         <span style="font-size:8px; color:#aaa; margin-top:2px; text-align:center; line-height:1.2;">${b.desc}</span>`;

        if (opt.canAfford && !opt.alreadyHas) {
            btn.onclick = async () => {
                Object.entries(b.cost).forEach(([res, amt]) => game.resources[res] -= amt);

                // 3. Mecânica de Fusão de Residências -> VILA
                if (b.id === 'RESIDENCE') {
                    let neighbors = Hex.getNeighbors(hex.q, hex.r);
                    let merged = false;
                    for (let n of neighbors) {
                        let adj = game.kingdomMap.get(`${n.q},${n.r}`);
                        if (adj && adj.building === 'RESIDENCE') {
                            adj.building = null; adj.bLevel = null; // Apaga a antiga
                            hex.building = 'VILLAGE'; hex.bLevel = 1; // Transforma o lote atual
                            merged = true;
                            if (typeof showZeldaPopup === 'function') await showZeldaPopup('🏘️', 'Vila Fundada!', 'Duas residências se uniram para formar uma Vila!\n+1 Limite de Exército!');
                            break;
                        }
                    }
                    if (!merged) { hex.building = 'RESIDENCE'; hex.bLevel = 1; }
                } else {
                    hex.building = b.id; hex.bLevel = 1;
                }

                // 4. Igreja Sombria (Corvo Sombrio)
                if ((b.id === 'CHURCH' || b.id === 'SHADOW_ALTAR') && checkAdjacency('CHURCH', 'SHADOW_ALTAR') && (!game.eventFlags || !game.eventFlags.hasDarkCrow)) {
                    if (!game.eventFlags) game.eventFlags = {};
                    game.eventFlags.hasDarkCrow = true;
                    let crow = new Unit({ q: 0, r: 0, faction: 1, isLeader: false, name: "Corvo Sombrio", baseName: "Corvo", emoji: "🐦‍⬛", hp: 40, maxHp: 40, mp: 5, maxMp: 5, atk: 14, range: 1, level: 1, abilities: ['flying', 'lifesteal'], isNew: true, filter: 'none', tags: ['UMBRAL', 'WING'], fav: ['FOREST'] });
                    rosterMemory.push(crow);
                    if (typeof showZeldaPopup === 'function') await showZeldaPopup("🐦‍⬛", "Igreja Sombria!", "A combinação profana atraiu o Corvo Sombrio para a sua Box!");
                }

                if (b.id === 'CHURCH') {
                    let celestial = new Unit({ q: 0, r: 0, faction: 1, isLeader: false, name: "Guardião Celestial", baseName: "Guardião", emoji: "🕊️", hp: 45, maxHp: 45, mp: 4, maxMp: 4, atk: 12, range: 1, level: 1, abilities: ['leadership'], isNew: true, filter: 'none', tags: ['CELESTIAL'], fav: ['PLAINS'] });
                    rosterMemory.push(celestial);
                    if (typeof showZeldaPopup === 'function') await showZeldaPopup("🕊️", "Invocação Celestial!", "O Guardião Celestial foi enviado com sucesso para a Box!");
                }

                // Atualiza UI Geral
                let resObj = game.resources || {};
                if ($('k-res-wood')) $('k-res-wood').innerText = resObj.wood || 0;
                if ($('k-res-stone')) $('k-res-stone').innerText = resObj.stone || 0;
                if ($('k-res-scales')) $('k-res-scales').innerText = resObj.scales || 0;
                if ($('k-res-sand')) $('k-res-sand').innerText = resObj.sand || 0;
                kRenderer.animateHex(hex, "build");
                if (b.id !== 'CHURCH' && b.id !== 'RESIDENCE') window.showKingdomPopup("✨ Construído!", hex, '#2ecc71');
                autoSave(); renderBuildingMenu();
            };
        }
        menu.appendChild(btn);
    });

    if (!hasOptions) menu.innerHTML = '<div style="color:#aaa; padding:10px; font-style:italic;">Nenhuma construção disponível.</div>';
}

// ==========================================
// SISTEMA: LÍDER GÊNIA - TRÊS DESEJOS
// ==========================================
window.triggerGenieWishes = function () {
    const el = document.createElement('div');
    el.id = 'genie-wishes-modal';
    el.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center;`;

    el.innerHTML = `
        <div style="background:var(--bg-panel); border:2px solid #9b59b6; border-radius:10px; padding:20px; width:90%; max-width:400px; text-align:center;">
            <div style="font-size:50px; filter:hue-rotate(270deg);">🧞‍♀️</div>
            <h2 style="font-family:Cinzel,serif; color:#9b59b6; margin-bottom:5px;">Os Três Desejos</h2>
            <p style="font-size:13px; color:#ccc; margin-bottom:20px;">Faça sua escolha para iniciar a fase atual.</p>
            
            <button id="btn-wish-gold" class="btn-warning" style="width:100%; margin-bottom:10px; padding:10px;">💰 Desejo da Riqueza (+30 Ouro)</button>
            <button id="btn-wish-res" class="btn-success" style="width:100%; margin-bottom:10px; padding:10px;">🌲 Desejo da Construção (+10 Todos Recursos)</button>
            <button id="btn-wish-item" class="btn-primary" style="width:100%; padding:10px; background:#8e44ad; border-color:#9b59b6; color:#fff;">🎁 Desejo do Poder (Ganhar Item Forjado)</button>
        </div>
    `;

    document.body.appendChild(el);

    const closeWishes = () => { el.remove(); autoSave(); updateUI(); };

    $('btn-wish-gold').onclick = () => {
        game.gold += 30;
        showPopup("+30 Ouro!", game.units.find(u => u.isLeader), 'var(--gold-light)');
        closeWishes();
    };

    $('btn-wish-res').onclick = () => {
        game.resources.wood += 10; game.resources.stone += 10; game.resources.scales += 10; game.resources.sand += 10;
        showPopup("+Recursos!", game.units.find(u => u.isLeader), '#2ecc71');
        closeWishes();
    };

    $('btn-wish-item').onclick = () => {
        let itP = ['POTION', 'BANDAGE', 'SWORD', 'SHIELD', 'BOOTS', 'BOW', 'MAGIC'];
        let forged = itP[Math.floor(Math.random() * itP.length)];
        game.inventory.push({ id: forged, level: 1 });
        showPopup("Item Adquirido!", game.units.find(u => u.isLeader), '#9b59b6');
        closeWishes();
    };
};

window.renderFieldItemMenu = function () {
    const menu = $('field-item-menu');
    if (!menu) return;

    // Garante que a estrutura exista e cria itens iniciais para teste se estiver vazio
    if (!game.fieldItems) {
        game.fieldItems = { isca: 3, rede: 2, potion: 2, bandage: 1, scroll: 1, sphere: 1 };
    }

    // Dicionário visual de nomes bonitos para a interface
    const itemDefs = {
        isca: { name: "🍖 Isca de Carne" },
        picanha: { name: "🥩 Picanha" },
        rede: { name: "🕸️ Rede Hexagonal" },
        feromonio: { name: "🌸 Rede c/ Feromônio" },
        potion: { name: "🧪 Poção de Cura" },
        bandage: { name: "🩹 Atadura Médica" },
        scroll: { name: "📜 Pergaminho Arcano" },
        sphere: { name: "🔮 Esfera Elemental" },
        adrenalina: { name: "💉 Adrenalina" },
        apito: { name: "🪈 Apito Ancestral" },
        trap_stun: { name: "⚡ Armadilha Stun" },
        trap_teleport: { name: "🌀 Armadilha Teleporte" },
        silence: { name: "🔕 Selo de Silêncio" }
    };

    let html = '';
    Object.entries(game.fieldItems).forEach(([id, qtd]) => {
        if (qtd > 0 && itemDefs[id]) {
            html += `
                <div class="item-slot" onclick="useFieldItem('${id}')">
                    <span>${itemDefs[id].name}</span> 
                    <span style="color:var(--gold-light)">x<span id="qtd-${id}">${qtd}</span></span>
                </div>`;
        }
    });

    if (html === '') {
        html = '<div style="color:#aaa; padding:8px; font-size:11px; text-align:center; font-style:italic;">Mochila Vazia</div>';
    }

    menu.innerHTML = html;
};

window.showVersusScreen = function (callback) {
    const el = document.createElement('div');
    el.id = 'versus-screen';
    el.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:linear-gradient(135deg, #050505 0%, #1a1a2e 100%); z-index:10000; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#fff; font-family:Cinzel,serif;`;

    let pTeam = game.units.filter(u => u.faction === 1);
    let eTeam = game.units.filter(u => u.faction === 2);

    let pL = pTeam.find(u => u.isLeader) || { name: 'Player', emoji: '👑', filter: 'none' };
    let eL = eTeam.find(u => u.isLeader) || { name: 'CPU', emoji: '💀', filter: 'none' };

    let renderTeam = (team) => team.filter(u => !u.isLeader).map(u => `<span style="font-size:22px; filter:${u.filter}; margin:2px;">${u.emoji}</span>`).join('');

    el.innerHTML = `
        <div style="font-size:30px; color:var(--gold); margin-bottom:30px; letter-spacing:3px; text-shadow:0 0 10px var(--gold);">DUELO DE LENDAS</div>
        <div style="display:flex; width:100%; max-width:700px; justify-content:space-between; align-items:flex-start; padding: 0 20px;">
            <div style="text-align:center; flex:1;">
                <div style="font-size:70px; filter:${pL.filter}; drop-shadow(0 0 15px #4a9edd);">${pL.emoji}</div>
                <div style="color:#4a9edd; font-size:18px; margin-top:10px; font-weight:bold;">${pL.name}</div>
                <div style="margin-top:15px; display:flex; justify-content:center; flex-wrap:wrap; max-width:200px; margin-left:auto; margin-right:auto; background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid #4a9edd40;">${renderTeam(pTeam) || '<span style="font-size:12px;color:#888;">Solo</span>'}</div>
            </div>
            <div style="font-size:40px; font-weight:bold; color:var(--warning); font-style:italic; text-shadow:0 0 10px red; margin-top:30px;">VS</div>
            <div style="text-align:center; flex:1;">
                <div style="font-size:70px; filter:${eL.filter}; drop-shadow(0 0 15px #c0392b);">${eL.emoji}</div>
                <div style="color:#c0392b; font-size:18px; margin-top:10px; font-weight:bold;">${eL.name}</div>
                <div style="margin-top:15px; display:flex; justify-content:center; flex-wrap:wrap; max-width:200px; margin-left:auto; margin-right:auto; background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid #c0392b40;">${renderTeam(eTeam) || '<span style="font-size:12px;color:#888;">Solo</span>'}</div>
            </div>
        </div>
        <div style="margin-top:50px; font-size:16px; color:#aaa; animation: pulse 1.5s infinite; cursor:pointer; padding:15px; border:1px solid #aaa; border-radius:30px;">[ ⚔️Clique para Iniciar a Batalha⚔️ ]</div>
    `;

    document.body.appendChild(el);
    el.onclick = () => { el.remove(); callback(); };
};

window.openDuelHistory = function () {
    let el = $('duel-history-modal');
    if (!el) {
        el = document.createElement('div');
        el.id = 'duel-history-modal';
        el.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:flex; justify-content:center; align-items:center; flex-direction:column;`;
        document.body.appendChild(el);
    }

    let history = JSON.parse(localStorage.getItem('ht_duel_history') || '[]');
    let html = `<div style="background:var(--bg-panel); border:2px solid var(--gold); border-radius:10px; width:90%; max-width:500px; max-height:80vh; overflow-y:auto; padding:20px; text-align:center;">
        <h2 style="font-family:Cinzel,serif; color:var(--gold); margin-bottom:20px;">📜 Histórico de Duelos</h2>`;

    if (history.length === 0) {
        html += `<div style="color:#aaa; padding:20px;">Nenhum duelo registrado na Arena ainda.</div>`;
    } else {
        history.forEach(h => {
            let col = h.win ? '#4a9edd' : '#c0392b';
            let resTxt = h.win ? 'VITÓRIA' : 'DERROTA';
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.5); border-left:4px solid ${col}; padding:10px; margin-bottom:10px; border-radius:4px;">
                    <div style="flex:1; text-align:left;">
                        <div style="font-size:20px;">${h.pEmoji} <span style="font-size:12px;color:#aaa;">vs</span> ${h.eEmoji}</div>
                        <div style="font-size:10px; color:#888; margin-top:4px;">${h.date}</div>
                    </div>
                    <div style="font-size:14px; font-weight:bold; color:${col};">${resTxt}</div>
                </div>
            `;
        });
    }

    html += `<button class="btn-danger" style="margin-top:15px; width:100%; padding:10px; font-weight:bold;" onclick="document.getElementById('duel-history-modal').style.display='none'">Fechar Aba</button></div>`;
    el.innerHTML = html;
    el.style.display = 'flex';
};

window.openHallOfFame = function () {
    let el = $('hall-fame-modal');
    if (!el) {
        el = document.createElement('div');
        el.id = 'hall-fame-modal';
        el.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(8,8,12,0.98); z-index:10000; display:flex; justify-content:center; align-items:center; flex-direction:column; color:#fff; font-family:Cinzel,serif;`;
        document.body.appendChild(el);
    }

    let hof = JSON.parse(localStorage.getItem('ht_hall_of_fame') || '[]');
    let html = `<div style="background:var(--bg-panel); border:2px solid var(--gold); border-radius:10px; width:95%; max-width:680px; max-height:85vh; overflow-y:auto; padding:25px; text-align:center; box-shadow:0 0 25px rgba(212,175,55,0.25);">
        <h2 style="color:var(--gold); font-size:26px; margin-bottom:2px; text-shadow:0 0 10px rgba(212,175,55,0.4); letter-spacing:1px;">🏛️ HALL DA FAMA</h2>
        <p style="font-size:10px; color:#aaa; margin-bottom:25px; text-transform:uppercase; letter-spacing:1px;">Esquadrões Eternizados na Arena Suprema</p>`;

    if (hof.length === 0) {
        html += `<div style="color:#888; padding:50px 20px; font-style:italic; font-size:13px; border:1px dashed #444; border-radius:6px; background:rgba(0,0,0,0.3);">Nenhum esquadrão alcançou a glória eterna ainda.<br>Derrote o Chefe do Ato V na Campanha ou Roguelite!</div>`;
    } else {
        hof.forEach((h) => {
            let teamHtml = h.team.map(u => {
                let starIcon = u.starLevel === 2 ? '🥉' : u.starLevel === 3 ? '🥈' : u.starLevel >= 4 ? '🌟' : '';
                let equips = (u.equipment || []).map(eq => {
                    let itemDef = typeof ITEMS !== 'undefined' ? ITEMS[eq.id] : { icon: '🗡️' };
                    return `<span class="qol-tooltip" style="position:relative; background:rgba(0,0,0,0.6); padding:2px 4px; border-radius:3px; border:1px solid var(--gold-dark); font-size:10px; margin:0 2px;">${itemDef.icon}<span style="color:var(--gold); font-size:7px; font-weight:bold;">L${eq.level}</span></span>`;
                }).join('');

                return `
                    <div style="background:rgba(20,20,30,0.8); border:1px solid rgba(255,255,255,0.08); padding:8px 4px; border-radius:6px; width:105px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:between; box-shadow:0 2px 5px rgba(0,0,0,0.5);">
                        <div style="font-size:28px; filter:${u.filter || 'none'}; margin-bottom:4px;">${u.emoji}</div>
                        <div style="font-size:10px; font-weight:bold; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:95px;">${u.name}</div>
                        <div style="font-size:9px; color:var(--gold-light); margin:2px 0;">Lv ${u.level} ${starIcon}</div>
                        <div style="display:flex; justify-content:center; flex-wrap:wrap; gap:2px; margin-top:4px; min-height:16px;">${equips || '<span style="font-size:8px;color:#555;font-style:italic;">Sem Itens</span>'}</div>
                    </div>
                `;
            }).join('');

            html += `
                <div style="background:rgba(15,15,22,0.8); border:1px solid var(--gold); padding:15px; margin-bottom:20px; border-radius:8px; text-align:left; box-shadow:inset 0 0 10px rgba(0,0,0,0.8);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(212,175,55,0.25); padding-bottom:8px; margin-bottom:12px;">
                        <div>
                            <span style="font-size:18px; color:var(--gold); font-weight:bold; text-shadow:0 0 5px rgba(212,175,55,0.2);">${h.leader.emoji} ${h.leader.name}</span>
                            <span style="font-size:9px; background:rgba(212,175,55,0.15); color:var(--gold-light); border:1px solid var(--gold-dark); padding:1px 6px; border-radius:10px; margin-left:8px; font-weight:bold;">NÍVEL ${h.leader.level}</span>
                        </div>
                        <div style="text-align:right; font-size:10px; color:#999; font-family:sans-serif;">
                            <div style="font-family:Cinzel; color:#fff; font-size:11px; font-weight:bold; margin-bottom:2px;">${h.mode.toUpperCase()}</div>
                            <div>${h.date}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:start;">
                        ${teamHtml}
                    </div>
                </div>
            `;
        });
    }

    html += `<button class="btn-danger" style="margin-top:15px; width:100%; padding:12px; font-weight:bold; font-size:14px; letter-spacing:1px; box-shadow:0 4px 10px rgba(231,76,60,0.3);" onclick="document.getElementById('hall-fame-modal').style.display='none'">Fechar Galeria</button></div>`;
    el.innerHTML = html;
    el.style.display = 'flex';
};

// ==========================================
// CONTROLE DE ABAS DO GERENCIAMENTO (MOBILE)
// ==========================================
window.switchMgmtTab = function (tabId, btn) {
    // 1. Remove a cor de "ativo" de todos os botões de aba
    document.querySelectorAll('.mgmt-tab-btn').forEach(b => b.classList.remove('active'));

    // 2. Acende o botão que foi clicado
    if (btn) btn.classList.add('active');

    // 3. Esconde todos os painéis (no celular)
    document.querySelectorAll('.mgmt-panel').forEach(p => p.classList.remove('active-panel'));

    // 4. Mostra apenas o painel solicitado
    const target = document.getElementById('panel-' + tabId);
    if (target) target.classList.add('active-panel');
};

// ==========================================
// EDITOR DE MAPAS IN-GAME
// ==========================================
window.currentEditorBrush = 'PLAINS'; // A tinta inicial do pincel

window.initMapEditorUI = function () {
    const palette = $('editor-terrain-palette');
    if (!palette) return;
    palette.innerHTML = '';

    // Loop que varre todos os terrenos que existem no seu jogo
    Object.values(TERRAINS).forEach(t => {
        // Pula os terrenos de efeito mágico temporário para não sujar a paleta
        if (t.id === 'BURNING_FOREST' || t.id === 'ELECTRIC_WATER' || t.id === 'ASHES') return;

        const btn = document.createElement('button');
        btn.className = `editor-palette-btn qol-tooltip ${t.id === currentEditorBrush ? 'active' : ''}`;

        // Ícone do terreno e o Tooltip pra você saber o que está pintando
        btn.innerHTML = `
            ${t.icon}
            <span class="qol-tooltiptext" style="font-size:10px;">${t.name}</span>
        `;

        // Ao clicar numa tinta, acende o botão e atualiza o pincel
        btn.onclick = () => {
            currentEditorBrush = t.id;
            document.querySelectorAll('.editor-palette-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };

        palette.appendChild(btn);
    });
};

// Ação dos Botões da Barra de Ferramentas
$('btn-editor-clear').onclick = () => {
    if (confirm("Tem certeza que deseja apagar tudo?")) {
        game.map.forEach(h => h.terrain = TERRAINS.PLAINS);
        renderer.draw();
    }
};

$('btn-editor-exit').onclick = () => {
    game.isEditorMode = false;
    location.reload(); // Recarrega a página para limpar a memória e voltar ao menu
};

// ==========================================
// SISTEMA DE SALVAR/CARREGAR NO EDITOR
// ==========================================
$('btn-editor-save').onclick = () => {
    let name = $('editor-map-name').value.trim();
    if (!name) {
        alert("Por favor, digite um nome para o mapa antes de salvar!");
        return;
    }

    let exportData = [];
    game.map.forEach(h => {
        // O SEGREDO DA COMPRESSÃO: Ignora as planícies sem variações visuais!
        if (h.terrain.id === 'PLAINS' && h.customVar === undefined) return;

        let node = { q: h.q, r: h.r, tId: h.terrain.id };
        if (h.customVar !== undefined) node.cV = h.customVar;
        exportData.push(node);
    });

    let saved = JSON.parse(localStorage.getItem('HexTactics_SavedMaps') || '{}');
    saved[name] = exportData;
    localStorage.setItem('HexTactics_SavedMaps', JSON.stringify(saved));

    alert(`O mapa '${name}' foi salvo com sucesso no seu Editor!`);
};

$('btn-editor-load').onclick = () => {
    let saved = JSON.parse(localStorage.getItem('HexTactics_SavedMaps') || '{}');
    let list = $('editor-load-list');
    list.innerHTML = '';

    if (Object.keys(saved).length === 0) {
        list.innerHTML = '<p style="color:#aaa; font-size:12px; text-align:center;">Nenhum mapa salvo ainda.</p>';
    } else {
        // Cria um botão para cada mapa salvo na memória
        for (let mapName in saved) {
            let btn = document.createElement('button');
            btn.innerText = `📄 ${mapName}`;
            btn.style.cssText = 'padding: 10px; font-size: 14px; text-align: left; background: #2c3e50; border: 1px solid #34495e; color: white; cursor: pointer; border-radius: 4px;';
            btn.onclick = () => {
                loadMapToEditor(saved[mapName], mapName);
                $('editor-load-modal').classList.add('hidden');
            };
            list.appendChild(btn);
        }
    }
    $('editor-load-modal').classList.remove('hidden');
};

window.loadMapToEditor = function (mapData, mapName) {
    $('editor-map-name').value = mapName;
    game.map.clear();

    // Recria a grama primeiro (por segurança)
    game.cols = 15; game.rows = 11;
    for (let r = 0; r < game.rows; r++) {
        const off = Math.floor(r / 2);
        for (let q = -off; q < game.cols - off; q++) {
            game.map.set(`${q},${r}`, new Hex(q, r, TERRAINS.PLAINS));
        }
    }

    // Pinta os terrenos salvos por cima
    mapData.forEach(h => {
        let tDef = TERRAINS[h.tId] || TERRAINS.PLAINS;
        let hex = new Hex(h.q, h.r, tDef);
        if (h.cV !== undefined) hex.customVar = h.cV;
        game.map.set(`${h.q},${h.r}`, hex);
    });

    renderer.draw();
};

$('btn-editor-export').onclick = () => {
    let name = $('editor-map-name').value.trim();
    if (!name) {
        alert("Digite o nome do mapa (ex: WEST_NO0 ou NORTH_NO2) no campo 'Arquivo' antes de exportar!");
        return;
    }

    let exportData = [];
    game.map.forEach(h => {
        // Ignora as planícies vazias para o arquivo ficar levinho
        if (h.terrain.id === 'PLAINS' && h.customVar === undefined) return;

        let node = { q: h.q, r: h.r, tId: h.terrain.id };
        if (h.customVar !== undefined) node.cV = h.customVar;
        exportData.push(node);
    });

    // Formata o código exatamente para a leitura da Engine
    let fileContent = `window.CUSTOM_MAPS = window.CUSTOM_MAPS || {};\nwindow.CUSTOM_MAPS["${name}"] = ${JSON.stringify(exportData)};`;

    // 1. Joga o texto na caixinha e abre o modal (Para copiar à mão, se quiser)
    $('editor-export-text').value = fileContent;
    $('editor-export-modal').classList.remove('hidden');

    // 2. Mágica do Download (Cria um arquivo .js virtual e baixa automático)
    let blob = new Blob([fileContent], { type: 'text/javascript' });
    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.js`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

$('btn-editor-copy').onclick = () => {
    $('editor-export-text').select();
    document.execCommand('copy');
    alert('Código copiado para a Área de Transferência com sucesso!');
};

// Iniciar o Editor com uma tela em branco
window.startMapEditor = function () {
    $('main-menu').classList.add('hidden');
    $('game-container').classList.remove('hidden');
    $('map-editor-screen').classList.remove('hidden');

    // 1. Desliga a HUD de combate para o JavaScript não dar erro no console
    let uiLayer = $('ui-layer');
    if (uiLayer) uiLayer.classList.add('hidden');

    game.isEditorMode = true;
    game.isAnimating = false;
    game.currentLevel = 1; // Garante que o fundo da tela fique na cor clara do Ato 1
    game.map.clear();
    game.units = [];
    game.items.clear();

    // Cria uma caixa fantasma para evitar os erros vermelhos do mouse!
    if (!document.getElementById('combat-forecast')) {
        let fc = document.createElement('div');
        fc.id = 'combat-forecast';
        fc.style.display = 'none';
        document.body.appendChild(fc);
    }
    // 2. Cria um tabuleiro em branco de 15x11 e preenche tudo com Planícies
    game.cols = 15;
    game.rows = 11;
    for (let r = 0; r < game.rows; r++) {
        const off = Math.floor(r / 2);
        for (let q = -off; q < game.cols - off; q++) {
            game.map.set(`${q},${r}`, new Hex(q, r, TERRAINS.PLAINS));
        }
    }

    initMapEditorUI();
    renderer.initCamera(true);

    // 3. O SEGREDO: Força a câmera a focar no centro exato do mapa!
    let midQ = Math.floor(game.cols / 2);
    let midR = Math.floor(game.rows / 2);
    // Ajuste matemático para a inclinação do eixo Q no grid Hexagonal:
    renderer.centerOn(midQ - Math.floor(midR / 2), midR);
};

// ==========================================
// MÁQUINA DO TEMPO (CTRL+Z)
// ==========================================
window.editorUndoStack = [];

window.saveEditorState = function () {
    let state = [];
    game.map.forEach(h => state.push({ q: h.q, r: h.r, tId: h.terrain.id, cV: h.customVar }));
    window.editorUndoStack.push(state);
    // Limita a memória para os últimos 30 movimentos
    if (window.editorUndoStack.length > 30) window.editorUndoStack.shift();
};

window.addEventListener('keydown', (e) => {
    // Escuta o "Ctrl + Z"
    if (game.isEditorMode && e.ctrlKey && e.key.toLowerCase() === 'z') {
        if (window.editorUndoStack.length > 0) {
            let prevState = window.editorUndoStack.pop();
            game.map.clear();
            prevState.forEach(h => {
                let hex = new Hex(h.q, h.r, TERRAINS[h.tId] || TERRAINS.PLAINS);
                if (h.cV !== undefined) hex.customVar = h.cV;
                game.map.set(`${h.q},${h.r}`, hex);
            });
            renderer.draw();
        }
    }
});

window.openContinentMap = function () {
    hide('mode-screen');
    hide('result-screen');
    hide('game-container');
    hide('route-map-screen');
    hide('kingdom-screen');
    show('continent-map-screen');

    const container = $('macro-map-container');
    container.innerHTML = '';

    $('macro-info-panel').style.opacity = '0';
    $('macro-info-panel').style.pointerEvents = 'none';

    if (!game.conqueredRegions) game.conqueredRegions = [];

    // =========================================================
    // BLINDAGEM DA LORE (Sem variáveis duplicadas!)
    // =========================================================
    if (!game.leaderData) {
        game.leaderData = typeof LEADERS !== 'undefined' ? LEADERS[0] : {};
    }
    let facId = game.leaderData.loreFaction || 'SILVESTRE';
    let startNode = typeof LORE_FACTIONS !== 'undefined' && LORE_FACTIONS[facId] ? LORE_FACTIONS[facId].startNode : 'WEST';
    // =========================================================

    // Linhas de Conexão (Desenhadas dinamicamente pelas adjacências)
    let svg = `<svg style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;">`;
    let drawn = new Set();
    Object.values(CONTINENT_REGIONS).forEach(r1 => {
        r1.adj.forEach(adjId => {
            let r2 = CONTINENT_REGIONS[adjId];
            if (r2) {
                let key = [r1.id, r2.id].sort().join('-');
                if (!drawn.has(key)) {
                    drawn.add(key);
                    svg += `<line x1="${r1.x}%" y1="${r1.y}%" x2="${r2.x}%" y2="${r2.y}%" stroke="#444" stroke-width="2" stroke-dasharray="5,5"/>`;
                }
            }
        });
    });
    svg += `</svg>`;
    container.innerHTML += svg;

    Object.values(CONTINENT_REGIONS).forEach(reg => {
        let isConquered = game.conqueredRegions.includes(reg.id);

        // A MÁGICA DOS NÓS: Você só ataca se estiver ao lado de onde você já conquistou!
        let isReachable = false;
        if (game.conqueredRegions.length === 0) {
            // Se for o início do jogo, APENAS a base principal do líder está clicável
            if (reg.id === startNode) isReachable = true;
        } else {
            isReachable = reg.adj.some(adjId => game.conqueredRegions.includes(adjId));
        }

        let isLocked = false;
        if (reg.id === 'CENTER') {
            isLocked = game.conqueredRegions.length < 4; // Exige 4 domínios para liberar o Ômega
        }

        let canAttack = isReachable && !isConquered && !isLocked;

        let pin = document.createElement('div');
        let pinColor = isConquered ? 'var(--player-color)' : (canAttack ? 'var(--enemy-color)' : '#555');

        // Estilização: Se for um nó intermediário (NW, NE...), desenha menorzinho
        let isInter = ['NW', 'NE', 'SE', 'SW'].includes(reg.id);
        let sSize = isInter ? '35px' : '50px';
        let fSize = isInter ? '16px' : '24px';
        let anim = canAttack ? 'pulse 2s infinite' : 'none';

        pin.style.cssText = `position:absolute; top:${reg.y}%; left:${reg.x}%; transform:translate(-50%, -50%); 
                             background:rgba(10,10,15,0.9); border:2px solid ${pinColor}; border-radius:50%; 
                             width:${sSize}; height:${sSize}; display:flex; justify-content:center; align-items:center; 
                             font-size:${fSize}; cursor:${!canAttack && !isConquered ? 'not-allowed' : 'pointer'}; box-shadow:0 0 15px ${pinColor}80;
                             animation:${anim}; transition:transform 0.2s;`;

        pin.innerHTML = reg.icon;
        pin.removeAttribute('disabled');
        pin.classList.remove('locked', 'disabled');
        pin.style.setProperty('pointer-events', 'auto', 'important');
        pin.style.setProperty('cursor', 'pointer', 'important');

        pin.onclick = () => {
            $('macro-region-title').innerText = reg.name;
            $('macro-region-info').innerHTML = `
                <i>${reg.desc}</i><br><br>
                <b>Bioma Predominante:</b> ${reg.biome}
            `;

            const btnStart = $('btn-macro-start');

            if (isUnlocked) {
                $('macro-region-status').innerText = '✅ Setor Seguro / Liberado';
                $('macro-region-status').style.color = 'var(--player-color)';
                $('macro-region-threat').innerHTML = 'Região pacificada. Seus aliados patrulham esta área.';

                btnStart.innerText = 'VOLTAR A ESTA REGIÃO';
                btnStart.className = 'btn-secondary';
                btnStart.disabled = false;
                btnStart.onclick = () => {
                    game.currentRegionId = reg.id;
                    hide('continent-map-screen');
                    generateRouteMap();
                    renderRouteMap();
                };
            } else if (isNextTarget) {
                $('macro-region-status').innerText = '⚠️ Dominado pelo Rival';
                $('macro-region-status').style.color = 'var(--enemy-color)';
                let bossHint = reg.id === 'CENTER' ? 'Ameaça Suprema: O Leviatã Umbral aguarda.' : 'Ameaça Rival: Forças inimigas controlam este setor.';
                $('macro-region-threat').innerHTML = bossHint;

                btnStart.innerText = game.conqueredRegions.length === 0 ? 'RETOMAR CAPITAL' : 'INICIAR INCURSÃO';
                btnStart.className = 'btn-success';
                btnStart.disabled = false;
                btnStart.onclick = () => {
                    game.currentRegionId = reg.id;
                    game.currentLevel = game.conqueredRegions.length + 1;

                    if (!game.eventFlags) game.eventFlags = {};
                    if (reg.biome === 'SNOW') game.eventFlags.forceSnow = true;

                    hide('continent-map-screen');
                    generateRouteMap();
                    renderRouteMap();
                };
            } else {
                $('macro-region-status').innerText = '🔒 Setor Bloqueado (Névoa de Guerra)';
                $('macro-region-status').style.color = '#7f8c8d';
                $('macro-region-threat').innerHTML = 'Você precisa conquistar as regiões adjacentes antes de marchar para cá.';

                btnStart.innerText = 'CAMINHO BLOQUEADO';
                btnStart.className = 'btn-danger';
                btnStart.disabled = true;
                btnStart.onclick = null;
            }

            $('macro-info-panel').style.opacity = '1';
            $('macro-info-panel').style.pointerEvents = 'auto';
        };

        container.appendChild(pin);
    });
};

window.openBlackMarket = function () {
    // Blindagem: Garante que a mochila de recursos exista
    if (!game.resources) game.resources = {};

    // 1. POOL DE CONSUMÍVEIS (Sorteia 5)
    const consumablesPool = [
        { id: 'POTION', name: 'Poção', icon: '🧪', price: 10, desc: 'Cura HP' },
        { id: 'BANDAGE', name: 'Bandagem', icon: '🩹', price: 5, desc: 'Cura sangramento' },
        { id: 'MEAT', name: 'Isca de Carne', icon: '🍖', price: 15, desc: 'Atrai feras' },
        { id: 'APPLE', name: 'Maçã', icon: '🍎', price: 8, desc: 'Cura leve' },
        { id: 'MAGIC', name: 'Esfera Mágica', icon: '🔮', price: 20, desc: 'Recupera Mana' },
        { id: 'SCROLL', name: 'Pergaminho', icon: '📜', price: 25, desc: 'Magia aleatória' }
    ];
    let shopItems = consumablesPool.sort(() => 0.5 - Math.random()).slice(0, 5);

    // 2. LISTA DE RECURSOS PARA CONTRABANDO (Cotação Fixa)
    const resourceList = [
        { id: 'wood', name: 'Madeira', icon: '🌲', buy: 4, sell: 1 },
        { id: 'stone', name: 'Pedra', icon: '🪨', buy: 4, sell: 1 },
        { id: 'scales', name: 'Escamas', icon: '🐟', buy: 6, sell: 2 },
        { id: 'sand', name: 'Areia', icon: '⏳', buy: 4, sell: 1 },
        { id: 'garras', name: 'Garras', icon: '🐾', buy: 10, sell: 4 },
        { id: 'asas', name: 'Asas', icon: '🪽', buy: 15, sell: 6 },
        { id: 'ervas', name: 'Ervas', icon: '🌿', buy: 8, sell: 3 },
        { id: 'ferro', name: 'Ferro', icon: '🛡️', buy: 12, sell: 5 },
        { id: 'veneno', name: 'Veneno', icon: '☠️', buy: 15, sell: 6 },
        { id: 'po_magico', name: 'Pó Mágico', icon: '✨', buy: 20, sell: 8 },
        { id: 'brasa', name: 'Brasa', icon: '🔥', buy: 15, sell: 6 }
    ];

    // 3. CONSTRUÇÃO DO HTML DA LOJA
    let overlay = document.createElement('div');
    overlay.id = 'black-market-overlay';
    // O overflow-y:auto garante que o jogador possa rolar a tela se a lista ficar muito grande!
    overlay.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.92); z-index:10000; display:flex; justify-content:flex-start; align-items:center; flex-direction:column; color:white; font-family:Arial, sans-serif; overflow-y:auto; padding: 40px 20px; box-sizing:border-box;`;

    let html = `
        <h1 style="color:#f1c40f; text-shadow: 0 0 15px #f1c40f; margin-bottom: 5px;">⛺ Mercado Negro</h1>
        <p style="margin-bottom: 20px; color:#bdc3c7;">"Seja bem-vindo. Nós compramos de tudo."</p>
        <div style="font-size: 26px; color:var(--gold); margin-bottom: 30px; font-weight:bold; background:#2c3e50; padding:10px 20px; border-radius:10px; border:2px solid #f1c40f;">Seu Ouro: <span id="bm-gold">${game.gold}</span>💰</div>
        
        <h3 style="color:#e74c3c; border-bottom: 1px solid #e74c3c; padding-bottom:5px; margin-bottom: 15px; width:100%; max-width:800px; text-transform:uppercase; letter-spacing:2px;">Suprimentos Ilícitos</h3>
        <div style="display:flex; gap: 15px; flex-wrap:wrap; justify-content:center; max-width: 800px; margin-bottom: 40px;">
    `;

    // Renderiza os Itens de Campo
    shopItems.forEach((item, index) => {
        html += `
            <div style="background:#2c3e50; border:2px solid #34495e; border-radius:10px; padding:15px; text-align:center; width:130px; box-shadow: 0 4px 8px rgba(0,0,0,0.4);">
                <div style="font-size:35px; margin-bottom:5px;">${item.icon}</div>
                <h4 style="margin:0 0 5px 0; font-size:14px; color:#ecf0f1;">${item.name}</h4>
                <div style="font-size:11px; color:#95a5a6; margin-bottom:15px; height: 30px;">${item.desc}</div>
                <button id="bm-btn-${index}" style="background:#f1c40f; color:#000; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; width:100%; transition:0.2s;">Comprar ${item.price}💰</button>
            </div>
        `;
    });

    html += `</div>
        <h3 style="color:#9b59b6; border-bottom: 1px solid #9b59b6; padding-bottom:5px; margin-bottom: 15px; width:100%; max-width:800px; text-transform:uppercase; letter-spacing:2px;">Contrabando de Recursos</h3>
        <div style="display:flex; gap: 15px; flex-wrap:wrap; justify-content:center; max-width: 900px; margin-bottom: 40px;">
    `;

    // Renderiza os Recursos (Bolsa de Valores do Mercado)
    resourceList.forEach(res => {
        let currentAmt = game.resources[res.id] || 0;
        html += `
            <div style="background:#1a252f; border:1px solid #9b59b6; border-radius:8px; padding:12px; text-align:center; width:140px; box-shadow: 0 4px 8px rgba(0,0,0,0.5);">
                <div style="font-size:25px;">${res.icon}</div>
                <div style="font-size:14px; font-weight:bold; margin:5px 0; color:#ecf0f1;">${res.name}</div>
                <div style="font-size:12px; color:#3498db; margin-bottom:12px;">Estoque: <span id="bm-res-${res.id}" style="font-weight:bold; font-size:14px;">${currentAmt}</span></div>
                
                <div style="display:flex; justify-content:space-between; gap:6px;">
                    <button id="bm-buy-${res.id}" style="flex:1; background:#c0392b; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.1s;" title="Pagar ${res.buy} Ouro por 1">-${res.buy}💰</button>
                    <button id="bm-sell-${res.id}" style="flex:1; background:#27ae60; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.1s;" title="Vender 1 por ${res.sell} Ouro">+${res.sell}💰</button>
                </div>
            </div>
        `;
    });

    html += `</div><button id="bm-close" style="margin-bottom:60px; background:#e74c3c; color:white; border:none; padding:15px 40px; font-size:18px; font-weight:bold; border-radius:8px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition:0.2s;">Sair da Tenda</button>`;

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // ==========================================
    // LÓGICA DOS BOTÕES
    // ==========================================

    // 1. Botões de Itens Consumíveis
    shopItems.forEach((item, index) => {
        let btn = document.getElementById(`bm-btn-${index}`);
        btn.onclick = () => {
            if (game.gold >= item.price) {
                game.gold -= item.price;
                document.getElementById('bm-gold').innerText = game.gold;
                if (typeof updateUI === 'function') updateUI();

                const mapping = { 'MEAT': 'isca', 'MAGIC': 'sphere', 'POTION': 'potion', 'BANDAGE': 'bandage', 'SCROLL': 'scroll', 'APPLE': 'apple' };
                let mapped = mapping[item.id];
                if (mapped) {
                    if (!game.fieldItems) game.fieldItems = { isca: 0, rede: 0, potion: 0, bandage: 0, scroll: 0, sphere: 0, apple: 0 };
                    game.fieldItems[mapped] = (game.fieldItems[mapped] || 0) + 1;
                }

                btn.innerText = "Comprado!";
                btn.style.background = "#27ae60";
                btn.style.color = "white";
                btn.disabled = true;
            } else {
                btn.innerText = "Pobre!";
                btn.style.background = "#e74c3c";
                setTimeout(() => { if (!btn.disabled) { btn.innerText = `Comprar ${item.price}💰`; btn.style.background = "#f1c40f"; } }, 1000);
            }
        };
    });

    // 2. Botões de Compra e Venda de Recursos (Bolsa de Valores)
    resourceList.forEach(res => {
        let btnBuy = document.getElementById(`bm-buy-${res.id}`);
        let btnSell = document.getElementById(`bm-sell-${res.id}`);
        let qtySpan = document.getElementById(`bm-res-${res.id}`);

        // Ação de Comprar
        btnBuy.onclick = () => {
            if (game.gold >= res.buy) {
                game.gold -= res.buy;
                game.resources[res.id] = (game.resources[res.id] || 0) + 1;
                document.getElementById('bm-gold').innerText = game.gold;
                qtySpan.innerText = game.resources[res.id];
                qtySpan.style.color = "#2ecc71"; // Pisca verde rápido
                setTimeout(() => qtySpan.style.color = "#3498db", 200);
                if (typeof updateUI === 'function') updateUI();
            } else {
                btnBuy.style.background = "#000"; // Feedback de falha
                setTimeout(() => btnBuy.style.background = "#c0392b", 200);
            }
        };

        // Ação de Vender
        btnSell.onclick = () => {
            if ((game.resources[res.id] || 0) > 0) {
                game.resources[res.id] -= 1;
                game.gold += res.sell;
                document.getElementById('bm-gold').innerText = game.gold;
                qtySpan.innerText = game.resources[res.id];
                qtySpan.style.color = "#e74c3c"; // Pisca vermelho rápido
                setTimeout(() => qtySpan.style.color = "#3498db", 200);
                if (typeof updateUI === 'function') updateUI();
            } else {
                btnSell.style.background = "#000"; // Feedback de falha (Não tem o recurso)
                setTimeout(() => btnSell.style.background = "#27ae60", 200);
            }
        };
    });

    // 3. Fechar Loja
    document.getElementById('bm-close').onclick = () => overlay.remove();
};

window.openArcaneForge = function () {
    let forgeState = { slot1: null, slot2: null, result: null, mode: 'MERGE' }; // mode: 'MERGE' ou 'CRAFT'

    let overlay = document.createElement('div');
    overlay.id = 'forge-overlay';
    overlay.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(5,5,10,0.95); z-index:10000; display:flex; justify-content:center; align-items:center; color:white; font-family:'Cinzel', serif;`;

    const renderForge = () => {
        let html = `
            <div style="background:var(--bg-panel); border:2px solid var(--gold-dark); border-radius:8px; width:95%; max-width:800px; height:80vh; display:flex; flex-direction:column; box-shadow:0 0 30px rgba(201, 162, 39, 0.2);">
                <div style="text-align:center; padding:15px; border-bottom:1px solid #444;">
                    <h2 style="color:var(--gold); margin:0;">🔨 FORJA ARCANA</h2>
                    <div style="display:flex; justify-content:center; gap:10px; margin-top:10px;">
                        <button class="btn-${forgeState.mode === 'MERGE' ? 'success' : 'secondary'}" onclick="document.getElementById('forge-overlay').__setMode('MERGE')">Síntese (Inventário)</button>
                        <button class="btn-${forgeState.mode === 'CRAFT' ? 'success' : 'secondary'}" onclick="document.getElementById('forge-overlay').__setMode('CRAFT')">Forjar (Receitas)</button>
                    </div>
                </div>

                <div style="display:flex; flex:1; overflow:hidden;">
                    <div style="width:50%; border-right:1px solid #444; padding:15px; overflow-y:auto; background:rgba(0,0,0,0.3);">
                        <h4 style="color:#aaa; text-transform:uppercase; margin-top:0;">${forgeState.mode === 'MERGE' ? 'Seu Inventário & Materiais' : 'Plantas de Biomante'}</h4>
                        <div id="forge-list-container" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>

                    <div style="width:50%; padding:20px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(circle, rgba(40,30,10,0.8) 0%, transparent 80%);">
                        <div style="display:flex; align-items:center; gap:15px; margin-bottom:40px;">
                            <div id="f-slot-1" style="width:70px; height:70px; border:2px dashed #777; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:35px; background:rgba(0,0,0,0.6); cursor:pointer;" onclick="document.getElementById('forge-overlay').__clearSlot(1)">
                                ${forgeState.slot1 ? forgeState.slot1.icon : ''}
                            </div>
                            <div style="font-size:24px; color:#777;">+</div>
                            <div id="f-slot-2" style="width:70px; height:70px; border:2px dashed #777; border-radius:10px; display:flex; justify-content:center; align-items:center; font-size:35px; background:rgba(0,0,0,0.6); cursor:pointer;" onclick="document.getElementById('forge-overlay').__clearSlot(2)">
                                ${forgeState.slot2 ? forgeState.slot2.icon : (forgeState.mode === 'CRAFT' ? '🔒' : '')}
                            </div>
                            <div style="font-size:24px; color:var(--gold);">➔</div>
                            <div id="f-slot-3" style="width:90px; height:90px; border:2px solid ${forgeState.result ? 'var(--gold)' : '#444'}; border-radius:10px; display:flex; flex-direction:column; justify-content:center; align-items:center; background:${forgeState.result ? 'rgba(201, 162, 39, 0.2)' : 'rgba(0,0,0,0.8)'}; box-shadow:${forgeState.result ? '0 0 20px var(--gold)' : 'none'};">
                                <span style="font-size:40px;">${forgeState.result ? forgeState.result.icon : '❓'}</span>
                            </div>
                        </div>

                        <div style="height:60px; text-align:center; margin-bottom:20px;">
                            ${forgeState.result ? `<strong style="color:var(--gold); font-size:18px;">${forgeState.result.name}</strong><br><span style="font-size:12px; color:#ccc;">${forgeState.result.desc}</span>` : '<span style="color:#777;">Preencha os slots para ver o resultado...</span>'}
                        </div>

                        <button id="btn-synthesize" class="btn-success" style="padding:15px 40px; font-size:18px; font-weight:bold; letter-spacing:2px; ${!forgeState.result ? 'opacity:0.3; pointer-events:none;' : 'box-shadow:0 0 15px var(--success);'}" onclick="document.getElementById('forge-overlay').__synthesize()">SINTETIZAR</button>
                    </div>
                </div>
                <div style="padding:10px; border-top:1px solid #444; text-align:right;">
                    <button class="btn-danger" onclick="document.getElementById('forge-overlay').remove()">Sair da Forja</button>
                </div>
            </div>
        `;
        overlay.innerHTML = html;

        // Preenche a lista da esquerda
        let listContainer = document.getElementById('forge-list-container');

        if (forgeState.mode === 'CRAFT') {
            Object.values(RECIPES).forEach(rec => {
                if (rec.isLocked) return;
                // Checa se o jogador tem os recursos
                let canAfford = Object.entries(rec.cost).every(([r, a]) => r === 'gold' ? game.gold >= a : (game.resources[r] || 0) >= a);

                let btn = document.createElement('div');
                // Se não tiver recurso, o cursor vira o símbolo de 🚫
                btn.style.cssText = `background:rgba(20,20,30,0.8); border:1px solid ${canAfford ? 'var(--gold-dark)' : '#444'}; padding:10px; border-radius:6px; cursor:${canAfford ? 'pointer' : 'not-allowed'}; opacity:${canAfford ? 1 : 0.4};`;

                let costStr = Object.entries(rec.cost).map(([r, a]) => `${a} ${r.toUpperCase()}`).join(' | ');
                btn.innerHTML = `<strong>${rec.icon} ${rec.name}</strong><br><small style="color:${canAfford ? '#aaa' : '#e74c3c'};">Custo: ${costStr}</small>`;

                btn.onclick = () => {
                    // ==========================================
                    // A TRAVA DE SEGURANÇA QUE FALTAVA!
                    // ==========================================
                    if (!canAfford) {
                        if (typeof showMessage === 'function') showMessage("Recursos insuficientes!", "#e74c3c");
                        return; // O código morre aqui e não deixa a receita ir pro slot!
                    }

                    forgeState.slot1 = { type: 'RECIPE', icon: '📜', data: rec };
                    forgeState.slot2 = null; // Craft não usa slot 2
                    forgeState.result = { icon: rec.icon, name: rec.name, desc: rec.desc };
                    renderForge();
                };
                listContainer.appendChild(btn);
            });
        } else {
            // Modo MERGE (Inventário + Materiais)
            game.inventory.forEach((item, invIdx) => {
                let iDef = ITEMS[item.id];
                let btn = document.createElement('div');
                btn.style.cssText = `background:rgba(20,20,30,0.8); border:1px solid #444; padding:10px; border-radius:6px; cursor:pointer; display:flex; justify-content:space-between;`;
                btn.innerHTML = `<span>${iDef.icon} ${iDef.name}</span> <span style="color:var(--gold);">Lv${item.level}</span>`;
                btn.onclick = () => {
                    let obj = { type: 'ITEM', icon: iDef.icon, name: iDef.name, data: item, invIdx: invIdx };
                    if (!forgeState.slot1) forgeState.slot1 = obj;
                    else if (!forgeState.slot2 && forgeState.slot1.invIdx !== invIdx) forgeState.slot2 = obj;
                    calculateResult(); renderForge();
                };
                listContainer.appendChild(btn);
            });

            // Materiais Biológicos
            ['brasa', 'veneno', 'asas', 'garras'].forEach(mat => {
                if ((game.resources[mat] || 0) > 0) {
                    let btn = document.createElement('div');
                    btn.style.cssText = `background:rgba(30,10,10,0.8); border:1px dashed #e74c3c; padding:10px; border-radius:6px; cursor:pointer; display:flex; justify-content:space-between;`;
                    let icons = { brasa: '🔥', veneno: '☠️', asas: '🪽', garras: '🐾' };
                    btn.innerHTML = `<span>${icons[mat]} Catalisador: ${mat.toUpperCase()}</span> <span>x${game.resources[mat]}</span>`;
                    btn.onclick = () => {
                        let obj = { type: 'MAT', icon: icons[mat], name: mat, data: mat };
                        if (!forgeState.slot1) forgeState.slot1 = obj;
                        else if (!forgeState.slot2) forgeState.slot2 = obj;
                        calculateResult(); renderForge();
                    };
                    listContainer.appendChild(btn);
                }
            });
        }
    };

    const calculateResult = () => {
        forgeState.result = null;
        if (forgeState.slot1 && forgeState.slot2) {
            let s1 = forgeState.slot1, s2 = forgeState.slot2;
            // REGRA 1: Fusão de Level (Item Igual)
            if (s1.type === 'ITEM' && s2.type === 'ITEM' && s1.data.id === s2.data.id && s1.data.level === s2.data.level) {
                let nLvl = s1.data.level + 1;
                forgeState.result = { icon: s1.icon, name: `${s1.name} +1`, desc: `Aumenta para o Nível ${nLvl}` };
            }
            // REGRA 2: Infusão Arcana (Item + Material)
            else if (s1.type === 'ITEM' && s2.type === 'MAT') {
                let comboKey = `${s1.data.id}_${s2.data}`;
                if (INFUSIONS[comboKey]) {
                    let rDef = ITEMS[INFUSIONS[comboKey]];
                    forgeState.result = { icon: rDef.icon, name: rDef.name, desc: rDef.desc, infusionId: INFUSIONS[comboKey] };
                }
            } else if (s2.type === 'ITEM' && s1.type === 'MAT') {
                let comboKey = `${s2.data.id}_${s1.data}`;
                if (INFUSIONS[comboKey]) {
                    let rDef = ITEMS[INFUSIONS[comboKey]];
                    forgeState.result = { icon: rDef.icon, name: rDef.name, desc: rDef.desc, infusionId: INFUSIONS[comboKey] };
                }
            }
        }
    };

    overlay.__setMode = (m) => { forgeState.mode = m; forgeState.slot1 = null; forgeState.slot2 = null; forgeState.result = null; renderForge(); };
    overlay.__clearSlot = (s) => { if (s === 1) forgeState.slot1 = null; else forgeState.slot2 = null; calculateResult(); renderForge(); };

    overlay.__synthesize = async () => {
        if (!forgeState.result) return;

        let btnSynthesize = document.getElementById('btn-synthesize');
        if (btnSynthesize) {
            btnSynthesize.style.pointerEvents = 'none';
            btnSynthesize.style.opacity = '0.3';
            btnSynthesize.innerText = 'FORJANDO...';
        }

        // Efeito Visual de Colisão
        document.getElementById('f-slot-1').style.transform = 'translateX(50px)';
        document.getElementById('f-slot-2').style.transform = 'translateX(-50px)';
        await sleep(200);

        if (forgeState.mode === 'CRAFT') {
            let rec = forgeState.slot1.data;
            Object.entries(rec.cost).forEach(([r, a]) => { if (r === 'gold') game.gold -= a; else game.resources[r] -= a; });
            game.inventory.push({ id: rec.resultItem, level: 1 });
            if (typeof showZeldaPopup === 'function') await showZeldaPopup(rec.icon, "Item Forjado!", rec.name);
        } else {
            let s1 = forgeState.slot1, s2 = forgeState.slot2;

            // Consome do inventário (remove do fim para o começo para não bugar os index)
            if (s1.type === 'ITEM' && s2.type === 'ITEM') {
                let idxs = [s1.invIdx, s2.invIdx].sort((a, b) => b - a);
                game.inventory.splice(idxs[0], 1); game.inventory.splice(idxs[1], 1);
                game.inventory.push({ id: s1.data.id, level: s1.data.level + 1 });
            } else {
                let itmSlot = s1.type === 'ITEM' ? s1 : s2;
                let matSlot = s1.type === 'MAT' ? s1 : s2;
                game.inventory.splice(itmSlot.invIdx, 1);
                game.resources[matSlot.data] -= 1;
                game.inventory.push({ id: forgeState.result.infusionId, level: itmSlot.data.level });
            }
            if (typeof showZeldaPopup === 'function') await showZeldaPopup(forgeState.result.icon, "Síntese Concluída!", forgeState.result.name);
        }

        updateKingdomResourcesUI();
        overlay.__setMode(forgeState.mode); // Reseta a tela
    };

    document.body.appendChild(overlay);
    renderForge();
};

window.useRecipeScroll = async function (recipeKey, inventoryIndex) {
    if (RECIPES[recipeKey]) {
        RECIPES[recipeKey].isLocked = false; // Desbloqueia!

        // Remove o pergaminho consumido da mochila
        game.inventory.splice(inventoryIndex, 1);

        // Popup estilo clássico
        if (typeof showZeldaPopup === 'function') {
            await showZeldaPopup('📜', "Nova Planta Aprendida!", RECIPES[recipeKey].name);
        }

        // Atualiza a tela de gerenciamento
        if (typeof renderManagement === 'function') renderManagement('inventory');
    }
};

window.openCharacterScreen = function (u, isBox, mode) {
    if (mode === 'readonly') return;

    let overlay = document.getElementById('char-equip-modal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'char-equip-modal';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,10,15,0.95); z-index:3000; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(5px);';
        document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden');

    const renderModal = () => {
        let btnTeamText = isBox ? 'Colocar no Time' : 'Tirar do Time';
        let btnTeamColor = isBox ? 'var(--success)' : 'var(--danger)';
        let disableTeamBtn = (u.isLeader) || (mode === 'battle');
        let btnStyle = disableTeamBtn ? 'opacity: 0.5; cursor: not-allowed;' : '';

        // 1. Renderiza os Equipamentos Atuais do Personagem
        let equipSlotsHtml = '';
        (u.equipment || []).forEach((eq, idx) => {
            let eqDef = ITEMS[eq.id];
            if (!eqDef) return;
            equipSlotsHtml += `
                <div onclick="unequipFromChar(${idx})" style="border: 1px solid var(--gold); padding: 8px; margin: 4px 0; cursor:pointer; background: rgba(0,0,0,0.6); border-radius: 8px; display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; text-align: left; transition: 0.2s;">
                    <div style="font-size: 24px; flex-shrink: 0; filter: drop-shadow(0 0 2px var(--gold));">${eqDef.icon}</div>
                    <div style="flex-grow: 1; line-height: 1.2;">
                        <div style="font-size: 12px; color: var(--gold-light); font-weight: bold;">${eqDef.name} <span style="font-size: 10px; color: #fff;">Lv${eq.level}</span></div>
                        <div style="font-size: 9px; color: #aaa; margin-top: 2px;">${eqDef.desc}</div>
                    </div>
                    <div style="font-size: 10px; color: #e74c3c; cursor: pointer; padding: 5px; font-weight: bold; text-transform: uppercase;">Remover</div>
                </div>
            `;
        });
        if (!u.equipment || u.equipment.length === 0) {
            equipSlotsHtml = '<div style="color: #666; font-size: 12px; padding: 10px; text-align: center;">Nenhum equipamento.</div>';
        }

        // 2. Renderiza a Mochila (Filtra pergaminhos)
        let invHtml = '';
        game.inventory.forEach((item, invIdx) => {
            if (item.isScroll) return;
            let iDef = ITEMS[item.id];
            if (!iDef) return;
            invHtml += `
                <div onclick="equipToChar(${invIdx})" style="border: 1px solid #444; padding: 8px; margin: 4px 0; cursor:pointer; background: rgba(20,20,30,0.8); border-radius: 6px; display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; text-align: left; transition: 0.2s;">
                    <div style="font-size: 24px; flex-shrink: 0;">${iDef.icon}</div>
                    <div style="flex-grow: 1; line-height: 1.2;">
                        <div style="font-size: 12px; color: #ddd; font-weight: bold;">${iDef.name} <span style="font-size: 10px; color: #fff;">Lv${item.level}</span></div>
                        <div style="font-size: 9px; color: #aaa; margin-top: 2px;">${iDef.desc}</div>
                    </div>
                    <div style="font-size: 10px; color: var(--success); cursor: pointer; padding: 5px; font-weight: bold; text-transform: uppercase;">Equipar</div>
                </div>
            `;
        });
        if (!invHtml) invHtml = '<div style="color:#666; font-size: 12px; padding: 10px; text-align: center;">Mochila vazia</div>';

        overlay.innerHTML = `
            <div class="modal-card" style="width: 95%; max-width: 380px; background: #1a1a1a; border: 2px solid var(--gold-dark); border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 0 20px rgba(0,0,0,0.8);">
                <div style="display:flex; align-items:center; gap: 15px; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <div style="font-size: 48px; filter: ${u.filter};">${u.emoji}</div>
                    <div style="text-align: left;">
                        <h2 style="color: var(--gold-light); margin: 0; font-family: Cinzel, serif;">${u.name}</h2>
                        <div style="color: #ddd; font-size: 12px; margin-top: 5px;">HP: ${u.hp}/${u.maxHp} &nbsp;|&nbsp; ATK: ${u.atk}</div>
                    </div>
                </div>
                
                <h3 style="font-size: 12px; color: var(--gold); border-bottom: 1px dashed #444; padding-bottom: 5px; text-align: left; margin: 0 0 5px 0;">Slot de Equipamentos</h3>
                <div style="display:flex; flex-direction: column; margin-bottom: 15px; min-height: 60px;">
                    ${equipSlotsHtml}
                </div>

                <h3 style="font-size: 12px; color: var(--gold); border-bottom: 1px dashed #444; padding-bottom: 5px; text-align: left; margin: 0 0 5px 0;">Inventário Disponível</h3>
                <div style="max-height: 180px; overflow-y: auto; padding-right: 5px; margin-bottom: 20px; display: flex; flex-direction: column;">
                    ${invHtml}
                </div>

                <div style="display:flex; gap: 10px; justify-content: space-between;">
                    <button id="btn-toggle-team" style="flex:2; background: ${btnTeamColor}; color: #fff; border: none; padding: 12px; border-radius: 6px; font-weight: bold; ${btnStyle}">${btnTeamText}</button>
                    <button id="btn-close-equip" style="flex:1; background: #555; color: #fff; border: none; padding: 12px; border-radius: 6px; font-weight: bold;">Fechar</button>
                </div>
            </div>
        `;

        // Lógica de fechar a tela
        document.getElementById('btn-close-equip').onclick = () => {
            overlay.classList.add('hidden');
            renderManagement(mode); // Atualiza a tela de trás com as novas mudanças
        };

        // Lógica de adicionar/remover da Box
        document.getElementById('btn-toggle-team').onclick = () => {
            if (disableTeamBtn) {
                if (u.isLeader) showMessage("O Líder não pode sair do campo.", '#e74c3c');
                if (mode === 'battle') showMessage("Não pode trocar de feras em combate!", '#e74c3c');
                return;
            }
            if (isBox) {
                if (deployedRoster.filter(x => !x.isLeader).length < window.getMaxBoxLimit()) {
                    rosterMemory.splice(rosterMemory.indexOf(u), 1);
                    deployedRoster.push(u);
                    overlay.classList.add('hidden');
                    renderManagement(mode);
                } else {
                    alert("Limite máximo em campo!");
                }
            } else {
                deployedRoster.splice(deployedRoster.indexOf(u), 1);
                rosterMemory.push(u);
                overlay.classList.add('hidden');
                renderManagement(mode);
            }
        };

        // Lógica de remover o equipamento e voltar pra mochila
        window.unequipFromChar = (idx) => {
            if (mode === 'battle') { showMessage("Equipamentos só podem ser alterados fora de combate!", '#f39c12'); return; }
            let eq = u.equipment[idx];
            if (!eq) return;
            let eqDef = ITEMS[eq.id];
            if (eqDef.onUnequip) eqDef.onUnequip(u, eq.level);

            u.equipment.splice(idx, 1);
            game.inventory.push(eq);
            renderModal();
        };

        // Lógica blindada para equipar sem duplicar itens
        window.equipToChar = (invIdx) => {
            if (mode === 'battle') { showMessage("Equipamentos só podem ser alterados fora de combate!", '#f39c12'); return; }
            let invItem = game.inventory[invIdx];
            let iDef = ITEMS[invItem.id];

            let existingEq = u.equipment.find(eq => eq.id === invItem.id);
            if (existingEq) {
                showMessage("Este monstro já possui este item! Use a Forja Arcana para fundi-lo.", '#f39c12');
                return;
            }

            // O splice extrai permanentemente o item do inventário
            let itemToEquip = game.inventory.splice(invIdx, 1)[0];
            u.equipment.push(itemToEquip);
            if (iDef && iDef.onEquip) iDef.onEquip(u, itemToEquip.level);

            renderModal(); // Redesenha com o slot ocupado
        };
    };

    renderModal();
};