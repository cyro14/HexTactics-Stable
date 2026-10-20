// ==========================================
// FUNDO ANIMADO DO MENU PRINCIPAL
// Cena procedural estilo "fantasia indie" (referência: Battle for Wesnoth)
// Céu crepuscular + lua + montanhas + ilhas hexagonais flutuantes + brasas
// ==========================================
(() => {
    const menu = document.getElementById('main-menu');
    const canvas = document.getElementById('menu-canvas');
    if (!menu || !canvas) return;
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0, dpr = 1;
    let time = 0;
    let lastTs = null;

    // ---- RNG determinístico (cena estável entre resizes) ----
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // ---- Ruído 1D (silhuetas de montanha) ----
    function makeRidge(seed, octaves) {
        const rand = mulberry32(seed);
        const layers = [];
        for (let o = 0; o < octaves; o++) {
            const n = 6 << o;
            const pts = [];
            for (let i = 0; i <= n; i++) pts.push(rand());
            layers.push({ n, pts });
        }
        return (x) => {
            let v = 0, w = 1, tw = 0;
            for (const L of layers) {
                const p = x * L.n;
                const i = Math.floor(p) % L.n;
                const i2 = (i + 1) % L.n;
                const f = p - Math.floor(p);
                const sm = f * f * (3 - 2 * f);
                v += w * (L.pts[i] * (1 - sm) + L.pts[i2] * sm);
                tw += w; w *= 0.55;
            }
            return v / tw;
        };
    }

    const ridgeFar = makeRidge(1337, 5);
    const ridgeMid = makeRidge(777, 5);
    const ridgeNear = makeRidge(424242, 5);
    const ridgeFore = makeRidge(999, 4);

    // ---- Objetos da cena ----
    let stars = [], embers = [], islands = [], fogBlobs = [];

    function hexPath(cx, cy, r, rot) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = rot + Math.PI / 3 * i;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    function init() {
        const rand = mulberry32(20240613);
        stars = [];
        const nStars = Math.floor(W * H / 4500);
        for (let i = 0; i < nStars; i++) {
            stars.push({
                x: rand() * W, y: rand() * H * 0.65,
                r: rand() * 1.3 + 0.3,
                tw: rand() * Math.PI * 2,
                sp: 0.5 + rand() * 1.5
            });
        }
        embers = [];
        for (let i = 0; i < 38; i++) {
            embers.push({
                x: rand() * W, y: rand() * H,
                vy: 6 + rand() * 14,
                sway: 8 + rand() * 18,
                ph: rand() * Math.PI * 2,
                r: rand() * 1.8 + 0.6,
                a: 0.15 + rand() * 0.5
            });
        }
        // Ilhas hexagonais flutuantes ("O Tabuleiro Estilhaçado")
        islands = [];
        const defs = [
            { fx: 0.16, fy: 0.30, fr: 0.075, seed: 1 },
            { fx: 0.85, fy: 0.24, fr: 0.055, seed: 2 },
            { fx: 0.68, fy: 0.46, fr: 0.09, seed: 3 },
            { fx: 0.32, fy: 0.55, fr: 0.045, seed: 4 }
        ];
        for (const d of defs) {
            if (W < 640 && d.seed % 2 === 0) continue; // menos ilhas no mobile
            const r = Math.min(W, H) * d.fr;
            const treesN = 2 + Math.floor(rand() * 3);
            const trees = [];
            for (let i = 0; i < treesN; i++) {
                trees.push({ tx: (rand() - 0.5) * 1.1, th: 0.35 + rand() * 0.45 });
            }
            islands.push({
                x: d.fx * W, y: d.fy * H, r,
                ph: rand() * Math.PI * 2,
                bob: 3 + rand() * 5,
                drift: 6 + rand() * 10,
                trees, seed: d.seed
            });
        }
        fogBlobs = [];
        for (let i = 0; i < 5; i++) {
            fogBlobs.push({
                x: rand() * W, y: H * (0.62 + rand() * 0.16),
                rx: W * (0.25 + rand() * 0.3), ry: 20 + rand() * 45,
                sp: 4 + rand() * 10, a: 0.05 + rand() * 0.06
            });
        }
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth || menu.clientWidth;
        H = canvas.clientHeight || menu.clientHeight;
        canvas.width = Math.max(1, Math.floor(W * dpr));
        canvas.height = Math.max(1, Math.floor(H * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        init();
    }

    // ---- Camadas do desenho ----
    function drawSky() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#070a1c');
        g.addColorStop(0.42, '#141033');
        g.addColorStop(0.68, '#2a1a3e');
        g.addColorStop(0.82, '#43284a');
        g.addColorStop(1, '#180f22');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // Estrelas
        for (const s of stars) {
            const tw = 0.5 + 0.5 * Math.sin(time * s.sp + s.tw);
            ctx.globalAlpha = 0.25 + 0.6 * tw;
            ctx.fillStyle = '#e8e4ff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * (0.7 + 0.4 * tw), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Lua
        const mx = W * 0.80, my = H * 0.20, mr = Math.min(W, H) * 0.055;
        const glow = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 6);
        glow.addColorStop(0, 'rgba(232,214,160,0.30)');
        glow.addColorStop(0.4, 'rgba(200,170,110,0.10)');
        glow.addColorStop(1, 'rgba(200,170,110,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
        ctx.fillStyle = '#efe3b8';
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(190,170,130,0.5)';
        ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.11, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + mr * 0.1, my - mr * 0.45, mr * 0.08, 0, Math.PI * 2); ctx.fill();
    }

    function drawMountains() {
        const layers = [
            { ridge: ridgeFar, base: 0.66, amp: 0.16, color: '#1b1f3a' },
            { ridge: ridgeMid, base: 0.72, amp: 0.20, color: '#12152b' },
            { ridge: ridgeNear, base: 0.80, amp: 0.16, color: '#0b0d1d' }
        ];
        for (const L of layers) {
            ctx.fillStyle = L.color;
            ctx.beginPath();
            ctx.moveTo(0, H);
            const step = Math.max(4, W / 220);
            for (let x = 0; x <= W + step; x += step) {
                const u = x / W;
                let v = L.ridge(u);
                v = 1 - Math.abs(2 * v - 1); // cristas afiadas
                const y = H * (L.base - L.amp * v);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(W, H);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawIslands() {
        for (const isl of islands) {
            const cx = isl.x + Math.sin(time * 0.1 + isl.ph) * isl.drift;
            const cy = isl.y + Math.sin(time * 0.35 + isl.ph) * isl.bob;
            const r = isl.r;

            // brilho de aura
            const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.6);
            glow.addColorStop(0, 'rgba(201,162,39,0.10)');
            glow.addColorStop(1, 'rgba(201,162,39,0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2); ctx.fill();

            // fragmento suspenso abaixo (pedaço quebrado)
            ctx.fillStyle = '#0a0d18';
            hexPath(cx, cy + r * 1.7, r * 0.28, Math.PI / 6 + time * 0.05);
            ctx.fill();

            // corpo da ilha (hex apontando p/ baixo)
            ctx.fillStyle = '#0d1120';
            hexPath(cx, cy, r, Math.PI / 6);
            ctx.fill();
            // topo iluminado pela lua
            ctx.save();
            hexPath(cx, cy, r, Math.PI / 6);
            ctx.clip();
            const topG = ctx.createLinearGradient(cx, cy - r, cx, cy + r * 0.3);
            topG.addColorStop(0, 'rgba(64,52,34,0.95)');
            topG.addColorStop(0.35, 'rgba(28,26,32,0.6)');
            topG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = topG;
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
            ctx.restore();
            // contorno dourado sutil (luz da lua na borda)
            ctx.strokeStyle = 'rgba(201,162,39,0.35)';
            ctx.lineWidth = 1.2;
            hexPath(cx, cy, r, Math.PI / 6);
            ctx.stroke();

            // arvorezinhas em silhueta
            ctx.fillStyle = '#070a12';
            for (const t of isl.trees) {
                const tx = cx + t.tx * r;
                const th = t.th * r * 0.8;
                ctx.beginPath();
                ctx.moveTo(tx, cy - r * 0.52);
                ctx.lineTo(tx - th * 0.35, cy - r * 0.52 - th);
                ctx.lineTo(tx + th * 0.35, cy - r * 0.52 - th);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    function drawFog() {
        for (const f of fogBlobs) {
            const x = ((f.x + time * f.sp) % (W + f.rx * 2)) - f.rx;
            ctx.save();
            ctx.translate(x, f.y);
            ctx.scale(1, f.ry / f.rx);
            const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, f.rx);
            g2.addColorStop(0, `rgba(150,150,200,${f.a})`);
            g2.addColorStop(1, 'rgba(150,150,200,0)');
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.arc(0, 0, f.rx, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawForeground() {
        // terreno em primeiro plano
        const baseY = H * 0.86;
        ctx.fillStyle = '#05060c';
        ctx.beginPath();
        ctx.moveTo(0, H);
        const step = Math.max(4, W / 160);
        for (let x = 0; x <= W + step; x += step) {
            const u = x / W;
            const v = ridgeFore(u);
            ctx.lineTo(x, baseY + Math.sin(u * 3) * 6 + v * H * 0.05);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();

        // linhas de hex mágicas (ley lines) sobre o terreno
        const r = Math.min(W, H) * 0.07;
        const rot = Math.PI / 6;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, baseY - r, W, H - baseY + r);
        ctx.clip();
        ctx.strokeStyle = 'rgba(201,162,39,0.10)';
        ctx.lineWidth = 1;
        const hStep = r * Math.sqrt(3);
        const vStep = r * 1.5;
        for (let row = -1; row * vStep < H + vStep; row++) {
            for (let col = -1; col * hStep < W + hStep; col++) {
                const cx = col * hStep + (row % 2 ? hStep / 2 : 0);
                const cy = baseY + row * vStep;
                hexPath(cx, cy, r, rot);
                ctx.stroke();
            }
        }
        // nós brilhantes (runas pulsantes)
        for (let i = 0; i < 5; i++) {
            const nx = W * (0.12 + 0.19 * i) + Math.sin(i * 7) * 10;
            const ny = baseY + H * 0.06 + (i % 2) * H * 0.04;
            const pul = 0.25 + 0.2 * Math.sin(time * 1.4 + i * 2);
            const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, 14);
            g.addColorStop(0, `rgba(232,200,74,${pul})`);
            g.addColorStop(1, 'rgba(232,200,74,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(nx, ny, 14, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    function drawEmbers(dt) {
        for (const p of embers) {
            p.y -= p.vy * dt;
            if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
            const x = p.x + Math.sin(time * 0.8 + p.ph) * p.sway;
            const fl = 0.6 + 0.4 * Math.sin(time * 3 + p.ph);
            ctx.globalAlpha = p.a * fl;
            ctx.fillStyle = '#e8c84a';
            ctx.beginPath();
            ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawVignette() {
        const g = ctx.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.3, W / 2, H * 0.42, Math.max(W, H) * 0.75);
        g.addColorStop(0, 'rgba(4,5,10,0)');
        g.addColorStop(1, 'rgba(4,5,10,0.62)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    function frame(ts) {
        requestAnimationFrame(frame);
        if (menu.classList.contains('hidden')) { lastTs = ts; return; }
        if (lastTs === null) lastTs = ts;
        const dt = Math.min((ts - lastTs) / 1000, 0.05);
        lastTs = ts;
        time += dt;

        drawSky();
        drawMountains();
        drawIslands();
        drawFog();
        drawForeground();
        drawEmbers(dt);
        drawVignette();
    }

    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);
})();
