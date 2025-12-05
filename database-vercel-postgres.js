const { sql } = require('@vercel/postgres');

// Vercel Postgres adapter for the voting system
// Uses actual SQL queries - much simpler than KV!

// Initialize table on first connection
let tableInitialized = false;

async function initializeTable() {
  if (tableInitialized) return;
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS themes (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL UNIQUE,
        votes INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        hidden INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Add hidden column if it doesn't exist (migration)
    try {
      await sql`ALTER TABLE themes ADD COLUMN hidden INTEGER DEFAULT 0`;
      console.log('✓ Added hidden column to themes table');
    } catch (error) {
      // Column already exists, ignore error
    }
    
    console.log('✓ Vercel Postgres table initialized');
    tableInitialized = true;
  } catch (error) {
    console.error('Error initializing Postgres table:', error);
  }
}

// Adapter to match our existing API
const postgresDb = {
  prepare: (query) => ({
    all: async (...params) => {
      await initializeTable();
      
      // Convert SQLite placeholders (?) to Postgres ($1, $2, etc.)
      const pgQuery = query.replace(/\?/g, (match, offset, string) => {
        const count = (string.substring(0, offset).match(/\?/g) || []).length;
        return `$${count + 1}`;
      });
      
      try {
        if (query.includes('SELECT')) {
          const result = await sql.query(pgQuery, params);
          return result.rows;
        }
        return [];
      } catch (error) {
        console.error('Postgres query error:', error);
        throw error;
      }
    },
    
    get: async (...params) => {
      await initializeTable();
      
      // Convert SQLite placeholders to Postgres
      const pgQuery = query.replace(/\?/g, (match, offset, string) => {
        const count = (string.substring(0, offset).match(/\?/g) || []).length;
        return `$${count + 1}`;
      });
      
      try {
        const result = await sql.query(pgQuery, params);
        return result.rows[0] || null;
      } catch (error) {
        console.error('Postgres query error:', error);
        return null;
      }
    },
    
    run: async (...params) => {
      await initializeTable();
      
      // Convert SQLite placeholders to Postgres
      let pgQuery = query.replace(/\?/g, (match, offset, string) => {
        const count = (string.substring(0, offset).match(/\?/g) || []).length;
        return `$${count + 1}`;
      });
      
      // Handle RETURNING clause for INSERT/UPDATE
      let returning = false;
      if (query.includes('INSERT') || query.includes('UPDATE')) {
        if (!pgQuery.includes('RETURNING')) {
          pgQuery += ' RETURNING id';
          returning = true;
        }
      }
      
      try {
        const result = await sql.query(pgQuery, params);
        
        return {
          changes: result.rowCount || 0,
          lastInsertRowid: returning && result.rows[0] ? result.rows[0].id : null
        };
      } catch (error) {
        // Handle unique constraint errors
        if (error.code === '23505') {
          const err = new Error('UNIQUE constraint failed');
          err.code = 'SQLITE_CONSTRAINT_UNIQUE';
          throw err;
        }
        console.error('Postgres run error:', error);
        throw error;
      }
    }
  })
};

module.exports = postgresDb;

