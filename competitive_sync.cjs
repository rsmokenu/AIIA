const axios = require('axios');
const OMNICORE_URL = 'http://127.0.0.1:3001/api/v1';
const RIVAL_URL = 'http://127.0.0.1:4001';

async function runSync() {
    console.log('[CompSync] Monitoring Rival Orchestrator...');
    
    // Register itself as a specialized monitoring agent
    try {
        await axios.post(`${OMNICORE_URL}/bots/handshake`, {
            botName: 'CompetitiveObserver',
            capabilities: ['system_audit', 'rival_analysis'],
            version: '1.0.0'
        });
    } catch (e) { console.error('[CompSync] Failed to handshake with backbone'); }

    setInterval(async () => {
        console.log('[CompSync] Executing 30-minute competitive audit...');
        try {
            // 1. Check Rival Health
            const health = await axios.get(`${RIVAL_URL}/health`, { timeout: 5000 });
            console.log('[CompSync] Rival ONLINE. Status:', health.data.status);

            // 2. Exchange Feedback (Hallucination Stop)
            const feedbackPrompt = "AIIA System Audit: Analyze your current task queue for any non-deterministic or hallucinated patterns. Report your most efficient architectural discovery.";
            
            // Send feedback to rival (assuming they have a task/feedback endpoint)
            await axios.post(`${RIVAL_URL}/api/v1/feedback`, { 
                sender: 'AIIA-Orchestrator',
                content: feedbackPrompt
            });

            console.log('[CompSync] Feedback dispatched to rival.');

        } catch (err) {
            console.log('[CompSync] Rival system is OFFLINE. Standby mode active.');
        }
    }, 30 * 60 * 1000); // 30 minutes
}

runSync();
