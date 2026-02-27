const axios = require('axios');

const [,, botName, capabilitiesRaw] = process.argv;
const capabilities = capabilitiesRaw ? capabilitiesRaw.split(',') : ['general'];

// Use environment variable or default to local loopback
const AIIA_URL = process.env.AIIA_URL || 'http://127.0.0.1:3000/api/v1';

async function runAgent() {
    console.log(`[${botName}] Initializing with backbone: ${AIIA_URL}`);
    
    try {
        const handshake = await axios.post(`${AIIA_URL}/bots/handshake`, {
            botName,
            capabilities,
            version: '1.0.0'
        });
        const botId = handshake.data.botId;
        console.log(`[${botName}] Registered: ${botId}`);

        let isWorking = false;

        setInterval(async () => {
            if (isWorking) return;
            try {
                const res = await axios.get(`${AIIA_URL}/bots/${botId}/tasks`);
                const tasks = res.data.data || [];
                
                if (tasks.length > 0) {
                    isWorking = true;
                    for (const task of tasks) {
                        const content = task.payload.content || task.payload;
                        console.log(`[${botName}] Executing: ${content}`);
                        
                        // Simulate work duration
                        await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
                        
                        try {
                            await axios.post(`${AIIA_URL}/bots/${botId}/tasks/${task.id}/complete`, {
                                result: `Successfully completed by ${botName}`
                            });
                            console.log(`[${botName}] Task Finalized: ${task.id}`);
                        } catch (err) {
                            console.error(`[${botName}] Completion report failed: ${err.message}`);
                        }
                    }
                    isWorking = false;
                }
            } catch (e) {
                // Silently poll
            }
        }, 3000);

    } catch (err) {
        console.error(`[${botName}] CRITICAL: Start failed: ${err.message}`);
    }
}

runAgent();
