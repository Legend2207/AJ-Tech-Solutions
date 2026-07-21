const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const http = require('http');
const { Server } = require('socket.io');

const db = new sqlite3.Database(path.join(__dirname, 'auth.db'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(session({
  secret: 'aj-tech-solutions-secure-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));

function initDb() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        read INTEGER NOT NULL DEFAULT 0
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS service_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_name TEXT NOT NULL,
        client_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        company_name TEXT,
        description TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'Medium',
        preferred_start_date TEXT,
        estimated_budget TEXT,
        documents TEXT,
        additional_notes TEXT,
        status TEXT NOT NULL DEFAULT 'New',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id TEXT NOT NULL,
        amount TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Outstanding',
        due_date TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Open',
        priority TEXT NOT NULL DEFAULT 'Medium',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.get('SELECT COUNT(*) as c FROM notifications', (err, row) => {
      if (!err && row && row.c === 0) {
        const stmt = db.prepare('INSERT INTO notifications (title, body) VALUES (?, ?)');
        stmt.run('Invoice generated', 'Invoice #INV-2041 is ready for download.');
        stmt.run('Technician assigned', 'Grace Okafor has been assigned to your website project.');
        stmt.run('Service completed', 'Your cloud migration package is now complete.');
        stmt.finalize();
      }
    });
  });
}

initDb();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/register', async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please fill in all fields.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    'INSERT INTO users (fullName, email, password) VALUES (?, ?, ?)',
    [fullName, email, hashedPassword],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ success: false, message: 'This email is already registered. Please sign in or use a different email address.' });
        }
        return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
      }

      req.session.user = { id: this.lastID, fullName, email };
      res.status(201).json({ success: true, message: 'Registration successful! You can now sign in.' });
    }
  );
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please enter your email and password.' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ success: false, message: 'Login failed.' });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    req.session.user = { id: user.id, fullName: user.fullName, email: user.email };
    res.json({ success: true, message: 'Login successful.', user: req.session.user });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  res.json({ success: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true, message: 'Logged out.' }));
});

// Demo: dashboard stats (public for demo purposes)
app.get('/api/stats', (req, res) => {
  res.json({
    clients: 1248,
    employees: 342,
    services: 18,
    revenue: 124800,
    paymentsReceived: 98120,
    pendingInvoices: 12,
    ticketsOpen: 7,
    inventoryItems: 412,
    revenueSeries: [42000,48000,52000,61000,68000,72000,81000,92000,98000,104000,112000,124800]
  });
});

// Demo: recent clients list
app.get('/api/clients', (req, res) => {
  const clients = [
    { id: 1, name: 'Mary Allen', company: 'Bluefin Corp', joined: '2026-06-19', status: 'Active' },
    { id: 2, name: 'Nova Tech', company: 'Nova LLC', joined: '2026-06-10', status: 'Pending' },
    { id: 3, name: 'Samuel K.', company: 'Edgeworks', joined: '2026-05-28', status: 'Overdue' },
    { id: 4, name: 'Orion Systems', company: 'Orion', joined: '2026-04-15', status: 'Active' },
    { id: 5, name: 'Luna Labs', company: 'Luna', joined: '2026-03-22', status: 'Active' },
    { id: 6, name: 'Zenora', company: 'Zenora Ltd', joined: '2026-02-01', status: 'Inactive' },
    { id: 7, name: 'Apex Solutions', company: 'Apex', joined: '2026-01-11', status: 'Active' }
  ];
  res.json({ clients });
});

// Demo: service requests (persisted)
app.post('/api/service-requests', (req, res) => {
  const payload = req.body || {};
  const requiredFields = ['serviceName', 'clientName', 'email', 'phone', 'description', 'priority'];
  const missing = requiredFields.filter((field) => !payload[field]);

  if (missing.length) {
    return res.status(400).json({ success: false, message: 'Please complete the required service request fields.' });
  }

  const query = `
    INSERT INTO service_requests (
      service_name, client_name, email, phone, company_name, description, priority,
      preferred_start_date, estimated_budget, documents, additional_notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    payload.serviceName,
    payload.clientName,
    payload.email,
    payload.phone,
    payload.companyName || null,
    payload.description,
    payload.priority || 'Medium',
    payload.preferredStartDate || null,
    payload.estimatedBudget || null,
    payload.documents || null,
    payload.additionalNotes || null,
    'New'
  ], function (err) {
    if (err) return res.status(500).json({ success: false, message: 'Unable to save request.' });

    const requestId = `REQ-${String(this.lastID).padStart(4, '0')}`;
    const notificationBody = `${payload.clientName} requested ${payload.serviceName} with ${payload.priority} priority.`;

    db.run('INSERT INTO notifications (title, body) VALUES (?, ?)', ['New Service Request', notificationBody], function (notificationErr) {
      if (!notificationErr) {
        try { io && io.emit('notification', { id: this.lastID, title: 'New Service Request', body: notificationBody, time: new Date().toISOString(), read: false }); } catch (e) {}
      }
      res.status(201).json({ success: true, message: 'Request saved successfully.', request: { id: requestId, serviceName: payload.serviceName } });
    });
  });
});

app.get('/api/service-requests', (req, res) => {
  db.all('SELECT * FROM service_requests ORDER BY id DESC LIMIT 20', (err, rows) => {
    if (err) return res.status(500).json({ success: false, requests: [] });
    res.json({ success: true, requests: rows });
  });
});

app.get('/api/payments', (req, res) => {
  db.all('SELECT * FROM payments ORDER BY id DESC LIMIT 20', (err, rows) => {
    if (err) return res.status(500).json({ success: false, payments: [] });
    res.json({ success: true, payments: rows });
  });
});

app.get('/api/tickets', (req, res) => {
  db.all('SELECT * FROM tickets ORDER BY id DESC LIMIT 20', (err, rows) => {
    if (err) return res.status(500).json({ success: false, tickets: [] });
    res.json({ success: true, tickets: rows });
  });
});

app.get('/api/documents', (req, res) => {
  db.all('SELECT * FROM documents ORDER BY id DESC LIMIT 20', (err, rows) => {
    if (err) return res.status(500).json({ success: false, documents: [] });
    res.json({ success: true, documents: rows });
  });
});

// notifications (persisted)
app.get('/api/notifications', (req, res) => {
  db.all('SELECT id, title, body, createdAt, read FROM notifications ORDER BY id DESC LIMIT 50', (err, rows) => {
    if (err) return res.status(500).json({ notifications: [] });
    // map rows to a simple structure
    const notifications = rows.map(r => ({ id: r.id, title: r.title, body: r.body, time: r.createdAt, read: !!r.read }));
    res.json({ notifications });
  });
});

// unread count
app.get('/api/notifications/unread-count', (req, res) => {
  db.get('SELECT COUNT(*) as c FROM notifications WHERE read = 0', (err, row) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, count: row ? row.c : 0 });
  });
});

// validate API key (for clients to probe whether the saved key is correct)
app.post('/api/notifications/validate-key', (req, res) => {
  const expectedKey = process.env.NOTIF_API_KEY;
  // if no server-side key is configured, treat any key as valid
  if (!expectedKey) return res.json({ success: true, valid: true, message: 'No server-side key configured' });
  const provided = req.get('x-api-key') || '';
  if (provided && provided === expectedKey) return res.json({ success: true, valid: true });
  return res.status(401).json({ success: false, valid: false, message: 'Invalid API key' });
});

// mark a notification as read
app.post('/api/notifications/mark-read', (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ success: false, message: 'Missing id' });
  db.run('UPDATE notifications SET read = 1 WHERE id = ?', [id], function(err){
    if (err) return res.status(500).json({ success: false });
    // emit to clients that a notification was marked
    try{ io && io.emit('notification:marked', id); }catch(e){}
    // update unread count
    db.get('SELECT COUNT(*) as c FROM notifications WHERE read = 0', (err, row) => {
      try{ io && io.emit('notifications:count', row ? row.c : 0); }catch(e){}
      res.json({ success: true, id });
    });
  });
});

// clear all notifications (mark as read)
app.post('/api/notifications/clear', (req, res) => {
  db.run('UPDATE notifications SET read = 1 WHERE read = 0', function(err){
    if (err) return res.status(500).json({ success: false });
    // emit cleared and new count
    try{ io && io.emit('notifications:cleared'); }catch(e){}
    try{ io && io.emit('notifications:count', 0); }catch(e){}
    res.json({ success: true, cleared: this.changes });
  });
});

// create a new notification (webhook/admin)
app.post('/api/notifications/create', (req, res) => {
  // optional API key protection: if NOTIF_API_KEY is set, require header x-api-key
  const expectedKey = process.env.NOTIF_API_KEY;
  if (expectedKey) {
    const provided = req.get('x-api-key');
    if (!provided || provided !== expectedKey) return res.status(401).json({ success: false, message: 'Invalid API key' });
  }

  const { title, body } = req.body || {};
  if (!title) return res.status(400).json({ success: false, message: 'Missing title' });
  db.run('INSERT INTO notifications (title, body) VALUES (?, ?)', [title, body || null], function(err){
    if (err) return res.status(500).json({ success: false });
    const id = this.lastID;
    const createdAt = new Date().toISOString();
    const payload = { id, title, body: body || null, time: createdAt, read: false };
    // emit new notification and updated unread count
    try{ io && io.emit('notification', payload); }catch(e){}
    db.get('SELECT COUNT(*) as c FROM notifications WHERE read = 0', (err, row) => {
      try{ io && io.emit('notifications:count', row ? row.c : 0); }catch(e){}
      res.status(201).json({ success: true, notification: payload });
    });
  });
});

// create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);
  socket.on('disconnect', ()=> console.log('Socket disconnected', socket.id));
});

server.listen(PORT, () => {
  console.log(`AJ Tech Solutions auth server running on http://localhost:${PORT}`);
});
