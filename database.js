const path = require('path');

// Check environment: Edge Config > Blob > Vercel Postgres > Vercel KV > Turso > Local SQLite
const useEdgeConfig = process.env.EDGE_CONFIG && process.env.EDGE_CONFIG_ID && process.env.VERCEL_API_TOKEN;
const useVercelPostgres = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
const useVercelKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const useTurso = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;

let db;

if (useEdgeConfig) {
  // Use Vercel Edge Config (ULTRA-FAST reads, slower writes)
  db = require('./database-edge-config');
  console.log('✓ Using Vercel Edge Config (ultra-low latency reads)');
  console.log('⚠️  Note: Writes may have slight delay due to Edge Config propagation');
  
} else if (useVercelPostgres) {
  // Use Vercel Postgres (BEST for Vercel - proper SQL database)
  db = require('./database-vercel-postgres');
  console.log('✓ Using Vercel Postgres (serverless SQL database)');
  
} else if (useVercelKV) {
  // Use Vercel KV (alternative option)
  db = require('./database-vercel-kv');
  console.log('✓ Using Vercel KV (serverless key-value store)');
  
} else if (useTurso) {
  // Use Turso for serverless deployment (Vercel)
  const { createClient } = require('@libsql/client');
  
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  
  // Initialize table
  (async () => {
    try {
      await turso.execute(`
        CREATE TABLE IF NOT EXISTS themes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL UNIQUE,
          votes INTEGER DEFAULT 0,
          completed INTEGER DEFAULT 0,
          hidden INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add hidden column if it doesn't exist (migration)
      try {
        await turso.execute(`ALTER TABLE themes ADD COLUMN hidden INTEGER DEFAULT 0`);
        console.log('✓ Added hidden column to themes table');
      } catch (error) {
        // Column already exists, ignore error
      }
      console.log('✓ Using Turso database (serverless)');
    } catch (error) {
      console.error('Turso initialization error:', error);
    }
  })();
  
  // Wrap Turso client to match better-sqlite3 API
  db = {
    prepare: (sql) => ({
      all: async (...params) => {
        const result = await turso.execute({ sql, args: params });
        return result.rows;
      },
      get: async (...params) => {
        const result = await turso.execute({ sql, args: params });
        return result.rows[0];
      },
      run: async (...params) => {
        const result = await turso.execute({ sql, args: params });
        return { 
          changes: result.rowsAffected,
          lastInsertRowid: result.lastInsertRowid 
        };
      }
    })
  };
  
} else {
  // Use local SQLite for development
  try {
    const Database = require('better-sqlite3');
    db = new Database(path.join(__dirname, 'themes.db'));
    
    // Create themes table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS themes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL UNIQUE,
        votes INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        hidden INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add hidden column if it doesn't exist (migration)
    try {
      db.exec(`ALTER TABLE themes ADD COLUMN hidden INTEGER DEFAULT 0`);
      console.log('✓ Added hidden column to themes table');
    } catch (error) {
      // Column already exists, ignore error
      if (!error.message.includes('duplicate column name')) {
        console.error('Migration warning:', error.message);
      }
    }
    
    console.log('✓ Using local SQLite database');
  } catch (error) {
    console.error('❌ CRITICAL: No database configured!');
    console.error('For local development: Install Node.js and run "npm install"');
    console.error('For Vercel deployment: Set up Vercel KV or Turso database');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = db;

