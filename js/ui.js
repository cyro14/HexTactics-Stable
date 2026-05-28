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
        const sk = game.isRoguelite ? 'ht_save_rogue' : 'ht_save_camp';
        const sv = {
            resources: game.resources,
            kingdomMap: Array.from(game.kingdomMap.entries()),
            level: game.currentLevel, cols: game.cols, rows: game.rows, gold: game.gold,
            dna: game.dna || 0, // NOVO: Salva o DNA
            isRoguelite: game.isRoguelite, hasKey: game.hasKey, hasEgg: game.hasEgg,
            leaderId: game.leaderData.id,
            map: Array.from(game.map.values()).map(h => ({ q: h.q, r: h.r, tId: h.terrain.id, owner: h.owner })),
            items: Array.from(game.items.entries()),
            units: game.units.map(u => ({ ...u })),
            rosterMemory: rosterMemory.map(u => ({ ...u })),
            deployedRoster: deployedRoster.map(u => ({ ...u })),
            manaPool: game.manaPool, spentMana: game.spentMana, spellCooldowns: game.spellCooldowns,
            routeMap: game.routeMap, currentFloor: game.currentFloor, inventory: game.inventory,
            isBossStage: game.isBossStage, currentRouteType: game.currentRouteType
        };
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

function addLog(msg, col = '#9a8a6a') {
    const e = document.createElement('div');
    e.className = 'log-entry';
    e.style.borderLeftColor = col;
    e.innerText = msg;
    const combatLog = $('combat-log');
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
        if (MANA_TYPES[tag]) { game.manaPool[tag] = (game.manaPool[tag] || 0) + (count * 0.5); }
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
    container.innerHTML = '';
    let hasMana = false;
    Object.entries(game.manaPool).forEach(([tag, total]) => {
        if (total <= 0) return;
        const mt = MANA_TYPES[tag]; if (!mt) return;
        const spent = game.spentMana[tag] || 0;
        let available = Math.floor(total - spent);
        if (available <= 0 && Math.floor(total) <= 0) return;
        hasMana = true;
        const pip = document.createElement('span');
        pip.className = `mana-pip ${available > 0 ? 'available' : 'spent'}`;
        pip.style.background = available > 0 ? mt.col + '44' : 'rgba(30,30,40,0.7)';
        pip.style.color = mt.col; pip.style.borderColor = mt.col + '88';
        pip.style.width = 'auto'; pip.style.padding = '0 8px';
        pip.innerText = `${mt.icon} x${available}`;
        pip.style.padding = '0 4px';
        pip.style.fontSize = '9px';
        pip.title = `${mt.name}: ${available}/${Math.floor(total)}`;
        container.appendChild(pip);
    });
    if (!hasMana) { container.innerHTML = `<span style="font-size:10px;color:var(--text-dim);">Sem mana</span>`; }
    renderSpellBar();
}

function renderSpellBar() {
    const bar = $('spell-bar');
    if (!bar) return;
    bar.innerHTML = '';
    if (!game || game.currentTurn !== 1) return;

    // Se a unidade selecionada tiver magias, mostra a dela. Senão, mostra a do Líder.
    let caster = game.selectedUnit && game.selectedUnit.faction === 1 && game.selectedUnit.knownSpells && game.selectedUnit.knownSpells.length > 0
        ? game.selectedUnit
        : game.units.find(u => u.isLeader && u.faction === 1);

    if (!caster || !caster.knownSpells || !caster.knownSpells.length) return;

    caster.knownSpells.forEach(sid => {
        const spell = typeof SPELLS !== 'undefined' ? SPELLS.find(s => s.id === sid) : null;
        if (!spell) return;
        const cd = game.spellCooldowns[sid] || 0;

        let can = false;
        if (caster.isLeader) {
            can = canAffordSpell(spell, caster) && !game.isAnimating && cd === 0;
        } else {
            // Feras não gastam mana, apenas a ação de ataque
            can = !caster.hasAttacked && !game.isAnimating && cd === 0;
        }

        const isActive = game.activeSpell === sid;

        // Exibição visual diferente se for uma fera
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
                    const bar = $('spell-bar');
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
            const inc = income[tag] ? ` (+${income[tag] * 0.5}/t)` : '';
            const el = document.createElement('span');
            el.style.cssText = `background:${mt.col}22;border:1px solid ${mt.col}66;border-radius:4px;padding:3px 8px;font-size:12px;color:${mt.col};`;
            el.innerText = `${mt.icon} ${mt.name}: ${Math.floor(total - spent)}/${Math.floor(total)}${inc}`;
            manaDiv.appendChild(el);
        });
    }
    const grid = $('grimoire-grid'); grid.innerHTML = '';
    const grimTags = leader ? (leader.grimTags || []) : []; const known = leader ? (leader.knownSpells || []) : [];
    for (let lvl = 1; lvl <= 5; lvl++) {
        const spellsOfLevel = SPELLS.filter(s => { return s.tags.some(t => grimTags.includes(t)); }).filter(s => s.level === lvl);
        if (!spellsOfLevel.length) continue;
        const hdr = document.createElement('div');
        hdr.style.cssText = `grid-column:1/-1;font-family:Cinzel,serif;font-size:12px;color:var(--gold);border-bottom:1px solid var(--gold-dark);padding-bottom:4px;margin-top:8px;`;
        hdr.innerText = `── Nível ${lvl} ──`; grid.appendChild(hdr);
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

    // Atualiza os contadores individuais de Ouro e DNA
    const goldDisplay = $('ui-gold');
    if (goldDisplay && game) goldDisplay.innerText = game.gold;

    const dnaDisplay = $('ui-dna');
    if (dnaDisplay && game) dnaDisplay.innerText = game.dna || 0;

    updateManaUI();
    if (game && game.selectedUnit) {
        const u = game.selectedUnit; const col = u.faction === 1 ? '#4a9edd' : u.faction === 2 ? '#c0392b' : '#27ae60'; const st = u.faction === 1 ? 'Aliado' : u.faction === 2 ? 'Inimigo' : 'Fera';
        $('unit-portrait').style.cssText = `display:flex;border-color:${col};box-shadow:0 0 10px ${col}40;filter:${u.filter}`; $('unit-portrait').innerText = u.emoji;

        // NOVO: Permite clicar no retrato da HUD para inspecionar os custos e evoluções!
        $('unit-portrait').onclick = () => { window.showBeastDetails(u, true); };

        let starIcon = u.starLevel === 2 ? '🥉' : u.starLevel === 3 ? '🥈' : u.starLevel >= 4 ? '🌟' : '';
        $('unit-name').innerHTML = `<span style="color:${col}">[${st}]</span> ${u.name} <span style="color:var(--gold);font-size:11px;">Lv${u.level}${starIcon}</span>`;

        let res = game ? (game.resources || { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 }) : { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 };
        if ($('res-wood')) $('res-wood').innerText = res.wood;
        if ($('res-stone')) $('res-stone').innerText = res.stone;
        if ($('res-scales')) $('res-scales').innerText = res.scales;
        if ($('res-sand')) $('res-sand').innerText = res.sand;

        updateManaUI();

        const getStatusHTML = (id, name, desc, col) => `<div class="qol-tooltip tag-badge" style="background:rgba(20,20,30,0.9); border:1px solid ${col}; color:${col}; font-size:9px; padding:2px 6px; border-radius:4px; box-shadow:0 0 5px ${col}40; text-shadow:0 0 2px ${col}80;">${name}<span class="qol-tooltiptext">${desc}</span></div>`;

        let sH = '';
        if (u.status === 'poison') sH = getStatusHTML('poison', 'Envenenado', 'Perde HP a cada turno.', 'var(--success)');
        else if (u.status === 'stun') sH = getStatusHTML('stun', 'Atordoado', 'Perde o turno atual.', 'var(--warning)');
        else if (u.status === 'bind') sH = getStatusHTML('bind', 'Preso', 'Movimento reduzido a 0.', '#9b59b6');
        else if (u.status === 'chilled') sH = getStatusHTML('chilled', 'Congelado', 'Movimento reduzido em 2.', '#00ffff');
        else if (u.status === 'shielded') sH = getStatusHTML('shielded', 'Escudado', 'Recebe menos dano.', '#95a5a6');
        else if (u.faction === 0 && u.alerted) sH = getStatusHTML('alerted', '⚠️ Alerta!', 'Em estado de agressão.', 'var(--enemy-color)'); let ab = u.abilities.filter(x => x && ABILITY_DESCRIPTIONS[x]).map(ab => `<div class="btn-ability-link" onclick="window.showAbility('${ab}','${u.emoji}','${u.name}','${u.filter}')">📖 ${ABILITY_DESCRIPTIONS[ab].split(':')[0]}</div>`).join('');
        let tI = ''; const uH = game.map.get(`${u.q},${u.r}`); if (uH) { let defV = uH.terrain.def; if (u.fav.includes(uH.terrain.id)) defV += 0.2; tI = `<span style="color:#888;"> | 📍 ${uH.terrain.icon} ${uH.terrain.name} (${Math.round(defV * 100)}% Def)</span>`; }
        let tagsHtml = (u.tags || []).map(t => getTagHTML(t)).join('');

        $('unit-info').innerHTML = `<div style="display:flex;gap:10px;margin-top:2px;justify-content:flex-end;"><div>HP: ${u.hp}/${u.maxHp}</div><div>MP: ${u.mp}/${u.maxMp}</div></div><div style="color:var(--text-muted);margin-top:2px;">ATK: ${u.getEffectiveAtk(game)} | Alc: ${u.getEffectiveRange(game)}</div><div style="color:#888;font-size:10px;margin-top:1px;">${u.faction === 1 ? `XP: ${u.xp}/${u.maxXp}` : ''} ${tI}</div><div style="margin-top:2px;">${sH}</div><div style="margin-top:4px;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px;align-items:center;">${ab} ${tagsHtml}</div>`;
        if (u.isLeader && u.faction === 1 && !u.hasAttacked && u.status !== 'stun' && u.status !== 'bind') { show('btn-tame'); $('btn-tame').classList.toggle('active', game.tameMode); } else { hide('btn-tame'); }
    } else if (game && game.selectedHex) {
        const h = game.selectedHex, t = h.terrain; $('unit-portrait').style.cssText = `display:flex;border-color:#555;box-shadow:none;filter:none;`; $('unit-portrait').innerText = t.icon || '⬛';
        let o = h.owner === 1 ? " <span style='color:var(--player-color)'>(Sua)</span>" : h.owner === 2 ? " <span style='color:var(--enemy-color)'>(Inimigo)</span>" : "";
        $('unit-name').innerHTML = `<span style="color:var(--gold-light)">Terreno: ${t.name}${o}</span>`; $('unit-info').innerHTML = `<div style="margin-top:4px;color:var(--text-muted);">Custo Mov: ${t.cost}<br>Defesa Base: ${Math.round(t.def * 100)}%</div>`; hide('btn-tame');

        // NOVO: Remove a ação de clique se for apenas um terreno vazio
        $('unit-portrait').onclick = null;
    } else {
        hide('unit-portrait'); $('unit-name').innerHTML = '—'; $('unit-info').innerHTML = '<div style="color:var(--text-dim);">Selecione um alvo</div>'; hide('btn-tame');
        $('unit-portrait').onclick = null;
    }

    // INJEÇÃO DA MOCHILA DE ITENS
    if (!$('btn-field-items') && $('game-container')) {
        let itemBtn = document.createElement('button');
        itemBtn.id = 'btn-field-items';
        itemBtn.innerHTML = '🎒';
        itemBtn.title = "Ferramentas de Campo";
        itemBtn.onclick = () => {
            const menu = $('field-item-menu');
            menu.classList.toggle('hidden');
            if (!menu.classList.contains('hidden')) {
                renderFieldItemMenu(); // Reconstrói a lista com o que você realmente tem
            }
        };
        $('game-container').appendChild(itemBtn);

        let itemMenu = document.createElement('div');
        itemMenu.id = 'field-item-menu';
        itemMenu.className = 'hidden';
        $('game-container').appendChild(itemMenu);
    }

    // INJEÇÃO DO BOTÃO UNIVERSAL DE CANCELAR
    let cancelBtn = $('btn-cancel-action');
    if (!cancelBtn && $('game-container')) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-cancel-action';
        cancelBtn.className = 'btn-danger hidden';
        cancelBtn.innerHTML = '❌ Cancelar Ação';
        cancelBtn.style.cssText = 'position:absolute; bottom: 85px; left: 50%; transform: translateX(-50%); z-index: 100; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; box-shadow: 0 0 10px rgba(231,76,60,0.5); cursor: pointer;';

        cancelBtn.onclick = () => {
            if (game) {
                game.activeSpell = null;
                game.activeItem = null;
            }
            if (typeof renderSpellBar === 'function') renderSpellBar();
            updateUI();
            if (typeof renderer !== 'undefined') renderer.draw();
        };
        $('game-container').appendChild(cancelBtn);
    }

    // Mostra o botão apenas se algo estiver ativo para mirar
    if (cancelBtn && game) {
        if (game.activeSpell || game.activeItem) {
            cancelBtn.classList.remove('hidden');
        } else {
            cancelBtn.classList.add('hidden');
        }
    }

}

// ==========================================
// 4. LOJA, GERENCIAMENTO E INVENTÁRIO
// ==========================================
function generateShopItems() {
    shopItems = []; let arts = getActiveArtifacts();

    let bLvl = game && game.currentLevel ? game.currentLevel : 1;

    // --- LOJA EXCLUSIVA DO MODO DUELO ---
    if (game && game.isDuel) {
        let tags = game.leaderData.tags || [];
        let pool = [...BEASTS.LAND, ...BEASTS.WATER, ...BEASTS.SNOW].filter(b => b.tags && b.tags.some(t => tags.includes(t)) && !b.minLevel);
        if (pool.length === 0) pool = BEASTS.LAND;

        // Gera 6 Contratos Exclusivos da Tag do Líder
        for (let i = 0; i < 6; i++) {
            let rB = pool[Math.floor(Math.random() * pool.length)];
            shopItems.push({
                name: `Contrato: ${rB.name}`, icon: rB.e, desc: `Adiciona ${rB.name} à Box.`, cost: 10, rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'consumable', filter: rB.filter || 'none', action: async () => {
                    rosterMemory.push(new Unit({ q: 0, r: 0, faction: 1, isLeader: false, name: rB.name, baseName: rB.name, emoji: rB.e, hp: rB.hp, maxHp: rB.hp, mp: rB.mp, maxMp: rB.mp, atk: rB.atk, range: rB.range, level: 1, abilities: [...rB.abilities], isNew: true, filter: rB.filter, tags: rB.tags || [], fav: rB.fav || [] })); return true;
                }
            });
        }
        // Consumíveis e Equipamentos Fixos de Duelo
        //shopItems.push({ name: "Poção de Exército", icon: "🧪", desc: "Cura 30 HP de todos.", cost: 4, rarity: 'common', color: 'var(--rarity-common)', type: 'consumable', filter: 'none', action: async () => { rosterMemory.forEach(u => u.hp = Math.min(u.maxHp, u.hp + 30)); deployedRoster.forEach(u => u.hp = Math.min(u.maxHp, u.hp + 30)); return true; } });
        shopItems.push({ name: "Fruta da Evolução", icon: "🍎", desc: "+100 XP a uma fera.", cost: 8, rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'consumable', filter: 'none', action: async () => { let m = [...rosterMemory, ...deployedRoster].filter(u => !u.isLeader); if (m.length === 0) { alert("Nenhuma fera!"); return false; } let r = await window.promptSelectUnit("Quem receberá XP?", m); if (r) { r.addXp(100); return true; } return false; } });

        let gearPool = ['SWORD', 'SHIELD', 'BOOTS', 'BOW'];
        let randomGear = gearPool.sort(() => Math.random() - 0.5).slice(0, 2);
        randomGear.forEach(gId => {
            let iDef = typeof ITEMS !== 'undefined' ? ITEMS[gId] : null;
            if (iDef) shopItems.push({ name: iDef.name, icon: iDef.icon, desc: iDef.desc, cost: 12, rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'equip', filter: 'none', action: async () => { game.inventory.push({ id: gId, level: 1 }); return true; } });
        });

        return; // ENCERRA A FUNÇÃO AQUI SE FOR DUELO
    }
    // --- FIM DA LOJA DE DUELO ---

    // --- 1. CONTRATOS DE FERAS COMUNS E CHEFES ---
    const rB = BEASTS.LAND[Math.floor(Math.random() * BEASTS.LAND.length)];
    let bName = rB.name;
    let bAtk = rB.atk + (bLvl - 1) * 6;
    let bHp = rB.hp + (bLvl - 1) * 20;
    if (bLvl >= 2) {
        let evArr = EVOS[rB.name] || [rB.name + ' Alfa', rB.name + ' Supremo'];
        bName = bLvl === 2 ? evArr[0] : (evArr[1] || evArr[0]);
    }

    shopItems.push({ name: `Contrato: ${bName}`, icon: rB.e, desc: `Adiciona fera Lv${bLvl} à Box.`, cost: 10 + (bLvl * 2), rarity: 'uncommon', color: 'var(--rarity-uncommon)', type: 'consumable', filter: rB.filter || 'none', action: async () => { let newAbilities = [...rB.abilities]; if (game && game.leaderData.name === 'Piromante' && !newAbilities.includes('burn')) { newAbilities.push('burn'); } rosterMemory.push(new Unit({ q: 0, r: 0, faction: 1, isLeader: false, name: bName, baseName: rB.name, emoji: rB.e, hp: bHp, maxHp: bHp, mp: rB.mp, maxMp: rB.mp, atk: bAtk, range: rB.range, level: bLvl, abilities: newAbilities, isNew: true, filter: rB.filter, tags: rB.tags || [], fav: rB.fav || [] })); return true; } });

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
        { id: 'sphere', name: 'Esfera Elemental', icon: '🔮', desc: 'Aplica status negativo num inimigo.', cost: 7, rarity: 'rare', color: 'var(--rarity-rare)' }
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
    let gearPool = ['RUSTY_SWORD', 'WOODEN_SHIELD', 'SWORD', 'SHIELD', 'BOOTS', 'BOW'];
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
        invGrid.innerHTML = '';
        game.inventory.forEach((item, idx) => {
            let iDef = ITEMS[item.id];
            let el = document.createElement('div');
            el.className = 'beast-card unlocked';
            el.style.padding = '8px';
            if (selectedInventoryIndex === idx) el.style.borderColor = 'var(--success)';
            el.innerHTML = `<span style="font-size:24px;">${iDef.icon}</span><div style="font-size:9px; color:var(--gold);">Lv${item.level}</div>`;
            el.onclick = () => {
                if (readOnly) return;
                if (selectedInventoryIndex === idx) selectedInventoryIndex = null;
                else selectedInventoryIndex = idx;
                renderManagement(mode);
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

            if (isBattle) {
                if (e.target.closest('.equip-badge') || selectedInventoryIndex !== null) {
                    showMessage("Equipamentos só podem ser alterados fora de combate!", '#f39c12');
                    selectedInventoryIndex = null;
                    renderManagement(mode);
                    return;
                }
            }

            let target = e.target.closest('.equip-badge');
            if (target) {
                let eqIdx = parseInt(target.getAttribute('data-idx'));
                let eq = u.equipment[eqIdx];
                let eqDef = ITEMS[eq.id];
                if (eqDef.onUnequip) eqDef.onUnequip(u, eq.level);
                u.equipment.splice(eqIdx, 1);
                game.inventory.push(eq);
                renderManagement(mode);
                if (typeof updateUI === 'function') updateUI();
                if (renderer) renderer.draw();
                return;
            }

            if (selectedInventoryIndex !== null) {
                let invItem = game.inventory[selectedInventoryIndex];
                let iDef = ITEMS[invItem.id];

                let existingEq = u.equipment.find(eq => eq.id === invItem.id);
                if (existingEq) {
                    if (iDef.onUnequip) iDef.onUnequip(u, existingEq.level);
                    existingEq.level++;
                    if (iDef.onEquip) iDef.onEquip(u, existingEq.level);
                    showPopup(`✨ Fusão Lv${existingEq.level}!`, u, '#c9a227');
                } else {
                    u.equipment.push({ ...invItem });
                    if (iDef.onEquip) iDef.onEquip(u, invItem.level);
                }

                game.inventory.splice(selectedInventoryIndex, 1);
                selectedInventoryIndex = null;
                renderManagement(mode);
                if (typeof updateUI === 'function') updateUI();
                if (renderer) renderer.draw();
                return;
            }

            if (isBattle) {
                showMessage("Não pode trocar de feras em combate!", '#e74c3c');
                return;
            }

            if (isBox) {
                if (deployedRoster.filter(x => !x.isLeader).length < maxLimit) {
                    rosterMemory.splice(rosterMemory.indexOf(u), 1);
                    deployedRoster.push(u);
                } else { alert("Limite máximo em campo!"); }
            } else {
                if (!u.isLeader) {
                    deployedRoster.splice(deployedRoster.indexOf(u), 1);
                    rosterMemory.push(u);
                } else { alert("O Líder não pode sair do campo."); }
            }
            renderManagement(mode);
        };
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

function openManagement() { hide('shop-screen'); show('management-screen'); hide('btn-close-team'); show('btn-start-stage'); renderManagement('prep'); }

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

        alert(`Fusão Concluída! ${base.name} devorou ${sac.name}.`);
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
    const numFloors = 8;

    // 1. Geração inicial com base nas probabilidades normais
    for (let i = 0; i < numFloors; i++) {
        let numNodes = (i === numFloors - 1) ? 1 : 3;
        let floor = [];
        for (let j = 0; j < numNodes; j++) {
            let type = 'BATTLE';
            if (i === numFloors - 1) type = 'BOSS';
            else if (i === 0) type = 'BATTLE';
            else if (i === Math.floor(numFloors / 2)) type = 'TREASURE';
            else {
                if (j === 1) {
                    type = Math.random() < 0.8 ? 'BATTLE' : 'ELITE';
                } else {
                    let r = Math.random();
                    if (r < 0.25) type = 'BATTLE';
                    else if (r < 0.45) type = 'EVENT';
                    else if (r < 0.60) type = 'ELITE';
                    else if (r < 0.80) type = 'SHOP';
                    else type = 'LAB';
                }
            }
            floor.push({ id: `f${i}_n${j}`, floor: i, pos: j, type: type, next: [], status: i === 0 ? 'reachable' : 'locked' });
        }
        map.push(floor);
    }

    // --- NOVA TRAVA DE SEGURANÇA: MÍNIMO 3 MERCADORES E 3 LABORATÓRIOS (UM POR ROTA) ---
    const validFloors = [1, 2, 3, 5, 6]; // Apenas andares com geração aleatória livre

    for (let j = 0; j < 3; j++) {
        // Garante pelo menos um Mercador (SHOP) na rota/coluna j
        let hasShop = map.some(floor => floor[j] && floor[j].type === 'SHOP' && validFloors.includes(floor[j].floor));
        if (!hasShop) {
            let targetFloor = validFloors[Math.floor(Math.random() * validFloors.length)];
            map[targetFloor][j].type = 'SHOP';
        }

        // Garante pelo menos um Laboratório (LAB) na rota/coluna j
        let hasLab = map.some(floor => floor[j] && floor[j].type === 'LAB' && validFloors.includes(floor[j].floor));
        if (!hasLab) {
            // Filtra os andares para não sobrescrever o Mercador que acabou de ser travado ou já existia
            let availableFloors = validFloors.filter(f => map[f][j].type !== 'SHOP');
            if (availableFloors.length > 0) {
                let targetFloor = availableFloors[Math.floor(Math.random() * availableFloors.length)];
                map[targetFloor][j].type = 'LAB';
            }
        }
    }
    // ----------------------------------------------------------------------------------

    // 2. Criação das conexões de caminhos (Mantém o seu loop original intacto)
    for (let i = 0; i < numFloors - 1; i++) {
        let currentFloor = map[i];
        let nextFloor = map[i + 1];
        currentFloor.forEach((node, j) => {
            if (nextFloor.length === 1) { node.next.push(nextFloor[0].id); }
            else {
                node.next.push(nextFloor[j].id);
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
        await window.giveRandomArtifact('rare');
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

    // --- LÓGICA EXCLUSIVA DE DUELO ---
    if (game && game.isDuel) {
        let history = JSON.parse(localStorage.getItem('ht_duel_history') || '[]');
        let pL = game.units.find(u => u.isLeader && u.faction === 1) || { name: 'Player', emoji: '👑' };
        let eL = game.units.find(u => u.isLeader && u.faction === 2) || { name: 'CPU', emoji: '💀' };
        
        history.unshift({
            date: new Date().toLocaleString(),
            win: win,
            pName: pL.name, pEmoji: pL.emoji,
            eName: eL.name, eEmoji: eL.emoji
        });
        if (history.length > 20) history.pop(); // Guarda apenas as últimas 20 partidas
        localStorage.setItem('ht_duel_history', JSON.stringify(history));

        show('result-screen'); hide('rs-menu-win'); hide('rs-menu-lose');
        $('rs-title').innerText = win ? "Vitória no Duelo!" : "Derrota no Duelo"; 
        $('rs-title').style.color = win ? '#4a9edd' : '#c0392b';
        $('rs-desc').innerText = win ? "Você esmagou o adversário com maestria tática na Arena!" : "Sua equipe foi superada. Estude uma nova formação.";
        show('rs-menu-win');
        
        let btn = $('btn-go-shop');
        btn.innerText = "Voltar ao Menu Principal";
        btn.onclick = () => location.reload();
        return;
    }
    // --- FIM DA LÓGICA DE DUELO ---

    show('result-screen'); hide('rs-menu-win'); hide('rs-menu-lose');
    if (win) {
        if (typeof countKingdomBuildings === 'function' && game.kingdomMap) {
            let pWood = window.countKingdomBuildings('LUMBERMILL') * 3;
            let pStone = window.countKingdomBuildings('MINE') * 3;
            let pScales = window.countKingdomBuildings('FISHINGCAMP') * 3;
            let pSand = window.countKingdomBuildings('SANDPIT') * 3;
            let pGold = (window.countKingdomBuildings('MINE') * 10) + (window.countKingdomBuildings('PORT') * 5);

            // --- NOVO: COLETA DA BIBLIOTECA E ARMADILHEIRO ---
            let pDna = window.countKingdomBuildings('LIBRARY') * 1;
            let pTraps = window.countKingdomBuildings('TRAP_MAKER') * 1;

            if (!game.resources) game.resources = { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 };
            game.resources.wood += pWood; game.resources.stone += pStone;
            game.resources.scales += pScales; game.resources.sand += pSand;
            game.gold += pGold;

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

        if (game.isBossStage) {
            if (game.currentLevel < 5) {
                $('rs-desc').innerText = `O Chefe caiu! Prepare-se para o Ato ${game.currentLevel + 1}.`;
                btn.innerText = "Retornar ao Reino 🏰";
                btn.onclick = () => {
                    game.currentLevel++;
                    game.currentFloor = -1;
                    game.isBossStage = false;
                    generateRouteMap();
                    autoSave();
                    openKingdom();
                };
            } else {
                $('rs-desc').innerText = `PARABÉNS! Você venceu a Exploração Final!\nO "Coração do Infinito" foi desbloqueado no modo Roguelite.`;
                btn.innerText = "🏆 Finalizar Exploração";

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
            $('rs-desc').innerText = `Avançando...`;
            btn.innerText = "Retornar ao Reino 🏰";
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
    game.isAnimating = false;
    const tb = $('turn-blocker');
    if (tb) tb.style.display = 'none';
    lastState = null;
    const undoBtn = $('btn-undo');
    if (undoBtn) undoBtn.disabled = true;

    if (game.currentLevel > stats.maxLevel) {
        stats.maxLevel = game.currentLevel;
        localStorage.setItem('ht_stats', JSON.stringify(stats));
    }

    hide('management-screen');
    hide('route-map-screen');
    hide('event-screen');
    show('game-container');

    setTimeout(() => {
        const r = deployedRoster.map(m => new Unit({ ...m, q: 0, r: 0, hasAttacked: false, status: null, isNew: false }));
        game.generateCampaignMap(r);
        renderer.initCamera(true);
        updateUI();
        autoSave();
    }, 50);
}


function startGame(load, isRoguelite = false, leaderId = null, isDuel = false, opponentId = null) {
    game.isDuel = isDuel; 
    game.opponentId = opponentId;
    hide('mode-screen'); hide('main-menu'); hide('result-screen');
    const sk = isRoguelite ? 'ht_save_rogue' : 'ht_save_camp';
    game.isAnimating = false; const tb = $('turn-blocker'); if (tb) tb.style.display = 'none';
    lastState = null; const undoBtn = $('btn-undo'); if (undoBtn) undoBtn.disabled = true;
    game.manaPool = {}; game.spentMana = {}; game.spellCooldowns = {}; game.activeSpell = null; game.lastDeadAlly = null; game.turnCount = 0;
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
        game.routeMap = d.routeMap; game.currentFloor = d.currentFloor; game.inventory = d.inventory || [];
        game.isBossStage = d.isBossStage || false; game.currentRouteType = d.currentRouteType || 'BATTLE';
        game.manaPool = d.manaPool || {};
        game.spentMana = d.spentMana || {};
        game.spellCooldowns = d.spellCooldowns || {};

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
            renderRouteMap();
        }
    }

}

// ==========================================
// SISTEMA DE GERENCIAMENTO DO REINO 2.0
// ==========================================
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

function openKingdom() {
    hide('result-screen');
    hide('route-map-screen');
    hide('game-container');
    show('kingdom-screen');

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
    let res = game.resources || { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 };
    if ($('k-res-gold')) $('k-res-gold').innerText = game.gold;
    if ($('k-res-dna')) $('k-res-dna').innerText = game.dna || 0;
    if ($('k-res-wood')) $('k-res-wood').innerText = res.wood;
    if ($('k-res-stone')) $('k-res-stone').innerText = res.stone;
    if ($('k-res-scales')) $('k-res-scales').innerText = res.scales;
    if ($('k-res-sand')) $('k-res-sand').innerText = res.sand;

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

            // Injeta o renderizador de efeitos sobre o desenho do mapa original
            let originalDraw = kRenderer.draw.bind(kRenderer);
            kRenderer.draw = function () {
                originalDraw();
                if (this.currentEffect) {
                    let eff = this.currentEffect;
                    let p = this.getPos(eff.hex.q, eff.hex.r);
                    let ctx = this.ctx;
                    ctx.save();

                    // Onda de choque externa se expandindo
                    ctx.beginPath();
                    let radius = this.hexSize * (1 + eff.progress * 1.3);
                    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = eff.color;
                    ctx.lineWidth = 5 * (1 - eff.progress);
                    ctx.globalAlpha = 1 - eff.progress;
                    ctx.stroke();

                    // Brilho interno implodindo taticamente
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

    game.resources[resType] += amount;
    game.gold += goldChange;

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

        let html = `<div style="display:flex; flex-direction:column; align-items:center; min-width:220px; background:rgba(20,20,30,0.9); border:1px solid var(--gold); padding:10px; border-radius:8px;">
            <span style="font-size:32px;">${bData.icon}</span>
            <span style="font-size:13px; color:var(--gold-light); margin:4px 0; font-weight:bold;">${bData.name} <span style="color:#fff; background:#444; padding:1px 5px; border-radius:8px; font-size:10px;">Nv ${bLvl}</span></span>
            <span style="font-size:10px; color:#aaa; margin-bottom:8px; text-align:center;">${bData.desc}</span>`;

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
            actsHtml += `<hr style="border-color:#444; width:100%; margin:8px 0;">`;
            let fCost = checkAdjacency('FORGE', 'MINE') ? 15 : 25;
            let fTxt = fCost === 15 ? "Forjar Equipamento (-15💰) [Bônus da Mina]" : "Forjar Equipamento (-25💰)";
            actsHtml += `<button id="btn-forge" data-cost="${fCost}" class="btn-warning" style="width:100%; font-size:10px; padding:6px;">${fTxt}</button>`;

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

        btn.style.cssText = `display:flex; flex-direction:column; align-items:center; min-width:140px; background:rgba(20,20,30,0.8); border:1px solid ${btnStyle}; padding:10px; border-radius:8px; cursor:${cursor}; opacity:${opacity};`;

        let costHtml = opt.alreadyHas
            ? `<span style="color:#e74c3c; font-size:10px; font-weight:bold;">LIMITE ÚNICO ATINGIDO</span>`
            : Object.entries(b.cost).map(([res, amt]) => {
                let icon = res === 'wood' ? '🌲' : res === 'stone' ? '⛰️' : res === 'scales' ? '🐟' : res === 'sand' ? '⏳' : '🩸';
                let color = (game.resources[res] || 0) >= amt ? '#fff' : 'var(--enemy-color)';
                return `<span style="color:${color}; font-size:11px; font-weight:bold;">${icon}${amt}</span>`;
            }).join(' ');

        btn.innerHTML = `<span style="font-size:26px;">${b.icon}</span><span style="font-size:11px; color:var(--gold-light); margin:4px 0; font-weight:bold;">${b.name}</span><div style="display:flex; gap:6px;">${costHtml}</div><span style="font-size:9px; color:#aaa; margin-top:6px; text-align:center;">${b.desc}</span>`;

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
        rede: { name: "🕸️ Rede Hexagonal" },
        potion: { name: "🧪 Poção de Cura" },
        bandage: { name: "🩹 Atadura Médica" },
        scroll: { name: "📜 Pergaminho Arcano" },
        sphere: { name: "🔮 Esfera Elemental" }
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

window.showVersusScreen = function(callback) {
    const el = document.createElement('div');
    el.id = 'versus-screen';
    el.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:linear-gradient(135deg, #050505 0%, #1a1a2e 100%); z-index:10000; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#fff; font-family:Cinzel,serif;`;
    
    let pTeam = game.units.filter(u => u.faction === 1);
    let eTeam = game.units.filter(u => u.faction === 2);
    
    let pL = pTeam.find(u => u.isLeader) || { name:'Player', emoji:'👑', filter:'none' };
    let eL = eTeam.find(u => u.isLeader) || { name:'CPU', emoji:'💀', filter:'none' };

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

window.openDuelHistory = function() {
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