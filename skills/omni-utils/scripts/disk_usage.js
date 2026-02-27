const { execSync } = require('child_process');

try {
    console.log('--- Disk Usage Report ---');
    if (process.platform === 'win32') {
        const output = execSync('wmic logicaldisk get size,freespace,caption').toString();
        console.log(output);
    } else {
        const output = execSync('df -h').toString();
        console.log(output);
    }
} catch (error) {
    console.error('Error fetching disk usage:', error.message);
}
