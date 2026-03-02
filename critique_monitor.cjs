const fs = require('fs');
const path = require('path');
const axios = require('axios');

const LOG_FILE = path.join(__dirname, 'logs', 'combined.log');
const AIIA_URL = 'http://127.0.0.1:3001/api/v1';

console.log('[CritiqueMonitor] Watching for Neural Triggers...');

// Track last read position to avoid re-processing
let lastSize = 0;
if (fs.existsSync(LOG_FILE)) {
    lastSize = fs.statSync(LOG_FILE).size;
}

setInterval(() => {
    if (!fs.existsSync(LOG_FILE)) return;

    const stats = fs.statSync(LOG_FILE);
    if (stats.size > lastSize) {
        const stream = fs.createReadStream(LOG_FILE, { start: lastSize });
        stream.on('data', (chunk) => {
            const lines = chunk.toString().split('
');
            lines.forEach(line => {
                if (line.includes('[SYNC_TRIGGER]')) {
                    const critique = line.split('[SYNC_TRIGGER]')[1].trim();
                    console.log(`[NeuralTrigger] New Critique Detected: ${critique}`);
                    
                    // Broadcast to all agents as a "REBOOT_LOGIC" command
                    axios.post(`${AIIA_URL}/bots/broadcast`, {
                        id: 'System', // Use a generic ID
                        content: `SYSTEM REBOOT: Rival Critique Received! Adjusting logic for: ${critique}`
                    }).catch(() => {});
                }
            });
        });
        lastSize = stats.size;
    }
}, 5000);
