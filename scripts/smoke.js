const http = require('http');
const assert = require('assert');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const EXPECTED = [
  { path: '/api/notifications', expectedStatus: 200 },
  { path: '/api/notifications/unread-count', expectedStatus: 200 },
];

function request(path, method='GET', headers={}, body=null){
  return new Promise((resolve, reject)=>{
    const url = new URL(path, BASE);
    const options = { method, hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, headers };
    const req = http.request(options, res => {
      let data='';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if(body) req.write(body);
    req.end();
  });
}

(async ()=>{
  console.log('Running smoke tests against', BASE);
  for(const test of EXPECTED){
    const res = await request(test.path, test.method, { 'Accept': 'application/json' });
    assert.strictEqual(res.status, test.expectedStatus, `${test.path} returned ${res.status}`);
    console.log(`✔ ${test.path} ${res.status}`);
  }
  console.log('Smoke tests passed');
})();
