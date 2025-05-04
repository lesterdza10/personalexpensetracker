// app.js - Frontend JavaScript

// Global variables
let token = localStorage.getItem('token');
let expenses = [];
let chartInstance = null;

// DOM elements
const expenseForm = document.getElementById('expense-form');
const expensesList = document.getElementById('expenses-list');
const totalExpensesElement = document.getElementById('total-expenses');
const monthlyBudgetElement = document.getElementById('monthly-budget');
const remainingBudgetElement = document.getElementById('remaining-budget');
const topCategoryElement = document.getElementById('top-category');
const noExpensesMessage = document.getElementById('no-expenses-message');
const expensesChart = document.getElementById('expenses-chart');

// Filter elements
const filterCategory = document.getElementById('filter-category');
const filterFromDate = document.getElementById('filter-from-date');
const filterToDate = document.getElementById('filter-to-date');
const applyFiltersButton = document.getElementById('apply-filters');

// Set default dates for filters
const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
filterFromDate.valueAsDate = firstDayOfMonth;
filterToDate.valueAsDate = today;

// Check if user is logged in, if not redirect to login page
function checkAuth() {
    if (!token) {
        // Redirect to login page if it exists, otherwise show login form
        if (document.getElementById('login-form')) {
            document.getElementById('login-container').style.display = 'block';
            document.getElementById('app-container').style.display = 'none';
        } else {
            showLoginForm();
        }
    } else {
        // Initialize app
        fetchExpenses();
        fetchAnalytics();
    }
}

// Show login form
function showLoginForm() {
    const appContainer = document.querySelector('.container');
    const loginHTML = `
        <div id="login-container" class="login-container">
            <h2>Login to Personal Expense Tracker</h2>
            <form id="login-form" class="login-form">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" placeholder="Enter username" required>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" placeholder="Enter password" required>
                </div>
                <button type="submit">Login</button>
                <p>Don't have an account? <a href="#" id="show-register">Register</a></p>
            </form>
            
            <form id="register-form" class="register-form" style="display:none;">
                <div class="form-group">
                    <label for="reg-username">Username</label>
                    <input type="text" id="reg-username" placeholder="Choose username" required>
                </div>
                <div class="form-group">
                    <label for="reg-email">Email</label>
                    <input type="email" id="reg-email" placeholder="Enter email" required>
                </div>
                <div class="form-group">
                    <label for="reg-password">Password</label>
                    <input type="password" id="reg-password" placeholder="Choose password" required>
                </div>
                <div class="form-group">
                    <label for="reg-confirm-password">Confirm Password</label>
                    <input type="password" id="reg-confirm-password" placeholder="Confirm password" required>
                </div>
                <button type="submit">Register</button>
                <p>Already have an account? <a href="#" id="show-login">Login</a></p>
            </form>
        </div>
    `;
    
    // Add login HTML to the page
    const mainContent = document.querySelector('.main-sections');
    mainContent.insertAdjacentHTML('beforebegin', loginHTML);
    
    // Hide app container
    appContainer.style.display = 'none';
    
    // Add event listeners for login and register forms
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token and initialize app
            token = data.token;
            localStorage.setItem('token', token);
            document.getElementById('login-container').style.display = 'none';
            document.querySelector('.container').style.display = 'block';
            
            // Initialize app
            fetchExpenses();
            fetchAnalytics();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

// Handle register form submission
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    
    // Validate passwords match
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Registration successful! Please login.');
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please try again.');
    }
}

// API functions
async function fetchExpenses() {
    try {
        // Build query string with filters
        let queryParams = new URLSearchParams();
        
        if (filterCategory.value) {
            queryParams.append('category', filterCategory.value);
        }
        
        if (filterFromDate.value) {
            queryParams.append('fromDate', filterFromDate.value);
        }
        
        if (filterToDate.value) {
            queryParams.append('toDate', filterToDate.value);
        }
        
        const response = await fetch(`http://localhost:3000/api/expenses?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            expenses = await response.json();
            renderExpenses();
        } else if (response.status === 401 || response.status === 403) {
            // Token expired or invalid
            localStorage.removeItem('token');
            token = null;
            checkAuth();
        } else {
            const error = await response.json();
            console.error('Error fetching expenses:', error);
        }
    } catch (error) {
        console.error('Error fetching expenses:', error);
    }
}

async function fetchAnalytics() {
    try {
        const currentDate = new Date();
        const response = await fetch(`http://localhost:3000/api/analytics?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateDashboard(data);
            renderChart(data.categoryBreakdown);
        } else if (response.status === 401 || response.status === 403) {
            // Token expired or invalid
            localStorage.removeItem('token');
            token = null;
            checkAuth();
        } else {
            const error = await response.json();
            console.error('Error fetching analytics:', error);
        }
    } catch (error) {
        console.error('Error fetching analytics:', error);
    }
}

async function addExpense(expense) {
    try {
        const response = await fetch('http://localhost:3000/api/expenses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(expense)
        });
        
        if (response.ok) {
            const newExpense = await response.json();
            expenses.unshift(newExpense);
            renderExpenses();
            fetchAnalytics();
        } else {
            const error = await response.json();
            alert(`Failed to add expense: ${error.error}`);
        }
    } catch (error) {
        console.error('Error adding expense:', error);
        alert('Failed to add expense. Please try again.');
    }
}

async function updateExpense(id, expense) {
    try {
        const response = await fetch(`http://localhost:3000/api/expenses/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(expense)
        });
        
        if (response.ok) {
            const updatedExpense = await response.json();
            const index = expenses.findIndex(exp => exp.id === id);
            
            if (index !== -1) {
                expenses[index] = updatedExpense;
                renderExpenses();
                fetchAnalytics();
            }
        } else {
            const error = await response.json();
            alert(`Failed to update expense: ${error.error}`);
        }
    } catch (error) {
        console.error('Error updating expense:', error);
        alert('Failed to update expense. Please try again.');
    }
}

async function deleteExpense(id) {
    try {
        const response = await fetch(`http://localhost:3000/api/expenses/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            expenses = expenses.filter(expense => expense.id !== id);
            renderExpenses();
            fetchAnalytics();
        } else {
            const error = await response.json();
            alert(`Failed to delete expense: ${error.error}`);
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Failed to delete expense. Please try again.');
    }
}

async function updateBudget(amount) {
    try {
        const currentDate = new Date();
        const response = await fetch('http://localhost:3000/api/budget', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                amount,
                month: currentDate.getMonth() + 1,
                year: currentDate.getFullYear()
            })
        });
        
        if (response.ok) {
            fetchAnalytics();
        } else {
            const error = await response.json();
            alert(`Failed to update budget: ${error.error}`);
        }
    } catch (error) {
        console.error('Error updating budget:', error);
        alert('Failed to update budget. Please try again.');
    }
}

// Render functions
function renderExpenses() {
    if (expenses.length === 0) {
        expensesList.innerHTML = '';
        noExpensesMessage.style.display = 'block';
        return;
    }
    
    noExpensesMessage.style.display = 'none';
    expensesList.innerHTML = '';
    
    expenses.forEach(expense => {
        const row = document.createElement('tr');
        
        // Format date for display (YYYY-MM-DD to MM/DD/YYYY)
        const dateParts = expense.date.split('-');
        const formattedDate = `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}`;
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${expense.description}</td>
            <td>${expense.category}</td>
            <td>$${parseFloat(expense.amount).toFixed(2)}</td>
            <td>
                <button class="edit-btn" data-id="${expense.id}">Edit</button>
                <button class="delete-btn" data-id="${expense.id}">Delete</button>
            </td>
        `;
        
        expensesList.appendChild(row);
    });
    
    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', handleEditExpense);
    });
    
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeleteExpense);
    });
}

function updateDashboard(data) {
    totalExpensesElement.textContent = `$${parseFloat(data.totalExpenses || 0).toFixed(2)}`;
    monthlyBudgetElement.textContent = `$${parseFloat(data.budgetAmount || 0).toFixed(2)}`;
    remainingBudgetElement.textContent = `$${parseFloat(data.remainingBudget || 0).toFixed(2)}`;
    topCategoryElement.textContent = data.topCategory;
    
    // Update colors based on budget status
    if (data.remainingBudget < 0) {
        remainingBudgetElement.classList.add('negative');
    } else {
        remainingBudgetElement.classList.remove('negative');
    }
    
    // Make budget editable on click
    monthlyBudgetElement.onclick = function() {
        const newBudget = prompt('Enter new monthly budget:', data.budgetAmount);
        if (newBudget !== null && !isNaN(newBudget) && newBudget > 0) {
            updateBudget(parseFloat(newBudget));
        }
    };
}

function renderChart(categoryData) {
    // Destroy previous chart instance if it exists
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    if (!categoryData || categoryData.length === 0) {
        return;
    }
    
    const labels = categoryData.map(item => item.category);
    const amounts = categoryData.map(item => item.amount);
    
    // Generate random colors for chart
    const backgroundColors = generateRandomColors(labels.length);
    
    chartInstance = new Chart(expensesChart, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: amounts,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: true,
                    text: 'Expenses by Category'
                }
            }
        }
    });
}

// Helper functions
function generateRandomColors(count) {
    const colors = [];
    const predefinedColors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#8AC249', '#EA526F', '#00A6A6', '#605B56'
    ];
    
    for (let i = 0; i < count; i++) {
        if (i < predefinedColors.length) {
            colors.push(predefinedColors[i]);
        } else {
            // Generate random color if we run out of predefined ones
            const r = Math.floor(Math.random() * 255);
            const g = Math.floor(Math.random() * 255);
            const b = Math.floor(Math.random() * 255);
            colors.push(`rgb(${r}, ${g}, ${b})`);
        }
    }
    
    return colors;
}

function formatDate(date) {
    const d = new Date(date);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
}

// Event handlers
function handleAddExpense(e) {
    e.preventDefault();
    
    const description = document.getElementById('expense-description').value;
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const category = document.getElementById('expense-category').value;
    const date = document.getElementById('expense-date').value;
    
    addExpense({
        description,
        amount,
        category,
        date
    });
    
    // Reset form
    expenseForm.reset();
    
    // Set default date to today
    // Set default date to today
    document.getElementById('expense-date').valueAsDate = new Date();
}

function handleEditExpense(e) {
    const id = parseInt(e.target.getAttribute('data-id'));
    const expense = expenses.find(exp => exp.id === id);
    
    if (!expense) {
        return;
    }
    
    // Fill the form with expense data
    document.getElementById('expense-description').value = expense.description;
    document.getElementById('expense-amount').value = expense.amount;
    document.getElementById('expense-category').value = expense.category;
    document.getElementById('expense-date').value = expense.date;
    
    // Change form submit handler temporarily
    expenseForm.removeEventListener('submit', handleAddExpense);
    
    // Add update handler
    const updateHandler = async (e) => {
        e.preventDefault();
        
        const updatedExpense = {
            description: document.getElementById('expense-description').value,
            amount: parseFloat(document.getElementById('expense-amount').value),
            category: document.getElementById('expense-category').value,
            date: document.getElementById('expense-date').value
        };
        
        await updateExpense(id, updatedExpense);
        
        // Reset form and event listeners
        expenseForm.reset();
        document.getElementById('expense-date').valueAsDate = new Date();
        expenseForm.removeEventListener('submit', updateHandler);
        expenseForm.addEventListener('submit', handleAddExpense);
    };
    
    expenseForm.addEventListener('submit', updateHandler);
    
    // Add cancel button
    const submitButton = expenseForm.querySelector('button[type="submit"]');
    
    // Check if cancel button already exists
    let cancelButton = expenseForm.querySelector('.cancel-edit-btn');
    
    if (!cancelButton) {
        cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'cancel-edit-btn';
        cancelButton.textContent = 'Cancel';
        submitButton.insertAdjacentElement('afterend', cancelButton);
    }
    
    submitButton.textContent = 'Update Expense';
    
    // Cancel button handler
    cancelButton.onclick = () => {
        expenseForm.reset();
        document.getElementById('expense-date').valueAsDate = new Date();
        expenseForm.removeEventListener('submit', updateHandler);
        expenseForm.addEventListener('submit', handleAddExpense);
        submitButton.textContent = 'Add Expense';
        cancelButton.remove();
    };
}

function handleDeleteExpense(e) {
    const id = parseInt(e.target.getAttribute('data-id'));
    
    if (confirm('Are you sure you want to delete this expense?')) {
        deleteExpense(id);
    }
}

// Event listeners
function setupEventListeners() {
    expenseForm.addEventListener('submit', handleAddExpense);
    
    // Set default date to today
    document.getElementById('expense-date').valueAsDate = new Date();
    
    // Filter event listener
    applyFiltersButton.addEventListener('click', fetchExpenses);
    
    // Add logout button to header
    const header = document.querySelector('header .container');
    const logoutButton = document.createElement('button');
    logoutButton.textContent = 'Logout';
    logoutButton.className = 'logout-btn';
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('token');
        token = null;
        location.reload();
    });
    header.appendChild(logoutButton);
}

// Initialize app
function initApp() {
    checkAuth();
    setupEventListeners();
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);