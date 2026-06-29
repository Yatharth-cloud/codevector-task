require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const CATEGORIES = [
  'Electronics', 'Clothing', 'Books', 'Home & Kitchen',
  'Sports', 'Toys', 'Beauty', 'Automotive', 'Garden', 'Food'
];

function randomCategory() {
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

function randomPrice() {
  return (Math.random() * 9900 + 100).toFixed(2);
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Creating table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    console.log('Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category_created_id
      ON products (category, created_at DESC, id DESC)
    `);

    console.log('Seeding 200,000 products...');

    const BATCH_SIZE = 1000;
    const TOTAL = 200000;
    const start = new Date('2023-01-01');
    const end = new Date();

    for (let i = 0; i < TOTAL / BATCH_SIZE; i++) {
      const values = [];
      const placeholders = [];

      for (let j = 0; j < BATCH_SIZE; j++) {
        const idx = i * BATCH_SIZE + j;
        const category = randomCategory();
        const price = randomPrice();
        const created_at = randomDate(start, end);
        const updated_at = randomDate(created_at, end);
        const name = `Product_${idx + 1}`;

        const base = j * 5;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
        values.push(name, category, price, created_at, updated_at);
      }

      await client.query(
        `INSERT INTO products (name, category, price, created_at, updated_at) VALUES ${placeholders.join(',')}`,
        values
      );

      if ((i + 1) % 10 === 0) {
        console.log(`Inserted ${(i + 1) * BATCH_SIZE} rows...`);
      }
    }

    console.log('Done! 200,000 products seeded.');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();