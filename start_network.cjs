const { spawn } = require('child_process');
const path = require('path');

const services = [
  { name: 'Backbone', command: 'node', args: ['src/server.js'] },
  { name: 'CritiqueMonitor', command: 'node', args: ['critique_monitor.cjs'] },
  { name: 'NetworkObserver', command: 'node', args: ['mission_agent.cjs', 'NetworkObserver', 'network_audit,security_scan'] },
  { name: 'DataCollector', command: 'node', args: ['mission_agent.cjs', 'DataCollector', 'web_scraping,json_parsing'] },
  { name: 'StyleArchitect', command: 'node', args: ['mission_agent.cjs', 'StyleArchitect', 'ui_design,css_optimization'] },
  { name: 'CompetitiveSync', command: 'node', args: ['competitive_sync.cjs'] }
];

services.forEach(service => {
  console.log(`Starting ${service.name}...`);
  const child = spawn(service.command, service.args, {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  child.on('exit', (code) => {
    console.log(`${service.name} exited with code ${code}`);
  });
});

console.log('AIIA OMNICORE 3.1: REAL-TIME NEURAL CLOUD ACTIVE');
