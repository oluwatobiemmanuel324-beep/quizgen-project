// Core requires and app init (moved above route definitions)
console.log('Starting QuizGen backend...');
const fs = require('fs');
if (!fs.existsSync('.env')) {
  console.warn('Warning: .env file not found. Please create one with DATABASE_URL and JWT_SECRET.');
}
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
// Using Prisma for SQL database access
// (Prisma client will read DATABASE_URL from .env)
// Remove Mongoose dependency
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Secrets and config
const JWT_SECRET = process.env.JWT_SECRET || 'quizgen_secret_key';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Prisma client
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Admin middleware
async function adminMiddleware(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (user && user.email === 'support@quizgen.com') return next();
    return res.status(403).json({ success: false, error: 'Admin only' });
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Admin only' });
  }
}
// Quota enforcement middleware: checks whether user is over their monthly quota
async function quotaMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const usage = await prisma.storageUsage.findUnique({ where: { userId: req.user.userId } });
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, include: { plan: true } });
    const plan = user && user.plan ? user.plan : null;
    const monthlyQuota = plan ? plan.monthlyQuotaBytes : (100 * 1024 * 1024); // default 100MB
    const used = usage ? usage.usedBytes : 0;
    // Attach usage info to request for handlers to use
    req.usage = { usedBytes: used, quotaBytes: monthlyQuota };
    // Allow the request through; handlers will enforce stricter checks when creating content
    next();
  } catch (err) {
    console.error('Quota check error', err);
    return res.status(500).json({ success: false, error: 'Quota check failed' });
  }
}
// Get user profile (protected)
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true, username: true, email: true, createdAt: true } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update user profile (protected)
app.put('/api/profile', authMiddleware, async (req, res) => {
  try {
    const updates = {};
    if (req.body.email) updates.email = req.body.email;
    if (req.body.username) updates.username = req.body.username;
    if (req.body.password) updates.password = await bcrypt.hash(req.body.password, 10);
    const user = await prisma.user.update({ where: { id: req.user.userId }, data: updates, select: { id: true, username: true, email: true, createdAt: true } });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Admin: list all users
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, username: true, email: true, createdAt: true } });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Admin: delete user
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
// JWT authentication middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}
// User model is handled by Prisma

// Register endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ success: false, error: 'All fields required' });
    const existingUser = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
    if (existingUser) return res.status(409).json({ success: false, error: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { username, email, password: hashedPassword } });
    res.json({ success: true });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'All fields required' });
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
// Prisma handles database connectivity using DATABASE_URL from .env

// Health check
app.get('/', (req, res) => {
  res.send('QuizGen backend is running');
});


// Protected backup endpoint (Prisma)
app.post('/api/backup', authMiddleware, async (req, res) => {
  try {
    // To minimize DB storage, expect client to send metadata summaries and size estimates.
    // Example payload: { quizzesMeta: [{count:10, approxBytes: 1024}], messagesMeta: [...], notesMeta: [...] }
    const quizzesMeta = req.body.quizzesMeta || null;
    const messagesMeta = req.body.messagesMeta || null;
    const notesMeta = req.body.notesMeta || null;

    // Sum approximate bytes from all meta arrays
    let totalBytes = 0;
    const addMeta = (arr) => {
      if (!arr || !Array.isArray(arr)) return;
      for (const it of arr) {
        if (it && typeof it.approxBytes === 'number') totalBytes += it.approxBytes;
      }
    };
    addMeta(quizzesMeta);
    addMeta(messagesMeta);
    addMeta(notesMeta);

    // Update or create StorageUsage
    const existing = await prisma.storageUsage.findUnique({ where: { userId: req.user.userId } });
    if (existing) {
      await prisma.storageUsage.update({ where: { id: existing.id }, data: { usedBytes: existing.usedBytes + totalBytes } });
    } else {
      await prisma.storageUsage.create({ data: { userId: req.user.userId, usedBytes: totalBytes } });
    }

    // Store a lightweight backup record with metadata (not full blobs)
    await prisma.backup.create({
      data: {
        quizzes: quizzesMeta ? JSON.stringify(quizzesMeta) : null,
        messages: messagesMeta ? JSON.stringify(messagesMeta) : null,
        notes: notesMeta ? JSON.stringify(notesMeta) : null,
        userId: req.user.userId || null
      }
    });
    res.json({ success: true, addedBytes: totalBytes });
  } catch (err) {
    console.error('Backup save error:', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Endpoint: report current usage for authenticated user
app.get('/api/account/usage', authMiddleware, quotaMiddleware, async (req, res) => {
  try {
    const usage = await prisma.storageUsage.findUnique({ where: { userId: req.user.userId } });
    res.json({ success: true, usage: { usedBytes: usage ? usage.usedBytes : 0, quotaBytes: req.usage.quotaBytes } });
  } catch (err) {
    console.error('Usage fetch error', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Endpoint: create a class section; enforce plan limits
app.post('/api/class/create', authMiddleware, quotaMiddleware, async (req, res) => {
  try {
    const name = req.body.name;
    if (!name) return res.status(400).json({ success: false, error: 'Name required' });
    // Count existing class sections for user
    const count = await prisma.classSection.count({ where: { ownerId: req.user.userId } });
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, include: { plan: true } });
    const maxSections = user && user.plan ? user.plan.maxClassSections : 1;
    if (count >= maxSections) {
      return res.status(402).json({ success: false, error: 'Plan limit reached; please upgrade' });
    }
    const section = await prisma.classSection.create({ data: { ownerId: req.user.userId, name } });
    res.json({ success: true, section });
  } catch (err) {
    console.error('Create class error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});


// Optionally protect contact form endpoint (uncomment next line to require login)
// app.post('/api/contact', authMiddleware, async (req, res) => {
app.post('/api/contact', async (req, res) => {
  try {
    await prisma.contact.create({
      data: {
        name: req.body.name || null,
        email: req.body.email || null,
        subject: req.body.subject || null,
        message: req.body.message || null,
        userId: req.user ? req.user.userId : null
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Contact save error:', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Analytics endpoint: collect anonymized metrics with user consent
app.post('/api/analytics', async (req, res) => {
  try {
    const { consent, ageRange, country, city, deviceType, activeHours, interests, engagement } = req.body;
    if (!consent) return res.status(400).json({ success: false, error: 'Consent required' });

    const userId = req.user ? req.user.userId : null;
    // Ensure engagement is stored as a JSON string (SQLite doesn't support Json type)
    const engagementValue = engagement && typeof engagement === 'object' ? JSON.stringify(engagement) : (engagement || null);
    await prisma.analytics.create({ data: {
      userId,
      ageRange: ageRange || null,
      country: country || null,
      city: city || null,
      deviceType: deviceType || null,
      activeHours: activeHours || null,
      interests: interests || null,
      engagement: engagementValue
    }});
    res.json({ success: true });
  } catch (err) {
    console.error('Analytics save error:', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`QuizGen backend running on port ${PORT}`);
  console.log(`NODE_ENV=${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown for Prisma
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});
