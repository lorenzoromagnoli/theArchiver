# Team Creative Archive

A simple, focused creative content archive platform built for small internal teams. Store, organize, and share design inspiration, research, resources, and team work.

![Team Creative Archive](https://img.shields.io/badge/version-1.0.0-blue) ![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-green) ![SQLite](https://img.shields.io/badge/database-SQLite-blue)

## ✨ Features

- **📁 Collections**: Organize content into Inspiration, Design, Research, and Resources
- **🔍 Search**: Full-text search across titles, descriptions, and tags
- **📎 File Uploads**: Support for images, documents, and videos (10MB max)
- **👥 Team Collaboration**: Multi-user support with authentication
- **📤 Export**: Download your entire archive as JSON
- **🏃‍♂️ Fast Setup**: SQLite database - no external dependencies
- **📱 Responsive**: Works on desktop, tablet, and mobile

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- Git (optional)

### Installation

1. **Create project directory**
   ```bash
   mkdir team-creative-archive
   cd team-creative-archive
   ```

2. **Copy all the files** from the artifacts above into your project directory:
   ```
   team-creative-archive/
   ├── package.json
   ├── server.js
   ├── .env.example
   ├── .gitignore
   ├── public/
   │   ├── index.html
   │   └── js/
   │       ├── api.js
   │       ├── auth.js
   │       ├── archive.js
   │       └── app.js
   └── scripts/
       ├── init-db.js
       └── seed.js
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env if needed (optional for development)
   ```

5. **Initialize database**
   ```bash
   npm run init-db
   ```

6. **Add sample data** (optional)
   ```bash
   npm run seed
   ```

7. **Start the server**
   ```bash
   npm start
   ```

8. **Open your archive**
   - Navigate to `http://localhost:3001`
   - Login with: `demo@team.com` / `demo123`
   - Or create a new account

## 👥 Default Users

After running `npm run init-db`, you'll have these accounts:

- **Admin**: `admin@team.com` / `admin123`
- **Demo**: `demo@team.com` / `demo123`

## 📁 Project Structure

```
team-creative-archive/
├── server.js              # Main backend server
├── package.json           # Dependencies and scripts
├── team_archive.db        # SQLite database (auto-created)
├── .env                   # Environment configuration
├── public/                # Frontend application
│   ├── index.html         # Main HTML file
│   └── js/               # JavaScript modules
│       ├── api.js         # API client
│       ├── auth.js        # Authentication
│       ├── archive.js     # Archive management
│       └── app.js         # Main application
├── uploads/               # User uploaded files
├── scripts/              # Database utilities
│   ├── init-db.js        # Database initialization
│   └── seed.js           # Sample data
└── logs/                 # Application logs
```

## 🛠️ Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with auto-reload
npm run init-db    # Initialize database with default users
npm run seed       # Add sample data to archive
```

## 🎨 Usage

### Adding Content
1. Click **"+ Add Item"** button
2. Fill in title, description, tags
3. Select a collection (Inspiration, Design, Research, Resources)
4. Add files by clicking or dragging & dropping
5. Add a URL for external references
6. Click **"Add Item"**

### Organizing Content
- **Collections**: Use the sidebar to filter by collection type
- **Tags**: Add descriptive tags when creating items (comma-separated)
- **Search**: Use the search bar to find content across all fields

### Team Collaboration
- All team members can add and view content
- Users can edit/delete their own items
- Admins have additional permissions

### Exporting Data
- Click **"📤 Export"** to download all your archive data
- Exports as JSON with full metadata
- Files need to be backed up separately

## 🔧 Customization

### Adding New Collections
Edit the collections in `scripts/init-db.js`:

```javascript
await runQuery(`INSERT OR IGNORE INTO collections (id, name, icon, color) VALUES 
    (5, 'Client Work', '👥', '#e74c3c'),
    (6, 'Tools', '🛠️', '#f39c12')`);
```

### Changing File Limits
In `server.js`, modify the multer configuration:

```javascript
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // Change to 50MB
    }
});
```

### Adding File Types
Update the file filter in `server.js`:

```javascript
const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|mov|avi|psd|ai|sketch/;
```

## 🚀 Deployment

### Simple Server Deployment
```bash
# Copy files to your server
scp -r team-creative-archive/ user@yourserver:/var/www/

# Install dependencies and start
cd /var/www/team-creative-archive
npm install --production
npm start
```

### Docker Deployment
```bash
# Create Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]

# Build and run
docker build -t team-archive .
docker run -p 3001:3001 -v $(pwd)/data:/app team-archive
```

### Environment Variables for Production
```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-very-long-random-secret-key-here
```

## 💾 Backup & Restore

### Database Backup
```bash
# Backup database
cp team_archive.db backup_$(date +%Y%m%d).db

# Backup uploaded files
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
```

### Automated Backup Script
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d)
mkdir -p backups
cp team_archive.db backups/db_$DATE.db
tar -czf backups/uploads_$DATE.tar.gz uploads/
echo "Backup completed: $DATE"
```

## 🔍 Troubleshooting

### Common Issues

**Database locked error**
```bash
# Stop server and try again
pkill -f "node server.js"
npm start
```

**File upload not working**
```bash
# Check uploads directory permissions
chmod 755 uploads/
```

**Port already in use**
```bash
# Change port in .env or kill existing process
echo "PORT=3002" >> .env
# or
lsof -ti:3001 | xargs kill -9
```

**Module not found errors**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 📝 Development

### Tech Stack
- **Backend**: Node.js, Express, SQLite
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Authentication**: JWT tokens
- **File Upload**: Multer
- **Database**: SQLite3

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use this for your team!

## 🆘 Support

Having issues? Here are some resources:

1. **Check the logs**: Look in the `logs/` directory
2. **Database issues**: Try `npm run init-db` to reset
3. **Permission errors**: Check file permissions with `ls -la`
4. **Port conflicts**: Change the PORT in your `.env` file

## 🎯 Roadmap

Future enhancements we're considering:
- [ ] Advanced tagging system
- [ ] File versioning
- [ ] Team permissions
- [ ] API documentation
- [ ] Bulk import/export
- [ ] Advanced search filters
- [ ] Activity feed
- [ ] Email notifications

---

**Happy archiving!** 🎨📚✨