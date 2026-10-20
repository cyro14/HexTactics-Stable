// ==========================================
// HEXIS — pintura procedural do mapa de regiões
// "O Tabuleiro Estilhaçado": 9 fragmentos de hexágonos
// (biomas pintados) flutuando sobre o vazio, com névoa, vórtice
// central e brilhos de estado (conquistado / atacável).
// Uso: window.MacroMap.mount(container, CONTINENT_REGIONS, { conquered, attackable, centerLocked })
// ==========================================
(() => {
    if (window.MacroMap) return;

    // Paletas por bioma [r,g,b] + decoração pintada nos tiles
    const BIOMES = {
        FOREST:   { base: [46, 108, 62],   glow: 'rgba(64,150,90,.22)',   decor: 'trees' },
        SNOW:     { base: [166, 184, 206], glow: 'rgba(150,190,230,.22)', decor: 'snow' },
        DESERT:   { base: [196, 160, 88],  glow: 'rgba(220,190,120,.18)', decor: 'dunes' },
        SWAMP:    { base: [84, 96, 50],    glow: 'rgba(120,140,80,.18)',  decor: 'pools' },
        MOUNTAIN: { base: [116, 110, 100], glow: 'rgba(160,150,140,.18)', decor: 'peaks' },
        PLAINS:   { base: [140, 154, 82],  glow: 'rgba(170,190,110,.18)', decor: 'grass' },
        ASHES:    { base: [120, 52, 40],   glow: 'rgba(230,110,60,.25)',  decor: 'embers' },
        WATER:    { base: [50, 94, 138],   glow: 'rgba(80,150,220,.22)',  decor: 'waves' },
        CENTER:   { base: [62, 44, 84],    glow: 'rgba(160,90,220,.28)',  decor: 'vortex' }
    };

    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    const REGION_SEEDS = { WEST: 11, NORTH: 22, EAST: 33, SOUTH: 44, NW: 55, NE: 66, SE: 77, SW: 88, CENTER: 99 };
    const INTER_IDS = ['NW', 'NE', 'SE', 'SW'];

    function hexPath(c, cx, cy, r) {
        c.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = Math.PI / 3 * i;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.closePath();
    }

    // ---------- instância ----------
    let inst = null;

    function mount(container, regions, state) {
        if (inst) inst.destroy();

        const canvas = document.createElement('canvas');
        canvas.id = 'macro-shard-canvas';
        canvas.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; z-index:0;';
        container.insertBefore(canvas, container.firstChild);

        const ctx = canvas.getContext('2d');
        const screen = container.closest('.layer');
        const owner = container;
        let W = 0, H = 0, dpr = 1;
        let base = null; // camada estática pré-renderizada
        let shards = [];
        let mist = [];
        let sparkPools = [];
        let time = 0, lastTs = null, raf = 0;
        const conqueredSet = new Set((state && state.conquered) || []);
        const attackSet = new Set((state && state.attackable) || []);
        const centerLocked = !!(state && state.centerLocked);

        // ---- tiles de um fragmento (cluster axial de raio 2) ----
        function tileList(rHex, rand, ragged) {
            const list = [];
            for (let q = -2; q <= 2; q++) {
                for (let r = Math.max(-2, -2 - q); r <= Math.min(2, 2 - q); r++) {
                    const dist = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
                    if (dist > 2) continue;
                    if (ragged && dist === 2 && rand() < 0.35) continue; // borda estilhaçada
                    list.push({ q, r });
                }
            }
            return list;
        }

        function paintShard(c, s) {
            const B = BIOMES[s.biome] || BIOMES.PLAINS;
            const rand = mulberry32(REGION_SEEDS[s.id] || 7);
            const rHex = s.shardR / 4.6;

            // brilho do bioma sob o fragmento (flutuação)
            const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.shardR * 1.35);
            g.addColorStop(0, B.glow);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = g;
            c.beginPath(); c.arc(s.x, s.y, s.shardR * 1.35, 0, Math.PI * 2); c.fill();

            const tiles = tileList(rHex, rand, s.ragged);
            for (const t of tiles) {
                const tx = s.x + rHex * 1.5 * t.q;
                const ty = s.y + rHex * Math.sqrt(3) * (t.r + t.q / 2);
                const jitter = 0.82 + 0.34 * rand();
                let base = B.base.map(v => Math.min(255, v * jitter));
                if (s.id === 'CENTER' && centerLocked) {
                    // névoa de guerra: centro dessaturado e cinza
                    const lum = 0.3 * base[0] + 0.6 * base[1] + 0.1 * base[2];
                    base = [lum, lum, lum * 1.05];
                }
                c.fillStyle = `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`;
                hexPath(c, tx, ty, rHex * 0.94);
                c.fill();
                // contorno escuro entre tiles
                c.strokeStyle = 'rgba(0,0,0,.35)';
                c.lineWidth = 1;
                hexPath(c, tx, ty, rHex * 0.94);
                c.stroke();
                // luz da lua na aresta superior
                c.strokeStyle = 'rgba(255,240,200,.18)';
                c.lineWidth = 1.4;
                c.beginPath();
                c.moveTo(tx - rHex * 0.94, ty - rHex * 0.55);
                c.lineTo(tx, ty - rHex * 0.94);
                c.lineTo(tx + rHex * 0.94, ty - rHex * 0.55);
                c.stroke();

                // conquistado: tinta azulada + faísca dourada ocasional
                if (conqueredSet.has(s.id)) {
                    c.fillStyle = 'rgba(74,158,221,.16)';
                    hexPath(c, tx, ty, rHex * 0.94);
                    c.fill();
                }

                // decorações por bioma
                paintDecor(c, B.decor, tx, ty, rHex, rand, base, s.id);
            }

            // aro dourado no fragmento conquistado
            if (conqueredSet.has(s.id)) {
                c.strokeStyle = 'rgba(232,200,74,.55)';
                c.lineWidth = 1.6;
                hexPath(c, s.x, s.y, s.shardR * 1.08);
                c.stroke();
            }
        }

        function paintDecor(c, kind, tx, ty, rHex, rand, base, regId) {
            switch (kind) {
                case 'trees':
                    if (rand() < 0.5) {
                        const h = rHex * (0.5 + rand() * 0.3);
                        c.fillStyle = `rgba(20,45,28,${0.55 + rand() * 0.3})`;
                        c.beginPath();
                        c.moveTo(tx, ty - h);
                        c.lineTo(tx - h * 0.4, ty + h * 0.25);
                        c.lineTo(tx + h * 0.4, ty + h * 0.25);
                        c.closePath(); c.fill();
                    }
                    break;
                case 'snow':
                    if (rand() < 0.6) {
                        c.fillStyle = 'rgba(255,255,255,.5)';
                        c.beginPath(); c.arc(tx + (rand() - .5) * rHex, ty + (rand() - .5) * rHex, rHex * 0.07, 0, Math.PI * 2); c.fill();
                    }
                    break;
                case 'dunes':
                    if (rand() < 0.45) {
                        c.strokeStyle = 'rgba(255,235,180,.25)';
                        c.lineWidth = 1;
                        c.beginPath();
                        c.arc(tx, ty + rHex * .2, rHex * .5, Math.PI * 1.15, Math.PI * 1.85);
                        c.stroke();
                    }
                    break;
                case 'pools':
                    if (rand() < 0.4) {
                        c.fillStyle = 'rgba(30,45,60,.55)';
                        c.beginPath(); c.ellipse(tx, ty, rHex * .45, rHex * .22, rand() * 3, 0, Math.PI * 2); c.fill();
                    }
                    break;
                case 'peaks':
                    if (rand() < 0.55) {
                        const h = rHex * (0.55 + rand() * 0.35);
                        c.fillStyle = 'rgba(70,66,60,.75)';
                        c.beginPath();
                        c.moveTo(tx, ty - h);
                        c.lineTo(tx - h * .5, ty + h * .3);
                        c.lineTo(tx + h * .5, ty + h * .3);
                        c.closePath(); c.fill();
                        c.fillStyle = 'rgba(255,255,255,.35)';
                        c.beginPath();
                        c.moveTo(tx, ty - h);
                        c.lineTo(tx - h * .18, ty - h * .35);
                        c.lineTo(tx + h * .18, ty - h * .35);
                        c.closePath(); c.fill();
                    }
                    break;
                case 'grass':
                    if (rand() < 0.5) {
                        c.strokeStyle = 'rgba(200,215,120,.3)';
                        c.lineWidth = 1;
                        c.beginPath();
                        c.moveTo(tx - rHex * .3, ty + rHex * .2);
                        c.lineTo(tx - rHex * .1, ty - rHex * .2);
                        c.moveTo(tx + rHex * .25, ty + rHex * .2);
                        c.lineTo(tx + rHex * .05, ty - rHex * .15);
                        c.stroke();
                    }
                    break;
                case 'waves':
                    if (rand() < 0.55) {
                        c.strokeStyle = 'rgba(160,210,255,.3)';
                        c.lineWidth = 1;
                        c.beginPath();
                        c.arc(tx, ty, rHex * .5, Math.PI * 1.1, Math.PI * 1.9);
                        c.stroke();
                    }
                    break;
                // 'embers' e 'vortex' são dinâmicos (animados no loop)
            }
        }

        // ---------- construção ----------
        function build() {
            W = owner.clientWidth || 800;
            H = owner.clientHeight || 460;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.max(1, Math.floor(W * dpr));
            canvas.height = Math.max(1, Math.floor(H * dpr));

            shards = [];
            Object.values(regions).forEach(reg => {
                const isInter = INTER_IDS.includes(reg.id);
                const isMain = ['WEST', 'NORTH', 'EAST', 'SOUTH'].includes(reg.id);
                shards.push({
                    id: reg.id, biome: reg.biome,
                    x: W * reg.x / 100, y: H * reg.y / 100,
                    shardR: Math.min(W, H) * (reg.id === 'CENTER' ? 0.21 : (isMain ? 0.20 : 0.15)),
                    ragged: !isMain && reg.id !== 'CENTER'
                });
            });

            // névoa do vazio
            const rand = mulberry32(4242);
            mist = [];
            for (let i = 0; i < 4; i++) {
                mist.push({ x: rand() * W, y: H * (0.15 + rand() * 0.7), rx: W * (0.2 + rand() * 0.25), ry: 18 + rand() * 30, sp: 3 + rand() * 8, a: 0.05 + rand() * 0.05 });
            }

            // faíscas douradas por fragmento conquistado
            sparkPools = [];
            shards.forEach(s => {
                if (!conqueredSet.has(s.id)) return;
                for (let i = 0; i < 3; i++) {
                    sparkPools.push({
                        s, ph: Math.random() * Math.PI * 2,
                        speed: 0.4 + Math.random() * 0.5,
                        dx: (Math.random() - 0.5) * s.shardR,
                        r: 1 + Math.random() * 1.4
                    });
                }
            });

            // ---------- camada estática (oceano + fragmentos) ----------
            base = document.createElement('canvas');
            base.width = canvas.width;
            base.height = canvas.height;
            const b = base.getContext('2d');
            b.setTransform(dpr, 0, 0, dpr, 0, 0);

            // vazio/oceano
            const og = b.createLinearGradient(0, 0, 0, H);
            og.addColorStop(0, '#04101a');
            og.addColorStop(0.5, '#071a26');
            og.addColorStop(1, '#0a2434');
            b.fillStyle = og;
            b.fillRect(0, 0, W, H);

            // pontinhos de profundidade
            const dr = mulberry32(777);
            for (let i = 0; i < 90; i++) {
                b.fillStyle = `rgba(140,200,230,${0.03 + dr() * 0.05})`;
                b.beginPath();
                b.arc(dr() * W, dr() * H, 0.6 + dr() * 1.1, 0, Math.PI * 2);
                b.fill();
            }

            shards.forEach(s => paintShard(b, s));

            // rosa dos ventos (canto inferior direito)
            drawCompass(b, W - 54, H - 54, 30);

            // vinheta
            const vg = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
            vg.addColorStop(0, 'rgba(0,0,0,0)');
            vg.addColorStop(1, 'rgba(2,5,10,.5)');
            b.fillStyle = vg;
            b.fillRect(0, 0, W, H);
        }

        function drawCompass(c, cx, cy, r) {
            c.save();
            c.strokeStyle = 'rgba(201,162,39,.4)';
            c.fillStyle = 'rgba(201,162,39,.4)';
            c.lineWidth = 1;
            c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
            c.beginPath(); c.arc(cx, cy, r * 0.62, 0, Math.PI * 2); c.stroke();
            for (let i = 0; i < 8; i++) {
                const a = Math.PI / 4 * i;
                const len = i % 2 === 0 ? r * 1.35 : r * 1.05;
                c.beginPath();
                c.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
                c.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
                c.stroke();
            }
            // ponteiro norte
            c.beginPath();
            c.moveTo(cx, cy - r * 1.5);
            c.lineTo(cx - 4, cy - r * 0.55);
            c.lineTo(cx + 4, cy - r * 0.55);
            c.closePath();
            c.fill();
            c.restore();
        }

        // ---------- frame dinâmico ----------
        function frame(ts) {
            raf = requestAnimationFrame(frame);
            if (screen && screen.classList.contains('hidden')) { lastTs = ts; return; }
            if (lastTs === null) lastTs = ts;
            const dt = Math.min((ts - lastTs) / 1000, 0.05);
            lastTs = ts;
            time += dt;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            if (base) ctx.drawImage(base, 0, 0, W, H);

            // névoa do vazio
            for (const m of mist) {
                const x = ((m.x + time * m.sp) % (W + m.rx * 2)) - m.rx;
                ctx.save();
                ctx.translate(x, m.y);
                ctx.scale(1, m.ry / m.rx);
                const g = ctx.createRadialGradient(0, 0, 0, 0, 0, m.rx);
                g.addColorStop(0, `rgba(130,170,200,${m.a})`);
                g.addColorStop(1, 'rgba(130,170,200,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(0, 0, m.rx, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }

            for (const s of shards) {
                const isAttack = attackSet.has(s.id) && !conqueredSet.has(s.id);

                // pulso vermelho nos setores atacáveis
                if (isAttack) {
                    const a = 0.10 + 0.10 * Math.sin(time * 2.2);
                    const g = ctx.createRadialGradient(s.x, s.y, s.shardR * 0.2, s.x, s.y, s.shardR * 1.5);
                    g.addColorStop(0, `rgba(217,79,61,${a + 0.12})`);
                    g.addColorStop(1, 'rgba(217,79,61,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.shardR * 1.5, 0, Math.PI * 2); ctx.fill();
                }

                // vórtice do Centro
                if (s.id === 'CENTER') {
                    ctx.save();
                    ctx.translate(s.x, s.y);
                    ctx.rotate(time * 0.25);
                    for (let i = 0; i < 3; i++) {
                        const rr = s.shardR * (0.55 + i * 0.33);
                        ctx.strokeStyle = `rgba(160,90,220,${0.35 - i * 0.08})`;
                        ctx.lineWidth = 1.5;
                        ctx.setLineDash([rr * 0.6, rr * 0.45]);
                        ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
                    }
                    ctx.setLineDash([]);
                    ctx.restore();
                }

                // brasas na Fenda Vulcânica / Fenda do Ômega
                if (s.biome === 'ASHES' && !(s.id === 'CENTER' && centerLocked)) {
                    for (let i = 0; i < 6; i++) {
                        const fl = 0.5 + 0.5 * Math.sin(time * 1.6 + i * 1.05);
                        const ex = s.x + Math.cos(i * 2.4 + s.id.length) * s.shardR * 0.75;
                        const rise = (time * 7 + i * 9) % s.shardR;
                        const ey = s.y + s.shardR * 0.55 - rise;
                        ctx.globalAlpha = 0.4 * fl;
                        ctx.fillStyle = '#ff9c4a';
                        ctx.beginPath(); ctx.arc(ex, ey, 1.3, 0, Math.PI * 2); ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                }

                // névoa de guerra sobre o Centro bloqueado
                if (s.id === 'CENTER' && centerLocked) {
                    const a = 0.22 + 0.06 * Math.sin(time * 0.8);
                    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.shardR * 1.4);
                    g.addColorStop(0, `rgba(140,150,160,${a})`);
                    g.addColorStop(1, 'rgba(140,150,160,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.shardR * 1.4, 0, Math.PI * 2); ctx.fill();
                }
            }

            // faíscas douradas dos territórios conquistados
            for (const p of sparkPools) {
                const cyc = (time * p.speed + p.ph) % 2;
                const py = p.s.y + p.s.shardR * 0.6 - cyc * p.s.shardR * 0.9;
                const fl = 0.4 + 0.6 * Math.sin(time * 3 + p.ph);
                ctx.globalAlpha = 0.55 * fl * (1 - cyc / 2);
                ctx.fillStyle = '#e8c84a';
                ctx.beginPath();
                ctx.arc(p.s.x + p.dx * (1 - cyc / 2), py, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        function onResize() { build(); }

        build();
        window.addEventListener('resize', onResize);
        raf = requestAnimationFrame(frame);

        inst = {
            args: [container, regions, state],
            destroy() {
                cancelAnimationFrame(raf);
                window.removeEventListener('resize', onResize);
                canvas.remove();
                if (inst === this) inst = null;
            }
        };
    }

    window.MacroMap = { mount };
})();
