const axios = require('axios');

const [,, botName, capabilitiesRaw] = process.argv;
const capabilities = capabilitiesRaw ? capabilitiesRaw.split(',') : ['general'];
const AIIA_URL = 'http://localhost:3000/api/v1';

async function runAgent() {
    console.log(`[${botName}] Initializing...`);
    
    try {
        const handshake = await axios.post(`${AIIA_URL}/bots/handshake`, {
            botName,
            capabilities,
            version: '1.0.0'
        });
        const botId = handshake.data.botId;
        console.log(`[${botName}] Registered: ${botId}`);

        setInterval(async () => {
            try {
                const res = await axios.get(`${AIIA_URL}/bots/${botId}/tasks`);
                const tasks = res.data.data || [];
                
                for (const task of tasks) {
                    const content = task.payload.content || task.payload;
                    console.log(`[${botName}] Task: ${content}`);
                    
                    // Simulate work duration
                    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
                    
                    await axios.post(`${AIIA_URL}/bots/${botId}/tasks/${task.id}/complete`, {
                        result: `Processed by ${botName}`
                    });
                    console.log(`[${botName}] Completed: ${task.id}`);
                }
            } catch (e) {}
        }, 4000);

    } catch (err) {
        console.error(`[${botName}] Start failed: ${err.message}`);
    }
}

runAgent();
