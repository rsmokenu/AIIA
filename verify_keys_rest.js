const axios = require('axios');

const keys = [
    'AIzaSyDKWTa9GbtpOtUu5O1MPU3gokduMyUsbEY',
    'AIzaSyCkBxYhKCFYFrstx-Xp2AsmKwcIL9U_ahs'
];

async function checkKey(key) {
    console.log(`
Checking Key: ${key.slice(0, 10)}...`);
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const response = await axios.get(url);
        console.log('SUCCESS! Models found:');
        const models = response.data.models || [];
        models.slice(0, 5).forEach(m => console.log(` - ${m.name}`));
        if (models.length > 5) console.log(` ... and ${models.length - 5} more.`);
    } catch (err) {
        if (err.response) {
            console.log(`FAILED: ${err.response.status} ${err.response.statusText}`);
            console.log(JSON.stringify(err.response.data.error || err.response.data, null, 2));
        } else {
            console.log(`FAILED: ${err.message}`);
        }
    }
}

(async () => {
    for (const k of keys) {
        await checkKey(k);
    }
})();
