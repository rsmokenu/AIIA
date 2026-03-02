class TacticalMap {
    constructor(id) {
        this.c = document.getElementById(id); this.ctx = this.c.getContext('2d');
        this.bots = new Map(); this.pulses = []; this.processed = new Set();
        this.internet = { name: 'INTERNET', x: 0.5, y: 0.5, color: '#f472b6' };
        this.currentTasks = []; this.lastUpdate = Date.now();
        window.addEventListener('resize', () => this.resize());
    }
    resize() { 
        const r = this.c.parentElement.getBoundingClientRect(); 
        this.c.width = r.width; this.c.height = r.height; 
    }
    start() { 
        const anim = () => { this.up(); this.dr(); requestAnimationFrame(anim); }; 
        anim(); this.ref(); setInterval(() => this.ref(), 3000); 
    }
    async ref() {
        try {
            const res = await fetch('/api/v1/system/events');
            if (!res.ok) return;
            const d = await res.json();
            this.currentTasks = d.tasks || [];
            const centerX = this.c.width/2, centerY = this.c.height/2;
            
            const allBotIds = new Set((d.bots || []).map(b => b.id));
            (d.tasks || []).forEach(t => allBotIds.add(t.bot_id));
            
            const botArray = Array.from(allBotIds);
            botArray.forEach((id, i) => {
                const angle = (i / (botArray.length || 1)) * Math.PI * 2;
                const bX = centerX + Math.cos(angle) * 180, bY = centerY + Math.sin(angle) * 180;
                
                if (!this.bots.has(id)) {
                    const botData = (d.bots || []).find(b => b.id === id);
                    const name = botData?.name || (d.tasks || []).find(t => t.bot_id === id)?.bot_name || 'Agent';
                    const numF = d.folders ? d.folders.length : 0;
                    const assignedFolders = (d.folders || []).slice((i*2)%(numF||1), (i*2)%(numF||1) + 2).map((fName, j) => {
                        const fAngle = angle - 0.3 + (j * 0.6);
                        return { name: fName, x: centerX + Math.cos(fAngle) * 260, y: centerY + Math.sin(fAngle) * 260, color: '#38bdf8' };
                    });
                    this.bots.set(id, { id, name, x: bX, y: bY, targetX: bX, targetY: bY, folders: assignedFolders, offset: Math.random() * 100, state: botData?.state || 'active' });
                } else {
                    const bot = this.bots.get(id);
                    bot.targetX = bX; bot.targetY = bY;
                    const botData = (d.bots || []).find(b => b.id === id);
                    if (botData) bot.state = botData.state;
                }
            });

            (d.tasks || []).forEach(t => { if (!this.processed.has(t.id)) { this.triggerPulse(t); this.processed.add(t.id); } });
            const feed = document.getElementById('collab-feed');
            if (feed && this.currentTasks.length) {
                feed.innerHTML = this.currentTasks.slice(0, 15).map((t, idx) => `
                    <div class="feed-item" style="cursor: pointer; border-color: ${t.status === 'completed' ? '#22c55e' : '#38bdf8'}" onmouseover="window.tM.triggerPulse(window.tM.currentTasks[${idx}])">
                        <b>${t.bot_name}</b>: ${t.payload.content || 'Task'}
                    </div>
                `).join('');
            }
        } catch(e){}
    }
    triggerPulse(t) {
        const bot = this.bots.get(t.bot_id); if (!bot) return;
        const centerX = this.c.width / 2, centerY = this.c.height / 2;
        const isW = t.payload?.content?.toLowerCase().includes('http') || t.type === 'web_request';
        if (isW) {
            this.pulses.push({ fX: bot.x, fY: bot.y, tX: centerX, tY: centerY, p: 0, c: '#06b6d4', botId: t.bot_id });
            if (t.status === 'completed' || t.status === 'delivered') {
                setTimeout(() => { this.pulses.push({ fX: centerX, fY: centerY, tX: bot.x, tY: bot.y, p: 0, c: '#f472b6', next: 'folder', botId: t.bot_id }); }, 600);
            }
        } else {
            if (bot.folders.length) {
                const f = bot.folders[0];
                this.pulses.push({ fX: bot.x, fY: bot.y, tX: f.x, tY: f.y, p: 0, c: '#38bdf8', botId: t.bot_id });
            }
        }
    }
    up() {
        const now = Date.now();
        const dt = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
        this.bots.forEach(b => {
            const driftX = Math.cos(now/1500 + b.offset) * 10;
            const driftY = Math.sin(now/1500 + b.offset) * 10;
            b.x += ((b.targetX + driftX) - b.x) * 0.05;
            b.y += ((b.targetY + driftY) - b.y) * 0.05;
        });
        this.pulses = this.pulses.filter(p => {
            p.p += 1.5 * dt;
            const bot = this.bots.get(p.botId);
            if (bot) {
                if (p.c === '#06b6d4') { p.fX = bot.x; p.fY = bot.y; }
                else if (p.c === '#f472b6' && !p.next) { p.tX = bot.x; p.tY = bot.y; }
            }
            if (p.p >= 1 && p.next === 'folder') {
                if (bot && bot.folders.length) {
                    const f = bot.folders[Math.floor(Math.random() * bot.folders.length)];
                    this.pulses.push({ fX: bot.x, fY: bot.y, tX: f.x, tY: f.y, p: 0, c: '#f472b6', botId: bot.id });
                }
            }
            return p.p < 1;
        });
    }
    dr() {
        this.ctx.clearRect(0, 0, this.c.width, this.c.height);
        const centerX = this.c.width / 2, centerY = this.c.height / 2;
        this.ctx.shadowBlur = 30; this.ctx.shadowColor = '#f472b6';
        const g = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 60);
        g.addColorStop(0, '#f472b6'); g.addColorStop(1, '#f472b600');
        this.ctx.fillStyle = g; this.ctx.beginPath(); this.ctx.arc(centerX, centerY, 60, 0, Math.PI*2); this.ctx.fill();
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#fff'; this.ctx.font = '900 12px Inter'; this.ctx.fillText('INTERNET', centerX - 30, centerY + 5);
        this.bots.forEach(b => {
            this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            this.ctx.beginPath(); this.ctx.moveTo(centerX, centerY); this.ctx.lineTo(b.x, b.y); this.ctx.stroke();
            b.folders.forEach(f => {
                this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
                this.ctx.beginPath(); this.ctx.moveTo(b.x, b.y); this.ctx.lineTo(f.x, f.y); this.ctx.stroke();
                this.ctx.fillStyle = '#38bdf822'; this.ctx.beginPath(); this.ctx.arc(f.x, f.y, 8, 0, Math.PI*2); this.ctx.fill();
            });
            this.ctx.fillStyle = b.state==='active'?'#22c55e':'#f59e0b'; this.ctx.beginPath(); this.ctx.arc(b.x, b.y, 6, 0, Math.PI*2); this.ctx.fill();
            this.ctx.fillStyle = '#fff'; this.ctx.font = '800 10px Inter'; this.ctx.fillText(b.name, b.x+10, b.y+4);
        });
        this.pulses.forEach(p => {
            this.ctx.shadowBlur = 15; this.ctx.shadowColor = p.c; this.ctx.strokeStyle = p.c; this.ctx.lineWidth = 3;
            const curX = p.fX + (p.tX-p.fX)*p.p, curY = p.fY + (p.tY-p.fY)*p.p;
            const tailX = p.fX + (p.tX-p.fX)*Math.max(0,p.p-0.1), tailY = p.fY + (p.tY-p.fY)*Math.max(0,p.p-0.1);
            this.ctx.beginPath(); this.ctx.moveTo(tailX, tailY); this.ctx.lineTo(curX, curY); this.ctx.stroke();
            this.ctx.fillStyle = '#fff'; this.ctx.beginPath(); this.ctx.arc(curX, curY, 2, 0, Math.PI*2); this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }
}
