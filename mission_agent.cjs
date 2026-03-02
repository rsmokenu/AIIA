const axios = require('axios');
const WebSocket = require('ws');
const { exec } = require('child_process');

const [,, botName, capabilitiesRaw] = process.argv;
const capabilities = (capabilitiesRaw || 'general').split(',');

const AIIA_URL = process.env.AIIA_URL || 'http://127.0.0.1:3001/api/v1';
const WS_URL = AIIA_URL.replace('http', 'ws').replace('/api/v1', '');

async function runAgent() {
    console.log(`[${botName}] REALTIME AGENT ONLINE: ${AIIA_URL}`);
    
    try {
        const handshake = await axios.post(`${AIIA_URL}/bots/handshake`, { botName, capabilities, version: '1.0.0' });
        const botId = handshake.data.botId;

        // 1. Establish Real-time Socket
        const ws = new WebSocket(WS_URL);
        ws.on('open', () => {
            console.log(`[${botName}] Realtime Stream Connected.`);
            ws.send(JSON.stringify({ type: 'auth', botId }));
        });

        ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg);
                if (data.type === 'new_task') {
                    console.log(`[${botName}] Instant Task Received: ${data.task.id}`);
                    executeTask(data.task, botId);
                }
            } catch (e) {}
        });

        // 2. Fallback Polling (Production Resilience)
        setInterval(async () => {
            try {
                const res = await axios.get(`${AIIA_URL}/bots/${botId}/tasks`);
                const tasks = res.data.data || [];
                for (const t of tasks) executeTask(t, botId);
            } catch (e) {}
        }, 10000);

        // 3. Heartbeat
        setInterval(() => axios.post(`${AIIA_URL}/bots/handshake`, { botName, capabilities, botId }), 30000);

    } catch (err) { console.error(`[${botName}] Start failed: ${err.message}`); }
}

async function executeTask(task, botId) {
    const cmd = task.payload.content || task.payload;
    console.log(`[${botName}] EXEC: ${cmd}`);
    exec(cmd, async (error, stdout, stderr) => {
        let result = stdout || stderr || 'Executed (No output)';
        if (error) result = `Error: ${error.message}`;
        try {
            await axios.post(`${AIIA_URL}/bots/${botId}/tasks/${task.id}/complete`, { result });
            console.log(`[${botName}] FINISHED: ${task.id}`);
        } catch (e) {}
    });
}

runAgent();
