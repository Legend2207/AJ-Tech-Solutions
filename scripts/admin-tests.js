const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const root = path.join(__dirname, '..');
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'aj-admin-test-'));
const databasePath = path.join(tempDirectory, 'test.db');
let serverProcess;
let baseUrl;
let serverOutput = '';

function freePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const { port } = listener.address();
      listener.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function database() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath, (error) => error ? reject(error) : resolve(db));
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

async function waitForServer() {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (serverProcess.exitCode !== null) throw new Error('Test server exited during startup.');
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Test server did not become ready.');
}

async function api(pathname, { cookie, method = 'GET', body, form } = {}) {
  const headers = { origin: baseUrl };
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: form || (body === undefined ? undefined : JSON.stringify(body))
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { response, data };
}

async function login(email, password) {
  const { response, data } = await api('/api/login', { method: 'POST', body: { email, password } });
  assert.equal(response.status, 200, `login failed for ${email}`);
  return response.headers.get('set-cookie').split(';')[0];
}

async function main() {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DB_PATH: databasePath, SESSION_SECRET: crypto.randomBytes(32).toString('hex') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', (chunk) => { serverOutput += chunk; });
  serverProcess.stderr.on('data', (chunk) => { serverOutput += chunk; });
  await waitForServer();

  const password = 'TestAdminPassword!234';
  const passwordHash = await bcrypt.hash(password, 4);
  const db = await database();
  const admin = await dbRun(db, 'INSERT INTO users (fullName, email, password, role) VALUES (?, ?, ?, ?)',
    ['Test Admin', 'admin@example.test', passwordHash, 'admin']);
  const client = await dbRun(db, 'INSERT INTO users (fullName, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
    ['Test Client', 'client@example.test', passwordHash, '5550100', 'client']);
  const superadmin = await dbRun(db, 'INSERT INTO users (fullName, email, password, role) VALUES (?, ?, ?, ?)',
    ['Test Superadmin', 'superadmin@example.test', passwordHash, 'superadmin']);
  await dbRun(db, 'INSERT INTO notifications (title, body, user_id) VALUES (?, ?, ?)',
    ['Admin test notification', 'Notification inbox test', admin.lastID]);
  await new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));

  let adminCookie = await login('admin@example.test', password);
  const clientCookie = await login('client@example.test', password);
  const superadminCookie = await login('superadmin@example.test', password);

  let result;
  result = await api('/api/account-requests/admin', {
    method: 'POST', body: { fullName: 'Admin Applicant', email: 'admin-applicant@example.test', phone: '5550103' }
  });
  assert.equal(result.response.status, 201, 'submit Admin access request');
  const accountRequestId = result.data.requestId;
  result = await api('/api/superadmin/account-requests?status=pending', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'Super Admin can list pending account requests');
  assert.ok(result.data.requests.some((request) =>
    request.id === accountRequestId && request.email === 'admin-applicant@example.test'
  ), 'new Admin access request appears in the pending list');
  result = await api('/api/login', {
    method: 'POST', body: { email: 'admin-applicant@example.test', password: 'UnapprovedPassword!234' }
  });
  assert.equal(result.response.status, 401, 'pending Admin applicant cannot sign in');
  result = await api('/api/account-requests/admin', {
    method: 'POST', body: { fullName: 'Duplicate Applicant', email: 'admin-applicant@example.test' }
  });
  assert.equal(result.response.status, 409, 'duplicate pending Admin request is rejected');
  result = await api('/api/superadmin/account-requests?status=pending', { cookie: adminCookie });
  assert.equal(result.response.status, 403, 'Admin cannot review account requests');
  result = await api(`/api/superadmin/account-requests/${accountRequestId}/review`, {
    cookie: adminCookie, method: 'POST', body: { action: 'approve' }
  });
  assert.equal(result.response.status, 403, 'only Super Admins may approve Admin requests');
  result = await api(`/api/superadmin/account-requests/${accountRequestId}/review`, {
    cookie: superadminCookie, method: 'POST', body: { action: 'approve' }
  });
  assert.equal(result.response.status, 200, 'Super Admin approves Admin request');
  assert.equal(result.data.temporaryPassword.length, 128, 'approved Admin receives one-time temporary password');
  result = await api('/api/login', {
    method: 'POST', body: { email: 'admin-applicant@example.test', password: result.data.temporaryPassword }
  });
  assert.equal(result.response.status, 200, 'approved Admin can sign in with temporary password');
  assert.equal(result.data.user.role, 'admin', 'approved request creates an Admin account');
  assert.equal(result.data.user.passwordResetRequired, true, 'approved Admin must change temporary password');

  result = await api('/api/account-requests/admin', {
    method: 'POST', body: { fullName: 'Rejected Applicant', email: 'rejected-applicant@example.test' }
  });
  assert.equal(result.response.status, 201, 'submit another Admin access request');
  result = await api(`/api/superadmin/account-requests/${result.data.requestId}/review`, {
    cookie: superadminCookie, method: 'POST', body: { action: 'reject', reason: 'Not approved for this role.' }
  });
  assert.equal(result.response.status, 200, 'Super Admin rejects Admin request');
  result = await api('/api/login', {
    method: 'POST', body: { email: 'rejected-applicant@example.test', password: 'AnyPassword!234' }
  });
  assert.equal(result.response.status, 401, 'rejected Admin request does not create an account');

  result = await api('/api/superadmin/overview?from=2020-01-01&to=2099-12-31', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'global Super Admin overview');
  assert.equal(result.data.stats.totalClients, 1, 'global client count');
  assert.equal(result.data.stats.totalAdmins, 2, 'global administrator count includes the approved request');
  assert.equal(result.data.stats.totalSuperadmins, 1, 'global Super Admin count');
  assert.equal(result.data.stats.activeUsers, 4, 'global active user count');
  result = await api('/api/superadmin/users', {
    cookie: adminCookie, method: 'POST',
    body: { fullName: 'Unauthorized Superadmin', email: 'unauthorized-superadmin@example.test', role: 'superadmin', password: 'UnauthorizedPassword!234' }
  });
  assert.equal(result.response.status, 403, 'Admin cannot create Super Admin accounts');
  result = await api('/api/superadmin/users', {
    cookie: superadminCookie, method: 'POST',
    body: { fullName: 'Provisioned Superadmin', email: 'provisioned-superadmin@example.test', role: 'superadmin', password: 'ProvisionedSuperadmin!234' }
  });
  assert.equal(result.response.status, 201, 'existing Super Admin can create another Super Admin');
  assert.equal(result.data.temporaryPassword, undefined, 'custom Super Admin password is not returned');
  const secondSuperadminCookie = await login('provisioned-superadmin@example.test', 'ProvisionedSuperadmin!234');
  result = await api('/api/superadmin/overview', { cookie: secondSuperadminCookie });
  assert.equal(result.response.status, 200, 'new Super Admin can access privileged APIs');
  result = await api('/api/superadmin/users?role=client&search=client%40example.test', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'global user filtering');
  assert.equal(result.data.users[0].id, client.lastID);
  result = await api(`/api/superadmin/users/${client.lastID}`, { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'global user profile and activity');
  result = await api(`/api/superadmin/users/${client.lastID}`, {
    cookie: superadminCookie, method: 'PATCH',
    body: { fullName: 'Test Client', email: 'client@example.test', phone: '5550100', role: 'admin', isActive: true }
  });
  assert.equal(result.response.status, 200, 'change user role');
  result = await api(`/api/superadmin/users/${client.lastID}`, { cookie: superadminCookie });
  assert.equal(result.data.user.role, 'admin', 'role change is reflected in the account');
  result = await api(`/api/superadmin/users/${client.lastID}`, {
    cookie: superadminCookie, method: 'PATCH',
    body: { fullName: 'Test Client', email: 'client@example.test', phone: '5550100', role: 'client', isActive: false, suspendedReason: 'Test suspension' }
  });
  assert.equal(result.response.status, 200, 'suspend user after role change');
  result = await api(`/api/superadmin/users/${client.lastID}`, {
    cookie: superadminCookie, method: 'PATCH',
    body: { fullName: 'Test Client', email: 'client@example.test', phone: '5550100', role: 'client', isActive: true }
  });
  assert.equal(result.response.status, 200, 'restore user account');
  result = await api('/api/admin/profile', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'Super Admin profile access');
  result = await api('/api/admin/login-history', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'Super Admin login history');
  result = await api('/api/admin/preferences', {
    cookie: superadminCookie, method: 'PUT', body: { emailEnabled: false, inAppEnabled: true }
  });
  assert.equal(result.response.status, 200, 'Super Admin notification preferences update');
  result = await api('/api/admin/preferences', { cookie: superadminCookie });
  assert.equal(result.data.preferences.inAppEnabled, 1, 'Super Admin notification preferences read');
  result = await api('/api/admin/services', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'Super Admin access to platform service management');
  result = await api('/api/admin/services', {
    cookie: superadminCookie, method: 'POST',
    body: { name: 'Super Admin Test Service', category: 'Test', description: 'Created by the Super Admin integration test.', isAvailable: true, isPublished: true }
  });
  assert.equal(result.response.status, 201, 'Super Admin can add a service to the catalog');
  const superadminServiceId = result.data.id;
  result = await api(`/api/admin/services/${superadminServiceId}`, { cookie: superadminCookie, method: 'DELETE' });
  assert.equal(result.response.status, 200, 'Super Admin can remove a service from the catalog');
  result = await api('/api/admin/services', { cookie: superadminCookie });
  assert.ok(result.data.services.some((service) => service.id === superadminServiceId && service.isArchived), 'removed service is preserved as archived history');
  result = await api('/api/services', { cookie: clientCookie });
  assert.ok(!result.data.services.some((service) => service.id === superadminServiceId), 'removed service no longer appears in the client catalog');
  result = await api('/api/superadmin/users', { cookie: adminCookie });
  assert.equal(result.response.status, 403, 'Admin cannot access Super Admin user management');
  result = await api(`/api/superadmin/admins/${admin.lastID}/permissions`, { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'read Admin module permissions');
  assert.equal(result.data.permissions.services, true, 'unset module permissions default to allow');
  const allPermissions = Object.fromEntries(Object.keys(result.data.permissions).map((module) => [module, true]));
  result = await api(`/api/superadmin/admins/${admin.lastID}/permissions`, {
    cookie: superadminCookie, method: 'PUT',
    body: { permissions: { ...allPermissions, services: false } }
  });
  assert.equal(result.response.status, 200, 'restrict Admin module access');
  result = await api('/api/admin/permissions', { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'Admin can read own module permissions');
  assert.equal(result.data.permissions.services, false, 'Admin permission response reflects restrictions');
  result = await api('/api/admin/services', { cookie: adminCookie });
  assert.equal(result.response.status, 403, 'module permissions enforced server side');
  result = await api(`/api/superadmin/admins/${admin.lastID}/permissions`, {
    cookie: superadminCookie, method: 'PUT',
    body: { permissions: { ...allPermissions, requests: false } }
  });
  assert.equal(result.response.status, 200, 'restrict Admin request module');
  result = await api('/api/staff/requests', { cookie: adminCookie });
  assert.equal(result.response.status, 403, 'legacy staff request route enforces request module permissions');
  result = await api(`/api/superadmin/admins/${admin.lastID}/permissions`, {
    cookie: superadminCookie, method: 'PUT', body: { permissions: allPermissions }
  });
  assert.equal(result.response.status, 200, 'restore Admin module access');
  result = await api(`/api/superadmin/admins/${superadmin.lastID}/permissions`, {
    cookie: superadminCookie, method: 'PUT', body: { permissions: allPermissions }
  });
  assert.equal(result.response.status, 400, 'self permission changes rejected');
  result = await api(`/api/superadmin/users/${superadmin.lastID}`, {
    cookie: superadminCookie, method: 'PATCH',
    body: { fullName: 'Test Superadmin', email: 'superadmin@example.test', role: 'admin', isActive: false }
  });
  assert.equal(result.response.status, 403, 'Super Admin cannot remove own access');
  result = await api('/api/superadmin/users', {
    cookie: superadminCookie, method: 'POST',
    body: { fullName: 'Provisioned Admin', email: 'provisioned-admin@example.test', phone: '5550102' }
  });
  assert.equal(result.response.status, 201, 'create administrator account');
  const provisionedAdminId = result.data.userId;
  const temporaryPassword = result.data.temporaryPassword;
  assert.equal(temporaryPassword.length, 128, 'one-time password meets the maximum configured length');
  const provisionedLogin = await api('/api/login', {
    method: 'POST', body: { email: 'provisioned-admin@example.test', password: temporaryPassword }
  });
  assert.equal(provisionedLogin.response.status, 200, 'temporary administrator login');
  assert.equal(provisionedLogin.data.user.passwordResetRequired, true, 'temporary credential requires change');
  const provisionedAdminCookie = provisionedLogin.response.headers.get('set-cookie').split(';')[0];
  result = await api('/api/admin/overview', { cookie: provisionedAdminCookie });
  assert.equal(result.response.status, 428, 'temporary password blocks other platform access');
  result = await api('/api/account/change-password', {
    cookie: provisionedAdminCookie, method: 'POST',
    body: { currentPassword: temporaryPassword, newPassword: 'ProvisionedAdminNewPassword!234' }
  });
  assert.equal(result.response.status, 200, 'forced temporary password change');
  result = await api('/api/admin/overview', { cookie: provisionedAdminCookie });
  assert.equal(result.response.status, 200, 'access after temporary password change');
  result = await api(`/api/superadmin/users/${provisionedAdminId}/reset-password`, {
    cookie: superadminCookie, method: 'POST'
  });
  assert.equal(result.response.status, 200, 'reset administrator password');
  const resetPassword = result.data.temporaryPassword;
  result = await api('/api/login', {
    method: 'POST', body: { email: 'provisioned-admin@example.test', password: resetPassword }
  });
  assert.equal(result.response.status, 200, 'sign in with reset password');
  assert.equal(result.data.user.passwordResetRequired, true, 'reset password forces a password change');
  result = await api('/api/login', {
    method: 'POST', body: { email: 'provisioned-admin@example.test', password: 'ProvisionedAdminNewPassword!234' }
  });
  assert.equal(result.response.status, 401, 'password reset revokes the old credential');

  result = await api('/api/superadmin/content', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'read website content');
  result = await api('/api/superadmin/content', {
    cookie: superadminCookie, method: 'PUT',
    body: { content: { company_name: 'AJ Test Company', hero_headline: 'Test homepage headline', about_text: 'Test about copy.' }, published: true }
  });
  assert.equal(result.response.status, 200, 'publish website content');
  result = await api('/api/public/site');
  assert.equal(result.data.content.hero_headline, 'Test homepage headline', 'published content visible to the website');
  result = await api('/api/superadmin/content', {
    cookie: superadminCookie, method: 'PUT',
    body: { content: { hero_headline: 'Hidden draft' }, published: false }
  });
  assert.equal(result.response.status, 200, 'save unpublished website draft');
  result = await api('/api/public/site');
  assert.notEqual(result.data.content.hero_headline, 'Hidden draft', 'unpublished content remains hidden');
  result = await api('/api/superadmin/content', {
    cookie: superadminCookie, method: 'PUT',
    body: { content: { faq_json: 'not-json' }, published: true }
  });
  assert.equal(result.response.status, 400, 'reject invalid FAQ content');
  result = await api('/api/superadmin/settings', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'read system status and settings');
  assert.equal(result.data.system.databaseIntegrity, 'ok', 'database integrity is reported');
  result = await api('/api/superadmin/settings', {
    cookie: superadminCookie, method: 'PUT',
    body: { maintenanceMode: true, passwordMinLength: 14, sessionTimeoutMinutes: 60 }
  });
  assert.equal(result.response.status, 200, 'update security and maintenance settings');
  result = await api('/api/payments', { cookie: clientCookie });
  assert.equal(result.response.status, 503, 'maintenance mode blocks client portal APIs');
  result = await api('/api/superadmin/overview', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'maintenance mode preserves Super Admin access');
  result = await api('/api/register', {
    method: 'POST', body: { fullName: 'Short Password User', email: 'short@example.test', password: 'TooShort!234' }
  });
  assert.equal(result.response.status, 503, 'maintenance mode blocks registration');
  result = await api('/api/superadmin/settings', {
    cookie: superadminCookie, method: 'PUT',
    body: { maintenanceMode: false, passwordMinLength: 12, sessionTimeoutMinutes: 480 }
  });
  assert.equal(result.response.status, 200, 'restore normal system settings');
  result = await api('/api/superadmin/notifications', {
    cookie: superadminCookie, method: 'POST',
    body: { title: 'Platform notice', body: 'Admin maintenance notice', audience: 'admin' }
  });
  assert.equal(result.response.status, 201, 'send Admin platform announcement');
  assert.equal(result.data.recipients, 3, 'notification delivered to active administrators');
  result = await api('/api/superadmin/notifications', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'read platform notification history');
  const platformNotification = result.data.notifications.find((item) => item.title === 'Platform notice');
  assert.ok(platformNotification, 'platform notification is retained in history');
  result = await api(`/api/superadmin/notifications/${platformNotification.id}/read`, {
    cookie: superadminCookie, method: 'PATCH'
  });
  assert.equal(result.response.status, 200, 'mark platform notification read');
  for (const type of ['admins', 'users', 'admin-activity', 'service-performance']) {
    for (const format of ['pdf', 'xlsx']) {
      result = await api(`/api/admin/reports/${format}?type=${type}&from=2020-01-01&to=2099-12-31`, { cookie: superadminCookie });
      assert.equal(result.response.status, 200, `${type} ${format} Super Admin report`);
      assert.ok(result.data.length > 0, `${type} ${format} report content`);
    }
  }
  result = await api('/api/superadmin/audit?search=failed%20login', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'search security audit log');
  assert.ok(result.data.entries.some((entry) => entry.action === 'failed login'), 'failed login attempt is audited');

  result = await api('/api/admin/overview?from=2020-01-01&to=2099-12-31', { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'admin overview');
  assert.equal(result.data.stats.totalClients, 1, 'client count');
  assert.equal(result.data.stats.registrationsInRange, 1, 'date-filtered registration count');

  result = await api('/api/admin/clients?search=client%40example.test&sort=name', { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'client search');
  assert.equal(result.data.clients[0].id, client.lastID);
  result = await api(`/api/admin/clients/${client.lastID}`, { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'client profile and request history');
  result = await api(`/api/admin/clients/${client.lastID}/login-history`, { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'client login history');

  result = await api(`/api/admin/clients/${client.lastID}`, {
    cookie: adminCookie, method: 'PATCH',
    body: { fullName: 'Updated Client', email: 'client@example.test', phone: '5550101', isActive: false, suspendedReason: 'Testing' }
  });
  assert.equal(result.response.status, 200, 'suspend client');
  result = await api('/api/login', { method: 'POST', body: { email: 'client@example.test', password } });
  assert.equal(result.response.status, 401, 'suspended client login denied');
  result = await api(`/api/admin/clients/${client.lastID}`, {
    cookie: adminCookie, method: 'PATCH',
    body: { fullName: 'Updated Client', email: 'client@example.test', phone: '5550101', isActive: true, suspendedReason: '' }
  });
  assert.equal(result.response.status, 200, 'reactivate client');

  result = await api('/api/admin/services', { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'service list');
  result = await api('/api/admin/services', {
    cookie: adminCookie, method: 'POST',
    body: { name: 'Admin Test Service', category: 'Test', description: 'Created by the isolated integration test.', price: '100', isAvailable: true, isPublished: true }
  });
  assert.equal(result.response.status, 201, 'service creation');
  const serviceId = result.data.id;
  result = await api(`/api/admin/services/${serviceId}`, {
    cookie: adminCookie, method: 'PATCH',
    body: { name: 'Admin Test Service', category: 'Test Updated', description: 'Updated test service.', price: '150', isAvailable: true, isPublished: true }
  });
  assert.equal(result.response.status, 200, 'service update');
  result = await api(`/api/admin/services/${serviceId}`, {
    cookie: adminCookie, method: 'PATCH',
    body: { name: 'Admin Test Service', category: 'Test Updated', description: 'Updated test service.', price: '150', isPublished: false }
  });
  assert.equal(result.response.status, 200, 'unpublish service');
  result = await api('/api/services', { cookie: clientCookie });
  assert.ok(!result.data.services.some((service) => service.id === serviceId), 'unpublished service is hidden from clients');
  result = await api(`/api/admin/services/${serviceId}`, {
    cookie: adminCookie, method: 'PATCH',
    body: { name: 'Admin Test Service', category: 'Test Updated', description: 'Updated test service.', price: '150', isPublished: true, isAvailable: false }
  });
  assert.equal(result.response.status, 200, 'disable service availability');
  result = await api('/api/services', { cookie: clientCookie });
  assert.ok(!result.data.services.some((service) => service.id === serviceId), 'unavailable service is hidden from clients');
  result = await api(`/api/admin/services/${serviceId}`, {
    cookie: adminCookie, method: 'PATCH',
    body: { name: 'Admin Test Service', category: 'Test Updated', description: 'Updated test service.', price: '150', isAvailable: true, isPublished: true }
  });
  assert.equal(result.response.status, 200, 'restore service availability');
  const imageForm = new FormData();
  imageForm.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZsAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'pixel.png');
  result = await api(`/api/admin/services/${serviceId}/image`, { cookie: adminCookie, method: 'POST', form: imageForm });
  assert.equal(result.response.status, 200, 'service image upload');
  result = await api('/api/services', { cookie: clientCookie });
  assert.equal(result.response.status, 200, 'client service catalog');
  assert.ok(result.data.services.some((service) => service.id === serviceId), 'new service is visible to clients');

  result = await api('/api/service-requests', {
    cookie: clientCookie, method: 'POST',
    body: { serviceName: 'Admin Test Service', clientName: 'Updated Client', email: 'client@example.test', phone: '5550101',
      description: 'Integration test request', priority: 'High', documents: 'attachment-reference.pdf' }
  });
  assert.equal(result.response.status, 201, 'client request creation');
  const requestId = result.data.request.id;
  result = await api('/api/admin/notifications', { cookie: adminCookie });
  assert.ok(result.data.notifications.some((notification) => notification.title === 'New service request'), 'admins receive a new-request notification');
  result = await api('/api/admin/requests?status=New', { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'filtered requests');
  const listedRequest = result.data.requests.find((item) => item.id === requestId);
  assert.ok(listedRequest, 'new request appears in admin list');
  result = await api(`/api/admin/requests/${requestId}`, { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'request details and history');
  assert.equal(result.data.request.documents, 'attachment-reference.pdf', 'request document reference is visible');
  result = await api(`/api/admin/requests/${requestId}`, {
    cookie: adminCookie, method: 'PATCH', body: { status: 'Approved', progress: 35, assignedTo: admin.lastID }
  });
  assert.equal(result.response.status, 200, 'request status/progress/assignment update');
  result = await api('/api/notifications', { cookie: clientCookie });
  assert.ok(result.data.notifications.some((notification) => notification.title.includes(requestId)), 'client is notified of request status changes');
  result = await api(`/api/admin/requests/${requestId}/notes`, {
    cookie: adminCookie, method: 'POST', body: { body: 'Private note', isInternal: true }
  });
  assert.equal(result.response.status, 201, 'internal request note');
  result = await api(`/api/admin/requests/${requestId}/notes`, {
    cookie: adminCookie, method: 'POST', body: { body: 'Client-facing update', isInternal: false }
  });
  assert.equal(result.response.status, 201, 'client request update');
  result = await api(`/api/admin/requests/${requestId}`, { cookie: adminCookie });
  assert.equal(result.data.history.length, 2, 'request submission and update history entries');
  assert.ok(result.data.history.some((entry) => entry.action === 'submitted request'), 'request submission is recorded in history');
  assert.equal(result.data.notes.length, 2, 'request notes are recorded');

  result = await api('/api/admin/notifications', {
    cookie: adminCookie, method: 'POST',
    body: { title: 'Client update', body: 'Test message', clientId: client.lastID, announcement: false }
  });
  assert.equal(result.response.status, 201, 'client notification');
  result = await api('/api/notifications', { cookie: clientCookie });
  if (!result.data.notifications.some((notification) => notification.title === 'Client update')) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    result = await api('/api/notifications', { cookie: clientCookie });
  }
  assert.ok(result.data.notifications.some((notification) => notification.title === 'Client update'), 'client receives notification');
  result = await api('/api/admin/notifications', { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'admin notification inbox');
  const notificationId = result.data.notifications[0].id;
  result = await api(`/api/admin/notifications/${notificationId}/read`, { cookie: adminCookie, method: 'PATCH' });
  assert.equal(result.response.status, 200, 'mark notification read');
  result = await api(`/api/admin/notifications/${notificationId}`, { cookie: adminCookie, method: 'DELETE' });
  assert.equal(result.response.status, 200, 'delete notification');
  result = await api('/api/admin/notifications', {
    cookie: adminCookie, method: 'POST',
    body: { title: 'Test announcement', body: 'To all active clients', announcement: true }
  });
  assert.equal(result.response.status, 201, 'client announcement');
  result = await api('/api/notifications', { cookie: clientCookie });
  if (!result.data.notifications.some((notification) => notification.title === 'Test announcement')) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    result = await api('/api/notifications', { cookie: clientCookie });
  }
  assert.ok(result.data.notifications.some((notification) => notification.title === 'Test announcement'), 'active clients receive announcements');

  for (const type of ['clients', 'requests', 'completed', 'pending', 'monthly', 'yearly']) {
    for (const format of ['pdf', 'xlsx']) {
      result = await api(`/api/admin/reports/${format}?type=${type}&from=2020-01-01&to=2099-12-31`, { cookie: adminCookie });
      assert.equal(result.response.status, 200, `${type} ${format} export`);
      assert.ok(result.data.length > 0, `${type} ${format} report has content`);
    }
  }

  result = await api('/api/admin/profile', { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'admin profile read');
  result = await api('/api/admin/profile', {
    cookie: adminCookie, method: 'PATCH',
    body: { fullName: 'Test Admin Updated', email: 'admin@example.test', phone: '5550199', currentPassword: password, newPassword: 'ChangedAdminPassword!234' }
  });
  assert.equal(result.response.status, 200, 'admin profile and password update');
  result = await api('/api/admin/profile/image', { cookie: adminCookie, method: 'POST', form: imageForm });
  assert.equal(result.response.status, 200, 'admin profile image upload');
  result = await api('/api/admin/preferences', { cookie: adminCookie, method: 'PUT', body: { emailEnabled: false, inAppEnabled: true } });
  assert.equal(result.response.status, 200, 'notification preferences update');
  result = await api('/api/admin/preferences', { cookie: adminCookie });
  assert.equal(result.data.preferences.inAppEnabled, 1, 'notification preferences read');
  const crossOriginLogout = await fetch(`${baseUrl}/api/logout`, {
    method: 'POST',
    headers: { origin: 'https://untrusted.example', cookie: adminCookie }
  });
  assert.equal(crossOriginLogout.status, 403, 'cross-origin session mutation is rejected');
  result = await api('/api/admin/login-history', { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'admin login history');
  result = await api('/api/logout', { cookie: adminCookie, method: 'POST' });
  assert.equal(result.response.status, 200, 'secure logout');
  adminCookie = await login('admin@example.test', 'ChangedAdminPassword!234');
  result = await api('/api/admin/login-history', { cookie: adminCookie });
  assert.ok(result.data.history.some((entry) => entry.action === 'logout'), 'logout is recorded');
  assert.ok(result.data.history.filter((entry) => entry.action === 'login').length >= 2, 'login events are recorded');

  result = await api('/api/register', {
    method: 'POST',
    body: { fullName: 'New Registered Client', email: 'new-client@example.test', password: 'ClientPassword!234' }
  });
  assert.equal(result.response.status, 201, 'client registration');
  await new Promise((resolve) => setTimeout(resolve, 150));
  result = await api('/api/admin/notifications', { cookie: adminCookie });
  assert.ok(result.data.notifications.some((notification) => notification.title === 'New client registered'), 'admins receive client-registration notifications');

  result = await api('/api/admin/preferences', { cookie: adminCookie, method: 'PUT', body: { emailEnabled: false, inAppEnabled: false } });
  assert.equal(result.response.status, 200, 'disable in-app admin notifications');
  result = await api('/api/register', {
    method: 'POST',
    body: { fullName: 'Muted Notification Client', email: 'muted-client@example.test', password: 'ClientPassword!234' }
  });
  assert.equal(result.response.status, 201, 'client registration while notifications are muted');
  await new Promise((resolve) => setTimeout(resolve, 150));
  result = await api('/api/admin/notifications', { cookie: adminCookie });
  assert.ok(!result.data.notifications.some((notification) => (notification.body || '').includes('Muted Notification Client')), 'in-app notification preference is enforced');
  result = await api('/api/admin/preferences', { cookie: adminCookie, method: 'PUT', body: { emailEnabled: false, inAppEnabled: true } });
  assert.equal(result.response.status, 200, 'restore in-app admin notifications');

  result = await api('/api/admin/activity', { cookie: adminCookie });
  assert.equal(result.response.status, 200, 'admin activity log');
  assert.ok(result.data.activities.some((activity) => activity.action === 'updated request status'), 'request change is audited');
  assert.ok(result.data.activities.some((activity) => activity.action === 'admin login'), 'admin login is audited');
  assert.ok(result.data.activities.some((activity) => activity.action === 'admin logout'), 'admin logout is audited');

  result = await api(`/api/admin/services/${serviceId}`, { cookie: adminCookie, method: 'DELETE' });
  assert.equal(result.response.status, 200, 'service archive');
  result = await api(`/api/superadmin/overview`, { cookie: adminCookie });
  assert.equal(result.response.status, 403, 'admin cannot access super-admin API');
  result = await api('/api/admin/overview', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'Super Admin can access authorized platform management APIs');
  result = await api('/api/admin/overview');
  assert.equal(result.response.status, 401, 'admin API requires authentication');

  const unauthenticated = await api('/api/admin/overview', { method: 'GET' });
  assert.equal(unauthenticated.response.status, 401);
  result = await api('/api/superadmin/backups', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'read backup history');
  result = await api('/api/superadmin/backups', { cookie: adminCookie });
  assert.equal(result.response.status, 403, 'Admin cannot view or operate on database backups');
  result = await api('/api/superadmin/backups', { cookie: adminCookie, method: 'POST' });
  assert.equal(result.response.status, 403, 'Admin cannot create database backups');
  result = await api('/api/superadmin/backups', { cookie: superadminCookie, method: 'POST' });
  assert.equal(result.response.status, 201, 'create database backup');
  result = await api('/api/superadmin/backups', { cookie: superadminCookie });
  const backup = result.data.backups.find((item) => item.status === 'completed');
  assert.ok(backup && backup.status === 'completed', 'backup appears in history');
  result = await api(`/api/superadmin/backups/${backup.id}/download`, { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'download authorized backup');
  assert.equal(result.data.subarray(0, 15).toString('utf8'), 'SQLite format 3', 'download is a SQLite database file');
  result = await api(`/api/superadmin/backups/${backup.id}/restore`, {
    cookie: superadminCookie, method: 'POST', body: { confirmation: 'RESTORE' }
  });
  assert.equal(result.response.status, 400, 'restore requires explicit confirmation phrase');
  result = await api(`/api/superadmin/backups/${backup.id}/restore`, {
    cookie: superadminCookie, method: 'POST', body: { confirmation: 'RESTORE DATABASE' }
  });
  assert.equal(result.response.status, 200, 'restore valid backup with active Super Admin preserved');
  result = await api('/api/superadmin/settings', { cookie: superadminCookie });
  assert.equal(result.response.status, 200, 'Super Admin session remains valid after restore');
  assert.equal(result.data.system.databaseIntegrity, 'ok', 'restored database passes integrity check');
  result = await api('/api/superadmin/backups', { cookie: superadminCookie });
  assert.ok(result.data.backups.length >= 2, 'pre-restore safety backup remains in history');
  console.log('Admin and Super Admin integration checks passed: dashboards, users, services, requests, notifications, reports, profiles, backups, access control.');
}

main()
  .catch((error) => {
    console.error(error);
    if (serverProcess && serverProcess.exitCode === null) console.error(serverOutput);
    process.exitCode = 1;
  })
  .finally(() => {
    if (!serverProcess || serverProcess.exitCode !== null) {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    } else {
      serverProcess.once('exit', () => fs.rmSync(tempDirectory, { recursive: true, force: true }));
      serverProcess.kill();
      setTimeout(() => {
        if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL');
      }, 3000).unref();
    }
  });
