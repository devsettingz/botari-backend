import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'botari_secret_key';

// Hardcoded admin credentials (working)
const ADMIN_EMAIL = 'admin@botari.ai';
const ADMIN_PASSWORD = 'admin123'; // Simple password that works

// Simple admin login - NO DATABASE, NO COMPLEXITY
router.post('/login', async (req, res) => {
  console.log('[SimpleAdmin] Login attempt:', req.body.email);
  
  const { email, password } = req.body;
  
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    console.log('[SimpleAdmin] Invalid credentials');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate token
  const token = jwt.sign(
    { user_id: 'admin', email: ADMIN_EMAIL, role: 'admin', name: 'Platform Admin' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  console.log('[SimpleAdmin] Login successful');
  
  res.json({
    success: true,
    token,
    user: {
      id: 'admin',
      email: ADMIN_EMAIL,
      name: 'Platform Admin',
      role: 'admin'
    }
  });
});

// Verify token
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    res.json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
