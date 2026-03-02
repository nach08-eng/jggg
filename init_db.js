const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const sql = `
CREATE TABLE IF NOT EXISTS books (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  language TEXT,
  year INTEGER,
  subjects TEXT[],
  file_url TEXT NOT NULL,
  cover_image TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function init() {
    try {
        console.log('Connecting to PostgreSQL...');
        const client = await pool.connect();
        console.log('Connected. Running SQL...');
        await client.query(sql);
        console.log('Table "books" created or already exists.');
        client.release();
    } catch (err) {
        console.error('Error initializing database:', err);
    } finally {
        await pool.end();
    }
}

init();
