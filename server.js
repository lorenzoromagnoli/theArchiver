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

// NEW: Dependencies for URL image extraction
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create HTTP server
const server = http.createServer(app);

// Live reload WebSocket server (development only)
let wss = null;

if (isDevelopment) {
    console.log('🔄 Setting up live reload in development mode...');
    
    wss = new WebSocket.Server({ 
        server,
        path: '/live-reload'
    });
    
    wss.on('connection', (ws, request) => {
        console.log('🔄 Live reload client connected from:', request.connection.remoteAddress);
        
        // Send immediate confirmation
        ws.send('connected');
        
        ws.on('message', (message) => {
            console.log('🔄 Received message from client:', message.toString());
        });
        
        ws.on('close', () => {
            console.log('🔄 Live reload client disconnected');
        });
        
        ws.on('error', (error) => {
            console.log('🔄 WebSocket error:', error);
        });
        
        // Send a ping every 30 seconds to keep connection alive
        const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            } else {
                clearInterval(interval);
            }
        }, 30000);
    });
    
    // FIRST: Define the triggerReload function
    global.triggerReload = () => {
        const clientCount = wss ? wss.clients.size : 0;
        console.log(`🔄 Broadcasting reload to ${clientCount} connected clients`);
        
        if (clientCount === 0) {
            console.log('⚠️  No clients connected to live reload');
            return;
        }
        
        if (wss) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    console.log('📡 Sending reload signal to client');
                    client.send('reload');
                }
            });
        }
    };
    
    // THEN: Set up file watching (now triggerReload is available)
    const fs = require('fs');
    const path = require('path');
    
    const publicDir = path.join(__dirname, 'public');
    console.log('👀 Setting up native fs.watch for:', publicDir);
    
    const watchers = [];
    
    // Function to watch a directory recursively
    function watchDirectory(dir) {
        try {
            console.log(`📁 Watching directory: ${dir}`);
            
            const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
                if (!filename) return;
                
                const fullPath = path.join(dir, filename);
                const relativePath = path.relative(__dirname, fullPath);
                
                // Filter out files we don't care about
                if (filename.includes('node_modules') || 
                    filename.includes('uploads') || 
                    filename.includes('.git') ||
                    filename.includes('.DS_Store') ||
                    filename === 'live-reload.js') {
                    return;
                }
                
                // Only watch specific file types
                const ext = path.extname(filename).toLowerCase();
                if (!['.html', '.css', '.js'].includes(ext)) {
                    return;
                }
                
                console.log(`📁 File ${eventType}: ${relativePath}`);
                
                // Debounce rapid changes
                clearTimeout(global.reloadTimeout);
                global.reloadTimeout = setTimeout(() => {
                    console.log(`🚀 Triggering reload for: ${relativePath}`);
                    // This should now work since triggerReload is defined above
                    global.triggerReload();
                }, 300);
            });
            
            watchers.push(watcher);
            
            watcher.on('error', (error) => {
                console.error(`❌ Error watching ${dir}:`, error.message);
            });
            
        } catch (error) {
            console.error(`❌ Could not watch directory ${dir}:`, error.message);
        }
    }
    
    // Watch the public directory
    watchDirectory(publicDir);
    
    // Also watch subdirectories
    const subdirs = ['js', 'css', 'images'].map(sub => path.join(publicDir, sub));
    subdirs.forEach(subdir => {
        if (fs.existsSync(subdir)) {
            watchDirectory(subdir);
        }
    });
    
    console.log('✅ Native file watcher initialized');
    
    // Manual trigger function for testing
    global.manualReload = () => {
        console.log('🔧 Manual reload triggered from server');
        global.triggerReload();
    };
    
    // Test function
    global.testFileChange = () => {
        const testFile = path.join(publicDir, 'styles.css');
        console.log('🧪 Testing file change detection...');
        
        const testComment = `\n/* Test ${Date.now()} */`;
        
        try {
            fs.appendFileSync(testFile, testComment);
            console.log('✅ Test change made to styles.css');
        } catch (error) {
            console.error('❌ Could not test file change:', error.message);
        }
    };
    
    // Cleanup on exit
    process.on('exit', () => {
        watchers.forEach(watcher => {
            try {
                watcher.close();
            } catch (e) {
                // Ignore cleanup errors
            }
        });
    });
    
    console.log('💡 Debug commands available:');
    console.log('   - global.manualReload() // Trigger reload manually');
    console.log('   - global.testFileChange() // Test file change detection');
    
} else {
    console.log('🔄 Live reload disabled in production mode');
    
    // Define empty function for production
    global.triggerReload = () => {
        console.log('🔄 Live reload not available in production');
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

// Enhanced URL image extraction with better debugging
// Replace the extractImageFromUrl function in your server.js

async function extractImageFromUrl(url) {
    try {
        console.log(`🔍 Starting image extraction for: ${url}`);
        
        // Validate URL
        const parsedUrl = new URL(url);
        console.log(`✅ URL parsed successfully: ${parsedUrl.origin}`);
        
        // Enhanced request with better headers and error handling
        const response = await axios.get(url, {
            timeout: 15000, // Increased timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
            maxRedirects: 10,
            validateStatus: function (status) {
                return status < 400; // Accept any status code less than 400
            }
        });

        console.log(`📡 Response received: ${response.status} ${response.statusText}`);
        console.log(`📄 Content-Type: ${response.headers['content-type']}`);
        console.log(`📊 Content length: ${response.data.length} characters`);

        const $ = cheerio.load(response.data);
        let imageUrl = null;
        const foundImages = [];

        // 1. Try Open Graph images (highest priority)
        console.log('🔍 Checking Open Graph images...');
        const ogImages = [
            $('meta[property="og:image"]').attr('content'),
            $('meta[property="og:image:url"]').attr('content'),
            $('meta[property="og:image:secure_url"]').attr('content')
        ].filter(Boolean);
        
        if (ogImages.length > 0) {
            imageUrl = ogImages[0];
            foundImages.push(`OG: ${imageUrl}`);
            console.log(`✅ Found Open Graph image: ${imageUrl}`);
        }

        // 2. Try Twitter Card images
        if (!imageUrl) {
            console.log('🔍 Checking Twitter Card images...');
            const twitterImages = [
                $('meta[name="twitter:image"]').attr('content'),
                $('meta[name="twitter:image:src"]').attr('content'),
                $('meta[property="twitter:image"]').attr('content')
            ].filter(Boolean);
            
            if (twitterImages.length > 0) {
                imageUrl = twitterImages[0];
                foundImages.push(`Twitter: ${imageUrl}`);
                console.log(`✅ Found Twitter Card image: ${imageUrl}`);
            }
        }

        // 3. Try to find large images in the page
        if (!imageUrl) {
            console.log('🔍 Scanning page for large images...');
            const images = $('img');
            console.log(`📷 Found ${images.length} img tags on page`);
            
            const candidateImages = [];
            
            images.each((i, img) => {
                const $img = $(img);
                const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
                const width = parseInt($img.attr('width')) || 0;
                const height = parseInt($img.attr('height')) || 0;
                const alt = $img.attr('alt') || '';
                
                if (src) {
                    candidateImages.push({
                        src,
                        width,
                        height,
                        alt,
                        area: width * height
                    });
                }
            });
            
            console.log(`📊 Found ${candidateImages.length} candidate images`);
            
            // Sort by area (largest first) and prioritize images with meaningful dimensions
            candidateImages.sort((a, b) => {
                // Prioritize images with explicit dimensions and large area
                if (a.area > 40000 && b.area <= 40000) return -1;
                if (b.area > 40000 && a.area <= 40000) return 1;
                return b.area - a.area;
            });
            
            // Log top candidates
            candidateImages.slice(0, 5).forEach((img, i) => {
                console.log(`📷 Candidate ${i + 1}: ${img.src} (${img.width}x${img.height}, area: ${img.area})`);
            });
            
            // Select the best candidate
            if (candidateImages.length > 0) {
                const bestImage = candidateImages[0];
                if (bestImage.area >= 10000 || (bestImage.width >= 200 || bestImage.height >= 200)) {
                    imageUrl = bestImage.src;
                    foundImages.push(`Large image: ${imageUrl} (${bestImage.width}x${bestImage.height})`);
                    console.log(`✅ Selected large image: ${imageUrl}`);
                }
            }
        }

        // 4. Try favicon as last resort
        if (!imageUrl) {
            console.log('🔍 Looking for favicon...');
            const favicons = [
                $('link[rel="apple-touch-icon"]').attr('href'),
                $('link[rel="apple-touch-icon-precomposed"]').attr('href'),
                $('link[rel="icon"][sizes="192x192"]').attr('href'),
                $('link[rel="icon"][sizes="180x180"]').attr('href'),
                $('link[rel="shortcut icon"]').attr('href'),
                $('link[rel="icon"]').attr('href')
            ].filter(Boolean);
            
            if (favicons.length > 0) {
                imageUrl = favicons[0];
                foundImages.push(`Favicon: ${imageUrl}`);
                console.log(`✅ Found favicon: ${imageUrl}`);
            }
        }

        // Convert relative URLs to absolute
        if (imageUrl) {
            const originalUrl = imageUrl;
            
            if (imageUrl.startsWith('//')) {
                imageUrl = parsedUrl.protocol + imageUrl;
            } else if (imageUrl.startsWith('/')) {
                imageUrl = parsedUrl.origin + imageUrl;
            } else if (!imageUrl.startsWith('http')) {
                // Handle relative URLs
                imageUrl = new URL(imageUrl, parsedUrl.origin).href;
            }
            
            if (originalUrl !== imageUrl) {
                console.log(`🔗 Converted relative URL: ${originalUrl} → ${imageUrl}`);
            }
        }

        // Extract additional metadata
        const title = $('title').text().trim() || 
                     $('meta[property="og:title"]').attr('content') || 
                     $('meta[name="twitter:title"]').attr('content') || '';
                     
        const description = $('meta[name="description"]').attr('content') || 
                           $('meta[property="og:description"]').attr('content') || 
                           $('meta[name="twitter:description"]').attr('content') || '';

        const result = {
            success: true,
            imageUrl: imageUrl,
            title: title.slice(0, 200), // Limit title length
            description: description.slice(0, 300), // Limit description length
            foundImages: foundImages, // Debug info
            totalImagesOnPage: $('img').length
        };

        console.log(`📊 Extraction Summary:`);
        console.log(`   • Image found: ${!!imageUrl}`);
        console.log(`   • Title: ${title.slice(0, 50)}...`);
        console.log(`   • Description: ${description.slice(0, 50)}...`);
        console.log(`   • Images checked: ${foundImages.length}`);
        console.log(`   • Total img tags: ${$('img').length}`);

        return result;

    } catch (error) {
        console.error('❌ Error extracting image from URL:', error.message);
        console.error('❌ Error details:', {
            code: error.code,
            response: error.response?.status,
            message: error.message
        });
        
        return {
            success: false,
            error: error.message,
            errorCode: error.code,
            responseStatus: error.response?.status,
            imageUrl: null
        };
    }
}

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

    // NEW: Updated archive items table with url_image column
    db.run(`CREATE TABLE IF NOT EXISTS archive_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT,
        url_image TEXT,
        tags TEXT,
        collection_id INTEGER,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (collection_id) REFERENCES collections (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`);

    // Add url_image column to existing tables (if it doesn't exist)
    db.run(`ALTER TABLE archive_items ADD COLUMN url_image TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding url_image column:', err.message);
        } else if (!err) {
            console.log('✅ Added url_image column to archive_items table');
        }
    });

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

    console.log('✅ Database initialized successfully');
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

// Simple login with username/password
app.post('/api/auth/simple-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        // Try to find user by username first, then by email as fallback
        db.get(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, username],
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

// Keep the old login route for backward compatibility if needed
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
// NEW: URL IMAGE EXTRACTION ROUTE
// ====================================

app.post('/api/extract-url-info', authenticateToken, async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log(`🔗 URL image extraction requested for: ${url}`);
        const result = await extractImageFromUrl(url);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error in extract-url-info endpoint:', error);
        res.status(500).json({ error: 'Failed to extract URL information' });
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
// ARCHIVE ITEMS ROUTES (UPDATED)
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

// NEW: Updated POST route to handle url_image
app.post('/api/items', authenticateToken, upload.array('files', 5), (req, res) => {
    const { title, description, url, url_image, tags, collection } = req.body;
    
    console.log('📝 Creating new item:', { title, hasUrlImage: !!url_image, hasFiles: req.files?.length > 0 });
    
    // Get collection ID
    db.get(
        'SELECT id FROM collections WHERE name = ?',
        [collection],
        (err, collectionRow) => {
            if (err || !collectionRow) {
                return res.status(400).json({ error: 'Invalid collection' });
            }
            
            // Insert archive item with url_image
            db.run(
                'INSERT INTO archive_items (title, description, url, url_image, tags, collection_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [title, description || '', url || '', url_image || '', tags || '', collectionRow.id, req.user.userId],
                function(err) {
                    if (err) {
                        console.error('❌ Error inserting item:', err);
                        return res.status(500).json({ error: err.message });
                    }
                    
                    const itemId = this.lastID;
                    console.log(`✅ Created item with ID: ${itemId}`);
                    
                    // Insert files if any
                    if (req.files && req.files.length > 0) {
                        console.log(`📁 Processing ${req.files.length} files...`);
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
                                console.log('✅ All files processed successfully');
                                // Return the created item with files
                                returnCreatedItem(itemId, res);
                            })
                            .catch(err => {
                                console.error('❌ Error processing files:', err);
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
                    const responseItem = {
                        ...item,
                        tags: item.tags ? item.tags.split(',').map(tag => tag.trim()) : [],
                        files: files || []
                    };
                    
                    console.log(`📤 Returning created item: ${item.title} (URL image: ${!!item.url_image})`);
                    res.status(201).json(responseItem);
                }
            );
        }
    );
}

// NEW: Updated PUT route to handle url_image
app.put('/api/items/:id', authenticateToken, (req, res) => {
    const { title, description, url, url_image, tags, collection } = req.body;
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
                 SET title = ?, description = ?, url = ?, url_image = ?, tags = ?, collection_id = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND created_by = ?`,
                [title, description || '', url || '', url_image || '', tags || '', collectionRow.id, itemId, req.user.userId],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    if (this.changes === 0) {
                        return res.status(404).json({ error: 'Item not found or unauthorized' });
                    }
                    
                    console.log(`✅ Updated item ${itemId} with URL image: ${!!url_image}`);
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
// FILE MANAGEMENT ROUTES
// ====================================

// Upload additional files to existing item
app.post('/api/items/:id/files', authenticateToken, upload.array('files', 5), (req, res) => {
    const itemId = req.params.id;
    
    // Check if item exists and user has permission
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
            
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No files provided' });
            }
            
            // Insert files into database
            const fileInserts = req.files.map(file => {
                return new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO files (item_id, filename, original_name, mimetype, size, path) VALUES (?, ?, ?, ?, ?, ?)',
                        [itemId, file.filename, file.originalname, file.mimetype, file.size, file.path],
                        function(err) {
                            if (err) reject(err);
                            else resolve({
                                id: this.lastID,
                                item_id: itemId,
                                filename: file.filename,
                                original_name: file.originalname,
                                mimetype: file.mimetype,
                                size: file.size,
                                path: file.path
                            });
                        }
                    );
                });
            });
            
            Promise.all(fileInserts)
                .then(newFiles => {
                    res.status(201).json({
                        message: `Uploaded ${newFiles.length} file(s) successfully`,
                        files: newFiles
                    });
                })
                .catch(err => {
                    console.error('Error inserting files:', err);
                    res.status(500).json({ error: 'Failed to save file information' });
                });
        }
    );
});

// Get single item with files
app.get('/api/items/:id', authenticateToken, (req, res) => {
    const itemId = req.params.id;
    
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
            
            if (!item) {
                return res.status(404).json({ error: 'Item not found' });
            }
            
            // Get files for the item
            db.all(
                'SELECT * FROM files WHERE item_id = ?',
                [itemId],
                (err, files) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    res.json({
                        ...item,
                        tags: item.tags ? item.tags.split(',').map(tag => tag.trim()) : [],
                        files: files || []
                    });
                }
            );
        }
    );
});

// Delete specific file
app.delete('/api/files/:id', authenticateToken, (req, res) => {
    const fileId = req.params.id;
    
    // Get file info and check if user owns the item
    db.get(
        `SELECT f.*, ai.created_by 
         FROM files f 
         JOIN archive_items ai ON f.item_id = ai.id 
         WHERE f.id = ?`,
        [fileId],
        (err, file) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            if (!file) {
                return res.status(404).json({ error: 'File not found' });
            }
            
            if (file.created_by !== req.user.userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            
            // Delete file from filesystem
            try {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            } catch (error) {
                console.error('Error deleting file from filesystem:', error);
            }
            
            // Delete file from database
            db.run(
                'DELETE FROM files WHERE id = ?',
                [fileId],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    res.json({ message: 'File deleted successfully' });
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
                version: '1.1', // Updated version for URL image support
                itemCount: items.length,
                features: ['file_uploads', 'url_images', 'collections', 'tags'], // NEW: Feature list
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
                features: ['url_image_extraction', 'file_uploads', 'live_reload'], // NEW: Feature list
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
    console.log(`🚀 Team Creative Archive server running on port ${PORT}`);
    console.log(`📁 Database: ${path.resolve('./team_archive.db')}`);
    console.log(`📂 Uploads: ${path.resolve('./uploads')}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
    console.log(`✨ NEW: URL image extraction enabled!`);
    
    if (isDevelopment) {
        console.log('🔄 Live reload enabled');
        console.log('💡 Use "npm run dev:watch" for full live reload experience');
    }
    
    console.log('');
    console.log('🎯 Features enabled:');
    console.log('   • 📸 URL image extraction');
    console.log('   • 📁 File uploads');
    console.log('   • 👥 Team collaboration');
    console.log('   • 🔍 Full-text search');
    console.log('   • 📤 Data export');
    if (isDevelopment) {
        console.log('   • 🔄 Live reload');
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