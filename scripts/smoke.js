const http = require('http');
const assert = require('assert');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

function request(path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = http.request({
      method,
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      headers
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Running smoke tests against', BASE);

  const homepage = await request('/');
  assert.strictEqual(homepage.status, 200, 'Homepage should load');
  assert.match(homepage.body, /Technology for your next step/, 'Homepage should introduce the business');
  assert.match(homepage.body, /Websites, software, mobile apps/, 'Homepage should summarize business services');
  console.log('✔ homepage');

  const health = await request('/healthz');
  assert.strictEqual(health.status, 200, 'Health endpoint should confirm database readiness');
  console.log('✔ database health');

  for (const endpoint of [
    '/api/me',
    '/api/service-requests',
    '/api/payments',
    '/api/tickets',
    '/api/documents',
    '/api/notifications',
    '/api/notifications/unread-count',
    '/api/chat/contacts'
  ]) {
    const response = await request(endpoint, 'GET', { Accept: 'application/json' });
    assert.strictEqual(response.status, 401, `${endpoint} should require authentication`);
    console.log(`✔ protected ${endpoint}`);
  }

  const database = await request('/auth.db');
  assert.strictEqual(database.status, 404, 'Database files must not be served');
  console.log('✔ private database is not publicly served');

  const notificationCreation = await request(
    '/api/notifications/create',
    'POST',
    { 'Content-Type': 'application/json' },
    JSON.stringify({ title: 'Smoke test' })
  );
  assert.strictEqual(
    notificationCreation.status,
    process.env.NOTIF_API_KEY ? 401 : 503,
    'Notification creation should require a configured API key'
  );
  console.log('✔ notification endpoint is protected');

  console.log('Smoke tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
