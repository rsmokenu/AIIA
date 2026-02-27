const axios = require('axios');
const { exec } = require('child_process');

const [,, botName, capabilitiesRaw] = process.argv;
const capabilities = capabilitiesRaw ? capabilitiesRaw.split(',') : ['general'];
const AIIA_URL = process.env.AIIA_URL || 'http://127.0.0.1:3000/api/v1';

async function runAgent() {
    console.log(`[${botName}] REAL AGENT ONLINE: ${AIIA_URL}`);
    
    try {
        const handshake = await axios.post(`${AIIA_URL}/bots/handshake`, {
            botName, capabilities, version: '1.0.0'
        });
        const botId = handshake.data.botId;

        // Heartbeat
        setInterval(() => axios.post(`${AIIA_URL}/bots/handshake`, { botName, capabilities }), 30000);

        let isWorking = false;
        setInterval(async () => {
            if (isWorking) return;
            try {
                const res = await axios.get(`${AIIA_URL}/bots/${botId}/tasks`);
                const tasks = res.data.data || [];
                
                if (tasks.length > 0) {
                    isWorking = true;
                    for (const task of tasks) {
                        const cmd = task.payload.content || task.payload;
                        console.log(`[${botName}] EXEC: ${cmd}`);
                        
                        exec(cmd, async (error, stdout, stderr) => {
                            let result = stdout || stderr || 'Executed (No output)';
                            if (error) result = `Error: ${error.message}`;
                            
                            await axios.post(`${AIIA_URL}/bots/${botId}/tasks/${task.id}/complete`, { result });
                            console.log(`[${botName}] FINISHED: ${task.id}`);
                        });
                    }
                    isWorking = false;
                }
            } catch (e) {}
        }, 3000);
    } catch (err) { console.error(`[${botName}] Start failed: ${err.message}`); }
}
runAgent();
