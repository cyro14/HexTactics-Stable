// ==========================================
// VARIÁVEIS GLOBAIS E UTILITÁRIOS
// ==========================================
const $ = id => document.getElementById(id);
const hide = id => $(id).classList.add('hidden');
const show = id => $(id).classList.remove('hidden');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const toRoman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || n;

let activeArtifactsCamp = [], activeArtifactsRogue = [], stats = { maxLevel: 1, wins: 0, losses: 0 }, rosterMemory = [], deployedRoster = [], unlockedBeasts = [], shopItems = [], game, renderer, lastState = null;
let reliquaryViewMode = 'camp';

const getActiveArtifacts = () => { return (game && game.isRoguelite) ? activeArtifactsRogue : activeArtifactsCamp; };

// ==========================================
// DADOS DO JOGO (TERRENOS, TAGS E MAGIAS)
// ==========================================
// ==========================================
// DADOS DO JOGO: TERRENOS (SISTEMA QUADRADO COM VARIAÇÕES)
// ==========================================
// Assumindo um Tileset de 4 Colunas x 11 Linhas.
// Cada linha é um terreno, cada coluna é uma variação visual daquele terreno.

// ==========================================
// DADOS DO JOGO: TERRENOS (Mapeamento Imagem IA 4x11)
// ==========================================

// ==========================================
// DADOS DO JOGO: TERRENOS (Mapeamento Imagem 6x11)
// ==========================================

const TERRAINS = {
    // Linha 0: Planície
    PLAINS: { id: 'PLAINS', name: 'Planície', cost: 1, def: 0.00, color: '#5b8c42', icon: '🌿', variations: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }] },

    // Linha 1: Floresta
    FOREST: { id: 'FOREST', name: 'Floresta', cost: 2, def: 0.20, color: '#1e4d2b', icon: '🌲', variations: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }] },

    // Linha 2: Montanha
    MOUNTAIN: { id: 'MOUNTAIN', name: 'Montanha', cost: 3, def: 0.40, color: '#5b5b5b', icon: '⛰️', variations: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }] },

    // Linha 3: Água (Lago)
    WATER: { id: 'WATER', name: 'Lago', cost: 2, def: -0.10, color: '#3498db', icon: '💧', variations: [{ x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }] },

    // Linha 4: Mar (Água Funda)
    SEA: { id: 'SEA', name: 'Mar', cost: 3, def: -0.20, color: '#2980b9', icon: '🌊', variations: [{ x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }] },

    // Linha 5: Deserto
    DESERT: { id: 'DESERT', name: 'Deserto', cost: 2, def: 0.00, color: '#e6c86e', icon: '🏜️', variations: [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }] },

    // Linha 6: Neve
    SNOW: { id: 'SNOW', name: 'Neve', cost: 2, def: -0.15, color: '#cce6f4', icon: '❄️', variations: [{ x: 0, y: 6 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }] },

    // Linha 7: Pântano
    SWAMP: { id: 'SWAMP', name: 'Pântano', cost: 2, def: 0.10, color: '#3b5323', icon: '🐸', variations: [{ x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }] },

    // Linha 8: Vila
    VILLAGE: { id: 'VILLAGE', name: 'Vila', cost: 1, def: 0.20, color: '#c49a45', icon: '🏘️', variations: [{ x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }] },

    // Linha 9: Castelo
    CASTLE: { id: 'CASTLE', name: 'Castelo', cost: 1, def: 0.60, color: '#3d444a', icon: '🏰', variations: [{ x: 0, y: 9 }, { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 }] },

    // Linha 10: Savana
    SAVANNA: { id: 'SAVANNA', name: 'Savana', cost: 1, def: 0.05, color: '#d4a373', icon: '🦁', variations: [{ x: 0, y: 10 }, { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 10 }] },

    // Linha 11: Floresta em Chamas
    BURNING_FOREST: { id: 'BURNING_FOREST', name: 'Floresta em Chamas', cost: 2, def: -0.50, color: '#d35400', icon: '🔥', variations: [{ x: 0, y: 11 }, { x: 1, y: 11 }, { x: 2, y: 11 }, { x: 3, y: 11 }, { x: 4, y: 11 }, { x: 5, y: 11 }] },

    // Linha 12 (Reaproveitando a linha 11 do sprite!): Cinzas
    ASHES: { id: 'ASHES', name: 'Cinzas', cost: 2, def: -0.50, color: '#444444', icon: '💨', variations: [{ x: 0, y: 11 }, { x: 1, y: 11 }, { x: 2, y: 11 }, { x: 3, y: 11 }, { x: 4, y: 11 }, { x: 5, y: 11 }] },

    // Água Eletrizada (Agora com sprite individual!)
    ELECTRIC_WATER: { id: 'ELECTRIC_WATER', name: 'Água Eletrizada', cost: 2, def: -0.50, color: '#1c4568', icon: '⚡', customSprite: 'img/tiles/agua_eletrificada.jpeg', cols: 6 },

    // ==========================================
    // NOVOS TERRENOS ESPECIAIS (Sprites Individuais)
    // ==========================================
    QUICKSAND: { id: 'QUICKSAND', name: 'Areia Movediça', cost: 3, def: -0.20, color: '#d4a373', icon: '🌀', customSprite: 'img/tiles/areia_movediça.jpeg', cols: 6 },
    LAVA_RIFT: { id: 'LAVA_RIFT', name: 'Fenda de Lava', cost: 3, def: -0.50, color: '#c0392b', icon: '🌋', customSprite: 'img/tiles/fenda_lava.jpeg', cols: 6 },
    MANA_RIFT: { id: 'MANA_RIFT', name: 'Fenda de Mana', cost: 2, def: 0.10, color: '#9b59b6', icon: '🔮', customSprite: 'img/tiles/fenda_mana.jpeg', cols: 6 },
    REEF: { id: 'REEF', name: 'Recife', cost: 2, def: 0.30, color: '#1abc9c', icon: '🪸', customSprite: 'img/tiles/recife.jpeg', cols: 6 },
    DNA_DEPOSIT: { id: 'DNA_DEPOSIT', name: 'Jazida de DNA', cost: 1, def: 0.10, color: '#2ecc71', icon: '🧬', customSprite: 'img/tiles/jazida_dna.jpeg', cols: 6 },
    GOLD_DEPOSIT: { id: 'GOLD_DEPOSIT', name: 'Jazida de Ouro', cost: 1, def: 0.10, color: '#f1c40f', icon: '💰', customSprite: 'img/tiles/jazida_ouro.jpeg', cols: 6 },
    STONE_DEPOSIT: { id: 'STONE_DEPOSIT', name: 'Jazida de Pedra', cost: 1, def: 0.10, color: '#7f8c8d', icon: '🪨', customSprite: 'img/tiles/jazida_pedra.jpeg', cols: 6 },
    BLACK_MARKET: { id: 'BLACK_MARKET', name: 'Mercado Negro', cost: 1, def: 0.20, color: '#2c3e50', icon: '⛺', customSprite: 'img/tiles/mercado_negro.jpeg', cols: 5 }
};

const TAGS = {
    FIRE: { name: 'Ígneo', col: '#e67e22', req: 3, desc: '(3) Causa 20% de dano em área.' },
    SILVESTRE: { name: 'Silvestre', col: '#27ae60', req: 3, desc: '(3) Cura +5 HP e 15% chance de Atordoar.' },
    ABYSSAL: { name: 'Abissal', col: '#3498db', req: 3, desc: '(3) 20% de Esquiva e sem atraso de terreno.' },
    ROCK: { name: 'Rochoso', col: '#95a5a6', req: 3, desc: '(3) +30% Defesa Base (Máx 60%).' },
    SAND: { name: 'Arenoso', col: '#f1c40f', req: 3, desc: '(3) Ganham "Bater e Correr".' },
    ICE: { name: 'Gélido', col: '#00ffff', req: 3, desc: '(3) Ataques reduzem MP do alvo em 2.' },
    UMBRAL: { name: 'Umbral', col: '#8e44ad', req: 3, desc: '(3) Ganham 25% de Roubo de Vida.' },
    CELESTIAL: { name: 'Celestial', col: '#fffbc2', req: 3, desc: '(3) Curam 10 HP e removem debuffs em volta.' },
    PRIMAL: { name: 'Primal', col: '#e74c3c', req: 2, desc: '(2) Ganham +1 de Ataque por turno vivo.' },
    WING: { name: 'Alado', col: '#ecf0f1', req: 2, desc: '(2) Custo 1 em tudo e sem defesa negativa.' },
    VENOM: { name: 'Venenoso', col: '#9b59b6', req: 2, desc: '(2) Veneno tira 10 HP e 100% de chance.' },
    STALKER: { name: 'Rastreador', col: '#d35400', req: 3, desc: '(3) Flanquear inimigo ignora def e dobra dano.' },
    CARAPACE: { name: 'Carapaça', col: '#7f8c8d', req: 2, desc: '(2) Refletem 10% do dano recebido.' },
    MYSTIC: { name: 'Místico', col: '#9b59b6', req: 2, desc: '(2) 30% chance de resetar MP (Ação Extra).' },
    ELECTRIC: { name: 'Elétrico', col: '#f1c40f', req: 2, desc: 'Especialistas em correntes elétricas.' }
};

const MANA_TYPES = {
    FIRE: { icon: '🔥', col: '#e67e22', name: 'Fogo' },
    SILVESTRE: { icon: '🌿', col: '#27ae60', name: 'Vida' },
    ABYSSAL: { icon: '💧', col: '#3498db', name: 'Abissal' },
    ROCK: { icon: '⛏️', col: '#95a5a6', name: 'Terra' },
    SAND: { icon: '🌪️', col: '#f1c40f', name: 'Areia' },
    ICE: { icon: '❄️', col: '#00ffff', name: 'Gelo' },
    UMBRAL: { icon: '🌑', col: '#8e44ad', name: 'Umbra' },
    CELESTIAL: { icon: '✨', col: '#fffbc2', name: 'Luz' },
    PRIMAL: { icon: '🦴', col: '#e74c3c', name: 'Primal' },
    WING: { icon: '🪶', col: '#ecf0f1', name: 'Vento' },
    VENOM: { icon: '☠️', col: '#9b59b6', name: 'Veneno' },
    STALKER: { icon: '👁️', col: '#d35400', name: 'Sombra' },
    CARAPACE: { icon: '🛡️', col: '#7f8c8d', name: 'Pedra' },
    MYSTIC: { icon: '🔮', col: '#9b59b6', name: 'Arcano' },
    ELECTRIC: { icon: '⚡', col: '#f1c40f', id: 'ELECTRIC', name: 'Energia' }
};

const SPELLS = [
    { id: 'sl_ember', name: 'Centelha', icon: '🔥', level: 1, tags: ['FIRE'], type: 'atk', range: 2, cost: { FIRE: 1 }, targetTerrain: true, desc: 'Causa 10 de dano de fogo.', effect: async (g, c, t) => { t.hp -= 10; showPopup("🔥 -10", t, '#e67e22'); addLog(`🔥 ${c.name} lançou Centelha em ${t.name}!`, '#e67e22'); if (t.hp <= 0) g.handleDeath(t, c); g.checkWin(); return true; } },
    { id: 'sl_heal', name: 'Cura Menor', icon: '💚', level: 1, tags: ['SILVESTRE'], type: 'def', range: 3, cost: { SILVESTRE: 1 }, desc: 'Cura 20 HP de um aliado.', effect: async (g, c, t) => { let h = Math.min(t.maxHp - t.hp, 20); t.hp += h; showPopup(`+${h}`, t, '#2ecc71'); addLog(`💚 ${c.name} curou ${t.name}!`, '#27ae60'); return true; } },
    { id: 'sl_tidal', name: 'Onda Menor', icon: '💧', level: 1, tags: ['ABYSSAL'], type: 'atk', range: 0, cost: { ABYSSAL: 1 }, desc: 'Causa 3 de dano em inimigos adjacentes.', effect: async (g, c, t) => { let n = Hex.getNeighbors(c.q, c.r); let hit = 0; for (let nb of n) { let u = g.getUnitAt(nb.q, nb.r); if (u && u.faction !== c.faction) { u.hp -= 3; showPopup("💧 -3", u, '#3498db'); hit++; if (u.hp <= 0) g.handleDeath(u, c); } } addLog(`💧 ${c.name} lançou Onda Menor!`, '#3498db'); g.checkWin(); return hit > 0 || true; } },
    { id: 'sl_rock_wall', name: 'Pele de Pedra', icon: '🪨', level: 1, tags: ['ROCK', 'CARAPACE'], type: 'def', range: 3, cost: { ROCK: 1 }, desc: 'Um aliado ganha +30% Defesa base por 1 turno.', effect: async (g, c, t) => { t.status = 'shielded'; showPopup("🪨 Escudo", t, '#95a5a6'); addLog(`🪨 ${t.name} ganhou Pele de Pedra!`, '#95a5a6'); return true; } },
    { id: 'sl_venom_spit', name: 'Cuspe Venenoso', icon: '☠️', level: 1, tags: ['VENOM'], type: 'atk', range: 2, cost: { VENOM: 1 }, desc: 'Envenena 1 inimigo.', effect: async (g, c, t) => { t.status = 'poison'; showPopup("☠️ Veneno", t, '#9b59b6'); addLog(`☠️ ${c.name} envenenou ${t.name}!`, '#9b59b6'); return true; } },
    { id: 'sl_gust', name: 'Rajada', icon: '🪶', level: 1, tags: ['WING'], type: 'def', range: 3, cost: { WING: 1 }, desc: 'Um aliado ganha +2 de Movimento neste turno.', effect: async (g, c, t) => { t.mp += 2; showPopup("+2 Mov", t, '#ecf0f1'); addLog(`🪶 ${t.name} ganhou Rajada!`, '#ecf0f1'); return true; } },
    { id: 'sl_sand_throw', name: 'Poeira Ofuscante', icon: '🌪️', level: 1, tags: ['SAND'], type: 'atk', range: 2, cost: { SAND: 1 }, desc: 'Causa 3 de dano e reduz 1 MP.', effect: async (g, c, t) => { t.hp -= 3; t.mp = Math.max(0, t.mp - 1); showPopup("🌪️ -3", t, '#f1c40f'); addLog(`🌪️ ${c.name} lançou Poeira em ${t.name}!`, '#f1c40f'); if (t.hp <= 0) g.handleDeath(t, c); g.checkWin(); return true; } },
    { id: 'sl_ice_shard', name: 'Estilhaço de Gelo', icon: '🧊', level: 1, tags: ['ICE'], type: 'atk', range: 3, cost: { ICE: 1 }, desc: 'Causa 6 de dano de gelo.', effect: async (g, c, t) => { t.hp -= 6; showPopup("🧊 -6", t, '#00ffff'); addLog(`🧊 ${c.name} atirou Estilhaço!`, '#00ffff'); if (t.hp <= 0) g.handleDeath(t, c); g.checkWin(); return true; } },
    { id: 'sl_dark_touch', name: 'Toque Sombrio', icon: '🌑', level: 1, tags: ['UMBRAL'], type: 'atk', range: 1, cost: { UMBRAL: 1 }, desc: 'Drena 6 HP de um inimigo adjacente.', effect: async (g, c, t) => { t.hp -= 6; c.hp = Math.min(c.maxHp, c.hp + 6); showPopup("🌑 -6", t, '#8e44ad'); showPopup("🌑 +6", c, '#8e44ad'); addLog(`🌑 ${c.name} drenou vida!`, '#8e44ad'); if (t.hp <= 0) g.handleDeath(t, c); g.checkWin(); return true; } },
    { id: 'sl_guiding_light', name: 'Luz Guia', icon: '🌟', level: 1, tags: ['CELESTIAL'], type: 'def', range: 0, cost: { CELESTIAL: 1 }, desc: 'Cura 10 HP de aliados próximos.', effect: async (g, c, t) => { let hit = false; Hex.getNeighbors(c.q, c.r).forEach(n => { let u = g.getUnitAt(n.q, n.r); if (u && u.faction === c.faction) { u.status = null; let h = Math.min(u.maxHp - u.hp, 10); u.hp += h; showPopup(`🌟 +${h}`, u, '#fffbc2'); hit = true; } }); if (!hit) { let h = Math.min(c.maxHp - c.hp, 10); c.hp += h; c.status = null; showPopup(`🌟 +${h}`, c, '#fffbc2'); } return true; } },
    { id: 'sl_savage_cry', name: 'Grito Selvagem', icon: '🐺', level: 1, tags: ['PRIMAL'], type: 'def', range: 0, cost: { PRIMAL: 1 }, desc: 'O Líder ganha +5 ATK neste turno.', effect: async (g, c, t) => { c.furyAtk = (c.furyAtk || 0) + 5; showPopup("+5 ATK", c, '#e74c3c'); return true; } },
    { id: 'sl_arcane_dart', name: 'Dardo Arcano', icon: '🔮', level: 1, tags: ['MYSTIC'], type: 'atk', range: 3, cost: { MYSTIC: 1 }, desc: 'Causa 8 de dano.', effect: async (g, c, t) => { t.hp -= 8; showPopup("🔮 -8", t, '#9b59b6'); if (t.hp <= 0) g.handleDeath(t, c); g.checkWin(); return true; } },

    // Level 2, 3, 4, 5
    { id: 'sl_tornado', name: 'Tornado', icon: '🌪️', level: 2, tags: ['WING'], type: 'atk', range: 99, cost: { WING: 2 }, desc: 'Causa 12 de dano a todos os inimigos.', effect: async (g, c, t) => { g.units.filter(u => u.faction !== c.faction).forEach(u => { u.hp -= 12; showPopup("🌪️ -12", u, '#ecf0f1'); if (u.hp <= 0) g.handleDeath(u, c); }); addLog(`🌪️ Um Tornado varreu o mapa!`, '#ecf0f1'); g.checkWin(); return true; } },
    { id: 'sl_thorn_armor', name: 'Armadura de Espinhos', icon: '🌵', level: 2, tags: ['CARAPACE'], type: 'def', range: 3, cost: { CARAPACE: 2 }, desc: 'Dá Carapaça (+Def e Reflete Dano) a um aliado.', effect: async (g, c, t) => { if (!t.abilities.includes('carapace')) t.abilities.push('carapace'); t.status = 'shielded'; showPopup("🌵 Espinhos", t, '#7f8c8d'); return true; } },
    { id: 'sl_assassinate', name: 'Ataque Furtivo', icon: '🗡️', level: 2, tags: ['STALKER'], type: 'atk', range: 4, cost: { STALKER: 2 }, desc: 'Causa 22 de dano massivo num inimigo.', effect: async (g, c, t) => { t.hp -= 22; showPopup("🗡️ -22", t, '#d35400'); if (t.hp <= 0) g.handleDeath(t, c); g.checkWin(); return true; } },
    { id: 'sl_quicksand', name: 'Dunas Movediças', icon: '🏜️', level: 3, tags: ['SAND'], type: 'atk', range: 99, cost: { SAND: 3 }, desc: 'Prende (Amarrar) TODOS os inimigos e causa 8 dano.', effect: async (g, c, t) => { g.units.filter(u => u.faction !== c.faction).forEach(u => { u.status = 'bind'; u.hp -= 8; showPopup("🏜️ Preso!", u, '#f1c40f'); if (u.hp <= 0) g.handleDeath(u, c); }); g.checkWin(); return true; } },
    { id: 'sl_fireball', name: 'Bola de Fogo', icon: '🌋', level: 2, tags: ['FIRE'], type: 'atk', range: 3, cost: { FIRE: 2 }, targetTerrain: true, desc: 'Causa 18 de dano de fogo.', effect: async (g, c, t) => { t.hp -= 18; showPopup("🌋 -18", t, '#e67e22'); if (t.hp <= 0) g.handleDeath(t, c); g.checkWin(); return true; } },
    { id: 'sl_regen', name: 'Regeneração', icon: '🌿', level: 2, tags: ['SILVESTRE'], type: 'def', range: 99, cost: { SILVESTRE: 2 }, desc: 'Cura 15 HP de todas as unidades aliadas.', effect: async (g, c, t) => { g.units.filter(u => u.faction === c.faction).forEach(u => { let h = Math.min(u.maxHp - u.hp, 15); u.hp += h; if (h > 0) showPopup(`+${h}`, u, '#27ae60'); }); return true; } },
    { id: 'sl_freeze', name: 'Toque Glacial', icon: '❄️', level: 2, tags: ['ICE'], type: 'atk', range: 2, cost: { ICE: 2 }, desc: 'Atordoa 1 inimigo por 1 turno completo.', effect: async (g, c, t) => { t.status = 'stun'; showPopup("❄️ Congelado", t, '#00ffff'); return true; } },
    { id: 'sl_shadow_step', name: 'Passo Sombrio', icon: '🌑', level: 2, tags: ['UMBRAL', 'STALKER'], type: 'atk', range: 99, cost: { UMBRAL: 2 }, desc: 'Teleporta o Líder para perto de um alvo fraco.', effect: async (g, c, t) => { let ws = g.units.filter(u => u.faction !== c.faction && u.hp <= u.maxHp * 0.5).sort((a, b) => a.hp - b.hp); if (!ws.length) { showMessage("Nenhum alvo fraco!", "#8e44ad"); return false; } let tgt = ws[0]; let nb = Hex.getNeighbors(tgt.q, tgt.r).find(n => g.map.has(`${n.q},${n.r}`) && !g.getUnitAt(n.q, n.r)); if (!nb) { showMessage("Sem espaço!", "#8e44ad"); return false; } c.q = nb.q; c.r = nb.r; c.vq = nb.q; c.vr = nb.r; renderer.centerOn(nb.q, nb.r); showPopup("🌑 Teleporte", c, '#8e44ad'); return true; } },
    { id: 'sl_primal_rage', name: 'Fúria Primal', icon: '🦴', level: 2, tags: ['PRIMAL'], type: 'def', range: 99, cost: { PRIMAL: 2 }, desc: 'Concede +8 ATK a aliados neste turno.', effect: async (g, c, t) => { g.units.filter(u => u.faction === c.faction && !u.isLeader).forEach(u => { u.furyAtk = (u.furyAtk || 0) + 8; showPopup("+8 ATK", u, '#e74c3c'); }); return true; } },
    { id: 'sl_light_beam', name: 'Raio de Luz', icon: '✨', level: 2, tags: ['CELESTIAL'], type: 'def', range: 0, cost: { CELESTIAL: 2 }, desc: 'Remove debuffs de aliados próximos e cura 10 HP.', effect: async (g, c, t) => { Hex.getNeighbors(c.q, c.r).forEach(n => { let u = g.getUnitAt(n.q, n.r); if (u && u.faction === c.faction) { u.status = null; let h = Math.min(u.maxHp - u.hp, 10); u.hp += h; showPopup(`✨+${h}`, u, '#fffbc2'); } }); return true; } },
    { id: 'sl_sandstorm', name: 'Tempestade de Areia', icon: '🌪️', level: 2, tags: ['SAND'], type: 'atk', range: 99, cost: { SAND: 2 }, desc: 'Reduz MP de todos os inimigos em 2.', effect: async (g, c, t) => { g.units.filter(u => u.faction !== c.faction).forEach(u => { u.mp = Math.max(0, u.mp - 2); showPopup("-2 MP", u, '#f1c40f'); }); return true; } },
    { id: 'sl_inferno', name: 'Inferno', icon: '☄️', level: 3, tags: ['FIRE'], type: 'atk', range: 99, cost: { FIRE: 3 }, desc: 'Causa 12 de dano a TODOS os inimigos.', effect: async (g, c, t) => { let enemies = g.units.filter(u => u.faction !== c.faction); enemies.forEach(u => { u.hp -= 12; showPopup("☄️ -12", u, '#e67e22'); if (u.hp <= 0) g.handleDeath(u, c); }); g.checkWin(); return true; } },
    { id: 'sl_nature_shield', name: 'Escudo Natural', icon: '🍃', level: 3, tags: ['SILVESTRE'], type: 'def', range: 0, cost: { SILVESTRE: 3 }, desc: 'Cura 30 HP do Líder e remove todos debuffs.', effect: async (g, c, t) => { let h = Math.min(c.maxHp - c.hp, 30); c.hp += h; c.status = null; showPopup(`🍃+${h}`, c, '#27ae60'); return true; } },
    { id: 'sl_blizzard', name: 'Nevasca', icon: '🌨️', level: 3, tags: ['ICE'], type: 'atk', range: 99, cost: { ICE: 3 }, targetTerrain: true, desc: 'Causa 10 de dano e Atrasa 2 MP.', effect: async (g, c, t) => { g.units.filter(u => u.faction !== c.faction).forEach(u => { u.hp -= 10; u.mp = Math.max(0, u.mp - 2); showPopup("🌨️ -10", u, '#00ffff'); if (u.hp <= 0) g.handleDeath(u, c); }); g.checkWin(); return true; } },
    { id: 'sl_void_drain', name: 'Drenagem do Vazio', icon: '🌀', level: 3, tags: ['UMBRAL'], type: 'atk', range: 3, cost: { UMBRAL: 3 }, desc: 'Drena 15 HP de um alvo.', effect: async (g, c, t) => { t.hp -= 15; c.hp = Math.min(c.maxHp, c.hp + 15); showPopup("🌀 -15", t, '#8e44ad'); showPopup("🌀 +15", c, '#8e44ad'); if (t.hp <= 0) g.handleDeath(t, c); g.checkWin(); return true; } },
    { id: 'sl_stone_rain', name: 'Chuva de Pedras', icon: '🪨', level: 3, tags: ['ROCK', 'CARAPACE'], type: 'atk', range: 0, cost: { ROCK: 3 }, desc: 'Causa 8 de dano a inimigos adjacentes.', effect: async (g, c, t) => { let hit = false; Hex.getNeighbors(c.q, c.r).forEach(n => { let u = g.getUnitAt(n.q, n.r); if (u && u.faction !== c.faction) { u.hp -= 8; showPopup("🪨 -8", u, '#95a5a6'); hit = true; if (u.hp <= 0) g.handleDeath(u, c); } }); g.checkWin(); return true; } },
    { id: 'sl_mass_venom', name: 'Praga', icon: '💀', level: 3, tags: ['VENOM'], type: 'atk', range: 99, cost: { VENOM: 3 }, desc: 'Envenena TODOS os inimigos.', effect: async (g, c, t) => { g.units.filter(u => u.faction !== c.faction).forEach(u => { u.status = 'poison'; showPopup("💀 Praga", u, '#9b59b6'); }); return true; } },
    { id: 'sl_storm_wing', name: 'Tempestade Alada', icon: '🌩️', level: 3, tags: ['WING'], type: 'atk', range: 4, cost: { WING: 3 }, desc: 'Todas as unidades ALADAS atacam o alvo.', effect: async (g, c, t) => { let wings = g.units.filter(u => u.faction === c.faction && u.tags.includes('WING') && u.hp > 0); if (!wings.length) return false; for (let w of wings) { if (t.hp > 0) { t.hp -= w.atk; showPopup(`🌩️ -${w.atk}`, t, '#ecf0f1'); if (t.hp <= 0) g.handleDeath(t, w); } } g.checkWin(); return true; } },
    { id: 'sl_meteor', name: 'Meteorito', icon: '💫', level: 4, tags: ['FIRE'], type: 'atk', range: 99, cost: { FIRE: 3, ROCK: 1 }, desc: 'Causa 30 de dano em área a todos os inimigos.', effect: async (g, c, t) => { g.units.filter(u => u.faction !== c.faction).forEach(u => { u.hp -= 30; showPopup("💫 -30", u, '#e67e22'); if (u.hp <= 0) g.handleDeath(u, c); }); g.checkWin(); return true; } },
    { id: 'sl_resurrection', name: 'Ressurreição', icon: '💛', level: 4, tags: ['CELESTIAL', 'SILVESTRE'], type: 'def', range: 1, cost: { CELESTIAL: 2, SILVESTRE: 2 }, desc: 'Revive a última fera morta num espaço adjacente.', effect: async (g, c, t, cH) => { if (!g.lastDeadAlly) return false; if (g.getUnitAt(cH.q, cH.r)) return false; let d = g.lastDeadAlly; d.q = cH.q; d.r = cH.r; d.vq = cH.q; d.vr = cH.r; d.hp = Math.floor(d.maxHp * 0.5); d.hasAttacked = false; d.status = null; g.units.push(d); g.lastDeadAlly = null; showPopup("💛 Revivido!", d, '#fffbc2'); return true; } },
    { id: 'sl_mind_control', name: 'Controle Mental', icon: '🧠', level: 4, tags: ['MYSTIC'], type: 'atk', range: 3, cost: { MYSTIC: 3 }, desc: 'Converte um inimigo temporariamente por 2 turnos.', effect: async (g, c, t) => { if (t.isBoss) return false; t._origFaction = t.faction; t.faction = 1; t._mcDuration = 2; t.mp = t.maxMp; t.hasAttacked = false; t.status = null; showPopup("🧠 Controlado!", t, '#9b59b6'); return true; } },
    { id: 'sl_tidal_wave', name: 'Maré Gigante', icon: '🌊', level: 4, tags: ['ABYSSAL'], type: 'atk', range: 99, cost: { ABYSSAL: 3 }, desc: 'Causa 20 de dano a todos os inimigos e empurra.', effect: async (g, c, t) => { g.units.filter(u => u.faction !== c.faction).forEach(u => { u.hp -= 20; u.mp = Math.max(0, u.mp - 3); showPopup("🌊 -20", u, '#3498db'); if (u.hp <= 0) g.handleDeath(u, c); }); g.checkWin(); return true; } },
    { id: 'sl_apocalypse', name: 'Apocalipse', icon: '🌠', level: 5, tags: ['FIRE'], type: 'atk', range: 99, cost: { FIRE: 4, PRIMAL: 1 }, desc: 'Causa 40 de dano verdadeiro a todos.', effect: async (g, c, t) => { g.units.filter(u => u.faction !== c.faction).forEach(u => { u.hp -= 40; showPopup("🌠 -40", u, '#e74c3c'); if (u.hp <= 0) g.handleDeath(u, c); }); g.checkWin(); return true; } },
    { id: 'sl_phoenix_rebirth', name: 'Renascimento Fênix', icon: '🔱', level: 5, tags: ['CELESTIAL', 'FIRE'], type: 'def', range: 99, cost: { CELESTIAL: 3, FIRE: 2 }, desc: 'Cura TODOS os aliados para HP Máx.', effect: async (g, c, t) => { g.units.filter(u => u.faction === c.faction).forEach(u => { u.hp = u.maxHp; u.status = null; showPopup("🔱 PLENO", u, '#fffbc2'); }); return true; } },
    { id: 'sl_world_freeze', name: 'Congelamento Mundial', icon: '🧊', level: 5, tags: ['ICE'], type: 'atk', range: 99, cost: { ICE: 4 }, desc: 'Atordoa TODOS os inimigos por 1 turno e causa 15 dano.', effect: async (g, c, t) => { g.units.filter(u => u.faction !== c.faction).forEach(u => { u.status = 'stun'; u.hp -= 15; showPopup("🧊 CONGELADO", u, '#00ffff'); if (u.hp <= 0) g.handleDeath(u, c); }); g.checkWin(); return true; } },
    { id: 'sl_soul_harvest', name: 'Colheita de Almas', icon: '⚡', level: 5, tags: ['UMBRAL', 'VENOM'], type: 'atk', range: 99, cost: { UMBRAL: 3, VENOM: 2 }, desc: 'Drena 25% do HP atual de TODOS inimigos.', effect: async (g, c, t) => { let total = 0; g.units.filter(u => u.faction !== c.faction && u.hp > 0).forEach(u => { let d = Math.floor(u.hp * 0.25); u.hp -= d; total += d; showPopup(`⚡ -${d}`, u, '#8e44ad'); if (u.hp <= 0) g.handleDeath(u, c); }); c.hp = Math.min(c.maxHp, c.hp + total); showPopup(`⚡ +${total}`, c, '#8e44ad'); g.checkWin(); return true; } },
    {
        id: 'sl_marca_cacador', name: 'Marca do Caçador', icon: '🎯',
        desc: 'Marca a presa. O alvo recebe o DOBRO de dano de aliados com a tag STALKER!',
        level: 1, type: 'atk', range: 4, tags: ['STALKER', 'PRIMAL'], cost: { 'STALKER': 1 },
        effect: async (game, caster, target) => {
            if (target) {
                target.status = 'marked';
                if (typeof showPopup === 'function') showPopup("Marcado! 🎯", target, '#e74c3c');
            }
            return true;
        }
    },
    {
        id: 'sl_escavar', name: 'Escavar', icon: '🕳️',
        desc: 'Cava um buraco e fica oculto. No próximo turno, clique num local para emergir e atacar!',
        level: 1, type: 'def', range: 0, tags: ['ROCK', 'PRIMAL'], cost: { 'ROCK': 0 },
        effect: async (game, caster) => {
            caster.status = 'digging';
            caster.isHidden = true;
            caster.filter = caster.faction === 1 ? 'opacity(0.5) grayscale(100%)' : 'opacity(0)';

            // TRAVA DE TURNO: Grava em qual rodada ele começou a cavar
            caster._digTurn = game.turnCount;

            // Força a finalização do turno da unidade (ele não pode andar debaixo da terra no mesmo turno)
            caster.hasAttacked = true;
            caster.mp = 0;

            if (typeof showPopup === 'function') showPopup("Escavou! 🕳️", caster, '#7f8c8d');
            return true;
        }
    },

    //SPELLS DE TERRENO
    {
        id: 'sl_combustao', name: 'Incendiar', icon: '🔥',
        desc: 'Causa 15 de dano. Incendeia florestas ou derrete o gelo do alvo.',
        level: 1, type: 'atk', range: 3, tags: ['FIRE'], cost: { 'FIRE': 1 }, targetTerrain: true,
        effect: async (game, caster, target, targetHex) => {
            if (target) { target.hp -= 5; if (typeof showPopup === 'function') showPopup("-5 🔥", target, '#e74c3c'); if (target.hp <= 0) game.handleDeath(target, caster); }
            return true;
        }
    },
    {
        id: 'sl_zero_absoluto', name: 'Congelar', icon: '❄️',
        desc: 'Causa 15 de dano. Congela a água sob o alvo, espalhando para águas adjacentes.',
        level: 1, type: 'atk', range: 3, tags: ['ICE'], cost: { 'ICE': 1 }, targetTerrain: true,
        effect: async (game, caster, target, targetHex) => {
            if (target) { target.hp -= 5; if (typeof showPopup === 'function') showPopup("-5 ❄️", target, '#00ffff'); if (target.hp <= 0) game.handleDeath(target, caster); }
            return true;
        }
    },
    {
        id: 'sl_curto_circuito', name: 'Curto-Circuito', icon: '⚡',
        desc: 'Causa 15 de dano. Se atingir a água, espalha eletricidade.',
        level: 1, type: 'atk', range: 3, tags: ['ELECTRIC'], cost: { 'ELECTRIC': 1 }, targetTerrain: true,
        effect: async (game, caster, target, targetHex) => {
            if (target) { target.hp -= 5; if (typeof showPopup === 'function') showPopup("-5 ⚡", target, '#f1c40f'); if (target.hp <= 0) game.handleDeath(target, caster); }
            return true;
        }
    },
    //Spells de Líder
    { id: 'sl_mordida_vamp', name: 'Mordida Vampírica', icon: '🦇', cost: { 'UMBRAL': 2 }, level: 1, type: 'atk', range: 1, tags: ['UMBRAL'], desc: 'Causa dano e cura o Lord Vampiro.', effect: async (game, caster, target) => { if (!target) return false; let dmg = 20; target.hp -= dmg; caster.hp = Math.min(caster.maxHp, caster.hp + dmg); showPopup("-20 HP", target, '#fff'); showPopup("+20 HP", caster, '#2ecc71'); if (target.hp <= 0) game.handleDeath(target, caster); return true; } },
    { id: 'sl_bencao_paladina', name: 'Bênção Divina', icon: '✨', cost: { 'CELESTIAL': 2 }, level: 1, type: 'def', range: 2, tags: ['CELESTIAL'], desc: 'Cura um aliado em 40 HP e remove debuffs.', effect: async (game, caster, target) => { if (!target || target.faction !== 1) return false; target.hp = Math.min(target.maxHp, target.hp + 40); target.status = null; showPopup("+40 HP", target, '#f1c40f'); return true; } },
    { id: 'sl_bombardeio', name: 'Bombardeio Naval', icon: '💣', cost: { 'ABYSSAL': 3 }, level: 1, type: 'atk', range: 3, tags: ['ABYSSAL'], desc: 'Causa 25 de dano a um inimigo distante.', effect: async (game, caster, target) => { if (!target) return false; target.hp -= 25; showPopup("-25 💣", target, '#e74c3c'); if (target.hp <= 0) game.handleDeath(target, caster); return true; } },
    { id: 'sl_tiro_preciso', name: 'Tiro Preciso', icon: '🏹', cost: { 'STALKER': 2 }, level: 1, type: 'atk', range: 4, tags: ['STALKER'], desc: 'Causa 30 de dano perfurante de longa distância.', effect: async (game, caster, target) => { if (!target) return false; target.hp -= 30; showPopup("-30 🏹", target, '#e74c3c'); if (target.hp <= 0) game.handleDeath(target, caster); return true; } },
    { id: 'sl_bola_fogo', name: 'Bola de Fogo', icon: '🔥', cost: { 'FIRE': 2 }, level: 1, type: 'atk', range: 2, tags: ['FIRE'], targetTerrain: true, desc: 'Causa 25 de dano e queima o inimigo.', effect: async (game, caster, target) => { if (!target) return false; target.hp -= 25; target.status = 'burn'; showPopup("-25 🔥", target, '#e67e22'); if (target.hp <= 0) game.handleDeath(target, caster); return true; } },
    { id: 'sl_grito_orc', name: 'Grito de Guerra', icon: '📯', cost: { 'PRIMAL': 2 }, level: 1, type: 'def', range: 0, tags: ['PRIMAL'], desc: 'Concede Ação Extra para o Chefe Orc.', effect: async (game, caster) => { caster.hasAttacked = false; caster.mp = caster.maxMp; showPopup("Ação Extra!", caster, '#e74c3c'); return true; } },
    { id: 'sl_erguer_esq', name: 'Erguer Esqueleto', icon: '💀', cost: { 'UMBRAL': 2 }, level: 1, type: 'def', range: 1, tags: ['UMBRAL'], desc: 'Invoca um Esqueleto para lutar por você.', effect: async (game, caster, target, targetHex) => { if (target) return false; let d = new Unit({ q: targetHex.q, r: targetHex.r, faction: 1, name: "Esqueleto", emoji: "💀", hp: 25, maxHp: 25, mp: 3, maxMp: 3, atk: 8, range: 1, abilities: [], tags: ['UMBRAL', 'MYSTIC'], isNew: false }); game.units.push(d); showPopup("Erguido!", d, '#8e44ad'); return true; } },
    { id: 'sl_explosao_arcana', name: 'Explosão Arcana', icon: '🎇', cost: { 'MYSTIC': 2 }, level: 1, type: 'atk', range: 2, tags: ['MYSTIC'], desc: 'Dano mágico alto no alvo (35 Dano).', effect: async (game, caster, target) => { if (!target) return false; target.hp -= 35; showPopup("-35 🎇", target, '#9b59b6'); if (target.hp <= 0) game.handleDeath(target, caster); return true; } },
    { id: 'sl_forma_urso', name: 'Postura do Urso', icon: '🐻', cost: {}, level: 1, type: 'def', range: 0, tags: ['PRIMAL'], desc: 'Gratuito. Alterna para Urso: Alcance 1, mais HP e ataque e mais lento.', effect: async (game, caster) => { if (caster.emoji === '🐻') return false; if (caster.emoji === '🦅') { caster.maxHp -= 20; caster.hp = Math.min(caster.maxHp, caster.hp); caster.abilities = caster.abilities.filter(a => a !== 'pierce', 'flying'); } caster.emoji = '🐻'; caster.range = 1; caster.maxMp = Math.max(1, caster.maxMp - 1); caster.mp = Math.max(0, caster.mp - 1); caster.atk += 10; showPopup("Forma Urso!", caster, '#f39c12'); return true; } },
    { id: 'sl_forma_falcao', name: 'Postura do Falcão', icon: '🦅', cost: {}, level: 1, type: 'def', range: 0, tags: ['PRIMAL'], desc: 'Gratuito. Alterna para Falcão: Perde o ataque do Urso, ganha 3 de Alcance, ataques Perfurantes e voar.', effect: async (game, caster) => { if (caster.emoji === '🦅') return false; if (caster.emoji === '🐻') { caster.maxHp -= 20; caster.hp = Math.min(caster.maxHp, caster.hp); caster.maxMp += 2; caster.mp += 2; caster.atk = Math.max(1, caster.atk - 5); } caster.emoji = '🦅'; caster.range = 3; if (!caster.abilities.includes('pierce', 'flying')) caster.abilities.push('pierce', 'flying'); showPopup("Forma Falcão!", caster, '#3498db'); return true; } },
    { id: 'sl_forma_dragao', name: 'Postura do Dragao', icon: '🐉', cost: { 'PRIMAL': 5, 'SILVESTRE': 3 }, level: 5, type: 'def', range: 0, tags: ['PRIMAL'], desc: 'Transformação Suprema! +Ataque e HP, Voo e Dano em Área.', effect: async (game, caster) => { caster.emoji = '🐉'; caster.name = "Dragão Supremo"; caster.maxHp += 50; caster.hp += 50; caster.atk += 30; caster.maxMp += 1; caster.mp += 1; if (!caster.abilities.includes('flying')) caster.abilities.push('flying'); if (!caster.abilities.includes('corte_amplo')) caster.abilities.push('corte_amplo'); if (typeof showPopup === 'function') showPopup("DRAGÃO DESPERTO!", caster, '#c0392b'); return true; } },
    { id: 'sl_execucao', name: 'Execução', icon: '🪓', cost: { 'STALKER': 2 }, level: 1, type: 'atk', range: 1, tags: ['STALKER'], desc: 'Ataque fatal. Se o alvo morrer, você recupera seu turno e movimento.', effect: async (game, caster, target) => { if (!target) return false; caster._isExecuting = true; await game.executeCombat(caster, target); caster._isExecuting = false; return true; } },
    { id: 'sl_evocar_dragao', name: 'Evocar Dragão Ígneo', icon: '🐉', cost: { 'MYSTIC': 3, 'FIRE': 2 }, level: 2, type: 'def', range: 1, tags: ['MYSTIC'], desc: 'Invoca um Dragão no campo que dura até o fim da batalha.', effect: async (game, caster, target, targetHex) => { if (target) return false; let d = new Unit({ q: targetHex.q, r: targetHex.r, faction: 1, name: "Dragão Evocado", emoji: "🐉", hp: 60, maxHp: 60, mp: 4, maxMp: 4, atk: 18, range: 2, abilities: ['burn'], tags: ['FIRE'], isNew: false }); game.units.push(d); showPopup("Invocado!", d, '#e74c3c'); return true; } },
    { id: 'sl_evocar_lobo', name: 'Evocar Lobo de Mana', icon: '🐺', cost: { 'MYSTIC': 2 }, level: 1, type: 'def', range: 1, tags: ['MYSTIC'], desc: 'Invoca um Lobo espiritual (Fera) para lutar ao seu lado.', effect: async (game, caster, target, targetHex) => { if (target) return false; let d = new Unit({ q: targetHex.q, r: targetHex.r, faction: 1, name: "Lobo de Mana", emoji: "🐺", hp: 35, maxHp: 35, mp: 4, maxMp: 4, atk: 12, range: 1, abilities: ['dodge'], tags: ['MYSTIC'], isNew: false }); game.units.push(d); showPopup("Invocado!", d, '#9b59b6'); return true; } },
    { id: 'sl_evocar_golem', name: 'Evocar Golem de Pedra', icon: '🪨', cost: { 'MYSTIC': 2, 'ROCK': 2 }, level: 1, type: 'def', range: 1, tags: ['MYSTIC'], desc: 'Invoca um Golem resistente de Pedra.', effect: async (game, caster, target, targetHex) => { if (target) return false; let d = new Unit({ q: targetHex.q, r: targetHex.r, faction: 1, name: "Golem de Pedra", emoji: "🪨", hp: 80, maxHp: 80, mp: 2, maxMp: 2, atk: 10, range: 1, abilities: ['carapace'], tags: ['ROCK'], isNew: false }); game.units.push(d); showPopup("Invocado!", d, '#95a5a6'); return true; } },
    { id: 'sl_cancao_sereia', name: 'Canção da Sereia', icon: '🎵', cost: { 'ABYSSAL': 2 }, level: 2, type: 'atk', range: 3, tags: ['ABYSSAL'], desc: 'Atrai o inimigo 1 casa para perto e aplica Encantar (Atordoado).', effect: async (game, caster, target) => { if (!target) return false; target.status = 'stun'; let path = Hex.getNeighbors(target.q, target.r).sort((a, b) => Hex.distance(a, caster) - Hex.distance(b, caster)); for (let h of path) { if (game.map.has(`${h.q},${h.r}`) && !game.getUnitAt(h.q, h.r)) { await game.moveUnit(target, h.q, h.r); break; } } showPopup("Encantado!", target, '#ff69b4'); return true; } },
    { id: 'sl_turno_extra', name: 'Pó de Fada', icon: '✨', cost: { 'MYSTIC': 3 }, level: 2, type: 'def', range: 2, tags: ['SILVESTRE'], desc: 'Zera o cooldown de um aliado, permitindo que ele ande e ataque novamente.', effect: async (game, caster, target) => { if (!target || target === caster || target.faction !== 1) return false; target.hasAttacked = false; target.mp = target.maxMp; showPopup("Turno Extra!", target, '#f1c40f'); return true; } },
    { id: 'sl_caldeirao', name: 'Caldeirão Sombrio', icon: '🍲', cost: { 'UMBRAL': 2 }, level: 2, type: 'def', range: 1, tags: ['VENOM'], desc: 'Sacrifica um aliado adjacente para curar todo o exército em 30 HP.', effect: async (game, caster, target) => { if (!target || target.faction !== 1 || target.isLeader) return false; game.handleDeath(target, caster); game.units.filter(u => u.faction === 1).forEach(u => { u.hp = Math.min(u.maxHp, u.hp + 30); showPopup("+30 HP", u, '#2ecc71'); }); return true; } },
    { id: 'sl_barreira_gelo', name: 'Barreira de Gelo', icon: '🧊', cost: { 'ICE': 3 }, level: 1, type: 'def', range: 0, tags: ['ICE'], desc: 'Cria uma armadura gélida: ganha escudo imediato e cura 15 HP.', effect: async (game, caster) => { caster.status = 'shielded'; caster.hp = Math.min(caster.maxHp, caster.hp + 15); showPopup("Barreira Ativa!", caster, '#00ffff'); return true; } },
    { id: 'sl_vendaval', name: 'Vendaval Rasante', icon: '🌪️', cost: { 'WING': 3 }, level: 1, type: 'atk', range: 2, tags: ['WING'], desc: 'Causa 20 de dano a um alvo e zera o próprio custo de movimento para fugir (Hit & Run).', effect: async (game, caster, target) => { if (!target) return false; target.hp -= 20; caster.hasAttacked = false; caster.mp = caster.maxMp; showPopup("-20 🌪️", target, '#aaa'); showPopup("Vento a Favor!", caster, '#f1c40f'); if (target.hp <= 0) game.handleDeath(target, caster); return true; } },
    {
        id: 'sl_furia_tempestade',
        name: 'Fúria da Tempestade',
        icon: '🌩️',
        desc: 'Lança um raio colossal que causa 25 de Dano. Todos os inimigos adjacentes ao alvo também recebem o dano e ficam Atordoados!',
        level: 1,
        type: 'atk',
        targetTerrain: true,
        range: 3,
        tags: ['ELECTRIC'],
        cost: { 'ELECTRIC': 2 },
        effect: async (game, caster, target, targetHex) => {
            target.hp -= 25;
            if (typeof showPopup === 'function') showPopup("-25 ⚡", target, '#f1c40f');
            if (target.hp <= 0) game.handleDeath(target, caster);

            // Dano em Cadeia
            let neighbors = Hex.getNeighbors(target.q, target.r);
            for (let n of neighbors) {
                let u = game.getUnitAt(n.q, n.r);
                if (u && u.faction !== caster.faction && u !== target && u.hp > 0) {
                    u.hp -= 25;
                    u.status = 'stun';
                    if (typeof showPopup === 'function') showPopup("Zzz ⚡", u, '#f1c40f');
                    if (u.hp <= 0) game.handleDeath(u, caster);
                }
            }
            return true;
        }
    },

    {
        id: 'sl_miasma_curativo', name: 'Miasma Alquímico', icon: '🧪',
        desc: 'Nuvem tóxica em área 1. Inimigos recebem 20 de dano. Aliados com a tag POISON recuperam 30 HP.',
        level: 1, type: 'atk', range: 3, tags: ['VENOM'], cost: { 'VENOM': 2 }, targetTerrain: true,
        effect: async (game, caster, target, targetHex) => {
            // Pega todos no raio de 1 hexágono do alvo/chão clicado
            let affectedHexes = [targetHex, ...Hex.getNeighbors(targetHex.q, targetHex.r).map(n => game.map.get(`${n.q},${n.r}`))].filter(Boolean);

            for (let h of affectedHexes) {
                let u = game.getUnitAt(h.q, h.r);
                if (u && u.hp > 0) {
                    if (u.faction === caster.faction) {
                        // Se for aliado E tiver a tag de veneno, cura!
                        if (u.tags && u.tags.includes('POISON')) {
                            u.hp = Math.min(u.maxHp, u.hp + 30);
                            if (typeof showPopup === 'function') showPopup("+30 🧪", u, '#2ecc71');
                        }
                    } else {
                        // Se for inimigo, dano neles!
                        u.hp -= 20;
                        if (typeof showPopup === 'function') showPopup("-20 ☠️", u, '#9b59b6');
                        if (u.hp <= 0) game.handleDeath(u, caster);
                    }
                }
            }
            return true;
        }
    }
];



const LEADER_GRIMOIRE_TAGS = {
    'mage': ['MYSTIC'],
    'orc': ['PRIMAL'],
    'necro': ['UMBRAL'],
    'paladin': ['CELESTIAL', 'CARAPACE'],
    'ranger': ['SILVESTRE', 'STALKER'],
    'pyro': ['FIRE'],
    'admiral': ['ABYSSAL'],
    'vampire': ['UMBRAL', 'STALKER'],
    'L_CENTAUR': ['MYSTIC', 'SILVESTRE'],
    'L_ANUBIS': ['UMBRAL', 'SAND'],
    'L_SHAPESHIFTER': ['PRIMAL', 'SILVESTRE'],
    'L_EXECUTIONER': ['STALKER'],
    'L_SUMMONER': ['MYSTIC'],
    'L_GENIE': ['MYSTIC', 'SAND'],
    'L_TROLL': ['PRIMAL', 'SILVESTRE'],
    'L_SIREN': ['ABYSSAL', 'MYSTIC'],
    'L_FAIRY': ['MYSTIC', 'SILVESTRE'],
    'L_WITCH': ['UMBRAL', 'VENOM'],
    'L_BARBARIAN': ['PRIMAL', 'ICE'],
    'L_TREX': ['PRIMAL', 'ROCK', 'STALKER'],
    'L_ICE_QUEEN': ['ICE'],
    'L_HARPY': ['WING', 'STALKER'],
    'ld_dragao_galatico': ['FIRE', 'CELESTIAL'],
    'ld_gargula': ['ROCK', 'WING'],
    'ld_golem_gelo': ['ICE', 'ROCK'],
    'ld_porco_eletrico': ['ELECTRIC', 'CARAPACE'],
    'ld_escaravelho': ['SAND', 'VENOM'],
    'ld_doutor_praga': ['VENOM']
};

const LEADERS = [
    { id: 'mage', name: 'Arquimago', loreFaction: 'ORDEM', emoji: '🧙🏻‍♂️', hp: 60, atk: 12, mp: 4, range: 2, limit: 3, desc: 'Consegue utilizar duas magias por turno.', tags: ['MYSTIC'], sprite: 'img/lideres/arquimago.png' },
    { id: 'orc', name: 'Chefe Orc', loreFaction: 'PRIMORDIAL', emoji: '👹', hp: 80, atk: 15, mp: 5, range: 1, limit: 6, abilities: ['leadership'], desc: 'Líder de Horda (+10% ATK por aliado).', tags: ['PRIMAL'], sprite: 'img/lideres/chefe_orc.png' },
    { id: 'necro', name: 'Necromante', loreFaction: 'SOMBRAS', emoji: '💀', hp: 55, atk: 10, mp: 4, range: 2, limit: 6, desc: 'Exército Morto (Domina como Umbral ao matar).', tags: ['UMBRAL'], sprite: 'img/lideres/necromante.png' },
    { id: 'paladin', name: 'Paladina', loreFaction: 'ORDEM', emoji: '🛡️', hp: 85, atk: 10, mp: 4, range: 1, limit: 3, abilities: ['leadership'], desc: 'Unidades compradas ganham a tag Celestial. Aliados até 2 hexes curam 2 HP por turno.', tags: ['CELESTIAL', 'CARAPACE'], sprite: 'img/lideres/paladina.png' },
    { id: 'ranger', name: 'Arqueira', loreFaction: 'SILVESTRE', emoji: '🏹', hp: 65, atk: 14, mp: 5, range: 3, limit: 3, abilities: ['camouflage'], desc: 'Alcance longo e Doma feras Silvestres facilmente. Silvestres adjacentes a ela recebem +1 de Alcance.', tags: ['SILVESTRE', 'STALKER'], fav: ['FOREST'], sprite: 'img/lideres/arqueira.png' },
    { id: 'pyro', name: 'Piromante', loreFaction: 'ORDEM', emoji: '🔥', hp: 50, atk: 16, mp: 4, range: 2, limit: 3, desc: 'Feras compradas e domadas vêm com queimadura e ganham a tag Ígnea.', tags: ['FIRE'], abilities: ['burn'], sprite: 'img/lideres/piromante.png' },
    { id: 'admiral', name: 'Almirante', loreFaction: 'ABISSAL', emoji: '🏴‍☠️', hp: 65, atk: 13, mp: 5, range: 1, limit: 3, desc: 'Custo de movimento na Água é livre (1). Encontra e doma mais feras Abissais.', tags: ['ABYSSAL'], fav: ['WATER'], sprite: 'img/lideres/almirante.png' },
    { id: 'vampire', name: 'Lord Vampiro', loreFaction: 'SOMBRAS', emoji: '🧛🏻‍♂️', hp: 65, atk: 16, mp: 6, range: 1, limit: 5, desc: 'Roubo de vida. Doma feras abatidas transformando em Rastreadores. Fome se não atacar.', tags: ['UMBRAL', 'STALKER'], abilities: ['lifesteal'], sprite: 'img/lideres/lord_vampiro.png' },
    { id: 'L_CENTAUR', name: 'Centauro Espectral', loreFaction: 'SILVESTRE', emoji: '🏇', hp: 70, maxHp: 70, mp: 6, maxMp: 6, limit: 3, atk: 6, range: 1, tags: ['MYSTIC', 'SILVESTRE'], fav: ['PLAINS'], desc: 'Ganha +10% de ATK Base por cada hexágono percorrido antes de atacar no turno.' },
    { id: 'L_ANUBIS', name: 'Anubis', loreFaction: 'DESERTO', emoji: '🐕‍🦺', hp: 80, maxHp: 80, mp: 3, maxMp: 3, atk: 14, range: 1, limit: 3, tags: ['UMBRAL', 'SAND'], fav: ['DESERT'], desc: 'Sempre que elimina um inimigo, ganha +1 ATK permanentemente (Acumula na run).', sprite: 'img/lideres/anubis.png' },
    { id: 'L_SHAPESHIFTER', name: 'Metamorfo', loreFaction: 'SILVESTRE', emoji: '🕵️‍♂️', hp: 85, maxHp: 85, mp: 4, maxMp: 4, atk: 8, limit: 3, range: 1, tags: ['PRIMAL', 'SILVESTRE'], fav: ['FOREST'], desc: 'Alterna posturas sem custo de mana. Urso (+Defesa, Alc:1) ou Falcão (-Defesa, Perfurante, Alc:3).', sprite: 'img/lideres/metamorfo.png' },
    { id: 'L_EXECUTIONER', name: 'Carrasco', loreFaction: 'SOMBRAS', emoji: '🪓', hp: 90, maxHp: 90, mp: 3, maxMp: 3, atk: 14, limit: 3, range: 1, tags: ['STALKER'], fav: ['MOUNTAIN'], desc: 'Possui o ataque especial Execução. Se matar o alvo, recupera a ação e o movimento.', sprite: 'img/lideres/carrasco.png' },
    { id: 'L_SUMMONER', name: 'Invocador', loreFaction: 'ORDEM', emoji: '👨‍🎨', hp: 60, maxHp: 60, mp: 3, maxMp: 3, atk: 8, limit: 3, range: 2, tags: ['MYSTIC'], desc: 'Mestre dos tokens. Usa mana para evocar criaturas como o Dragão Ígneo direto no tabuleiro.', sprite: 'img/lideres/invocador.png' },
    { id: 'L_GENIE', name: 'Gênia', loreFaction: 'FORASTEIROS', emoji: '🧞‍♀️', hp: 75, maxHp: 75, mp: 5, maxMp: 4, atk: 12, limit: 3, range: 2, tags: ['MYSTIC', 'SAND'], fav: ['DESERT'], desc: 'Possui "Três Desejos". Ao iniciar a fase, escolha entre injetar Ouro, Recursos ou ganhar um Item Épico.', sprite: 'img/lideres/genia.png' },
    { id: 'L_TROLL', name: 'Troll', loreFaction: 'SILVESTRE', emoji: '🧌', hp: 130, maxHp: 130, mp: 3, maxMp: 3, atk: 14, range: 1, limit: 3, tags: ['PRIMAL', 'SILVESTRE'], fav: ['MOUNTAIN', 'FOREST'], desc: 'O Tanque Absoluto. Recupera 15% do HP se passar o turno sem atacar em Montanhas/Florestas.', sprite: 'img/lideres/troll.png' },
    { id: 'L_SIREN', name: 'Sereia', loreFaction: 'ABISSAL', emoji: '🧜🏻‍♀️', hp: 70, maxHp: 70, mp: 3, maxMp: 3, atk: 10, range: 2, limit: 3, abilities: ['dive'], tags: ['ABYSSAL', 'MYSTIC'], fav: ['WATER'], desc: 'Usa a Canção da Sereia para puxar inimigos para perto e atordoá-los.', sprite: 'img/lideres/sereia.png' },
    { id: 'L_FAIRY', name: 'Fada', loreFaction: 'SILVESTRE', emoji: '🧚🏻‍♀️', hp: 60, maxHp: 50, mp: 5, maxMp: 5, atk: 6, range: 2, limit: 3, tags: ['MYSTIC', 'SILVESTRE'], fav: ['FOREST'], desc: 'Maga de Suporte. Suas magias curam aliados em área ou concedem turnos extras.', sprite: 'img/lideres/fada.png' },
    { id: 'L_WITCH', name: 'Bruxa', loreFaction: 'SOMBRAS', emoji: '🧙🏼‍♀️', hp: 65, maxHp: 65, mp: 3, maxMp: 3, atk: 12, range: 2, limit: 3, tags: ['VENOM', 'UMBRAL'], fav: ['FOREST'], desc: 'Alquimista. Pode sacrificar um aliado com a magia Caldeirão para curar toda a equipe massivamente.', sprite: 'img/lideres/bruxa.png' },
    { id: 'L_BARBARIAN', name: 'Rei Bárbaro', loreFaction: 'PRIMORDIAL', emoji: '🤴', hp: 80, maxHp: 80, mp: 4, maxMp: 4, atk: 12, limit: 3, range: 1, tags: ['PRIMAL', 'ICE'], fav: ['SNOW'], desc: 'Fúria Imortal: Quanto mais HP perder, mais forte ele fica.', sprite: 'img/lideres/rei_barbaro.png' },
    { id: 'L_TREX', name: 'T-Rex', loreFaction: 'PRIMORDIAL', emoji: '🦖', hp: 150, maxHp: 150, mp: 3, maxMp: 2, atk: 25, range: 1, limit: 3, tags: ['PRIMAL', 'ROCK', 'STALKER'], fav: ['DIRT'], desc: 'Kaiju. Bate em todos à frente. A cada passo, esmaga florestas e vilas, tornando-as planícies.' },
    { id: 'L_ICE_QUEEN', name: 'Rainha do Gelo', loreFaction: 'ORDEM', emoji: '👸🏼', hp: 75, maxHp: 75, mp: 3, maxMp: 3, atk: 12, limit: 3, range: 2, tags: ['ICE'], fav: ['SNOW'], filter: 'hue-rotate(180deg)', abilities: ['frost_armor', 'freeze'], desc: 'Magia glacial. Inimigos que a atacam corpo-a-corpo sofrem Congelamento (Chilled) instantâneo.', sprite: 'img/lideres/rainha_gelo.png' },
    { id: 'L_HARPY', name: 'Matriarca Harpia', loreFaction: 'SILVESTRE', emoji: '🦅', hp: 65, maxHp: 65, mp: 5, maxMp: 5, atk: 14, limit: 3, range: 1, tags: ['WING', 'STALKER'], fav: ['MOUNTAIN'], filter: 'saturate(150%)', abilities: ['flying', 'dodge'], desc: 'Senhora dos ventos. Ignora custos de terreno pesado (sempre move por 1 MP) e possui esquiva natural alta.' },
    { id: 'shaman', name: 'Xamã da Tempestade', loreFaction: 'TEMPESTADE', emoji: '🧙‍♂️', desc: 'Mestre dos raios. Seus feitiços ricocheteiam e causam caos nas fileiras inimigas.', limit: 3, hp: 75, mp: 4, atk: 12, range: 2, limit: 6, tags: ['ELECTRIC', 'MYSTIC'], fav: ['MOUNTAIN'], filter: 'hue-rotate(45deg) saturate(200%)', knownSpells: ['sl_furia_tempestade'], sprite: 'img/lideres/xama_tempestade.png' },
    {
        id: 'ld_dragao_galatico', name: 'Dragão Galático', loreFaction: 'FORASTEIROS', emoji: '🌌',
        maxHp: 180, hp: 180, mp: 5, maxMp: 5, atk: 45, range: 1, limit: 3,
        tags: ['CELESTIAL', 'FIRE'], abilities: ['flying'],
        sprite: 'img/lideres/dragao_galatico.png',
        desc: 'Uma entidade cósmica. Sobrevoa os perigos e incendeia o campo.',
    },
    {
        id: 'ld_gargula', name: 'Gárgula Anciã', loreFaction: 'FORASTEIROS', emoji: '🗿',
        maxHp: 200, hp: 200, mp: 3, maxMp: 3, atk: 35, range: 1, limit: 3, fav: 'MOUNTAIN',
        tags: ['ROCK', 'WING'], abilities: ['flying', 'counter'],
        desc: 'Estátua viva de altíssima defesa. Voa e pune quem a ataca de perto.',
        sprite: 'img/lideres/gargula.png'
    },
    {
        id: 'ld_golem_gelo', name: 'Golem de Gelo', loreFaction: 'FORASTEIROS', emoji: '🧊',
        maxHp: 250, hp: 250, mp: 3, maxMp: 3, atk: 30, range: 1, limit: 3, fav: 'SNOW',
        tags: ['ROCK', 'ICE'], abilities: [],
        desc: 'Um colosso glacial. Caminha devagar, mas congela os mares.',
        sprite: 'img/lideres/golem_gelo.png'
    },
    {
        id: 'ld_porco_eletrico', name: 'Porco-Espinho Elétrico', loreFaction: 'TEMPESTADE', emoji: '🦔',
        maxHp: 140, hp: 140, mp: 7, maxMp: 7, atk: 25, range: 1, limit: 3,
        tags: ['CARAPACE', 'ELECTRIC'], abilities: ['counter', 'eletric'],
        desc: 'Agulhas carregadas. Eletrocuta a água para criar armadilhas pelo mapa.',
        sprite: 'img/lideres/espinho_eletrico.png'
    },
    {
        id: 'ld_escaravelho', name: 'Escaravelho das Pragas', loreFaction: 'DESERTO', emoji: '🪲',
        maxHp: 160, hp: 160, mp: 4, maxMp: 4, atk: 35, range: 1, limit: 3,
        tags: ['SAND', 'VENOM'], abilities: ['poison'], fav: 'DESERT',
        desc: 'Emerge das areias espalhando toxinas mortais pelo campo.',
    },
    {
        id: 'ld_doutor_praga', name: 'Doutor da Praga', loreFaction: 'SOMBRAS', emoji: '🐦‍⬛',
        maxHp: 130, hp: 130, mp: 4, maxMp: 4, atk: 20, range: 2, limit: 3,
        tags: ['VENOM'], abilities: ['poison'],
        sprite: 'img/lideres/doutor_praga.png',
        desc: 'Mestre alquimista. Todas as feras aliadas compradas se tornam Venenosas.',
        knownSpells: ['sl_miasma_curativo'] // Magia nova abaixo!
    }
];

const FACTIONS = { WILD: { id: 0 }, PLAYER: { id: 1 }, AI: { id: 2 } };

const ABILITY_DESCRIPTIONS = {
    dodge: 'Esquiva: 30% chance de ignorar dano.',
    lifesteal: 'Roubo de Vida: Cura 80% do dano causado.',
    poison: 'Veneno: 30% chance de envenenar.',
    stun: 'Atordoamento: 25% chance de atordoar.',
    bind: 'Amarrar: Zera o MP do alvo no próximo turno.',
    burn: 'Queimadura: Causa 10 de dano verdadeiro após o golpe.',
    pierce: 'Perfuração: Ignora a Defesa de terrenos.',
    counter: 'Contra-ataque Letal: Ao ser atacada, revida com 20% mais dano.',
    freeze: 'Congelamento: 25% chance de atordoar e causar 5 de dano puro.',
    leadership: 'Liderança: Aliados ao redor ganham +2 ATK e +20% DEF.',
    electric: 'Eletricidade: Rebate para inimigos adjacentes (50% Dano).',
    hit_run: 'Bater e Correr: Permite mover-se após o ataque.',
    swift: 'Ataque Rápido: O alvo não contra-ataca o golpe.',
    crystal_skin: 'Pele de Cristal: +40% de Defesa base e Imunidade a status.',
    corte_amplo: 'Corte Amplo: Causa 50% de dano aos inimigos adjacentes.',
    carapace: 'Carapaça: Reflete 20% do dano.',
    flying: 'Voo: Ignora o custo de terrenos difíceis. Move-se por 1 MP em qualquer lugar.',
    frost_armor: 'Gelo Retributivo: Inimigos que atacarem a 1 casa de distância sofrem Congelamento.',
    camouflage: 'Camuflagem: fica invisível na floresta, se não se mover, até ser encontrado e realiza um ataque de oportunidade',
    dive: 'Mergulho: Fica invisível na água, até ser encontrado e realiza um ataque de oportunidade',
};

const EVOS = {
    '🐺': () => { if (this.filter === 'none') this.filter = 'saturate(200%) hue-rotate(330deg)'; },
    '🐗': () => this.emoji = '🦏',
    '🐻': () => this.emoji = '🐼',
    '🐭': () => this.emoji = '🐀',
    '🐢': () => { this.emoji = '🦕'; this.name = "Dinossauro Escudo"; this.maxHp += 40; this.hp += 40; },
    '🐴': () => { this.emoji = '🦄'; this.name = "Unicórnio Místico"; if (!this.abilities.includes('dodge') && this.abilities.length < 2) this.abilities.push('dodge'); if (!this.tags.includes('CELESTIAL')) this.tags.push('CELESTIAL'); },
    '🐍': () => { this.emoji = '🐍'; this.name = "Basilisco"; },
    '🦂': () => { this.emoji = '🦂'; this.name = "Imperador do Deserto"; },
    '🐒': () => { this.emoji = '🦍'; this.name = "Gorila Rei"; },
    '🦊': () => { this.emoji = '🦊'; this.name = "Raposa de Nove Caudas"; },
    '🐸': () => { this.emoji = '🐸'; this.name = "Sapo-Boi Gigante"; },
    '🐦': () => { this.emoji = '🐦‍🔥'; this.name = "Fênix"; if (!this.tags.includes('CELESTIAL')) this.tags.push('CELESTIAL'); if (!this.tags.includes('FIRE')) this.tags.push('FIRE'); },
    'Coelho': ['Lebre Veloz', 'Jackalope'],
    'Canguru': ['Canguru Boxeador', 'Canguru Campeão'],
    'Pinguim': ['Pinguim Deslizante', 'Pinguim Imperador'],
    'Morsa': ['Morsa de Batalha', 'Morsa Colossal'],
    'Salamandra': ['Salamandra de Fogo', 'Salamandra Vulcânica'],
    'Cervo': ['Cervo Luminoso', 'Cervo Divino'],
    'Leão': ['Leão Dourado', 'Leão Celestial'],
    'Coruja': ['Coruja Sábia', 'Coruja Oráculo'],
    'Morcego': ['Morcego Gigante', 'Vampiro Sombrio'],
    'Enguia Elétrica': ['Enguia Chocante', 'Leviatã das Tormentas'],
    'Pássaro Trovão': ['Águia Tempestade', 'Ziz Trovejante'],
};

const BEASTS = {
    LAND: [
        { e: '🐭', name: 'Rato', hp: 20, atk: 5, mp: 5, range: 1, abilities: [], minLevel: 1, filter: 'none', tags: ['STALKER', 'SILVESTRE'], fav: ['PLAINS'] },
        { e: '🐦', name: 'Pássaro', hp: 30, atk: 9, mp: 5, range: 1, abilities: [], minLevel: 1, filter: 'none', tags: ['WING', 'SILVESTRE'], fav: ['FOREST'] },
        { e: '🐢', name: 'Tartaruga', hp: 70, atk: 6, mp: 2, range: 1, abilities: [], minLevel: 1, filter: 'none', tags: ['PRIMAL', 'ROCK'], fav: ['WATER', 'PLAINS'] },
        { e: '🐇', name: 'Coelho', hp: 25, atk: 4, mp: 6, range: 1, abilities: ['swift'], minLevel: 1, filter: 'none', tags: ['SILVESTRE'], fav: ['PLAINS'] },
        { e: '🐴', name: 'Cavalo', hp: 45, atk: 7, mp: 6, range: 1, abilities: ['hit_run'], minLevel: 1, filter: 'none', tags: ['ROCK'], fav: ['PLAINS'] },
        { e: '🦇', name: 'Morcego', hp: 25, atk: 8, mp: 4, range: 1, abilities: ['lifesteal'], minLevel: 1, filter: 'none', tags: ['WING', 'UMBRAL'], fav: ['FOREST'] },
        { e: '🐍', name: 'Cobra', hp: 25, atk: 10, mp: 3, range: 1, abilities: ['poison', 'camouflage'], minLevel: 1, filter: 'none', tags: ['VENOM', 'SAND'], fav: ['DESERT'] },
        { e: '🦂', name: 'Escorpião', hp: 30, atk: 11, mp: 3, range: 1, abilities: ['poison'], minLevel: 1, filter: 'none', tags: ['VENOM', 'SAND', 'CARAPACE'], fav: ['DESERT'] },
        { e: '🐒', name: 'Macaco', hp: 35, atk: 10, mp: 4, range: 1, abilities: ['dodge'], minLevel: 1, filter: 'none', tags: ['SILVESTRE', 'PRIMAL'], fav: ['FOREST'] },
        { e: '🦊', name: 'Raposa', hp: 25, atk: 12, mp: 5, range: 1, abilities: ['swift'], minLevel: 1, filter: 'none', tags: ['SILVESTRE', 'MYSTIC'], fav: ['FOREST'] },
        { e: '🐺', name: 'Lobo', hp: 35, atk: 12, mp: 4, range: 1, abilities: [], minLevel: 2, filter: 'none', tags: ['STALKER', 'ICE'], fav: ['SNOW'] },
        { e: '🐗', name: 'Javali', hp: 50, atk: 8, mp: 3, range: 1, abilities: [], minLevel: 2, filter: 'none', tags: ['STALKER', 'ROCK'], fav: ['PLAINS'] },
        { e: '🐻', name: 'Urso', hp: 65, atk: 15, mp: 3, range: 1, abilities: ['stun'], minLevel: 2, filter: 'none', tags: ['MYSTIC', 'SILVESTRE'], fav: ['FOREST'] },
        { e: '🐘', name: 'Elefante', hp: 90, atk: 12, mp: 2, range: 1, abilities: [], minLevel: 3, filter: 'none', tags: ['PRIMAL', 'SAND'], fav: ['DESERT'] },
        { e: '🦁', name: 'Leão Selvagem', hp: 80, atk: 18, mp: 4, range: 1, abilities: ['leadership'], minLevel: 2, filter: 'none', tags: ['STALKER', 'SAND'], fav: ['DESERT'] },
        { e: '🕷️', name: 'Aranha Gigante', hp: 40, atk: 14, mp: 4, range: 1, abilities: ['poison', 'camouflage'], minLevel: 2, filter: 'none', tags: ['VENOM', 'UMBRAL'], fav: ['FOREST'] },
        { e: '🐯', name: 'Tigre', hp: 55, atk: 16, mp: 5, range: 1, abilities: ['dodge'], minLevel: 3, filter: 'none', tags: ['STALKER', 'SILVESTRE'], fav: ['FOREST'] },
        { e: '🪨', name: 'Golem de Pedra', hp: 100, atk: 10, mp: 2, range: 1, abilities: ['pierce'], minLevel: 4, filter: 'none', tags: ['ROCK', 'CARAPACE'], fav: ['MOUNTAIN'] },
        { e: '🦘', name: 'Canguru', hp: 45, mp: 4, atk: 12, range: 1, abilities: ['dodge'], filter: 'none', tags: ['SILVESTRE', 'SAND'], fav: ['DESERT', 'PLAINS'] },
        { e: '🦌', name: 'Cervo', hp: 35, mp: 5, atk: 10, range: 1, abilities: ['swift'], filter: 'brightness(120%) drop-shadow(0 0 2px yellow)', tags: ['CELESTIAL', 'SILVESTRE'], fav: ['FOREST'] },
        { e: '🦎', name: 'Salamandra', hp: 40, mp: 3, atk: 14, range: 1, abilities: ['burn'], filter: 'hue-rotate(-50deg) saturate(200%)', tags: ['FIRE', 'CARAPACE'], fav: ['MOUNTAIN', 'DESERT'] },
        { e: '🐕‍🦺', name: 'Cão Infernal', hp: 50, mp: 4, atk: 16, range: 1, abilities: ['swift'], filter: 'brightness(70%) sepia(100%) hue-rotate(330deg) saturate(300%)', tags: ['FIRE', 'UMBRAL'], fav: ['MOUNTAIN'] },
        { e: '🦉', name: 'Coruja', hp: 30, mp: 5, atk: 12, range: 2, abilities: ['flying', 'pierce'], filter: 'none', tags: ['UMBRAL', 'WING'], fav: ['FOREST'] },
        { e: '🦅', name: 'Pássaro Trovão', hp: 45, mp: 6, atk: 18, range: 2, abilities: ['flying', 'electric'], filter: 'hue-rotate(200deg) saturate(300%) drop-shadow(0 0 5px yellow)', tags: ['WING', 'ELECTRIC'], fav: ['MOUNTAIN'] }
    ],
    WATER: [
        { e: '🐊', name: 'Crocodilo', hp: 55, atk: 14, mp: 3, range: 1, abilities: ['dive'], minLevel: 2, filter: 'none', tags: ['PRIMAL', 'ABYSSAL'], fav: ['WATER'] },
        { e: '🦈', name: 'Tubarão', hp: 45, atk: 18, mp: 4, range: 1, abilities: ['lifesteal', 'dive'], minLevel: 2, filter: 'none', tags: ['STALKER', 'ABYSSAL'], fav: ['WATER'] },
        { e: '🦑', name: 'Kraken', hp: 75, atk: 12, mp: 2, range: 1, abilities: ['bind', 'dive'], minLevel: 3, filter: 'none', tags: ['MYSTIC', 'ABYSSAL'], fav: ['WATER'] },
        { e: '🦀', name: 'Caranguejo Blindado', hp: 65, atk: 12, mp: 2, range: 1, abilities: ['counter'], minLevel: 2, filter: 'none', tags: ['CARAPACE', 'ABYSSAL'], fav: ['WATER'] },
        { e: '🐍', name: 'Enguia Elétrica', hp: 35, atk: 15, mp: 4, range: 1, abilities: ['electric', 'dive'], minLevel: 3, filter: 'hue-rotate(200deg)', tags: ['ELECTRIC', 'ABYSSAL'], fav: ['WATER'] },
        { e: '🐸', name: 'Sapo', hp: 25, atk: 9, mp: 3, range: 1, abilities: ['poison'], minLevel: 1, filter: 'none', tags: ['VENOM', 'ABYSSAL'], fav: ['WATER'] },
        { e: '🦭', name: 'Morsa', hp: 60, mp: 2, atk: 14, range: 1, abilities: ['crystal_skin', 'dive'], filter: 'none', tags: ['ICE', 'ABYSSAL'], fav: ['WATER', 'SNOW'] }],

    SNOW: [
        { e: '🐐', name: 'Bode da Neve', hp: 40, atk: 9, mp: 4, range: 2, abilities: [], minLevel: 1, filter: 'none', tags: ['ROCK', 'ICE'], fav: ['MOUNTAIN', 'SNOW'] },
        { e: '☃️', name: 'Yeti Atirador', hp: 45, atk: 11, mp: 2, range: 2, abilities: ['freeze'], minLevel: 2, filter: 'none', tags: ['MYSTIC', 'ICE'], fav: ['SNOW'] },
        { e: '🐺', name: 'Lobo do Inverno', hp: 50, atk: 14, mp: 4, range: 1, abilities: ['freeze'], minLevel: 3, filter: 'brightness(200%) grayscale(100%)', tags: ['STALKER', 'ICE'], fav: ['SNOW'] },
        { e: '🐧', name: 'Pinguim', hp: 30, atk: 8, mp: 4, range: 1, abilities: [], minLevel: 1, filter: 'none', tags: ['ABYSSAL', 'ICE'], fav: ['WATER', 'SNOW'] }],

    BOSSES: [
        // LESTE (Deserto)
        { e: '🦁', sprite: 'img/boss/rei_leao.png', name: 'Rei Leão', hp: 200, atk: 25, mp: 4, range: 1, abilities: ['leadership', 'hit_run'], minLevel: 1, maxLevel: 99, filter: 'none', tags: ['PRIMAL', 'SAND'], fav: ['DESERT'], spawnRegion: 'EAST' },

        // SUDESTE (Fogo/Cinzas)
        { e: '🔥', sprite: 'img/boss/fornalha.png', name: 'Fornalha', hp: 220, atk: 28, mp: 3, range: 2, abilities: ['burn', 'carapace'], minLevel: 1, maxLevel: 99, filter: 'none', tags: ['FIRE', 'ROCK'], fav: ['ASHES', 'MOUNTAIN'], spawnRegion: 'SE' },

        // SUL (Pântano Tóxico)
        { e: '🪲', sprite: 'img/boss/centopeia-metalica.png', name: 'Centopeia Metálica', hp: 210, atk: 30, mp: 5, range: 1, abilities: ['poison', 'carapace'], minLevel: 1, maxLevel: 99, filter: 'none', tags: ['VENOM', 'CARAPACE'], fav: ['SWAMP', 'PLAINS'], spawnRegion: 'SOUTH' },

        // SUDOESTE (Costa Abissal)
        { e: '🐉', sprite: 'img/boss/hidra_venenosa.png', name: 'Hidra Venenosa', hp: 250, atk: 26, mp: 3, range: 2, abilities: ['poison', 'lifesteal'], minLevel: 1, maxLevel: 99, filter: 'none', tags: ['ABYSSAL', 'VENOM'], fav: ['WATER'], spawnRegion: 'SW' },

        // OESTE (Floresta)
        { e: '🌳', sprite: 'img/boss/arvore_umbralina.png', name: 'Árvore Umbralina', hp: 280, atk: 22, mp: 2, range: 1, abilities: ['lifesteal', 'bind'], minLevel: 1, maxLevel: 99, filter: 'none', tags: ['SILVESTRE', 'UMBRAL'], fav: ['FOREST'], spawnRegion: 'WEST' },

        // NOROESTE (Montanha)
        { e: '🐲', sprite: 'img/boss/wyvern_pedra2.png', name: 'Wyvern Ancião', hp: 230, atk: 32, mp: 5, range: 1, abilities: ['flying', 'pierce'], minLevel: 1, maxLevel: 99, filter: 'none', tags: ['ROCK', 'WING'], fav: ['MOUNTAIN'], spawnRegion: 'NW' },

        // NORTE (Neve)
        { e: '❄️', sprite: 'img/boss/wendigo.png', name: 'Wendigo', hp: 240, atk: 35, mp: 5, range: 1, abilities: ['freeze', 'lifesteal'], minLevel: 1, maxLevel: 99, filter: 'none', tags: ['ICE', 'UMBRAL'], fav: ['SNOW'], spawnRegion: 'NORTH' },

        // NORDESTE (Planície / Tormenta)
        { e: '👼', sprite: 'img/boss/arcanjo_caido.png', name: 'Arcanjo Caído', hp: 200, atk: 38, mp: 5, range: 2, abilities: ['flying', 'electric'], minLevel: 1, maxLevel: 99, filter: 'none', tags: ['CELESTIAL', 'ELECTRIC'], fav: ['PLAINS'], spawnRegion: 'NE' },

        // CENTRO (Chefe Final Supremo)
        { e: '🌌', sprite: 'img/boss/leviata.png', name: 'Leviatã Umbral', hp: 600, atk: 50, mp: 4, range: 3, abilities: ['corte_amplo', 'crystal_skin'], minLevel: 5, maxLevel: 99, filter: 'none', tags: ['ABYSSAL', 'UMBRAL', 'MYSTIC'], fav: ['WATER', 'ASHES'], spawnRegion: 'CENTER' }
    ],
    ELITES: [
        // Fogo / Vulcânico
        { e: '🧞‍♂️', sprite: 'img/boss/ifrit.png', name: 'Ifrit', hp: 120, atk: 22, mp: 4, range: 2, abilities: ['burn', 'dodge'], minLevel: 2, filter: 'none', tags: ['FIRE', 'MYSTIC'], fav: ['ASHES'] },
        { e: '🦅', sprite: 'img/boss/fenix.png', name: 'Fênix', hp: 90, atk: 18, mp: 5, range: 2, abilities: ['flying', 'burn'], minLevel: 2, filter: 'none', tags: ['FIRE', 'WING'], fav: ['ASHES'] },
        { e: '🔥', sprite: 'img/boss/mula.png', name: 'Mula sem Cabeça', hp: 130, atk: 20, mp: 6, range: 1, abilities: ['hit_run', 'burn'], minLevel: 2, filter: 'none', tags: ['FIRE', 'STALKER'], fav: ['ASHES', 'PLAINS'] },
        { e: '🐍', sprite: 'img/boss/boitata.png', name: 'Boitatá', hp: 140, atk: 24, mp: 4, range: 1, abilities: ['burn', 'camouflage'], minLevel: 3, filter: 'none', tags: ['FIRE', 'VENOM'], fav: ['SWAMP', 'FOREST'] },

        // Neve
        { e: '🐻‍❄️', sprite: 'img/boss/urso_polar_guerra.png', name: 'Urso de Guerra', hp: 160, atk: 25, mp: 3, range: 1, abilities: ['carapace', 'stun'], minLevel: 2, filter: 'none', tags: ['ICE', 'PRIMAL'], fav: ['SNOW'] },
        { e: '🦍', sprite: 'img/boss/yeti.png', name: 'Yeti', hp: 180, atk: 22, mp: 3, range: 1, abilities: ['freeze', 'corte_amplo'], minLevel: 2, filter: 'none', tags: ['ICE', 'ROCK'], fav: ['SNOW'] },
        { e: '🐺', sprite: 'img/boss/werewolf.png', name: 'Lobisomem', hp: 110, atk: 28, mp: 5, range: 1, abilities: ['lifesteal', 'swift'], minLevel: 2, filter: 'none', tags: ['ICE', 'STALKER'], fav: ['SNOW', 'FOREST'] },

        // Floresta / Pântano
        { e: '🐊', sprite: 'img/boss/cuca.png', name: 'Cuca', hp: 110, atk: 15, mp: 3, range: 3, abilities: ['poison', 'bind'], minLevel: 2, filter: 'none', tags: ['VENOM', 'MYSTIC'], fav: ['SWAMP'] },
        { e: '🦅', sprite: 'img/boss/grifo.png', name: 'Grifo', hp: 130, atk: 20, mp: 5, range: 1, abilities: ['flying', 'swift'], minLevel: 2, filter: 'none', tags: ['WING', 'SILVESTRE'], fav: ['FOREST', 'MOUNTAIN'] },
        { e: '👻', sprite: 'img/boss/banshee.png', name: 'Banshee', hp: 95, atk: 18, mp: 4, range: 2, abilities: ['dodge', 'bind'], minLevel: 2, filter: 'none', tags: ['UMBRAL', 'MYSTIC'], fav: ['SWAMP'] },

        // Deserto / Planície / Tempestade
        { e: '🪱', sprite: 'img/boss/verme_areia.png', name: 'Verme de Areia', hp: 150, atk: 26, mp: 3, range: 1, abilities: ['camouflage', 'stun'], minLevel: 2, filter: 'none', tags: ['SAND', 'STALKER'], fav: ['DESERT'] },
        { e: '🐎', sprite: 'img/boss/pegaso.png', name: 'Pégaso', hp: 100, atk: 16, mp: 6, range: 1, abilities: ['flying', 'hit_run'], minLevel: 2, filter: 'none', tags: ['WING', 'CELESTIAL'], fav: ['PLAINS'] },
        { e: '🦅', sprite: 'img/boss/ziz.png', name: 'Ziz', hp: 140, atk: 22, mp: 5, range: 2, abilities: ['flying', 'electric'], minLevel: 3, filter: 'none', tags: ['WING', 'ELECTRIC'], fav: ['PLAINS', 'MOUNTAIN'] },
        { e: '🐂', sprite: 'img/boss/mino.png', name: 'Minotauro da Tormenta', hp: 170, atk: 28, mp: 4, range: 1, abilities: ['corte_amplo', 'electric'], minLevel: 3, filter: 'none', tags: ['PRIMAL', 'ELECTRIC'], fav: ['PLAINS'] },

        // Abissal / Montanha / Umbral
        { e: '🦕', sprite: 'img/boss/plessiossauro.png', name: 'Plessiossauro', hp: 160, atk: 22, mp: 4, range: 1, abilities: ['dive', 'swift'], minLevel: 2, filter: 'none', tags: ['ABYSSAL', 'PRIMAL'], fav: ['WATER'] },
        { e: '🐉', sprite: 'img/boss/wyvern_pedra.png', name: 'Wyvern de Pedra', hp: 150, atk: 20, mp: 4, range: 1, abilities: ['flying', 'carapace'], minLevel: 2, filter: 'none', tags: ['ROCK', 'WING'], fav: ['MOUNTAIN'] },
        { e: '🎃', sprite: 'img/boss/cavaleiro_cabeça.png', name: 'Cavaleiro Sem Cabeça', hp: 140, atk: 25, mp: 5, range: 1, abilities: ['hit_run', 'lifesteal'], minLevel: 3, filter: 'none', tags: ['UMBRAL', 'STALKER'], fav: ['DESERT', 'ASHES'] }
    ]
};



const ALL_BEASTS = [...BEASTS.LAND, ...BEASTS.WATER, ...BEASTS.SNOW, ...BEASTS.BOSSES];

const ARTIFACTS = [
    { id: 'art_hp', name: 'Cálice Vital', icon: '🍷', desc: '+15 HP Máx (Tropas).', cost: 15, rarity: 'rare', color: 'var(--rarity-rare)' },
    { id: 'art_atk', name: 'Lâmina de Sangue', icon: '🗡️', desc: '+8 Ataque (Tropas).', cost: 20, rarity: 'epic', color: 'var(--rarity-epic)' },
    { id: 'art_move', name: 'Botas de Hermes', icon: '🥾', desc: '+1 Movimento pro Herói.', cost: 15, rarity: 'rare', color: 'var(--rarity-rare)' },
    { id: 'art_tame', name: 'Anel do Domador', icon: '💍', desc: '+20% chance de Domar.', cost: 18, rarity: 'epic', color: 'var(--rarity-epic)' },
    { id: 'art_gold', name: 'Moeda Real', icon: '👑', desc: 'Saquear Vilas = ouro em dobro.', cost: 18, rarity: 'epic', color: 'var(--rarity-epic)' },
    { id: 'art_shield', name: 'Escudo de Aegis', icon: '🛡️', desc: 'Reduz dano recebido em 15%.', cost: 18, rarity: 'epic', color: 'var(--rarity-epic)' },
    { id: 'art_crown', name: 'Coroa da Liderança', icon: '⚜️', desc: 'Limite do exército +1.', cost: 22, rarity: 'legendary', color: 'var(--rarity-legendary)' },
    { id: 'art_hourglass', name: 'Ampulheta', icon: '⏳', desc: 'Herói cura 5 HP/turno.', cost: 20, rarity: 'epic', color: 'var(--rarity-epic)' },
    { id: 'art_wind', name: 'Capa do Vento', icon: '💨', desc: '+25% Esquiva (Tropas).', cost: 20, rarity: 'epic', color: 'var(--rarity-epic)' },
    { id: 'art_armor', name: 'Manopla de Aço', icon: '🧤', desc: '+15% Defesa Base (Tropas).', cost: 18, rarity: 'rare', color: 'var(--rarity-rare)' },
    { id: 'art_crystal', name: 'Cristal de Mana', icon: '🔮', desc: 'Herói ganha +1 Alcance e +5 ATK.', cost: 25, rarity: 'legendary', color: 'var(--rarity-legendary)' },
    { id: 'art_blood', name: 'Colar Vampírico', icon: '🩸', desc: 'Tropas ganham +20% Roubo de Vida.', cost: 22, rarity: 'epic', color: 'var(--rarity-epic)' },
    { id: 'art_umbral_seal', name: 'Selo do Umbral', icon: '👁️‍🗨️', desc: 'Todas as suas feras ganham a tag Umbral.', cost: 22, rarity: 'epic', color: 'var(--rarity-epic)' },
    { id: 'art_celestial_seal', name: 'Selo Celestial', icon: '👼', desc: 'Todas as suas feras ganham a tag Celestial.', cost: 22, rarity: 'epic', color: 'var(--rarity-epic)' },
    { id: 'art_omega', name: 'Coração do Infinito', icon: '🌌', desc: '+20 HP, +5 ATK e +1 Limite de Exército.', cost: 999, rarity: 'legendary', color: '#ff00ff' },
    { id: 'art_predator_lasso', name: 'O Laço do Predador', icon: '➰', desc: '+30% chance de Domar. Falha: O alvo revida com DANO DUPLO e fica imune à doma no turno.', cost: 30, rarity: 'epic', color: 'var(--rarity-epic)' },
    { id: 'art_bandit_badge', name: 'Insígnia do Bandido', icon: '🦹', desc: 'Recebe +2 de Ouro ao abater unidades inimigas.', cost: 20, rarity: 'rare', color: 'var(--rarity-rare)' },
];

const ITEMS = {
    'SWORD': { icon: '🗡️', name: 'Espada', desc: '+3 ATK (Multiplica por Nível).', type: 'equip', onEquip: (u, lvl) => { u.atk += 3 * lvl; }, onUnequip: (u, lvl) => { u.atk -= 3 * lvl; } },
    'SHIELD': { icon: '🛡️', name: 'Escudo', desc: '+15 HP Máx (Multiplica por Nível).', type: 'equip', onEquip: (u, lvl) => { u.maxHp += 15 * lvl; u.hp += 15 * lvl; }, onUnequip: (u, lvl) => { u.maxHp -= 15 * lvl; u.hp = Math.min(u.hp, u.maxHp); } },
    'BOW': { icon: '🏹', name: 'Arco Longo', desc: '+1 de Alcance.', type: 'equip', onEquip: (u, lvl) => { u.range += 1; }, onUnequip: (u, lvl) => { u.range -= 1; } },
    'BOOTS': { icon: '👢', name: 'Botas Aladas', desc: '+1 de Movimento.', type: 'equip', onEquip: (u, lvl) => { u.maxMp += 1; u.mp += 1; }, onUnequip: (u, lvl) => { u.maxMp -= 1; u.mp = Math.min(u.mp, u.maxMp); } }, 'APPLE': { icon: '🍎', name: 'Maçã Divina', desc: '+10 HP Máx.', type: 'equip', onEquip: (u, lvl) => { u.maxHp += 10 * lvl; u.hp += 10 * lvl; }, onUnequip: (u, lvl) => { u.maxHp -= 10 * lvl; u.hp = Math.min(u.hp, u.maxHp); } },
    'CROWN_LION': { icon: '🦁', name: 'Juba', desc: 'Liderança.', type: 'equip', onEquip: (u, lvl) => { if (!u.abilities.includes('leadership')) u.abilities.push('leadership'); }, onUnequip: (u, lvl) => { u.abilities = u.abilities.filter(a => a !== 'leadership'); } },
    'EEL_SPARK': { icon: '⚡', name: 'Centelha', desc: 'Eletricidade.', type: 'equip', onEquip: (u, lvl) => { if (!u.abilities.includes('electric')) u.abilities.push('electric'); }, onUnequip: (u, lvl) => { u.abilities = u.abilities.filter(a => a !== 'electric'); } },
    'HORSESHOE': { icon: '🧲', name: 'Ferradura', desc: 'Bater e Correr.', type: 'equip', onEquip: (u, lvl) => { if (!u.abilities.includes('hit_run')) u.abilities.push('hit_run'); }, onUnequip: (u, lvl) => { u.abilities = u.abilities.filter(a => a !== 'hit_run'); } },
    'CARROT': { icon: '🥕', name: 'Cenoura Dourada', desc: 'Ataque Rápido.', type: 'equip', onEquip: (u, lvl) => { if (!u.abilities.includes('swift')) u.abilities.push('swift'); }, onUnequip: (u, lvl) => { u.abilities = u.abilities.filter(a => a !== 'swift'); } },
    'RUSTY_SWORD': { icon: '🗡️', name: 'Espada Enferrujada', desc: '+1 ATK.', type: 'equip', onEquip: (u, lvl) => { u.atk += 1 * lvl; }, onUnequip: (u, lvl) => { u.atk -= 1 * lvl; } },
    'WOODEN_SHIELD': { icon: '🛡️', name: 'Escudo de Madeira', desc: '+5 HP Máx.', type: 'equip', onEquip: (u, lvl) => { u.maxHp += 5 * lvl; u.hp += 5 * lvl; }, onUnequip: (u, lvl) => { u.maxHp -= 5 * lvl; u.hp = Math.min(u.hp, u.maxHp); } },
    'BANDAGE': { icon: '🩹', name: 'Bandagem', desc: 'Cura 15 HP.', type: 'instant', f: async (u, g) => { u.hp = Math.min(u.maxHp, u.hp + 15); return true; } },
    'MEAT': { icon: '🍖', name: 'Isca', desc: 'Ajuda a atrair inimigos', type: 'instant', f: async (u, g) => { u.hp = Math.min(u.maxHp, u.hp + 25); return true; } },
    'MAGIC': { icon: '🔮', name: 'Pedra Mágica', desc: 'Aprende habilidade aleatória.', type: 'instant', f: async (u, g) => { let k = Object.keys(ABILITY_DESCRIPTIONS); let res = await window.learnAbility(u, k[Math.floor(Math.random() * k.length)]); return res; } },
    'SCROLL': { icon: '📜', name: 'Pergaminho', desc: 'Ganha +100 XP.', type: 'instant', f: async (u, g) => { u.addXp(100); return true; } },
    'COIN': { icon: '🪙', name: 'Moedas', desc: 'Você encontrou 2 de Ouro!', type: 'instant', f: async (u, g) => { if (u.faction === 1) { g.gold += 2; return true; } return false; } },
    'GEM': { icon: '💎', name: 'Gema', desc: 'Você encontrou 8 de Ouro!', type: 'instant', f: async (u, g) => { if (u.faction === 1) { g.gold += 8; return true; } return false; } },
    'KEY': { icon: '🗝️', name: 'Chave', desc: 'Abre Baús.', type: 'instant', f: async (u, g) => { if (u.faction === 1) { g.hasKey = true; return true; } return false; } },
    'CHEST': { icon: '🪎', name: 'Baú', desc: 'Encontrou +15 Ouro.', type: 'instant', f: async (u, g) => { if (u.faction === 1 && g.hasKey) { g.hasKey = false; g.gold += 15; return true; } return false; } },
    'EGG': { icon: '🪺', name: 'Ovo', desc: 'Ovo de Monstro.', type: 'instant', f: async (u, g) => { if (u.faction === 1) { g.hasEgg = true; return true; } return false; } },
    'POTION': { icon: '🧪', name: 'Poção Menor', desc: 'Cura 30 HP.', type: 'instant', f: async (u, g) => { u.hp = Math.min(u.maxHp, u.hp + 30); return true; } },
    'WINGS_ICARUS': { icon: '🪽', name: 'Asas de Ícaro', desc: 'Ganha atributo Voador, mas recebe 5 de dano puro todo turno.', type: 'equip', onEquip: (u, lvl) => { if (!u.abilities.includes('flying')) u.abilities.push('flying'); }, onUnequip: (u, lvl) => { u.abilities = u.abilities.filter(a => a !== 'flying'); } },
    'CATALYST': {
        icon: '💠', name: 'Catalisador', desc: 'Desperta uma habilidade extra baseada na tag da fera.', type: 'equip', onEquip: (u, lvl) => {
            let tagMap = { 'FIRE': 'burn', 'ICE': 'freeze', 'VENOM': 'poison', 'ROCK': 'counter', 'SAND': 'dodge', 'CARAPACE': 'counter', 'WING': 'swift', 'SILVESTRE': 'swift', 'UMBRAL': 'lifesteal', 'CELESTIAL': 'leadership', 'PRIMAL': 'corte_amplo', 'STALKER': 'hit_run', 'ABYSSAL': 'dodge' };
            let t = u.tags && u.tags[0]; let ab = t ? tagMap[t] : 'dodge';
            if (ab && !u.abilities.includes(ab)) u.abilities.push(ab); u._catalystAb = ab;
        }, onUnequip: (u, lvl) => { if (u._catalystAb) u.abilities = u.abilities.filter(a => a !== u._catalystAb); }
    },
};

const NODE_TYPES = {
    BATTLE: { icon: '⚔️', name: 'Batalha', color: '#4a9edd' },
    ELITE: { icon: '👹', name: 'Elite', color: '#e74c3c' },
    EVENT: { icon: '❓', name: 'Evento', color: '#9b59b6' },
    TREASURE: { icon: '💎', name: 'Tesouro', color: '#f1c40f' },
    SHOP: { icon: '💰', name: 'Mercador', color: '#2ecc71' },
    BOSS: { icon: '👑', name: 'Chefe', color: '#c9a227' },
    LAB: { icon: '🧬', name: 'Laboratório', color: '#1abc9c' }
};

const EVENTS = [
    { title: 'A Forja Sombria', icon: '🔥', desc: 'Uma forja que queima com chamas azuis e gélidas. "O metal exige sacrifício."', choices: [{ text: 'Oferenda de Sangue', desc: 'Líder perde 15% HP Máx. Ganhe item Épico.', req: () => true, action: async () => { let l = deployedRoster.find(u => u.isLeader); if (l) { l.maxHp = Math.max(1, Math.floor(l.maxHp * 0.85)); l.hp = Math.min(l.hp, l.maxHp); } await window.giveRandomArtifact('epic'); } }, { text: 'O Teste do Fogo', desc: 'Time inicia com -25% de HP. Ganhe item Raro.', req: () => true, action: async () => { deployedRoster.forEach(u => u.hp = Math.max(1, Math.floor(u.maxHp * 0.75))); await window.giveRandomArtifact('rare'); } }, { text: 'Ignorar a Forja', desc: 'Siga em frente.', req: () => true, action: async () => { } }] },
    { title: 'A Anomalia no Tabuleiro', icon: '🌌', desc: 'O terreno está distorcido. Atravessar essa zona altera as unidades.', choices: [{ text: 'Estudar Anomalia (50 Ouro)', desc: 'Uma unidade ganha +2 Movimento.', req: () => game.gold >= 50, action: async () => { game.gold -= 50; let u = await window.promptSelectUnit("Quem ganhará +2 Mov?", deployedRoster); if (u) { u.maxMp += 2; u.mp += 2; } } }, { text: 'Absorver a Energia', desc: 'Ganhe +5 ATK e perca 1 Mov.', req: () => true, action: async () => { let u = await window.promptSelectUnit("Quem absorverá a energia?", deployedRoster); if (u) { u.atk += 5; u.maxMp = Math.max(1, u.maxMp - 1); u.mp = u.maxMp; } } }, { text: 'Mapear um Desvio', desc: 'O próximo mapa não terá Vilas.', req: () => true, action: async () => { game.eventFlags.noVillages = true; } }] },
    { title: 'O Mercenário Veterano', icon: '⚔️', desc: 'Um guerreiro veterano afia a espada.', choices: [{ text: 'Comprar Herança (40 Ouro)', desc: 'Compre um Artefato Lendário.', req: () => game.gold >= 40, action: async () => { game.gold -= 40; await window.giveRandomArtifact('legendary'); } }, { text: 'Treinamento (20 Ouro)', desc: 'Uma unidade ganha 200 XP.', req: () => game.gold >= 20, action: async () => { game.gold -= 20; let u = await window.promptSelectUnit("Quem vai treinar?", deployedRoster); if (u) u.addXp(200); } }, { text: 'Tentar Roubar', desc: 'Inicia uma batalha de Chefe.', req: () => true, action: async () => { game.eventFlags.veteranBoss = true; } }, { text: 'Ignorar', desc: 'Siga em frente.', req: () => true, action: async () => { } }] },
    { title: 'O Ninho das Serpes', icon: '🥚', desc: 'Um ninho cheio de ovos...', choices: [{ text: 'Roubar um Ovo', desc: 'Ganha 1 Cobra e Artefato Raro. A Mãe VAI te emboscar!', req: () => true, action: async () => { let b = BEASTS.LAND.find(x => x.name === 'Cobra'); rosterMemory.push(new Unit({ ...b, q: 0, r: 0, faction: 1, isNew: true })); await window.giveRandomArtifact('rare'); game.eventFlags.serpentAmbush = true; } }, { text: 'Mineração Rápida', desc: 'Ganhe 50 Ouro, duas unidades perdem HP.', req: () => true, action: async () => { game.gold += 50; let u1 = await window.promptSelectUnit("Selecione a 1ª para receber dano:", deployedRoster); let u2 = await window.promptSelectUnit("Selecione a 2ª para receber dano:", deployedRoster.filter(x => x !== u1)); if (u1) u1.hp = Math.max(1, Math.floor(u1.maxHp * 0.7)); if (u2) u2.hp = Math.max(1, Math.floor(u2.maxHp * 0.7)); } }, { text: 'Retirada Silenciosa', desc: 'Esquadrão ganha +30 XP.', req: () => true, action: async () => { deployedRoster.forEach(u => u.addXp(30)); } }] },
    { title: 'Campo Assombrado', icon: '👻', desc: 'Espíritos repetem suas táticas de combate.', choices: [{ text: 'Estudo Macabro (-15% HP)', desc: 'Aprende Corte Amplo.', req: () => deployedRoster.some(u => u.range === 1), action: async () => { let u = await window.promptSelectUnit("Quem aprenderá Corte Amplo?", deployedRoster.filter(x => x.range === 1)); if (u) u.abilities.push('corte_amplo'); deployedRoster.forEach(x => x.hp = Math.max(1, Math.floor(x.maxHp * 0.85))); } }, { text: 'Purificar Terreno (15 Ouro)', desc: 'Receba 2 itens Épicos. Inimigos fracos.', req: () => game.gold >= 15, action: async () => { game.gold -= 15; await window.giveRandomArtifact('epic'); await window.giveRandomArtifact('epic'); game.eventFlags.hauntedCurse = true; } }, { text: 'Marchar às Cegas', desc: 'No próximo combate, suas unidades iniciam espalhadas.', req: () => true, action: async () => { game.eventFlags.scatterUnits = true; } }] },
];

// ==========================================
// ESTRUTURAS DO REINO
// ==========================================
const BUILDINGS = {
    CASTLE: { id: 'CASTLE', name: 'Castelo Real', icon: '🏰', cost: {}, desc: 'O coração do seu Reino. Não pode ser destruído.', terrains: ['PLAINS', 'FOREST', 'MOUNTAIN', 'WATER', 'SNOW', 'DESERT'] },
    STABLE: { id: 'STABLE', name: 'Estábulo', icon: '🐎', cost: { wood: 0, stone: 0 }, desc: 'O Mercador sempre venderá um Cavalo extra.', terrains: ['PLAINS', 'DESERT', 'SNOW'] },
    CHURCH: { id: 'CHURCH', name: 'Igreja', icon: '⛪', cost: { stone: 0, sand: 0, wood: 0 }, desc: 'Recebe uma pomba Celestial imediatamente.', terrains: ['PLAINS', 'MOUNTAIN', 'SNOW'] },
    MINE: { id: 'MINE', name: 'Mina', icon: '⛏️', cost: { wood: 0, stone: 0 }, desc: 'Gera +3 Pedra (Nv1), +2 Ferro (Nv2) e +5 Ouro (Nv3) ao vencer.', terrains: ['MOUNTAIN'] },
    FORGE: { id: 'FORGE', name: 'Forja de Monstros', icon: '⚒️', cost: { wood: 0, stone: 0 }, desc: 'Forje equipamentos especiais usando partes caçadas de feras.', terrains: ['MOUNTAIN', 'PLAINS'] },
    BLACKSMITH: { id: 'BLACKSMITH', name: 'Ferreiro', icon: '⚔️', cost: { wood: 0, stone: 0 }, desc: 'Forje armas e armaduras comuns usando Ouro.', terrains: ['PLAINS', 'MOUNTAIN'] },
    BIOTERIUM: { id: 'BIOTERIUM', name: 'Biotério', icon: '🐾', cost: { wood: 0, stone: 0 }, desc: 'Descansa as feras da Box. Elas curam todo HP e adquirem afinidade de terreno com o local onde o Biotério está construído!', terrains: ['PLAINS', 'FOREST', 'MOUNTAIN', 'WATER', 'SNOW', 'DESERT'] },
    APOTHECARY: { id: 'APOTHECARY', name: 'Botica', icon: '🧪', cost: { wood: 0, stone: 0 }, desc: 'Produza itens de campo (Poções, Bandagens) usando Ervas e Venenos.', terrains: ['FOREST', 'PLAINS'] }, LUMBERMILL: { id: 'LUMBERMILL', name: 'Madeireira', icon: '🪓', cost: { stone: 0, wood: 0 }, desc: 'Gera +3 Madeira ao vencer batalhas.', terrains: ['FOREST'] },
    FISHINGCAMP: { id: 'FISHINGCAMP', name: 'Campo de Pesca', icon: '🎣', cost: { wood: 0 }, desc: 'Gera +3 Escamas ao vencer batalhas.', terrains: ['WATER'] },
    SANDPIT: { id: 'SANDPIT', name: 'Extrator de Areia', icon: '🐪', cost: { wood: 0, stone: 0 }, desc: 'Gera +3 Areia ao vencer batalhas.', terrains: ['DESERT'] },
    PARK: { id: 'PARK', name: 'Parque', icon: '⛲', cost: { stone: 0, sand: 0 }, desc: 'Grande chance de domar feras Nv1 com HP cheio.', terrains: ['PLAINS', 'FOREST', 'DESERT', 'SNOW'] },
    FARM: { id: 'FARM', name: 'Fazenda', icon: '🌾', cost: { wood: 5 }, desc: 'Todas as feras ganham +10 HP Máx.', terrains: ['PLAINS'] },
    VILLAGE: { id: 'VILLAGE', name: 'Vila', icon: '🏘️', desc: 'Aumenta o limite máximo de Exército em 1.', terrains: [], cost: {} }, BESTIARY: { id: 'BESTIARY', name: 'Bestiário', icon: '📖', cost: { wood: 0, scales: 0 }, desc: 'Aumenta a chance global de domar feras.', terrains: ['PLAINS', 'FOREST', 'SNOW'] },
    MARKET: { id: 'MARKET', name: 'Mercado', icon: '⚖️', cost: { wood: 0, stone: 0 }, desc: 'Permite a troca de recursos básicos por ouro e vice-versa.', terrains: ['PLAINS', 'DESERT', 'SNOW'] },
    CRYSTAL_TOWER: { id: 'CRYSTAL_TOWER', name: 'Torre de Cristal', icon: '🔮', cost: { stone: 0, sand: 0 }, desc: 'O líder inicia o 1º turno do combate com +1 de Mana.', terrains: ['MOUNTAIN', 'SNOW'] },
    SHADOW_ALTAR: { id: 'SHADOW_ALTAR', name: 'Altar das Sombras', icon: '🪦', cost: { stone: 0, scales: 0 }, desc: 'Sacrifica feras por recursos (Apenas Líderes Umbrais).', terrains: ['MOUNTAIN', 'DESERT', 'FOREST'] },
    BARRACKS: { id: 'BARRACKS', name: 'Quartel', icon: '⛺', cost: { wood: 0, stone: 0 }, desc: 'Recrute feras que compartilham a afinidade do seu Líder.', terrains: ['PLAINS', 'DESERT'] },
    LIBRARY: { id: 'LIBRARY', name: 'Biblioteca', icon: '📚', desc: 'Gera 1 DNA 🧬 ao final de cada combate vencido.', terrains: ['PLAINS', 'SNOW'], cost: { wood: 0, stone: 0 } }, PORT: { id: 'PORT', name: 'Porto', icon: '⚓', cost: { wood: 0, stone: 0 }, desc: 'Gera +5 Ouro ao vencer batalhas.', terrains: ['WATER'] },
    TRAP_MAKER: { id: 'TRAP_MAKER', name: 'Armadilheiro', icon: '🕸️', desc: 'Produz Iscas e Redes por batalha.', terrains: ['FOREST', 'PLAINS'], cost: { wood: 0, stone: 0 } }, RESIDENCE: { id: 'RESIDENCE', name: 'Residência', icon: '🏠', desc: 'Recupera 10% do HP perdido das feras a cada fase. Duas juntas formam uma Vila.', terrains: ['PLAINS', 'FOREST', 'SNOW', 'DESERT'], cost: { wood: 0, stone: 0 } },
};

const LORE_FACTIONS = {
    'SILVESTRE': { id: 'SILVESTRE', name: 'O Círculo Silvestre', startNode: 'WEST' },
    'ORDEM': { id: 'ORDEM', name: 'A Ordem Áurea', startNode: 'NORTH' },
    'SOMBRAS': { id: 'SOMBRAS', name: 'A Corte Sombria', startNode: 'SOUTH' },
    'FORASTEIROS': { id: 'FORASTEIROS', name: 'Os Forasteiros', startNode: 'EAST' },
    'PRIMORDIAL': { id: 'PRIMORDIAL', name: 'Os Primordiais', startNode: 'NW' },
    'DESERTO': { id: 'DESERTO', name: 'Guardiões das Areias', startNode: 'SE' },
    'ABISSAL': { id: 'ABISSAL', name: 'Terrores das Profundezas', startNode: 'SW' },
    'TEMPESTADE': { id: 'TEMPESTADE', name: 'Senhores da Tormenta', startNode: 'NE' }
};

// ==========================================
// MAPAS CUSTOMIZADOS (Vindos de arquivos externos)
// ==========================================
window.CUSTOM_MAPS = window.CUSTOM_MAPS || {};