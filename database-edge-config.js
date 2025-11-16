const { get } = require('@vercel/edge-config');

// Edge Config adapter for theme voting system
// CREATIVE SOLUTION: Store all themes as single JSON object
// TRADEOFF: Ultra-fast reads, slower writes (requires Vercel API)

let themesCache = null;
let cacheTime = 0;
const CACHE_TTL = 1000; // 1 second cache

// Get themes from Edge Config
async function getThemesData() {
  // Use short-term cache to reduce Edge Config reads
  if (themesCache && Date.now() - cacheTime < CACHE_TTL) {
    return themesCache;
  }
  
  try {
    const data = await get('themes');
    themesCache = data || { themes: [], nextId: 1 };
    cacheTime = Date.now();
    return themesCache;
  } catch (error) {
    console.error('Edge Config read error:', error);
    return { themes: [], nextId: 1 };
  }
}

// Update themes in Edge Config via Vercel API
async function updateThemesData(newData) {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const vercelToken = process.env.VERCEL_API_TOKEN;
  
  if (!edgeConfigId || !vercelToken) {
    console.error('⚠️  EDGE_CONFIG_ID or VERCEL_API_TOKEN not set - updates will fail!');
    throw new Error('Edge Config credentials missing');
  }
  
  try {
    // Use Vercel API to update Edge Config
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              operation: 'update',
              key: 'themes',
              value: newData
            }
          ]
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Edge Config update failed: ${error}`);
    }
    
    // Update cache
    themesCache = newData;
    cacheTime = Date.now();
    
    return true;
  } catch (error) {
    console.error('Edge Config write error:', error);
    throw error;
  }
}

// Adapter to match our existing database API
const edgeConfigDb = {
  prepare: (sql) => ({
    all: async (...params) => {
      const data = await getThemesData();
      
      if (sql.includes('SELECT') && sql.includes('ORDER BY votes')) {
        // Return all themes sorted by votes
        return data.themes.sort((a, b) => b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at));
      }
      
      return data.themes;
    },
    
    get: async (...params) => {
      const data = await getThemesData();
      const id = params[0];
      
      if (!id) return null;
      
      return data.themes.find(t => t.id === parseInt(id)) || null;
    },
    
    run: async (...params) => {
      const data = await getThemesData();
      
      // INSERT new theme
      if (sql.includes('INSERT INTO themes')) {
        const content = params[0];
        
        // Check for duplicates
        if (data.themes.some(t => t.content === content)) {
          const error = new Error('UNIQUE constraint failed');
          error.code = 'SQLITE_CONSTRAINT_UNIQUE';
          throw error;
        }
        
        // Create new theme
        const newTheme = {
          id: data.nextId,
          content,
          votes: 0,
          completed: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        data.themes.push(newTheme);
        data.nextId++;
        
        await updateThemesData(data);
        
        return {
          changes: 1,
          lastInsertRowid: newTheme.id
        };
      }
      
      // UPDATE votes
      if (sql.includes('UPDATE themes') && sql.includes('votes = votes + 1')) {
        const id = parseInt(params[0]);
        const theme = data.themes.find(t => t.id === id);
        
        if (!theme) {
          return { changes: 0 };
        }
        
        theme.votes++;
        theme.updated_at = new Date().toISOString();
        
        await updateThemesData(data);
        
        return { changes: 1 };
      }
      
      // UPDATE content (admin)
      if (sql.includes('UPDATE themes') && sql.includes('SET content = ?')) {
        const content = params[0];
        const id = parseInt(params[1]);
        const theme = data.themes.find(t => t.id === id);
        
        if (!theme) {
          return { changes: 0 };
        }
        
        // Check for duplicates
        if (data.themes.some(t => t.id !== id && t.content === content)) {
          const error = new Error('UNIQUE constraint failed');
          error.code = 'SQLITE_CONSTRAINT_UNIQUE';
          throw error;
        }
        
        theme.content = content;
        theme.updated_at = new Date().toISOString();
        
        await updateThemesData(data);
        
        return { changes: 1 };
      }
      
      // UPDATE completed status
      if (sql.includes('UPDATE themes') && sql.includes('SET completed = ?')) {
        const completed = parseInt(params[0]);
        const id = parseInt(params[1]);
        const theme = data.themes.find(t => t.id === id);
        
        if (!theme) {
          return { changes: 0 };
        }
        
        theme.completed = completed;
        theme.updated_at = new Date().toISOString();
        
        await updateThemesData(data);
        
        return { changes: 1 };
      }
      
      // DELETE theme
      if (sql.includes('DELETE FROM themes')) {
        const id = parseInt(params[0]);
        const index = data.themes.findIndex(t => t.id === id);
        
        if (index === -1) {
          return { changes: 0 };
        }
        
        data.themes.splice(index, 1);
        
        await updateThemesData(data);
        
        return { changes: 1 };
      }
      
      return { changes: 0 };
    }
  })
};

module.exports = edgeConfigDb;

