const readline = require('readline/promises');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const role = process.argv[2] === '--role' ? process.argv[3] : '';
if (role !== 'superadmin') {
  console.error('Usage: npm run setup-admin -- --role superadmin');
  console.error('This command is only for first-time Super Admin bootstrap. Existing Super Admins must provision privileged accounts in the dashboard.');
  process.exit(1);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Run this command in an interactive terminal so the password can be entered privately.');
  process.exit(1);
}

const databasePath = process.env.DB_PATH || path.join(__dirname, '..', 'auth.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new sqlite3.Database(databasePath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });
}

async function askPassword(question, prompt) {
  prompt.output.write(question);
  const stdin = prompt.input;
  stdin.setRawMode(true);
  stdin.resume();
  let value = '';
  try {
    return await new Promise((resolve, reject) => {
      const onData = (chunk) => {
        const key = chunk.toString();
        if (key === '\u0003') {
          stdin.off('data', onData);
          reject(new Error('Setup cancelled.'));
        } else if (key === '\r' || key === '\n') {
          stdin.off('data', onData);
          prompt.output.write('\n');
          resolve(value);
        } else if (key === '\u0008' || key === '\u007f') {
          value = value.slice(0, -1);
        } else if (key >= ' ' && key <= '~') {
          value += key;
        }
      };
      stdin.on('data', onData);
    });
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
  }
}

async function main() {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const fullName = (await prompt.question('Full name: ')).trim();
    const email = (await prompt.question('Email address: ')).trim().toLowerCase();
    const password = await askPassword('Password (12+ characters): ', prompt);
    const confirmation = await askPassword('Confirm password: ', prompt);

    if (!fullName || fullName.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        password.length < 12 || password.length > 128 || password !== confirmation) {
      throw new Error('Enter a valid name and email, and matching passwords between 12 and 128 characters.');
    }

    await run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const columns = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(users)', (error, rows) => error ? reject(error) : resolve(rows));
    });
    if (!columns.some((column) => column.name === 'role')) {
      await run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'client'");
    }
    if (!columns.some((column) => column.name === 'is_active')) {
      await run('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    }
    if (await get("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1")) {
      throw new Error('A Super Admin already exists. Only an existing Super Admin may create additional privileged accounts in the dashboard.');
    }
    if (await get('SELECT id FROM users WHERE email = ?', [email])) {
      throw new Error('An account already exists for that email. Use a new email address.');
    }
    const hash = await bcrypt.hash(password, 12);
    await run('INSERT INTO users (fullName, email, password, role) VALUES (?, ?, ?, ?)', [fullName, email, hash, role]);
    console.log('Initial Super Admin account created. Additional privileged accounts must be provisioned by a signed-in Super Admin.');
  } finally {
    prompt.close();
    db.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
