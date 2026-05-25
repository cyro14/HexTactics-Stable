// ==========================================
// CLASSES DO DOMÍNIO E MOTOR DO JOGO
// ==========================================

class Hex {
    constructor(q, r, terrain, owner = null) {
        this.q = q; this.r = r; this.terrain = terrain; this.owner = owner;
    }
    static distance(a, b) { return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2; }
    static getNeighbors(q, r) { return [{ q: q + 1, r: r }, { q: q + 1, r: r - 1 }, { q: q, r: r - 1 }, { q: q - 1, r: r }, { q: q - 1, r: r + 1 }, { q: q, r: r + 1 }]; }
    getKey() { return `${this.q},${this.r}`; }
}

class Unit {
    constructor(d) {
        Object.assign(this, {
            q: d.q, r: d.r, vq: d.q, vr: d.r, faction: d.faction,
            isLeader: d.isLeader || false, name: d.name, baseName: d.baseName || d.name,
            emoji: d.emoji, hp: d.hp, maxHp: d.maxHp, mp: d.mp, maxMp: d.maxMp,
            atk: d.atk, range: d.range, level: d.level || 1, xp: d.xp || 0,
            starLevel: d.starLevel || 1,
            hasAttacked: d.hasAttacked || false, status: d.status || null,
            isBoss: d.isBoss || false, alerted: d.alerted || false,
            filter: d.filter || 'none', tags: d.tags || [], fav: d.fav || [],
            furyAtk: d.furyAtk || 0, knownSpells: d.knownSpells || [],
            grimTags: d.grimTags || [], spellsCast: d.spellsCast || 0,
            _origFaction: d._origFaction, _mcDuration: d._mcDuration
        });

        this.abilities = (d.abilities || []).concat(d.ability ? [d.ability] : []).filter(Boolean);
        this.maxXp = 250; this.hitTimer = false;

        this.hexesMovedThisTurn = 0;
        this.undyingTurns = 0;
        // Destrutividade do T-Rex
        if (this.baseName === 'T-Rex') {
            if (!this.abilities.includes('corte_amplo')) this.abilities.push('corte_amplo');
        }

        this.equipment = (d.equipment || []).map(e => {
            if (typeof e === 'string' && typeof ITEMS !== 'undefined') {
                let foundId = Object.keys(ITEMS).find(k => ITEMS[k].icon === e);
                return { id: foundId || 'SWORD', level: 1 };
            }
            return e;
        });

        if (this.faction === 1 && d.isNew && typeof getActiveArtifacts === 'function') {
            const arts = getActiveArtifacts();
            if (arts.includes('art_hp')) { this.maxHp += 15; this.hp += 15; }
            if (arts.includes('art_atk')) { this.atk += 8; }
            if (this.isLeader && arts.includes('art_move')) { this.maxMp += 1; this.mp += 1; }
            if (this.isLeader && arts.includes('art_crystal')) { this.range += 1; this.atk += 5; }
            if (arts.includes('art_wild_call')) { this.tags.push('WILD_CALL'); }
            if (arts.includes('art_umbral_seal') && !this.tags.includes('UMBRAL')) this.tags.push('UMBRAL');
            if (arts.includes('art_celestial_seal') && !this.tags.includes('CELESTIAL')) this.tags.push('CELESTIAL');

            // Bônus global da Fazenda para unidades recém adquiridas!
            if (typeof countKingdomBuildings === 'function') {
                let farms = window.countKingdomBuildings('FARM');
                this.maxHp += (10 * farms);
                this.hp += (10 * farms);
            }
        }
    }

    getEffectiveAtk(gameObj) {
        let base = this.atk + this.furyAtk;
        if (this.isLeader && this.name === "Chefe Orc") {
            const allies = gameObj.units.filter(u => u.faction === this.faction && !u.isLeader && u.hp > 0).length;
            base = Math.floor(base * (1 + 0.10 * allies));
        }
        return base;
    }

    getEffectiveRange(game) {
        let r = this.range;
        // Se for Silvestre, Aliado e tiver uma Arqueira do lado
        if (this.tags && this.tags.includes('SILVESTRE') && this.faction === 1 && game) {
            let archer = game.units.find(u => u.baseName === 'Arqueira' && u.faction === 1 && Hex.distance(this, u) === 1);
            if (archer) r += 1;
        }
        return r;
    }

    getMovementCost(terrain, sys = {}) {
        if (this.fav.includes(terrain.id)) return 1;
        if (this.tags.includes('WING') && sys['WING'] >= 2) return 1;
        if (this.tags.includes('ABYSSAL') && sys['ABYSSAL'] >= 3) return 1;

        if (this.baseName === 'Almirante' && terrain.id === 'WATER') return 1;
        return terrain.cost;
    }

    resetTurn() {
        this.mp = this.maxMp; this.hasAttacked = false; this.spellsCast = 0;
        if (this.status === 'bind' || this.status === 'stun') this.mp = 0;
    }

    addXp(amt) {
        if (this.faction === 0) return;
        this.xp += amt;
        if (this.xp >= this.maxXp) {
            this.level++; this.xp -= this.maxXp; this.maxHp += 20; this.hp += 20; this.atk += 6;
            this.maxXp = Math.floor(this.maxXp * 1.8); this.triggerEvolve();
        }
    }

    async triggerEvolve() {
        game.isAnimating = true;
        if (typeof showPopup === 'function') showPopup(`⬆ Nível ${this.level}!`, this, '#c9a227');
        if (typeof addLog === 'function') addLog(`✨ ${this.name} evoluiu para Nível ${this.level}!`, '#c9a227');

        const oF = this.filter;
        if (typeof sleep === 'function') {
            for (let i = 0; i < 6; i++) {
                this.filter = i % 2 === 0 ? 'brightness(200%) sepia(100%) hue-rotate(50deg) saturate(300%)' : oF;
                if (renderer) renderer.draw(); await sleep(150);
            }
        }
        this.filter = oF;

        if (this.level >= 2 && !this.isLeader) {
            let ev = EVOS[this.baseName] || [this.baseName + ' Alfa', this.baseName + ' Supremo'];
            this.name = this.level === 2 ? ev[0] : ev[1];

            const evs = {
                '🐺': () => { if (this.filter === 'none') this.filter = 'saturate(200%) hue-rotate(330deg)'; },
                '🐗': () => this.emoji = '🦏', '🐻': () => this.emoji = '🐼', '🐭': () => this.emoji = '🐀',
                '🐇': () => { this.emoji = '🦘'; this.name = "Canguru Boxeador"; this.atk += 5; },
                '🐢': () => { this.emoji = '🦕'; this.name = "Dinossauro Escudo"; this.maxHp += 40; this.hp += 40; },
                '🐴': () => { this.emoji = '🦄'; this.name = "Unicórnio Místico"; if (!this.abilities.includes('dodge') && this.abilities.length < 2) this.abilities.push('dodge'); if (!this.tags.includes('CELESTIAL')) this.tags.push('CELESTIAL'); },
                '🐍': () => { this.emoji = '🐍'; this.name = "Basilisco"; }, '🦂': () => { this.emoji = '🦂'; this.name = "Imperador do Deserto"; },
                '🐒': () => { this.emoji = '🦍'; this.name = "Gorila Rei"; }, '🦊': () => { this.emoji = '🦊'; this.name = "Raposa de Nove Caudas"; },
                '🐧': () => { this.emoji = '🦭'; this.name = "Morsa Blindada"; }, '🐸': () => { this.emoji = '🐸'; this.name = "Sapo-Boi Gigante"; },
                '🐦': () => { this.emoji = '🦅'; this.name = "Fênix"; if (!this.tags.includes('CELESTIAL')) this.tags.push('CELESTIAL'); if (!this.tags.includes('FIRE')) this.tags.push('FIRE'); }
            };
            if (evs[this.emoji]) evs[this.emoji]();
            if (typeof unlockInBestiary === 'function') unlockInBestiary(this.name);
        }

        if (this.isLeader && this.faction === 1) {
            game.isAnimating = false;
            if (typeof showSpellLearnModal === 'function') await showSpellLearnModal(this, Math.min(this.level, 5));
            game.isAnimating = true;
        }

        if (renderer) renderer.draw();
        game.isAnimating = false;
    }
}

class Game {
    constructor() {
        this.inventory = [];
        this.currentLevel = 1; this.currentFloor = -1;
        this.map = new Map(); this.units = []; this.items = new Map();
        this.currentTurn = 1; this.selectedUnit = null; this.selectedHex = null;
        this.reachableHexes = new Map(); this.tameMode = false; this.gameOver = false;
        this.isAnimating = false; this.cols = 13; this.rows = 9;
        this.gold = 0;
        this.dna = 0;
        this.isRoguelite = false; this.hasKey = false; this.hasEgg = false;
        this.leaderData = typeof LEADERS !== 'undefined' ? LEADERS[0] : {};
        this.activeSynergies = {}; this.manaPool = {}; this.spentMana = {};
        this.spellCooldowns = {}; this.activeSpell = null; this.lastDeadAlly = null; this.turnCount = 0;
        this.resources = { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 };
        this.kingdomMap = new Map();
    }

    generateKingdomMap() {
        this.kingdomMap = new Map();
        // Usa o tamanho base de um mapa inicial
        const kCols = 13, kRows = 9;

        for (let r = 0; r < kRows; r++) {
            const off = Math.floor(r / 2);
            for (let q = -off; q < kCols - off; q++) {
                const rnd = Math.random();
                let t = TERRAINS.PLAINS;

                // Distribuição de terrenos igual a do jogo, mas sem Vilas e Castelos
                if (rnd > 0.90) t = TERRAINS.MOUNTAIN;
                else if (rnd > 0.80) t = TERRAINS.SNOW;
                else if (rnd > 0.65) t = TERRAINS.WATER;
                else if (rnd > 0.50) t = TERRAINS.FOREST;
                else if (rnd > 0.35) t = TERRAINS.DESERT;

                this.kingdomMap.set(`${q},${r}`, { q: q, r: r, terrain: t, building: null });
            }
        }
    }

    getNearestEnemy(unit, maxRange) { return this.units.filter(u => u.faction !== unit.faction && u.hp > 0 && Hex.distance(unit, u) <= maxRange).sort((a, b) => Hex.distance(unit, a) - Hex.distance(unit, b))[0] || null; }
    getUnitLvl(b) { if (b.isBoss) return this.currentLevel; let isS = b.hp >= 50 || b.atk >= 12; return Math.max(1, this.currentLevel - (isS ? 1 : 2)); }
    getSynergies(factionId) { return typeof calculateSynergies === 'function' ? calculateSynergies(this.units.filter(u => u.faction === factionId)) : {}; }

    generateCampaignMap(savedRoster = []) {
        if (!this.eventFlags) this.eventFlags = {};
        let act = this.currentLevel; let depth = Math.max(0, this.currentFloor);
        this.cols = 13 + (act - 1); this.rows = 9 + Math.floor((act - 1) / 2);
        const stageInd = document.getElementById('stage-indicator');
        if (stageInd) stageInd.innerText = `ATO ${toRoman(act)} - NÓ ${depth + 1}`;
        const log = document.getElementById('combat-log'); if (log) log.innerHTML = '';
        this.map.clear(); this.units = []; this.items.clear(); this.hasKey = false;
        this.manaPool = {}; this.spentMana = {}; this.spellCooldowns = {}; this.activeSpell = null; this.lastDeadAlly = null; this.turnCount = 0;

        for (let r = 0; r < this.rows; r++) { const off = Math.floor(r / 2); for (let q = -off; q < this.cols - off; q++) { const rnd = Math.random(); let t = TERRAINS.PLAINS; if (rnd > 0.94) t = TERRAINS.MOUNTAIN; else if (rnd > 0.86) t = TERRAINS.SNOW; else if (rnd > 0.74) t = TERRAINS.WATER; else if (rnd > 0.62) t = TERRAINS.FOREST; else if (rnd > 0.52) t = TERRAINS.DESERT; else if (rnd > 0.45) t = TERRAINS.VILLAGE; this.map.set(`${q},${r}`, new Hex(q, r, t)); } }

        const mR = Math.floor(this.rows / 2); const pS = { q: -Math.floor(mR / 2), r: mR }; const aS = { q: this.cols - 1 - Math.floor(mR / 2), r: mR };
        let pSpawns = [pS]; let queue = [pS]; let vis = new Set([pS.q + ',' + pS.r]);
        while (queue.length > 0 && pSpawns.length < 20) { let curr = queue.shift(); Hex.getNeighbors(curr.q, curr.r).forEach(n => { let k = n.q + ',' + n.r; if (this.map.has(k) && !vis.has(k) && this.map.get(k).terrain.id !== 'WATER' && this.map.get(k).terrain.id !== 'MOUNTAIN') { vis.add(k); queue.push(n); pSpawns.push(n); } }); }
        if (pSpawns.length < 15) { this.map.forEach((h, k) => { if (!vis.has(k) && h.terrain.id !== 'CASTLE') { vis.add(k); pSpawns.push(h); } }); }
        this.map.set(pS.q + ',' + pS.r, new Hex(pS.q, pS.r, TERRAINS.CASTLE, 1)); this.map.set(aS.q + ',' + aS.r, new Hex(aS.q, aS.r, TERRAINS.CASTLE, 2));

        if (savedRoster.length > 0) {
            const pLData = savedRoster.find(u => u.isLeader); this.units.push(new Unit({ ...pLData, q: pSpawns[0].q, r: pSpawns[0].r, mp: pLData.maxMp, hasAttacked: false, isNew: false }));
            const mData = savedRoster.filter(u => !u.isLeader); mData.forEach((m, i) => { if (i + 1 < pSpawns.length) { this.units.push(new Unit({ ...m, q: pSpawns[i + 1].q, r: pSpawns[i + 1].r, mp: m.maxMp, hasAttacked: false, isNew: false })); } });
        }

        if (this.hasEgg) { this.hasEgg = false; let eggP = [BEASTS.LAND[1], BEASTS.LAND[2]]; let b = eggP[Math.floor(Math.random() * 2)]; let sn = pSpawns[this.units.length]; if (sn) { this.units.push(new Unit({ q: sn.q, r: sn.r, faction: 1, name: b.name, baseName: b.name, emoji: b.e, hp: b.hp, maxHp: b.hp, mp: b.mp, maxMp: b.mp, atk: b.atk, range: b.range, abilities: [...b.abilities], isNew: true, tags: b.tags || [], fav: b.fav || [] })); if (typeof addLog === 'function') addLog("🥚 O Ovo eclodiu!", "#2ecc71"); } }

        const playerLeader = this.units.find(u => u.isLeader && u.faction === 1);
        if (playerLeader) { this.units.filter(u => u.faction === 1 && !u.isLeader).forEach(u => { (u.tags || []).forEach(t => { if (!playerLeader.grimTags.includes(t)) playerLeader.grimTags.push(t); }); }); }

        let sFac = 1 + ((act - 1) * 0.4) + (depth * 0.05);
        let aiPool = [{ name: "Lord Vampiro", emoji: '🧛🏻‍♂️', hp: 65, mp: 6, atk: 16, range: 1, tags: ['UMBRAL'], fav: ['CASTLE'] }];
        LEADERS.forEach(l => { if (l.id !== this.leaderData.id) { aiPool.push({ name: l.name, emoji: l.emoji, hp: l.hp, mp: l.mp, atk: l.atk, range: l.range, tags: l.tags || [], fav: l.fav || [] }); } });
        aiPool.sort(() => Math.random() - 0.5); let chosenAI = aiPool[0]; let vHp = Math.floor(chosenAI.hp * sFac) + 20; let vAtk = Math.floor(chosenAI.atk * sFac) + 4;
        this.units.push(new Unit({ q: aS.q, r: aS.r, faction: 2, isLeader: true, name: chosenAI.name, baseName: chosenAI.name, emoji: chosenAI.emoji, hp: vHp, maxHp: vHp, mp: chosenAI.mp, maxMp: chosenAI.mp, atk: vAtk, range: chosenAI.range, isBoss: true, level: act, tags: chosenAI.tags, fav: chosenAI.fav }));

        let maxL = (typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_crown')) ? (this.leaderData.limit + 1) : (this.leaderData.limit || 6);
        const numAI = Math.min(maxL + 2, act + Math.floor(depth / 2));
        const aN = Hex.getNeighbors(aS.q, aS.r); let lP = BEASTS.LAND.filter(b => !b.minLevel || act >= b.minLevel);
        for (let i = 0; i < numAI; i++) { const b = lP[Math.floor(Math.random() * lP.length)]; const hn = aN[i]; let uLvl = this.getUnitLvl(b); let fFac = 1 + (uLvl - 1) * 0.2; if (hn && this.map.has(`${hn.q},${hn.r}`)) { this.units.push(new Unit({ q: hn.q, r: hn.r, faction: 2, name: b.name, baseName: b.name, emoji: b.e, hp: Math.floor(b.hp * fFac), maxHp: Math.floor(b.hp * fFac), mp: b.mp, maxMp: b.mp, atk: Math.floor(b.atk * fFac), range: b.range, abilities: [...b.abilities], filter: b.filter, tags: b.tags || [], fav: b.fav || [], level: uLvl })); } }

        let wH = Array.from(this.map.values()).filter(h => h.terrain.id !== 'CASTLE' && Hex.distance(h, pS) > 3 && !this.getUnitAt(h.q, h.r));
        let itP = ['COIN', 'COIN', 'COIN', 'GEM', 'GEM', 'POTION', 'POTION', 'BANDAGE', 'BANDAGE', 'MEAT', 'MEAT', 'RUSTY_SWORD', 'RUSTY_SWORD', 'WOODEN_SHIELD', 'WOODEN_SHIELD', 'SCROLL'];
        if (Math.random() > 0.5) itP.push('SWORD'); if (Math.random() > 0.6) itP.push('SHIELD'); if (Math.random() > 0.7) itP.push('BOOTS'); if (Math.random() > 0.8) itP.push('BOW'); if (Math.random() > 0.8) itP.push('APPLE'); if (Math.random() > 0.9) itP.push('MAGIC');
        let numI = Math.min(Math.floor((this.cols * this.rows) / 25) + Math.floor(Math.random() * 2), 6);
        if (Math.random() > 0.4 && wH.length > 2) { let idx1 = Math.floor(Math.random() * wH.length); this.items.set(wH.splice(idx1, 1)[0].getKey(), 'CHEST'); let idx2 = Math.floor(Math.random() * wH.length); this.items.set(wH.splice(idx2, 1)[0].getKey(), 'KEY'); }
        for (let i = 0; i < numI; i++) { if (wH.length > 0) { let idx = Math.floor(Math.random() * wH.length); this.items.set(wH.splice(idx, 1)[0].getKey(), itP[Math.floor(Math.random() * itP.length)]); } }

        let numW = 4 + act; const vC = wH.sort((a, b) => Math.abs(Hex.distance(a, pS) - Hex.distance(a, aS)) - Math.abs(Hex.distance(b, pS) - Hex.distance(b, aS)));
        if (vC.length > 0) { let bDef = BEASTS.BOSSES.find(b => act >= b.minLevel && act <= b.maxLevel) || BEASTS.BOSSES[BEASTS.BOSSES.length - 1]; this.units.push(new Unit({ q: vC[0].q, r: vC[0].r, faction: 0, name: bDef.name, baseName: bDef.name, emoji: bDef.e, hp: Math.floor(bDef.hp * sFac), maxHp: Math.floor(bDef.hp * sFac), mp: bDef.mp, maxMp: bDef.mp, atk: Math.floor(bDef.atk * sFac), range: bDef.range, abilities: [...bDef.abilities], filter: bDef.filter, tags: bDef.tags || [], fav: bDef.fav || [], isBoss: true, level: act })); wH = wH.filter(h => h !== vC[0]); }

        while (numW > 0 && wH.length > 0) {
            const hex = wH.splice(Math.floor(Math.random() * wH.length), 1)[0];

            // Pool padrão para terra
            let pool = BEASTS.LAND.filter(b => !b.minLevel || act >= b.minLevel);

            // Habilidade do ALMIRANTE: As criaturas abissais invadem as planícies e florestas!
            if (this.leaderData && this.leaderData.name === 'Almirante') {
                let waterPool = BEASTS.WATER.filter(b => !b.minLevel || act >= b.minLevel);
                // Empurra as feras da água DUAS VEZES no pool normal para forçar que apareçam com muita frequência
                pool.push(...waterPool, ...waterPool);
            }

            // Se for água ou neve, mantém o tipo estrito
            if (hex.terrain.id === 'WATER') pool = BEASTS.WATER.filter(b => !b.minLevel || act >= b.minLevel);
            if (hex.terrain.id === 'SNOW') pool = BEASTS.SNOW.filter(b => !b.minLevel || act >= b.minLevel);

            if (pool.length > 0) {
                const b = pool[Math.floor(Math.random() * pool.length)];
                let uLvl = this.getUnitLvl(b);
                let fFac = 1 + (uLvl - 1) * 0.2;
                this.units.push(new Unit({ q: hex.q, r: hex.r, faction: 0, name: b.name, baseName: b.name, emoji: b.e, hp: Math.floor(b.hp * fFac), maxHp: Math.floor(b.hp * fFac), mp: b.mp, maxMp: b.mp, atk: Math.floor(b.atk * fFac), range: b.range, abilities: [...b.abilities], filter: b.filter, tags: b.tags || [], fav: b.fav || [], level: uLvl }));
            }
            numW--;
        }

        if (this.eventFlags.forceSnow) { this.map.forEach(h => { h.terrain = TERRAINS.SNOW; }); }
        if (this.eventFlags.noVillages) { this.map.forEach(h => { if (h.terrain.id === 'VILLAGE') h.terrain = TERRAINS.PLAINS; }); }
        if (this.eventFlags.crystalHexes) { let keys = Array.from(this.map.keys()).sort(() => Math.random() - 0.5); for (let i = 0; i < 4; i++) if (keys[i]) this.map.get(keys[i]).isCrystal = true; }
        if (this.eventFlags.hauntedCurse) { this.units.filter(u => u.faction !== 1).forEach(u => { u.maxHp = Math.max(1, Math.floor(u.maxHp * 0.8)); u.hp = u.maxHp; }); }
        if (this.eventFlags.veteranBoss) { this.units = this.units.filter(u => u.faction === 1); let h = Array.from(this.map.values()).find(h => h.terrain.id === 'CASTLE' && h.owner !== 1) || Array.from(this.map.values()).pop(); this.units.push(new Unit({ q: h.q, r: h.r, faction: 2, name: "Mercenário Veterano", baseName: "Veterano", emoji: '🗡️', hp: 250, maxHp: 250, mp: 5, maxMp: 5, atk: 35, range: 1, abilities: ['counter', 'dodge', 'swift'], isBoss: true, isLeader: true, filter: 'saturate(0%)', level: act })); }
        if (this.eventFlags.serpentAmbush) { let pL = this.units.find(u => u.isLeader && u.faction === 1); let emptyHexes = Array.from(this.map.values()).filter(h => !this.getUnitAt(h.q, h.r)).sort((a, b) => { let da = Hex.distance(a, pL); let db = Hex.distance(b, pL); return Math.abs(da - 2) - Math.abs(db - 2); }); if (emptyHexes.length > 0) { let h = emptyHexes[0]; this.units.push(new Unit({ q: h.q, r: h.r, faction: 2, name: "Mãe Serpe", emoji: '🐍', hp: 150, maxHp: 150, mp: 4, maxMp: 4, atk: 22, range: 1, abilities: ['poison'], isBoss: true, filter: 'hue-rotate(90deg) saturate(200%)', level: act })); } }
        if (this.eventFlags.scatterUnits) { let pUnits = this.units.filter(u => u.faction === 1); let validHexes = Array.from(this.map.values()).filter(h => h.terrain.id !== 'WATER' && h.terrain.id !== 'MOUNTAIN' && !this.getUnitAt(h.q, h.r)).sort(() => Math.random() - 0.5); pUnits.forEach((u, i) => { if (validHexes[i]) { u.q = validHexes[i].q; u.r = validHexes[i].r; u.vq = u.q; u.vr = u.r; } }); }
        let pL2 = this.units.find(u => u.isLeader && u.faction === 1);
        if (pL2) { if (this.eventFlags.artillery) pL2.knownSpells.push('sl_artillery'); if (this.eventFlags.mines > 0) pL2.knownSpells.push('sl_mine'); if (this.eventFlags.barricades) pL2.knownSpells.push('sl_barricade'); if (this.eventFlags.epicConsumable) { pL2.maxHp += 25; pL2.hp += 25; } }

        this.eventFlags = {}; this.activeSynergies = this.getSynergies(1); this.currentTurn = 1; this.gameOver = false; this.selectPlayerLeader();
        let pL = this.units.find(u => u.isLeader && u.faction === 1);
        if (pL && pL.baseName === 'Gênia') {
            setTimeout(() => { if (typeof window.triggerGenieWishes === 'function') window.triggerGenieWishes(); }, 1200);
        }
    }

    checkVillageCapture(u) {
        if (u.faction === 0) return; let hex = this.map.get(`${u.q},${u.r}`);
        if (hex && hex.terrain.id === 'VILLAGE' && hex.owner !== u.faction) {
            hex.owner = u.faction; let col = u.faction === 1 ? '#4a9edd' : '#c0392b';
            if (typeof showPopup === 'function') showPopup("🚩", u, col);
            if (typeof addLog === 'function') addLog(`🚩 ${u.name} capturou a Vila!`, col);
            if (u.faction === 1) {
                u.mp = 0; let g = (typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_gold')) ? 4 : 2; this.gold += g;
                if (typeof addLog === 'function') addLog(`💰 +${g} Ouro`, 'var(--gold-light)');
                if (typeof updateUI === 'function') updateUI();
            }
        }
    }

    async moveUnit(u, tQ, tR) {
        const fr = 12; const sQ = u.q, sR = u.r;
        for (let i = 1; i <= fr; i++) { u.vq = sQ + (tQ - sQ) * (i / fr); u.vr = sR + (tR - sR) * (i / fr); if (renderer) renderer.centerOn(u.vq, u.vr); if (typeof sleep === 'function') await sleep(16); }

        u.q = tQ; u.r = tR; u.vq = tQ; u.vr = tR; this.checkVillageCapture(u); let k = `${tQ},${tR}`;

        // MECÂNICA T-REX: Esmaga o terreno e gera RECURSOS EM DOBRO
        if (u.baseName === 'T-Rex') {
            let h = this.map.get(k);
            if (h && (h.terrain.id === 'FOREST' || h.terrain.id === 'VILLAGE' || h.terrain.id === 'SNOW')) {
                if (!this.resources) this.resources = { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 };
                let resGot = "";

                if (h.terrain.id === 'FOREST') { this.resources.wood += 2; resGot = "+2 🌲"; }
                if (h.terrain.id === 'SNOW') { this.resources.sand += 2; resGot = "+2 ⏳"; }
                if (h.terrain.id === 'VILLAGE') { this.gold += 10; resGot = "+10 💰"; }

                h.terrain = TERRAINS.PLAINS;
                if (resGot && typeof showPopup === 'function') showPopup(`Esmagado! ${resGot}`, u, '#e74c3c');
            }
        }

        if (this.items.has(k)) {
            let iType = this.items.get(k); let iDef = typeof ITEMS !== 'undefined' ? ITEMS[iType] : null;
            if (iDef) {
                if (u.faction === 1) {
                    let accepted = typeof showZeldaPopup === 'function' ? await showZeldaPopup(iDef.icon, `Encontrou: ${iDef.name}`, iDef.desc, true) : true;
                    if (accepted) {
                        if (iDef.type === 'equip') {
                            let existingEq = u.equipment.find(eq => eq.id === iType);
                            if (existingEq) { if (iDef.onUnequip) iDef.onUnequip(u, existingEq.level); existingEq.level++; if (iDef.onEquip) iDef.onEquip(u, existingEq.level); if (typeof showPopup === 'function') showPopup(`✨ Fusão Lv${existingEq.level}!`, u, '#c9a227'); }
                            else { u.equipment.push({ id: iType, level: 1 }); if (iDef.onEquip) iDef.onEquip(u, 1); }
                            this.items.delete(k);
                        } else { let r = await iDef.f(u, this); if (r !== false) this.items.delete(k); }
                        const undoBtn = document.getElementById('btn-undo'); if (undoBtn) undoBtn.disabled = true; lastState = null;
                    }
                } else { if (iDef.type !== 'equip') { let r = await iDef.f(u, this); if (r !== false) this.items.delete(k); } }
            }
            if (typeof updateUI === 'function') updateUI(); if (renderer) renderer.draw();
        }
    }

    selectPlayerLeader() { const pL = this.units.find(u => u.faction === 1 && u.isLeader); if (pL) { this.selectedUnit = pL; this.calculateReachable(pL); } }
    getUnitAt(q, r) { return this.units.find(u => u.q === q && u.r === r); }
    calculateReachable(unit) {
        this.reachableHexes.clear(); const f = [{ q: unit.q, r: unit.r, cost: 0 }]; this.reachableHexes.set(`${unit.q},${unit.r}`, 0); let sys = this.getSynergies(unit.faction);

        while (f.length > 0) {
            f.sort((a, b) => a.cost - b.cost); const curr = f.shift();
            Hex.getNeighbors(curr.q, curr.r).forEach(n => {
                const k = `${n.q},${n.r}`; const hex = this.map.get(k); if (!hex) return; const occ = this.getUnitAt(n.q, n.r); if (occ && occ.faction !== unit.faction) return;
                let cost = unit.getMovementCost(hex.terrain, sys); const nC = curr.cost + cost;
                if (nC <= unit.mp && (!this.reachableHexes.has(k) || nC < this.reachableHexes.get(k))) { this.reachableHexes.set(k, nC); f.push({ q: n.q, r: n.r, cost: nC }); }
            });
        }
    }

    calcDmg(a, d) {
        const hex = this.map.get(`${d.q},${d.r}`); if (!hex) return 1;
        let sysA = this.getSynergies(a.faction); let sysD = this.getSynergies(d.faction);
        let def = a.abilities.includes('pierce') ? 0 : hex.terrain.def;

        if (d.fav.includes(hex.terrain.id)) def += 0.2;
        if (d.name === 'Almirante' && hex.terrain.id !== 'WATER') def -= 0.30;
        if (d.tags.includes('ABYSSAL') && hex.terrain.id === 'WATER') def += 0.30;

        if (d.tags.includes('WING') && sysD['WING'] >= 2 && def < 0) def = 0;
        if (d.tags.includes('ROCK') && sysD['ROCK'] >= 3) def = Math.min(0.60, def + 0.30);
        if (d.faction === 1 && typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_armor')) def += 0.15;
        if (d.status === 'shielded') def = Math.min(0.80, def + 0.30);

        let isFlanking = false;
        if (a.tags.includes('STALKER') && sysA['STALKER'] >= 3) { Hex.getNeighbors(d.q, d.r).forEach(n => { let ally = this.getUnitAt(n.q, n.r); if (ally && ally.faction === a.faction && ally !== a && ally.tags.includes('STALKER')) isFlanking = true; }); }
        if (isFlanking) def = 0;

        let lAtk = 0; if (a) Hex.getNeighbors(a.q, a.r).forEach(n => { let al = this.getUnitAt(n.q, n.r); if (al && al.faction === a.faction && al.abilities.includes('leadership') && al !== a) lAtk += 2; });
        if (d) Hex.getNeighbors(d.q, d.r).forEach(n => { let al = this.getUnitAt(n.q, n.r); if (al && al.faction === d.faction && al.abilities.includes('leadership') && al !== d) def += 0.2; });

        let baseAtk = a.getEffectiveAtk(this);
        if (isFlanking) baseAtk *= 2;

        // Passivas Ofensivas de Líderes
        if (a.baseName === 'Centauro Espectral') {
            baseAtk = a.maxMp * 4;
        }
        if (a.baseName === 'Rei Bárbaro') {
            let hpRatio = a.hp / a.maxHp;
            if (hpRatio <= 0.30) baseAtk = Math.floor(baseAtk * 2.5);
            else if (hpRatio <= 0.60) baseAtk = Math.floor(baseAtk * 1.5);
        }

        // --- CÁLCULO EXATO, SEM DANO ALEATÓRIO (RNG) ---
        let base = Math.max(1, Math.floor((baseAtk + lAtk) * Math.max(0, 1 - def)));

        if (d.faction === 1 && typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_shield')) base = Math.floor(base * 0.9);
        let hexA = this.map.get(`${a.q},${a.r}`); if ((hexA && hexA.isCrystal) || (hex && hex.isCrystal)) base = Math.floor(base * 2);
        if (d.abilities.includes('crystal_skin')) base = Math.floor(base * 0.6);
        return base;
    }

    async executeCombat(a, d) {
        lastState = null; const undoBtn = document.getElementById('btn-undo'); if (undoBtn) undoBtn.disabled = true;
        this.isAnimating = true; const aCol = a.faction === 1 ? '#4a9edd' : a.faction === 2 ? '#c0392b' : '#27ae60';

        try {
            let sysA = this.getSynergies(a.faction); let sysD = this.getSynergies(d.faction);

            if (d.faction === 1 && !d.isLeader) { let paladin = this.units.find(u => u.name === 'Paladina' && u.isLeader && u.faction === d.faction && Hex.distance(u, d) === 1 && u.hp > 0); if (paladin && paladin !== d && Math.random() < 0.20) { if (typeof showPopup === 'function') showPopup("🛡️ Proteção!", paladin, '#fffbc2'); if (typeof addLog === 'function') addLog(`🛡️ ${paladin.name} interceptou o ataque!`, '#fffbc2'); d = paladin; d._paladinDefending = true; } }

            if (d.faction === 0) d.alerted = true;
            let dodgeC = d.abilities.includes('dodge') ? 0.3 : 0; if (d.tags.includes('ABYSSAL') && sysD['ABYSSAL'] >= 3) dodgeC += 0.2; if (d.faction === 1 && typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_wind')) dodgeC += 0.2;
            if (Math.random() < dodgeC) { if (typeof showPopup === 'function') showPopup("💨 Esquivou!", d, '#aaa'); if (typeof addLog === 'function') addLog(`💨 ${d.name} esquivou!`, '#aaa'); a.hasAttacked = true; if (!a.abilities.includes('hit_run') && !(a.tags.includes('SAND') && sysA['SAND'] >= 3)) a.mp = 0; await this.processRevide(a, d); if (typeof sleep === 'function') await sleep(600); return; }

            const dmg = this.calcDmg(a, d); d.hp -= dmg; a.hasAttacked = true; if (!a.abilities.includes('hit_run') && !(a.tags.includes('SAND') && sysA['SAND'] >= 3)) a.mp = 0; if (a.faction === 1) a.addXp(15);
            if (d.hp <= 0 && d.baseName === 'Rei Bárbaro' && (d.undyingTurns === undefined || d.undyingTurns === 0) && !d._hasUsedUndying) {
                d.hp = 1;
                d.undyingTurns = 2;
                d._hasUsedUndying = true;
                if (typeof showPopup === 'function') showPopup("FÚRIA IMORTAL!", d, '#e74c3c');
            }
            if (renderer) { renderer.centerOn(d.vq, d.vr); d.hitTimer = true; renderer.draw(); if (typeof sleep === 'function') await sleep(150); d.hitTimer = false; renderer.draw(); }
            if (typeof showPopup === 'function') showPopup(`-${dmg}`, d, '#fff'); if (typeof addLog === 'function') addLog(`⚔ ${a.name} atingiu ${d.name} (-${dmg})`, aCol);

            if (a.tags.includes('FIRE') && sysA['FIRE'] >= 3) { let aoe = Math.max(1, Math.floor(dmg * 0.2)); Hex.getNeighbors(d.q, d.r).forEach(n => { let targ = this.getUnitAt(n.q, n.r); if (targ && targ.faction !== a.faction && targ !== d && targ.hp > 0) { targ.hp -= aoe; if (typeof showPopup === 'function') showPopup(`🔥 -${aoe}`, targ, '#e67e22'); if (targ.hp <= 0) this.handleDeath(targ, a); } }); }

            if (a.abilities.includes('corte_amplo') && Hex.distance(a, d) === 1) { let aNeighbors = Hex.getNeighbors(a.q, a.r); aNeighbors.forEach(n => { let u = this.getUnitAt(n.q, n.r); if (u && u.faction !== a.faction && u !== d && u.hp > 0 && Hex.distance(u, d) === 1) { let cDmg = Math.floor(this.calcDmg(a, u) * 0.5); u.hp -= cDmg; if (typeof showPopup === 'function') showPopup(`-${cDmg} ⚔️`, u, '#fff'); if (u.hp <= 0) this.handleDeath(u, a); } }); }

            let lsPerc = a.abilities.includes('lifesteal') ? 0.8 : (a.isLeader && a.name === 'Necromante' ? 0.25 : 0); if (a.tags.includes('UMBRAL') && sysA['UMBRAL'] >= 3) lsPerc += 0.25; if (a.faction === 1 && typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_blood')) lsPerc += 0.15;
            if (lsPerc > 0) { const heal = Math.floor(dmg * lsPerc); a.hp = Math.min(a.maxHp, a.hp + heal); if (typeof showPopup === 'function') showPopup(`+${heal}`, a, '#2ecc71'); }

            if (a.abilities.includes('freeze') && Math.random() < 0.25) { d.status = 'stun'; d.hp -= 5; if (typeof showPopup === 'function') showPopup("Congelado!", d, '#00ffff'); }
            if (a.tags.includes('ICE') && sysA['ICE'] >= 3) { d.status = 'chilled'; if (typeof showPopup === 'function') showPopup("Congelado!", d, '#00ffff'); }
            if (a.abilities.includes('electric')) { let cT = Hex.getNeighbors(d.q, d.r).map(n => this.getUnitAt(n.q, n.r)).filter(u => u && u.faction !== a.faction && u !== d && u.hp > 0); for (let t of cT) { let cDmg = Math.max(1, Math.floor(dmg * 0.5)); t.hp -= cDmg; if (typeof showPopup === 'function') showPopup(`⚡ -${cDmg}`, t, '#00ffff'); if (t.hp <= 0) this.handleDeath(t, a); } }
            if (a.name.includes("Bode") && Hex.distance(a, d) > 1 && d.hp > 0) { let bH = null; let mD = Hex.distance(a, d); Hex.getNeighbors(a.q, a.r).forEach(n => { if (!this.getUnitAt(n.q, n.r) && this.map.has(`${n.q},${n.r}`)) { let dist = Hex.distance({ q: n.q, r: n.r }, d); if (dist < mD) { mD = dist; bH = n; } } }); if (bH) { await this.moveUnit(a, bH.q, bH.r); } }

            if (d.hp > 0) {
                let pChance = a.abilities.includes('poison') ? 0.3 : 0; if (sysA['VENOM'] >= 2 && a.tags.includes('VENOM')) pChance = 1.0; if (Math.random() < pChance) { d.status = 'poison'; if (typeof showPopup === 'function') showPopup("Envenenado!", d, '#2ecc71'); }
                let stChance = a.abilities.includes('stun') ? 0.25 : 0; if (a.tags.includes('SILVESTRE') && sysA['SILVESTRE'] >= 3) stChance += 0.15; if (Math.random() < stChance) { d.status = 'stun'; if (typeof showPopup === 'function') showPopup("Enraizado!", d, '#f39c12'); }
                if (a.abilities.includes('bind')) { d.status = 'bind'; if (typeof showPopup === 'function') showPopup("Preso!", d, '#9b59b6'); }
                if (a.abilities.includes('burn')) { d.hp -= 10; if (typeof showPopup === 'function') showPopup("-10 🔥", d, '#e67e22'); if (d.hp <= 0) this.handleDeath(d, a); }
            }

            if (a.abilities.includes('swift')) { if (typeof showPopup === 'function') showPopup("Rápido!", a, '#f1c40f'); if (d.hp <= 0) { if (a.faction === 1) a.addXp(d.isBoss ? 100 : 30); this.handleDeath(d, a); this.checkWin(); } } else if (d.hp > 0) { await this.processRevide(a, d); } else { if (a.faction === 1) a.addXp(d.isBoss ? 100 : 30); this.handleDeath(d, a); this.checkWin(); }

            if (a.hp > 0 && a.tags.includes('MYSTIC') && sysA['MYSTIC'] >= 2 && Math.random() < 0.30) { a.hasAttacked = false; a.mp = a.maxMp; if (typeof showPopup === 'function') showPopup("✨ Ação Extra!", a, '#9b59b6'); if (a.faction === 1) this.selectedUnit = a; }

            if (typeof sleep === 'function') await sleep(600);
        } catch (e) { console.error("ERRO NO COMBATE:", e); } finally { this.isAnimating = false; }
    }

    handleDeath(victim, killer = null) {
        if (killer && killer.baseName === 'Anubis') {
            killer.atk += 1;
            if (typeof showPopup === 'function') showPopup("+1 ATK Perm.", killer, '#8e44ad');
        }
        if (killer && killer._isExecuting) {
            killer.hasAttacked = false; killer.mp = killer.maxMp;
            if (typeof showPopup === 'function') showPopup("Turno Extra!", killer, '#c0392b');
        }

        if (typeof showPopup === 'function') showPopup("☠ Eliminado!", victim, '#e74c3c');
        if (victim.faction === 1 && !victim.isLeader) { this.lastDeadAlly = new Unit({ ...victim }); }

        if (killer && killer.faction === 1 && victim.faction !== 1) { killer.addXp(victim.isBoss ? 100 : 30); let arts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : []; if (arts.includes('art_wild_call')) { killer.addXp(10); } }

        if (killer && killer.name === 'Lord Vampiro' && killer.isLeader && victim.faction === 0) {
            let chance = (victim.baseName === 'Morcego' || victim.name === 'Morcego') ? 1.0 : 0.3;
            if (Math.random() <= chance) {
                victim.hp = victim.maxHp; victim.faction = killer.faction;
                if (!victim.tags.includes('STALKER')) victim.tags.push('STALKER');
                victim.alerted = false; let maxL = (typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_crown')) ? (this.leaderData.limit + 1) : (this.leaderData.limit || 6);
                let currTeam = this.units.filter(u => u.faction === killer.faction && !u.isLeader).length;
                if (killer.faction === 1 && currTeam >= maxL) {
                    this.units = this.units.filter(u => u !== victim); rosterMemory.push(victim);
                    if (typeof addLog === 'function') addLog(`🧛 ${killer.name} seduziu ${victim.name} (Box)!`, '#8e44ad');
                } else {
                    if (typeof addLog === 'function') addLog(`🧛 ${killer.name} seduziu ${victim.name}!`, '#8e44ad');
                    if (typeof showPopup === 'function') showPopup("🧛 Domado!", victim, '#8e44ad');
                }
                if (victim.faction === 1) {
                    if (typeof unlockInBestiary === 'function') unlockInBestiary(victim.name);
                    const leader = this.units.find(u => u.isLeader && u.faction === 1);
                    if (leader) { (victim.tags || []).forEach(t => { if (!leader.grimTags.includes(t)) { leader.grimTags.push(t); } }); }
                }
                this.activeSynergies = this.getSynergies(killer.faction); return;
            }
        }

        if (killer && killer.name === 'Necromante' && killer.isLeader && victim.faction !== killer.faction && !victim.isLeader) {
            victim.hp = Math.floor(victim.maxHp * 0.5); victim.faction = killer.faction; if (!victim.tags.includes('UMBRAL')) victim.tags.push('UMBRAL'); victim.alerted = false; let maxL = (typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_crown')) ? (this.leaderData.limit + 1) : (this.leaderData.limit || 6); let currTeam = this.units.filter(u => u.faction === killer.faction && !u.isLeader).length;
            if (killer.faction === 1 && currTeam >= maxL) { this.units = this.units.filter(u => u !== victim); rosterMemory.push(victim); if (typeof addLog === 'function') addLog(`💀 ${killer.name} ergueu ${victim.name} (Box)!`, '#8e44ad'); } else { if (typeof addLog === 'function') addLog(`💀 ${killer.name} ergueu ${victim.name}!`, '#8e44ad'); if (typeof showPopup === 'function') showPopup("💀 Sombrio!", victim, '#8e44ad'); }
            if (victim.faction === 1) { if (typeof unlockInBestiary === 'function') unlockInBestiary(victim.name); const leader = this.units.find(u => u.isLeader && u.faction === 1); if (leader) { (victim.tags || []).forEach(t => { if (!leader.grimTags.includes(t)) { leader.grimTags.push(t); } }); } }
            this.activeSynergies = this.getSynergies(killer.faction); return;
        }

        if (killer) { const kCol = killer.faction === 1 ? '#4a9edd' : '#c0392b'; if (typeof addLog === 'function') addLog(`☠ ${killer.name} eliminou ${victim.name}!`, kCol); if (victim.isLeader && victim.faction === 2 && killer.faction === 1) { this.gold += 10; if (typeof addLog === 'function') addLog(`💰 +10 Ouro da Vitória!`, 'var(--gold-light)'); if (typeof updateUI === 'function') updateUI(); } } else { if (typeof addLog === 'function') addLog(`☠ ${victim.name} foi eliminado.`, '#e74c3c'); }
        if (victim.faction !== 1 && killer && killer.faction === 1) { if (victim.name === "Mercenário Veterano") this.pendingDrop = 'legendary'; else if (victim.isBoss && this.currentRouteType === 'ELITE') this.pendingDrop = 'rare'; }

        this.units = this.units.filter(u => u !== victim); if (this.selectedUnit === victim) this.selectedUnit = null; if (victim.faction === 1) this.activeSynergies = this.getSynergies(1);
    }

    async processRevide(a, d) {
        if (d.status === 'stun' || d.status === 'bind' || d.status === 'chilled') return;

        if (Hex.distance(a, d) <= d.getEffectiveRange(game)) {
            if (typeof sleep === 'function') await sleep(450); if (!this.units.includes(a) || !this.units.includes(d)) return;
            const dCol = d.faction === 1 ? '#4a9edd' : d.faction === 2 ? '#c0392b' : '#27ae60'; if (a.faction === 0) a.alerted = true;
            let sysA = this.getSynergies(a.faction); let sysD = this.getSynergies(d.faction);
            let dodgeC = a.abilities.includes('dodge') ? 0.3 : 0; if (a.tags.includes('ABYSSAL') && sysA['ABYSSAL'] >= 3) dodgeC += 0.2; if (a.faction === 1 && typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_wind')) dodgeC += 0.2;
            if (Math.random() < dodgeC) { if (typeof showPopup === 'function') showPopup("💨 Esquivou!", a, '#aaa'); return; }

            let rDmg = Math.floor(this.calcDmg(d, a) * 0.6); if (d.abilities.includes('counter')) rDmg = Math.floor(rDmg * 1.2); if (d._paladinDefending) { rDmg = Math.floor(this.calcDmg(d, a) * 0.5); delete d._paladinDefending; }
            if (d.faction === 1) d.addXp(8); a.hp -= rDmg;

            if (renderer) { renderer.centerOn(a.vq, a.vr); a.hitTimer = true; renderer.draw(); if (typeof sleep === 'function') await sleep(150); a.hitTimer = false; renderer.draw(); }
            if (typeof showPopup === 'function') showPopup(`↩ -${rDmg}`, a, '#f39c12'); if (typeof addLog === 'function') addLog(`↩ ${d.name} revidou (-${rDmg})`, dCol);
            if (d.tags.includes('CARAPACE') && sysD['CARAPACE'] >= 2) { let refl = Math.max(1, Math.floor(rDmg * 0.1)); a.hp -= refl; if (typeof showPopup === 'function') showPopup(`🛡️ -${refl}`, a, '#aaa'); }
            let lsPerc = d.abilities.includes('lifesteal') ? 0.8 : (d.isLeader && d.name === 'Necromante' ? 0.25 : 0); if (d.tags.includes('UMBRAL') && sysD['UMBRAL'] >= 3) lsPerc += 0.25; if (d.faction === 1 && typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_blood')) lsPerc += 0.15;
            if (lsPerc > 0) { const heal = Math.floor(rDmg * lsPerc); d.hp = Math.min(d.maxHp, d.hp + heal); if (typeof showPopup === 'function') showPopup(`+${heal}`, d, '#2ecc71'); }

            if (d.abilities.includes('freeze') && Math.random() < 0.25) { a.status = 'stun'; a.hp -= 5; if (typeof showPopup === 'function') showPopup("Congelado!", a, '#00ffff'); }
            if (d.tags.includes('ICE') && sysD['ICE'] >= 3) { a.status = 'chilled'; if (typeof showPopup === 'function') showPopup("Congelado!", a, '#00ffff'); }
            if (d.abilities.includes('burn')) { a.hp -= 10; if (typeof showPopup === 'function') showPopup("-10 🔥", a, '#e67e22'); }

            if (a.hp > 0) {
                let pChance = d.abilities.includes('poison') ? 0.2 : 0; if (sysD['VENOM'] >= 2 && d.tags.includes('VENOM')) pChance = 1.0; if (Math.random() < pChance) { a.status = 'poison'; if (typeof showPopup === 'function') showPopup("Envenenado!", a, '#2ecc71'); }
                if (d.abilities.includes('stun') && Math.random() < 0.2) { a.status = 'stun'; if (typeof showPopup === 'function') showPopup("Atordoado!", a, '#f39c12'); }
                if (d.abilities.includes('bind')) { a.status = 'bind'; if (typeof showPopup === 'function') showPopup("Preso!", a, '#9b59b6'); }
            } else { if (d.faction === 1) d.addXp(a.isBoss ? 100 : 30); this.handleDeath(a, d); }

            if (a.abilities.includes('crystal_skin')) a.status = null; if (d.abilities.includes('crystal_skin')) d.status = null;
            if (renderer) renderer.draw(); this.checkWin();
        }
    }

    async attemptTame(tamer, wild) {
        lastState = null; const undoBtn = document.getElementById('btn-undo'); if (undoBtn) undoBtn.disabled = true; this.isAnimating = true; let arts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : [];
        try {
            tamer.hasAttacked = true; tamer.mp = 0;
            let cC = 1.1 - (wild.hp / wild.maxHp);
            if (wild.isBoss) cC -= 0.35;
            if (tamer.faction === 1 && arts.includes('art_tame')) cC += 0.20;

            // Bônus Específicos de Líder para Domar
            if (tamer.baseName === 'Almirante' && wild.tags.includes('ABYSSAL')) cC += 0.40;
            if (tamer.baseName === 'Arqueira' && wild.tags.includes('SILVESTRE')) cC += 0.40;

            // BUFF DO PARQUE ---
            // Se o alvo for Nível 1, tiver HP cheio e você tiver o Parque, ganha +40% de chance!
            if (tamer.faction === 1 && wild.level === 1 && wild.hp === wild.maxHp && typeof countKingdomBuildings === 'function') {
                if (window.countKingdomBuildings('PARK') > 0) cC += 0.40;
            }

            if (tamer.faction === 1 && typeof countKingdomBuildings === 'function') {
                cC += (window.countKingdomBuildings('BESTIARY') * 0.15);
            }

            if (cC < 0.05) cC = 0.05;
            const tCol = tamer.faction === 1 ? '#4a9edd' : '#c0392b';

            /// 1. SISTEMA DE QUEBRA DE VONTADE
            let willBreakMod = 1.0;
            if (['stun', 'bind', 'sleep', 'paralyzed', 'chilled'].includes(wild.status)) {
                willBreakMod = 1.5; // +50% de chance de doma
                if (typeof showPopup === 'function') showPopup("Vontade Quebrada!", wild, '#9b59b6');
            }

            // 2. SISTEMA DE ISCA DE CARNE
            let lureMod = 1.0;
            let hexLure = this.map.get(`${wild.q},${wild.r}`);
            if (hexLure && hexLure.hasLure) {
                lureMod = 2.0; // Dobra a chance
                hexLure.hasLure = false; // A fera come a isca
                if (typeof showPopup === 'function') showPopup("Isca Devorada!", wild, '#e67e22');
            }

            // Multiplique a sua chance atual (cC) por esses modificadores:
            cC = cC * willBreakMod * lureMod;

            // Rola o dado para ver se domou
            if (Math.random() < cC) {

                this.dna = (this.dna || 0) + 1; // Drop de DNA
                if (typeof showPopup === 'function') showPopup("+1 🧬", tamer, '#1abc9c');

                // 3. CAPTURA CRÍTICA (BUFF AO DOMAR)
                let healAmount = 25;
                tamer.hp = Math.min(tamer.maxHp, tamer.hp + healAmount);
                if (typeof showPopup === 'function') showPopup(`Captura Perfeita! +${healAmount} HP`, tamer, '#2ecc71');

                // Passiva do Piromante (Adiciona Ígneo)
                if (tamer.baseName === 'Piromante' && !wild.tags.includes('FIRE')) {
                    wild.tags.push('FIRE');
                }
                wild.faction = tamer.faction;
                wild.alerted = false;

                // --- NOVO 2.0: LIMITE DA BOX PUXANDO DAS VILAS ---
                let maxL = typeof window.getMaxBoxLimit === 'function' ? window.getMaxBoxLimit() : 6;
                // -------------------------------------------------

                let currTeam = this.units.filter(u => u.faction === 1 && !u.isLeader).length;
                if (currTeam >= maxL && tamer.faction === 1) {
                    this.units = this.units.filter(u => u !== wild);
                    rosterMemory.push(wild);
                    if (typeof showPopup === 'function') showPopup("📦 Para a Box!", wild, '#c9a227');
                    if (typeof addLog === 'function') addLog(`🪄 ${tamer.name} domou ${wild.name} (Box)!`, tCol);
                } else {
                    if (typeof showPopup === 'function') showPopup("🪄 Domado!", wild, tamer.faction === 1 ? '#c9a227' : '#c0392b');
                    if (typeof addLog === 'function') addLog(`🪄 ${tamer.name} domou ${wild.name}!`, tCol);
                }

                if (tamer.faction === 1) {
                    if (typeof unlockInBestiary === 'function') unlockInBestiary(wild.name);
                    if (arts.includes('art_hp')) { wild.maxHp += 15; wild.hp += 15; }
                    if (arts.includes('art_atk')) { wild.atk += 4; }
                    const leader = this.units.find(u => u.isLeader && u.faction === 1);
                    if (leader) {
                        (wild.tags || []).forEach(t => {
                            if (!leader.grimTags.includes(t)) {
                                leader.grimTags.push(t);
                                if (typeof addLog === 'function') addLog(`📖 Grimório expandido: ${TAGS[t] ? TAGS[t].name : t}!`, '#c9a227');
                            }
                        });
                    }
                }
                this.activeSynergies = this.getSynergies(1);
                if (typeof sleep === 'function') await sleep(600);
                return true;

            } else {
                if (typeof showPopup === 'function') showPopup("Falhou!", wild, '#e74c3c');
                if (typeof addLog === 'function') addLog(`✗ ${tamer.name} falhou ao domar.`, '#777');
                wild.alerted = true;
                if (typeof sleep === 'function') await sleep(600);
                return false;
            }
        } finally { this.isAnimating = false; }
    }

    handleDeath(victim, killer = null) {
        if (killer && killer.baseName === 'Anubis') {
            killer.atk += 1;
            if (typeof showPopup === 'function') showPopup("+1 ATK Perm.", killer, '#8e44ad');
        }
        if (killer && killer._isExecuting) { // Reset do Carrasco
            killer.hasAttacked = false; killer.mp = killer.maxMp;
            if (typeof showPopup === 'function') showPopup("Turno Extra!", killer, '#c0392b');
        }
        if (typeof showPopup === 'function') showPopup("☠ Eliminado!", victim, '#e74c3c');
        if (victim.faction === 1 && !victim.isLeader) { this.lastDeadAlly = new Unit({ ...victim }); }

        if (killer && killer.faction === 1 && victim.faction !== 1) { killer.addXp(victim.isBoss ? 100 : 30); let arts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : []; if (arts.includes('art_wild_call')) { killer.addXp(10); } }


        // Lógica do Necromante (Doma Feras da Natureza ao abater)
        if (killer && killer.name === 'Necromante' && killer.isLeader && victim.faction !== killer.faction && !victim.isLeader) {
            victim.hp = Math.floor(victim.maxHp * 0.5); victim.faction = killer.faction; if (!victim.tags.includes('UMBRAL')) victim.tags.push('UMBRAL'); victim.alerted = false; let maxL = (typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_crown')) ? (this.leaderData.limit + 1) : (this.leaderData.limit || 6); let currTeam = this.units.filter(u => u.faction === killer.faction && !u.isLeader).length;
            if (killer.faction === 1 && currTeam >= maxL) { this.units = this.units.filter(u => u !== victim); rosterMemory.push(victim); if (typeof addLog === 'function') addLog(`💀 ${killer.name} ergueu ${victim.name} (Box)!`, '#8e44ad'); } else { if (typeof addLog === 'function') addLog(`💀 ${killer.name} ergueu ${victim.name}!`, '#8e44ad'); if (typeof showPopup === 'function') showPopup("💀 Sombrio!", victim, '#8e44ad'); }
            if (victim.faction === 1) { if (typeof unlockInBestiary === 'function') unlockInBestiary(victim.name); const leader = this.units.find(u => u.isLeader && u.faction === 1); if (leader) { (victim.tags || []).forEach(t => { if (!leader.grimTags.includes(t)) { leader.grimTags.push(t); } }); } }
            this.activeSynergies = this.getSynergies(killer.faction); return;
        }

        // Lógica do Vampiro (Doma Feras da Natureza ao abater)
        if (killer && killer.name === 'Lord Vampiro' && killer.isLeader && victim.faction === 0) {
            let chance = (victim.baseName === 'Morcego' || victim.name === 'Morcego') ? 1.0 : 0.3;
            if (Math.random() <= chance) {
                victim.hp = victim.maxHp;
                victim.faction = killer.faction;
                if (!victim.tags.includes('STALKER')) victim.tags.push('STALKER');
                victim.alerted = false;

                let maxL = (typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_crown')) ? (this.leaderData.limit + 1) : (this.leaderData.limit || 6);
                let currTeam = this.units.filter(u => u.faction === killer.faction && !u.isLeader).length;

                if (killer.faction === 1 && currTeam >= maxL) {
                    this.units = this.units.filter(u => u !== victim); rosterMemory.push(victim);
                    if (typeof addLog === 'function') addLog(`🧛 ${killer.name} seduziu ${victim.name} (Box)!`, '#8e44ad');
                } else {
                    if (typeof addLog === 'function') addLog(`🧛 ${killer.name} seduziu ${victim.name}!`, '#8e44ad');
                    if (typeof showPopup === 'function') showPopup("🧛 Domado!", victim, '#8e44ad');
                }

                if (victim.faction === 1) {
                    if (typeof unlockInBestiary === 'function') unlockInBestiary(victim.name);
                    const leader = this.units.find(u => u.isLeader && u.faction === 1);
                    if (leader) { (victim.tags || []).forEach(t => { if (!leader.grimTags.includes(t)) { leader.grimTags.push(t); } }); }
                }
                this.activeSynergies = this.getSynergies(killer.faction); return;
            }
        }

        if (killer) { const kCol = killer.faction === 1 ? '#4a9edd' : '#c0392b'; if (typeof addLog === 'function') addLog(`☠ ${killer.name} eliminou ${victim.name}!`, kCol); if (victim.isLeader && victim.faction === 2 && killer.faction === 1) { this.gold += 10; if (typeof addLog === 'function') addLog(`💰 +10 Ouro da Vitória!`, 'var(--gold-light)'); if (typeof updateUI === 'function') updateUI(); } } else { if (typeof addLog === 'function') addLog(`☠ ${victim.name} foi eliminado.`, '#e74c3c'); }
        if (victim.faction !== 1 && killer && killer.faction === 1) { if (victim.name === "Mercenário Veterano") this.pendingDrop = 'legendary'; else if (victim.isBoss && this.currentRouteType === 'ELITE') this.pendingDrop = 'rare'; }

        this.units = this.units.filter(u => u !== victim); if (this.selectedUnit === victim) this.selectedUnit = null; if (victim.faction === 1) this.activeSynergies = this.getSynergies(1);
    }

    async startNextTurn() {
        if (this.gameOver) return; this.selectedUnit = null; this.reachableHexes.clear(); this.tameMode = false; this.activeSpell = null; if (typeof updateUI === 'function') updateUI(); if (renderer) renderer.draw();
        lastState = null; const undoBtn = document.getElementById('btn-undo'); if (undoBtn) undoBtn.disabled = true;

        if (this.currentTurn === 1) {
            // Aura da Paladina (Cura 5 HP em área)
            let paladin = this.units.find(u => u.baseName === 'Paladina' && u.faction === 1);
            if (paladin) {
                this.units.forEach(u => {
                    if (u.faction === 1 && u.hp > 0 && Hex.distance(paladin, u) <= 2) {
                        let curar = Math.min(u.maxHp - u.hp, 5);
                        if (curar > 0) {
                            u.hp += curar;
                            if (typeof showPopup === 'function') showPopup(`+${curar} 🛡️`, u, '#fffbc2');
                        }
                    }
                });
            }
            if (!this.resources) this.resources = { wood: 0, stone: 0, scales: 0, sand: 0, blood: 0 };
            this.units.filter(u => u.faction === 1).forEach(u => {
                const hex = this.map.get(`${u.q},${u.r}`);
                if (hex) {
                    let resGained = null, icon = '', color = '';

                    if (hex.terrain.id === 'FOREST') { this.resources.wood++; resGained = '+1 Madeira'; icon = '🌲'; color = '#27ae60'; }
                    else if (hex.terrain.id === 'MOUNTAIN') { this.resources.stone++; resGained = '+1 Pedra'; icon = '⛰️'; color = '#95a5a6'; }
                    else if (hex.terrain.id === 'WATER') { this.resources.scales++; resGained = '+1 Escama'; icon = '🐟'; color = '#3498db'; }
                    else if (hex.terrain.id === 'DESERT') { this.resources.sand++; resGained = '+1 Areia'; icon = '⏳'; color = '#f1c40f'; }

                    // Passiva da Torre de Cristal no Turno 1
                    if (this.turnCount === 0 && typeof countKingdomBuildings === 'function') {
                        let towerLvl = window.countKingdomBuildings('CRYSTAL_TOWER');
                        if (towerLvl > 0) {
                            let pL = this.units.find(u => u.isLeader && u.faction === 1);
                            if (pL && pL.tags && pL.tags.length > 0) {
                                let primaryTag = pL.tags[0]; // Pega o primeiro elemento do líder
                                this.manaPool[primaryTag] = (this.manaPool[primaryTag] || 0) + towerLvl;
                                if (typeof showPopup === 'function') showPopup(`+${towerLvl} Mana 🔮`, pL, '#9b59b6');
                            }
                        }
                    }
                    if (resGained && typeof showPopup === 'function') {
                        showPopup(`${icon} ${resGained}`, u, color);
                    }
                }
            });
            this.units.filter(u => u.faction === 1).forEach(u => { if (u.status === 'shielded') u.status = null; });
            this.units.forEach(u => { if (u._mcDuration !== undefined) { u._mcDuration--; if (u._mcDuration <= 0) { u.faction = u._origFaction; delete u._origFaction; delete u._mcDuration; if (typeof showPopup === 'function') showPopup("Controle Perdido!", u, '#9b59b6'); } } });
            this.currentTurn = 2; const tb = document.getElementById('turn-blocker'); if (tb) tb.style.display = 'block'; this.updateTurnUI("Turno: Inimigo", 'var(--enemy-color)'); this.processStatus(2);
            if (!this.gameOver) { try { if (typeof sleep === 'function') await sleep(800); if (typeof window.runAITurn === 'function') await window.runAITurn(); if (!this.gameOver) this.startNextTurn(); } catch (e) { console.error("ERRO NO TURNO INIMIGO:", e); if (typeof sleep === 'function') await sleep(1000); this.startNextTurn(); } }
        } else if (this.currentTurn === 2) {
            this.currentTurn = 0; this.updateTurnUI("Turno: Feras", 'var(--wild-color)'); this.processStatus(0);
            if (!this.gameOver) { try { if (typeof sleep === 'function') await sleep(600); if (typeof window.runWildTurn === 'function') await window.runWildTurn(); if (!this.gameOver) this.startNextTurn(); } catch (e) { console.error("ERRO NO TURNO FERAS:", e); if (typeof sleep === 'function') await sleep(1000); this.startNextTurn(); } }
        } else {
            this.currentTurn = 1; this.turnCount++; const tb = document.getElementById('turn-blocker'); if (tb) tb.style.display = 'none'; this.updateTurnUI("Turno: Jogador", 'var(--player-color)'); this.processStatus(1);
            if (typeof resetSpentMana === 'function') resetSpentMana(); if (typeof collectMana === 'function') collectMana();
            for (let sid in this.spellCooldowns) { if (this.spellCooldowns[sid] > 0) this.spellCooldowns[sid]--; }
            this.selectPlayerLeader(); if (this.selectedUnit && renderer) renderer.centerOn(this.selectedUnit.vq, this.selectedUnit.vr);
        }
        if (typeof updateUI === 'function') updateUI(); if (renderer) renderer.draw();
        if (renderer) renderer.draw();
    }

    processStatus(fId) {
        let sys = this.getSynergies(fId);
        if (sys['CELESTIAL'] >= 3) { this.units.filter(u => u.faction === fId && u.tags.includes('CELESTIAL')).forEach(cel => { Hex.getNeighbors(cel.q, cel.r).forEach(n => { let ally = this.getUnitAt(n.q, n.r); if (ally && ally.faction === fId) { let h = Math.min(ally.maxHp - ally.hp, 10); if (h > 0) { ally.hp += h; if (typeof showPopup === 'function') showPopup(`+${h}✨`, ally, '#fffbc2'); } ally.status = null; } }); }); }
        this.units.filter(u => u.faction === fId).forEach(u => {
            if (u.baseName === 'Troll' && !u.hasAttacked) {
                const hex = this.map.get(`${u.q},${u.r}`);
                if (hex && (hex.terrain.id === 'MOUNTAIN' || hex.terrain.id === 'FOREST')) {
                    let heal = Math.floor(u.maxHp * 0.15);
                    u.hp = Math.min(u.maxHp, u.hp + heal);
                    if (typeof showPopup === 'function') showPopup(`+${heal} 💚`, u, '#27ae60');
                }
            }
            if (u.baseName === 'Rei Bárbaro' && u.undyingTurns > 0) {
                u.undyingTurns--;
                if (u.undyingTurns === 0) {
                    if (u.hp <= 1) { this.handleDeath(u); }
                    else { if (typeof showPopup === 'function') showPopup("Fúria Terminada", u, '#aaa'); }
                }
            }
            u.hexesMovedThisTurn = 0; // Zera o movimento do Centauro para o próximo turno

            if (u.isLeader && u.name === 'Lord Vampiro' && !u.hasAttacked && this.turnCount > 0) { u.hp -= 15; if (typeof showPopup === 'function') showPopup("-15 Fome", u, '#e74c3c'); if (typeof addLog === 'function') addLog(`🧛 Lord Vampiro perdeu HP por fome!`, '#e74c3c'); if (u.hp <= 0) this.handleDeath(u); }
            const hex = this.map.get(`${u.q},${u.r}`);
            if (hex && hex.terrain.id === 'VILLAGE' && hex.owner === fId) { const heal = Math.min(u.maxHp - u.hp, 15); if (heal > 0) { u.hp += heal; if (typeof showPopup === 'function') showPopup(`+${heal}`, u, '#2ecc71'); } if (u.status === 'poison') { u.status = null; if (typeof showPopup === 'function') showPopup("Curado!", u, '#4a9edd'); } }
            if (u.isLeader && u.faction === 1 && typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_hourglass')) { const hH = Math.min(u.maxHp - u.hp, 5); if (hH > 0) { u.hp += hH; if (typeof showPopup === 'function') showPopup(`+${hH}`, u, '#f1c40f'); } }
            if (sys['SILVESTRE'] >= 3 && u.tags.includes('SILVESTRE')) { let sHeal = Math.min(u.maxHp - u.hp, 5); if (sHeal > 0) { u.hp += sHeal; if (typeof showPopup === 'function') showPopup(`+${sHeal}🌳`, u, '#27ae60'); } }
            if (sys['PRIMAL'] >= 2 && u.tags.includes('PRIMAL')) { u.furyAtk = (u.furyAtk || 0) + 1; if (typeof showPopup === 'function') showPopup(`+1 ATK 🦖`, u, '#e74c3c'); }
            let pDmg = (sys['VENOM'] >= 2) ? 10 : 5; if (u.status === 'poison') { u.hp -= pDmg; if (typeof showPopup === 'function') showPopup(`-${pDmg} ☠`, u, '#27ae60'); if (u.hp <= 0) this.handleDeath(u); }
            if (u.status === 'stun') { u.mp = 0; u.hasAttacked = true; u.status = null; if (typeof showPopup === 'function') showPopup("Zzz", u, '#f39c12'); } else { u.resetTurn(); }
            if (u.status === 'bind') { u.mp = 0; u.status = null; }
            if (u.status === 'chilled') { u.mp = Math.max(0, u.mp - 2); u.status = null; if (typeof showPopup === 'function') showPopup("-2 Mov ❄️", u, '#00ffff'); }
        });
        this.checkWin();
    }

    updateTurnUI(txt, col) { const tb = document.getElementById('turn-badge'); if (tb) { tb.innerText = txt; tb.style.color = col; tb.style.borderColor = col; } if (typeof showMessage === 'function') showMessage(txt, col); }

    checkWin() {
        if (this.gameOver) return;
        const pL = this.units.find(u => u.faction === 1 && u.isLeader); const aL = this.units.find(u => u.faction === 2 && u.isLeader);
        if (!pL) { this.gameOver = true; if (typeof triggerStageEnd === 'function') triggerStageEnd(false); } else if (!aL) { this.gameOver = true; if (typeof triggerStageEnd === 'function') triggerStageEnd(true); }
    }
}

// ==========================================
// RENDERER E DESENHO DA TELA
// ==========================================
class Renderer {
    constructor(canvas, game) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.game = game; this.hexSize = 55; this.offsetX = 0; this.offsetY = 0; window.addEventListener('resize', () => this.initCamera(false)); }

    initCamera(force = false) { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; if (force || this.hexSize < 35) { const mapW = this.game.cols * Math.sqrt(3); const mapH = this.game.rows * 1.5 + 0.5; this.hexSize = Math.max(Math.min(this.canvas.width / mapW, this.canvas.height / mapH) * 0.75, 40); } let pL = this.game.units.find(u => u.isLeader && u.faction === 1); if (pL) this.centerOn(pL.vq, pL.vr); else this.draw(); }
    getPosUnscaled(q, r) { return { x: this.hexSize * Math.sqrt(3) * (q + r / 2) + this.hexSize, y: this.hexSize * 1.5 * r + this.hexSize }; }
    getPos(q, r) { const u = this.getPosUnscaled(q, r); return { x: u.x + this.offsetX, y: u.y + this.offsetY }; }
    centerOn(q, r) { const p = this.getPosUnscaled(q, r); this.offsetX = (this.canvas.width / 2) - p.x; this.offsetY = (this.canvas.height / 2) - p.y; this.draw(); }

    hexPath(ctx, cx, cy, size) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i - 30); const px = cx + size * Math.cos(a); const py = cy + size * Math.sin(a); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.closePath(); }

    draw() {
        const ctx = this.ctx; const actBgColors = ['#0a0a0e', '#121208', '#050a15', '#100515', '#150505']; const bgColor = actBgColors[this.game.currentLevel - 1] || '#0a0a0e';
        ctx.fillStyle = bgColor; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
        
        this.game.map.forEach(hex => {
            const p = this.getPos(hex.q, hex.r); this.hexPath(ctx, p.x, p.y, this.hexSize - 0.5); ctx.fillStyle = hex.terrain.color; ctx.fill();
            if (hex.isCrystal) { this.hexPath(ctx, p.x, p.y, this.hexSize - 1); ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = 'rgba(0,255,255,0.2)'; ctx.fill(); }
            if (this.game.reachableHexes.has(hex.getKey())) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.stroke(); } else { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke(); }
            if (hex.terrain.icon) { ctx.save(); ctx.globalAlpha = 0.8; ctx.font = `${this.hexSize * 0.7}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(hex.terrain.icon, p.x, p.y); ctx.restore(); }
            if (hex.terrain.id === 'VILLAGE' && hex.owner !== null) { ctx.fillStyle = hex.owner === 1 ? '#4a9edd' : '#c0392b'; ctx.beginPath(); ctx.arc(p.x + this.hexSize * 0.4, p.y - this.hexSize * 0.3, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
            if (hex.hasLure) {
                ctx.font = `${this.hexSize * 0.7}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("🍖", p.x, p.y + (this.hexSize * 0.2));
            }   
        });

        this.game.items.forEach((iType, key) => { let [q, r] = key.split(',').map(Number); const p = this.getPos(q, r); ctx.save(); ctx.globalAlpha = 1.0; ctx.beginPath(); ctx.ellipse(p.x, p.y + this.hexSize * 0.35, this.hexSize * 0.4, this.hexSize * 0.2, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,20,30,0.9)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#f1c40f'; ctx.stroke(); ctx.font = `${this.hexSize * 0.6}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (typeof ITEMS !== 'undefined' && ITEMS[iType]) { ctx.fillText(ITEMS[iType].icon, p.x, p.y + this.hexSize * 0.25); } ctx.restore(); });

        const su = this.game.selectedUnit;
        if (this.game.activeSpell && su && su.isLeader && this.game.currentTurn === 1) {
            const spell = typeof SPELLS !== 'undefined' ? SPELLS.find(s => s.id === this.game.activeSpell) : null;
            if (spell) {
                let spRange = spell.range !== undefined ? spell.range : 99; let isGlobal = ['sl_regen', 'sl_shadow_step', 'sl_primal_rage', 'sl_sandstorm', 'sl_inferno', 'sl_blizzard', 'sl_mass_venom', 'sl_storm_wing', 'sl_meteor', 'sl_tidal_wave', 'sl_apocalypse', 'sl_world_freeze', 'sl_soul_harvest', 'sl_phoenix_rebirth'].includes(spell.id); let targets = [];
                if (isGlobal) { targets = spell.type === 'def' ? this.game.units.filter(u => u.faction === 1) : this.game.units.filter(u => u.faction !== 1); } else if (spRange === 0) { targets = [su]; } else { this.game.map.forEach(hex => { if (Hex.distance(su, hex) <= spRange) { const p = this.getPos(hex.q, hex.r); this.hexPath(ctx, p.x, p.y, this.hexSize - 1); ctx.fillStyle = spell.type === 'def' ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)'; ctx.fill(); } }); if (spell.id === 'sl_resurrection') { Hex.getNeighbors(su.q, su.r).forEach(n => { if (this.game.map.has(`${n.q},${n.r}`) && !this.game.getUnitAt(n.q, n.r)) { targets.push({ vq: n.q, vr: n.r }); } }); } else if (spell.type === 'atk') { targets = this.game.units.filter(u => u.faction !== 1 && u.hp > 0 && Hex.distance(su, u) <= spRange); } else { targets = this.game.units.filter(u => u.faction === 1 && u.hp > 0 && Hex.distance(su, u) <= spRange); } }
                let fCol = spell.type === 'def' ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)'; let sCol = spell.type === 'def' ? 'rgba(46,204,113,0.9)' : 'rgba(231,76,60,0.9)'; targets.forEach(t => { const p = this.getPos(t.vq, t.vr); this.hexPath(ctx, p.x, p.y, this.hexSize - 1); ctx.fillStyle = fCol; ctx.fill(); ctx.strokeStyle = sCol; ctx.lineWidth = 2.5; ctx.stroke(); });
            }
        }

        if (su && this.game.currentTurn === 1 && !this.game.activeSpell) {
            this.game.units.forEach(tg => {
                if (tg.faction !== 1 && Hex.distance(su, tg) <= su.getEffectiveRange(game) && !su.hasAttacked) { const isTame = this.game.tameMode && tg.faction === 0 && Hex.distance(su, tg) === 1; const p = this.getPos(tg.vq, tg.vr); this.hexPath(ctx, p.x, p.y, this.hexSize - 1); ctx.fillStyle = isTame ? 'rgba(155,89,182,0.35)' : 'rgba(192,57,43,0.35)'; ctx.fill(); ctx.strokeStyle = isTame ? 'rgba(155,89,182,0.9)' : 'rgba(231,76,60,0.85)'; ctx.lineWidth = 2; ctx.stroke(); }
            });
            const sp = this.getPos(su.vq, su.vr); this.hexPath(ctx, sp.x, sp.y, this.hexSize - 1); ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2.5; ctx.stroke();
        } else if (!su && this.game.selectedHex) { const sh = this.getPos(this.game.selectedHex.q, this.game.selectedHex.r); this.hexPath(ctx, sh.x, sh.y, this.hexSize - 1); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke(); }

        this.game.units.forEach(u => {
            const p = this.getPos(u.vq, u.vr); const fBg = u.faction === 1 ? '#ffffff' : u.faction === 2 ? '#e74c3c' : '#2ecc71'; const sCol = u.faction === 1 ? '#111' : '#fff';
            let sMod = u.isBoss ? 1.35 : 1.0; if (u.level > 1 && !u.isLeader) sMod += 0.20; const r = this.hexSize * 0.6 * sMod;

            ctx.beginPath(); ctx.ellipse(p.x, p.y + r + 2, r * 0.85, r * 0.25, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = fBg; ctx.fill(); ctx.lineWidth = u.isLeader ? 2.5 : 1.5; ctx.strokeStyle = sCol; ctx.stroke();
            if (u.status === 'poison') { ctx.fillStyle = 'rgba(39,174,96,0.35)'; ctx.fill(); } else if (u.status === 'stun' || u.status === 'bind' || u.status === 'chilled') { ctx.fillStyle = 'rgba(241,196,15,0.35)'; ctx.fill(); } else if (u.status === 'shielded') { ctx.fillStyle = 'rgba(149,165,166,0.35)'; ctx.fill(); }

            ctx.save(); ctx.globalAlpha = (u.mp === 0 && u.hasAttacked) ? 0.5 : 1.0; ctx.font = `${this.hexSize * sMod * 0.85}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if (u.hitTimer) ctx.filter = 'brightness(50%) sepia(100%) hue-rotate(-50deg) saturate(500%)'; else if (u.filter !== 'none') ctx.filter = u.filter;
            ctx.fillText(u.emoji, p.x, p.y + 1); ctx.restore();

            if (u.isLeader) { ctx.font = `${this.hexSize * 0.55}px Arial`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'center'; ctx.fillText('👑', p.x, p.y - r + 2); }
            if (u.faction === 0 && u.alerted) { ctx.font = `bold ${this.hexSize * 0.45}px Arial`; ctx.fillStyle = '#e74c3c'; ctx.textAlign = 'center'; ctx.fillText('⚠️', p.x + r - 5, p.y - r + 5); }
            if (u.isLeader && u.faction === 1 && (u.knownSpells || []).length > 0) { ctx.font = `${this.hexSize * 0.35}px Arial`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'right'; ctx.fillText('✨', p.x + r - 2, p.y - r + 8); }

            const hw = Math.min(50, Math.max(16, 16 + (u.maxHp / 5))); const barY = p.y - r - 8; const hpRatio = u.hp / u.maxHp;
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.roundRect(p.x - hw / 2, barY, hw, 5, 2); ctx.fill();
            const hpColor = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c'; ctx.fillStyle = hpColor; ctx.beginPath(); ctx.roundRect(p.x - hw / 2, barY, hw * hpRatio, 5, 2); ctx.fill();

            let starIcon = u.starLevel === 2 ? '🥉' : u.starLevel === 3 ? '🥈' : u.starLevel >= 4 ? '🌟' : '';
            if (u.level > 1 || starIcon) { ctx.font = 'bold 10px Cinzel,serif'; ctx.fillStyle = '#c9a227'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillText(`Lv${u.level}${starIcon}`, p.x + hw / 2 + 12, barY + 5); }
        });
    }
}

class KingdomRenderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.hexSize = 45;
        this.offsetX = 0;
        this.offsetY = 0;
        this.selectedHex = null;
        window.addEventListener('resize', () => this.initCamera());
    }

    initCamera() {
        // Ajusta o canvas para o tamanho do container
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        const mapW = 13 * Math.sqrt(3);
        const mapH = 9 * 1.5 + 0.5;
        this.hexSize = Math.max(Math.min(this.canvas.width / mapW, this.canvas.height / mapH) * 0.85, 30);

        this.offsetX = this.canvas.width / 2;
        this.offsetY = this.canvas.height / 2;
        this.draw();
    }

    getPosUnscaled(q, r) { return { x: this.hexSize * Math.sqrt(3) * (q + r / 2), y: this.hexSize * 1.5 * r }; }

    getPos(q, r) {
        const u = this.getPosUnscaled(q, r);
        // Centraliza o grid fixo de 13x9
        return {
            x: u.x + this.offsetX - (6 * this.hexSize * Math.sqrt(3)),
            y: u.y + this.offsetY - (4 * this.hexSize * 1.5)
        };
    }

    hexPath(ctx, cx, cy, size) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 180) * (60 * i - 30);
            const px = cx + size * Math.cos(a);
            const py = cy + size * Math.sin(a);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.game || !this.game.kingdomMap) return;

        this.game.kingdomMap.forEach(hex => {
            const p = this.getPos(hex.q, hex.r);

            const terrainData = typeof hex.terrain === 'string' ? TERRAINS[hex.terrain] : hex.terrain;
            if (!terrainData) return;

            this.hexPath(ctx, p.x, p.y, this.hexSize - 1);
            ctx.fillStyle = terrainData.color || '#333';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();

            if (terrainData.icon) {
                ctx.font = `${this.hexSize * 0.5}px Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillText(terrainData.icon, p.x, p.y);
            }

            if (hex.building) {
                const b = BUILDINGS[hex.building];
                if (b) {
                    ctx.font = `${this.hexSize * 0.8}px Arial`;
                    ctx.fillStyle = '#fff';
                    ctx.fillText(b.icon, p.x, p.y + 2);

                    // Desenha o badge de Nível se for maior que 1
                    if (hex.bLevel > 1) {
                        ctx.font = 'bold 11px Cinzel,serif';
                        ctx.fillStyle = 'var(--gold)';
                        ctx.textAlign = 'right';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(`Lv${hex.bLevel}`, p.x + this.hexSize * 0.6, p.y + this.hexSize * 0.5);
                    }
                }
            }

            if (this.selectedHex === hex) {
                this.hexPath(ctx, p.x, p.y, this.hexSize - 1);
                ctx.strokeStyle = '#f1c40f';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
                ctx.fill();
            }
        });
    }
}

window.runAITurn = async function () {
    const units = game.units.filter(u => u.faction === 2);
    let maxL = (typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_crown')) ? (game.leaderData.limit + 1) : (game.leaderData.limit || 6);

    for (const u of units) {
        if (game.gameOver) return; if (u.mp === 0) continue;
        if (renderer) { renderer.centerOn(u.vq, u.vr); renderer.draw(); }
        game.selectedUnit = u; if (typeof sleep === 'function') await sleep(300);
        game.calculateReachable(u); let acted = false; const myM = game.units.filter(x => x.faction === u.faction && !x.isLeader).length; const isSafe = u.hp / u.maxHp > 0.4;

        if (u.isLeader && myM < maxL && isSafe) { const n = Hex.getNeighbors(u.q, u.r).map(h => game.getUnitAt(h.q, h.r)).filter(Boolean); const wW = n.filter(e => e.faction === 0 && e.hp / e.maxHp <= 0.3); if (wW.length > 0) { await game.attemptTame(u, wW[0]); acted = true; if (typeof sleep === 'function') await sleep(500); } }

        if (!acted && u.mp > 0) {
            let tgts = game.units.filter(t => t.faction === 1); if (u.isLeader && myM < maxL) tgts = tgts.concat(game.units.filter(t => t.faction === 0)); let cls = null; let minD = 999;
            tgts.forEach(t => { let d = Hex.distance(u, t); if (u.isLeader && t.faction === 0) { if (isSafe) { d -= 3; if (t.hp / t.maxHp <= 0.3) d -= 5; } else { d += 10; } } if (!u.isLeader && t.faction === 1) d -= 2; if (d < minD) { minD = d; cls = t; } });

            if (cls) {
                const moves = Array.from(game.reachableHexes.keys()); let bM = { q: u.q, r: u.r }; let bestScore = -9999;
                moves.forEach(m => {
                    const [mq, mr] = m.split(',').map(Number); if (game.getUnitAt(mq, mr) && (mq !== u.q || mr !== u.r)) return;
                    let distToTarget = Hex.distance({ q: mq, r: mr }, cls); let score = -distToTarget * 10;
                    if (distToTarget > 0 && distToTarget <= u.getEffectiveRange(game)) { score += 1000; score += distToTarget * 5; }
                    let hMap = game.map.get(m); if (hMap && hMap.terrain.id === 'VILLAGE' && hMap.owner !== 2) score += 20;
                    if (!isSafe && hMap && hMap.terrain.id === 'VILLAGE') score += 80;
                    if (score > bestScore) { bestScore = score; bM = { q: mq, r: mr }; }
                });

                if (bM.q !== u.q || bM.r !== u.r) { u.mp -= (game.reachableHexes.get(`${bM.q},${bM.r}`) || 1); await game.moveUnit(u, bM.q, bM.r); }
                if (Hex.distance(u, cls) <= u.range && !u.hasAttacked) { if (u.isLeader && cls.faction === 0 && Hex.distance(u, cls) === 1 && cls.hp / cls.maxHp <= 0.3 && myM < maxL) { await game.attemptTame(u, cls); } else { let risk = false; if (u.isLeader) { let cDmg = Math.floor(game.calcDmg(cls, u) * 0.6); if (cls.abilities.includes('counter')) cDmg = Math.floor(cDmg * 1.2); if (u.hp <= cDmg) risk = true; } if (!risk) await game.executeCombat(u, cls); } }
            }
        }
        if (typeof sleep === 'function') await sleep(200);
    }
};

window.runWildTurn = async function () {
    const wilds = game.units.filter(u => u.faction === 0);
    for (const w of wilds) {
        if (game.gameOver) break; if (w.mp === 0) continue;
        if (!w.alerted) { w.hp = Math.min(w.maxHp, w.hp + 5); continue; }
        
        if (renderer) { renderer.centerOn(w.vq, w.vr); renderer.draw(); } 
        game.selectedUnit = w; if (typeof sleep === 'function') await sleep(250);
        game.calculateReachable(w); 

        // 1. O faro da fera: Procura a isca de carne mais próxima!
        let nearestLure = null; let minLureD = 999;
        game.map.forEach(h => {
            if (h.hasLure) {
                let d = Hex.distance(w, h);
                if (d < minLureD) { minLureD = d; nearestLure = h; }
            }
        });

        let cls = null; let minD = 999;
        let targetIsLure = false;

        // Se achar isca a até 6 hexes de distância, a carne vira o alvo absoluto!
        if (nearestLure && minLureD <= 6) {
            cls = nearestLure;
            targetIsLure = true;
        } else {
            // Comportamento normal: procurar unidades inimigas
            let tgts = game.units.filter(u => u.faction !== 0);
            if (tgts.length === 0) continue;
            tgts.forEach(t => { let d = Hex.distance(w, t); if (d < minD) { minD = d; cls = t; } });
        }

        const isS = w.isBoss || w.maxHp >= 50 || w.atk >= 12;

        if (cls) {
            let moves = Array.from(game.reachableHexes.keys()); 
            let bM = { q: w.q, r: w.r }; 
            let bestScore = -9999;
            
            moves.forEach(m => {
                const [mq, mr] = m.split(',').map(Number); 
                // Não pode parar em cima de outra unidade
                if (game.getUnitAt(mq, mr) && (mq !== w.q || mr !== w.r)) return;
                
                let distToTarget = Hex.distance({ q: mq, r: mr }, cls); 
                let score = 0;

                if (targetIsLure) {
                    // IA MODO ISCA: Quer parar EXATAMENTE em cima da carne (distância 0)
                    score = -distToTarget * 50; 
                    if (distToTarget === 0) score += 5000; // Pote de Ouro
                } else {
                    // IA MODO COMBATE ORIGINAL
                    score = isS ? (-distToTarget * 10) : (distToTarget * 10);
                    if (isS && distToTarget > 0 && distToTarget <= w.range) { score += 1000; score += distToTarget * 5; }
                }

                if (score > bestScore) { bestScore = score; bM = { q: mq, r: mr }; }
            });
            
            // Move a fera para o melhor hexágono encontrado
            if (bM.q !== w.q || bM.r !== w.r) { 
                w.mp -= (game.reachableHexes.get(`${bM.q},${bM.r}`) || 1); 
                await game.moveUnit(w, bM.q, bM.r); 
            }
            
            // Lógica pós-movimento (Atacar ou Comer)
            if (targetIsLure && w.q === cls.q && w.r === cls.r) {
                // Fera pisou na isca! Fica distraída e não ataca neste turno.
                if (typeof showPopup === 'function') showPopup("Comendo...", w, '#e67e22');
                // NOTA: Não removemos o `hasLure` do chão aqui, pois o Herói precisa desse 
                // bônus ativo no chão para dobrar a chance quando for domar no turno dele!
            } else if (!targetIsLure && Hex.distance(w, cls) <= w.range) {
                // Bate no inimigo normalmente
                await game.executeCombat(w, cls); 
            }
        }
        if (typeof sleep === 'function') await sleep(200);
    }
    game.selectedUnit = null;
};
