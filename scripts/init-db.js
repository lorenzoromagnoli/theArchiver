const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

console.log('🗄️  Initializing Team Creative Archive Database...');

const dbPath = path.join(__dirname, '..', 'team_archive.db');
const db = new sqlite3.Database(dbPath);

async function initializeDatabase() {
    try {
        console.log('📋 Creating tables...');
        
        // Create tables (these should match server.js)
        await runQuery(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT DEFAULT '📁',
            color TEXT DEFAULT '#667eea',
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users (id)
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS archive_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            url TEXT,
            tags TEXT,
            collection_id INTEGER,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (collection_id) REFERENCES collections (id),
            FOREIGN KEY (created_by) REFERENCES users (id)
        )`);

        await runQuery(`CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mimetype TEXT,
            size INTEGER,
            path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES archive_items (id)
        )`);

        console.log('✅ Tables created successfully!');

        // Insert default collections
        console.log('📁 Creating default collections...');
        await runQuery(`INSERT OR IGNORE INTO collections (id, name, icon, color) VALUES 
            (1, 'Inspiration', '✨', '#ff6b6b'),
            (2, 'Design', '🎨', '#4ecdc4'),
            (3, 'Research', '🔍', '#45b7d1'),
            (4, 'Resources', '📎', '#96ceb4')`);

        console.log('✅ Default collections created!');

        // Create default users
        console.log('👥 Creating default users...');
        
        // Admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        await runQuery(`INSERT OR IGNORE INTO users (id, username, email, password, role) 
                VALUES (1, 'admin', 'admin@team.com', ?, 'admin')`, [adminPassword]);
        
        // Demo user
        const demoPassword = await bcrypt.hash('demo123', 10);
        await runQuery(`INSERT OR IGNORE INTO users (id, username, email, password, role) 
                VALUES (2, 'demo', 'demo@team.com', ?, 'member')`, [demoPassword]);

        console.log('✅ Default users created!');
        console.log('');
        console.log('🎉 Database initialized successfully!');
        console.log('');
        console.log('📝 Default Login Credentials:');
        console.log('   Admin: admin@team.com / admin123');
        console.log('   Demo:  demo@team.com / demo123');
        console.log('');
        console.log('🚀 You can now start the server with: npm start');

    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
}

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

// Run initialization
initializeDatabase();