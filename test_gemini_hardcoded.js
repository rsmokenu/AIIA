const { GoogleGenerativeAI } = require('@google/generative-ai');

(async () => {
  const key = 'AIzaSyCkBxYhKCFYFrstx-Xp2AsmKwcIL9U_ahs';
  const genAI = new GoogleGenerativeAI(key);
  
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }, { apiVersion: 'v1' });
  try {
    const result = await model.generateContent('Hello');
    console.log('gemini-1.5-flash works!');
    console.log(result.response.text());
  } catch (e) {
    console.error('gemini-1.5-flash failed:', e.message);
  }
})();
