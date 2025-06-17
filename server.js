const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create HTTP server
const server = http.createServer(app);

// Live reload WebSocket server (development only)
let wss = null;
if (isDevelopment) {
    wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws) => {
        console.log('🔄 Live reload client connected');
        
        ws.on('close', () => {
            console.log('🔄 Live reload client disconnected');
        });
    });
    
    // Function to trigger reload
    global.triggerReload = () => {
        if (wss) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send('reload');
                }
            });
            console.log('🔄 Triggered live reload');
        }
    };
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// SQLite Database Setup
const db = new sqlite3.Database('./team_archive.db');

// Initialize database tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Collections table
    db.run(`CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT DEFAULT '📁',
        color TEXT DEFAULT '#667eea',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`);

    // Archive items table
    db.run(`CREATE TABLE IF NOT EXISTS archive_items (
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

    // Files table
    db.run(`CREATE TABLE IF NOT EXISTS files (
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

    // Insert default collections
    db.run(`INSERT OR IGNORE INTO collections (id, name, icon, color) VALUES 
        (1, 'Inspiration', '✨', '#ff6b6b'),
        (2, 'Design', '🎨', '#4ecdc4'),
        (3, 'Research', '🔍', '#45b7d1'),
        (4, 'Resources', '📎', '#96ceb4')`);

    console.log('Database initialized successfully');
});

// File upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|mov|avi/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// JWT middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// ====================================
// AUTH ROUTES
// ====================================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user
        db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Username or email already exists' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                
                // Generate JWT
                const token = jwt.sign(
                    { userId: this.lastID, username },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                res.status(201).json({
                    token,
                    user: {
                        id: this.lastID,
                        username,
                        email,
                        role: 'member'
                    }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        db.get(
            'SELECT * FROM users WHERE email = ?',
            [email],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                if (!user) {
                    return res.status(400).json({ error: 'Invalid credentials' });
                }
                
                // Check password
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.status(400).json({ error: 'Invalid credentials' });
                }
                
                // Generate JWT
                const token = jwt.sign(
                    { userId: user.id, username: user.username },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                res.json({
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role
                    }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ====================================
// COLLECTIONS ROUTES
// ====================================

app.get('/api/collections', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM collections ORDER BY created_at ASC',
        [],
        (err, collections) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(collections);
        }
    );
});

app.post('/api/collections', authenticateToken, (req, res) => {
    const { name, icon, color } = req.body;
    
    db.run(
        'INSERT INTO collections (name, icon, color, created_by) VALUES (?, ?, ?, ?)',
        [name, icon || '📁', color || '#667eea', req.user.userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            db.get(
                'SELECT * FROM collections WHERE id = ?',
                [this.lastID],
                (err, collection) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.status(201).json(collection);
                }
            );
        }
    );
});

// ====================================
// ARCHIVE ITEMS ROUTES
// ====================================

app.get('/api/items', authenticateToken, (req, res) => {
    const { collection, search, tags, page = 1, limit = 20 } = req.query;
    
    let query = `
        SELECT 
            ai.*,
            c.name as collection_name,
            c.icon as collection_icon,
            u.username as author_username
        FROM archive_items ai
        LEFT JOIN collections c ON ai.collection_id = c.id
        LEFT JOIN users u ON ai.created_by = u.id
        WHERE 1=1
    `;
    let params = [];
    
    if (collection && collection !== 'all') {
        query += ' AND c.name = ?';
        params.push(collection);
    }
    
    if (search) {
        query += ' AND (ai.title LIKE ? OR ai.description LIKE ? OR ai.tags LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (tags) {
        const tagArray = tags.split(',');
        const tagConditions = tagArray.map(() => 'ai.tags LIKE ?').join(' OR ');
        query += ` AND (${tagConditions})`;
        tagArray.forEach(tag => params.push(`%${tag.trim()}%`));
    }
    
    query += ' ORDER BY ai.created_at DESC';
    
    // Add pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    db.all(query, params, (err, items) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Get files for each item
        const itemsWithFiles = [];
        let processedItems = 0;
        
        if (items.length === 0) {
            return res.json({ items: [], total: 0, page: parseInt(page) });
        }
        
        items.forEach(item => {
            db.all(
                'SELECT * FROM files WHERE item_id = ?',
                [item.id],
                (err, files) => {
                    if (err) {
                        files = [];
                    }
                    
                    itemsWithFiles.push({
                        ...item,
                        tags: item.tags ? item.tags.split(',').map(tag => tag.trim()) : [],
                        files: files || []
                    });
                    
                    processedItems++;
                    if (processedItems === items.length) {
                        // Get total count
                        let countQuery = `
                            SELECT COUNT(*) as total
                            FROM archive_items ai
                            LEFT JOIN collections c ON ai.collection_id = c.id
                            WHERE 1=1
                        `;
                        let countParams = [];
                        
                        if (collection && collection !== 'all') {
                            countQuery += ' AND c.name = ?';
                            countParams.push(collection);
                        }
                        
                        if (search) {
                            countQuery += ' AND (ai.title LIKE ? OR ai.description LIKE ? OR ai.tags LIKE ?)';
                            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
                        }
                        
                        db.get(countQuery, countParams, (err, countResult) => {
                            const total = countResult ? countResult.total : items.length;
                            res.json({
                                items: itemsWithFiles,
                                total,
                                page: parseInt(page),
                                totalPages: Math.ceil(total / limit)
                            });
                        });
                    }
                }
            );
        });
    });
});

app.post('/api/items', authenticateToken, upload.array('files', 5), (req, res) => {
    const { title, description, url, tags, collection } = req.body;
    
    // Get collection ID
    db.get(
        'SELECT id FROM collections WHERE name = ?',
        [collection],
        (err, collectionRow) => {
            if (err || !collectionRow) {
                return res.status(400).json({ error: 'Invalid collection' });
            }
            
            // Insert archive item
            db.run(
                'INSERT INTO archive_items (title, description, url, tags, collection_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
                [title, description || '', url || '', tags || '', collectionRow.id, req.user.userId],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    const itemId = this.lastID;
                    
                    // Insert files if any
                    if (req.files && req.files.length > 0) {
                        const fileInserts = req.files.map(file => {
                            return new Promise((resolve, reject) => {
                                db.run(
                                    'INSERT INTO files (item_id, filename, original_name, mimetype, size, path) VALUES (?, ?, ?, ?, ?, ?)',
                                    [itemId, file.filename, file.originalname, file.mimetype, file.size, file.path],
                                    function(err) {
                                        if (err) reject(err);
                                        else resolve();
                                    }
                                );
                            });
                        });
                        
                        Promise.all(fileInserts)
                            .then(() => {
                                // Return the created item with files
                                returnCreatedItem(itemId, res);
                            })
                            .catch(err => {
                                res.status(500).json({ error: 'Failed to save files' });
                            });
                    } else {
                        // Return item without files
                        returnCreatedItem(itemId, res);
                    }
                }
            );
        }
    );
});

function returnCreatedItem(itemId, res) {
    db.get(
        `SELECT 
            ai.*,
            c.name as collection_name,
            c.icon as collection_icon,
            u.username as author_username
        FROM archive_items ai
        LEFT JOIN collections c ON ai.collection_id = c.id
        LEFT JOIN users u ON ai.created_by = u.id
        WHERE ai.id = ?`,
        [itemId],
        (err, item) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            db.all(
                'SELECT * FROM files WHERE item_id = ?',
                [itemId],
                (err, files) => {
                    res.status(201).json({
                        ...item,
                        tags: item.tags ? item.tags.split(',').map(tag => tag.trim()) : [],
                        files: files || []
                    });
                }
            );
        }
    );
}

app.put('/api/items/:id', authenticateToken, (req, res) => {
    const { title, description, url, tags, collection } = req.body;
    const itemId = req.params.id;
    
    // Get collection ID
    db.get(
        'SELECT id FROM collections WHERE name = ?',
        [collection],
        (err, collectionRow) => {
            if (err || !collectionRow) {
                return res.status(400).json({ error: 'Invalid collection' });
            }
            
            db.run(
                `UPDATE archive_items 
                 SET title = ?, description = ?, url = ?, tags = ?, collection_id = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND created_by = ?`,
                [title, description || '', url || '', tags || '', collectionRow.id, itemId, req.user.userId],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    if (this.changes === 0) {
                        return res.status(404).json({ error: 'Item not found or unauthorized' });
                    }
                    
                    // Return updated item
                    returnCreatedItem(itemId, res);
                }
            );
        }
    );
});

app.delete('/api/items/:id', authenticateToken, (req, res) => {
    const itemId = req.params.id;
    
    // First, get the item to check ownership and get files
    db.get(
        'SELECT * FROM archive_items WHERE id = ? AND created_by = ?',
        [itemId, req.user.userId],
        (err, item) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            if (!item) {
                return res.status(404).json({ error: 'Item not found or unauthorized' });
            }
            
            // Get associated files to delete them
            db.all(
                'SELECT * FROM files WHERE item_id = ?',
                [itemId],
                (err, files) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    // Delete files from filesystem
                    files.forEach(file => {
                        try {
                            if (fs.existsSync(file.path)) {
                                fs.unlinkSync(file.path);
                            }
                        } catch (error) {
                            console.error('Error deleting file:', error);
                        }
                    });
                    
                    // Delete files from database
                    db.run(
                        'DELETE FROM files WHERE item_id = ?',
                        [itemId],
                        (err) => {
                            if (err) {
                                console.error('Error deleting files from database:', err);
                            }
                            
                            // Delete the item
                            db.run(
                                'DELETE FROM archive_items WHERE id = ?',
                                [itemId],
                                function(err) {
                                    if (err) {
                                        return res.status(500).json({ error: err.message });
                                    }
                                    
                                    res.json({ message: 'Item deleted successfully' });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// ====================================
// EXPORT ROUTES
// ====================================

app.get('/api/export', authenticateToken, (req, res) => {
    db.all(
        `SELECT 
            ai.*,
            c.name as collection_name,
            c.icon as collection_icon,
            u.username as author_username
        FROM archive_items ai
        LEFT JOIN collections c ON ai.collection_id = c.id
        LEFT JOIN users u ON ai.created_by = u.id
        ORDER BY ai.created_at DESC`,
        [],
        (err, items) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const exportData = {
                exportDate: new Date().toISOString(),
                exportedBy: req.user.username,
                version: '1.0',
                itemCount: items.length,
                items: items.map(item => ({
                    ...item,
                    tags: item.tags ? item.tags.split(',').map(tag => tag.trim()) : []
                }))
            };
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="team-archive-export-${new Date().toISOString().split('T')[0]}.json"`);
            res.json(exportData);
        }
    );
});

// ====================================
// HEALTH CHECK
// ====================================

app.get('/health', (req, res) => {
    db.get('SELECT 1', [], (err) => {
        if (err) {
            res.status(503).json({ 
                status: 'unhealthy', 
                error: 'Database connection failed',
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({ 
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        }
    });
});

// ====================================
// ERROR HANDLING
// ====================================

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large (max 10MB)' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files (max 5)' });
        }
    }
    
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ====================================
// START SERVER
// ====================================

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database: ${path.resolve('./team_archive.db')}`);
    console.log(`Uploads: ${path.resolve('./uploads')}`);
    
    if (isDevelopment) {
        console.log('🔄 Live reload enabled');
        console.log('💡 Use "npm run dev:watch" for full live reload experience');
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});