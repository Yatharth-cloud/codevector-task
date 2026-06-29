const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// GET /api/products?limit=20&category=Electronics&cursor=eyJ...
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const category = req.query.category || null;
    const cursorParam = req.query.cursor || null;

    let cursorCreatedAt = null;
    let cursorId = null;

    if (cursorParam) {
      try {
        const decoded = JSON.parse(Buffer.from(cursorParam, 'base64').toString('utf8'));
        cursorCreatedAt = decoded.created_at;
        cursorId = decoded.id;
      } catch {
        return res.status(400).json({ error: 'Invalid cursor' });
      }
    }

    let query;
    let params;

    if (category && cursorCreatedAt) {
      query = `
        SELECT id, name, category, price, created_at, updated_at
        FROM products
        WHERE category = $1
          AND (created_at, id) < ($2, $3)
        ORDER BY created_at DESC, id DESC
        LIMIT $4
      `;
      params = [category, cursorCreatedAt, cursorId, limit];
    } else if (category) {
      query = `
        SELECT id, name, category, price, created_at, updated_at
        FROM products
        WHERE category = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
      `;
      params = [category, limit];
    } else if (cursorCreatedAt) {
      query = `
        SELECT id, name, category, price, created_at, updated_at
        FROM products
        WHERE (created_at, id) < ($1, $2)
        ORDER BY created_at DESC, id DESC
        LIMIT $3
      `;
      params = [cursorCreatedAt, cursorId, limit];
    } else {
      query = `
        SELECT id, name, category, price, created_at, updated_at
        FROM products
        ORDER BY created_at DESC, id DESC
        LIMIT $1
      `;
      params = [limit];
    }

    const result = await pool.query(query, params);
    const rows = result.rows;

    let nextCursor = null;
    if (rows.length === limit) {
      const last = rows[rows.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ created_at: last.created_at, id: last.id })
      ).toString('base64');
    }

    res.json({
      data: rows,
      nextCursor,
      count: rows.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;