const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (!json.token) {
        console.error("Login failed", json);
        return;
    }
    const token = json.token;
    console.log("Logged in, token:", token);

    // Now fetch stats
    const statsOpt = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/dashboard/stats',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    const req2 = http.request(statsOpt, (res2) => {
        let statsData = '';
        res2.on('data', (chunk) => statsData += chunk);
        res2.on('end', () => {
            console.log("Stats status:", res2.statusCode);
            console.log("Stats response:", statsData);
        });
    });
    req2.end();
  });
});

req.write(JSON.stringify({ username: 'admin', password: 'password' })); // we don't know the exact username/password, wait!
req.end();
