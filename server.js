// server.js - Main server file
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key'; // In production, use environment variable

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./expense_tracker.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database');
    createTables();
  }
});

function createTables() {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // Budgets table
  db.run(`CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, month, year)
  )`);

  // Expenses table
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Routes

// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    db.run(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email],
      function(err) {
        if (err) {
          console.error(err.message);
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        
        // Create default budget
        db.run(
          'INSERT INTO budgets (user_id, amount, month, year) VALUES (?, ?, ?, ?)',
          [this.lastID, 1000, new Date().getMonth() + 1, new Date().getFullYear()]
        );
        
        res.status(201).json({ message: 'User registered successfully' });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(400).json({ error: 'Invalid username or password' });
      
      // Check password
      try {
        if (await bcrypt.compare(password, user.password)) {
          // Generate JWT token
          const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
          return res.json({ token, userId: user.id, username: user.username });
        } else {
          return res.status(400).json({ error: 'Invalid username or password' });
        }
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }
  );
});

// Get budget
app.get('/api/budget', authenticateToken, (req, res) => {
  const { month, year } = req.query;
  const currentMonth = month || new Date().getMonth() + 1;
  const currentYear = year || new Date().getFullYear();
  
  db.get(
    'SELECT * FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
    [req.user.id, currentMonth, currentYear],
    (err, budget) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (!budget) {
        // Create default budget if none exists
        db.run(
          'INSERT INTO budgets (user_id, amount, month, year) VALUES (?, ?, ?, ?)',
          [req.user.id, 1000, currentMonth, currentYear],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({ amount: 1000, month: currentMonth, year: currentYear });
          }
        );
      } else {
        res.json(budget);
      }
    }
  );
});

// Update budget
app.put('/api/budget', authenticateToken, (req, res) => {
  const { amount, month, year } = req.body;
  const currentMonth = month || new Date().getMonth() + 1;
  const currentYear = year || new Date().getFullYear();
  
  db.run(
    'INSERT OR REPLACE INTO budgets (user_id, amount, month, year) VALUES (?, ?, ?, ?)',
    [req.user.id, amount, currentMonth, currentYear],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({ message: 'Budget updated successfully', amount, month: currentMonth, year: currentYear });
    }
  );
});

// Get expenses
app.get('/api/expenses', authenticateToken, (req, res) => {
  const { category, fromDate, toDate } = req.query;
  
  let query = 'SELECT * FROM expenses WHERE user_id = ?';
  let params = [req.user.id];
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  if (fromDate) {
    query += ' AND date >= ?';
    params.push(fromDate);
  }
  
  if (toDate) {
    query += ' AND date <= ?';
    params.push(toDate);
  }
  
  query += ' ORDER BY date DESC';
  
  db.all(query, params, (err, expenses) => {
    if (err) return res.status(500).json({ error: err.message });
    
    res.json(expenses);
  });
});

// Add expense
app.post('/api/expenses', authenticateToken, (req, res) => {
  const { description, amount, category, date } = req.body;
  
  if (!description || !amount || !category || !date) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  db.run(
    'INSERT INTO expenses (user_id, description, amount, category, date) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, description, amount, category, date],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      res.status(201).json({
        id: this.lastID,
        description,
        amount,
        category,
        date,
        user_id: req.user.id
      });
    }
  );
});

// Update expense
app.put('/api/expenses/:id', authenticateToken, (req, res) => {
  const { description, amount, category, date } = req.body;
  const { id } = req.params;
  
  if (!description || !amount || !category || !date) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // First check if expense belongs to user
  db.get(
    'SELECT * FROM expenses WHERE id = ? AND user_id = ?',
    [id, req.user.id],
    (err, expense) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!expense) return res.status(404).json({ error: 'Expense not found' });
      
      // Update expense
      db.run(
        'UPDATE expenses SET description = ?, amount = ?, category = ?, date = ? WHERE id = ?',
        [description, amount, category, date, id],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          res.json({
            id,
            description,
            amount,
            category,
            date,
            user_id: req.user.id
          });
        }
      );
    }
  );
});

// Delete expense
app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // First check if expense belongs to user
  db.get(
    'SELECT * FROM expenses WHERE id = ? AND user_id = ?',
    [id, req.user.id],
    (err, expense) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!expense) return res.status(404).json({ error: 'Expense not found' });
      
      // Delete expense
      db.run(
        'DELETE FROM expenses WHERE id = ?',
        [id],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          res.json({ message: 'Expense deleted successfully' });
        }
      );
    }
  );
});

// Get expense analytics
app.get('/api/analytics', authenticateToken, (req, res) => {
  const { month, year } = req.query;
  const currentMonth = month || new Date().getMonth() + 1;
  const currentYear = year || new Date().getFullYear();
  
  // Get month start and end dates
  const startDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
  let endDate;
  
  if (currentMonth === 12) {
    endDate = `${currentYear + 1}-01-01`;
  } else {
    endDate = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`;
  }
  
  // Get total expenses for the month
  db.get(
    'SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date >= ? AND date < ?',
    [req.user.id, startDate, endDate],
    (err, totalResult) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Get expenses by category
      db.all(
        'SELECT category, SUM(amount) as amount FROM expenses WHERE user_id = ? AND date >= ? AND date < ? GROUP BY category',
        [req.user.id, startDate, endDate],
        (err, categoryResults) => {
          if (err) return res.status(500).json({ error: err.message });
          
          // Get budget for the month
          db.get(
            'SELECT amount FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
            [req.user.id, currentMonth, currentYear],
            (err, budget) => {
              if (err) return res.status(500).json({ error: err.message });
              
              const budgetAmount = budget ? budget.amount : 1000;
              const totalExpenses = totalResult ? totalResult.total || 0 : 0;
              const remainingBudget = budgetAmount - totalExpenses;
              
              // Find top category
              let topCategory = '-';
              let topAmount = 0;
              
              if (categoryResults && categoryResults.length > 0) {
                categoryResults.forEach(cat => {
                  if (cat.amount > topAmount) {
                    topAmount = cat.amount;
                    topCategory = cat.category;
                  }
                });
              }
              
              res.json({
                totalExpenses,
                budgetAmount,
                remainingBudget,
                topCategory,
                categoryBreakdown: categoryResults || []
              });
            }
          );
        }
      );
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});