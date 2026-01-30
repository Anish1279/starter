const Database = require('better-sqlite3');
const path = require('path');


const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);


// Enable foreign keys
db.pragma('foreign_keys = ON');


// Helper to make it work like mysql2 promises (for compatibility)
const execute = (sql, params = []) => {
return new Promise((resolve, reject) => {
try {
const trimmed = sql.trim().toUpperCase();
if (trimmed.startsWith('SELECT')) {
const stmt = db.prepare(sql);
const rows = stmt.all(...params);
resolve([rows]);
} else if (trimmed.startsWith('INSERT')) {
const stmt = db.prepare(sql);
const result = stmt.run(...params);
// better-sqlite3 returns an object with .lastInsertRowid and .changes
resolve([{ insertId: result.lastInsertRowid, affectedRows: result.changes }]);
} else {
const stmt = db.prepare(sql);
const result = stmt.run(...params);
resolve([{ affectedRows: result.changes }]);
}
} catch (error) {
reject(error);
}
});
};


module.exports = { execute };
