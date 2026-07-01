const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Simulated database (in-memory)
let users = [
  {
    id: 1,
    name: 'Client Demo',
    email: 'client@example.com',
    password: bcryptjs.hashSync('password', 10),
    role: 'client'
  },
  {
    id: 2,
    name: 'Coach Demo',
    email: 'coach@example.com',
    password: bcryptjs.hashSync('password', 10),
    role: 'coach'
  }
];

let workouts = [];
let messages = [];

// Auth Routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);
  if (!user || !bcryptjs.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body;

  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already exists' });
  }

  const newUser = {
    id: users.length + 1,
    name,
    email,
    password: bcryptjs.hashSync(password, 10),
    role: 'client'
  };

  users.push(newUser);
  const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
});

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// User Routes
app.get('/api/users/me', verifyToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  res.json(user);
});

app.get('/api/users', verifyToken, (req, res) => {
  res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
});

// Workout Routes
app.get('/api/workouts', verifyToken, (req, res) => {
  const userWorkouts = workouts.filter(w => w.userId === req.user.id);
  res.json(userWorkouts);
});

app.post('/api/workouts', verifyToken, (req, res) => {
  const { name, duration, exercises } = req.body;
  const newWorkout = {
    id: workouts.length + 1,
    userId: req.user.id,
    name,
    duration,
    exercises,
    date: new Date().toISOString()
  };
  workouts.push(newWorkout);
  res.json(newWorkout);
});

// Messages Routes
app.get('/api/messages', verifyToken, (req, res) => {
  const userMessages = messages.filter(m => m.userId === req.user.id);
  res.json(userMessages);
});

app.post('/api/messages', verifyToken, (req, res) => {
  const { text, type } = req.body;
  const newMessage = {
    id: messages.length + 1,
    userId: req.user.id,
    text,
    type: type || 'user',
    timestamp: new Date().toISOString()
  };
  messages.push(newMessage);
  res.json(newMessage);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});