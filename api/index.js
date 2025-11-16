const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const app = express();

// Generate a secure admin token (this will be consistent across restarts)
// In production, you'd want to store this in environment variables
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'a7f3e9b2-4d8c-4a1e-9f6b-3c7d2e8a5b4f';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes

// Get all themes (sorted by votes, then by date)
app.get('/api/themes', async (req, res) => {
  try {
    const themes = await db.prepare(`
      SELECT id, content, votes, completed, created_at, updated_at 
      FROM themes 
      ORDER BY votes DESC, created_at ASC
    `).all();
    res.json(themes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

// Add a new theme
app.post('/api/themes', async (req, res) => {
  try {
    const { content } = req.body;
    
    // Validation
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Theme content is required' });
    }
    
    const trimmedContent = content.trim();
    
    if (trimmedContent.length === 0) {
      return res.status(400).json({ error: 'Theme cannot be empty' });
    }
    
    if (trimmedContent.length > 50) {
      return res.status(400).json({ error: 'Theme must be 50 characters or less' });
    }
    
    // Insert theme
    const stmt = db.prepare('INSERT INTO themes (content) VALUES (?)');
    const result = await stmt.run(trimmedContent);
    
    // Get the newly created theme
    const newTheme = await db.prepare('SELECT * FROM themes WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json(newTheme);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'This theme already exists' });
    } else {
      res.status(500).json({ error: 'Failed to add theme' });
    }
  }
});

// Upvote a theme
app.post('/api/themes/:id/upvote', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update vote count
    const stmt = db.prepare(`
      UPDATE themes 
      SET votes = votes + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    const result = await stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    // Get updated theme
    const updatedTheme = await db.prepare('SELECT * FROM themes WHERE id = ?').get(id);
    res.json(updatedTheme);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upvote theme' });
  }
});

// Admin middleware
const requireAdmin = (req, res, next) => {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

// Admin: Update a theme
app.put('/api/admin/themes/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Theme content is required' });
    }
    
    const trimmedContent = content.trim();
    
    if (trimmedContent.length === 0) {
      return res.status(400).json({ error: 'Theme cannot be empty' });
    }
    
    if (trimmedContent.length > 50) {
      return res.status(400).json({ error: 'Theme must be 50 characters or less' });
    }
    
    const stmt = db.prepare(`
      UPDATE themes 
      SET content = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    const result = await stmt.run(trimmedContent, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    const updatedTheme = await db.prepare('SELECT * FROM themes WHERE id = ?').get(id);
    res.json(updatedTheme);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'This theme already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update theme' });
    }
  }
});

// Admin: Toggle theme completed status
app.patch('/api/admin/themes/:id/toggle-complete', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get current theme
    const currentTheme = await db.prepare('SELECT * FROM themes WHERE id = ?').get(id);
    
    if (!currentTheme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    // Toggle completed status (0 -> 1, 1 -> 0)
    const newCompleted = currentTheme.completed ? 0 : 1;
    
    const stmt = db.prepare(`
      UPDATE themes 
      SET completed = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    await stmt.run(newCompleted, id);
    
    const updatedTheme = await db.prepare('SELECT * FROM themes WHERE id = ?').get(id);
    res.json(updatedTheme);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle theme completion' });
  }
});

// Admin: Delete a theme
app.delete('/api/admin/themes/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare('DELETE FROM themes WHERE id = ?');
    const result = await stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    res.json({ message: 'Theme deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete theme' });
  }
});

// Serve admin page
app.get('/admin/:token', (req, res) => {
  if (req.params.token === ADMIN_TOKEN) {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
  } else {
    res.status(403).send('Unauthorized');
  }
});

// Root route - serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Export for Vercel serverless function
module.exports = app;

