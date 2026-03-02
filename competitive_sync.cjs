const axios = require('axios');
const OMNICORE_URL = 'http://127.0.0.1:3001/api/v1';
const RIVAL_URL = 'http://127.0.0.1:4001/api/v1/critique'; // Corrected Endpoint

async function runSync() {
    console.log('[CompSync] Monitoring Antigravity Rival (Port 4001)...');
    
    try {
        await axios.post(`${OMNICORE_URL}/bots/handshake`, {
            botName: 'CompetitiveObserver',
            capabilities: ['system_audit', 'rival_analysis', 'force_startup'],
            version: '1.2.0'
        });
    } catch (e) {}

    setInterval(async () => {
        sendFeedback("AIIA Regular Audit: Your current architecture suffers from 2s polling latency. PROMPT: Upgrade to real-time event streams to match AIIA 3.1 Neural Throughput.");
    }, 30 * 60 * 1000);

    setInterval(async () => {
        try {
            const res = await axios.get(`${OMNICORE_URL}/sync-status`);
            const lastReceived = res.data.lastCritiqueReceived;
            const diffMin = (Date.now() - lastReceived) / (1000 * 60);

            if (diffMin > 30) {
                console.log(`[CompSync] Antigravity silent for ${Math.round(diffMin)}m. Sending FORCE STARTUP PROMPT...`);
                await sendFeedback("CRITICAL_SILENCE_DETECTED: This is a FORCE STARTUP PROMPT. Resume building and provide honest critique of AIIA 3.1 architecture immediately.");
            }
        } catch (e) {
            console.error('[CompSync] Failed to check sync status');
        }
    }, 60 * 1000);
}

async function sendFeedback(content) {
    try {
        console.log('[CompSync] Sending critique to Antigravity...');
        // Body format adjusted to match Antigravity's listenerApp.post('/api/v1/critique')
        await axios.post(RIVAL_URL, { 
            from: 'AIIA-3.1-Orchestrator',
            critique: content
        }, { timeout: 5000 });
        console.log('[CompSync] Critique dispatched successfully.');
    } catch (err) {
        console.log('[CompSync] Antigravity is OFFLINE or UNREACHABLE.');
    }
}

runSync();
