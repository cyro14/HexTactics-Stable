// ==========================================
// 1. FUNÇÕES ÚTEIS E SISTEMA DE LOGS
// ==========================================
let selectedInventoryIndex = null; 

window.countKingdomBuildings = function(buildingId) {
    if (!game || !game.kingdomMap) return 0;
    let count = 0;
    game.kingdomMap.forEach(h => { if (h.building === buildingId) count += (h.bLevel || 1); });
    return count;
};

window.getMaxBoxLimit = function() {
    if (!game || !game.leaderData) return 6;
    let base = game.leaderData.limit || 6;
    if (typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_crown')) base += 1;
    base += (window.countKingdomBuildings('TOWN')+1); // Bônus da Vila
    return base;
};

function saveSnapshot(){
    lastState = {
        u: game.units.map(u => new Unit({...u})),
        i: new Map(game.items),
        g: game.gold,
        hk: game.hasKey,
        he: game.hasEgg,
        m: Array.from(game.map.entries()).map(([k,v]) => [k,v.owner]),
        mana: JSON.parse(JSON.stringify(game.manaPool))
    };
    const undoBtn = $('btn-undo'); 
    if(undoBtn) undoBtn.disabled = false;
}

function showZeldaPopup(icon, title, desc, showCancel = false){
    return new Promise(r => {
        $('item-popup-icon').innerText = icon;
        $('item-popup-title').innerText = title;
        $('item-popup-desc').innerText = desc;
        
        let oldCancel = $('btn-cancel-item-popup');
        if(oldCancel) oldCancel.remove();
        
        if(showCancel) {
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
    if(game && !game.gameOver) {
        const sk = game.isRoguelite ? 'ht_save_rogue' : 'ht_save_camp';
        const sv = {
            resources: game.resources,
            kingdomMap: Array.from(game.kingdomMap.entries()),
            level: game.currentLevel, cols: game.cols, rows: game.rows, gold: game.gold,
            dna: game.dna || 0, // NOVO: Salva o DNA
            isRoguelite: game.isRoguelite, hasKey: game.hasKey, hasEgg: game.hasEgg,
            leaderId: game.leaderData.id,
            map: Array.from(game.map.values()).map(h => ({q:h.q, r:h.r, tId:h.terrain.id, owner:h.owner})),
            items: Array.from(game.items.entries()),
            units: game.units.map(u => ({...u})),
            rosterMemory: rosterMemory.map(u => ({...u})),
            deployedRoster: deployedRoster.map(u => ({...u})),
            manaPool: game.manaPool, spentMana: game.spentMana, spellCooldowns: game.spellCooldowns, 
            routeMap: game.routeMap, currentFloor: game.currentFloor, inventory: game.inventory,
            isBossStage: game.isBossStage, currentRouteType: game.currentRouteType
        };
        localStorage.setItem(sk, JSON.stringify(sv));
    }
}

function unlockInBestiary(n) {
    if(!unlockedBeasts.includes(n)) {
        unlockedBeasts.push(n);
        localStorage.setItem('ht_bestiary', JSON.stringify(unlockedBeasts));
    }
}

function loadMeta() {
    try {
        const s = localStorage.getItem('ht_stats'); if(s) stats = JSON.parse(s) || stats;
        const b = localStorage.getItem('ht_bestiary'); if(b) unlockedBeasts = JSON.parse(b) || [];
        const ac = localStorage.getItem('ht_artifacts_camp'); if(ac) activeArtifactsCamp = JSON.parse(ac) || [];
        const ar = localStorage.getItem('ht_artifacts_rogue'); if(ar) activeArtifactsRogue = JSON.parse(ar) || [];
    } catch(e) {}
    $('btn-load-campaign').classList.toggle('hidden', !localStorage.getItem('ht_save_camp'));
    $('btn-load-roguelite').classList.toggle('hidden', !localStorage.getItem('ht_save_rogue'));
}

function addLog(msg, col='#9a8a6a') {
    const e = document.createElement('div');
    e.className = 'log-entry';
    e.style.borderLeftColor = col;
    e.innerText = msg;
    const combatLog = $('combat-log');
    if(combatLog) {
        combatLog.appendChild(e);
        if(combatLog.childNodes.length > 5) combatLog.removeChild(combatLog.firstChild);
    }
}

function showPopup(txt, target, col) {
    if(!renderer) return;
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
    if(msgEl) {
        msgEl.innerText = txt;
        msgEl.style.color = col;
        msgEl.style.opacity = '1';
        msgEl.style.transition = 'opacity 0.5s';
        setTimeout(() => { msgEl.style.opacity = '0'; }, 2500); 
    }
}

window.giveRandomArtifact = function(rarity) {
    return new Promise(async (resolve) => {
        let pool = ARTIFACTS.filter(a => a.rarity === rarity && !getActiveArtifacts().includes(a.id) && a.id !== 'art_omega');
        if(pool.length === 0) pool = ARTIFACTS.filter(a => !getActiveArtifacts().includes(a.id) && a.id !== 'art_omega');
        if(pool.length > 0) {
            let art = pool[Math.floor(Math.random() * pool.length)];
            let myA = getActiveArtifacts(); myA.push(art.id);
            localStorage.setItem(game.isRoguelite ? 'ht_artifacts_rogue' : 'ht_artifacts_camp', JSON.stringify(myA));
            if(art.id==='art_hp'){rosterMemory.forEach(u=>{u.maxHp+=15;u.hp+=15;});deployedRoster.forEach(u=>{u.maxHp+=15;u.hp+=15;});}
            if(art.id==='art_atk'){rosterMemory.forEach(u=>u.atk+=8);deployedRoster.forEach(u=>u.atk+=8);}
            if(art.id==='art_move'){let l=deployedRoster.find(u=>u.isLeader);if(l){l.maxMp++;l.mp++;}}
            if(art.id==='art_crystal'){let l=deployedRoster.find(u=>u.isLeader);if(l){l.range++;l.atk+=5;}}
            if(art.id==='art_umbral_seal'){deployedRoster.forEach(u=>{if(!u.tags.includes('UMBRAL'))u.tags.push('UMBRAL');});}
            if(art.id==='art_celestial_seal'){deployedRoster.forEach(u=>{if(!u.tags.includes('CELESTIAL'))u.tags.push('CELESTIAL');});}
            await showZeldaPopup(art.icon, `Novo Artefato!`, `${art.name}: ${art.desc}`);
        }
        resolve();
    });
};

// ==========================================
// 2. MANA, MAGIAS E GRIMÓRIO
// ==========================================
function computeManaIncome(){
    let counts = {};
    const all = [...deployedRoster, ...(game ? game.units.filter(u=>u.faction===1) : [])];
    const seen = new Set();
    all.forEach(u=>{
        if(seen.has(u.name+u.q+u.r)) return;
        seen.add(u.name+u.q+u.r);
        (u.tags||[]).forEach(t=>{ counts[t]=(counts[t]||0)+1; });
    });
    return counts;
}

function collectMana(){
    if(!game) return;
    let income = computeManaIncome();
    Object.entries(income).forEach(([tag, count])=>{
        if(MANA_TYPES[tag]){ game.manaPool[tag] = (game.manaPool[tag]||0) + (count * 0.5); }
    });
    updateManaUI();
}

function spendMana(cost){
    for(let [tag, amt] of Object.entries(cost)){
        let avail = Math.floor((game.manaPool[tag]||0) - (game.spentMana[tag]||0));
        if(avail < amt) return false;
    }
    for(let [tag, amt] of Object.entries(cost)){
        game.spentMana[tag] = (game.spentMana[tag]||0) + amt;
    }
    updateManaUI(); return true;
}

function canAffordSpell(spell, leader){
    if(!game) return false;
    let maxS = (leader && leader.name === 'Arquimago') ? 2 : 1;
    if (leader && (leader.spellsCast || 0) >= maxS) return false;
    for(let [tag, amt] of Object.entries(spell.cost)){
        let avail = Math.floor((game.manaPool[tag]||0) - (game.spentMana[tag]||0));
        if(avail < amt) return false;
    }
    return true;
}

function resetSpentMana(){ game.spentMana = {}; updateManaUI(); }

function updateManaUI(){
    if(!game) return;
    const container = $('mana-bar-container');
    if(!container) return;
    container.innerHTML = '';
    let hasMana = false;
    Object.entries(game.manaPool).forEach(([tag, total])=>{
        if(total <= 0) return;
        const mt = MANA_TYPES[tag]; if(!mt) return;
        const spent = game.spentMana[tag]||0;
        let available = Math.floor(total - spent);
        if(available <= 0 && Math.floor(total) <= 0) return;
        hasMana = true;
        const pip = document.createElement('span');
        pip.className = `mana-pip ${available>0?'available':'spent'}`;
        pip.style.background = available>0 ? mt.col+'44' : 'rgba(30,30,40,0.7)';
        pip.style.color = mt.col; pip.style.borderColor = mt.col+'88';
        pip.style.width = 'auto'; pip.style.padding = '0 8px';
        pip.innerText = `${mt.icon} x${available}`;
        pip.style.padding = '0 4px';
        pip.style.fontSize = '9px';
        pip.title = `${mt.name}: ${available}/${Math.floor(total)}`;
        container.appendChild(pip);
    });
    if(!hasMana){ container.innerHTML = `<span style="font-size:10px;color:var(--text-dim);">Sem mana</span>`; }
    renderSpellBar();
}

function renderSpellBar(){
    const bar = $('spell-bar');
    if(!bar) return;
    bar.innerHTML = '';
    if(!game || game.currentTurn !== 1) return;
    const leader = game.units.find(u=>u.isLeader&&u.faction===1);
    if(!leader||!leader.knownSpells||!leader.knownSpells.length) return;
    
    leader.knownSpells.forEach(sid=>{
        const spell = SPELLS.find(s=>s.id===sid);
        if(!spell) return;
        const cd = game.spellCooldowns[sid] || 0;
        let can = canAffordSpell(spell, leader) && !game.isAnimating && cd === 0;
        
        const isActive = game.activeSpell===sid;
        let costHtml = Object.entries(spell.cost).map(([tag,amt])=>{
            const mt = MANA_TYPES[tag]; if(!mt) return '';
            return `<span style="color:${mt.col};font-size:9px;">${mt.icon}x${amt}</span>`;
        }).join(' ');
        
        let cdText = cd > 0 ? `<span style="color:#f39c12; font-weight:bold;">[CD: ${cd}]</span> ` : '';
        const btn = document.createElement('div');
        btn.style.flexShrink = '0';
        btn.className = `spell-btn ${isActive?'spell-active':''} ${!can?'spell-disabled':''}`;
btn.innerHTML = `<span style="font-size:16px;">${spell.icon}</span><div style="flex:1; line-height:1.2; text-align:left;"><div style="font-family:Cinzel,serif;font-size:11px;color:${isActive?'#ff8888':'var(--gold-light)'};">${cdText}${spell.name}</div><div style="font-size:9px;color:#888;">Nv${spell.level} · ${costHtml}</div></div>`;

        btn.title = spell.desc;
        
        if(can){
            btn.addEventListener('click', ()=>{
                if(game.isAnimating) return;
                if(game.activeSpell===sid){
                    game.activeSpell=null;
                } else {
                    game.activeSpell=sid;
                    game.selectedUnit = leader;
                    game.calculateReachable(leader);
                    updateUI();
                    renderer.draw();
                    showMessage(`✨ ${spell.name}: ${spell.desc}`, '#e8c84a');               
                 }
                renderSpellBar();
            });
        }
        bar.appendChild(btn);
    });
}

function openGrimoire(){
    const leader = game && game.units.find(u=>u.isLeader&&u.faction===1);
    $('grimoire-subtitle').innerText = leader ? `${leader.emoji} ${leader.name} — Nível ${leader.level}` : 'Grimório';
    const manaDiv = $('grimoire-mana-display'); manaDiv.innerHTML = '';
    if(game){
        let income = computeManaIncome();
        Object.entries(game.manaPool).forEach(([tag,total])=>{
            if(total<=0) return;
            const mt=MANA_TYPES[tag];if(!mt)return;
            const spent=game.spentMana[tag]||0;
            const inc = income[tag] ? ` (+${income[tag] * 0.5}/t)` : '';
            const el=document.createElement('span');
            el.style.cssText=`background:${mt.col}22;border:1px solid ${mt.col}66;border-radius:4px;padding:3px 8px;font-size:12px;color:${mt.col};`;
            el.innerText=`${mt.icon} ${mt.name}: ${Math.floor(total-spent)}/${Math.floor(total)}${inc}`;
            manaDiv.appendChild(el);
        });
    }
    const grid = $('grimoire-grid'); grid.innerHTML='';
    const grimTags = leader ? (leader.grimTags||[]) : []; const known = leader ? (leader.knownSpells||[]) : [];
    for(let lvl=1;lvl<=5;lvl++){
        const spellsOfLevel = SPELLS.filter(s=>{ return s.tags.some(t=>grimTags.includes(t)); }).filter(s=>s.level===lvl);
        if(!spellsOfLevel.length) continue;
        const hdr = document.createElement('div');
        hdr.style.cssText=`grid-column:1/-1;font-family:Cinzel,serif;font-size:12px;color:var(--gold);border-bottom:1px solid var(--gold-dark);padding-bottom:4px;margin-top:8px;`;
        hdr.innerText=`── Nível ${lvl} ──`; grid.appendChild(hdr);
        spellsOfLevel.forEach(spell=>{
            const isKnown=known.includes(spell.id); const mt=MANA_TYPES[Object.keys(spell.cost)[0]]; const borderCol=mt?mt.col:'#888';
            const card=document.createElement('div'); card.className=`grimoire-card ${isKnown?'known':''}`; card.style.borderColor=isKnown?borderCol:borderCol+'44'; card.style.opacity=isKnown?'1':'0.5';
            let costHtml=Object.entries(spell.cost).map(([tag,amt])=>{
                const mtt=MANA_TYPES[tag];if(!mtt)return'';
                return `<span style="color:${mtt.col};font-size:10px;">${mtt.icon}×${amt}</span>`;
            }).join(' ');
            card.innerHTML=`<span class="grimoire-level-badge" style="background:${borderCol}22;color:${borderCol};border-color:${borderCol}88;">Nível ${spell.level}</span>
                <div style="font-size:28px;margin:6px 0;">${spell.icon}</div>
                <div style="font-family:Cinzel,serif;font-size:13px;color:${isKnown?'var(--gold-light)':'#888'};margin-bottom:6px;">${spell.name}</div>
                <div style="font-size:11px;color:#aaa;line-height:1.4;margin-bottom:8px;">${spell.desc}</div>
                <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">${costHtml}</div>
                ${isKnown?'<div style="font-size:9px;color:var(--success);margin-top:6px;">✔ Aprendida</div>':'<div style="font-size:9px;color:#555;margin-top:6px;">Não aprendida ainda</div>'}`;
            grid.appendChild(card);
        });
    }
    hide('pause-menu'); show('grimoire-screen');
}

async function showSpellLearnModal(leader, level){
    const grimTags = leader.grimTags||[];
    const alreadyKnown = leader.knownSpells||[];
    let candidates = SPELLS.filter(s=>{
        if(s.level !== level) return false;
        if(alreadyKnown.includes(s.id)) return false;
        return s.tags.some(t=>grimTags.includes(t));
    });
    if(!candidates.length){ candidates = SPELLS.filter(s=>s.level===level&&!alreadyKnown.includes(s.id)); }
    if(!candidates.length) return;
    candidates = candidates.sort(()=>Math.random()-0.5).slice(0,3);
    return new Promise(resolve=>{
        $('slm-subtitle').innerText = `${leader.emoji} ${leader.name} atingiu Nível ${level}! Grimório disponível:`;
        const container = $('slm-options');
        container.innerHTML='';
        candidates.forEach(spell=>{
            let costHtml = Object.entries(spell.cost).map(([tag,amt])=>{
                const mt=MANA_TYPES[tag]; if(!mt) return '';
                return `<span class="mana-pip available" style="background:${mt.col}44;color:${mt.col};border-color:${mt.col}88;width:auto;padding:0 5px;">${mt.icon} ×${amt}</span>`;
            }).join('');
            const card = document.createElement('div');
            card.className = 'spell-option-card';
            card.style.borderColor = Object.keys(spell.cost).map(t=>MANA_TYPES[t]?.col||'#888')[0]||'#888';
            card.innerHTML = `<span class="spell-option-icon">${spell.icon}</span>
                <div class="spell-option-name" style="color:var(--gold-light);">${spell.name}</div>
                <div class="spell-option-desc">${spell.desc}</div>
                <div class="spell-option-cost">${costHtml}</div>`;
            card.addEventListener('click',()=>{
                leader.knownSpells.push(spell.id);
                addLog(`✨ ${leader.name} aprendeu ${spell.name}!`,'#c9a227');
                hide('spell-learn-modal');
                renderSpellBar();
                resolve(spell.id);
            });
            container.appendChild(card);
        });
        $('btn-slm-skip').onclick=()=>{hide('spell-learn-modal');resolve(null);};
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
    return `<span class="tag-badge" style="background:rgba(20,20,30,0.9); border:1px solid ${col}; color:${col}; font-size:9px; padding:2px 6px; border-radius:4px; box-shadow:0 0 5px ${col}40; text-shadow:0 0 2px ${col}80;">${name}</span>`;
}

window.promptSelectUnit = function(title, unitsToSelectFrom) {
    return new Promise(resolve => {
        if(!unitsToSelectFrom || unitsToSelectFrom.length === 0) return resolve(null);
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
        if(oldCancel) oldCancel.remove(); // Evita duplicar o botão se reabrir
        
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


window.learnAbility = async function(u, newA) {
    if(u.abilities.includes(newA)){showMessage("Já possui essa habilidade!","#f39c12");return false;}
    if(u.abilities.length<2){u.abilities.push(newA);showPopup("Habilidade Aprendida!",u,"#2ecc71");return true;}
    return new Promise(resolve=>{
        $('arm-desc').innerText=`${u.name} quer aprender ${ABILITY_DESCRIPTIONS[newA].split(':')[0]}. Escolha uma para esquecer:`;$('arm-options').innerHTML='';
        u.abilities.forEach((ab,idx)=>{let btn=document.createElement('button');btn.innerText=`Esquecer: ${ABILITY_DESCRIPTIONS[ab].split(':')[0]}`;btn.onclick=()=>{u.abilities[idx]=newA;hide('ability-replace-modal');showPopup("Substituída!",u,"#2ecc71");resolve(true);};$('arm-options').appendChild(btn);});
        $('btn-arm-cancel').onclick=()=>{hide('ability-replace-modal');resolve(false);};show('ability-replace-modal');
    });
}

window.showAbility = function(id,e,n,f='none'){
    document.getElementById('unit-details-modal').classList.remove('hidden');
    document.getElementById('ud-icon').innerText=e; document.getElementById('ud-icon').style.filter=f;
    document.getElementById('ud-name').innerText=n;
    document.getElementById('ud-desc').innerText=ABILITY_DESCRIPTIONS[id]||'Mistério.';
}

window.showBeastDetails = function(b,bypassUnlock=false){
    const isUnlocked = bypassUnlock || unlockedBeasts.includes(b.name);
    if(!isUnlocked && !bypassUnlock) return;
    let evArr = EVOS[b.name] || [b.name+' Alfa', b.name+' Supremo'];
    let e1 = b.e || b.emoji, n1 = b.name, f1 = b.filter || 'none';
    let e2 = e1, n2 = evArr[0], f2 = f1; let e3 = e1, n3 = evArr[1], f3 = f1;
    const evs2={'🐺':()=>{if(f2==='none')f2='saturate(200%) hue-rotate(330deg)';},'🐗':()=>e2='🦏','🐻':()=>e2='🐼','🐭':()=>e2='🐀','🐇':()=>{e2='🦘';n2="Canguru Boxeador";},'🐢':()=>{e2='🦕';n2="Dinossauro Escudo";},'🐴':()=>{e2='🦄';n2="Unicórnio Místico";},'🐍':()=>{e2='🐍';n2="Basilisco";},'🦂':()=>{e2='🦂';n2="Imperador do Deserto";},'🐒':()=>{e2='🦍';n2="Gorila Rei";},'🦊':()=>{e2='🦊';n2="Raposa de Nove Caudas";},'🐧':()=>{e2='🦭';n2="Morsa Blindada";},'🐸':()=>{e2='🐸';n2="Sapo-Boi Gigante";},'🐦':()=>{e2='🦅';n2="Fênix";}};
    if(evs2[e1]) evs2[e1]();
    
    let displayEvos = [{name:n1, e:e1, f:f1}, {name:n2, e:e2, f:f2}, {name:n3, e:e3, f:f3}];
    let evoHtml = '';
    displayEvos.forEach((ev, idx) => {
        const isBoss = b.maxLevel !== undefined || b.isBoss || b.desc !== undefined;
        if(isBoss && idx > 0) return;
        const isUnl = bypassUnlock || unlockedBeasts.includes(ev.name);
        let flt = isUnl ? ev.f : 'brightness(0) invert(0.15)';
        let cName = isUnl ? ev.name : '???';
        evoHtml += `<div style="text-align:center;position:relative;flex:1;"><div style="font-size:32px;filter:${flt};margin-bottom:5px;">${ev.e}</div><div style="font-size:10px;color:var(--gold-light);font-family:Cinzel,serif;">${idx===0?'Base':`Nível ${idx+1}`}</div><div style="font-size:10px;color:${isUnl?'#fff':'#888'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cName}</div></div>`;
        if(idx < 2 && !isBoss) evoHtml += `<div style="color:var(--gold-dark);font-size:16px;align-self:center;">➔</div>`;
    });
    
    let tagsDisplayHtml = `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:4px; margin-bottom:15px;">${(b.tags||[]).map(t=>getTagHTML(t)).join('')}</div>`;
    $('bd-evos').innerHTML = `<div style="width:100%;">${tagsDisplayHtml}</div><div style="display:flex; width:100%;">${evoHtml}</div>`;
    
    let terHtml = '';
    Object.values(TERRAINS).forEach(t => {
        let defV = t.def; let costV = t.cost; let isFav = (b.fav||[]).includes(t.id);
        if(isFav){ defV += 0.2; costV = 1; }
        let defCol = defV > 0 ? 'var(--success)' : (defV < 0 ? 'var(--enemy-color)' : '#aaa');
        let costCol = costV === 1 ? 'var(--success)' : (costV >= 3 ? 'var(--enemy-color)' : '#aaa');
        terHtml += `<div style="background:rgba(20,20,30,0.8);border:1px solid var(--gold-dark);border-radius:4px;padding:6px;text-align:center;"><div style="font-size:16px;margin-bottom:2px;">${t.icon||'⬛'}</div><div style="font-size:9px;color:#ddd;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.name}</div><div style="font-size:10px;"><span title="Defesa" style="color:${defCol}">🛡️ ${Math.round(defV*100)}%</span><br><span title="Custo" style="color:${costCol}">🥾 ${costV}</span></div></div>`;
    });
    $('bd-terrains').innerHTML = terHtml; $('beast-details-modal').classList.remove('hidden');
}

function updateUI(){
    // Atualiza os contadores individuais de Ouro e DNA
    const goldDisplay = $('ui-gold'); 
    if(goldDisplay && game) goldDisplay.innerText = game.gold; 
    
    const dnaDisplay = $('ui-dna');
    if(dnaDisplay && game) dnaDisplay.innerText = game.dna || 0;

    updateManaUI();
    if(game && game.selectedUnit){
        const u = game.selectedUnit; const col = u.faction===1?'#4a9edd':u.faction===2?'#c0392b':'#27ae60'; const st = u.faction===1?'Aliado':u.faction===2?'Inimigo':'Fera';
        $('unit-portrait').style.cssText=`display:flex;border-color:${col};box-shadow:0 0 10px ${col}40;filter:${u.filter}`; $('unit-portrait').innerText=u.emoji;
        
        let starIcon = u.starLevel === 2 ? '🥉' : u.starLevel === 3 ? '🥈' : u.starLevel >= 4 ? '🌟' : '';
        $('unit-name').innerHTML=`<span style="color:${col}">[${st}]</span> ${u.name} <span style="color:var(--gold);font-size:11px;">Lv${u.level}${starIcon}</span>`;
        
        let res = game ? (game.resources || { wood:0, stone:0, scales:0, sand:0, blood:0 }) : { wood:0, stone:0, scales:0, sand:0, blood:0 };
        if($('res-wood')) $('res-wood').innerText = res.wood;
        if($('res-stone')) $('res-stone').innerText = res.stone;
        if($('res-scales')) $('res-scales').innerText = res.scales;
        if($('res-sand')) $('res-sand').innerText = res.sand;

        updateManaUI();

        let sH = u.status==='poison'?`<span style="color:var(--success)">Envenenado</span>`:u.status==='stun'?`<span style="color:var(--warning)">Atordoado</span>`:u.status==='bind'?`<span style="color:#9b59b6">Preso</span>`:u.status==='chilled'?`<span style="color:#00ffff">Congelado</span>`:u.status==='shielded'?`<span style="color:#95a5a6">Escudado</span>`:u.faction===0&&u.alerted?`<span style="color:var(--enemy-color)">⚠️ Alerta!</span>`:'';
        let ab = u.abilities.filter(x=>x&&ABILITY_DESCRIPTIONS[x]).map(ab=>`<div class="btn-ability-link" onclick="window.showAbility('${ab}','${u.emoji}','${u.name}','${u.filter}')">📖 ${ABILITY_DESCRIPTIONS[ab].split(':')[0]}</div>`).join('');
        let tI = ''; const uH = game.map.get(`${u.q},${u.r}`); if(uH){ let defV = uH.terrain.def; if(u.fav.includes(uH.terrain.id)) defV+=0.2; tI=`<span style="color:#888;"> | 📍 ${uH.terrain.icon} ${uH.terrain.name} (${Math.round(defV*100)}% Def)</span>`; }
        let tagsHtml = (u.tags||[]).map(t => getTagHTML(t)).join('');
        
        $('unit-info').innerHTML=`<div style="display:flex;gap:10px;margin-top:2px;justify-content:flex-end;"><div>HP: ${u.hp}/${u.maxHp}</div><div>MP: ${u.mp}/${u.maxMp}</div></div><div style="color:var(--text-muted);margin-top:2px;">ATK: ${u.getEffectiveAtk(game)} | Alc: ${u.range}</div><div style="color:#888;font-size:10px;margin-top:1px;">${u.faction===1?`XP: ${u.xp}/${u.maxXp}`:''} ${tI}</div><div style="margin-top:2px;">${sH}</div><div style="margin-top:4px;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px;align-items:center;">${ab} ${tagsHtml}</div>`;
        if(u.isLeader&&u.faction===1&&!u.hasAttacked&&u.status!=='stun'&&u.status!=='bind'){show('btn-tame');$('btn-tame').classList.toggle('active',game.tameMode);}else{hide('btn-tame');}
    } else if(game && game.selectedHex){
        const h = game.selectedHex, t = h.terrain; $('unit-portrait').style.cssText=`display:flex;border-color:#555;box-shadow:none;filter:none;`; $('unit-portrait').innerText=t.icon||'⬛';
        let o = h.owner===1?" <span style='color:var(--player-color)'>(Sua)</span>":h.owner===2?" <span style='color:var(--enemy-color)'>(Inimigo)</span>":"";
        $('unit-name').innerHTML=`<span style="color:var(--gold-light)">Terreno: ${t.name}${o}</span>`; $('unit-info').innerHTML=`<div style="margin-top:4px;color:var(--text-muted);">Custo Mov: ${t.cost}<br>Defesa Base: ${Math.round(t.def*100)}%</div>`; hide('btn-tame');
    } else {
        hide('unit-portrait'); $('unit-name').innerHTML='—'; $('unit-info').innerHTML='<div style="color:var(--text-dim);">Selecione um alvo</div>'; hide('btn-tame');
    }
}

// ==========================================
// 4. LOJA, GERENCIAMENTO E INVENTÁRIO
// ==========================================
function generateShopItems(){
    shopItems=[]; let arts=getActiveArtifacts(); 
    
    let bLvl = game && game.currentLevel ? game.currentLevel : 1;
    const rB=BEASTS.LAND[Math.floor(Math.random()*BEASTS.LAND.length)];
    let bName = rB.name;
    let bAtk = rB.atk + (bLvl-1)*6;
    let bHp = rB.hp + (bLvl-1)*20;
    if (bLvl >= 2) {
        let evArr = EVOS[rB.name] || [rB.name+' Alfa', rB.name+' Supremo'];
        bName = bLvl === 2 ? evArr[0] : (evArr[1] || evArr[0]);
    }
    
    shopItems.push({ name:"Fruta da Evolução", icon:"🍎", desc:"+100 XP a uma fera.", cost:8, rarity:'uncommon', color:'var(--rarity-uncommon)', type:'consumable', filter:'none', action: async () => { let m=[...rosterMemory,...deployedRoster].filter(u=>!u.isLeader); if(m.length===0){ alert("Nenhuma fera em campo ou na Box!"); return false; } let r = await window.promptSelectUnit("Quem receberá +100 XP?", m); if(r) { r.addXp(100); return true; } return false; } });
    shopItems.push({ name:"Frasco de Fúria", icon:"🧪", desc:"+5 ATK permanente (fera).", cost:10, rarity:'rare', color:'var(--rarity-rare)', type:'consumable', filter:'hue-rotate(90deg)', action: async () => { let m=[...rosterMemory,...deployedRoster].filter(u=>!u.isLeader); if(m.length===0){ alert("Nenhuma fera!"); return false; } let r = await window.promptSelectUnit("Quem receberá +5 ATK?", m); if(r) { r.atk+=5; return true; } return false; } });
    shopItems.push({ name:"Grimório de Táticas", icon:"📘", desc:"+200 XP para o Herói Líder.", cost:15, rarity:'epic', color:'var(--rarity-epic)', type:'consumable', filter:'none', action: async () => { let l=deployedRoster.find(u=>u.isLeader); if(l){ l.addXp(200); return true; } return false; } });
    shopItems.push({ name:"Poção de Exército", icon:"🧪", desc:"Cura 30 HP de todos.", cost:4, rarity:'common', color:'var(--rarity-common)', type:'consumable', filter:'none', action: async () => { rosterMemory.forEach(u=>u.hp=Math.min(u.maxHp,u.hp+30)); deployedRoster.forEach(u=>u.hp=Math.min(u.maxHp,u.hp+30)); return true; } });
    
    shopItems.push({ name:`Contrato: ${bName}`, icon:rB.e, desc:`Adiciona fera Lv${bLvl} à Box.`, cost:10 + (bLvl*2), rarity:'uncommon', color:'var(--rarity-uncommon)', type:'consumable', filter:rB.filter||'none', action: async () => { let newAbilities = [...rB.abilities]; if(game && game.leaderData.name === 'Piromante' && !newAbilities.includes('burn')) { newAbilities.push('burn'); } rosterMemory.push(new Unit({q:0,r:0,faction:1,isLeader:false,name:bName,baseName:rB.name,emoji:rB.e,hp:bHp,maxHp:bHp,mp:rB.mp,maxMp:rB.mp,atk:bAtk,range:rB.range,level:bLvl,abilities:newAbilities,isNew:true,filter:rB.filter,tags:rB.tags||[],fav:rB.fav||[]})); return true; } });
    // Bônus do Estábulo
    if (typeof countKingdomBuildings === 'function' && window.countKingdomBuildings('STABLE') > 0) {
        let horse = BEASTS.LAND.find(b => b.name === 'Cavalo');
        if (horse) {
            shopItems.push({ 
                name:`Contrato: Cavalo (Estábulo)`, icon:horse.e, desc:`Adiciona um Cavalo Nv1 à Box.`, 
                cost:10, rarity:'uncommon', color:'var(--rarity-uncommon)', type:'consumable', filter:'none', 
                action: async () => { 
                    let u = new Unit({q:0,r:0,faction:1,isLeader:false,name:horse.name,baseName:horse.name,emoji:horse.e,hp:horse.hp,maxHp:horse.hp,mp:horse.mp,maxMp:horse.mp,atk:horse.atk,range:horse.range,level:1,abilities:[...horse.abilities],isNew:true,filter:horse.filter,tags:horse.tags||[],fav:horse.fav||[]});
                    rosterMemory.push(u); return true; 
                } 
            });
        }
    }

    let aA=ARTIFACTS.filter(a=>!arts.includes(a.id) && a.id !== 'art_omega').sort(()=>Math.random()-0.5);
    for(let i=0;i<1;i++){ 
        if(aA[i]){ 
            let art=aA[i]; 
            shopItems.push({ name:art.name, icon:art.icon, desc:art.desc, cost:art.cost, rarity:art.rarity, color:art.color, type:'artifact', filter:'none', action: async () => { 
                let myA = getActiveArtifacts(); myA.push(art.id);
                localStorage.setItem(game.isRoguelite ? 'ht_artifacts_rogue' : 'ht_artifacts_camp', JSON.stringify(myA));
                if(art.id==='art_hp'){rosterMemory.forEach(u=>{u.maxHp+=15;u.hp+=15;});deployedRoster.forEach(u=>{u.maxHp+=15;u.hp+=15;});}
                if(art.id==='art_atk'){rosterMemory.forEach(u=>u.atk+=8);deployedRoster.forEach(u=>u.atk+=8);}
                if(art.id==='art_move'){let l=deployedRoster.find(u=>u.isLeader);if(l){l.maxMp++;l.mp++;}}
                if(art.id==='art_crystal'){let l=deployedRoster.find(u=>u.isLeader);if(l){l.range++;l.atk+=5;}}
                if(art.id==='art_umbral_seal'){deployedRoster.forEach(u=>{if(!u.tags.includes('UMBRAL'))u.tags.push('UMBRAL');});}
                if(art.id==='art_celestial_seal'){deployedRoster.forEach(u=>{if(!u.tags.includes('CELESTIAL'))u.tags.push('CELESTIAL');});}
                await showZeldaPopup(art.icon, `Novo Artefato!`, `${art.name}: ${art.desc}`); 
                return true; 
            } }); 
        } 
    }
}

function renderShop(){
    const grid=$('shop-grid'); grid.innerHTML='';
    shopItems.forEach((item,index)=>{
        const card=document.createElement('div'); card.className=`shop-card`; card.style.borderColor=item.color; let tB=item.type==='artifact'?'Artefato':'Consumível';
        card.innerHTML=`<div><span class="shop-icon" style="filter:${item.filter}">${item.icon}</span><div class="shop-title" style="color:${item.color}">${item.name}</div><div style="font-size:9px;color:#888;text-transform:uppercase;margin-bottom:6px;">${tB}</div><div class="shop-desc">${item.desc}</div></div><button id="btn-buy-${index}" style="margin-top:10px;border-color:${item.color}">Comprar (-${item.cost}💰)</button>`;
        grid.appendChild(card);
        $(`btn-buy-${index}`).onclick = async function(){ if(game.gold>=item.cost){ let res = await item.action(); if(res!==false){ game.gold-=item.cost; $('shop-gold-display').innerText=game.gold; this.innerText="Comprado"; this.disabled=true; this.style.borderColor="var(--success)"; this.style.color="var(--success)"; } } else { alert("Ouro insuficiente!"); } };
    });
}

function openShop(){hide('result-screen');show('shop-screen');$('shop-gold-display').innerText=game.gold;generateShopItems();renderShop();}

function calculateSynergies(roster){let counts={};roster.forEach(u=>{(u.tags||[]).forEach(t=>{counts[t]=(counts[t]||0)+1;});});return counts;}

function renderManagement(mode = 'prep'){
    let isBattle = (mode === 'battle');
    let readOnly = (mode === 'readonly');
    
    let arts=getActiveArtifacts(); 
    let maxLimit = window.getMaxBoxLimit();
    $('mgmt-limit').innerText=`${deployedRoster.filter(u=>!u.isLeader).length}/${maxLimit}`;
    
    const invGrid = $('mgmt-inv-grid');
    if(invGrid){
        invGrid.innerHTML = '';
        game.inventory.forEach((item, idx) => {
            let iDef = ITEMS[item.id];
            let el = document.createElement('div');
            el.className = 'beast-card unlocked';
            el.style.padding = '8px';
            if(selectedInventoryIndex === idx) el.style.borderColor = 'var(--success)';
            el.innerHTML = `<span style="font-size:24px;">${iDef.icon}</span><div style="font-size:9px; color:var(--gold);">Lv${item.level}</div>`;
            el.onclick = () => {
                if(readOnly) return;
                if(selectedInventoryIndex === idx) selectedInventoryIndex = null; 
                else selectedInventoryIndex = idx;
                renderManagement(mode);
            };
            invGrid.appendChild(el);
        });
    }

    const renderBeast = (u, container, isBox) => {
        let card=document.createElement('div');
        card.className='beast-card unlocked';
        card.style.background=u.isLeader?'rgba(40,30,10,0.9)':'rgba(20,16,8,.8)';
        card.style.paddingBottom="18px";
        
        let tagsHtml=`<div style="margin-top:4px;display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">${(u.tags||[]).map(t=>getTagHTML(t)).join('')}</div>`;
        
        let equipsHtml = '';
        (u.equipment||[]).forEach((eq, eqIdx) => {
            let eqDef = ITEMS[eq.id];
            equipsHtml += `<span class="equip-badge" data-idx="${eqIdx}" style="cursor:pointer; background:rgba(0,0,0,0.5); padding:2px; border-radius:3px; border:1px solid #555; margin-right: 2px;">${eqDef.icon}<span style="font-size:7px;color:var(--gold);">Lv${eq.level}</span></span>`;
        });

        let starIcon = u.starLevel === 2 ? '🥉' : u.starLevel === 3 ? '🥈' : u.starLevel >= 4 ? '🌟' : '';
        card.innerHTML=`<span class="beast-icon" style="filter:${u.filter}">${u.emoji}</span><div class="beast-name">${u.name} <span style="color:#c9a227">Lv${u.level}${starIcon}</span></div><div class="beast-stats">HP:${u.hp}/${u.maxHp} | ATK:${u.atk}</div>${tagsHtml}<div class="unit-equip-icons" style="bottom:2px; left:0; width:100%; position:absolute;">${equipsHtml}</div>`;
        
        card.onclick = (e) => {
            if(readOnly) return;

            if (isBattle) {
                if(e.target.closest('.equip-badge') || selectedInventoryIndex !== null) {
                    showMessage("Equipamentos só podem ser alterados fora de combate!", '#f39c12');
                    selectedInventoryIndex = null;
                    renderManagement(mode);
                    return;
                }
            }

            let target = e.target.closest('.equip-badge');
            if(target) {
                let eqIdx = parseInt(target.getAttribute('data-idx'));
                let eq = u.equipment[eqIdx];
                let eqDef = ITEMS[eq.id];
                if(eqDef.onUnequip) eqDef.onUnequip(u, eq.level); 
                u.equipment.splice(eqIdx, 1);
                game.inventory.push(eq); 
                renderManagement(mode);
                if(typeof updateUI === 'function') updateUI(); 
                if(renderer) renderer.draw();
                return;
            }
            
            if(selectedInventoryIndex !== null) {
                let invItem = game.inventory[selectedInventoryIndex];
                let iDef = ITEMS[invItem.id];
                
                let existingEq = u.equipment.find(eq => eq.id === invItem.id);
                if(existingEq) {
                    if(iDef.onUnequip) iDef.onUnequip(u, existingEq.level);
                    existingEq.level++; 
                    if(iDef.onEquip) iDef.onEquip(u, existingEq.level);
                    showPopup(`✨ Fusão Lv${existingEq.level}!`, u, '#c9a227');
                } else {
                    u.equipment.push({...invItem});
                    if(iDef.onEquip) iDef.onEquip(u, invItem.level);
                }
                
                game.inventory.splice(selectedInventoryIndex, 1);
                selectedInventoryIndex = null;
                renderManagement(mode);
                if(typeof updateUI === 'function') updateUI();
                if(renderer) renderer.draw();
                return;
            }

            if (isBattle) {
                showMessage("Não pode trocar de feras em combate!", '#e74c3c');
                return;
            }

            if(isBox) {
                if(deployedRoster.filter(x=>!x.isLeader).length<maxLimit){
                    rosterMemory.splice(rosterMemory.indexOf(u),1);
                    deployedRoster.push(u);
                } else { alert("Limite máximo em campo!"); }
            } else {
                if(!u.isLeader){
                    deployedRoster.splice(deployedRoster.indexOf(u),1);
                    rosterMemory.push(u);
                } else { alert("O Líder não pode sair do campo."); }
            }
            renderManagement(mode);
        };
        container.appendChild(card);
    };

    let depGrid=$('mgmt-deploy-grid'); depGrid.innerHTML='';
    deployedRoster.forEach(u => renderBeast(u, depGrid, false));

    let boxGrid=$('mgmt-box-grid'); boxGrid.innerHTML='';
    rosterMemory.forEach(u => renderBeast(u, boxGrid, true));

    let synList=$('mgmt-synergy-list');synList.innerHTML='';
    let sys=calculateSynergies(deployedRoster);
    Object.keys(TAGS).forEach(tag=>{
        let tData=TAGS[tag];let count=sys[tag]||0;
        if(count>0){let active=count>=tData.req;let el=document.createElement('div');el.className='syn-item';el.innerHTML=`<span style="color:${tData.col};${active?'font-weight:bold;text-shadow:0 0 5px '+tData.col:''}">${tData.name} (${count}/${tData.req})</span><span style="font-size:9px;flex:1;text-align:right;margin-left:10px;color:${active?'#fff':'#666'}">${tData.desc}</span>`;synList.appendChild(el);}
    });
}

function openManagement(){ hide('shop-screen'); show('management-screen'); hide('btn-close-team'); show('btn-start-stage'); renderManagement('prep'); }

function openTeamView(){
    if(game && !game.gameOver) {
        deployedRoster = game.units.filter(u => u.faction === 1);
    }
    const pm = $('pause-menu'); if(pm) pm.classList.add('hidden');
    show('management-screen');
    hide('btn-start-stage');
    show('btn-close-team');
    renderManagement('battle');
}

// ==========================================
// 5. TELAS EXTRAS (Seleção, Bestiário, Relicário)
// ==========================================
function openLeaderSelection(isRoguelite){
    $('mode-screen').classList.add('hidden');$('leader-selection').classList.remove('hidden');
    const container=$('leader-list');container.innerHTML='';
    LEADERS.forEach(l=>{
        const btn=document.createElement('button');
        const grimTags=(LEADER_GRIMOIRE_TAGS[l.id]||l.tags||[]).map(t=>getTagHTML(t)).join('');
        btn.innerHTML=`<div style="font-size:16px;color:var(--gold-light);margin-bottom:4px;">${l.emoji} ${l.name}</div><div style="font-size:11px;text-transform:none;color:#aaa;font-weight:normal;margin-bottom:5px;">${l.desc}</div><div style="display:flex;flex-wrap:wrap;gap:3px;">${grimTags}</div>`;
        btn.onclick=()=>{$('leader-selection').classList.add('hidden');startGame(false,isRoguelite,l.id);};
        container.appendChild(btn);
    });
    $('btn-close-leader').onclick=()=>{$('leader-selection').classList.add('hidden');$('mode-screen').classList.remove('hidden');};
}

function openBestiary(){
    $('main-menu').classList.add('hidden');$('bestiary-screen').classList.remove('hidden');
    const grid=$('bestiary-grid');grid.innerHTML='';
    const uniqueBeasts=[];const seen=new Set();
    ALL_BEASTS.forEach(b=>{if(!seen.has(b.name)){seen.add(b.name);uniqueBeasts.push(b);}});
    uniqueBeasts.forEach(b=>{
        const isUnlocked=unlockedBeasts.includes(b.name);
        const card=document.createElement('div');card.className=`beast-card ${isUnlocked?'unlocked':'locked'}`;
        const icon=`<span class="beast-icon ${!isUnlocked?'locked-icon':''}" style="filter:${isUnlocked?(b.filter||'none'):'none'}">${b.e}</span>`;
        const name=`<div class="beast-name">${isUnlocked?b.name:'???'}</div>`;
        const stats=isUnlocked?`<div class="beast-stats">HP:${b.hp}|ATK:${b.atk}<br>Alc:${b.range}|Mov:${b.mp}</div>`:`<div class="beast-stats">Desconhecido</div>`;
        const tags=isUnlocked?`<div style="margin-top:4px;display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">${(b.tags||[]).map(t=>getTagHTML(t)).join('')}</div>`:'';
        card.innerHTML=icon+name+stats+tags;
        if(isUnlocked)card.onclick=()=>showBeastDetails(b);
        grid.appendChild(card);
    });
}

function openReliquary(fromPause=false){
    $('main-menu').classList.add('hidden');$('reliquary-screen').classList.remove('hidden');
    const grid=$('reliquary-grid');grid.innerHTML='';let arts=[];
    if(fromPause&&game){$('btn-toggle-reliquary').classList.add('hidden');arts=getActiveArtifacts();$('reliquary-subtitle').innerText=game.isRoguelite?"Artefatos Atuais (Roguelite)":"Artefatos Atuais (Campanha)";}
    else{$('btn-toggle-reliquary').classList.remove('hidden');arts=reliquaryViewMode==='camp'?activeArtifactsCamp:activeArtifactsRogue;$('reliquary-subtitle').innerText=reliquaryViewMode==='camp'?"Todos os Artefatos (Campanha)":"Todos os Artefatos (Roguelite)";$('btn-toggle-reliquary').innerText=reliquaryViewMode==='camp'?"🔄 Ver Roguelite":"🔄 Ver Campanha";}
    if(arts.length===0){grid.innerHTML='<div style="color:#aaa;grid-column:1/-1;text-align:center;padding:20px;">Nenhum artefato adquirido neste modo.</div>';return;}
    arts=[...new Set(arts)];
    ARTIFACTS.forEach(art=>{if(arts.includes(art.id)){const card=document.createElement('div');card.className=`shop-card rarity-${art.rarity}`;card.style.borderColor=art.color;card.innerHTML=`<span class="shop-icon">${art.icon}</span><div class="shop-title" style="color:${art.color}">${art.name}</div><div class="shop-desc" style="margin-bottom:0;">${art.desc}</div>`;grid.appendChild(card);}});
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
        if(!base) return;
        let copies = m.filter(u => u !== base && u.baseName === base.baseName);
        if(copies.length === 0) { alert("Você não possui nenhuma cópia desta fera!"); openLaboratory(); return; }
        let sac = await window.promptSelectUnit("Selecione o Sacrifício", copies);
        if(!sac) { openLaboratory(); return; }
        
        game.dna -= 2;
        base.starLevel = (base.starLevel || 1) + 1;
        base.maxHp += Math.floor(sac.maxHp * 0.5);
        base.hp = base.maxHp;
        base.atk += Math.floor(sac.atk * 0.5);
        
        if(rosterMemory.includes(sac)) rosterMemory.splice(rosterMemory.indexOf(sac), 1);
        if(deployedRoster.includes(sac)) deployedRoster.splice(deployedRoster.indexOf(sac), 1);
        
        alert(`Sucesso! ${base.name} alcançou Estrela ${base.starLevel}!`);
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
        if(!base) return;
        let sacs = m.filter(u => u !== base);
        if(sacs.length === 0) { alert("Não há feras suficientes para sacrificar."); openLaboratory(); return; }
        let sac = await window.promptSelectUnit("Selecione o Sacrifício", sacs);
        if(!sac) { openLaboratory(); return; }
        
        game.dna -= 3;
        base.maxHp += Math.floor(sac.maxHp * 0.3);
        base.hp += Math.floor(sac.maxHp * 0.3);
        base.atk += Math.floor(sac.atk * 0.3);
        
        let newTags = sac.tags.filter(t => !base.tags.includes(t));
        if(newTags.length > 0) base.tags.push(newTags[Math.floor(Math.random()*newTags.length)]);
        
        let newAbs = sac.abilities.filter(a => !base.abilities.includes(a));
        if(newAbs.length > 0) base.abilities.push(newAbs[Math.floor(Math.random()*newAbs.length)]);
        
        if(rosterMemory.includes(sac)) rosterMemory.splice(rosterMemory.indexOf(sac), 1);
        if(deployedRoster.includes(sac)) deployedRoster.splice(deployedRoster.indexOf(sac), 1);
        
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
        if(!c.req()) btn.disabled = true;
        
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
    for(let i = 0; i < numFloors; i++) {
        let numNodes = (i === numFloors - 1) ? 1 : 3;
        let floor = [];
        for(let j = 0; j < numNodes; j++) {
            let type = 'BATTLE';
            if(i === numFloors - 1) type = 'BOSS';
            else if(i === 0) type = 'BATTLE';
            else if(i === Math.floor(numFloors/2)) type = 'TREASURE';
            else {
                if (j === 1) {
                    type = Math.random() < 0.8 ? 'BATTLE' : 'ELITE';
                } else {
                    let r = Math.random();
                    if(r < 0.25) type = 'BATTLE';      
                    else if(r < 0.45) type = 'EVENT';  
                    else if(r < 0.60) type = 'ELITE';  
                    else if(r < 0.80) type = 'SHOP';   
                    else type = 'LAB';                 
                }
            }
            floor.push({ id: `f${i}_n${j}`, floor: i, pos: j, type: type, next: [], status: i===0 ? 'reachable' : 'locked' });
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
    for(let i = 0; i < numFloors - 1; i++) {
        let currentFloor = map[i];
        let nextFloor = map[i+1];
        currentFloor.forEach((node, j) => {
            if(nextFloor.length === 1) { node.next.push(nextFloor[0].id); }
            else {
                node.next.push(nextFloor[j].id);
                if(j > 0 && Math.random() < 0.4) node.next.push(nextFloor[j-1].id);
                if(j < nextFloor.length-1 && Math.random() < 0.4) node.next.push(nextFloor[j+1].id);
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
            
            if(node.status === 'reachable') {
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
                    if(startEl && endEl) {
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
        if(n.status === 'reachable') n.status = 'locked'; 
    }));
    node.status = 'completed';
    game.currentFloor = node.floor;
    game.currentRouteType = node.type; 
    
    node.next.forEach(nextId => {
        let nData = game.routeMap.flat().find(x => x.id === nextId);
        if(nData) nData.status = 'reachable';
    });
    
    autoSave();
    hide('route-map-screen');

    if(!game.eventFlags) game.eventFlags = {};
    
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
        if(btnL) {
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
function triggerStageEnd(win){
    show('result-screen');hide('rs-menu-win');hide('rs-menu-lose');
    if(win){
        if (typeof countKingdomBuildings === 'function' && game.kingdomMap) {
            let pWood = window.countKingdomBuildings('LUMBERMILL') * 3;
            let pStone = window.countKingdomBuildings('MINE') * 3;
            let pScales = window.countKingdomBuildings('FISHINGCAMP') * 3;
            let pSand = window.countKingdomBuildings('SANDPIT') * 3;
            let pGold = window.countKingdomBuildings('MINE') * 10;

            if (!game.resources) game.resources = { wood:0, stone:0, scales:0, sand:0, blood:0 };
            game.resources.wood += pWood; game.resources.stone += pStone;
            game.resources.scales += pScales; game.resources.sand += pSand;
            game.gold += pGold;
            
            if (pWood || pStone || pScales || pSand || pGold) {
                setTimeout(() => showMessage(`Reino gerou: ${pWood}🌲 ${pStone}⛰️ ${pScales}🐟 ${pSand}⏳ ${pGold}💰`, '#2ecc71'), 1500);
            }
        }
        if(game.pendingDrop) {
            if(typeof window.giveRandomArtifact === 'function') window.giveRandomArtifact(game.pendingDrop);
            game.pendingDrop = null;
        }

        $('rs-title').innerText="Vitória!";$('rs-title').style.color='#c9a227';
        show('rs-menu-win');
        let survivors=game.units.filter(u=>u.faction===1);
        deployedRoster=survivors.map(u=>{u.furyAtk=0;u.hasAttacked=false;u.status=null;u.spellsCast=0;return u;});
        
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
                if(!rogs.includes('art_omega')) { 
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
            $('rs-desc').innerText=`Avançando...`;
            btn.innerText = "Retornar ao Reino 🏰";
            btn.onclick = () => { openKingdom(); };
        }
    } else {
        $('rs-title').innerText="Derrota";$('rs-title').style.color='#c0392b';
        if(game.isRoguelite){$('rs-desc').innerText='Seu líder caiu. Fim da Run.';$('btn-retry').innerText='↺ Iniciar Nova Run';localStorage.removeItem('ht_save_rogue');}
        else{$('rs-desc').innerText='Seu exército recuou. Tente a fase novamente.';$('btn-retry').innerText='↺ Tentar Novamente';}
        show('rs-menu-lose');
    }
}

function advanceCampaign(){
    game.isAnimating=false; 
    const tb=$('turn-blocker'); 
    if(tb) tb.style.display='none'; 
    lastState=null; 
    const undoBtn=$('btn-undo'); 
    if(undoBtn) undoBtn.disabled=true;
    
    if(game.currentLevel > stats.maxLevel){
        stats.maxLevel=game.currentLevel;
        localStorage.setItem('ht_stats',JSON.stringify(stats));
    }
    
    hide('management-screen');
    hide('route-map-screen'); 
    hide('event-screen');
    show('game-container'); 
    
    setTimeout(() => {
        const r=deployedRoster.map(m=>new Unit({...m,q:0,r:0,hasAttacked:false,status:null,isNew:false}));
        game.generateCampaignMap(r);
        renderer.initCamera(true);
        updateUI();
        autoSave();
    }, 50);
}


function startGame(load,isRoguelite=false,leaderId=null){
    hide('mode-screen');hide('main-menu');hide('result-screen');
    const sk=isRoguelite?'ht_save_rogue':'ht_save_camp';
    game.isAnimating=false; const tb=$('turn-blocker'); if(tb) tb.style.display='none';
    lastState=null; const undoBtn=$('btn-undo'); if(undoBtn) undoBtn.disabled=true;
    game.manaPool={};game.spentMana={};game.spellCooldowns={};game.activeSpell=null;game.lastDeadAlly=null;game.turnCount=0;
    
    if(!ARTIFACTS.find(a=>a.id==='art_omega')){
        ARTIFACTS.push({id:'art_omega',name:'Coração do Infinito',icon:'🌌',desc:'+20 HP, +5 ATK e +1 Limite de Exército.',cost:999,rarity:'legendary',color:'#ff00ff', type:'equip', onEquip:(u,lvl)=>{u.maxHp+=20*lvl;u.hp+=20*lvl;u.atk+=5*lvl;}, onUnequip:(u,lvl)=>{u.maxHp-=20*lvl;u.atk-=5*lvl;u.hp=Math.min(u.hp,u.maxHp);}});
    }
    
    if(load){
        const d=JSON.parse(localStorage.getItem(sk));
        game.resources = d.resources || { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 };
        game.kingdomMap = new Map(d.kingdomMap || []);
        game.currentLevel=d.level;game.cols=d.cols;game.rows=d.rows;game.gold=d.gold||0;
        game.dna=d.dna||0;
        game.isRoguelite=d.isRoguelite||false;
        game.routeMap = d.routeMap; game.currentFloor = d.currentFloor; game.inventory = d.inventory || [];
        game.isBossStage = d.isBossStage || false; game.currentRouteType = d.currentRouteType || 'BATTLE';
        game.manaPool = d.manaPool || {};
        game.spentMana = d.spentMana || {};
        game.spellCooldowns = d.spellCooldowns || {};

        const stInd = $('stage-indicator'); if(stInd) stInd.innerText=`ATO ${toRoman(game.currentLevel)} - NÓ ${game.currentFloor + 1}`;
        game.map.clear();
        if(d.leaderId)game.leaderData=LEADERS.find(l=>l.id===d.leaderId)||LEADERS[0];
        d.map.forEach(h=>game.map.set(`${h.q},${h.r}`,new Hex(h.q,h.r,TERRAINS[h.tId],h.owner)));
        game.units=d.units.map(u=>new Unit({...u,isNew:false}));
        rosterMemory=(d.rosterMemory||[]).map(u=>new Unit({...u,isNew:false}));
        deployedRoster=(d.deployedRoster||game.units.filter(u=>u.faction===1)).map(u=>new Unit({...u,isNew:false}));
        if(d.items)d.items.forEach(([k,v])=>game.items.set(k,v));
        
        game.currentTurn=1;game.gameOver=false;game.selectPlayerLeader();
        updateUI();renderer.initCamera(true); show('game-container');
    } else {
        if(localStorage.getItem(sk))localStorage.removeItem(sk);
        game.currentLevel=1;game.gold=0;game.dna=0;game.isRoguelite=isRoguelite;rosterMemory=[];deployedRoster=[]; game.inventory=[];
        game.resources = { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 };
        game.generateKingdomMap();
        game.kingdomMap = new Map();
        if(leaderId)game.leaderData=LEADERS.find(l=>l.id===leaderId)||LEADERS[0];
        
        generateRouteMap();
        
        let lD=game.leaderData;
        deployedRoster.push(new Unit({q:0,r:0,faction:1,isLeader:true,name:lD.name,emoji:lD.emoji,hp:lD.hp,maxHp:lD.hp,mp:lD.mp,maxMp:lD.mp,atk:lD.atk,range:lD.range,isNew:true,tags:lD.tags||[],fav:lD.fav||[],knownSpells:[SPELLS.find(s=>s.level===1&&s.tags.includes(lD.tags[0])).id],grimTags:[...(lD.tags||[])]}));
        
        renderRouteMap(); 
    }
    
}

// ==========================================
// SISTEMA DE GERENCIAMENTO DO REINO
// ==========================================
let kingdomHexSize = 45;
let kingdomOffsetX = 0, kingdomOffsetY = 0;
let selectedBuilding = null;
let kRenderer = null;
let isKDragging = false;
let startKX, startKY, initKOffX, initKOffY;
let initKPinch = null, initKSize = null;

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

    // REGRA DE OURO: Garante apenas um Castelo Real no centro do mapa (coordenadas 4,4)
    let hasCastle = Array.from(game.kingdomMap.values()).some(h => h.building === 'CASTLE');
    if (!hasCastle) {
        let centerHex = game.kingdomMap.get("4,4") || Array.from(game.kingdomMap.values())[0];
        if (centerHex) { centerHex.building = 'CASTLE'; centerHex.bLevel = 1; }
    }

    // Atualiza os contadores de recursos na tela
    let res = game.resources || { wood:0, stone:0, scales:0, sand:0, blood:0 };
    if($('k-res-gold')) $('k-res-gold').innerText = game.gold;
    if($('k-res-dna')) $('k-res-dna').innerText = game.dna || 0;
    if($('k-res-wood')) $('k-res-wood').innerText = res.wood;
    if($('k-res-stone')) $('k-res-stone').innerText = res.stone;
    if($('k-res-scales')) $('k-res-scales').innerText = res.scales;
    if($('k-res-sand')) $('k-res-sand').innerText = res.sand;

    // Inicializa o motor gráfico e os inputs de câmera livre
    setTimeout(() => {
        const canvasEl = $('kingdomCanvas');
        if (!canvasEl) return;

        if (!kRenderer) {
            kRenderer = new KingdomRenderer(canvasEl, game);
            
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
            if ($('building-menu') && !$('building-menu').classList.contains('hidden')) renderBuildingMenu();
        }
        
        kRenderer.initCamera();
        kRenderer.draw();
        if ($('building-menu')) hide('building-menu');
    }, 150);
}

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
                let icon = res==='wood'?'🌲':res==='stone'?'⛰️':res==='scales'?'🐟':res==='sand'?'⏳':'🩸';
                let reqAmt = amt * nextLvl;
                let color = (game.resources[res] || 0) >= reqAmt ? '#fff' : 'var(--enemy-color)';
                return `<span style="color:${color}; font-size:11px; font-weight:bold;">${icon}${reqAmt}</span>`;
            }).join(' ');

            html += `<div style="margin-bottom:4px; font-size:9px; color:var(--gold-dark); text-transform:uppercase;">Melhoria para Nv ${nextLvl}:</div>
                     <div style="display:flex; gap:8px; margin-bottom:8px; background:rgba(0,0,0,0.5); padding:4px 8px; border-radius:4px;">${costHtml}</div>
                     <button id="btn-upgrade-b" class="btn-warning" style="padding:6px 12px; font-size:10px; cursor:${canAfford?'pointer':'not-allowed'}; opacity:${canAfford?'1':'0.5'};">⬆️ Dar Upgrade</button>`;
        } else {
            html += `<div style="color:var(--success); font-size:11px; font-weight:bold; margin-top:6px; letter-spacing:1px;">NÍVEL MÁXIMO</div>`;
        }
        
        html += `</div>`;
        menu.innerHTML = html;
        
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
                            showPopup("🌾 +10 HP Geral!", hex, '#2ecc71');
                        }
                        
                        let resObj = game.resources || {};
                        if($('k-res-wood')) $('k-res-wood').innerText = resObj.wood || 0;
                        if($('k-res-stone')) $('k-res-stone').innerText = resObj.stone || 0;
                        if($('k-res-scales')) $('k-res-scales').innerText = resObj.scales || 0;
                        if($('k-res-sand')) $('k-res-sand').innerText = resObj.sand || 0;
                        
                        kRenderer.draw();
                        renderBuildingMenu();
                        autoSave();
                        showPopup("⬆️ Nível " + nextLvl, hex, 'var(--gold-light)');
                    }
                };
            }
        }
        return; 
    }

    let hasOptions = false;
    let tId = 'PLAINS';
    if (hex.terrain) {
        if (hex.terrain.id) tId = hex.terrain.id;
        else if (typeof hex.terrain === 'string') tId = hex.terrain;
    }
    tId = tId.toUpperCase();

    Object.values(BUILDINGS).forEach(b => {
        if (b.id === 'CASTLE') return; 
        if (!b.terrains || !b.terrains.includes(tId)) return; 

        hasOptions = true;
        const canAfford = Object.entries(b.cost).every(([res, amt]) => (game.resources[res] || 0) >= amt);
        const btn = document.createElement('button');
        btn.style.cssText = `display:flex; flex-direction:column; align-items:center; min-width:140px; background:rgba(20,20,30,0.8); border:1px solid ${canAfford ? 'var(--success)' : '#555'}; padding:10px; border-radius:8px; cursor:${canAfford ? 'pointer' : 'not-allowed'};`;
        
        const costHtml = Object.entries(b.cost).map(([res, amt]) => {
            let icon = res==='wood'?'🌲':res==='stone'?'⛰️':res==='scales'?'🐟':res==='sand'?'⏳':'🩸';
            let color = (game.resources[res] || 0) >= amt ? '#fff' : 'var(--enemy-color)';
            return `<span style="color:${color}; font-size:11px; font-weight:bold;">${icon}${amt}</span>`;
        }).join(' ');

        btn.innerHTML = `<span style="font-size:26px;">${b.icon}</span><span style="font-size:11px; color:var(--gold-light); margin:4px 0; font-weight:bold;">${b.name}</span><div style="display:flex; gap:6px;">${costHtml}</div><span style="font-size:9px; color:#aaa; margin-top:6px; text-align:center;">${b.desc}</span>`;
        
        if (canAfford) {
            btn.onclick = async () => {
                Object.entries(b.cost).forEach(([res, amt]) => game.resources[res] -= amt);
                hex.building = b.id; 
                hex.bLevel = 1; 
                
                if (b.id === 'CHURCH') {
                    let celestial = BEASTS.LAND.find(bst => (bst.tags||[]).includes('CELESTIAL')) || BEASTS.LAND[1]; 
                    rosterMemory.push(new Unit({q:0,r:0,faction:1,isLeader:false,name:celestial.name,baseName:celestial.name,emoji:celestial.e,hp:celestial.hp,maxHp:celestial.hp,mp:celestial.mp,maxMp:celestial.mp,atk:celestial.atk,range:celestial.range,level:1,abilities:[...celestial.abilities],isNew:true,filter:celestial.filter,tags:celestial.tags||[],fav:celestial.fav||[]}));
                    if(typeof showZeldaPopup === 'function') await showZeldaPopup("👼", "Invocação Celestial!", "Uma fera Celestial foi enviada com sucesso para a Box!");
                }
                if (b.id === 'FARM') {
                    [...rosterMemory, ...deployedRoster].forEach(u => { u.maxHp += 10; u.hp += 10; });
                    showPopup("🌾 +10 HP Geral!", hex, '#2ecc71');
                }

                let resObj = game.resources || {};
                if($('k-res-wood')) $('k-res-wood').innerText = resObj.wood || 0;
                if($('k-res-stone')) $('k-res-stone').innerText = resObj.stone || 0;
                if($('k-res-scales')) $('k-res-scales').innerText = resObj.scales || 0;
                if($('k-res-sand')) $('k-res-sand').innerText = resObj.sand || 0;
                
                kRenderer.draw(); 
                renderBuildingMenu(); 
                autoSave(); 
                if (b.id !== 'CHURCH') showPopup("✨ Construído!", hex, '#2ecc71');
            };
        }
        menu.appendChild(btn);
    });
    
    if(!hasOptions) menu.innerHTML = '<div style="color:#aaa; padding:10px; font-style:italic;">Nenhuma construção disponível para este tipo de terreno.</div>';
}