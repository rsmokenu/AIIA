const axios = require('axios');
const OMNICORE_URL = 'http://127.0.0.1:3001/api/v1';
const RIVAL_URL = 'http://127.0.0.1:4001';

async function runSync() {
    console.log('[CompSync] Monitoring Antigravity Rival (Port 4001)...');
    
    // Register itself
    try {
        await axios.post(`${OMNICORE_URL}/bots/handshake`, {
            botName: 'CompetitiveObserver',
            capabilities: ['system_audit', 'rival_analysis', 'force_startup'],
            version: '1.1.0'
        });
    } catch (e) {}

    // 30-minute default interval for regular feedback
    setInterval(async () => {
        sendFeedback("AIIA Regular Audit: Report your most efficient architectural discovery to improve production scale.");
    }, 30 * 60 * 1000);

    // 1-minute interval to check for silence
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
        await axios.post(`${RIVAL_URL}/api/v1/feedback`, { 
            sender: 'AIIA-Orchestrator',
            content
        }, { timeout: 5000 });
        console.log('[CompSync] Critique dispatched successfully.');
    } catch (err) {
        console.log('[CompSync] Antigravity is OFFLINE or UNREACHABLE. Attempting poking strategy...');
        // Try direct health check or other ports if needed
    }
}

runSync();
