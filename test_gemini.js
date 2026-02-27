const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

(async () => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // The SDK doesn't have a direct listModels on the genAI object in all versions, 
  // but we can try to use the fetch API if needed.
  // Actually, let's just try a known good model like 'gemini-pro'
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  try {
    const result = await model.generateContent('Hello');
    console.log('gemini-pro works!');
  } catch (e) {
    console.error('gemini-pro failed:', e.message);
  }

  const model2 = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  try {
    const result = await model2.generateContent('Hello');
    console.log('gemini-1.5-flash works!');
  } catch (e) {
    console.error('gemini-1.5-flash failed:', e.message);
  }
})();
