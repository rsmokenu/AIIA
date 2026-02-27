const { spawn } = require('child_process');
const path = require('path');

function launch(name, args) {
    const child = spawn('node', args, { 
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, AIIA_URL: 'http://127.0.0.1:3000/api/v1' }
    });
    console.log(`[Manager] Started ${name}`);
    child.on('exit', () => console.log(`[Manager] ${name} exited. Re-launching in 5s...`));
}

// 1. Start Server
const server = spawn('node', ['src/server.js'], { stdio: 'inherit', shell: true });
console.log('[Manager] Backbone Initiated.');

// 2. Wait and start Agents
setTimeout(() => {
    launch('DataCollector', ['mission_agent.cjs', 'DataCollector', 'cmd,web_request']);
    launch('StyleArchitect', ['mission_agent.cjs', 'StyleArchitect', 'cmd,file_system']);
    launch('NetworkObserver', ['mission_agent.cjs', 'NetworkObserver', 'cmd,logging']);
}, 5000);
