const fetch = require('node-fetch');

(async() => {
  try {
    console.log('Testing admin login...');
    const response = await fetch('http://localhost:3001/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://127.0.0.1:5500'
      },
      body: JSON.stringify({ password: 'viyu@vyom' })
    });

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers));
    const text = await response.text();
    console.log('Response:', text);

  } catch (error) {
    console.error('Error:', error.message);
  }
})();