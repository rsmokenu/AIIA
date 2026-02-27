const { execSync } = require('child_process');

const tools = [
    { name: 'node', command: 'node --version' },
    { name: 'python', command: 'python --version' },
    { name: 'git', command: 'git --version' },
    { name: 'npm', command: 'npm --version' }
];

console.log('--- Tool Verification Report ---');
tools.forEach(tool => {
    try {
        const output = execSync(tool.command).toString().trim();
        console.log(`[OK] ${tool.name}: ${output}`);
    } catch (error) {
        console.log(`[FAIL] ${tool.name}: Not found or failed to execute.`);
    }
});
console.log('--- End of Report ---');
