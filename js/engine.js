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
        let lDef = typeof LEADERS !== 'undefined' ? LEADERS.find(x => x.name === (d.baseName || d.name)) : null;

        // INTERCEPTOR INTELIGENTE: Se não for herói, varre todas as listas de criaturas atrás do sprite!
        let bDef = null;
        if (!lDef && typeof BEASTS !== 'undefined') {
            let masterPool = [...(BEASTS.LAND || []), ...(BEASTS.WATER || []), ...(BEASTS.SNOW || []), ...(BEASTS.BOSSES || []), ...(BEASTS.ELITES || [])];
            bDef = masterPool.find(x => x.name === (d.baseName || d.name));
        }

        // FUNÇÃO AUXILIAR: Normaliza nomes (Remove acentos, espaços viram sublinhados)
        let normalizeName = (str) => {
            if (!str) return '';
            return str.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
                .replace(/\s+/g, '_')                            // Espaço vira _
                .replace(/[^a-z0-9_]/g, '');                     // Remove caracteres especiais
        };

        // Define o caminho correto baseado no tipo da criatura
        let finalSprite = d.sprite;
        if (!finalSprite) {
            if (lDef) {
                finalSprite = lDef.sprite;
            } else if (bDef) {
                // Se for Boss ou Elite, busca na pasta de bosses, se for lacaio comum, vai para img/units/
                let isEpic = (typeof BEASTS !== 'undefined' && BEASTS.BOSSES && BEASTS.BOSSES.some(b => b.name === bDef.name)) ||
                    (typeof BEASTS !== 'undefined' && BEASTS.ELITES && BEASTS.ELITES.some(e => e.name === bDef.name));

                let folder = isEpic ? 'img/boss/' : 'img/units/';
                finalSprite = folder + normalizeName(bDef.name || d.name) + '.png';
            }
        }

        Object.assign(this, {
            q: d.q, r: d.r, vq: d.q, vr: d.r, faction: d.faction,
            isLeader: d.isLeader || false, name: d.name, baseName: d.baseName || d.name,
            emoji: d.emoji,
            sprite: finalSprite,
            hp: d.hp, maxHp: d.maxHp, mp: d.mp, maxMp: d.maxMp,
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
        this.conqueredRegions = [];
        this.currentRegionId = null;
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
    updateFogOfWar() {
        let cycle = this.turnCount % 10;
        if (cycle >= 6 && cycle <= 8) // ...e se for noite (ciclo 6-8), esconde as unidades inimigas que não estão iluminadas

            this.units.forEach(u => {
                // O jogador sempre vê as próprias tropas
                if (u.faction === 1) return;

                let inLight = false;

                // Se for de dia, ou se a própria fera emitir luz (fogo/celestial), ela é visível
                if (!isNight || (u.tags && (u.tags.includes('FIRE') || u.tags.includes('CELESTIAL') || u.tags.includes('ELECTRIC')))) {
                    inLight = true;
                } else {
                    // Checa se está sendo iluminado por uma unidade do jogador
                    for (let light of this.units) {
                        if (light.faction === 1 || (light.tags && (light.tags.includes('FIRE') || light.tags.includes('CELESTIAL') || light.tags.includes('ELECTRIC')))) {
                            let r = (light.tags && (light.tags.includes('FIRE') || light.tags.includes('CELESTIAL'))) ? 3 : 2;
                            if (Hex.distance(u, light) <= r) { inLight = true; break; }
                        }
                    }
                    // Checa se está pisando perto de lava ou floresta em chamas
                    if (!inLight) {
                        for (let [key, hex] of this.map.entries()) {
                            if (hex.terrain && (hex.terrain.id === 'LAVA_RIFT' || hex.terrain.id === 'BURNING_FOREST')) {
                                if (Hex.distance(u, hex) <= 2) { inLight = true; break; }
                            }
                        }
                    }
                }

                u.isHiddenByNight = !inLight;

                // INTEGRAÇÃO PERFEITA: Preserva o status do monstro que já estava camuflado no mato!
                if (u.isHiddenByNight) {
                    u.isHidden = true; // A noite engole a fera
                } else if (!u.abilities || (!u.abilities.includes('camouflage') && !u.abilities.includes('dive'))) {
                    u.isHidden = false; // A luz revela a fera (a menos que ela esteja mergulhada/camuflada)
                }
            });
    }
    generateCampaignMap(savedRoster = []) {
        if (!this.eventFlags) this.eventFlags = {};
        let act = this.currentLevel; let depth = Math.max(0, this.currentFloor);
        this.cols = 13 + (act - 1); this.rows = 9 + Math.floor((act - 1) / 2);
        const stageInd = document.getElementById('stage-indicator');
        if (stageInd) stageInd.innerText = `ATO ${toRoman(act)} - NÓ ${depth + 1}`;
        const log = document.getElementById('combat-log'); if (log) log.innerHTML = '';
        this.map.clear(); this.units = []; this.items.clear(); this.hasKey = false;
        this.manaPool = {}; this.spentMana = {}; this.spellCooldowns = {}; this.activeSpell = null; this.lastDeadAlly = null; this.turnCount = 0;

        // ----------------------------------------------------
        // MÁGICA DOS MAPAS CUSTOMIZADOS POR REGIÃO E BIOMA
        // ----------------------------------------------------
        let atoAtual = this.currentLevel || 1;
        let noAtual = this.currentFloor !== undefined ? this.currentFloor : 0;

        let mapKey = `${this.currentRegionId}_NO${noAtual}`;
        let customMap = typeof CUSTOM_MAPS !== 'undefined' ? (CUSTOM_MAPS[mapKey] || CUSTOM_MAPS[`ATO${atoAtual}_NO${noAtual}`]) : null;
        let pS = null; let aS = null;

        this.cols = 15;
        this.rows = 11;

        if (customMap && customMap.length > 0 && !this.isRoguelite) {
            for (let r = 0; r < this.rows; r++) {
                const off = Math.floor(r / 2);
                for (let q = -off; q < this.cols - off; q++) {
                    this.map.set(`${q},${r}`, new Hex(q, r, TERRAINS.PLAINS));
                }
            }
            customMap.forEach(h => {
                let tDef = TERRAINS[h.tId] || TERRAINS.PLAINS;
                let hex = new Hex(h.q, h.r, tDef);
                if (h.cV !== undefined) hex.customVar = h.cV;
                this.map.set(`${h.q},${h.r}`, hex);
            });
            let bases = [];
            this.map.forEach(h => {
                if (h.terrain && h.terrain.id === 'CASTLE') bases.push(h);
            });
            if (bases.length >= 2) {
                bases.sort((a, b) => a.q - b.q);
                pS = { q: bases[0].q, r: bases[0].r };
                aS = { q: bases[bases.length - 1].q, r: bases[bases.length - 1].r };
            }
        } else {
            // ========================================================
            // LÓGICA ALEATÓRIA AVANÇADA BASEADA NO BIOMA DA REGIÃO
            // ========================================================
            let regionData = typeof CONTINENT_REGIONS !== 'undefined' ? CONTINENT_REGIONS[this.currentRegionId] : null;
            let prefBiome = regionData ? regionData.biome : 'FOREST';

            for (let r = 0; r < this.rows; r++) {
                const off = Math.floor(r / 2);
                for (let q = -off; q < this.cols - off; q++) {
                    let t = TERRAINS.PLAINS;
                    const rnd = Math.random();

                    if (prefBiome === 'SNOW') {
                        if (rnd > 0.4) t = TERRAINS.SNOW;
                        else if (rnd > 0.2) t = TERRAINS.MOUNTAIN;
                        else if (rnd > 0.15) t = TERRAINS.VILLAGE;
                    } else if (prefBiome === 'DESERT') {
                        if (rnd > 0.4) t = TERRAINS.DESERT;
                        else if (rnd > 0.2) t = TERRAINS.SAVANNA;
                        else if (rnd > 0.15) t = TERRAINS.VILLAGE;
                    } else if (prefBiome === 'WATER') {
                        if (rnd > 0.5) t = TERRAINS.WATER;
                        else if (rnd > 0.3) t = TERRAINS.SWAMP;
                        else if (rnd > 0.2) t = TERRAINS.SEA;
                    } else if (prefBiome === 'FOREST') {
                        if (rnd > 0.5) t = TERRAINS.FOREST;
                        else if (rnd > 0.3) t = TERRAINS.SWAMP;
                        else if (rnd > 0.2) t = TERRAINS.VILLAGE;
                    } else if (prefBiome === 'MOUNTAIN') {
                        if (rnd > 0.5) t = TERRAINS.MOUNTAIN;
                        else if (rnd > 0.3) t = TERRAINS.FOREST;
                        else if (rnd > 0.2) t = TERRAINS.SNOW;
                    } else if (prefBiome === 'ASHES') {
                        if (rnd > 0.4) t = TERRAINS.ASHES;
                        else if (rnd > 0.2) t = TERRAINS.BURNING_FOREST;
                        else if (rnd > 0.1) t = TERRAINS.MOUNTAIN;
                    } else {
                        if (rnd > 0.94) t = TERRAINS.MOUNTAIN;
                        else if (rnd > 0.86) t = TERRAINS.SNOW;
                        else if (rnd > 0.74) t = TERRAINS.WATER;
                        else if (rnd > 0.62) t = TERRAINS.FOREST;
                        else if (rnd > 0.52) t = TERRAINS.DESERT;
                        else if (rnd > 0.45) t = TERRAINS.VILLAGE;
                    }

                    // ========================================================
                    // GERAÇÃO DE TERRENOS ESPECIAIS (AGORA NO LUGAR CERTO!)
                    // ========================================================
                    let specRnd = Math.random();
                    if (specRnd > 0.94) {
                        let newT = null;
                        if (t.id === 'WATER' || t.id === 'SEA') newT = TERRAINS.REEF;
                        else if (t.id === 'DESERT' || t.id === 'SAVANNA') newT = Math.random() > 0.5 ? TERRAINS.QUICKSAND : TERRAINS.GOLD_DEPOSIT;
                        else if (t.id === 'MOUNTAIN' || t.id === 'ASHES' || t.id === 'BURNING_FOREST') newT = Math.random() > 0.6 ? TERRAINS.LAVA_RIFT : (Math.random() > 0.5 ? TERRAINS.STONE_DEPOSIT : TERRAINS.MANA_RIFT);
                        else if (t.id === 'FOREST' || t.id === 'SWAMP') newT = Math.random() > 0.5 ? TERRAINS.DNA_DEPOSIT : TERRAINS.MANA_RIFT;
                        else if (t.id === 'PLAINS' || t.id === 'SNOW') newT = Math.random() > 0.85 ? TERRAINS.BLACK_MARKET : (Math.random() > 0.5 ? TERRAINS.GOLD_DEPOSIT : TERRAINS.DNA_DEPOSIT);

                        if (newT !== undefined && newT !== null) t = newT;
                    }

                    // AGORA SIM, SALVAMOS O HEXÁGONO!
                    this.map.set(`${q},${r}`, new Hex(q, r, t));
                }
            }
        }

        if (!pS || !aS) {
            const mR = Math.floor(this.rows / 2);
            pS = { q: -Math.floor(mR / 2), r: mR };
            aS = { q: this.cols - 1 - Math.floor(mR / 2), r: mR };
            if (!this.map.has(`${pS.q},${pS.r}`)) this.map.set(`${pS.q},${pS.r}`, new Hex(pS.q, pS.r, TERRAINS.PLAINS));
            if (!this.map.has(`${aS.q},${aS.r}`)) this.map.set(`${aS.q},${aS.r}`, new Hex(aS.q, aS.r, TERRAINS.PLAINS));
        }

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

        // ========================================================
        // ESCOLHA INTELIGENTE DO OPONENTE BASEADA NA LORE DA REGIÃO
        // ========================================================
        let sFac = 1 + ((act - 1) * 0.4) + (depth * 0.05);
        let targetLoreFac = (typeof LORE_FACTIONS !== 'undefined') ? Object.keys(LORE_FACTIONS).find(k => LORE_FACTIONS[k].startNode === this.currentRegionId) : null;
        let isCapitalRetake = (this.conqueredRegions && this.conqueredRegions.length === 0);

        let aiPool = [];
        if (typeof LEADERS !== 'undefined' && this.leaderData) {
            LEADERS.forEach(l => {
                if (l.id !== this.leaderData.id) {
                    if (isCapitalRetake) {
                        if (l.loreFaction !== this.leaderData.loreFaction) aiPool.push(l);
                    } else if (targetLoreFac) {
                        if (l.loreFaction === targetLoreFac) aiPool.push(l);
                    }
                }
            });
        }

        if (aiPool.length === 0 && typeof LEADERS !== 'undefined') {
            aiPool = LEADERS.filter(l => l.id !== (this.leaderData ? this.leaderData.id : null));
        }

        aiPool.sort(() => Math.random() - 0.5);
        let chosenAI = aiPool[0] || { name: 'Desconhecido', emoji: '💀', hp: 50, atk: 10, mp: 3, range: 1, tags: [], fav: [] };
        let vHp = Math.floor(chosenAI.hp * sFac) + 20;
        let vAtk = Math.floor(chosenAI.atk * sFac) + 4;

        let aiSpells = [];
        if (typeof SPELLS !== 'undefined') {
            SPELLS.forEach(s => {
                if (s.level <= act && s.tags.some(t => (chosenAI.tags || []).includes(t))) aiSpells.push(s.id);
            });
        }
        this.units.push(new Unit({ q: aS.q, r: aS.r, faction: 2, isLeader: true, name: chosenAI.name, baseName: chosenAI.name, emoji: chosenAI.emoji, hp: vHp, maxHp: vHp, mp: chosenAI.mp, maxMp: chosenAI.mp, atk: vAtk, range: chosenAI.range, isBoss: true, level: act, tags: chosenAI.tags || [], fav: chosenAI.fav || [], knownSpells: aiSpells }));

        let maxL = (typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_crown')) ? ((this.leaderData ? this.leaderData.limit : 6) + 1) : ((this.leaderData ? this.leaderData.limit : 6) || 6);
        const numAI = Math.min(maxL + 2, act + Math.floor(depth / 2));
        const aN = Hex.getNeighbors(aS.q, aS.r);

        let lP = [];
        if (typeof BEASTS !== 'undefined') {
            lP = [...BEASTS.LAND, ...BEASTS.WATER, ...BEASTS.SNOW].filter(b => (!b.minLevel || act >= b.minLevel) && b.tags && b.tags.some(t => (chosenAI.tags || []).includes(t)));
            if (lP.length === 0) lP = BEASTS.LAND;
        }

        for (let i = 0; i < numAI; i++) {
            if (lP.length === 0) break;
            const b = lP[Math.floor(Math.random() * lP.length)];
            const hn = aN[i];
            let uLvl = this.getUnitLvl(b);
            let fFac = 1 + (uLvl - 1) * 0.2;
            if (hn && this.map.has(`${hn.q},${hn.r}`)) {
                this.units.push(new Unit({ q: hn.q, r: hn.r, faction: 2, name: b.name, baseName: b.name, emoji: b.e, hp: Math.floor(b.hp * fFac), maxHp: Math.floor(b.hp * fFac), mp: b.mp, maxMp: b.mp, atk: Math.floor(b.atk * fFac), range: b.range, abilities: [...(b.abilities || [])], filter: b.filter || 'none', tags: b.tags || [], fav: b.fav || [], level: uLvl }));
            }
        }

        // ========================================================
        // GERAÇÃO DE ITENS NO MAPA
        // ========================================================
        let wH = Array.from(this.map.values()).filter(h => h.terrain.id !== 'CASTLE' && Hex.distance(h, pS) > 3 && !this.getUnitAt(h.q, h.r));
        let itP = ['COIN', 'COIN', 'COIN', 'GEM', 'GEM', 'POTION', 'POTION', 'BANDAGE', 'BANDAGE', 'MEAT', 'MEAT', 'RUSTY_SWORD', 'RUSTY_SWORD', 'WOODEN_SHIELD', 'WOODEN_SHIELD', 'SCROLL'];
        if (Math.random() > 0.5) itP.push('SWORD'); if (Math.random() > 0.6) itP.push('SHIELD'); if (Math.random() > 0.7) itP.push('BOOTS'); if (Math.random() > 0.8) itP.push('BOW'); if (Math.random() > 0.8) itP.push('APPLE'); if (Math.random() > 0.9) itP.push('MAGIC');
        let numI = Math.min(Math.floor((this.cols * this.rows) / 25) + Math.floor(Math.random() * 2), 6);
        if (Math.random() > 0.4 && wH.length > 2) { let idx1 = Math.floor(Math.random() * wH.length); this.items.set(wH.splice(idx1, 1)[0].getKey(), 'CHEST'); let idx2 = Math.floor(Math.random() * wH.length); this.items.set(wH.splice(idx2, 1)[0].getKey(), 'KEY'); }
        for (let i = 0; i < numI; i++) { if (wH.length > 0) { let idx = Math.floor(Math.random() * wH.length); this.items.set(wH.splice(idx, 1)[0].getKey(), itP[Math.floor(Math.random() * itP.length)]); } }

        // ========================================================
        // FILTRO DE LORE: TAGS DA REGIÃO
        // ========================================================
        const REGION_TAGS = {
            'WEST': ['SILVESTRE', 'WING', 'STALKER'],
            'NORTH': ['ICE', 'CELESTIAL', 'MYSTIC', 'ROCK'],
            'EAST': ['SAND', 'MYSTIC', 'ELECTRIC', 'FIRE'],
            'SOUTH': ['UMBRAL', 'VENOM', 'STALKER'],
            'NW': ['PRIMAL', 'ROCK', 'STALKER'],
            'NE': ['ELECTRIC', 'WING', 'CARAPACE'],
            'SE': ['SAND', 'FIRE', 'VENOM'],
            'SW': ['ABYSSAL', 'ICE', 'VENOM'],
            'CENTER': ['FIRE', 'UMBRAL', 'CELESTIAL', 'PRIMAL']
        };
        let currentRegionTags = REGION_TAGS[this.currentRegionId] || ['PRIMAL', 'SILVESTRE'];

        // ========================================================
        // SPAWN DO CHEFE OU ELITE (SISTEMA DE ALERTA E REGIAO FIXADO)
        // ========================================================
        let numW = 4 + act;
        const vC = wH.sort((a, b) => Math.abs(Hex.distance(a, pS) - Hex.distance(a, aS)) - Math.abs(Hex.distance(b, pS) - Hex.distance(b, aS)));

        if (vC.length > 0 && typeof BEASTS !== 'undefined') {
            let bDef = null;
            let isBossUnit = false;
            let isEliteUnit = false;

            let bossesSource = BEASTS.BOSSES || window.BOSSES || [];
            let elitesSource = BEASTS.ELITES || window.ELITES || [];

            // 1. É NÓ DE CHEFE?
            if (this.currentRouteType === 'BOSS' || this.isBossStage) {
                let validBosses = bossesSource.filter(b => b.spawnRegion === this.currentRegionId);
                bDef = validBosses.length > 0 ? validBosses[0] : bossesSource[0];
                if (this.currentRegionId === 'CENTER' || act >= 5) {
                    bDef = bossesSource.find(b => b.name === 'Leviatã Umbral') || bDef;
                }
                isBossUnit = true;
            }
            // 2. É NÓ DE ELITE?
            else if (this.currentRouteType === 'ELITE') {
                // Tenta filtrar por nível E tags da região atual
                let validElites = elitesSource.filter(b => (!b.minLevel || act >= b.minLevel) && b.tags && b.tags.some(t => currentRegionTags.includes(t)));

                // CORREÇÃO DO IFRIT: Se não houver elite do nível do Ato (ex: Ato 1), ignora o nível e força o bioma da região!
                if (validElites.length === 0) {
                    validElites = elitesSource.filter(b => b.tags && b.tags.some(t => currentRegionTags.includes(t)));
                }

                if (validElites.length > 0) {
                    bDef = validElites[Math.floor(Math.random() * validElites.length)];
                } else {
                    // Failsafe: Sorteia um aleatório da lista em vez de travar sempre no primeiro
                    bDef = elitesSource[Math.floor(Math.random() * elitesSource.length)] || bossesSource[0];
                }
                isEliteUnit = true;
            }

            // SE ENCONTROU O MONSTRO, INJETA NO TABULEIRO
            if (bDef) {
                let epicUnit = new Unit({
                    q: vC[0].q, r: vC[0].r, faction: 0,
                    name: bDef.name, baseName: bDef.name, emoji: bDef.e,
                    sprite: bDef.sprite,
                    hp: Math.floor(bDef.hp * sFac), maxHp: Math.floor(bDef.hp * sFac),
                    mp: bDef.mp, maxMp: bDef.mp,
                    atk: Math.floor(bDef.atk * sFac), range: bDef.range,
                    abilities: [...(bDef.abilities || [])], filter: bDef.filter || 'none',
                    tags: bDef.tags || [], fav: bDef.fav || [],
                    isBoss: true, // CORREÇÃO DO ALERTA: Força true para ativar o raio de aggro da IA!
                    level: act
                });
                epicUnit.isElite = isEliteUnit; // Mantém a flag para o tamanho correto e cinemática
                this.units.push(epicUnit);
                wH = wH.filter(h => h !== vC[0]);
            }
        }

        // ========================================================
        // FERAS SELVAGENS COMUNS (MINIONS DA BATALHA)
        // ========================================================
        while (numW > 0 && wH.length > 0 && typeof BEASTS !== 'undefined') {
            const hex = wH.splice(Math.floor(Math.random() * wH.length), 1)[0];
            let masterPool = [...BEASTS.LAND, ...BEASTS.WATER, ...BEASTS.SNOW];

            let pool = masterPool.filter(b => {
                if (b.minLevel && act < b.minLevel) return false;
                if (!b.tags || !b.tags.some(t => currentRegionTags.includes(t))) return false;
                if (hex.terrain.id === 'WATER' && (!b.fav.includes('WATER') && !b.tags.includes('ABYSSAL'))) return false;
                if (hex.terrain.id === 'SNOW' && (!b.fav.includes('SNOW') && !b.tags.includes('ICE'))) return false;
                if (hex.terrain.id !== 'WATER' && b.tags.includes('ABYSSAL') && !b.fav.includes(hex.terrain.id)) return false;
                return true;
            });

            if (pool.length === 0) {
                if (hex.terrain.id === 'WATER') pool = BEASTS.WATER.filter(b => !b.minLevel || act >= b.minLevel);
                else if (hex.terrain.id === 'SNOW') pool = BEASTS.SNOW.filter(b => !b.minLevel || act >= b.minLevel);
                else pool = BEASTS.LAND.filter(b => !b.minLevel || act >= b.minLevel);
            }

            if (pool.length > 0) {
                const b = pool[Math.floor(Math.random() * pool.length)];
                let uLvl = this.getUnitLvl(b);
                let fFac = 1 + (uLvl - 1) * 0.2;

                this.units.push(new Unit({
                    q: hex.q, r: hex.r, faction: 0,
                    name: b.name, baseName: b.name, emoji: b.e,
                    hp: Math.floor(b.hp * fFac), maxHp: Math.floor(b.hp * fFac),
                    mp: b.mp, maxMp: b.mp,
                    atk: Math.floor(b.atk * fFac), range: b.range,
                    abilities: [...(b.abilities || [])], filter: b.filter || 'none',
                    tags: b.tags || [], fav: b.fav || [], level: uLvl
                }));
            }
            numW--;
        }

        if (this.eventFlags.noVillages) { this.map.forEach(h => { if (h.terrain.id === 'VILLAGE') h.terrain = TERRAINS.PLAINS; }); }
        if (this.eventFlags.crystalHexes) { let keys = Array.from(this.map.keys()).sort(() => Math.random() - 0.5); for (let i = 0; i < 4; i++) if (keys[i]) this.map.get(keys[i]).isCrystal = true; }
        if (this.eventFlags.hauntedCurse) { this.units.filter(u => u.faction !== 1).forEach(u => { u.maxHp = Math.max(1, Math.floor(u.maxHp * 0.8)); u.hp = u.maxHp; }); }
        if (this.eventFlags.veteranBoss) { this.units = this.units.filter(u => u.faction === 1); let h = Array.from(this.map.values()).find(h => h.terrain.id === 'CASTLE' && h.owner !== 1) || Array.from(this.map.values()).pop(); this.units.push(new Unit({ q: h.q, r: h.r, faction: 2, name: "Mercenário Veterano", baseName: "Veterano", emoji: '🗡️', hp: 250, maxHp: 250, mp: 5, maxMp: 5, atk: 35, range: 1, abilities: ['counter', 'dodge', 'swift'], isBoss: true, isLeader: true, filter: 'saturate(0%)', level: act })); }
        if (this.eventFlags.serpentAmbush) { let pL = this.units.find(u => u.isLeader && u.faction === 1); let emptyHexes = Array.from(this.map.values()).filter(h => !this.getUnitAt(h.q, h.r)).sort((a, b) => { let da = Hex.distance(a, pL); let db = Hex.distance(b, pL); return Math.abs(da - 2) - Math.abs(db - 2); }); if (emptyHexes.length > 0) { let h = emptyHexes[0]; this.units.push(new Unit({ q: h.q, r: h.r, faction: 2, name: "Mãe Serpe", emoji: '🐍', hp: 150, maxHp: 150, mp: 4, maxMp: 4, atk: 22, range: 1, abilities: ['poison'], isBoss: true, filter: 'hue-rotate(90deg) saturate(200%)', level: act })); } }
        if (this.eventFlags.scatterUnits) { let pUnits = this.units.filter(u => u.faction === 1); let validHexes = Array.from(this.map.values()).filter(h => h.terrain.id !== 'WATER' && h.terrain.id !== 'MOUNTAIN' && !this.getUnitAt(h.q, h.r)).sort(() => Math.random() - 0.5); pUnits.forEach((u, i) => { if (validHexes[i]) { u.q = validHexes[i].q; u.r = validHexes[i].r; u.vq = u.q; u.vr = u.r; } }); }
        let pL2 = this.units.find(u => u.isLeader && u.faction === 1);
        if (pL2) { if (this.eventFlags.artillery) pL2.knownSpells.push('sl_artillery'); if (this.eventFlags.mines > 0) pL2.knownSpells.push('sl_mine'); if (this.eventFlags.barricades) pL2.knownSpells.push('sl_barricade'); if (this.eventFlags.epicConsumable) { pL2.maxHp += 25; pL2.hp += 25; } }

        if (typeof checkAdjacency === 'function' && checkAdjacency('FARM', 'SHADOW_ALTAR')) {
            this.units.filter(u => u.faction !== 1 && !u.isLeader).forEach(u => u.status = 'poison');
        }

        if (typeof countKingdomBuildings === 'function') {
            let resCount = window.countKingdomBuildings('RESIDENCE');
            if (resCount > 0) {
                this.units.filter(u => u.faction === 1).forEach(u => {
                    let lostHp = u.maxHp - u.hp;
                    if (lostHp > 0) {
                        u.hp = Math.min(u.maxHp, Math.floor(u.hp + (lostHp * 0.10 * resCount)));
                    }
                });
            }
        }

        this.eventFlags = {}; this.activeSynergies = this.getSynergies(1); this.currentTurn = 1; this.gameOver = false; this.selectPlayerLeader();
        let pL = this.units.find(u => u.isLeader && u.faction === 1);

        if (pL && typeof countKingdomBuildings === 'function') {
            let towerLvl = window.countKingdomBuildings('CRYSTAL_TOWER');
            if (towerLvl > 0 && pL.tags && pL.tags.length > 0) {
                let primaryTag = pL.tags[0];
                this.manaPool[primaryTag] = (this.manaPool[primaryTag] || 0) + towerLvl;
                setTimeout(() => {
                    if (typeof showPopup === 'function') showPopup(`+${towerLvl} Mana 🔮`, pL, '#9b59b6');
                    if (typeof updateUI === 'function') updateUI();
                }, 800);
            }
        }

        if (pL && pL.baseName === 'Gênia') {
            setTimeout(() => { if (typeof window.triggerGenieWishes === 'function') window.triggerGenieWishes(); }, 1200);
        }
    }

    generateDuelMap() {
        this.map.clear(); this.units = []; this.items.clear();
        this.cols = 15; this.rows = 11;
        this.manaPool = {}; this.spentMana = {}; this.spellCooldowns = {};

        // 1. Gera a Arena (O Espelho)
        for (let r = 0; r < this.rows; r++) {
            const off = Math.floor(r / 2);
            for (let q = -off; q < this.cols - off; q++) {
                let t = TERRAINS.PLAINS;
                // Cria um rio central para dividir a arena
                if (q === Math.floor(this.cols / 2) - off) t = TERRAINS.WATER;
                // Coloca montanhas simétricas para estratégia
                if ((r === 2 || r === 8) && (q === 2 - off || q === this.cols - 3 - off)) t = TERRAINS.MOUNTAIN;
                this.map.set(`${q},${r}`, new Hex(q, r, t));
            }
        }

        const mR = Math.floor(this.rows / 2);
        const pS = { q: -Math.floor(mR / 2) + 1, r: mR };
        const aS = { q: this.cols - 2 - Math.floor(mR / 2), r: mR };

        this.map.set(`${pS.q},${pS.r}`, new Hex(pS.q, pS.r, TERRAINS.CASTLE, 1));
        this.map.set(`${aS.q},${aS.r}`, new Hex(aS.q, aS.r, TERRAINS.CASTLE, 2));

        // 2. Posiciona o Jogador (Garante que as tropas não nasçam no mesmo hexágono)
        let pNeighbors = [pS, ...Hex.getNeighbors(pS.q, pS.r), ...Hex.getNeighbors(pS.q + 1, pS.r), ...Hex.getNeighbors(pS.q - 1, pS.r)];
        let pValid = pNeighbors.filter(n => this.map.has(`${n.q},${n.r}`) && this.map.get(`${n.q},${n.r}`).terrain.id !== 'WATER' && this.map.get(`${n.q},${n.r}`).terrain.id !== 'MOUNTAIN');
        let pUsed = new Set();

        deployedRoster.forEach((u, i) => {
            let spawn = pValid.find(n => !pUsed.has(`${n.q},${n.r}`)) || pS;
            pUsed.add(`${spawn.q},${spawn.r}`);
            this.units.push(new Unit({ ...u, q: spawn.q, r: spawn.r, mp: u.maxMp, hasAttacked: false, isNew: false }));
        });

        // 3. IA Oponente e sua Tropa Mímica!
        let chosenAI = typeof LEADERS !== 'undefined' ? LEADERS.find(l => l.id === this.opponentId) : null;
        if (!chosenAI) chosenAI = LEADERS[0];

        let aiSpells = [];
        if (typeof SPELLS !== 'undefined') SPELLS.forEach(s => { if (s.level <= 2 && s.tags.some(t => chosenAI.tags.includes(t))) aiSpells.push(s.id); });

        let eNeighbors = [aS, ...Hex.getNeighbors(aS.q, aS.r), ...Hex.getNeighbors(aS.q - 1, aS.r), ...Hex.getNeighbors(aS.q + 1, aS.r)];
        let eValid = eNeighbors.filter(n => this.map.has(`${n.q},${n.r}`) && this.map.get(`${n.q},${n.r}`).terrain.id !== 'WATER' && this.map.get(`${n.q},${n.r}`).terrain.id !== 'MOUNTAIN');
        let eUsed = new Set([`${aS.q},${aS.r}`]); // Reserva o Castelo para o Líder inimigo

        // Nasce o Líder Inimigo
        this.units.push(new Unit({ q: aS.q, r: aS.r, faction: 2, isLeader: true, name: chosenAI.name, baseName: chosenAI.name, emoji: chosenAI.emoji, hp: chosenAI.hp, maxHp: chosenAI.hp, mp: chosenAI.mp, maxMp: chosenAI.mp, atk: chosenAI.atk, range: chosenAI.range, isBoss: true, level: 2, tags: chosenAI.tags, fav: chosenAI.fav, knownSpells: aiSpells }));

        // A IA compra feras e as espalha
        let beastPool = BEASTS.LAND.filter(b => b.tags && b.tags.some(t => chosenAI.tags.includes(t)));
        if (beastPool.length === 0) beastPool = BEASTS.LAND;

        for (let i = 0; i < deployedRoster.length - 1; i++) {
            const b = beastPool[Math.floor(Math.random() * beastPool.length)];
            let spawn = eValid.find(n => !eUsed.has(`${n.q},${n.r}`)) || aS;
            eUsed.add(`${spawn.q},${spawn.r}`);

            this.units.push(new Unit({ q: spawn.q, r: spawn.r, faction: 2, name: b.name, baseName: b.name, emoji: b.e, hp: b.hp, maxHp: b.hp, mp: b.mp, maxMp: b.mp, atk: b.atk, range: b.range, abilities: [...b.abilities], filter: b.filter, tags: b.tags || [], fav: b.fav || [], level: 2 }));
        }

        this.currentTurn = 1; this.gameOver = false; this.selectPlayerLeader();
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

        // ========================================================
        // EFEITOS DE TERRENO (AO PISAR)
        // ========================================================
        let hInfo = this.map.get(k);
        if (hInfo && hInfo.terrain) {
            let isFlying = u.abilities.includes('flying');

            // 🌀 Areia Movediça: Zera MP se não voar
            if (hInfo.terrain.id === 'QUICKSAND' && !isFlying) {
                u.mp = 0;
                if (typeof showPopup === 'function') showPopup("Preso!", u, '#d4a373');
            }
            // 🌋 Fenda de Lava: Dano se não voar
            if (hInfo.terrain.id === 'LAVA_RIFT' && !isFlying) {
                u.hp -= 10;
                if (typeof showPopup === 'function') showPopup("-10 🔥", u, '#c0392b');
                if (u.hp <= 0) this.handleDeath(u);
            }
            // ⛺ Mercado Negro: Abre a loja se for o Líder
            if (hInfo.terrain.id === 'BLACK_MARKET' && u.faction === 1 && u.isLeader) {
                if (typeof openBlackMarket === 'function') openBlackMarket();
            }
        }

        // MECÂNICA T-REX: Esmaga o terreno e gera RECURSOS EM DOBRO
        if (u.baseName === 'T-Rex') {
            let h = this.map.get(k);
            if (h && (h.terrain.id === 'FOREST' || h.terrain.id === 'VILLAGE' || h.terrain.id === 'SNOW')) {
                if (!this.resources) this.resources = {};
                let resGot = "";

                if (h.terrain.id === 'FOREST') { this.resources.wood = (this.resources.wood || 0) + 2; resGot = "+2 🌲"; }
                if (h.terrain.id === 'SNOW') { this.resources.sand = (this.resources.sand || 0) + 2; resGot = "+2 ⏳"; }
                if (h.terrain.id === 'VILLAGE') { this.gold = (this.gold || 0) + 10; resGot = "+10 💰"; }

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
                        } else {
                            // SE FOR UM ITEM DE CAMPO, VAI PARA A MOCHILA
                            const itemMapping = { 'MEAT': 'isca', 'MAGIC': 'sphere', 'POTION': 'potion', 'BANDAGE': 'bandage', 'SCROLL': 'scroll' };
                            let mappedId = itemMapping[iType];

                            if (mappedId) {
                                // PROTEÇÃO: Cria a mochila na hora se ela não existir
                                if (!this.fieldItems) {
                                    this.fieldItems = { isca: 0, rede: 0, potion: 0, bandage: 0, scroll: 0, sphere: 0 };
                                }

                                this.fieldItems[mappedId] = (this.fieldItems[mappedId] || 0) + 1;
                                this.items.delete(k);
                                if (typeof showPopup === 'function') showPopup(`+1 ${mappedId.toUpperCase()}!`, u, '#f1c40f');
                            } else {
                                // Comportamento original para itens que não são de campo
                                let r = await iDef.f(u, this); if (r !== false) this.items.delete(k);
                            }
                        }
                        const undoBtn = document.getElementById('btn-undo'); if (undoBtn) undoBtn.disabled = true; lastState = null;
                    }
                } else { if (iDef.type !== 'equip') { let r = await iDef.f(u, this); if (r !== false) this.items.delete(k); } }
            }
            this.updateFogOfWar(); // ATUALIZA A LUZ APÓS O PASSO!
            if (typeof updateUI === 'function') updateUI(); if (renderer) renderer.draw();
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
        // ========================================================
        // ARTEFATOS ÔMEGA: ALTERAÇÕES DE DEFESA
        // ========================================================
        let omegaArts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : [];

        // ☠️ MANDÍBULA FERRUGÍNEA: Atacante ignora terreno inimigo
        if (a.faction === 1 && omegaArts.includes('art_omega_south')) {
            def = 0;
        }
        // ⛰️ PLACA TECTÔNICA: Defensor ganha armadura pesada (+40% Def) se não voar
        if (d.faction === 1 && omegaArts.includes('art_omega_nw')) {
            if (!d.abilities.includes('flying')) def += 0.40;
        }

        if (d.fav.includes(hex.terrain.id)) def += 0.2;
        if (d.name === 'Almirante' && hex.terrain.id !== 'WATER') def -= 0.30;
        if (d.tags.includes('ABYSSAL') && (hex.terrain.id === 'WATER' || hex.terrain.id === 'REEF')) {
            def += (hex.terrain.id === 'REEF' ? 0.50 : 0.30); // 50% de defesa no Recife!
        }
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
        // Bônus Ofensivo da Noite
        let cycle = this.turnCount % 10;
        if ((cycle >= 6 && cycle <= 8) && a.tags && (a.tags.includes('STALKER') || a.tags.includes('UMBRAL'))) {
            baseAtk = Math.floor(baseAtk * 1.30); // 30% mais forte no escuro!
        }
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
            let dodgeC = d.abilities.includes('dodge') ? 0.3 : 0;
            // Bônus de Esquiva da Noite
            let cycle = this.turnCount % 10;
            if ((cycle >= 6 && cycle <= 8) && d.tags && (d.tags.includes('UMBRAL'))) {
                dodgeC += 0.10; // 10% mais esquiva no escuro!
            }
            if (d.tags.includes('ABYSSAL') && sysD['ABYSSAL'] >= 3) dodgeC += 0.2;
            if (d.faction === 1 && typeof getActiveArtifacts === 'function' && getActiveArtifacts().includes('art_wind')) dodgeC += 0.2;
            if (Math.random() < dodgeC) {
                if (typeof showPopup === 'function') showPopup("💨 Esquivou!", d, '#aaa');
                if (typeof addLog === 'function') addLog(`💨 ${d.name} esquivou!`, '#aaa'); a.hasAttacked = true;
                if (!a.abilities.includes('hit_run') && !(a.tags.includes('SAND') && sysA['SAND'] >= 3)) a.mp = 0;
                await this.processRevide(a, d);
                let cycle = this.turnCount % 10;
                if ((cycle >= 6 && cycle <= 8) && a.tags && (a.tags.includes('UMBRAL'))) {
                    dodgeC += 0.10; // 10% mais esquiva no escuro!
                }
                if (typeof sleep === 'function') await sleep(600);
                return;
            }

            const dmg = this.calcDmg(a, d);
            d.hp -= dmg;
            // ========================================================
            // ARTEFATOS ÔMEGA: REAÇÕES AO COMBATE
            // ========================================================
            let activeArts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : [];

            // 🧊 PRESA DO ZERO ABSOLUTO: Congela o inimigo instantaneamente se ele te atacar!
            if (d.faction === 1 && activeArts.includes('art_omega_north')) {
                a.status = 'chilled';
                a.mp = 0; // O frio congela as pernas
                if (typeof showPopup === 'function') showPopup("❄️ Zero Absoluto!", a, '#00ffff');
            }

            // EFEITOS QUANDO O JOGADOR É O ATACANTE
            if (a.faction === 1) {
                // 🌊 PÉROLA DAS PROFUNDEZAS: Lifesteal massivo se estiver atacando a partir da água
                if (activeArts.includes('art_omega_sw')) {
                    let hexA = this.map.get(`${a.q},${a.r}`);
                    if (hexA && (hexA.terrain.id === 'WATER' || hexA.terrain.id === 'SEA' || hexA.terrain.id === 'ELECTRIC_WATER')) {
                        let heal = Math.floor(dmg * 0.50);
                        a.hp = Math.min(a.maxHp, a.hp + heal);
                        if (typeof showPopup === 'function') showPopup(`+${heal} 💧`, a, '#3498db');
                    }
                }
                // ☠️ MANDÍBULA FERRUGÍNEA: Aplica Veneno e Choque (Zera o MP) simultaneamente
                if (activeArts.includes('art_omega_south') && d.hp > 0) {
                    d.status = 'poison';
                    d.mp = 0; // Isso simula o atordoamento/choque sem apagar a string 'poison'
                    if (typeof showPopup === 'function') showPopup("Veneno Elétrico!", d, '#2ecc71');
                }
                // ⚡ AURÉOLA DA TORMENTA: Ataques à distância rebatem como raios!
                if (activeArts.includes('art_omega_ne') && Hex.distance(a, d) > 1) {
                    Hex.getNeighbors(d.q, d.r).forEach(n => {
                        let t = this.getUnitAt(n.q, n.r);
                        if (t && t.faction !== a.faction && t !== d && t.hp > 0) {
                            let cDmg = Math.max(1, Math.floor(dmg * 0.30));
                            t.hp -= cDmg;
                            if (typeof showPopup === 'function') showPopup(`⚡ -${cDmg}`, t, '#00ffff');
                            if (t.hp <= 0) this.handleDeath(t, a);
                        }
                    });
                }
            }

            // ========================================================
            // ARTEFATOS ÔMEGA: ATAQUE DUPLO DA COROA (CORREÇÃO)
            // ========================================================
            let hasCrown = activeArts.includes('art_omega_east');
            let hexAtk = this.map.get(`${a.q},${a.r}`);
            let onSand = hexAtk && (hexAtk.terrain.id === 'DESERT' || hexAtk.terrain.id === 'SAVANNA');

            if (a.faction === 1 && hasCrown && onSand && !a.bonusAttackUsed) {
                // Não gasta a ação de ataque e ativa a flag do bônus!
                a.hasAttacked = false;
                a.bonusAttackUsed = true;
                if (typeof showPopup === 'function') showPopup("Ataque Duplo!", a, '#f1c40f');
                if (typeof addLog === 'function') addLog(`👑 ${a.name} usou o poder da Areia para continuar atacando!`, '#f1c40f');
            } else {
                a.hasAttacked = true;
            }

            if (!a.abilities.includes('hit_run') && !(a.tags.includes('SAND') && sysA['SAND'] >= 3)) a.mp = 0; if (a.faction === 1) a.addXp(15);

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

        if (killer && killer.faction === 1 && victim.faction !== 1) {
            killer.addXp(victim.isBoss ? 100 : 30); let arts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : [];

            // INSÍGNIA DO BANDIDO
            if (arts.includes('art_bandit_badge')) {
                this.gold += 2;
                if (typeof showPopup === 'function') showPopup("+2💰", killer, 'var(--gold-light)');
            }
        }

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

    calculateTameChance(tamer, wild) {
        if (wild.tameImmuneTurn === this.turnCount) return 0; // Trava do Laço do Predador
        let cC = 1.1 - (wild.hp / wild.maxHp);
        if (wild.isBoss) cC -= 0.35;
        let arts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : [];
        if (tamer.faction === 1 && arts.includes('art_tame')) cC += 0.20;
        if (tamer.faction === 1 && arts.includes('art_predator_lasso')) cC += 0.30; // Artefato Novo

        if (tamer.baseName === 'Almirante' && wild.tags.includes('ABYSSAL')) cC += 0.20;
        if (tamer.baseName === 'Arqueira' && wild.tags.includes('SILVESTRE')) cC += 0.20;

        if (tamer.faction === 1 && typeof countKingdomBuildings === 'function') {
            if (wild.level === 1 && wild.hp === wild.maxHp && window.countKingdomBuildings('PARK') > 0) cC += 0.40;
            cC += (window.countKingdomBuildings('BESTIARY') * 0.15);
        }
        if (cC < 0.05) cC = 0.05;

        let willBreakMod = 1.0;
        if (['stun', 'bind', 'sleep', 'paralyzed', 'chilled'].includes(wild.status)) willBreakMod = 1.5;
        if (wild.pheromone) willBreakMod = 2.0;

        let lureMod = 1.0;
        let hexLure = this.map.get(`${wild.q},${wild.r}`);
        if (hexLure) {
            if (hexLure.hasPremiumLure) lureMod = 3.0; // Picanha Triplica!
            else if (hexLure.hasLure) lureMod = 2.0;
        }

        return cC * willBreakMod * lureMod;
    }

    async attemptTame(tamer, wild) {
        if (tamer.status === 'silenced') {
            if (typeof showPopup === 'function') showPopup("Silenciado!", tamer, '#7f8c8d');
            return false;
        }

        lastState = null; const undoBtn = document.getElementById('btn-undo'); if (undoBtn) undoBtn.disabled = true; this.isAnimating = true; let arts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : [];
        try {
            tamer.hasAttacked = true; tamer.mp = 0;

            // Puxa a chance real exata
            let cC = this.calculateTameChance(tamer, wild);
            const tCol = tamer.faction === 1 ? '#4a9edd' : '#c0392b';

            if (['stun', 'bind', 'sleep', 'paralyzed', 'chilled'].includes(wild.status)) {
                if (typeof showPopup === 'function') showPopup("Vontade Quebrada!", wild, '#9b59b6');
            }
            let hexLure = this.map.get(`${wild.q},${wild.r}`);
            if (hexLure && (hexLure.hasLure || hexLure.hasPremiumLure)) {
                hexLure.hasLure = false; hexLure.hasPremiumLure = false;
                if (typeof showPopup === 'function') showPopup("Isca Devorada!", wild, '#e67e22');
            }

            // Rola o dado para ver se domou
            if (Math.random() < cC) {
                this.dna = (this.dna || 0) + 1; // Drop de DNA
                if (typeof showPopup === 'function') showPopup("+1 🧬", tamer, '#1abc9c');

                // 3. CAPTURA CRÍTICA (BUFF AO DOMAR): Somente se chance >= 100% e cura a Fera!
                if (cC >= 1.0) {
                    let healAmount = 25;
                    wild.hp = Math.min(wild.maxHp, wild.hp + healAmount);
                    if (typeof showPopup === 'function') showPopup(`Captura Perfeita! +${healAmount} HP`, wild, '#2ecc71');
                }

                // Passiva do Piromante (Adiciona Ígneo)
                if (tamer.baseName === 'Piromante' && !wild.tags.includes('FIRE')) {
                    wild.tags.push('FIRE');
                }
                wild.faction = tamer.faction;
                wild.alerted = false;

                let maxL = typeof window.getMaxBoxLimit === 'function' ? window.getMaxBoxLimit() : 6;
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

                // REVIDE DO LAÇO DO PREDADOR
                if (tamer.faction === 1 && arts.includes('art_predator_lasso')) {
                    let dmg = this.calcDmg(wild, tamer) * 2;
                    tamer.hp -= dmg;
                    wild.tameImmuneTurn = this.turnCount; // Imune este turno!
                    if (typeof showPopup === 'function') showPopup(`Predador: -${dmg}!`, tamer, '#e74c3c');
                    if (tamer.hp <= 0) this.handleDeath(tamer, wild);
                }

                if (typeof sleep === 'function') await sleep(600);
                return false;
            }
        } finally { this.isAnimating = false; }
    }

    // Busca todos os hexágonos vizinhos conectados que sejam do mesmo tipo (Efeito cascata da Água)
    getContiguousHexes(startHex, validIds) {
        let visited = new Set();
        let queue = [startHex];
        let result = [];
        visited.add(`${startHex.q},${startHex.r}`);

        while (queue.length > 0) {
            let curr = queue.shift();
            result.push(curr);
            let neighbors = Hex.getNeighbors(curr.q, curr.r);
            for (let n of neighbors) {
                let key = `${n.q},${n.r}`;
                if (!visited.has(key)) {
                    let h = this.map.get(key);
                    if (h && validIds.includes(h.terrain.id)) {
                        visited.add(key);
                        queue.push(h);
                    }
                }
            }
        }
        return result;
    }

    async triggerElementalReaction(targetHex, tags) {
        if (!targetHex || !tags || typeof TERRAINS === 'undefined') return;

        // 1. ELETRICIDADE NA ÁGUA
        if (tags.includes('ELECTRIC') && (targetHex.terrain.id === 'WATER' || targetHex.terrain.id === 'ELECTRIC_WATER')) {
            let waterHexes = this.getContiguousHexes(targetHex, ['WATER', 'ELECTRIC_WATER']);
            for (let h of waterHexes) {
                h.terrain = TERRAINS.ELECTRIC_WATER; // Usa o dicionário oficial!
                h.timer = 2;

                let u = this.getUnitAt(h.q, h.r);
                if (u && u.status !== 'stun') {
                    u.status = 'stun';
                    if (typeof showPopup === 'function') showPopup("Zzz ⚡", u, '#f1c40f');
                }
            }
            if (typeof showMessage === 'function') showMessage("A água conduziu a eletricidade!", "#f1c40f");
            if (typeof sleep === 'function') await sleep(400);
        }

        // 2. FOGO E RAIO NA FLORESTA OU GELO
        if (tags.includes('FIRE') || tags.includes('ELECTRIC')) {
            if (targetHex.terrain.id === 'FOREST') {
                targetHex.terrain = TERRAINS.BURNING_FOREST; // Usa o dicionário oficial!
                targetHex.timer = 4;
                if (typeof showMessage === 'function') showMessage("A floresta começou a queimar!", "#e74c3c");
            }
        }

        if (tags.includes('FIRE') && targetHex.terrain.id === 'SNOW') {
            targetHex.terrain = TERRAINS.WATER; // Derrete
            if (typeof showMessage === 'function') showMessage("O gelo derreteu!", "#3498db");
        }

        // 3. GELO NA ÁGUA
        if (tags.includes('ICE') || tags.includes('FROST')) {
            if (targetHex.terrain.id === 'WATER' || targetHex.terrain.id === 'ELECTRIC_WATER') {
                let waterHexes = this.getContiguousHexes(targetHex, ['WATER', 'ELECTRIC_WATER']);
                for (let h of waterHexes) {
                    h.terrain = TERRAINS.SNOW; // Congela
                }
                if (typeof showMessage === 'function') showMessage("A água congelou!", "#00ffff");
                if (typeof sleep === 'function') await sleep(400);
            }
        }
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

        if (killer && killer.faction === 1 && victim.faction !== 1) { killer.addXp(victim.isBoss ? 100 : 30); let arts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : []; }


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

            // --- PROCESSAMENTO DE TERRENOS ELEMENTAIS (HAZARDS) ---
            this.map.forEach(h => {
                if (h.timer) {
                    h.timer--;
                    if (h.timer <= 0) {
                        // Volta para o dicionário original!
                        if (h.terrain.id === 'ELECTRIC_WATER') h.terrain = TERRAINS.WATER;
                        else if (h.terrain.id === 'BURNING_FOREST') h.terrain = TERRAINS.ASHES;
                    }
                }

                // Dano passivo de quem estiver em chamas no início da rodada
                let unitOnHex = this.getUnitAt(h.q, h.r);
                if (unitOnHex && unitOnHex.hp > 0 && h.terrain.id === 'BURNING_FOREST') {
                    unitOnHex.hp -= 15;
                    if (typeof showPopup === 'function') showPopup("-15 🔥", unitOnHex, '#e74c3c');
                    if (unitOnHex.hp <= 0) this.handleDeath(unitOnHex, { name: 'As Chamas', faction: -1 });
                }
            });

            if (!this.resources) this.resources = {};
            this.units.filter(u => u.faction === 1).forEach(u => {
                const hex = this.map.get(`${u.q},${u.r}`);
                if (hex) {
                    let resGained = null, icon = '', color = '';

                    if (hex.terrain.id === 'FOREST') { this.resources.wood = (this.resources.wood || 0) + 1; resGained = '+1 Madeira'; icon = '🌲'; color = '#27ae60'; }
                    else if (hex.terrain.id === 'MOUNTAIN') { this.resources.stone = (this.resources.stone || 0) + 1; resGained = '+1 Pedra'; icon = '⛰️'; color = '#95a5a6'; }
                    else if (hex.terrain.id === 'WATER') { this.resources.scales = (this.resources.scales || 0) + 1; resGained = '+1 Escama'; icon = '🐟'; color = '#3498db'; }
                    else if (hex.terrain.id === 'DESERT') { this.resources.sand = (this.resources.sand || 0) + 1; resGained = '+1 Areia'; icon = '⏳'; color = '#f1c40f'; }
                    else if (hex.terrain.id === 'DNA_DEPOSIT') { this.dna = (this.dna || 0) + 1; resGained = '+1 DNA'; icon = '🧬'; color = '#2ecc71'; }
                    else if (hex.terrain.id === 'GOLD_DEPOSIT') { this.gold = (this.gold || 0) + 5; resGained = '+5 Ouro'; icon = '💰'; color = '#f1c40f'; }
                    else if (hex.terrain.id === 'STONE_DEPOSIT') { this.resources.stone = (this.resources.stone || 0) + 5; resGained = '+5 Pedra'; icon = '🪨'; color = '#7f8c8d'; }
                    else if (hex.terrain.id === 'MANA_RIFT' && u.tags && u.tags.length > 0) { let primaryTag = u.tags[0]; this.manaPool[primaryTag] = (this.manaPool[primaryTag] || 0) + 1; resGained = '+1 Mana'; icon = '🔮'; color = '#9b59b6'; }

                    if (resGained && typeof showPopup === 'function') {
                        showPopup(`${icon} ${resGained}`, u, color);
                    }
                }
            });

            this.units.filter(u => u.faction === 1).forEach(u => { if (u.status === 'shielded') u.status = null; });
            this.units.forEach(u => {
                if (u._mcDuration !== undefined) {
                    u._mcDuration--;
                    if (u._mcDuration <= 0) {
                        u.faction = u._origFaction;
                        delete u._origFaction;
                        delete u._mcDuration;
                        if (typeof showPopup === 'function') showPopup("Controle Perdido!", u, '#9b59b6');
                    }
                }
            });
            this.currentTurn = 2;
            const tb = document.getElementById('turn-blocker');
            if (tb) tb.style.display = 'block';
            this.updateTurnUI(`Turno ${this.turnCount}: Inimigo`, 'var(--enemy-color)');
            this.processStatus(2);
            if (!this.gameOver) { try { if (typeof sleep === 'function') await sleep(800); if (typeof window.runAITurn === 'function') await window.runAITurn(); if (!this.gameOver) this.startNextTurn(); } catch (e) { console.error("ERRO NO TURNO INIMIGO:", e); if (typeof sleep === 'function') await sleep(1000); this.startNextTurn(); } }
        } else if (this.currentTurn === 2) {
            this.currentTurn = 0; this.updateTurnUI("Turno: Feras", 'var(--wild-color)'); this.processStatus(0);
            if (!this.gameOver) { try { if (typeof sleep === 'function') await sleep(600); if (typeof window.runWildTurn === 'function') await window.runWildTurn(); if (!this.gameOver) this.startNextTurn(); } catch (e) { console.error("ERRO NO TURNO FERAS:", e); if (typeof sleep === 'function') await sleep(1000); this.startNextTurn(); } }
        } else {
            this.currentTurn = 1;
            this.turnCount++;
            const tb = document.getElementById('turn-blocker');

            // ========================================================
            // CICLO ÉPICO DE 10 TURNOS
            // ========================================================
            let cycle = this.turnCount % 10;
            if (typeof showMessage === 'function') {
                if (cycle === 4) showMessage("O Pôr do Sol se aproxima...", "#e67e22");
                if (cycle === 6) showMessage("A Noite Caiu...", "#8e44ad");
                if (cycle === 9) showMessage("O Sol começa a nascer...", "#f1c40f");
                if (cycle === 1 && this.turnCount > 1) showMessage("O Dia está no ápice!", "#3498db");
            }

            if (tb) tb.style.display = 'none';
            this.updateTurnUI(`Turno ${this.turnCount}: Jogador`, 'var(--player-color)');
            this.processStatus(1);
            // ========================================================
            // ARTEFATOS ÔMEGA: EFEITOS DE INÍCIO DE TURNO (PLAYER)
            // ========================================================
            let omegaArts = typeof getActiveArtifacts === 'function' ? getActiveArtifacts() : [];
            if (omegaArts.length > 0) {
                let hasRoot = omegaArts.includes('art_omega_west');
                let hasCrown = omegaArts.includes('art_omega_east');
                let hasCore = omegaArts.includes('art_omega_se');
                let hasPearl = omegaArts.includes('art_omega_sw');
                let hasHalo = omegaArts.includes('art_omega_ne');

                // 1. APLICA OS BUFFS NAS SUAS FERAS VIVAS
                this.units.filter(u => u.faction === 1).forEach(u => {
                    u.bonusAttackUsed = false; // Reseta a trava de ataque duplo do turno anterior

                    // 🌋 NÚCLEO DERRETIDO: Imunidade a Fogo passiva
                    if (hasCore && !u.tags.includes('FIRE')) u.tags.push('FIRE');

                    // 🌊 PÉROLA DAS PROFUNDEZAS: Concede Mergulho global
                    if (hasPearl && !u.abilities.includes('dive')) u.abilities.push('dive');

                    // ⚡ AURÉOLA DA TORMENTA: Concede Voo global
                    if (hasHalo && !u.abilities.includes('flying')) u.abilities.push('flying');

                    // 🍃 RAIZ DO MUNDO SOMBRIO: Regeneração em massa
                    if (hasRoot) {
                        let hex = this.map.get(`${u.q},${u.r}`);
                        let isNature = hex && (hex.terrain.id === 'FOREST' || hex.terrain.id === 'SWAMP');
                        let healAmount = Math.floor(u.maxHp * (isNature ? 0.50 : 0.25));
                        if (u.hp < u.maxHp && u.hp > 0) {
                            u.hp = Math.min(u.maxHp, u.hp + healAmount);
                            if (typeof showPopup === 'function') showPopup(`+${healAmount} HP 🍃`, u, '#2ecc71');
                        }
                    }

                    // 👑 COROA DO SOL ESCALDANTE: +2 Movimento, Bater e Correr e Secar o Solo!
                    if (hasCrown) {
                        if (!u.baseMaxMpOriginal) u.baseMaxMpOriginal = u.maxMp;
                        u.maxMp = u.baseMaxMpOriginal + 2;
                        u.mp = u.maxMp;
                        if (!u.abilities) u.abilities = [];
                        if (!u.abilities.includes('hit_run')) u.abilities.push('hit_run');

                        let hex = this.map.get(`${u.q},${u.r}`);
                        if (hex && hex.terrain.id !== 'DESERT' && hex.terrain.id !== 'SAVANNA' && hex.terrain.id !== 'CASTLE') {
                            hex.terrain = TERRAINS.DESERT;
                            hex.timer = 0;
                        }
                    }
                });

                // 2. APLICA O MODO INFELIZ NOS INIMIGOS (🌋 NÚCLEO DERRETIDO)
                if (hasCore) {
                    this.units.filter(u => u.faction !== 1 && !u.abilities.includes('flying')).forEach(e => {
                        let hexE = this.map.get(`${e.q},${e.r}`);
                        if (hexE && hexE.terrain.id !== 'BURNING_FOREST' && hexE.terrain.id !== 'WATER' && hexE.terrain.id !== 'SEA') {
                            hexE.terrain = TERRAINS.BURNING_FOREST;
                            hexE.timer = 3; // O chão queima por 3 rodadas
                        }
                    });
                }
            }
            if (typeof resetSpentMana === 'function') resetSpentMana(); if (typeof collectMana === 'function') collectMana();
            for (let sid in this.spellCooldowns) { if (this.spellCooldowns[sid] > 0) this.spellCooldowns[sid]--; }
            this.selectPlayerLeader(); if (this.selectedUnit && renderer) renderer.centerOn(this.selectedUnit.vq, this.selectedUnit.vr);
        }

        this.updateFogOfWar(); // ATUALIZA A LUZ QUANDO O TURNO VIRA!
        if (typeof updateUI === 'function') updateUI(); if (renderer) renderer.draw();
        if (typeof updateUI === 'function') updateUI(); if (renderer) renderer.draw();
        if (renderer) renderer.draw();
    }

    processStatus(fId) {
        let sys = this.getSynergies(fId);
        if (sys['CELESTIAL'] >= 3) { this.units.filter(u => u.faction === fId && u.tags.includes('CELESTIAL')).forEach(cel => { Hex.getNeighbors(cel.q, cel.r).forEach(n => { let ally = this.getUnitAt(n.q, n.r); if (ally && ally.faction === fId) { let h = Math.min(ally.maxHp - ally.hp, 10); if (h > 0) { ally.hp += h; if (typeof showPopup === 'function') showPopup(`+${h}✨`, ally, '#fffbc2'); } ally.status = null; } }); }); }
        this.units.filter(u => u.faction === fId).forEach(u => {
            // Reseta a restrição do Apito
            u.hasUsedApitoThisTurn = false;

            // Dano Contínuo das Asas de Ícaro
            let hasIcarus = u.equipment && u.equipment.some(e => e.id === 'WINGS_ICARUS');
            if (hasIcarus && u.hp > 0) {
                u.hp -= 5;
                if (typeof showPopup === 'function') showPopup("-5 🪽", u, '#e74c3c');
                if (u.hp <= 0) this.handleDeath(u, { name: 'Maldição de Ícaro', faction: -1 });
            }

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

            if (u.status === 'stun') {
                if (u.statusHandled) { u.status = null; u.statusHandled = false; u.resetTurn(); }
                else { u.mp = 0; u.hasAttacked = true; u.statusHandled = true; if (typeof showPopup === 'function') showPopup("Zzz", u, '#f39c12'); }
            } else {
                u.resetTurn();
            }

            if (u.status === 'bind') {
                if (u.statusHandled) { u.status = null; u.statusHandled = false; }
                else { u.mp = 0; u.statusHandled = true; }
            }

            if (u.status === 'chilled') {
                if (u.statusHandled) { u.status = null; u.statusHandled = false; }
                else { u.mp = Math.max(0, u.mp - 2); u.statusHandled = true; if (typeof showPopup === 'function') showPopup("-2 Mov ❄️", u, '#00ffff'); }
            }
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
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.hexSize = 55;
        this.offsetX = 0;
        this.offsetY = 0;
        this.tileset = new Image();
        this.tileset.onload = () => { if (this.game) this.draw(); };
        this.tileset.src = 'img/tileset.png';
        window.addEventListener('resize', () => this.initCamera(false));
    }

    initCamera(force = false) {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // ==========================================
        // MÁGICA PIXEL ART: Deixa os sprites nítidos!
        // ==========================================
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;

        if (force || this.hexSize < 35) {
            const mapW = this.game.cols * Math.sqrt(3);
            const mapH = this.game.rows * 1.5 + 0.5;
            this.hexSize = Math.max(Math.min(this.canvas.width / mapW, this.canvas.height / mapH) * 0.75, 40);
        }
        let pL = this.game.units.find(u => u.isLeader && u.faction === 1);
        if (pL) this.centerOn(pL.vq, pL.vr); else this.draw();
    }
    getPosUnscaled(q, r) { return { x: this.hexSize * Math.sqrt(3) * (q + r / 2) + this.hexSize, y: this.hexSize * 1.5 * r + this.hexSize }; }
    getPos(q, r) { const u = this.getPosUnscaled(q, r); return { x: u.x + this.offsetX, y: u.y + this.offsetY }; }
    centerOn(q, r) { const p = this.getPosUnscaled(q, r); this.offsetX = (this.canvas.width / 2) - p.x; this.offsetY = (this.canvas.height / 2) - p.y; this.draw(); }

    hexPath(ctx, cx, cy, size) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i - 30); const px = cx + size * Math.cos(a); const py = cy + size * Math.sin(a); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.closePath(); }

    draw() {
        const ctx = this.ctx; const actBgColors = ['#0a0a0e', '#121208', '#050a15', '#100515', '#150505']; const bgColor = actBgColors[this.game.currentLevel - 1] || '#0a0a0e';
        ctx.fillStyle = bgColor; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;

        this.game.map.forEach(hex => {
            const p = this.getPos(hex.q, hex.r);

            // 1. APLICA A MÁSCARA (CLIP) PARA CORTAR O QUADRADO EM FORMATO HEXAGONAL
            ctx.save();
            this.hexPath(ctx, p.x, p.y, this.hexSize - 0.5);
            ctx.clip();

            let drawCustom = false;
            let currentImg = this.tileset;
            let tCols = 6, tRows = 12;
            let selectedTile = { x: 0, y: 0 };
            let hash = Math.abs((hex.q * 101) + (hex.r * 37));

            // CHECA SE É UM TERRENO COM SPRITE INDIVIDUAL
            if (hex.terrain && hex.terrain.customSprite) {
                if (!window.terrainCache) window.terrainCache = {};
                if (!window.terrainCache[hex.terrain.customSprite]) {
                    let img = new Image();
                    img.onload = () => { this.draw(); };
                    img.src = hex.terrain.customSprite;
                    window.terrainCache[hex.terrain.customSprite] = img;
                }
                currentImg = window.terrainCache[hex.terrain.customSprite];
                if (currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
                    drawCustom = true;
                    tCols = hex.terrain.cols || 6;
                    tRows = 1; // Sprites individuais têm apenas 1 linha
                    let varIndex = hash % tCols;
                    selectedTile = { x: varIndex, y: 0 };
                }
            }
            // SE NÃO FOR INDIVIDUAL, USA O TILESET PRINCIPAL
            else if (this.tileset && this.tileset.complete && this.tileset.naturalWidth > 0 && hex.terrain && hex.terrain.variations) {
                drawCustom = true;
                tCols = 6;
                tRows = 12;
                let varIndex = hex.customVar !== undefined ? hex.customVar : (hash % hex.terrain.variations.length);
                selectedTile = hex.terrain.variations[varIndex];
            }

            if (drawCustom) {
                let tileW = currentImg.naturalWidth / tCols;
                let tileH = currentImg.naturalHeight / tRows;

                let hexWidth = this.hexSize * Math.sqrt(3);
                let hexHeight = this.hexSize * 2;

                let zoom = 1.15;
                let drawW = hexWidth * zoom;
                let drawH = hexHeight * zoom;

                // AJUSTE VERTICAL: Sobe a imagem em 15% para centralizar perfeitamente no Hexágono!
                let offsetY = this.hexSize * 0.15;

                ctx.drawImage(
                    currentImg,
                    selectedTile.x * tileW, selectedTile.y * tileH, tileW, tileH,
                    p.x - (drawW / 2), p.y - (drawH / 2) - offsetY, drawW, drawH
                );
            } else {
                ctx.fillStyle = (hex.terrain && hex.terrain.color) ? hex.terrain.color : '#000';
                ctx.fill();
            }
            ctx.restore(); // Finaliza a máscara

            // 2. DESENHA A BORDA E OS EFEITOS (Fora da máscara)
            this.hexPath(ctx, p.x, p.y, this.hexSize - 0.5);

            if (hex.isCrystal) { ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = 'rgba(0,255,255,0.2)'; ctx.fill(); }
            if (this.game.reachableHexes.has(hex.getKey())) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.stroke(); }
            else {
                // Borda super suave (Espessura 0.5 e Opacidade 15%)
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.lineWidth = 3;
                ctx.stroke();

            }
            if (hex.hasPremiumLure) {
                ctx.font = `${this.hexSize * 0.7}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText("🥩", p.x, p.y + (this.hexSize * 0.2));
            } else if (hex.hasLure) {
                ctx.font = `${this.hexSize * 0.7}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText("🍖", p.x, p.y + (this.hexSize * 0.2));
            }
            if (hex.hasStunTrap) { ctx.font = `${this.hexSize * 0.5}px sans-serif`; ctx.fillText("⚡", p.x, p.y + (this.hexSize * 0.2)); }
            if (hex.hasTeleportTrap) { ctx.font = `${this.hexSize * 0.5}px sans-serif`; ctx.fillText("🌀", p.x, p.y + (this.hexSize * 0.2)); }
            if (hex.terrain.id === 'VILLAGE' && hex.owner !== null) { ctx.fillStyle = hex.owner === 1 ? '#4a9edd' : '#c0392b'; ctx.beginPath(); ctx.arc(p.x + this.hexSize * 0.4, p.y - this.hexSize * 0.3, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }

        });

        this.game.items.forEach((iType, key) => { let [q, r] = key.split(',').map(Number); const p = this.getPos(q, r); ctx.save(); ctx.globalAlpha = 1.0; ctx.beginPath(); ctx.ellipse(p.x, p.y + this.hexSize * 0.35, this.hexSize * 0.4, this.hexSize * 0.2, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,20,30,0.9)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#f1c40f'; ctx.stroke(); ctx.font = `${this.hexSize * 0.6}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (typeof ITEMS !== 'undefined' && ITEMS[iType]) { ctx.fillText(ITEMS[iType].icon, p.x, p.y + this.hexSize * 0.25); } ctx.restore(); });

        const su = this.game.selectedUnit;
        if (this.game.activeSpell && su && this.game.currentTurn === 1) {
            const spell = typeof SPELLS !== 'undefined' ? SPELLS.find(s => s.id === this.game.activeSpell) : null;
            if (spell) {
                let spRange = spell.range !== undefined ? spell.range : 99; let isGlobal = ['sl_regen', 'sl_shadow_step', 'sl_primal_rage', 'sl_sandstorm', 'sl_inferno', 'sl_blizzard', 'sl_mass_venom', 'sl_storm_wing', 'sl_meteor', 'sl_tidal_wave', 'sl_apocalypse', 'sl_world_freeze', 'sl_soul_harvest', 'sl_phoenix_rebirth'].includes(spell.id); let targets = [];
                if (isGlobal) { targets = spell.type === 'def' ? this.game.units.filter(u => u.faction === 1) : this.game.units.filter(u => u.faction !== 1); } else if (spRange === 0) { targets = [su]; } else { this.game.map.forEach(hex => { if (Hex.distance(su, hex) <= spRange) { const p = this.getPos(hex.q, hex.r); this.hexPath(ctx, p.x, p.y, this.hexSize - 1); ctx.fillStyle = spell.type === 'def' ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)'; ctx.fill(); } }); if (spell.id === 'sl_resurrection') { Hex.getNeighbors(su.q, su.r).forEach(n => { if (this.game.map.has(`${n.q},${n.r}`) && !this.game.getUnitAt(n.q, n.r)) { targets.push({ vq: n.q, vr: n.r }); } }); } else if (spell.type === 'atk') { targets = this.game.units.filter(u => u.faction !== 1 && u.hp > 0 && Hex.distance(su, u) <= spRange); } else { targets = this.game.units.filter(u => u.faction === 1 && u.hp > 0 && Hex.distance(su, u) <= spRange); } }
                let fCol = spell.type === 'def' ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)'; let sCol = spell.type === 'def' ? 'rgba(46,204,113,0.9)' : 'rgba(231,76,60,0.9)'; targets.forEach(t => { const p = this.getPos(t.vq, t.vr); this.hexPath(ctx, p.x, p.y, this.hexSize - 1); ctx.fillStyle = fCol; ctx.fill(); ctx.strokeStyle = sCol; ctx.lineWidth = 2.5; ctx.stroke(); });
            }
        }

        if (this.game.activeItem && su && su.isLeader) {
            let range = this.game.itemRange;
            this.game.map.forEach(hex => {
                if (Hex.distance(su, hex) <= range) {
                    const p = this.getPos(hex.q, hex.r);
                    this.hexPath(ctx, p.x, p.y, this.hexSize - 1);
                    ctx.fillStyle = 'rgba(80, 82, 255, 0.9)'; // Cor especial para Itens
                    ctx.fill(); ctx.strokeStyle = 'rgba(155,89,182,0.8)'; ctx.lineWidth = 2; ctx.stroke();
                }
            });
        }
        if (su && this.game.currentTurn === 1 && !this.game.activeSpell) {
            this.game.units.forEach(tg => {
                if (tg.faction !== 1 && Hex.distance(su, tg) <= su.getEffectiveRange(game) && !su.hasAttacked) { const isTame = this.game.tameMode && tg.faction === 0 && Hex.distance(su, tg) === 1; const p = this.getPos(tg.vq, tg.vr); this.hexPath(ctx, p.x, p.y, this.hexSize - 1); ctx.fillStyle = isTame ? 'rgba(155,89,182,0.35)' : 'rgba(192,57,43,0.35)'; ctx.fill(); ctx.strokeStyle = isTame ? 'rgba(155,89,182,0.9)' : 'rgba(231,76,60,0.85)'; ctx.lineWidth = 2; ctx.stroke(); }
            });
            const sp = this.getPos(su.vq, su.vr); this.hexPath(ctx, sp.x, sp.y, this.hexSize - 1); ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2.5; ctx.stroke();
        } else if (!su && this.game.selectedHex) { const sh = this.getPos(this.game.selectedHex.q, this.game.selectedHex.r); this.hexPath(ctx, sh.x, sh.y, this.hexSize - 1); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke(); }

        this.game.units.forEach(u => {
            const p = this.getPos(u.vq, u.vr);
            const fColor = u.faction === 1 ? '#3498db' : u.faction === 2 ? '#e74c3c' : '#2ecc71';

            // DETECTOR SUPREMO: Verifica se o nome da unidade pertence ao panteão de Bosses Reais
            let isRealBoss = typeof BEASTS !== 'undefined' && BEASTS.BOSSES && BEASTS.BOSSES.some(b => b.name === u.name);

            // Define as escalas perfeitas: Boss Real = 1.38, Elite = 1.22, Heróis/Líderes comuns = 1.30, Outros = 1.0
            let sMod = isRealBoss ? 1.38 : (u.isElite ? 1.22 : (u.isLeader ? 1.30 : 1.0));

            // Bônus de tamanho para capangas comuns que sobem de nível
            if (u.level > 1 && !u.isLeader && !isRealBoss && !u.isElite) sMod += 0.10;

            const r = this.hexSize * 0.6 * sMod;

            // ==========================================
            // NOVO PEDESTAL / AURA DE FACÇÃO (Estilo RTS)
            // ==========================================
            // Ancoramos o anel exatamente na base (chão) do hexágono
            let baseY = p.y + (this.hexSize * 0.55);

            // 1. Sombra Escura Projetada no chão
            ctx.beginPath();
            ctx.ellipse(p.x, baseY, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fill();

            // 2. Anel Luminoso de Facção
            ctx.beginPath();
            ctx.ellipse(p.x, baseY, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
            ctx.lineWidth = u.isLeader ? 3 : 1.5;
            ctx.strokeStyle = fColor;
            ctx.stroke();

            // 3. Preenchimento Mágico (Brilho suave radial)
            let aura = ctx.createRadialGradient(p.x, baseY, 0, p.x, baseY, r);
            let hexToRgb = (hex) => {
                let bigint = parseInt(hex.replace('#', ''), 16);
                return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
            };
            aura.addColorStop(0, `rgba(${hexToRgb(fColor)}, 0.4)`); // Brilho interno
            aura.addColorStop(1, 'transparent'); // Esmaece nas bordas
            ctx.fillStyle = aura;
            ctx.fill();

            // 4. Indicador de Status Negativos
            if (u.status === 'poison') { ctx.fillStyle = 'rgba(39,174,96,0.4)'; ctx.fill(); }
            else if (u.status === 'stun' || u.status === 'bind' || u.status === 'chilled') { ctx.fillStyle = 'rgba(241,196,15,0.4)'; ctx.fill(); }
            else if (u.status === 'shielded') { ctx.fillStyle = 'rgba(149,165,166,0.4)'; ctx.fill(); }
            // ==========================================

            ctx.save(); ctx.globalAlpha = 1.0; ctx.font = `${this.hexSize * sMod * 0.85}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            if (u.hitTimer) ctx.filter = 'brightness(50%) sepia(100%) hue-rotate(-50deg) saturate(500%)'; else if (u.filter !== 'none') ctx.filter = u.filter;

            // ==========================================
            // SISTEMA DE SPRITES (TAMANHO MÁXIMO GARANTIDO)
            // ==========================================
            let uiTopY = p.y - r;

            if (u.sprite) {
                if (!window.imageCache) window.imageCache = {};

                if (!window.imageCache[u.sprite]) {
                    // Coloca uma trava temporária para evitar loops de carregamento
                    window.imageCache[u.sprite] = "LOADING";

                    let img = new Image();
                    img.onload = () => {
                        try {
                            let imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                            let data = imgData.data;

                            // Coleta a cor exata do fundo lendo o primeiríssimo pixel (superior esquerdo)
                            let bgR = data[0];
                            let bgG = data[1];
                            let bgB = data[2];

                            // Margem de tolerância para pequenas variações do cinza
                            let tolerance = 20;

                            // Varre a imagem inteira trocando a cor de fundo por transparência
                            for (let i = 0; i < data.length; i += 4) {
                                let r = data[i];
                                let g = data[i + 1];
                                let b = data[i + 2];

                                if (Math.abs(r - bgR) < tolerance &&
                                    Math.abs(g - bgG) < tolerance &&
                                    Math.abs(b - bgB) < tolerance) {
                                    data[i + 3] = 0; // Transparência absoluta!
                                }
                            }
                            tempCtx.putImageData(imgData, 0, 0);
                            // Guarda o canvas processado e limpo no cache do jogo
                            window.imageCache[u.sprite] = tempCanvas;
                        } catch (e) {
                            // Caso dê erro de CORS local, mantém a imagem original como fallback
                            window.imageCache[u.sprite] = img;
                        }
                        this.draw();
                    };
                    img.onerror = () => {
                        window.imageCache[u.sprite] = "ERROR";
                    };
                    img.src = u.sprite;
                }

                let cachedAsset = window.imageCache[u.sprite];
                // Verifica se o asset já foi processado e está pronto
                if (cachedAsset && cachedAsset !== "LOADING" && cachedAsset !== "ERROR") {
                    let isRealBoss = typeof BEASTS !== 'undefined' && BEASTS.BOSSES && BEASTS.BOSSES.some(b => b.name === u.name);
                    let isEpicMonster = isRealBoss || u.isElite;

                    let maxW = this.hexSize * (isEpicMonster ? 2.1 : 1.25) * sMod;
                    let maxH = this.hexSize * (isEpicMonster ? 2.4 : 1.5) * sMod;

                    // Funciona perfeitamente tanto com Image quanto com Canvas processado
                    let naturalW = cachedAsset.naturalWidth || cachedAsset.width;
                    let naturalH = cachedAsset.naturalHeight || cachedAsset.height;

                    let scale = Math.min(maxW / naturalW, maxH / naturalH);

                    let drawW = naturalW * scale;
                    let drawH = naturalH * scale;

                    let spriteY = p.y + (this.hexSize * 0.60) - drawH;

                    // ==========================================
                    // SISTEMA DE ESCALA INDIVIDUAL DO SPRITE (AO VIVO)
                    // ==========================================
                    // 1. Vasculha o banco de dados em tempo real atrás da ficha original do monstro
                    let masterPool = typeof BEASTS !== 'undefined' ? [...(BEASTS.LAND||[]), ...(BEASTS.WATER||[]), ...(BEASTS.SNOW||[]), ...(BEASTS.BOSSES||[])] : [];
                    let template = masterPool.find(x => x.name === (u.baseName || u.name));
                    if (!template && u.isLeader && typeof LEADERS !== 'undefined') template = LEADERS.find(x => x.name === (u.baseName || u.name));
                    
                    // 2. Aplica a escala direto do data.js (substitui o save antigo!)
                    let customScale = (template && template.scale) ? template.scale : (u.scale || 1);
                    
                    let finalW = drawW * customScale;
                    let finalH = drawH * customScale;

                    // Ajuste matemático vital: Faz o sprite crescer "para cima" e pros lados, 
                    // mantendo a base (os pés) presa no chão do hexágono!
                    let finalX = p.x - (finalW / 2);
                    let finalY = spriteY - (finalH - drawH);

                    // EFEITO DE DESTAQUE (Sombra)
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
                    ctx.shadowBlur = 12;
                    ctx.shadowOffsetY = 6;

                    // Carimba o sprite com o tamanho e posições corrigidas!
                    ctx.drawImage(cachedAsset, finalX, finalY, finalW, finalH);

                    // RESET DE SOMBRA
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetY = 0;
                    uiTopY = spriteY - 5;
                } else if (cachedAsset !== "LOADING") {
                    ctx.fillText(u.emoji, p.x, p.y + 1);
                }
            } else {
                ctx.fillText(u.emoji, p.x, p.y + 1);
            }
            ctx.restore();

            // ==========================================
            // INTERFACE 
            // ==========================================
            // Coroa do Líder (Livre no topo!)
            if (u.isLeader) { ctx.font = `${this.hexSize * 0.5}px Arial`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'center'; ctx.fillText('👑', p.x, uiTopY); }

            // Alertas e Magias
            if (u.faction === 0 && u.alerted) { ctx.font = `bold ${this.hexSize * 0.45}px Arial`; ctx.fillStyle = '#e74c3c'; ctx.textAlign = 'center'; ctx.fillText('⚠️', p.x + r - 5, uiTopY + 5); }
            if (u.faction === 1 && (u.knownSpells || []).length > 0) { ctx.font = `${this.hexSize * 0.35}px Arial`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'right'; ctx.fillText('✨', p.x + r - 2, uiTopY + 8); }

            // --- BARRA DE HP VERTICAL (DIREITA DO HEXÁGONO) ---
            // Calcula a altura da barra baseada no HP Máximo (Cresce com a vida do personagem!)
            const barHeight = Math.min(this.hexSize * 1.6, Math.max(this.hexSize * 0.6, this.hexSize * 0.5 + (u.maxHp / 50) * 12));
            const barWidth = 5;
            const barX = p.x + (this.hexSize * 0.65); // Empurrado para a direita
            const barY = p.y - (barHeight / 2) + (this.hexSize * 0.1);
            const hpRatio = u.hp / u.maxHp;

            // Fundo da barra
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.beginPath(); ctx.roundRect(barX, barY, barWidth, barHeight, 2); ctx.fill();

            // Preenchimento de Vida (Cresce de baixo para cima!)
            const hpColor = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
            ctx.fillStyle = hpColor;
            const fillHeight = Math.max(1, barHeight * hpRatio);
            ctx.beginPath(); ctx.roundRect(barX, barY + barHeight - fillHeight, barWidth, fillHeight, 2); ctx.fill();

            // --- NÍVEL E ESTRELAS (ESQUERDA DO HEXÁGONO) ---
            let starIcon = u.starLevel === 2 ? '🥉' : u.starLevel === 3 ? '🥈' : u.starLevel >= 4 ? '🌟' : '';
            if (u.level > 1 || starIcon) {
                ctx.font = 'bold 11px Cinzel,serif';
                ctx.fillStyle = '#c9a227';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`Lv${u.level}${starIcon}`, p.x - (this.hexSize * 0.65), p.y + (this.hexSize * 0.25));
            }
        });

        // ========================================================
        // FILTROS VISUAIS E ILUMINAÇÃO DINÂMICA (CICLO DE 10 TURNOS)
        // ========================================================
        let cycle = (this.game && this.game.turnCount !== undefined) ? (this.game.turnCount % 10) : 1;
        let overlayColor = null;
        let isDarkPhase = false;

        // 1 a 3: Dia | 4 a 5: Pôr do Sol | 6 a 8: Noite | 9 e 0: Amanhecer
        if (cycle >= 1 && cycle <= 3) { overlayColor = 'rgba(255, 245, 220, 0.05)'; } // Dia (Filtro quente e suave)
        else if (cycle === 4 || cycle === 5) { overlayColor = 'rgba(211, 84, 0, 0.25)'; isDarkPhase = true; } // Pôr do Sol
        else if (cycle >= 6 && cycle <= 8) { overlayColor = 'rgba(10, 15, 30, 0.75)'; isDarkPhase = true; } // Noite
        else if (cycle === 9 || cycle === 0) { overlayColor = 'rgba(241, 196, 15, 0.15)'; } // Amanhecer

        if (overlayColor) {
            if (!this.lightCanvas) {
                this.lightCanvas = document.createElement('canvas');
                this.lightCtx = this.lightCanvas.getContext('2d');
            }
            if (this.lightCanvas.width !== this.canvas.width || this.lightCanvas.height !== this.canvas.height) {
                this.lightCanvas.width = this.canvas.width;
                this.lightCanvas.height = this.canvas.height;
            }

            let lctx = this.lightCtx;

            // 1. Pinta o canvas fantasma com a atmosfera
            lctx.globalCompositeOperation = 'source-over';
            lctx.clearRect(0, 0, this.lightCanvas.width, this.lightCanvas.height);
            lctx.fillStyle = overlayColor;
            lctx.fillRect(0, 0, this.lightCanvas.width, this.lightCanvas.height);

            // 2. A Borracha Mágica SÓ entra em ação se estiver escurecendo!
            if (isDarkPhase) {
                lctx.globalCompositeOperation = 'destination-out';

                this.game.units.forEach(u => {
                    if (u.faction === 1 || (u.tags && (u.tags.includes('FIRE') || u.tags.includes('CELESTIAL') || u.tags.includes('ELECTRIC')))) {
                        const p = this.getPos(u.vq, u.vr);
                        let lightRadius = this.hexSize * 2.5;
                        if (u.tags && (u.tags.includes('FIRE') || u.tags.includes('CELESTIAL'))) lightRadius = this.hexSize * 3.5;

                        let grad = lctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, lightRadius);
                        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                        grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.8)');
                        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                        lctx.fillStyle = grad; lctx.beginPath(); lctx.arc(p.x, p.y, lightRadius, 0, Math.PI * 2); lctx.fill();
                    }
                });

                this.game.map.forEach(h => {
                    if (h.terrain && (h.terrain.id === 'LAVA_RIFT' || h.terrain.id === 'BURNING_FOREST')) {
                        const p = this.getPos(h.q, h.r);
                        let lightRadius = this.hexSize * 2.5;
                        let grad = lctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, lightRadius);
                        grad.addColorStop(0, 'rgba(0, 0, 0, 0.9)'); grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                        lctx.fillStyle = grad; lctx.beginPath(); lctx.arc(p.x, p.y, lightRadius, 0, Math.PI * 2); lctx.fill();
                    }
                });
            }

            // 3. Carimba por cima do jogo
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(this.lightCanvas, 0, 0);
            ctx.restore();
        }

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

        // --- CARREGANDO O TILESET NO REINO ---
        this.tileset = new Image();
        this.tileset.onload = () => { if (this.game) this.draw(); };

        // MUITO IMPORTANTE: Coloque o mesmo nome de arquivo que você usou no outro mapa!
        this.tileset.src = 'img/tileset.png';

        window.addEventListener('resize', () => this.initCamera());
    }

    initCamera() {
        // Ajusta o canvas para o tamanho do container
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;

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

            // 1. APLICA A MÁSCARA (CLIP) PARA CORTAR O QUADRADO EM FORMATO HEXAGONAL
            ctx.save();
            this.hexPath(ctx, p.x, p.y, this.hexSize - 0.5);
            ctx.clip();

            let drawCustom = false;
            let currentImg = this.tileset;
            let tCols = 6, tRows = 12;
            let selectedTile = { x: 0, y: 0 };
            let hash = Math.abs((hex.q * 101) + (hex.r * 37));

            // CHECA SE É UM TERRENO COM SPRITE INDIVIDUAL
            if (hex.terrain && hex.terrain.customSprite) {
                if (!window.terrainCache) window.terrainCache = {};
                if (!window.terrainCache[hex.terrain.customSprite]) {
                    let img = new Image();
                    img.onload = () => { this.draw(); };
                    img.src = hex.terrain.customSprite;
                    window.terrainCache[hex.terrain.customSprite] = img;
                }
                currentImg = window.terrainCache[hex.terrain.customSprite];
                if (currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
                    drawCustom = true;
                    tCols = hex.terrain.cols || 6;
                    tRows = 1; // Sprites individuais têm apenas 1 linha
                    let varIndex = hash % tCols;
                    selectedTile = { x: varIndex, y: 0 };
                }
            }
            // SE NÃO FOR INDIVIDUAL, USA O TILESET PRINCIPAL
            else if (this.tileset && this.tileset.complete && this.tileset.naturalWidth > 0 && hex.terrain && hex.terrain.variations) {
                drawCustom = true;
                tCols = 6;
                tRows = 12;
                let varIndex = hex.customVar !== undefined ? hex.customVar : (hash % hex.terrain.variations.length);
                selectedTile = hex.terrain.variations[varIndex];
            }

            if (drawCustom) {
                let tileW = currentImg.naturalWidth / tCols;
                let tileH = currentImg.naturalHeight / tRows;

                let hexWidth = this.hexSize * Math.sqrt(3);
                let hexHeight = this.hexSize * 2;

                let zoom = 1.15;
                let drawW = hexWidth * zoom;
                let drawH = hexHeight * zoom;

                // AJUSTE VERTICAL: Sobe a imagem em 15% para centralizar perfeitamente no Hexágono!
                let offsetY = this.hexSize * 0.15;

                ctx.drawImage(
                    currentImg,
                    selectedTile.x * tileW, selectedTile.y * tileH, tileW, tileH,
                    p.x - (drawW / 2), p.y - (drawH / 2) - offsetY, drawW, drawH
                );
            } else {
                ctx.fillStyle = (hex.terrain && hex.terrain.color) ? hex.terrain.color : '#000';
                ctx.fill();
            }
            ctx.restore(); // Finaliza a máscara

            // 2. Bordas Suaves do Reino (Finas e quase transparentes!)
            this.hexPath(ctx, p.x, p.y, this.hexSize - 1);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = 0.5;
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
        if (game.gameOver) return;
        if (u.mp === 0 && u.hasAttacked) continue;

        if (renderer) { renderer.centerOn(u.vq, u.vr); renderer.draw(); }
        game.selectedUnit = u; if (typeof sleep === 'function') await sleep(300);
        game.calculateReachable(u);

        let myM = game.units.filter(x => x.faction === u.faction && !x.isLeader).length;
        let isSafe = u.hp / u.maxHp > 0.4;

        // --- 1. DEFINIÇÃO DE PRIORIDADE DE ALVO ---
        let pUnits = game.units.filter(t => t.faction === 1);
        let wUnits = game.units.filter(t => t.faction === 0);

        // Prioridade Suprema: Jogador quase morto (<= 35% HP ou letalidade direta)
        let priorityTarget = pUnits.find(p => (p.hp / p.maxHp <= 0.35) || (p.hp <= u.atk));
        let intent = priorityTarget ? 'attack' : 'none';

        // Segunda Prioridade: Domar criatura com 70%+ de chance de captura
        if (!priorityTarget && u.isLeader && myM < maxL) {
            let bestChance = 0;
            let bestWild = null;
            wUnits.forEach(w => {
                let chance = typeof game.calculateTameChance === 'function' ? game.calculateTameChance(u, w) : 0;
                if (chance >= 0.7 && chance > bestChance) {
                    bestChance = chance;
                    bestWild = w;
                }
            });
            if (bestWild) {
                priorityTarget = bestWild;
                intent = 'tame';
            }
        }

        // Alvo Padrão: O mais próximo
        if (!priorityTarget) {
            let minD = 999;
            let tgts = pUnits.concat(u.isLeader && myM < maxL ? wUnits : []);
            tgts.forEach(t => {
                let d = Hex.distance(u, t);
                if (t.faction === 0) {
                    if (isSafe) d -= 3;
                    else d += 10;
                }
                if (d < minD) { minD = d; priorityTarget = t; intent = t.faction === 0 ? 'tame' : 'attack'; }
            });
        }

        let cls = priorityTarget;

        // --- 2. MOVIMENTAÇÃO RUMO À PRIORIDADE ---
        if (cls && u.mp > 0) {
            const moves = Array.from(game.reachableHexes.keys());
            let bM = { q: u.q, r: u.r }; let bestScore = -9999;
            moves.forEach(m => {
                const [mq, mr] = m.split(',').map(Number);
                if (game.getUnitAt(mq, mr) && (mq !== u.q || mr !== u.r)) return;
                let distToTarget = Hex.distance({ q: mq, r: mr }, cls);
                let score = -distToTarget * 10;

                // Se o alvo for alcançável de onde parou, a posição ganha pontuação extrema!
                if (distToTarget > 0 && distToTarget <= u.getEffectiveRange(game)) {
                    score += 1000; score += distToTarget * 5;
                }
                let hMap = game.map.get(m);
                if (hMap && hMap.terrain.id === 'VILLAGE' && hMap.owner !== 2) score += 20;
                if (score > bestScore) { bestScore = score; bM = { q: mq, r: mr }; }
            });

            if (bM.q !== u.q || bM.r !== u.r) {
                u.mp -= (game.reachableHexes.get(`${bM.q},${bM.r}`) || 1);
                await game.moveUnit(u, bM.q, bM.r);
            }
        }

        // --- 3. DECISÃO DE MAGIA (Líderes mantêm o turno ao conjurar) ---
        if (u.knownSpells && u.knownSpells.length > 0) {
            for (let sid of u.knownSpells) {
                if (game.spellCooldowns[sid] > 0) continue;
                let sp = typeof SPELLS !== 'undefined' ? SPELLS.find(s => s.id === sid) : null;
                if (!sp) continue;

                let spRange = sp.range !== undefined ? sp.range : 99;
                let target = null;
                let targetHex = null;

                if (sp.type === 'atk') {
                    let inRange = game.units.filter(t => t.faction !== u.faction && t.hp > 0 && Hex.distance(u, t) <= spRange);
                    // Foca a magia ofensiva na prioridade, se estiver no alcance
                    if (inRange.includes(priorityTarget) && intent === 'attack') target = priorityTarget;
                    else if (inRange.length > 0) target = inRange[Math.floor(Math.random() * inRange.length)];
                } else if (sp.type === 'def') {
                    let inRange = game.units.filter(t => t.faction === u.faction && t.hp > 0 && t.hp < t.maxHp && Hex.distance(u, t) <= spRange);
                    if (inRange.length > 0) target = inRange[Math.floor(Math.random() * inRange.length)];
                }

                if (target) {
                    targetHex = game.map.get(`${target.q},${target.r}`);
                    game.isAnimating = true;
                    try {
                        let ok = await sp.effect(game, u, target, targetHex);
                        if (ok) {
                            // --- CHAMA A REAÇÃO ELEMENTAL AUTOMÁTICA ---
                            if (sp.tags) await game.triggerElementalReaction(targetHex, sp.tags);
                            if (typeof showPopup === 'function') showPopup(`✨ ${sp.name}!`, u, '#9b59b6');
                            game.spellCooldowns[sid] = sp.level > 1 ? sp.level : 2;

                            // A CORREÇÃO: O líder adversário agora registra a magia mas não perde a ação física!
                            if (u.isLeader) {
                                u.spellsCast = (u.spellsCast || 0) + 1;
                            } else {
                                u.hasAttacked = true;
                                u.mp = 0;
                            }
                            if (typeof sleep === 'function') await sleep(800);
                        }
                    } catch (e) { console.error("Erro magia IA:", e); }

                    game.isAnimating = false;
                    break;
                }
            }
        }

        // --- 4. AÇÃO FÍSICA / DOMA ---
        if (!u.hasAttacked && cls && Hex.distance(u, cls) <= u.getEffectiveRange(game)) {
            if (u.isLeader && cls.faction === 0 && Hex.distance(u, cls) === 1) {
                let chance = typeof game.calculateTameChance === 'function' ? game.calculateTameChance(u, cls) : 0;

                // Tenta domar baseado na intenção primária definida no passo 1
                if (intent === 'tame' || chance >= 0.7 || (cls.hp / cls.maxHp <= 0.3 && myM < maxL)) {
                    await game.attemptTame(u, cls);
                } else {
                    await game.executeCombat(u, cls);
                }
            } else {
                let risk = false;
                // A IA avalia o contra-ataque antes de bater à toa
                if (u.isLeader && intent !== 'attack' && !priorityTarget) {
                    let cDmg = Math.floor(game.calcDmg(cls, u) * 0.6);
                    if (cls.abilities.includes('counter')) cDmg = Math.floor(cDmg * 1.2);
                    if (u.hp <= cDmg) risk = true;
                }
                if (!risk) await game.executeCombat(u, cls);
            }
        }

        if (typeof sleep === 'function') await sleep(200);
    }
    game.selectedUnit = null;
};

window.runWildTurn = async function () {
    const wilds = game.units.filter(u => u.faction === 0);
    // Feras sentem o cheiro da isca e entram em estado de alerta
    wilds.forEach(w => {
        if (!w.alerted) {
            game.map.forEach(h => {
                if (h.hasLure && Hex.distance(w, h) <= 5) {
                    w.alerted = true;
                    if (typeof showPopup === 'function') showPopup("Farejou Isca!", w, '#e67e22');
                }
            });
            // O Boss detecta quem chega a 5 hexágonos de distância!
            if (w.isBoss && !w.alerted) {
                game.units.forEach(u => {
                    if (u.faction !== 0 && Hex.distance(w, u) <= 5) {
                        w.alerted = true;
                        if (typeof showPopup === 'function') showPopup("Invasores!", w, '#e74c3c');
                    }
                });
            }
        }
    });

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
