# 🎨 Singulars Theme Voting System

A beautiful, real-time voting system for theme suggestions. No login required - just simple, elegant voting.

## ✨ Features

- **No Authentication Required** - Users can immediately start voting and adding themes
- **Real-time Updates** - See votes update instantly
- **Character Limit** - Themes limited to 50 characters for conciseness
- **Duplicate Prevention** - System prevents duplicate themes
- **Beautiful UI/UX** - Modern, responsive design with smooth animations
- **Secure Admin Panel** - Manage themes with a hard-to-guess URL
- **Persistent Storage** - SQLite database keeps all data safe

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Main voting page: `http://localhost:3000`
   - Admin panel: `http://localhost:3000/admin/a7f3e9b2-4d8c-4a1e-9f6b-3c7d2e8a5b4f`

## 🔐 Admin Panel

The admin panel is accessible via a secure, hard-to-guess URL:

```
http://localhost:3000/admin/a7f3e9b2-4d8c-4a1e-9f6b-3c7d2e8a5b4f
```

**⚠️ IMPORTANT: Keep this URL secret!**

### Admin Capabilities

- ✏️ **Edit Themes** - Modify existing theme text
- 🗑️ **Delete Themes** - Remove unwanted themes
- ➕ **Add Themes** - Create new themes directly
- 📊 **View Statistics** - See total themes and votes

### Changing the Admin Token

For production, set a custom admin token using an environment variable:

```bash
ADMIN_TOKEN=your-custom-secure-token npm start
```

Or create a `.env` file:
```
ADMIN_TOKEN=your-custom-secure-token
```

Then access admin panel at:
```
http://localhost:3000/admin/your-custom-secure-token
```

## 📁 Project Structure

```
singulars-theme-voting/
├── public/
│   ├── index.html      # Main voting page
│   ├── admin.html      # Admin panel
│   ├── script.js       # Main page logic
│   ├── admin.js        # Admin panel logic
│   └── styles.css      # All styling
├── server.js           # Express server & API
├── database.js         # SQLite setup
├── themes.db           # SQLite database (auto-generated)
├── package.json        # Dependencies
└── README.md           # This file
```

## 🔧 API Endpoints

### Public Endpoints

- `GET /api/themes` - Get all themes (sorted by votes)
- `POST /api/themes` - Add a new theme
- `POST /api/themes/:id/upvote` - Upvote a theme

### Admin Endpoints (Require X-Admin-Token header)

- `PUT /api/admin/themes/:id` - Update a theme
- `DELETE /api/admin/themes/:id` - Delete a theme

## 🎨 User Experience Features

### Main Voting Page

- **Character Counter** - Real-time character count with warning at 45+ chars
- **Instant Feedback** - Success/error messages for all actions
- **Smooth Animations** - Cards slide in, votes pulse, highlights flash
- **Vote Sorting** - Themes automatically sorted by votes
- **Responsive Design** - Works beautifully on mobile, tablet, and desktop
- **Empty States** - Clear messaging when no themes exist
- **Duplicate Prevention** - Friendly error if theme already exists

### Admin Panel

- **Statistics Dashboard** - See total themes and votes at a glance
- **Inline Editing** - Edit themes without navigating away
- **Confirmation Dialogs** - Prevent accidental deletions
- **Full CRUD Operations** - Create, Read, Update, Delete
- **Same Beautiful UI** - Consistent design across all pages

## 🚀 Deployment

### Deploy to Production

1. **Set a secure admin token:**
   ```bash
   export ADMIN_TOKEN=$(uuidgen)
   ```

2. **Use a process manager:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name theme-voting
   ```

3. **Set up a reverse proxy** (nginx example):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Environment Variables

- `PORT` - Server port (default: 3000)
- `ADMIN_TOKEN` - Admin panel access token (default: a7f3e9b2-4d8c-4a1e-9f6b-3c7d2e8a5b4f)

## 🔒 Security Considerations

1. **Admin Token** - Always use a strong, unique token in production
2. **HTTPS** - Use HTTPS in production to protect the admin token
3. **Rate Limiting** - Consider adding rate limiting for production use
4. **Backup Database** - Regularly backup `themes.db`
5. **Environment Variables** - Never commit sensitive tokens to git

## 🛠️ Customization

### Change Colors

Edit CSS variables in `public/styles.css`:

```css
:root {
    --primary: #667eea;        /* Main purple */
    --primary-dark: #5568d3;   /* Darker purple */
    --secondary: #764ba2;       /* Secondary purple */
    /* ... more variables */
}
```

### Change Character Limit

Edit validation in `server.js`:

```javascript
if (trimmedContent.length > 50) {  // Change 50 to your limit
    return res.status(400).json({ error: 'Theme must be XX characters or less' });
}
```

And update HTML `maxlength` attribute in both `index.html` and `admin.html`.

## 📊 Database Schema

```sql
CREATE TABLE themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL UNIQUE,
    votes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🐛 Troubleshooting

**Issue**: Port 3000 already in use  
**Solution**: Set a different port: `PORT=3001 npm start`

**Issue**: Database locked  
**Solution**: Close any other processes accessing the database

**Issue**: Themes not appearing  
**Solution**: Check browser console for errors, ensure server is running

**Issue**: Admin panel shows "Unauthorized"  
**Solution**: Verify you're using the correct admin token in the URL

## 📝 License

MIT License - Feel free to use this project however you'd like!

## 🎉 Enjoy!

Your theme voting system is ready to go. Share the main URL with your users and keep the admin URL safe!

---

**Need help?** Check the code comments or inspect the browser console for detailed error messages.

