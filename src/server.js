require('dotenv').config();
const http = require('http');
const WebSocket = require('ws');
const app = require('./app');
const logger = require('./utils/logger');
const { initDB, closeDB } = require('./config/database');

const PORT = process.env.PORT || 3001;

// 1. Create Server
const server = http.createServer(app);

// 2. Initialize WebSocket Server
const wss = new WebSocket.Server({ server });
const clients = new Map(); // botId -> socket

wss.on('connection', (ws) => {
    let currentBotId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'auth') {
                currentBotId = data.botId;
                clients.set(currentBotId, ws);
                logger.info(`Agent Socket Connected: ${currentBotId}`);
                ws.send(JSON.stringify({ type: 'welcome', message: 'AIIA REALTIME_BUS ACTIVE' }));
            }
        } catch (e) {}
    });

    ws.on('close', () => {
        if (currentBotId) {
            clients.delete(currentBotId);
            logger.info(`Agent Socket Disconnected: ${currentBotId}`);
        }
    });
});

// 3. Expose Real-time Dispatch Utility
global.aiiaBus = {
    sendToBot: (botId, task) => {
        const client = clients.get(botId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'new_task', task }));
            return true;
        }
        return false;
    }
};

(async () => {
  try {
    await initDB();
    server.listen(PORT, () => {
      logger.info(`AIIA Backbone running on port ${PORT} [REALTIME ENABLED]`);
    });

    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        try { await closeDB(); process.exit(0); } catch (e) { process.exit(1); }
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (err) {
    logger.error(`Failed to initialize: ${err.message}`);
    process.exit(1);
  }
})();
