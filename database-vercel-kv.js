const { kv } = require('@vercel/kv');

// Vercel KV adapter for the voting system
// Stores themes as a sorted set with votes as scores

const kvDb = {
  prepare: (sql) => ({
    all: async () => {
      // Get all themes
      if (sql.includes('SELECT') && sql.includes('ORDER BY votes')) {
        // Get all theme IDs sorted by votes
        const themeIds = await kv.zrange('themes:by_votes', 0, -1, { rev: true });
        
        if (!themeIds || themeIds.length === 0) {
          return [];
        }
        
        // Get full theme data for each ID
        const themes = await Promise.all(
          themeIds.map(async (id) => {
            const theme = await kv.hgetall(`theme:${id}`);
            return {
              id: parseInt(id),
              content: theme.content,
              votes: parseInt(theme.votes) || 0,
              created_at: theme.created_at,
              updated_at: theme.updated_at
            };
          })
        );
        
        return themes;
      }
      return [];
    },
    
    get: async (...params) => {
      // Get single theme by ID
      const id = params[0];
      if (!id) return null;
      
      const theme = await kv.hgetall(`theme:${id}`);
      if (!theme || !theme.content) return null;
      
      return {
        id: parseInt(id),
        content: theme.content,
        votes: parseInt(theme.votes) || 0,
        created_at: theme.created_at,
        updated_at: theme.updated_at
      };
    },
    
    run: async (...params) => {
      const sql = this._sql || '';
      
      // INSERT
      if (sql.includes('INSERT INTO themes')) {
        const content = params[0];
        
        // Check for duplicates
        const allThemes = await kv.zrange('themes:by_votes', 0, -1);
        for (const themeId of allThemes || []) {
          const existing = await kv.hget(`theme:${themeId}`, 'content');
          if (existing === content) {
            const error = new Error('UNIQUE constraint failed');
            error.message = 'UNIQUE constraint failed';
            throw error;
          }
        }
        
        // Generate new ID
        const id = await kv.incr('themes:next_id');
        const now = new Date().toISOString();
        
        // Store theme data
        await kv.hset(`theme:${id}`, {
          content,
          votes: 0,
          completed: 0,
          archived: 0,
          created_at: now,
          updated_at: now
        });
        
        // Add to sorted set (score = votes)
        await kv.zadd('themes:by_votes', { score: 0, member: id.toString() });
        
        return { 
          changes: 1, 
          lastInsertRowid: id 
        };
      }
      
      // UPDATE votes
      if (sql.includes('UPDATE themes') && sql.includes('votes = votes + 1')) {
        const id = params[0];
        const theme = await kv.hgetall(`theme:${id}`);
        
        if (!theme || !theme.content) {
          return { changes: 0 };
        }
        
        const newVotes = (parseInt(theme.votes) || 0) + 1;
        const now = new Date().toISOString();
        
        await kv.hset(`theme:${id}`, {
          ...theme,
          votes: newVotes,
          updated_at: now
        });
        
        // Update sorted set score
        await kv.zadd('themes:by_votes', { score: newVotes, member: id.toString() });
        
        return { changes: 1 };
      }
      
      // UPDATE content (admin)
      if (sql.includes('UPDATE themes') && sql.includes('SET content = ?')) {
        const content = params[0];
        const id = params[1];
        const theme = await kv.hgetall(`theme:${id}`);
        
        if (!theme || !theme.content) {
          return { changes: 0 };
        }
        
        // Check for duplicates
        const allThemes = await kv.zrange('themes:by_votes', 0, -1);
        for (const themeId of allThemes || []) {
          if (themeId.toString() === id.toString()) continue;
          const existing = await kv.hget(`theme:${themeId}`, 'content');
          if (existing === content) {
            const error = new Error('UNIQUE constraint failed');
            error.message = 'UNIQUE constraint failed';
            throw error;
          }
        }
        
        const now = new Date().toISOString();
        
        await kv.hset(`theme:${id}`, {
          ...theme,
          content,
          updated_at: now
        });
        
        return { changes: 1 };
      }
      
      // DELETE
      if (sql.includes('DELETE FROM themes')) {
        const id = params[0];
        const theme = await kv.hgetall(`theme:${id}`);
        
        if (!theme || !theme.content) {
          return { changes: 0 };
        }
        
        await kv.del(`theme:${id}`);
        await kv.zrem('themes:by_votes', id.toString());
        
        return { changes: 1 };
      }
      
      return { changes: 0 };
    }
  })
};

// Store SQL for run method
kvDb.prepare = function(sql) {
  const stmt = {
    _sql: sql,
    all: async () => {
      if (sql.includes('SELECT') && sql.includes('ORDER BY votes')) {
        const themeIds = await kv.zrange('themes:by_votes', 0, -1, { rev: true });
        
        if (!themeIds || themeIds.length === 0) {
          return [];
        }
        
        const themes = await Promise.all(
          themeIds.map(async (id) => {
            const theme = await kv.hgetall(`theme:${id}`);
            if (!theme || !theme.content) return null;
            
            // Normalize archived value (migrate from hidden if needed)
            let archivedValue = theme.archived !== undefined ? theme.archived : (theme.hidden !== undefined ? theme.hidden : 0);
            archivedValue = archivedValue === null || archivedValue === undefined ? 0 : (parseInt(archivedValue) || 0);
            
            return {
              id: parseInt(id),
              content: theme.content,
              votes: parseInt(theme.votes) || 0,
              completed: parseInt(theme.completed) || 0,
              archived: archivedValue,
              created_at: theme.created_at,
              updated_at: theme.updated_at
            };
          })
        );
        
        return themes.filter(t => t !== null);
      }
      return [];
    },
    
    get: async (...params) => {
      const id = params[0];
      if (!id) return null;
      
      const theme = await kv.hgetall(`theme:${id}`);
      if (!theme || !theme.content) return null;
      
      // Normalize archived value (migrate from hidden if needed)
      let archivedValue = theme.archived !== undefined ? theme.archived : (theme.hidden !== undefined ? theme.hidden : 0);
      archivedValue = archivedValue === null || archivedValue === undefined ? 0 : (parseInt(archivedValue) || 0);
      
      return {
        id: parseInt(id),
        content: theme.content,
        votes: parseInt(theme.votes) || 0,
        completed: parseInt(theme.completed) || 0,
        archived: archivedValue,
        created_at: theme.created_at,
        updated_at: theme.updated_at
      };
    },
    
    run: async (...params) => {
      // INSERT
      if (sql.includes('INSERT INTO themes')) {
        const content = params[0];
        
        // Check for duplicates
        const allThemes = await kv.zrange('themes:by_votes', 0, -1);
        for (const themeId of allThemes || []) {
          const existing = await kv.hget(`theme:${themeId}`, 'content');
          if (existing === content) {
            const error = new Error('UNIQUE constraint failed');
            error.message = 'UNIQUE constraint failed';
            throw error;
          }
        }
        
        // Generate new ID
        const id = await kv.incr('themes:next_id');
        const now = new Date().toISOString();
        
        // Store theme data
        await kv.hset(`theme:${id}`, {
          content,
          votes: 0,
          created_at: now,
          updated_at: now
        });
        
        // Add to sorted set
        await kv.zadd('themes:by_votes', { score: 0, member: id.toString() });
        
        return { 
          changes: 1, 
          lastInsertRowid: id 
        };
      }
      
      // UPDATE votes
      if (sql.includes('UPDATE themes') && sql.includes('votes = votes + 1')) {
        const id = params[0];
        const theme = await kv.hgetall(`theme:${id}`);
        
        if (!theme || !theme.content) {
          return { changes: 0 };
        }
        
        const newVotes = (parseInt(theme.votes) || 0) + 1;
        const now = new Date().toISOString();
        
        await kv.hset(`theme:${id}`, {
          ...theme,
          votes: newVotes,
          updated_at: now
        });
        
        await kv.zadd('themes:by_votes', { score: newVotes, member: id.toString() });
        
        return { changes: 1 };
      }
      
      // UPDATE content
      if (sql.includes('UPDATE themes') && sql.includes('SET content = ?')) {
        const content = params[0];
        const id = params[1];
        const theme = await kv.hgetall(`theme:${id}`);
        
        if (!theme || !theme.content) {
          return { changes: 0 };
        }
        
        // Check for duplicates
        const allThemes = await kv.zrange('themes:by_votes', 0, -1);
        for (const themeId of allThemes || []) {
          if (themeId.toString() === id.toString()) continue;
          const existing = await kv.hget(`theme:${themeId}`, 'content');
          if (existing === content) {
            const error = new Error('UNIQUE constraint failed');
            error.message = 'UNIQUE constraint failed';
            throw error;
          }
        }
        
        const now = new Date().toISOString();
        
        await kv.hset(`theme:${id}`, {
          ...theme,
          content,
          updated_at: now
        });
        
        return { changes: 1 };
      }
      
      // UPDATE completed status
      if (sql.includes('UPDATE themes') && sql.includes('SET completed = ?')) {
        const completed = params[0];
        const id = params[1];
        const theme = await kv.hgetall(`theme:${id}`);
        
        if (!theme || !theme.content) {
          return { changes: 0 };
        }
        
        const now = new Date().toISOString();
        
        await kv.hset(`theme:${id}`, {
          ...theme,
          completed,
          updated_at: now
        });
        
        return { changes: 1 };
      }
      
      // UPDATE archived status
      if (sql.includes('UPDATE themes') && sql.includes('SET archived = ?')) {
        const archived = params[0];
        const id = params[1];
        const theme = await kv.hgetall(`theme:${id}`);
        
        if (!theme || !theme.content) {
          return { changes: 0 };
        }
        
        const now = new Date().toISOString();
        
        await kv.hset(`theme:${id}`, {
          ...theme,
          archived,
          updated_at: now
        });
        
        return { changes: 1 };
      }
      
      // DELETE
      if (sql.includes('DELETE FROM themes')) {
        const id = params[0];
        const theme = await kv.hgetall(`theme:${id}`);
        
        if (!theme || !theme.content) {
          return { changes: 0 };
        }
        
        await kv.del(`theme:${id}`);
        await kv.zrem('themes:by_votes', id.toString());
        
        return { changes: 1 };
      }
      
      return { changes: 0 };
    }
  };
  
  return stmt;
};

module.exports = kvDb;

