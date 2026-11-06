const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;
const http = require('http');
const { Server } = require('socket.io');

const databasePath = process.env.DB_PATH || path.join(__dirname, 'auth.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new sqlite3.Database(databasePath);
const uploadDirectory = path.join(path.dirname(databasePath), 'uploads');
const backupDirectory = path.join(path.dirname(databasePath), 'backups');
fs.mkdirSync(uploadDirectory, { recursive: true });
fs.mkdirSync(backupDirectory, { recursive: true });
let sessionTimeoutMs = 8 * 60 * 60 * 1000;

const defaultServices = [
  ['Website Development', 'Web Development', 'High-converting web experiences with premium design and performance optimization.'],
  ['Software Development', 'Software', 'Custom business software tailored to your internal workflows and growth goals.'],
  ['Mobile App Development', 'Mobile', 'Modern mobile solutions for Android, iOS, or cross-platform experiences.'],
  ['Networking', 'Infrastructure', 'Secure networking, cabling, and infrastructure upgrades for modern teams.'],
  ['CCTV Installation', 'Security', 'Reliable surveillance systems designed for offices, homes, and retail sites.'],
  ['Cloud Solutions', 'Cloud', 'Scalable cloud migration and managed infrastructure for modern organizations.'],
  ['Cybersecurity', 'Security', 'Protect your systems with risk reviews, endpoint defense, and compliance planning.'],
  ['Computer Maintenance', 'Support', 'Proactive maintenance, hardware support, and device optimization.'],
  ['IT Consulting', 'Consulting', 'Strategic guidance for digital operations, systems, staffing, and transformation.'],
  ['Graphics Design', 'Design', 'Brand visuals, presentations, marketing collateral, and UI design assets.'],
  ['Digital Branding', 'Design', 'Create a memorable visual identity with positioning and brand systems.'],
  ['IT Training & Facilitation', 'Training', 'Hands-on training for teams and leadership across core technology topics.']
];

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be configured in production.');
}

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  next();
});
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    return res.status(403).json({ success: false, message: 'Cross-origin requests are not allowed.' });
  }
  next();
});
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use('/img', express.static(path.join(__dirname, 'img'), { dotfiles: 'deny', index: false }));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));

class SQLiteSessionStore extends session.Store {
  get(sid, callback) {
    db.get('SELECT sess, expires FROM sessions WHERE sid = ?', [sid], (error, row) => {
      if (error) return callback(error);
      if (!row) return callback(null, null);
      if (row.expires <= Date.now()) {
        return this.destroy(sid, (destroyError) => callback(destroyError, null));
      }
      try {
        callback(null, JSON.parse(row.sess));
      } catch (parseError) {
        callback(parseError);
      }
    });
  }

  set(sid, value, callback = () => {}) {
    const expires = value.cookie && value.cookie.expires
      ? new Date(value.cookie.expires).getTime()
      : Date.now() + 1000 * 60 * 60 * 8;
    db.run(
      'INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires',
      [sid, JSON.stringify(value), expires],
      callback
    );
  }

  destroy(sid, callback = () => {}) {
    db.run('DELETE FROM sessions WHERE sid = ?', [sid], callback);
  }

  touch(sid, value, callback = () => {}) {
    const expires = value.cookie && value.cookie.expires
      ? new Date(value.cookie.expires).getTime()
      : Date.now() + 1000 * 60 * 60 * 8;
    db.run('UPDATE sessions SET expires = ? WHERE sid = ?', [expires, sid], callback);
  }
}

const sessionMiddleware = session({
  name: 'aj.sid',
  secret: process.env.SESSION_SECRET || 'local-development-secret-change-before-deploying',
  store: new SQLiteSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionTimeoutMs
  }
});
app.use(sessionMiddleware);
app.use('/api', (req, res, next) => {
  db.get('SELECT value FROM system_settings WHERE key = ?', ['maintenance_mode'], (error, setting) => {
    if (error) {
      console.error('Maintenance setting lookup error:', error);
      return res.status(500).json({ success: false, message: 'Unable to verify platform availability.' });
    }
    if (!setting || setting.value !== '1' || req.session.user && req.session.user.role === 'superadmin' ||
        ['/public/site', '/login', '/me', '/logout'].includes(req.path) || req.path.startsWith('/superadmin/')) {
      return next();
    }
    res.set('Retry-After', '300');
    res.status(503).json({ success: false, message: 'The client portal is temporarily under maintenance. Please try again later.' });
  });
});
app.use('/api', (req, res, next) => {
  if (!req.session.user || !req.session.user.passwordResetRequired ||
      ['/account/change-password', '/logout', '/me'].includes(req.path)) return next();
  res.status(428).json({ success: false, message: 'Change your temporary password before continuing.' });
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

function getSystemSetting(key, fallback) {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM system_settings WHERE key = ?', [key], (error, row) => {
      if (error) return reject(error);
      resolve(row ? row.value : fallback);
    });
  });
}

function recordActivity(actorId, action, entityType, entityId, details) {
  db.run(
    'INSERT INTO admin_activity (actor_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
    [actorId || null, action, entityType, entityId == null ? null : String(entityId), details || null],
    (error) => {
      if (error) console.error('Activity log write error:', error);
    }
  );
}

function recordLoginEvent(userId, action, req) {
  db.get('SELECT role FROM users WHERE id = ?', [userId], (roleError, user) => {
    if (roleError) console.error('Login activity role lookup error:', roleError);
    else if (user && user.role === 'admin') {
      recordActivity(userId, action === 'login' ? 'admin login' : 'admin logout', 'admin', userId, req.ip || null);
    }
  });
  db.run(
    'INSERT INTO login_history (user_id, action, ip_address, user_agent) VALUES (?, ?, ?, ?)',
    [
      userId,
      action,
      req.ip || null,
      String(req.get('user-agent') || '').slice(0, 500) || null
    ],
    (error) => {
      if (error) console.error('Login history write error:', error);
    }
  );
}

function notifyUser(userId, title, body) {
  db.get('SELECT in_app_enabled FROM notification_preferences WHERE user_id = ?', [userId], (preferenceError, preference) => {
    if (preferenceError) {
      console.error('Notification preference lookup error:', preferenceError);
      return;
    }
    if (preference && !preference.in_app_enabled) return;
    db.run('INSERT INTO notifications (title, body, user_id) VALUES (?, ?, ?)', [title, body || null, userId], function (error) {
      if (error) {
        console.error('Notification write error:', error);
        return;
      }
      io.to(`user:${userId}`).emit('notification', {
        id: this.lastID,
        title,
        body: body || null,
        time: new Date().toISOString(),
        read: false
      });
    });
  });
}

function notifyRole(role, title, body) {
  db.all('SELECT id FROM users WHERE role = ? AND is_active = 1', [role], (error, users) => {
    if (error) {
      console.error('Notification recipients read error:', error);
      return;
    }
    users.forEach((user) => notifyUser(user.id, title, body));
  });
}

async function ensureColumn(table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client',
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    suspended_reason TEXT,
    last_login_at TEXT,
    profile_image TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER
  )`);
  await run(`CREATE TABLE IF NOT EXISTS service_requests (
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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER
  )`);
  await run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT NOT NULL,
    amount TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Outstanding',
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER
  )`);
  await run(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open',
    priority TEXT NOT NULL DEFAULT 'Medium',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER
  )`);
  await run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER
  )`);
  await run(`CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires INTEGER NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'General',
    description TEXT NOT NULL,
    price TEXT,
    image_path TEXT,
    is_available INTEGER NOT NULL DEFAULT 1,
    is_published INTEGER NOT NULL DEFAULT 1,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS request_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES service_requests(id),
    actor_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS request_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES service_requests(id),
    actor_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    is_internal INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS admin_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    email_enabled INTEGER NOT NULL DEFAULT 0,
    in_app_enabled INTEGER NOT NULL DEFAULT 1
  )`);
  await run(`CREATE TABLE IF NOT EXISTS admin_permissions (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 0,
    updated_by INTEGER REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, module)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    is_published INTEGER NOT NULL DEFAULT 1,
    updated_by INTEGER REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    success INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    details TEXT
  )`);
  await run(`CREATE TABLE IF NOT EXISTS account_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    requester_ip TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    rejection_reason TEXT
  )`);

  for (const [table, column, definition] of [
    ['users', 'role', "TEXT NOT NULL DEFAULT 'client'"],
    ['users', 'phone', 'TEXT'],
    ['users', 'is_active', 'INTEGER NOT NULL DEFAULT 1'],
    ['users', 'suspended_reason', 'TEXT'],
    ['users', 'last_login_at', 'TEXT'],
    ['users', 'profile_image', 'TEXT'],
    ['users', 'password_reset_required', 'INTEGER NOT NULL DEFAULT 0'],
    ['account_requests', 'requester_ip', 'TEXT'],
    ['service_requests', 'assigned_to', 'INTEGER'],
    ['service_requests', 'progress', 'INTEGER NOT NULL DEFAULT 0']
  ]) {
    await ensureColumn(table, column, definition);
  }
  for (const [table, column] of [
    ['notifications', 'user_id'],
    ['service_requests', 'user_id'],
    ['payments', 'user_id'],
    ['tickets', 'user_id'],
    ['documents', 'user_id']
  ]) {
    await ensureColumn(table, column, 'INTEGER');
  }
  await run('CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id, id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id, id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id, id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id, id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_chat_messages_pair ON chat_messages(sender_id, recipient_id, id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON chat_messages(recipient_id, id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_services_visibility ON services(is_published, is_archived, is_available)');
  await run('CREATE INDEX IF NOT EXISTS idx_request_history_request ON request_history(request_id, id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity(id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires)');
  await run('CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(id DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(id DESC)');
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_account_requests_email ON account_requests(email) WHERE status = 'pending'");
  await run('CREATE INDEX IF NOT EXISTS idx_account_requests_status ON account_requests(status, requested_at DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_account_requests_ip ON account_requests(requester_ip, requested_at DESC)');
  await run('DELETE FROM sessions WHERE expires <= ?', [Date.now()]);
  const settings = await all('SELECT key, value FROM system_settings WHERE key IN (?, ?)', ['session_timeout_minutes', 'password_min_length']);
  const settingMap = Object.fromEntries(settings.map((item) => [item.key, item.value]));
  const configuredTimeout = Number(settingMap.session_timeout_minutes);
  if (Number.isSafeInteger(configuredTimeout) && configuredTimeout >= 15 && configuredTimeout <= 10080) {
    sessionTimeoutMs = configuredTimeout * 60 * 1000;
  }
  await run('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)', ['session_timeout_minutes', '480']);
  await run('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)', ['password_min_length', '12']);
  const defaultContent = [
    ['company_name', 'AJ Tech Solutions'],
    ['hero_headline', 'Technology for your next step.'],
    ['hero_intro', 'Websites, software, mobile apps, cloud, networking, security, and IT support.'],
    ['about_text', 'We help organizations use technology to work smarter and grow.'],
    ['contact_email', ''],
    ['contact_phone', ''],
    ['contact_address', ''],
    ['announcement', ''],
    ['faq_json', '[]'],
    ['banner_image', ''],
    ['company_logo', '']
  ];
  for (const [key, value] of defaultContent) {
    await run('INSERT OR IGNORE INTO site_content (key, value) VALUES (?, ?)', [key, value]);
  }
  for (const [name, category, description] of defaultServices) {
    await run(
      'INSERT OR IGNORE INTO services (name, category, description) VALUES (?, ?, ?)',
      [name, category, description]
    );
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/healthz', (req, res) => {
  db.get('SELECT 1 AS healthy', (error) => {
    if (error) {
      console.error('Health check database error:', error);
      return res.status(503).json({ success: false });
    }
    res.json({ success: true });
  });
});

function loadAuthenticatedUser(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Please sign in to access your account.' });
  }
  db.get(
    'SELECT id, fullName, email, role, phone, is_active, profile_image, password_reset_required FROM users WHERE id = ?',
    [req.session.user.id],
    (error, user) => {
      if (error) {
        console.error('Session account lookup error:', error);
        return res.status(500).json({ success: false, message: 'Unable to verify your account.' });
      }
      if (!user || !user.is_active) {
        return res.status(403).json({ success: false, message: 'This account is inactive or suspended.' });
      }
      req.session.user = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role || 'client',
        phone: user.phone,
        profileImage: user.profile_image,
        passwordResetRequired: Boolean(user.password_reset_required)
      };
      next();
    }
  );
}

const requireAuth = loadAuthenticatedUser;

function requireRole(...roles) {
  return (req, res, next) => {
    loadAuthenticatedUser(req, res, () => {
      if (!roles.includes(req.session.user.role || 'client')) {
        return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
      }
      next();
    });
  };
}

const adminModules = ['overview', 'clients', 'services', 'requests', 'communications', 'reports', 'notifications', 'activity', 'profile'];

function requireAdminModule(module) {
  return (req, res, next) => requireRole('admin', 'superadmin')(req, res, () => {
    if (req.session.user.role === 'superadmin') return next();
    db.get('SELECT allowed FROM admin_permissions WHERE user_id = ? AND module = ?',
      [req.session.user.id, module], (error, permission) => {
        if (error) {
          console.error('Admin permission lookup error:', error);
          return res.status(500).json({ success: false, message: 'Unable to verify module permissions.' });
        }
        if (permission && !permission.allowed) {
          return res.status(403).json({ success: false, message: 'Your account does not have access to this Admin module.' });
        }
        next();
      });
  });
}

function recordLoginAttempt(email, success, req) {
  db.run(
    'INSERT INTO login_attempts (email, success, ip_address, user_agent) VALUES (?, ?, ?, ?)',
    [String(email || '').slice(0, 254).toLowerCase(), Number(success), req.ip || null,
      String(req.get('user-agent') || '').slice(0, 500) || null],
    (error) => {
      if (error) console.error('Login attempt audit write error:', error);
    }
  );
}

function canChat(senderRole, recipientRole) {
  return (senderRole === 'client' && recipientRole === 'admin') ||
    (senderRole === 'admin' && ['client', 'superadmin'].includes(recipientRole)) ||
    (senderRole === 'superadmin' && recipientRole === 'admin');
}

function chatContactRoles(role) {
  if (role === 'client') return ['admin'];
  if (role === 'admin') return ['client', 'superadmin'];
  if (role === 'superadmin') return ['admin'];
  return [];
}

app.get('/api/chat/contacts', requireAuth, (req, res) => {
  const roles = chatContactRoles(req.session.user.role || 'client');
  if (!roles.length) return res.status(403).json({ success: false, message: 'Chat is not available for this account.' });
  const placeholders = roles.map(() => '?').join(', ');
  db.all(
    `SELECT u.id, u.fullName, u.role,
       (SELECT body FROM chat_messages m
        WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id)
        ORDER BY m.id DESC LIMIT 1) AS lastMessage,
       (SELECT created_at FROM chat_messages m
        WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id)
        ORDER BY m.id DESC LIMIT 1) AS lastMessageAt
     FROM users u
     WHERE u.role IN (${placeholders}) AND u.id != ?
     ORDER BY COALESCE(lastMessageAt, u.createdAt) DESC, u.fullName COLLATE NOCASE`,
    [
      req.session.user.id, req.session.user.id,
      req.session.user.id, req.session.user.id,
      ...roles, req.session.user.id
    ],
    (error, contacts) => {
      if (error) {
        console.error('Chat contacts read error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load chat contacts.' });
      }
      res.json({ success: true, contacts });
    }
  );
});

app.get('/api/chat/:contactId/messages', requireAuth, (req, res) => {
  const contactId = Number(req.params.contactId);
  if (!Number.isSafeInteger(contactId) || contactId <= 0 || contactId === req.session.user.id) {
    return res.status(400).json({ success: false, message: 'A valid chat contact is required.' });
  }
  db.get('SELECT id, role FROM users WHERE id = ?', [contactId], (userError, contact) => {
    if (userError) {
      console.error('Chat contact lookup error:', userError);
      return res.status(500).json({ success: false, message: 'Unable to load this conversation.' });
    }
    if (!contact || !canChat(req.session.user.role || 'client', contact.role)) {
      return res.status(403).json({ success: false, message: 'You cannot access this conversation.' });
    }
    db.all(
      `SELECT id, sender_id AS senderId, recipient_id AS recipientId, body, created_at AS createdAt
       FROM (
         SELECT id, sender_id, recipient_id, body, created_at
         FROM chat_messages
         WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
         ORDER BY id DESC LIMIT 100
       )
       ORDER BY id ASC`,
      [req.session.user.id, contactId, contactId, req.session.user.id],
      (error, messages) => {
        if (error) {
          console.error('Chat history read error:', error);
          return res.status(500).json({ success: false, message: 'Unable to load this conversation.' });
        }
        res.json({ success: true, messages });
      }
    );
  });
});

app.post('/api/chat/messages', requireAuth, (req, res) => {
  const recipientId = Number(req.body && req.body.recipientId);
  const body = typeof (req.body && req.body.body) === 'string' ? req.body.body.trim() : '';
  if (!Number.isSafeInteger(recipientId) || recipientId <= 0 || recipientId === req.session.user.id ||
      !body || body.length > 2000) {
    return res.status(400).json({ success: false, message: 'Enter a message of up to 2,000 characters and choose a valid recipient.' });
  }
  db.get('SELECT id, role FROM users WHERE id = ?', [recipientId], (userError, recipient) => {
    if (userError) {
      console.error('Chat recipient lookup error:', userError);
      return res.status(500).json({ success: false, message: 'Unable to send your message.' });
    }
    if (!recipient || !canChat(req.session.user.role || 'client', recipient.role)) {
      return res.status(403).json({ success: false, message: 'You cannot message this account.' });
    }
    db.run(
      'INSERT INTO chat_messages (sender_id, recipient_id, body) VALUES (?, ?, ?)',
      [req.session.user.id, recipientId, body],
      function (error) {
        if (error) {
          console.error('Chat message save error:', error);
          return res.status(500).json({ success: false, message: 'Unable to send your message.' });
        }
        const message = {
          id: this.lastID,
          senderId: req.session.user.id,
          recipientId,
          body,
          createdAt: new Date().toISOString()
        };
        io.to(`user:${req.session.user.id}`).to(`user:${recipientId}`).emit('chat:message', message);
        res.status(201).json({ success: true, message });
      }
    );
  });
});

app.get('/api/staff/requests', requireAdminModule('requests'), (req, res) => {
  db.all(
    `SELECT r.id, r.service_name AS service, r.status, r.priority, r.created_at AS createdAt,
       r.user_id AS clientId, u.fullName AS clientName, u.email AS clientEmail
     FROM service_requests r
     JOIN users u ON u.id = r.user_id
     ORDER BY r.id DESC LIMIT 200`,
    (error, requests) => {
      if (error) {
        console.error('Staff request read error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load client requests.' });
      }
      res.json({ success: true, requests: requests.map((request) => ({
        ...request,
        id: `REQ-${String(request.id).padStart(4, '0')}`
      })) });
    }
  );
});

app.get('/api/public/site', (req, res) => {
  db.all('SELECT key, value FROM site_content WHERE is_published = 1', (error, rows) => {
    if (error) {
      console.error('Published website content read error:', error);
      return res.status(500).json({ success: false, message: 'Unable to load website content.' });
    }
    db.get('SELECT value FROM system_settings WHERE key = ?', ['maintenance_mode'], (settingError, maintenance) => {
      if (settingError) {
        console.error('Public maintenance status lookup error:', settingError);
        return res.status(500).json({ success: false, message: 'Unable to load website availability.' });
      }
      db.all(
      `SELECT id, name, category, description, price, image_path AS image
       FROM services WHERE is_published = 1 AND is_available = 1 AND is_archived = 0
       ORDER BY category COLLATE NOCASE, name COLLATE NOCASE`,
      (serviceError, services) => {
        if (serviceError) {
          console.error('Public service catalog read error:', serviceError);
          return res.status(500).json({ success: false, message: 'Unable to load website services.' });
        }
        res.json({
          success: true,
          content: Object.fromEntries(rows.map((item) => [item.key, item.value])),
          services,
          maintenanceMode: Boolean(maintenance && maintenance.value === '1')
        });
      }
      );
    });
  });
});

app.get('/api/superadmin/overview', requireRole('superadmin'), async (req, res) => {
  const range = readDateRange(req.query);
  if (!range) return res.status(400).json({ success: false, message: 'Use valid from/to dates in YYYY-MM-DD format.' });
  try {
    const stats = await new Promise((resolve, reject) => {
      db.get(
        `SELECT
           (SELECT COUNT(*) FROM users WHERE role = 'client') AS totalClients,
           (SELECT COUNT(*) FROM users WHERE role = 'admin') AS totalAdmins,
           (SELECT COUNT(*) FROM users WHERE role = 'superadmin') AS totalSuperadmins,
           (SELECT COUNT(*) FROM users WHERE is_active = 1) AS activeUsers,
           (SELECT COUNT(*) FROM users WHERE is_active = 0) AS suspendedUsers,
           (SELECT COUNT(*) FROM service_requests) AS totalRequests,
           (SELECT COUNT(*) FROM service_requests WHERE status IN ('New', 'Pending')) AS pendingRequests,
           (SELECT COUNT(*) FROM service_requests WHERE status = 'Approved') AS approvedRequests,
           (SELECT COUNT(*) FROM service_requests WHERE status = 'Rejected') AS rejectedRequests,
           (SELECT COUNT(*) FROM service_requests WHERE status = 'Completed') AS completedRequests,
           (SELECT COUNT(*) FROM services WHERE is_published = 1 AND is_available = 1 AND is_archived = 0) AS availableServices,
           (SELECT COUNT(*) FROM users WHERE createdAt BETWEEN ? AND ?) AS registrationsInRange,
           (SELECT COUNT(*) FROM service_requests WHERE created_at BETWEEN ? AND ?) AS requestsInRange`,
        [range.from, range.to, range.from, range.to],
        (error, row) => error ? reject(error) : resolve(row)
      );
    });
    const [activity, registrations, requestTrends] = await Promise.all([
      all(
        `SELECT a.id, a.action, a.entity_type AS entityType, a.entity_id AS entityId,
           a.details, a.created_at AS createdAt, u.fullName AS actor, u.role AS actorRole
         FROM admin_activity a LEFT JOIN users u ON u.id = a.actor_id
         WHERE a.created_at BETWEEN ? AND ? ORDER BY a.id DESC LIMIT 20`,
        [range.from, range.to]
      ),
      all(
        `SELECT id, fullName, email, role, is_active AS isActive, createdAt AS registeredAt
         FROM users WHERE createdAt BETWEEN ? AND ? ORDER BY id DESC LIMIT 20`,
        [range.from, range.to]
      ),
      all(
        `SELECT strftime('%Y-%m', created_at) AS period, COUNT(*) AS requests,
           SUM(status = 'Completed') AS completed
         FROM service_requests WHERE created_at BETWEEN ? AND ?
         GROUP BY period ORDER BY period`,
        [range.from, range.to]
      )
    ]);
    res.json({ success: true, stats, activity, registrations, requestTrends });
  } catch (error) {
    console.error('Super-admin overview error:', error);
    res.status(500).json({ success: false, message: 'Unable to load the platform overview.' });
  }
});

app.get('/api/superadmin/users', requireRole('superadmin'), (req, res) => {
  const role = ['client', 'admin', 'superadmin'].includes(req.query.role) ? req.query.role : '';
  const status = ['active', 'suspended'].includes(req.query.status) ? req.query.status : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const sortBy = { name: 'fullName', email: 'email', role: 'role', registered: 'createdAt', lastLogin: 'last_login_at' };
  const sort = sortBy[req.query.sort] || sortBy.registered;
  const direction = req.query.order === 'asc' ? 'ASC' : 'DESC';
  const conditions = [];
  const values = [];
  if (role) { conditions.push('role = ?'); values.push(role); }
  if (status) { conditions.push('is_active = ?'); values.push(status === 'active' ? 1 : 0); }
  if (search) {
    conditions.push('(fullName LIKE ? OR email LIKE ? OR phone LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  db.all(
    `SELECT id, fullName, email, phone, role, is_active AS isActive, suspended_reason AS suspendedReason,
       createdAt AS registeredAt, last_login_at AS lastLoginAt, profile_image AS profileImage,
       (SELECT COUNT(*) FROM service_requests WHERE assigned_to = users.id) AS assignedRequests,
       (SELECT COUNT(*) FROM service_requests WHERE assigned_to = users.id AND status = 'Completed') AS completedRequests,
       (SELECT COUNT(*) FROM service_requests WHERE assigned_to = users.id AND status IN ('New', 'Pending', 'Approved', 'In Progress')) AS openRequests
     FROM users ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY ${sort} ${direction}`,
    values, (error, users) => {
      if (error) {
        console.error('Super-admin user list error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load platform users.' });
      }
      res.json({ success: true, users });
    }
  );
});

app.get('/api/superadmin/users/:id', requireRole('superadmin'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid user ID is required.' });
  db.get(
    `SELECT id, fullName, email, phone, role, is_active AS isActive, suspended_reason AS suspendedReason,
       createdAt AS registeredAt, last_login_at AS lastLoginAt, profile_image AS profileImage
     FROM users WHERE id = ?`, [id], (error, user) => {
      if (error) {
        console.error('Super-admin user profile error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load the user profile.' });
      }
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      Promise.all([
        all(
          `SELECT id, service_name AS service, status, priority, created_at AS createdAt, assigned_to AS assignedTo
           FROM service_requests WHERE user_id = ? ORDER BY id DESC`,
          [id]
        ),
        all(
          `SELECT action, ip_address AS ipAddress, created_at AS createdAt
           FROM login_history WHERE user_id = ? ORDER BY id DESC LIMIT 100`,
          [id]
        ),
        all(
          `SELECT id, action, entity_type AS entityType, entity_id AS entityId, details, created_at AS createdAt
           FROM admin_activity WHERE actor_id = ? ORDER BY id DESC LIMIT 100`,
          [id]
        )
      ]).then(([requests, loginHistory, activities]) => {
        res.json({
          success: true, user, requests, loginHistory, activities,
          requestStats: {
            total: requests.length,
            completed: requests.filter((request) => request.status === 'Completed').length,
            active: requests.filter((request) => !['Completed', 'Rejected'].includes(request.status)).length
          }
        });
      }).catch((detailError) => {
        console.error('Super-admin user details lookup error:', detailError);
        res.status(500).json({ success: false, message: 'Unable to load the user activity.' });
      });
    }
  );
});

app.get('/api/superadmin/account-requests', requireRole('superadmin'), (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : '';
  db.all(
    `SELECT r.id, r.full_name AS fullName, r.email, r.phone, r.status,
       r.requested_at AS requestedAt, r.reviewed_at AS reviewedAt,
       r.rejection_reason AS rejectionReason, u.fullName AS reviewedBy
     FROM account_requests r LEFT JOIN users u ON u.id = r.reviewed_by
     ${status ? 'WHERE r.status = ?' : ''}
     ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.requested_at DESC LIMIT 200`,
    status ? [status] : [], (error, requests) => {
      if (error) {
        console.error('Super-admin account request list error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load Admin account requests.' });
      }
      res.json({ success: true, requests });
    }
  );
});

app.post('/api/superadmin/account-requests/:id/review', requireRole('superadmin'), async (req, res) => {
  const id = Number(req.params.id);
  const { action, reason = '' } = req.body || {};
  if (!Number.isSafeInteger(id) || id <= 0 ||
      !['approve', 'reject'].includes(action) ||
      typeof reason !== 'string' || reason.length > 500) {
    return res.status(400).json({ success: false, message: 'Choose a valid request and review action.' });
  }
  const temporaryPassword = action === 'approve' ? crypto.randomBytes(96).toString('base64url') : null;
  try {
    const temporaryPasswordHash = temporaryPassword ? await bcrypt.hash(temporaryPassword, 12) : null;
    await run('BEGIN IMMEDIATE');
    const request = await new Promise((resolve, reject) => {
      db.get("SELECT id, full_name AS fullName, email, phone FROM account_requests WHERE id = ? AND status = 'pending'",
        [id], (error, row) => error ? reject(error) : resolve(row));
    });
    if (!request) {
      await run('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Pending Admin account request not found.' });
    }
    let userId = null;
    if (action === 'approve') {
      const existingUser = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM users WHERE email = ?', [request.email], (error, row) => error ? reject(error) : resolve(row));
      });
      if (existingUser) {
        await run('ROLLBACK');
        return res.status(409).json({ success: false, message: 'An account already exists for this email; the request cannot be approved.' });
      }
      const created = await run(
        `INSERT INTO users (fullName, email, password, phone, role, is_active, password_reset_required)
         VALUES (?, ?, ?, ?, 'admin', 1, 1)`,
        [request.fullName, request.email, temporaryPasswordHash, request.phone]
      );
      userId = created.lastID;
    }
    await run(
      `UPDATE account_requests
       SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, rejection_reason = ?
       WHERE id = ? AND status = 'pending'`,
      [action === 'approve' ? 'approved' : 'rejected', req.session.user.id,
        action === 'reject' ? reason.trim() || null : null, id]
    );
    await run('COMMIT');
    recordActivity(req.session.user.id, action === 'approve' ? 'approved Admin account request' : 'rejected Admin account request',
      'account_request', id, `${request.email}${action === 'reject' && reason.trim() ? `: ${reason.trim()}` : ''}`);
    res.json({
      success: true,
      userId,
      temporaryPassword,
      message: action === 'approve'
        ? 'Admin account approved. Share the one-time temporary password securely; the new Admin must replace it at first sign-in.'
        : 'Admin account request rejected.'
    });
  } catch (error) {
    await run('ROLLBACK').catch((rollbackError) => console.error('Account request rollback error:', rollbackError));
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: 'A pending Admin account request already exists for this email.' });
    }
    console.error('Super-admin account request review error:', error);
    res.status(500).json({ success: false, message: 'Unable to review the Admin account request.' });
  }
});

app.post('/api/superadmin/users', requireRole('superadmin'), async (req, res) => {
  const { fullName, email, phone = '', role = 'admin', password } = req.body || {};
  const name = typeof fullName === 'string' ? fullName.trim() : '';
  const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const initialPassword = typeof password === 'string' ? password : '';
  if (!name || name.length > 100 || !validEmail(address) || typeof phone !== 'string' || phone.length > 40 ||
      !['admin', 'superadmin'].includes(role) || (password !== undefined && typeof password !== 'string') ||
      (role === 'admin' && initialPassword) || (role === 'superadmin' && initialPassword.length > 128)) {
    return res.status(400).json({ success: false, message: 'Enter valid account details. Only a Super Admin may provision Admin or Super Admin accounts.' });
  }
  try {
    const minimum = Number(await getSystemSetting('password_min_length', '12'));
    if (initialPassword && initialPassword.length < minimum) {
      return res.status(400).json({ success: false, message: `The Super Admin password must be at least ${minimum} characters.` });
    }
    const temporaryPassword = initialPassword ? null : crypto.randomBytes(96).toString('base64url');
    const passwordHash = await bcrypt.hash(initialPassword || temporaryPassword, 12);
    db.run(
      `INSERT INTO users (fullName, email, password, phone, role, password_reset_required)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, address, passwordHash, phone.trim() || null, role, Number(!initialPassword)], function (error) {
        if (error) {
          if (error.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'That email address is already in use.' });
          console.error('Super-admin account creation error:', error);
          return res.status(500).json({ success: false, message: 'Unable to create the privileged account.' });
        }
        recordActivity(req.session.user.id, `created ${role} account`, role, this.lastID, address);
        res.status(201).json({
          success: true, userId: this.lastID, temporaryPassword: temporaryPassword || undefined,
          passwordPolicyMinimum: minimum,
          message: temporaryPassword
            ? 'Copy the temporary password now; it will not be shown again.'
            : `${role === 'superadmin' ? 'Super Admin' : 'Admin'} account created.`
        });
      }
    );
  } catch (error) {
    console.error('Super-admin account provisioning error:', error);
    res.status(500).json({ success: false, message: 'Unable to provision the administrator account.' });
  }
});

app.post('/api/account-requests/admin', async (req, res) => {
  const { fullName, email, phone = '' } = req.body || {};
  const name = typeof fullName === 'string' ? fullName.trim() : '';
  const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const number = typeof phone === 'string' ? phone.trim() : '';
  if (!name || name.length > 100 || !validEmail(address) || number.length > 40) {
    return res.status(400).json({ success: false, message: 'Enter a valid name, email address, and phone number.' });
  }
  try {
    const requesterIp = req.ip || '';
    const recentRequests = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) AS total FROM account_requests
         WHERE requester_ip = ? AND requested_at >= datetime('now', '-15 minutes')`,
        [requesterIp], (error, row) => error ? reject(error) : resolve(row.total)
      );
    });
    if (recentRequests >= 5) {
      return res.status(429).json({ success: false, message: 'Too many Admin access requests from this network. Try again later.' });
    }
    const existing = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', [address], (error, row) => error ? reject(error) : resolve(row));
    });
    if (existing) return res.status(409).json({ success: false, message: 'An account already exists for this email.' });
    const created = await run(
      'INSERT INTO account_requests (full_name, email, phone, requester_ip) VALUES (?, ?, ?, ?)',
      [name, address, number || null, requesterIp]
    );
    notifyRole('superadmin', 'Admin account request', `${name} requested an Admin account.`);
    res.status(201).json({
      success: true, requestId: created.lastID,
      message: 'Your Admin account request was submitted for Super Admin approval.'
    });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: 'A pending Admin account request already exists for this email.' });
    }
    console.error('Admin account request submission error:', error);
    res.status(500).json({ success: false, message: 'Unable to submit your Admin account request.' });
  }
});

app.patch('/api/superadmin/users/:id', requireRole('superadmin'), (req, res) => {
  const id = Number(req.params.id);
  const { fullName, email, phone, role, isActive, suspendedReason } = req.body || {};
  if (!Number.isSafeInteger(id) || id <= 0 || !['client', 'admin', 'superadmin'].includes(role) ||
      typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100 ||
      !validEmail(typeof email === 'string' ? email.trim().toLowerCase() : '') ||
      (phone !== undefined && (typeof phone !== 'string' || phone.length > 40)) || typeof isActive !== 'boolean' ||
      (suspendedReason !== undefined && (typeof suspendedReason !== 'string' || suspendedReason.length > 500))) {
    return res.status(400).json({ success: false, message: 'Check the account profile, role and status fields.' });
  }
  if (id === req.session.user.id && (role !== 'superadmin' || !isActive)) {
    return res.status(403).json({ success: false, message: 'You cannot change your own role or deactivate your own account.' });
  }
  db.get('SELECT role, is_active FROM users WHERE id = ?', [id], (lookupError, existing) => {
    if (lookupError) {
      console.error('Super-admin account lookup error:', lookupError);
      return res.status(500).json({ success: false, message: 'Unable to verify the account.' });
    }
    if (!existing) return res.status(404).json({ success: false, message: 'User not found.' });
    const removesActiveSuperadmin = existing.role === 'superadmin' && existing.is_active &&
      (role !== 'superadmin' || !isActive);
    const updateAccount = () => {
      const reason = isActive ? null : (typeof suspendedReason === 'string' ? suspendedReason.trim() : '') || null;
      db.run(
        `UPDATE users SET fullName = ?, email = ?, phone = ?, role = ?, is_active = ?, suspended_reason = ?
         WHERE id = ?`,
        [fullName.trim(), email.trim().toLowerCase(), typeof phone === 'string' ? phone.trim() || null : null,
          role, Number(isActive), reason, id], function (error) {
          if (error) {
            if (error.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'That email address is already in use.' });
            console.error('Super-admin account update error:', error);
            return res.status(500).json({ success: false, message: 'Unable to update the account.' });
          }
          if (existing.role !== role) {
            db.run('DELETE FROM admin_permissions WHERE user_id = ?', [id], (permissionError) => {
              if (permissionError) console.error('Role-change permission cleanup error:', permissionError);
            });
          }
          const action = existing.role !== role ? 'changed account role' : !isActive ? 'suspended account' : 'updated account';
          recordActivity(req.session.user.id, action, 'user', id,
            `${existing.role} -> ${role}; ${isActive ? 'active' : 'suspended'}`);
          io.to(`user:${id}`).emit('account:changed');
          if (!isActive || existing.role !== role) io.in(`user:${id}`).disconnectSockets(true);
          res.json({ success: true });
        }
      );
    };
    if (!removesActiveSuperadmin) return updateAccount();
    db.get("SELECT COUNT(*) AS total FROM users WHERE role = 'superadmin' AND is_active = 1 AND id != ?",
      [id], (countError, count) => {
        if (countError) {
          console.error('Active Super Admin count error:', countError);
          return res.status(500).json({ success: false, message: 'Unable to verify Super Admin availability.' });
        }
        if (!count.total) return res.status(409).json({ success: false, message: 'The final active Super Admin cannot be deactivated or demoted.' });
        updateAccount();
      });
  });
});

app.post('/api/superadmin/users/:id/reset-password', requireRole('superadmin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || id === req.session.user.id) {
    return res.status(400).json({ success: false, message: 'Choose a different valid account.' });
  }
  const temporaryPassword = crypto.randomBytes(96).toString('base64url');
  try {
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    db.run('UPDATE users SET password = ?, password_reset_required = 1 WHERE id = ?', [passwordHash, id], function (error) {
      if (error) {
        console.error('Super-admin password reset error:', error);
        return res.status(500).json({ success: false, message: 'Unable to reset the password.' });
      }
      if (!this.changes) return res.status(404).json({ success: false, message: 'User not found.' });
      db.run(`DELETE FROM sessions WHERE json_extract(sess, '$.user.id') = ?`, [id], (sessionError) => {
        if (sessionError) console.error('Password reset session revocation error:', sessionError);
      });
      io.to(`user:${id}`).emit('account:changed');
      io.in(`user:${id}`).disconnectSockets(true);
      recordActivity(req.session.user.id, 'reset user password', 'user', id, 'Temporary password issued; change required at next sign-in.');
      res.json({ success: true, temporaryPassword, message: 'Copy the temporary password now; it will not be shown again.' });
    });
  } catch (error) {
    console.error('Super-admin password hashing error:', error);
    res.status(500).json({ success: false, message: 'Unable to reset the password.' });
  }
});

app.get('/api/superadmin/admins/:id/permissions', requireRole('superadmin'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid administrator ID is required.' });
  db.get("SELECT id FROM users WHERE id = ? AND role = 'admin'", [id], (userError, user) => {
    if (userError) {
      console.error('Permission subject lookup error:', userError);
      return res.status(500).json({ success: false, message: 'Unable to load administrator permissions.' });
    }
    if (!user) return res.status(404).json({ success: false, message: 'Administrator not found.' });
    db.all('SELECT module, allowed FROM admin_permissions WHERE user_id = ?', [id], (error, rows) => {
      if (error) {
        console.error('Admin permission read error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load administrator permissions.' });
      }
      const assigned = new Map(rows.map((row) => [row.module, Boolean(row.allowed)]));
      res.json({ success: true, permissions: Object.fromEntries(adminModules.map((module) => [module, assigned.has(module) ? assigned.get(module) : true])) });
    });
  });
});

app.put('/api/superadmin/admins/:id/permissions', requireRole('superadmin'), (req, res) => {
  const id = Number(req.params.id);
  const permissions = req.body && req.body.permissions;
  if (!Number.isSafeInteger(id) || id <= 0 || id === req.session.user.id ||
      !permissions || typeof permissions !== 'object' || Array.isArray(permissions) ||
      adminModules.some((module) => typeof permissions[module] !== 'boolean') ||
      Object.keys(permissions).some((module) => !adminModules.includes(module))) {
    return res.status(400).json({ success: false, message: 'Provide permissions for every Admin module. Self-permission changes are not allowed.' });
  }
  db.get("SELECT id FROM users WHERE id = ? AND role = 'admin'", [id], (userError, user) => {
    if (userError) {
      console.error('Permission subject lookup error:', userError);
      return res.status(500).json({ success: false, message: 'Unable to update administrator permissions.' });
    }
    if (!user) return res.status(404).json({ success: false, message: 'Administrator not found.' });
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE');
      const statement = db.prepare(
        `INSERT INTO admin_permissions (user_id, module, allowed, updated_by, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, module) DO UPDATE SET allowed = excluded.allowed,
           updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`
      );
      adminModules.forEach((module) => statement.run([id, module, Number(permissions[module]), req.session.user.id]));
      statement.finalize((finalizeError) => {
        if (finalizeError) {
          console.error('Admin permission update error:', finalizeError);
          return db.run('ROLLBACK', () => res.status(500).json({ success: false, message: 'Unable to save administrator permissions.' }));
        }
        db.run('COMMIT', (commitError) => {
          if (commitError) {
            console.error('Admin permission commit error:', commitError);
            return db.run('ROLLBACK', () => res.status(500).json({ success: false, message: 'Unable to save administrator permissions.' }));
          }
          recordActivity(req.session.user.id, 'changed Admin module permissions', 'admin', id, JSON.stringify(permissions));
          res.json({ success: true });
        });
      });
    });
  });
});

app.get('/api/superadmin/admins/:id/performance', requireRole('superadmin'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid administrator ID is required.' });
  db.get(
    `SELECT u.id, u.fullName, u.email, u.is_active AS isActive,
       (SELECT COUNT(*) FROM service_requests WHERE assigned_to = u.id) AS assignedRequests,
       (SELECT COUNT(*) FROM service_requests WHERE assigned_to = u.id AND status = 'Completed') AS completedRequests,
       (SELECT COUNT(*) FROM service_requests WHERE assigned_to = u.id AND status IN ('New', 'Pending', 'Approved', 'In Progress')) AS openRequests
     FROM users u WHERE u.id = ? AND u.role = 'admin'`,
    [id], (error, performance) => {
      if (error) {
        console.error('Admin performance lookup error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load administrator performance.' });
      }
      if (!performance) return res.status(404).json({ success: false, message: 'Administrator not found.' });
      res.json({ success: true, performance });
    }
  );
});

app.get('/api/superadmin/content', requireRole('superadmin'), (req, res) => {
  db.all('SELECT key, value, is_published AS isPublished, updated_at AS updatedAt FROM site_content ORDER BY key',
    (error, rows) => {
      if (error) {
        console.error('Super-admin content read error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load website content.' });
      }
      res.json({ success: true, content: rows });
    });
});

app.put('/api/superadmin/content', requireRole('superadmin'), async (req, res) => {
  const allowedKeys = new Set([
    'company_name', 'hero_headline', 'hero_intro', 'about_text', 'contact_email',
    'contact_phone', 'contact_address', 'announcement', 'faq_json', 'banner_image', 'company_logo'
  ]);
  const { content, published = true } = req.body || {};
  if (!content || typeof content !== 'object' || Array.isArray(content) ||
      typeof published !== 'boolean' || !Object.keys(content).length ||
      Object.keys(content).some((key) => !allowedKeys.has(key)) ||
      Object.entries(content).some(([key, value]) => typeof value !== 'string' || value.length > (key === 'about_text' || key === 'faq_json' ? 10000 : 2000))) {
    return res.status(400).json({ success: false, message: 'Check the website content fields.' });
  }
  if (content.contact_email && !validEmail(content.contact_email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid contact email address.' });
  }
  if (content.faq_json !== undefined) {
    try {
      const faqs = JSON.parse(content.faq_json);
      if (!Array.isArray(faqs) || faqs.length > 50 || faqs.some((faq) =>
        !faq || typeof faq.question !== 'string' || !faq.question.trim() || faq.question.length > 300 ||
        typeof faq.answer !== 'string' || !faq.answer.trim() || faq.answer.length > 2000)) throw new Error('Invalid FAQ list.');
    } catch {
      return res.status(400).json({ success: false, message: 'FAQs must be valid JSON with up to 50 question and answer pairs.' });
    }
  }
  for (const key of ['banner_image', 'company_logo']) {
    if (content[key] && !/^\/uploads\/[a-f0-9]{48}\.(png|jpg|webp)$/.test(content[key])) {
      return res.status(400).json({ success: false, message: 'Choose a supported uploaded image.' });
    }
  }
  try {
    await run('BEGIN IMMEDIATE');
    for (const [key, value] of Object.entries(content)) {
      await run(
        `INSERT INTO site_content (key, value, is_published, updated_by, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, is_published = excluded.is_published,
           updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
        [key, value.trim(), Number(published), req.session.user.id]
      );
    }
    await run('COMMIT');
    recordActivity(req.session.user.id, 'updated website content', 'website', null, Object.keys(content).join(', '));
    io.emit('site:changed');
    res.json({ success: true });
  } catch (error) {
    await run('ROLLBACK').catch((rollbackError) => console.error('Website content rollback error:', rollbackError));
    console.error('Super-admin content update error:', error);
    res.status(500).json({ success: false, message: 'Unable to update website content.' });
  }
});

app.post('/api/superadmin/content/image', requireRole('superadmin'), saveUploadedImage, (req, res) => {
  const key = req.body && req.body.key;
  if (!['banner_image', 'company_logo'].includes(key)) {
    return res.status(400).json({ success: false, message: 'Choose a valid website image type.' });
  }
  db.run(
    `INSERT INTO site_content (key, value, is_published, updated_by, updated_at)
     VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, is_published = 1,
       updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
    [key, req.uploadedImage, req.session.user.id], (error) => {
      if (error) {
        console.error('Website banner upload update error:', error);
        return res.status(500).json({ success: false, message: 'Image uploaded but could not be published.' });
      }
      recordActivity(req.session.user.id, 'uploaded website image', 'website', key, req.uploadedImage);
      io.emit('site:changed');
      res.json({ success: true, image: req.uploadedImage });
    });
});

app.get('/api/superadmin/settings', requireRole('superadmin'), async (req, res) => {
  try {
    const [settings, integrity] = await Promise.all([
      all('SELECT key, value FROM system_settings ORDER BY key'),
      new Promise((resolve, reject) => db.get('PRAGMA integrity_check', (error, row) => error ? reject(error) : resolve(row)))
    ]);
    let databaseSize = null;
    try { databaseSize = fs.statSync(databasePath).size; } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    res.json({
      success: true,
      settings: Object.fromEntries(settings.map((item) => [item.key, item.value])),
      system: {
        databaseConnected: integrity && integrity.integrity_check === 'ok',
        databaseIntegrity: integrity ? integrity.integrity_check : 'unknown',
        databaseSize,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime())
      }
    });
  } catch (error) {
    console.error('Super-admin system status error:', error);
    res.status(500).json({ success: false, message: 'Unable to load system settings and status.' });
  }
});

app.put('/api/superadmin/settings', requireRole('superadmin'), async (req, res) => {
  const { maintenanceMode, passwordMinLength, sessionTimeoutMinutes } = req.body || {};
  if (typeof maintenanceMode !== 'boolean' ||
      !Number.isSafeInteger(passwordMinLength) || passwordMinLength < 12 || passwordMinLength > 128 ||
      !Number.isSafeInteger(sessionTimeoutMinutes) || sessionTimeoutMinutes < 15 || sessionTimeoutMinutes > 10080) {
    return res.status(400).json({ success: false, message: 'Maintenance mode, password length (12-128), or session timeout (15-10,080 minutes) is invalid.' });
  }
  try {
    for (const [key, value] of [
      ['maintenance_mode', Number(maintenanceMode)],
      ['password_min_length', passwordMinLength],
      ['session_timeout_minutes', sessionTimeoutMinutes]
    ]) {
      await run(
        `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [key, String(value), req.session.user.id]
      );
    }
    sessionTimeoutMs = sessionTimeoutMinutes * 60 * 1000;
    req.session.cookie.maxAge = sessionTimeoutMs;
    recordActivity(req.session.user.id, 'updated system settings', 'system', null,
      `Maintenance ${maintenanceMode ? 'enabled' : 'disabled'}; password minimum ${passwordMinLength}; session ${sessionTimeoutMinutes} minutes.`);
    io.emit('site:changed');
    res.json({ success: true });
  } catch (error) {
    console.error('Super-admin settings update error:', error);
    res.status(500).json({ success: false, message: 'Unable to save system settings.' });
  }
});

app.get('/api/superadmin/audit', requireRole('superadmin'), async (req, res) => {
  const range = readDateRange(req.query);
  if (!range) return res.status(400).json({ success: false, message: 'Use valid from/to dates in YYYY-MM-DD format.' });
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const requestedLimit = Number(req.query.limit) || 100;
  const limit = Math.max(1, Math.min(250, requestedLimit));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const query = `SELECT * FROM (
    SELECT a.id, a.action, a.entity_type AS entityType, a.entity_id AS entityId,
      a.details, a.created_at AS createdAt, COALESCE(u.fullName, 'System') AS actor, u.role AS actorRole
    FROM admin_activity a LEFT JOIN users u ON u.id = a.actor_id
    UNION ALL
    SELECT l.id, CASE WHEN l.success = 1 THEN 'successful login' ELSE 'failed login' END AS action,
      'authentication' AS entityType, l.email AS entityId, l.ip_address AS details,
      l.created_at AS createdAt, l.email AS actor, NULL AS actorRole
    FROM login_attempts l
  ) WHERE createdAt BETWEEN ? AND ?
    AND (? = '' OR action LIKE ? OR actor LIKE ? OR entityId LIKE ? OR details LIKE ?)
    ORDER BY createdAt DESC, id DESC`;
  try {
    const entries = await all(`${query} LIMIT ? OFFSET ?`,
      [range.from, range.to, search, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, limit, offset]);
    const countRow = await new Promise((resolve, reject) => db.get(
      `SELECT COUNT(*) AS total FROM (${query})`,
      [range.from, range.to, search, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`],
      (error, row) => error ? reject(error) : resolve(row)
    ));
    res.json({ success: true, entries, total: countRow.total, limit, offset });
  } catch (error) {
    console.error('Super-admin audit log read error:', error);
    res.status(500).json({ success: false, message: 'Unable to load the audit log.' });
  }
});

app.get('/api/superadmin/notifications', requireRole('superadmin'), (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  db.all(
    `SELECT n.id, n.title, n.body, n.read, n.createdAt, n.user_id AS userId,
       u.fullName AS recipientName, u.email AS recipientEmail, u.role AS recipientRole
     FROM notifications n LEFT JOIN users u ON u.id = n.user_id
     WHERE (? = '' OR n.title LIKE ? OR n.body LIKE ? OR u.email LIKE ?)
     ORDER BY n.id DESC LIMIT 500`,
    [search, `%${search}%`, `%${search}%`, `%${search}%`], (error, notifications) => {
      if (error) {
        console.error('Platform notification history read error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load notification history.' });
      }
      res.json({ success: true, notifications });
    }
  );
});

app.post('/api/superadmin/notifications', requireRole('superadmin'), async (req, res) => {
  const { title, body = '', audience, userId } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.length > 200 ||
      typeof body !== 'string' || body.length > 2000 ||
      !['client', 'admin', 'superadmin', 'all', 'user'].includes(audience) ||
      (audience === 'user' && (!Number.isSafeInteger(userId) || userId <= 0))) {
    return res.status(400).json({ success: false, message: 'Choose a valid notification title, message and audience.' });
  }
  try {
    const recipients = audience === 'user'
      ? await all('SELECT id FROM users WHERE id = ? AND is_active = 1', [userId])
      : await all(
        `SELECT id FROM users WHERE is_active = 1 ${audience === 'all' ? '' : 'AND role = ?'}`,
        audience === 'all' ? [] : [audience]
      );
    if (!recipients.length) return res.status(404).json({ success: false, message: 'No active recipients were found.' });
    let delivered = 0;
    for (const recipient of recipients) {
      const pref = await new Promise((resolve, reject) => db.get(
        'SELECT in_app_enabled FROM notification_preferences WHERE user_id = ?',
        [recipient.id], (error, row) => error ? reject(error) : resolve(row)
      ));
      if (pref && !pref.in_app_enabled) continue;
      const notification = await run(
        'INSERT INTO notifications (title, body, user_id) VALUES (?, ?, ?)',
        [title.trim(), body.trim() || null, recipient.id]
      );
      delivered += 1;
      io.to(`user:${recipient.id}`).emit('notification', {
        id: notification.lastID, title: title.trim(), body: body.trim() || null,
        time: new Date().toISOString(), read: false
      });
    }
    if (!delivered) return res.status(409).json({ success: false, message: 'All selected recipients have in-app notifications disabled.' });
    recordActivity(req.session.user.id, 'sent platform notification', 'notification', null,
      `${title.trim()} (${audience}; ${delivered} recipient${delivered === 1 ? '' : 's'})`);
    res.status(201).json({ success: true, recipients: delivered });
  } catch (error) {
    console.error('Super-admin notification send error:', error);
    res.status(500).json({ success: false, message: 'Unable to send the notification.' });
  }
});

app.patch('/api/superadmin/notifications/:id/read', requireRole('superadmin'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid notification ID is required.' });
  db.run('UPDATE notifications SET read = 1 WHERE id = ?', [id], function (error) {
    if (error) {
      console.error('Platform notification read update error:', error);
      return res.status(500).json({ success: false, message: 'Unable to mark the notification as read.' });
    }
    if (!this.changes) return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true });
  });
});

async function createDatabaseBackup(actorId) {
  const filename = `aj-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}.sqlite`;
  const target = path.join(backupDirectory, filename);
  try {
    await new Promise((resolve, reject) => {
      const backup = db.backup(target);
      backup.step(-1, (error) => error ? reject(error) : resolve());
    });
    const file = fs.statSync(target);
    if (!file.size) throw new Error('SQLite reported success but the backup file is empty.');
    await run('INSERT INTO backup_history (filename, status, created_by, details) VALUES (?, ?, ?, ?)',
      [filename, 'completed', actorId, 'SQLite online backup']);
    return { filename, path: target };
  } catch (error) {
    await run('INSERT INTO backup_history (filename, status, created_by, details) VALUES (?, ?, ?, ?)',
      [filename, 'failed', actorId, String(error.message || error).slice(0, 500)]).catch((logError) =>
      console.error('Backup failure history write error:', logError));
    throw error;
  }
}

app.get('/api/superadmin/backups', requireRole('superadmin'), (req, res) => {
  db.all(
    `SELECT b.id, b.filename, b.status, b.created_at AS createdAt, b.details,
       u.fullName AS createdBy
     FROM backup_history b LEFT JOIN users u ON u.id = b.created_by ORDER BY b.id DESC`,
    (error, backups) => {
      if (error) {
        console.error('Backup history read error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load backup history.' });
      }
      res.json({ success: true, backups });
    }
  );
});

app.post('/api/superadmin/backups', requireRole('superadmin'), async (req, res) => {
  try {
    const backup = await createDatabaseBackup(req.session.user.id);
    recordActivity(req.session.user.id, 'created database backup', 'backup', backup.filename, null);
    res.status(201).json({ success: true, filename: backup.filename });
  } catch (error) {
    console.error('Database backup creation error:', error);
    res.status(500).json({ success: false, message: 'Unable to create the database backup.' });
  }
});

app.get('/api/superadmin/backups/:id/download', requireRole('superadmin'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid backup ID is required.' });
  db.get('SELECT filename FROM backup_history WHERE id = ? AND status = ?',
    [id, 'completed'], (error, backup) => {
      if (error) {
        console.error('Backup download lookup error:', error);
        return res.status(500).json({ success: false, message: 'Unable to retrieve the backup.' });
      }
      if (!backup || !/^aj-backup-[\dTZ-]+-[a-f0-9]{8}\.sqlite$/.test(backup.filename)) {
        return res.status(404).json({ success: false, message: 'Backup not found.' });
      }
      res.download(path.join(backupDirectory, backup.filename), backup.filename, (downloadError) => {
        if (downloadError && !res.headersSent) {
          console.error('Backup file download error:', downloadError);
          res.status(downloadError.code === 'ENOENT' ? 404 : 500).json({ success: false, message: 'Unable to download the backup file.' });
        }
      });
    });
});

app.post('/api/superadmin/backups/:id/restore', requireRole('superadmin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || req.body.confirmation !== 'RESTORE DATABASE') {
    return res.status(400).json({ success: false, message: 'Enter RESTORE DATABASE to confirm this operation.' });
  }
  try {
    const backup = await new Promise((resolve, reject) => db.get(
      'SELECT filename FROM backup_history WHERE id = ? AND status = ?',
      [id, 'completed'], (error, row) => error ? reject(error) : resolve(row)
    ));
    if (!backup || !/^aj-backup-[\dTZ-]+-[a-f0-9]{8}\.sqlite$/.test(backup.filename)) {
      return res.status(404).json({ success: false, message: 'Backup not found.' });
    }
    const backupPath = path.join(backupDirectory, backup.filename);
    const snapshot = new sqlite3.Database(backupPath);
    const [integrity, actor] = await Promise.all([
      new Promise((resolve, reject) => snapshot.get('PRAGMA integrity_check', (error, row) => error ? reject(error) : resolve(row))),
      new Promise((resolve, reject) => snapshot.get(
        "SELECT id FROM users WHERE id = ? AND role = 'superadmin' AND is_active = 1",
        [req.session.user.id], (error, row) => error ? reject(error) : resolve(row)
      ))
    ]);
    await new Promise((resolve, reject) => snapshot.close((error) => error ? reject(error) : resolve()));
    if (!integrity || integrity.integrity_check !== 'ok' || !actor) {
      return res.status(409).json({ success: false, message: 'Backup is invalid or does not preserve the active Super Admin account.' });
    }
    await createDatabaseBackup(req.session.user.id);
    await run('PRAGMA foreign_keys = OFF');
    await run('ATTACH DATABASE ? AS restore_source', [backupPath]);
    try {
      await run('BEGIN IMMEDIATE');
      const currentObjects = await all(
        `SELECT type, name FROM sqlite_master WHERE type IN ('trigger', 'view', 'index', 'table')
         AND name NOT LIKE 'sqlite_%' AND name NOT IN ('sessions', 'backup_history')`
      );
      const order = { trigger: 0, view: 1, index: 2, table: 3 };
      for (const object of currentObjects.sort((a, b) => order[a.type] - order[b.type])) {
        await run(`DROP ${object.type.toUpperCase()} IF EXISTS "${object.name.replace(/"/g, '""')}"`);
      }
      await run('DELETE FROM sessions WHERE sid != ?', [req.sessionID]);
      const sourceObjects = await all(
        `SELECT type, name, tbl_name, sql FROM restore_source.sqlite_master
         WHERE type IN ('table', 'index', 'view', 'trigger') AND name NOT LIKE 'sqlite_%'
         ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END`
      );
      for (const object of sourceObjects.filter((item) => item.type === 'table' && !['sessions', 'backup_history'].includes(item.name))) {
        await run(object.sql);
        await run(`INSERT INTO "${object.name.replace(/"/g, '""')}" SELECT * FROM restore_source."${object.name.replace(/"/g, '""')}"`);
      }
      for (const object of sourceObjects.filter((item) =>
        item.type !== 'table' && item.sql && !['sessions', 'backup_history'].includes(item.tbl_name))) {
        await run(object.sql);
      }
      await run('COMMIT');
    } catch (restoreError) {
      await run('ROLLBACK').catch((rollbackError) => console.error('Database restore rollback error:', rollbackError));
      throw restoreError;
    } finally {
      await run('DETACH DATABASE restore_source');
      await run('PRAGMA foreign_keys = ON');
    }
    await initDb();
    io.disconnectSockets(true);
    recordActivity(req.session.user.id, 'restored database backup', 'backup', backup.filename, 'Pre-restore safety backup created.');
    res.json({ success: true, message: 'Database restored. A pre-restore safety backup was retained.' });
  } catch (error) {
    console.error('Database restore error:', error);
    res.status(500).json({ success: false, message: 'Unable to restore the database backup.' });
  }
});
function validDateFilter(value) {
  if (!value) return true;
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function readDateRange(query) {
  const from = query.from || '';
  const to = query.to || '';
  if (!validDateFilter(from) || !validDateFilter(to) || (from && to && from > to)) return null;
  return {
    from: from ? `${from} 00:00:00` : '0000-01-01 00:00:00',
    to: to ? `${to} 23:59:59` : '9999-12-31 23:59:59'
  };
}

function imageSignature(buffer, mimeType) {
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png' : null;
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff ? 'jpg' : null;
  if (mimeType === 'image/webp') {
    return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
  }
  return null;
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Upload a PNG, JPEG, or WebP image smaller than 5 MB.'));
    }
    callback(null, true);
  }
});

function saveUploadedImage(req, res, next) {
  imageUpload.single('image')(req, res, (error) => {
    if (error) return res.status(400).json({ success: false, message: error.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose an image to upload.' });
    const extension = imageSignature(req.file.buffer, req.file.mimetype);
    if (!extension) return res.status(400).json({ success: false, message: 'The uploaded file is not a valid supported image.' });
    const filename = `${crypto.randomBytes(24).toString('hex')}.${extension}`;
    fs.writeFile(path.join(uploadDirectory, filename), req.file.buffer, { flag: 'wx' }, (writeError) => {
      if (writeError) {
        console.error('Image upload write error:', writeError);
        return res.status(500).json({ success: false, message: 'Unable to save the uploaded image.' });
      }
      req.uploadedImage = `/uploads/${filename}`;
      next();
    });
  });
}

app.get('/uploads/:filename', (req, res) => {
  if (!/^[a-f0-9]{48}\.(png|jpg|webp)$/.test(req.params.filename)) return res.sendStatus(404);
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.join(uploadDirectory, req.params.filename), (error) => {
    if (error && !res.headersSent) res.sendStatus(error.statusCode === 404 ? 404 : 500);
  });
});

app.get('/api/services', requireRole('client'), (req, res) => {
  db.all(
    `SELECT id, name, category, description, price, image_path AS image
     FROM services WHERE is_published = 1 AND is_available = 1 AND is_archived = 0
     ORDER BY category COLLATE NOCASE, name COLLATE NOCASE`,
    (error, services) => {
      if (error) {
        console.error('Published service list error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load services.' });
      }
      res.json({ success: true, services });
    }
  );
});

app.get('/api/admin/permissions', requireRole('admin'), (req, res) => {
  db.all('SELECT module, allowed FROM admin_permissions WHERE user_id = ?', [req.session.user.id], (error, rows) => {
    if (error) {
      console.error('Admin permission list error:', error);
      return res.status(500).json({ success: false, message: 'Unable to load your module permissions.' });
    }
    const stored = new Map(rows.map((row) => [row.module, Boolean(row.allowed)]));
    res.json({
      success: true,
      permissions: Object.fromEntries(adminModules.map((module) => [module, stored.has(module) ? stored.get(module) : true]))
    });
  });
});

app.get('/api/admin/overview', requireAdminModule('overview'), (req, res) => {
  const range = readDateRange(req.query);
  if (!range) return res.status(400).json({ success: false, message: 'Use valid from/to dates in YYYY-MM-DD format.' });
  db.get(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'client') AS totalClients,
       (SELECT COUNT(*) FROM users WHERE role = 'client' AND is_active = 1) AS activeClients,
       (SELECT COUNT(*) FROM users WHERE role = 'client' AND is_active = 0) AS inactiveClients,
       (SELECT COUNT(*) FROM service_requests WHERE status IN ('New', 'Pending')) AS pendingRequests,
       (SELECT COUNT(*) FROM service_requests WHERE status = 'Approved') AS approvedRequests,
       (SELECT COUNT(*) FROM service_requests WHERE status = 'Rejected') AS rejectedRequests,
       (SELECT COUNT(*) FROM service_requests WHERE status = 'Completed') AS completedRequests,
       (SELECT COUNT(*) FROM services WHERE is_published = 1 AND is_available = 1 AND is_archived = 0) AS availableServices,
       (SELECT COUNT(*) FROM users WHERE role = 'client' AND createdAt BETWEEN ? AND ?) AS registrationsInRange,
       (SELECT COUNT(*) FROM service_requests WHERE created_at BETWEEN ? AND ?) AS requestsInRange,
       (SELECT COUNT(*) FROM service_requests WHERE status NOT IN ('Completed', 'Rejected') AND preferred_start_date < date('now')) AS overdueRequests`,
    [range.from, range.to, range.from, range.to],
    (error, stats) => {
      if (error) {
        console.error('Admin dashboard statistics error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load dashboard statistics.' });
      }
      db.all(
        `SELECT a.id, a.actor_id AS actorId, u.fullName AS actor, a.action, a.entity_type AS entityType,
           a.entity_id AS entityId, a.details, a.created_at AS createdAt
         FROM admin_activity a LEFT JOIN users u ON u.id = a.actor_id
         ORDER BY a.id DESC LIMIT 10`,
        (activityError, activities) => {
          if (activityError) {
            console.error('Admin dashboard activity error:', activityError);
            return res.status(500).json({ success: false, message: 'Unable to load recent activity.' });
          }
          db.all('SELECT id, title, body, createdAt, read FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 10',
            [req.session.user.id], (notificationError, notifications) => {
              if (notificationError) {
                console.error('Admin dashboard notification error:', notificationError);
                return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
              }
              res.json({ success: true, stats, activities, notifications });
            });
        }
      );
    }
  );
});

app.get('/api/admin/clients', requireAdminModule('clients'), (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const status = ['active', 'inactive'].includes(req.query.status) ? req.query.status : '';
  const sortColumns = { name: 'u.fullName', email: 'u.email', registered: 'u.createdAt', lastLogin: 'u.last_login_at' };
  const sortColumn = sortColumns[req.query.sort] || sortColumns.registered;
  const direction = req.query.order === 'asc' ? 'ASC' : 'DESC';
  const activeFilter = status === 'active' ? 'AND u.is_active = 1' : status === 'inactive' ? 'AND u.is_active = 0' : '';
  db.all(
    `SELECT u.id, u.fullName, u.email, u.phone,
       (SELECT phone FROM service_requests r WHERE r.user_id = u.id AND phone IS NOT NULL AND phone != '' ORDER BY r.id DESC LIMIT 1) AS requestPhone,
       u.is_active AS isActive, u.suspended_reason AS suspendedReason,
       u.createdAt AS registeredAt, u.last_login_at AS lastLoginAt
     FROM users u
     WHERE u.role = 'client' ${activeFilter}
       AND (? = '' OR u.fullName LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR EXISTS
         (SELECT 1 FROM service_requests r WHERE r.user_id = u.id AND r.phone LIKE ?))
     ORDER BY ${sortColumn} ${direction}`,
    [search, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`],
    (error, clients) => {
      if (error) {
        console.error('Admin client list error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load clients.' });
      }
      res.json({ success: true, clients: clients.map((client) => ({ ...client, phone: client.phone || client.requestPhone || '' })) });
    }
  );
});

app.get('/api/admin/clients/:id', requireAdminModule('clients'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid client ID is required.' });
  db.get(
    `SELECT id, fullName, email,
       COALESCE(NULLIF(phone, ''), (SELECT phone FROM service_requests r
         WHERE r.user_id = users.id AND r.phone IS NOT NULL AND r.phone != '' ORDER BY r.id DESC LIMIT 1)) AS phone,
       is_active AS isActive, suspended_reason AS suspendedReason,
       createdAt AS registeredAt, last_login_at AS lastLoginAt, profile_image AS profileImage
     FROM users WHERE id = ? AND role = 'client'`,
    [id],
    (error, client) => {
      if (error) {
        console.error('Client profile lookup error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load the client profile.' });
      }
      if (!client) return res.status(404).json({ success: false, message: 'Client not found.' });
      db.all(
        `SELECT id, service_name AS service, status, priority, description, documents,
           preferred_start_date AS preferredStartDate, created_at AS createdAt, progress
         FROM service_requests WHERE user_id = ? ORDER BY id DESC`,
        [id],
        (requestError, requests) => {
          if (requestError) {
            console.error('Client request history error:', requestError);
            return res.status(500).json({ success: false, message: 'Unable to load client request history.' });
          }
          res.json({ success: true, client, requests });
        }
      );
    }
  );
});

app.patch('/api/admin/clients/:id', requireAdminModule('clients'), (req, res) => {
  const id = Number(req.params.id);
  const { fullName, email, phone, isActive, suspendedReason } = req.body || {};
  const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
  if (!Number.isSafeInteger(id) || id <= 0 || !normalizedName || normalizedName.length > 100 ||
      !validEmail(normalizedEmail) || normalizedPhone.length > 40 || typeof isActive !== 'boolean' ||
      (suspendedReason !== undefined && (typeof suspendedReason !== 'string' || suspendedReason.length > 500))) {
    return res.status(400).json({ success: false, message: 'Check the client name, email, phone, account status, and suspension reason.' });
  }
  const reason = isActive ? null : (suspendedReason || '').trim() || null;
  db.run(
    `UPDATE users SET fullName = ?, email = ?, phone = ?, is_active = ?, suspended_reason = ?
     WHERE id = ? AND role = 'client'`,
    [normalizedName, normalizedEmail, normalizedPhone || null, Number(isActive), reason, id],
    function (error) {
      if (error) {
        if (error.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'That email address is already in use.' });
        console.error('Client account update error:', error);
        return res.status(500).json({ success: false, message: 'Unable to update the client account.' });
      }
      if (!this.changes) return res.status(404).json({ success: false, message: 'Client not found.' });
      const action = isActive ? 'updated client profile' : 'suspended client account';
      recordActivity(req.session.user.id, action, 'client', id, `${normalizedName} (${normalizedEmail})`);
      io.to(`user:${id}`).emit('account:changed');
      if (!isActive) io.in(`user:${id}`).disconnectSockets(true);
      if (isActive) notifyUser(id, 'Account updated', 'Your account profile was updated by the support team.');
      res.json({ success: true });
    }
  );
});

app.get('/api/admin/services', requireAdminModule('services'), (req, res) => {
  db.all(
    `SELECT id, name, category, description, price, image_path AS image, is_available AS isAvailable,
       is_published AS isPublished, is_archived AS isArchived, created_at AS createdAt, updated_at AS updatedAt
     FROM services ORDER BY is_archived, category COLLATE NOCASE, name COLLATE NOCASE`,
    (error, services) => {
      if (error) {
        console.error('Admin services read error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load services.' });
      }
      res.json({ success: true, services });
    }
  );
});

function validateService(payload) {
  return payload && typeof payload.name === 'string' && payload.name.trim().length > 0 && payload.name.trim().length <= 120 &&
    typeof payload.category === 'string' && payload.category.trim().length > 0 && payload.category.trim().length <= 80 &&
    typeof payload.description === 'string' && payload.description.trim().length > 0 && payload.description.length <= 2000 &&
    (payload.price === undefined || payload.price === null || (typeof payload.price === 'string' && payload.price.length <= 80)) &&
    (payload.isAvailable === undefined || typeof payload.isAvailable === 'boolean') &&
    (payload.isPublished === undefined || typeof payload.isPublished === 'boolean');
}

app.post('/api/admin/services', requireAdminModule('services'), (req, res) => {
  if (!validateService(req.body)) return res.status(400).json({ success: false, message: 'Check the service name, category, description, and price.' });
  const service = req.body;
  db.run(
    `INSERT INTO services (name, category, description, price, is_available, is_published)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [service.name.trim(), service.category.trim(), service.description.trim(), (service.price || '').trim() || null,
      service.isAvailable === false ? 0 : 1, service.isPublished === false ? 0 : 1],
    function (error) {
      if (error) {
        if (error.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'A service with that name already exists.' });
        console.error('Service creation error:', error);
        return res.status(500).json({ success: false, message: 'Unable to create the service.' });
      }
      recordActivity(req.session.user.id, 'created service', 'service', this.lastID, service.name.trim());
      io.emit('services:changed');
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
});

app.patch('/api/admin/services/:id', requireAdminModule('services'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || !validateService(req.body)) {
    return res.status(400).json({ success: false, message: 'Check the service ID and required service fields.' });
  }
  const service = req.body;
  db.run(
    `UPDATE services SET name = ?, category = ?, description = ?, price = ?, is_available = ?,
       is_published = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND is_archived = 0`,
    [service.name.trim(), service.category.trim(), service.description.trim(), (service.price || '').trim() || null,
      service.isAvailable === false ? 0 : 1, service.isPublished === false ? 0 : 1, id],
    function (error) {
      if (error) {
        if (error.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'A service with that name already exists.' });
        console.error('Service update error:', error);
        return res.status(500).json({ success: false, message: 'Unable to update the service.' });
      }
      if (!this.changes) return res.status(404).json({ success: false, message: 'Service not found.' });
      recordActivity(req.session.user.id, 'updated service', 'service', id, service.name.trim());
      io.emit('services:changed');
      res.json({ success: true });
    }
  );
});

app.post('/api/admin/services/:id/image', requireAdminModule('services'), saveUploadedImage, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid service ID is required.' });
  db.run('UPDATE services SET image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_archived = 0',
    [req.uploadedImage, id], function (error) {
      if (error) {
        console.error('Service image update error:', error);
        return res.status(500).json({ success: false, message: 'Unable to update the service image.' });
      }
      if (!this.changes) return res.status(404).json({ success: false, message: 'Service not found.' });
      recordActivity(req.session.user.id, 'uploaded service image', 'service', id, req.uploadedImage);
      io.emit('services:changed');
      res.json({ success: true, image: req.uploadedImage });
    });
});

app.delete('/api/admin/services/:id', requireAdminModule('services'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid service ID is required.' });
  db.run('UPDATE services SET is_archived = 1, is_published = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_archived = 0',
    [id], function (error) {
      if (error) {
        console.error('Service archive error:', error);
        return res.status(500).json({ success: false, message: 'Unable to archive the service.' });
      }
      if (!this.changes) return res.status(404).json({ success: false, message: 'Service not found.' });
      recordActivity(req.session.user.id, 'archived service', 'service', id, null);
      io.emit('services:changed');
      res.json({ success: true });
    });
});

app.get('/api/admin/requests', requireAdminModule('requests'), (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const allowedStatuses = ['New', 'Pending', 'Approved', 'Rejected', 'In Progress', 'Completed'];
  if (status && !allowedStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Choose a valid request status.' });
  const range = readDateRange(req.query);
  if (!range) return res.status(400).json({ success: false, message: 'Use valid from/to dates in YYYY-MM-DD format.' });
  db.all(
    `SELECT r.id, r.service_name AS service, r.client_name AS clientName, r.email AS clientEmail,
       r.phone, r.company_name AS companyName, r.description, r.priority, r.status,
       r.preferred_start_date AS preferredStartDate, r.estimated_budget AS estimatedBudget,
       r.documents, r.additional_notes AS additionalNotes, r.created_at AS createdAt,
       r.assigned_to AS assignedTo, assignee.fullName AS assigneeName,
       r.progress, u.id AS clientId, u.fullName AS registeredName
     FROM service_requests r JOIN users u ON u.id = r.user_id
     LEFT JOIN users assignee ON assignee.id = r.assigned_to
     WHERE (? = '' OR r.status = ?) AND r.created_at BETWEEN ? AND ?
     ORDER BY r.id DESC`,
    [status, status, range.from, range.to],
    (error, requests) => {
      if (error) {
        console.error('Admin request list error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load service requests.' });
      }
      res.json({ success: true, requests: requests.map((request) => ({ ...request, id: `REQ-${String(request.id).padStart(4, '0')}` })) });
    }
  );
});

app.get('/api/admin/requests/:id', requireAdminModule('requests'), (req, res) => {
  const id = Number(String(req.params.id).replace(/^REQ-/, ''));
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid request ID is required.' });
  db.get(
    `SELECT r.*, u.fullName AS registeredName, u.email AS accountEmail, u.phone AS accountPhone
     FROM service_requests r JOIN users u ON u.id = r.user_id WHERE r.id = ?`,
    [id],
    (error, request) => {
      if (error) {
        console.error('Admin request detail error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load request details.' });
      }
      if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
      db.all('SELECT id, actor_id AS actorId, action, details, created_at AS createdAt FROM request_history WHERE request_id = ? ORDER BY id DESC', [id],
        (historyError, history) => {
          if (historyError) {
            console.error('Request history read error:', historyError);
            return res.status(500).json({ success: false, message: 'Unable to load request history.' });
          }
          db.all(
            `SELECT n.id, n.body, n.is_internal AS isInternal, n.created_at AS createdAt, u.fullName AS author
             FROM request_notes n JOIN users u ON u.id = n.actor_id WHERE n.request_id = ? ORDER BY n.id DESC`,
            [id],
            (noteError, notes) => {
              if (noteError) {
                console.error('Request notes read error:', noteError);
                return res.status(500).json({ success: false, message: 'Unable to load request notes.' });
              }
              res.json({
                success: true,
                request: { ...request, id: `REQ-${String(request.id).padStart(4, '0')}` },
                history,
                notes
              });
            });
        });
    }
  );
});

app.patch('/api/admin/requests/:id', requireAdminModule('requests'), (req, res) => {
  const id = Number(String(req.params.id).replace(/^REQ-/, ''));
  const { status, progress, assignedTo } = req.body || {};
  const statuses = ['New', 'Pending', 'Approved', 'Rejected', 'In Progress', 'Completed'];
  if (!Number.isSafeInteger(id) || id <= 0 || !statuses.includes(status) ||
      !Number.isInteger(progress) || progress < 0 || progress > 100 ||
      (assignedTo !== null && assignedTo !== undefined && (!Number.isSafeInteger(assignedTo) || assignedTo <= 0))) {
    return res.status(400).json({ success: false, message: 'Choose a valid status, progress percentage, and assignee.' });
  }
  db.get('SELECT user_id, status FROM service_requests WHERE id = ?', [id], (lookupError, request) => {
    if (lookupError) {
      console.error('Request update lookup error:', lookupError);
      return res.status(500).json({ success: false, message: 'Unable to update the request.' });
    }
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    const update = (resolvedAssignee) => {
      db.run('UPDATE service_requests SET status = ?, progress = ?, assigned_to = ? WHERE id = ?',
        [status, progress, resolvedAssignee || null, id], function (error) {
          if (error) {
            console.error('Request update error:', error);
            return res.status(500).json({ success: false, message: 'Unable to update the request.' });
          }
          const description = `Status changed from ${request.status} to ${status}; progress ${progress}%.`;
          db.run('INSERT INTO request_history (request_id, actor_id, action, details) VALUES (?, ?, ?, ?)',
            [id, req.session.user.id, 'updated request', description], (historyError) => {
              if (historyError) console.error('Request status history error:', historyError);
            });
          recordActivity(req.session.user.id, 'updated request status', 'request', id, description);
          if (request.status !== status) {
            notifyUser(request.user_id, `Request ${`REQ-${String(id).padStart(4, '0')}`} updated`, `Your request status is now ${status}.`);
          }
          res.json({ success: true });
        });
    };
    if (!assignedTo) return update(null);
    db.get('SELECT id FROM users WHERE id = ? AND role = "admin" AND is_active = 1', [assignedTo], (staffError, staff) => {
      if (staffError) {
        console.error('Request assignee lookup error:', staffError);
        return res.status(500).json({ success: false, message: 'Unable to verify the assignee.' });
      }
      if (!staff) return res.status(400).json({ success: false, message: 'Choose an active admin as the assignee.' });
      update(staff.id);
    });
  });
});

app.post('/api/admin/requests/:id/notes', requireAdminModule('requests'), (req, res) => {
  const id = Number(String(req.params.id).replace(/^REQ-/, ''));
  const body = typeof (req.body && req.body.body) === 'string' ? req.body.body.trim() : '';
  const isInternal = !req.body || req.body.isInternal !== false;
  if (!Number.isSafeInteger(id) || id <= 0 || !body || body.length > 2000) {
    return res.status(400).json({ success: false, message: 'Enter a note of up to 2,000 characters.' });
  }
  db.get('SELECT user_id FROM service_requests WHERE id = ?', [id], (lookupError, request) => {
    if (lookupError) {
      console.error('Request note lookup error:', lookupError);
      return res.status(500).json({ success: false, message: 'Unable to add the note.' });
    }
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    db.run('INSERT INTO request_notes (request_id, actor_id, body, is_internal) VALUES (?, ?, ?, ?)',
      [id, req.session.user.id, body, Number(isInternal)], function (error) {
        if (error) {
          console.error('Request note save error:', error);
          return res.status(500).json({ success: false, message: 'Unable to add the note.' });
        }
        recordActivity(req.session.user.id, isInternal ? 'added internal note' : 'sent request update', 'request', id, body);
        if (!isInternal) notifyUser(request.user_id, 'Request update', body);
        res.status(201).json({ success: true, id: this.lastID });
      });
  });
});

app.get('/api/admin/clients/:id/login-history', requireAdminModule('clients'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid client ID is required.' });
  db.all(
    `SELECT action, ip_address AS ipAddress, created_at AS createdAt FROM login_history
     WHERE user_id = ? ORDER BY id DESC`,
    [id],
    (error, history) => {
      if (error) {
        console.error('Client login history error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load login history.' });
      }
      res.json({ success: true, history });
    }
  );
});

app.get('/api/admin/activity', requireAdminModule('activity'), (req, res) => {
  db.all(
    `SELECT a.id, a.action, a.entity_type AS entityType, a.entity_id AS entityId,
       a.details, a.created_at AS createdAt, u.fullName AS actor
     FROM admin_activity a LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.id DESC`,
    (error, activities) => {
      if (error) {
        console.error('Admin activity list error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load the activity log.' });
      }
      res.json({ success: true, activities });
    }
  );
});

app.get('/api/admin/notifications', requireAdminModule('notifications'), (req, res) => {
  db.all('SELECT id, title, body, createdAt, read FROM notifications WHERE user_id = ? ORDER BY id DESC',
    [req.session.user.id], (error, notifications) => {
      if (error) {
        console.error('Admin notifications read error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
      }
      res.json({ success: true, notifications });
    });
});

app.post('/api/admin/notifications', requireAdminModule('communications'), (req, res) => {
  const { title, body, clientId, announcement } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.length > 200 ||
      (body !== undefined && body !== null && (typeof body !== 'string' || body.length > 2000)) ||
      (clientId !== undefined && clientId !== null && (!Number.isSafeInteger(clientId) || clientId <= 0)) ||
      (announcement !== undefined && typeof announcement !== 'boolean')) {
    return res.status(400).json({ success: false, message: 'Enter a valid title and message.' });
  }
  const send = (recipients) => {
    if (!recipients.length) return res.status(404).json({ success: false, message: 'No active client recipients were found.' });
    recipients.forEach((client) => notifyUser(client.id, title.trim(), (body || '').trim()));
    recordActivity(req.session.user.id, announcement ? 'published announcement' : 'sent client notification',
      announcement ? 'announcement' : 'notification', null, title.trim());
    res.status(201).json({ success: true, recipients: recipients.length });
  };
  if (announcement) {
    return db.all("SELECT id FROM users WHERE role = 'client' AND is_active = 1", (error, clients) => {
      if (error) {
        console.error('Announcement recipient lookup error:', error);
        return res.status(500).json({ success: false, message: 'Unable to publish the announcement.' });
      }
      send(clients);
    });
  }
  if (clientId) {
    return db.get("SELECT id FROM users WHERE id = ? AND role = 'client' AND is_active = 1", [clientId], (error, client) => {
      if (error) {
        console.error('Notification recipient lookup error:', error);
        return res.status(500).json({ success: false, message: 'Unable to send the notification.' });
      }
      send(client ? [client] : []);
    });
  }
  return res.status(400).json({ success: false, message: 'Choose a client or enable announcement delivery.' });
});

app.patch('/api/admin/notifications/:id/read', requireAdminModule('notifications'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid notification ID is required.' });
  db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [id, req.session.user.id], function (error) {
    if (error) {
      console.error('Admin notification update error:', error);
      return res.status(500).json({ success: false, message: 'Unable to update the notification.' });
    }
    if (!this.changes) return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true });
  });
});

app.delete('/api/admin/notifications/:id', requireAdminModule('notifications'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'A valid notification ID is required.' });
  db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, req.session.user.id], function (error) {
    if (error) {
      console.error('Admin notification delete error:', error);
      return res.status(500).json({ success: false, message: 'Unable to delete the notification.' });
    }
    if (!this.changes) return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true });
  });
});

app.get('/api/admin/reports/:format', requireAdminModule('reports'), async (req, res) => {
  const { format } = req.params;
  const type = typeof req.query.type === 'string' ? req.query.type : 'requests';
  const range = readDateRange(req.query);
  const reportTypes = ['clients', 'admins', 'users', 'admin-activity', 'service-performance',
    'requests', 'completed', 'pending', 'monthly', 'yearly'];
  if (!['xlsx', 'pdf'].includes(format) || !reportTypes.includes(type) || !range) {
    return res.status(400).json({ success: false, message: 'Choose a supported report format, type, and date range.' });
  }
  const isUsers = ['clients', 'admins', 'users'].includes(type);
  const dateColumn = isUsers ? 'createdAt' : 'created_at';
  const statusFilter = type === 'completed' ? "AND status = 'Completed'"
    : type === 'pending' ? "AND status IN ('New', 'Pending', 'Approved', 'In Progress')" : '';
  const groupedRequestReport = type === 'monthly' || type === 'yearly';
  const sql = isUsers
    ? `SELECT id, fullName, email, phone, role, is_active AS active, createdAt AS registeredAt, last_login_at AS lastLoginAt
       FROM users WHERE ${type === 'users' ? "role IN ('client', 'admin', 'superadmin')" : 'role = ?'}
         AND ${dateColumn} BETWEEN ? AND ? ORDER BY createdAt DESC`
    : type === 'admin-activity'
      ? `SELECT a.id, u.fullName AS administrator, u.email, a.action, a.entity_type AS entityType,
           a.entity_id AS entityId, a.details, a.created_at AS createdAt
         FROM admin_activity a LEFT JOIN users u ON u.id = a.actor_id
         WHERE (u.role = 'admin' OR u.id IS NULL) AND a.created_at BETWEEN ? AND ? ORDER BY a.id DESC`
      : type === 'service-performance'
        ? `SELECT service_name AS service, COUNT(*) AS totalRequests,
             SUM(status = 'Completed') AS completedRequests,
             SUM(status = 'Rejected') AS rejectedRequests,
             SUM(status IN ('New', 'Pending', 'Approved', 'In Progress')) AS openRequests,
             ROUND(AVG(progress), 1) AS averageProgress
           FROM service_requests WHERE created_at BETWEEN ? AND ?
           GROUP BY service_name ORDER BY totalRequests DESC, service COLLATE NOCASE`
        : groupedRequestReport
      ? `SELECT strftime('${type === 'monthly' ? '%Y-%m' : '%Y'}', created_at) AS period,
           COUNT(*) AS requestCount, SUM(status = 'Completed') AS completedRequests,
           SUM(status IN ('New', 'Pending')) AS pendingRequests
         FROM service_requests WHERE ${dateColumn} BETWEEN ? AND ?
         GROUP BY period ORDER BY period`
      : `SELECT id, service_name AS service, client_name AS clientName, email, status, priority, created_at AS createdAt
         FROM service_requests WHERE ${dateColumn} BETWEEN ? AND ? ${statusFilter} ORDER BY created_at DESC`;
  const queryParams = isUsers
    ? type === 'users' ? [range.from, range.to] : [type === 'clients' ? 'client' : 'admin', range.from, range.to]
    : [range.from, range.to];
  try {
    const rows = await all(sql, queryParams);
    recordActivity(req.session.user.id, 'exported report', 'report', type, `${format.toUpperCase()} ${range.from} to ${range.to}`);
    const filename = `aj-${type}-report-${new Date().toISOString().slice(0, 10)}`;
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(type.slice(0, 31));
      sheet.columns = rows.length
        ? Object.keys(rows[0]).map((key) => ({ header: key, key, width: Math.min(32, Math.max(14, key.length + 4)) }))
        : [{ header: 'Result', key: 'result', width: 24 }];
      if (!rows.length) sheet.addRow({ result: 'No records for the selected period.' });
      else rows.forEach((row) => sheet.addRow(row));
      sheet.getRow(1).font = { bold: true };
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`
      });
      return await workbook.xlsx.write(res).then(() => res.end());
    }
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}.pdf"` });
    const pdf = new PDFDocument({ margin: 48, size: 'A4' });
    pdf.pipe(res);
    pdf.fontSize(18).text(`AJ Tech Solutions - ${type} report`);
    pdf.moveDown().fontSize(10).text(`Period: ${range.from} to ${range.to}`);
    pdf.moveDown();
    if (!rows.length) pdf.text('No records for the selected period.');
    rows.forEach((row, index) => {
      pdf.fontSize(9).text(`${index + 1}. ${Object.entries(row).map(([key, value]) => `${key}: ${value == null ? '' : value}`).join(' | ')}`);
      pdf.moveDown(0.35);
      if (pdf.y > 720) pdf.addPage();
    });
    pdf.end();
  } catch (error) {
    console.error('Report generation error:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Unable to generate the report.' });
    else res.destroy(error);
  }
});

app.get('/api/admin/profile', requireAdminModule('profile'), (req, res) => {
  db.get('SELECT id, fullName, email, phone, profile_image AS profileImage FROM users WHERE id = ?',
    [req.session.user.id], (error, profile) => {
      if (error) {
        console.error('Admin profile read error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load your profile.' });
      }
      res.json({ success: true, profile });
    });
});

app.patch('/api/admin/profile', requireAdminModule('profile'), async (req, res) => {
  const { fullName, email, phone, currentPassword, newPassword } = req.body || {};
  const name = typeof fullName === 'string' ? fullName.trim() : '';
  const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const number = typeof phone === 'string' ? phone.trim() : '';
  let minimumPasswordLength;
  try {
    minimumPasswordLength = Number(await getSystemSetting('password_min_length', '12'));
  } catch (error) {
    console.error('Admin profile password policy lookup error:', error);
    return res.status(500).json({ success: false, message: 'Unable to verify the password policy.' });
  }
  if (!name || name.length > 100 || !validEmail(address) || number.length > 40 ||
      ((currentPassword || newPassword) && (typeof currentPassword !== 'string' || typeof newPassword !== 'string' ||
        newPassword.length < minimumPasswordLength || newPassword.length > 128))) {
    return res.status(400).json({ success: false, message: 'Check your name, email, phone, and password fields.' });
  }
  db.get('SELECT password FROM users WHERE id = ? AND role IN ("admin", "superadmin")', [req.session.user.id], async (lookupError, user) => {
    if (lookupError) {
      console.error('Admin profile update lookup error:', lookupError);
      return res.status(500).json({ success: false, message: 'Unable to update your profile.' });
    }
    if (!user) return res.status(404).json({ success: false, message: 'Admin account not found.' });
    if (newPassword && !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    let password;
    try {
      password = newPassword ? await bcrypt.hash(newPassword, 12) : user.password;
    } catch (error) {
      console.error('Admin profile password hashing error:', error);
      return res.status(500).json({ success: false, message: 'Unable to update your profile.' });
    }
    db.run('UPDATE users SET fullName = ?, email = ?, phone = ?, password = ?, password_reset_required = 0 WHERE id = ?',
      [name, address, number || null, password, req.session.user.id], function (error) {
        if (error) {
          if (error.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'That email address is already in use.' });
          console.error('Admin profile update error:', error);
          return res.status(500).json({ success: false, message: 'Unable to update your profile.' });
        }
        req.session.user.fullName = name;
        req.session.user.email = address;
        req.session.user.phone = number || null;
        req.session.user.passwordResetRequired = false;
        if (newPassword) {
          db.run(`DELETE FROM sessions WHERE json_extract(sess, '$.user.id') = ? AND sid != ?`,
            [req.session.user.id, req.sessionID], (sessionError) => {
              if (sessionError) console.error('Profile password session revocation error:', sessionError);
            });
        }
        recordActivity(req.session.user.id, 'updated admin profile', 'admin', req.session.user.id, address);
        res.json({ success: true });
      });
  });
});

app.post('/api/admin/profile/image', requireAdminModule('profile'), saveUploadedImage, (req, res) => {
  db.run('UPDATE users SET profile_image = ? WHERE id = ?', [req.uploadedImage, req.session.user.id], function (error) {
    if (error) {
      console.error('Admin profile image update error:', error);
      return res.status(500).json({ success: false, message: 'Unable to update your profile picture.' });
    }
    recordActivity(req.session.user.id, 'uploaded profile picture', 'admin', req.session.user.id, req.uploadedImage);
    res.json({ success: true, image: req.uploadedImage });
  });
});

app.get('/api/admin/login-history', requireAdminModule('profile'), (req, res) => {
  db.all('SELECT action, ip_address AS ipAddress, created_at AS createdAt FROM login_history WHERE user_id = ? ORDER BY id DESC LIMIT 100',
    [req.session.user.id], (error, history) => {
      if (error) {
        console.error('Admin login history error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load login history.' });
      }
      res.json({ success: true, history });
    });
});

app.get('/api/admin/preferences', requireAdminModule('profile'), (req, res) => {
  db.get('SELECT email_enabled AS emailEnabled, in_app_enabled AS inAppEnabled FROM notification_preferences WHERE user_id = ?',
    [req.session.user.id], (error, preferences) => {
      if (error) {
        console.error('Admin preference read error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load notification preferences.' });
      }
      res.json({ success: true, preferences: preferences || { emailEnabled: 0, inAppEnabled: 1 } });
    });
});

app.put('/api/admin/preferences', requireAdminModule('profile'), (req, res) => {
  const { emailEnabled, inAppEnabled } = req.body || {};
  if (typeof emailEnabled !== 'boolean' || typeof inAppEnabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Choose valid notification preferences.' });
  }
  db.run(
    `INSERT INTO notification_preferences (user_id, email_enabled, in_app_enabled) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET email_enabled = excluded.email_enabled, in_app_enabled = excluded.in_app_enabled`,
    [req.session.user.id, Number(emailEnabled), Number(inAppEnabled)],
    (error) => {
      if (error) {
        console.error('Admin preference update error:', error);
        return res.status(500).json({ success: false, message: 'Unable to save notification preferences.' });
      }
      recordActivity(req.session.user.id, 'updated notification preferences', 'admin', req.session.user.id, null);
      res.json({ success: true });
    }
  );
});

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

app.post('/api/register', async (req, res) => {
  const body = req.body || {};
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  let minimumPasswordLength;
  try {
    minimumPasswordLength = Number(await getSystemSetting('password_min_length', '12'));
  } catch (error) {
    console.error('Password policy lookup error:', error);
    return res.status(500).json({ success: false, message: 'Unable to verify the password policy.' });
  }
  if (!fullName || fullName.length > 100 || !validEmail(email) || password.length < minimumPasswordLength || password.length > 128 || phone.length > 40) {
    return res.status(400).json({ success: false, message: `Enter a valid name, email, phone number, and password between ${minimumPasswordLength} and 128 characters.` });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    db.run(
      'INSERT INTO users (fullName, email, password, phone) VALUES (?, ?, ?, ?)',
      [fullName, email, hashedPassword, phone || null],
      function (error) {
        if (error) {
          if (error.message.includes('UNIQUE')) {
            return res.status(409).json({ success: false, message: 'An account already exists for this email.' });
          }
          console.error('Registration database error:', error);
          return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
        }

        const userId = this.lastID;
        req.session.regenerate((sessionError) => {
          if (sessionError) {
            console.error('Session creation error:', sessionError);
            return res.status(500).json({ success: false, message: 'Account created, but sign-in failed. Please sign in.' });
          }
          req.session.user = { id: userId, fullName, email, phone: phone || null, role: 'client' };
          req.session.cookie.maxAge = sessionTimeoutMs;
          recordLoginEvent(userId, 'register', req);
          notifyRole('admin', 'New client registered', `${fullName} created a client account.`);
          recordActivity(userId, 'registered', 'client', userId, `Client account created: ${email}`);
          res.status(201).json({ success: true, user: req.session.user });
        });
      }
    );
  } catch (error) {
    console.error('Password hashing error:', error);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

app.post('/api/login', (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!validEmail(email) || !password || password.length > 128) {
    recordLoginAttempt(email, false, req);
    return res.status(400).json({ success: false, message: 'Enter a valid email address and password.' });
  }

  db.get(
    `SELECT COUNT(*) AS failures FROM login_attempts
     WHERE success = 0 AND (email = ? OR ip_address = ?) AND created_at >= datetime('now', '-15 minutes')`,
    [email, req.ip || ''], (limitError, result) => {
      if (limitError) {
        console.error('Login attempt rate-limit lookup error:', limitError);
        return res.status(500).json({ success: false, message: 'Sign-in failed. Please try again.' });
      }
      if (result.failures >= 10) {
        recordLoginAttempt(email, false, req);
        return res.status(429).json({ success: false, message: 'Too many unsuccessful sign-in attempts. Try again in 15 minutes.' });
      }
      authenticateLogin();
    });

  function authenticateLogin() {
  db.get('SELECT id, fullName, email, password, role, phone, is_active, profile_image, password_reset_required FROM users WHERE email = ?', [email], async (error, user) => {
    if (error) {
      console.error('Login database error:', error);
      return res.status(500).json({ success: false, message: 'Sign-in failed. Please try again.' });
    }
    if (!user || !user.is_active) {
      recordLoginAttempt(email, false, req);
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    try {
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        recordLoginAttempt(email, false, req);
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      req.session.regenerate((sessionError) => {
        if (sessionError) {
          console.error('Session creation error:', sessionError);
          return res.status(500).json({ success: false, message: 'Sign-in failed. Please try again.' });
        }
        const lastLoginAt = new Date().toISOString();
        req.session.cookie.maxAge = sessionTimeoutMs;
        req.session.user = {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role || 'client',
          profileImage: user.profile_image,
          passwordResetRequired: Boolean(user.password_reset_required)
        };
        db.run('UPDATE users SET last_login_at = ? WHERE id = ?', [lastLoginAt, user.id], (updateError) => {
          if (updateError) console.error('Last login update error:', updateError);
        });
        recordLoginEvent(user.id, 'login', req);
        recordLoginAttempt(email, true, req);
        res.json({ success: true, user: { ...req.session.user, lastLoginAt } });
      });
    } catch (compareError) {
      console.error('Password verification error:', compareError);
      res.status(500).json({ success: false, message: 'Sign-in failed. Please try again.' });
    }
  });
  }
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: 'Please sign in to access your account.' });
  res.json({ success: true, user: req.session.user });
});

app.post('/api/account/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  let minimum;
  try {
    minimum = Number(await getSystemSetting('password_min_length', '12'));
  } catch (error) {
    console.error('Password policy lookup error:', error);
    return res.status(500).json({ success: false, message: 'Unable to verify the password policy.' });
  }
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' ||
      newPassword.length < minimum || newPassword.length > 128 || currentPassword === newPassword) {
    return res.status(400).json({ success: false, message: `Choose a different password between ${minimum} and 128 characters.` });
  }
  db.get('SELECT password FROM users WHERE id = ?', [req.session.user.id], async (lookupError, user) => {
    if (lookupError) {
      console.error('Password change lookup error:', lookupError);
      return res.status(500).json({ success: false, message: 'Unable to change the password.' });
    }
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    try {
      const passwordHash = await bcrypt.hash(newPassword, 12);
      db.run('UPDATE users SET password = ?, password_reset_required = 0 WHERE id = ?',
        [passwordHash, req.session.user.id], function (error) {
          if (error) {
            console.error('Password change update error:', error);
            return res.status(500).json({ success: false, message: 'Unable to change the password.' });
          }
          db.run(`DELETE FROM sessions WHERE json_extract(sess, '$.user.id') = ? AND sid != ?`,
            [req.session.user.id, req.sessionID], (sessionError) => {
              if (sessionError) console.error('Password change session revocation error:', sessionError);
            });
          req.session.user.passwordResetRequired = false;
          recordActivity(req.session.user.id, 'changed account password', 'account', req.session.user.id, null);
          res.json({ success: true });
        });
    } catch (error) {
      console.error('Password hashing error:', error);
      res.status(500).json({ success: false, message: 'Unable to change the password.' });
    }
  });
});

app.post('/api/logout', (req, res) => {
  if (req.session.user) recordLoginEvent(req.session.user.id, 'logout', req);
  req.session.destroy((error) => {
    if (error) {
      console.error('Session destruction error:', error);
      return res.status(500).json({ success: false, message: 'Unable to sign out. Please try again.' });
    }
    res.clearCookie('aj.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.json({ success: true });
  });
});

app.post('/api/service-requests', requireRole('client'), (req, res) => {
  const payload = req.body || {};
  const limits = {
    serviceName: 120,
    clientName: 100,
    email: 254,
    phone: 40,
    companyName: 120,
    description: 4000,
    estimatedBudget: 80,
    documents: 500,
    additionalNotes: 2000
  };
  for (const [field, maxLength] of Object.entries(limits)) {
    if (payload[field] !== undefined && (typeof payload[field] !== 'string' || payload[field].length > maxLength)) {
      return res.status(400).json({ success: false, message: `Please check the ${field} field.` });
    }
  }

  const requiredFields = ['serviceName', 'clientName', 'email', 'phone', 'description'];
  const preferredDate = payload.preferredStartDate;
  const parsedPreferredDate = typeof preferredDate === 'string' && preferredDate
    ? new Date(`${preferredDate}T00:00:00.000Z`)
    : null;
  if (requiredFields.some((field) => !payload[field] || !payload[field].trim()) ||
      !validEmail(payload.email) ||
      !['Low', 'Medium', 'High'].includes(payload.priority || 'Medium') ||
      (preferredDate !== undefined && preferredDate !== '' &&
        (typeof preferredDate !== 'string' || !parsedPreferredDate ||
          Number.isNaN(parsedPreferredDate.getTime()) ||
          parsedPreferredDate.toISOString().slice(0, 10) !== preferredDate))) {
    return res.status(400).json({ success: false, message: 'Please complete the required fields with valid contact details.' });
  }

  const query = `
    INSERT INTO service_requests (
      service_name, client_name, email, phone, company_name, description, priority,
      preferred_start_date, estimated_budget, documents, additional_notes, status, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    payload.serviceName.trim(),
    payload.clientName.trim(),
    payload.email.trim().toLowerCase(),
    payload.phone.trim(),
    payload.companyName ? payload.companyName.trim() : null,
    payload.description.trim(),
    payload.priority || 'Medium',
    payload.preferredStartDate || null,
    payload.estimatedBudget || null,
    payload.documents || null,
    payload.additionalNotes || null,
    'New',
    req.session.user.id
  ], function (err) {
    if (err) {
      console.error('Service request database error:', err);
      return res.status(500).json({ success: false, message: 'Unable to save request. Please try again.' });
    }

    const internalRequestId = this.lastID;
    const requestId = `REQ-${String(internalRequestId).padStart(4, '0')}`;
    const notificationBody = `Your ${payload.serviceName.trim()} request has been received.`;
    db.run('INSERT INTO request_history (request_id, actor_id, action, details) VALUES (?, ?, ?, ?)',
      [internalRequestId, req.session.user.id, 'submitted request', `${payload.serviceName.trim()} request submitted.`],
      (historyError) => {
        if (historyError) console.error('Initial request history write error:', historyError);
      });
    db.run(
      'INSERT INTO notifications (title, body, user_id) VALUES (?, ?, ?)',
      ['Service request received', notificationBody, req.session.user.id],
      function (notificationErr) {
        if (notificationErr) console.error('Request notification database error:', notificationErr);
        else io.to(`user:${req.session.user.id}`).emit('notification', {
          id: this.lastID,
          title: 'Service request received',
          body: notificationBody,
          time: new Date().toISOString(),
          read: false
        });
        notifyRole('admin', 'New service request', `${req.session.user.fullName} submitted ${payload.serviceName.trim()} (${requestId}).`);
        recordActivity(req.session.user.id, 'submitted service request', 'request', requestId, `${payload.serviceName.trim()} (${requestId})`);
        res.status(201).json({
          success: true,
          message: 'Request saved successfully.',
          notification: notificationErr ? null : {
            id: this.lastID,
            title: 'Service request received',
            body: notificationBody,
            time: new Date().toISOString(),
            read: false
          },
          request: {
            id: requestId,
            serviceName: payload.serviceName.trim(),
            priority: payload.priority || 'Medium',
            status: 'New',
            createdAt: new Date().toISOString(),
            details: payload.description.trim()
          }
        });
    });
  });
});

app.get('/api/service-requests', requireRole('client'), (req, res) => {
  db.all(
    `SELECT id, service_name, priority, status, preferred_start_date, description, created_at
     FROM service_requests WHERE user_id = ? ORDER BY id DESC LIMIT 100`,
    [req.session.user.id],
    (err, rows) => {
      if (err) {
        console.error('Service request read error:', err);
        return res.status(500).json({ success: false, message: 'Unable to load service requests.' });
      }
      res.json({
        success: true,
        requests: rows.map((row) => ({
          id: `REQ-${String(row.id).padStart(4, '0')}`,
          service: row.service_name,
          priority: row.priority,
          status: row.status,
          assignedStaff: 'Pending assignment',
          created: row.created_at,
          expected: row.preferred_start_date || 'To be confirmed',
          progress: row.status === 'Completed' ? 100 : 0,
          details: row.description
        }))
      });
    }
  );
});

app.get('/api/payments', requireRole('client'), (req, res) => {
  db.all('SELECT invoice_id AS id, amount, status, due_date AS due FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 100', [req.session.user.id], (err, rows) => {
    if (err) {
      console.error('Payment read error:', err);
      return res.status(500).json({ success: false, message: 'Unable to load invoices.' });
    }
    res.json({ success: true, payments: rows });
  });
});

app.get('/api/tickets', requireRole('client'), (req, res) => {
  db.all('SELECT ticket_id AS id, title, status, priority FROM tickets WHERE user_id = ? ORDER BY id DESC LIMIT 100', [req.session.user.id], (err, rows) => {
    if (err) {
      console.error('Ticket read error:', err);
      return res.status(500).json({ success: false, message: 'Unable to load support requests.' });
    }
    res.json({ success: true, tickets: rows });
  });
});

app.get('/api/documents', requireRole('client'), (req, res) => {
  db.all('SELECT name, type FROM documents WHERE user_id = ? ORDER BY id DESC LIMIT 100', [req.session.user.id], (err, rows) => {
    if (err) {
      console.error('Document read error:', err);
      return res.status(500).json({ success: false, message: 'Unable to load documents.' });
    }
    res.json({ success: true, documents: rows });
  });
});

app.get('/api/notifications', requireRole('client'), (req, res) => {
  db.all('SELECT id, title, body, createdAt, read FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50', [req.session.user.id], (err, rows) => {
    if (err) {
      console.error('Notification read error:', err);
      return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
    }
    const notifications = rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      time: row.createdAt,
      read: Boolean(row.read)
    }));
    res.json({ notifications });
  });
});

app.get('/api/notifications/unread-count', requireRole('client'), (req, res) => {
  db.get('SELECT COUNT(*) as c FROM notifications WHERE read = 0 AND user_id = ?', [req.session.user.id], (err, row) => {
    if (err) {
      console.error('Unread notification count error:', err);
      return res.status(500).json({ success: false, message: 'Unable to load notification count.' });
    }
    res.json({ success: true, count: row ? row.c : 0 });
  });
});

app.post('/api/notifications/mark-read', requireRole('client'), (req, res) => {
  const id = req.body && req.body.id;
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) return res.status(400).json({ success: false, message: 'A valid notification id is required.' });
  db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [Number(id), req.session.user.id], function (err) {
    if (err) {
      console.error('Mark notification read error:', err);
      return res.status(500).json({ success: false, message: 'Unable to update notification.' });
    }
    if (!this.changes) return res.status(404).json({ success: false, message: 'Notification not found.' });
    const userRoom = `user:${req.session.user.id}`;
    io.to(userRoom).emit('notification:marked', Number(id));
    db.get('SELECT COUNT(*) as c FROM notifications WHERE read = 0 AND user_id = ?', [req.session.user.id], (countError, row) => {
      if (countError) {
        console.error('Unread notification count error:', countError);
        return res.status(500).json({ success: false, message: 'Notification updated, but count could not be refreshed.' });
      }
      io.to(userRoom).emit('notifications:count', row ? row.c : 0);
      res.json({ success: true, id: Number(id) });
    });
  });
});

app.post('/api/notifications/clear', requireRole('client'), (req, res) => {
  db.run('UPDATE notifications SET read = 1 WHERE read = 0 AND user_id = ?', [req.session.user.id], function (err) {
    if (err) {
      console.error('Clear notifications error:', err);
      return res.status(500).json({ success: false, message: 'Unable to clear notifications.' });
    }
    const cleared = this.changes;
    const userRoom = `user:${req.session.user.id}`;
    io.to(userRoom).emit('notifications:cleared');
    io.to(userRoom).emit('notifications:count', 0);
    res.json({ success: true, cleared });
  });
});

app.post('/api/notifications/create', (req, res) => {
  const expectedKey = process.env.NOTIF_API_KEY;
  if (!expectedKey) return res.status(503).json({ success: false, message: 'Notification creation is not configured.' });
  if (req.get('x-api-key') !== expectedKey) return res.status(401).json({ success: false, message: 'Invalid API key' });
  const { title, body } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.length > 200 ||
      (body !== undefined && body !== null && (typeof body !== 'string' || body.length > 2000))) {
    return res.status(400).json({ success: false, message: 'A title (up to 200 characters) and valid body are required.' });
  }
  db.run('INSERT INTO notifications (title, body) VALUES (?, ?)', [title.trim(), body || null], function (err) {
    if (err) {
      console.error('Notification creation error:', err);
      return res.status(500).json({ success: false, message: 'Unable to create notification.' });
    }
    const id = this.lastID;
    const createdAt = new Date().toISOString();
    const payload = { id, title: title.trim(), body: body || null, time: createdAt, read: false };
    res.status(201).json({ success: true, notification: payload });
  });
});

// create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new Server(server);

io.engine.use(sessionMiddleware);
io.use((socket, next) => {
  const sessionUser = socket.request.session && socket.request.session.user;
  if (!sessionUser) return next(new Error('Authentication required.'));
  db.get('SELECT role, is_active FROM users WHERE id = ?', [sessionUser.id], (error, user) => {
    if (error) {
      console.error('Socket account verification error:', error);
      return next(new Error('Unable to verify the account.'));
    }
    if (!user || !user.is_active) return next(new Error('Authentication required.'));
    sessionUser.role = user.role || 'client';
    next();
  });
});
io.on('connection', (socket) => {
  const user = socket.request.session && socket.request.session.user;
  if (!user) {
    socket.disconnect(true);
    return;
  }
  socket.join(`user:${user.id}`);
});

initDb()
  .then(() => server.listen(PORT, () => {
    console.log(`AJ Tech Solutions client portal running on port ${PORT}`);
  }))
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exitCode = 1;
    server.close();
  });
