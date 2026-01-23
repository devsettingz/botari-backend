import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Always load from .env, fallback only for dev
const JWT_SECRET = process.env.JWT_SECRET || 'botari_secret_key';

// -------------------- REGISTER --------------------
router.post('/register', async (req, res) => {
  const { business_name, country, email, password, name } = req.body;

  if (!business_name || !country || !email || !password || !name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert business
    const businessResult = await pool.query(
      `INSERT INTO businesses (business_name, country, email) 
       VALUES ($1, $2, $3) RETURNING id`,
      [business_name, country, email]
    );
    const business_id = businessResult.rows[0].id;

    // Insert user
    await pool.query(
      `INSERT INTO users (business_id, name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4, $5)`,
      [business_id, name, email, hashedPassword, 'owner']
    );

    res.status(201).json({ message: 'Business and user registered successfully' });
  } catch (err: any) {
    console.error('Registration error:', err);

    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

// -------------------- LOGIN --------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.id, business_id: user.business_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' } // token valid for 7 days
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        business_id: user.business_id,
        role: user.role,
        email: user.email,
        name: user.name
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
