const os = require('os');
const http = require('http');

console.log('--- Omni Health Check ---');
console.log(`OS: ${os.type()} ${os.release()}`);
console.log(`CPU: ${os.cpus()[0].model}`);
console.log(`Free Memory: ${(os.freemem() / 1024 / 1024).toFixed(2)} MB`);
console.log(`Uptime: ${(os.uptime() / 3600).toFixed(2)} hours`);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  console.log(`Web Service Status: ${res.statusCode}`);
});

req.on('error', (e) => {
  console.log(`Web Service Status: DOWN (${e.message})`);
});

req.end();
