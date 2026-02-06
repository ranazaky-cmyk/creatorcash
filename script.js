
// ============================================================================
// PASTE YOUR SUPABASE CREDENTIALS HERE:
// ============================================================================
const SUPABASE_URL = 'https://tvontpabotujbvlitnvk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__XlDNE4Ip7xXNF81rIl36Q_G5unKDEe';
// ============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authMessage = document.getElementById('auth-message');
const addIncomeForm = document.getElementById('add-income-form');
const incomeList = document.getElementById('income-list');

// State
let currentUser = null;
let incomes = [];

// Initialize
checkAuth();

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        showDashboard();
    } else {
        showAuth();
    }
}

function showAuth() {
    authScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
}

function showDashboard() {
    authScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    document.getElementById('user-email').textContent = currentUser.email;
    loadIncomes();
}

// Toggle between login and signup
document.getElementById('show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    clearAuthMessage();
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    clearAuthMessage();
});

// Sign Up
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    showAuthMessage('Creating account...', 'success');

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        showAuthMessage(error.message, 'error');
    } else {
        showAuthMessage('Account created! You can now login.', 'success');
        setTimeout(() => {
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            document.getElementById('login-email').value = email;
        }, 1500);
    }
});

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    showAuthMessage('Logging in...', 'success');

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        showAuthMessage(error.message, 'error');
    } else {
        currentUser = data.user;
        showDashboard();
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        currentUser = null;
        incomes = [];
        showAuth();
    }
});

function showAuthMessage(message, type) {
    authMessage.textContent = message;
    authMessage.className = `message ${type}`;
}

function clearAuthMessage() {
    authMessage.textContent = '';
    authMessage.className = 'message';
}

// ============================================================================
// INCOME CRUD FUNCTIONS
// ============================================================================

async function loadIncomes() {
    const { data, error } = await supabase
        .from('incomes')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date', { ascending: false });

    if (error) {
        console.error('Error loading incomes:', error);
        return;
    }

    incomes = data || [];
    renderIncomes();
    calculateSummary();
}

async function createIncome(incomeData) {
    const { data, error } = await supabase
        .from('incomes')
        .insert([{
            user_id: currentUser.id,
            date: incomeData.date,
            amount: incomeData.amount,
            source: incomeData.source,
            category: incomeData.category,
        }])
        .select();

    if (error) {
        console.error('Error creating income:', error);
        alert('Error saving income: ' + error.message);
        return false;
    }

    await loadIncomes();
    return true;
}

async function deleteIncome(id) {
    const { error } = await supabase
        .from('incomes')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id);

    if (error) {
        console.error('Error deleting income:', error);
        alert('Error deleting income: ' + error.message);
        return;
    }

    await loadIncomes();
}

function renderIncomes() {
    if (incomes.length === 0) {
        incomeList.innerHTML = '<p class="empty-state">No income entries yet. Add your first entry!</p>';
        return;
    }

    incomeList.innerHTML = incomes.map(income => `
        <div class="income-item">
            <div class="income-info">
                <div class="income-header">
                    <span class="income-source">${escapeHtml(income.source)}</span>
                    <span class="income-amount">$${parseFloat(income.amount).toFixed(2)}</span>
                </div>
                <div class="income-details">
                    <span>${formatDate(income.date)}</span>
                    <span class="income-category">${escapeHtml(income.category)}</span>
                </div>
            </div>
            <button class="delete-btn" onclick="handleDelete('${income.id}')">Delete</button>
        </div>
    `).join('');
}

// ============================================================================
// SUMMARY CALCULATIONS
// ============================================================================

function calculateSummary() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthIncomes = incomes.filter(income => {
        const incomeDate = new Date(income.date);
        return incomeDate.getMonth() === currentMonth && incomeDate.getFullYear() === currentYear;
    });

    const totalIncome = thisMonthIncomes.reduce((sum, income) => sum + parseFloat(income.amount), 0);
    const taxRate = parseFloat(document.getElementById('tax-rate').value) / 100;
    const taxAmount = totalIncome * taxRate;
    const safeToSpend = totalIncome - taxAmount;

    document.getElementById('total-income').textContent = `$${totalIncome.toFixed(2)}`;
    document.getElementById('tax-amount').textContent = `$${taxAmount.toFixed(2)}`;
    document.getElementById('safe-spend').textContent = `$${safeToSpend.toFixed(2)}`;
}

// Update calculations when tax rate changes
document.getElementById('tax-rate').addEventListener('input', calculateSummary);

// ============================================================================
// FORM HANDLING
// ============================================================================

document.getElementById('add-income-btn').addEventListener('click', () => {
    addIncomeForm.classList.remove('hidden');
    document.getElementById('income-date').valueAsDate = new Date();
});

document.getElementById('cancel-income-btn').addEventListener('click', () => {
    addIncomeForm.classList.add('hidden');
    document.getElementById('incomeForm').reset();
});

document.getElementById('incomeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const incomeData = {
        date: document.getElementById('income-date').value,
        amount: parseFloat(document.getElementById('income-amount').value),
        source: document.getElementById('income-source').value,
        category: document.getElementById('income-category').value,
    };

    const success = await createIncome(incomeData);
    if (success) {
        addIncomeForm.classList.add('hidden');
        document.getElementById('incomeForm').reset();
    }
});

// ============================================================================
// EXPORT CSV
// ============================================================================

document.getElementById('export-csv-btn').addEventListener('click', () => {
    if (incomes.length === 0) {
        alert('No data to export');
        return;
    }

    const headers = ['Date', 'Amount', 'Source', 'Category'];
    const csvRows = [headers.join(',')];

    incomes.forEach(income => {
        const row = [
            income.date,
            income.amount,
            `"${income.source.replace(/"/g, '""')}"`,
            income.category
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creator-income-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
});

// ============================================================================
// LOAD DEMO DATA
// ============================================================================

document.getElementById('load-demo-btn').addEventListener('click', async () => {
    if (!confirm('This will add sample data to your account. Continue?')) {
        return;
    }

    const now = new Date();
    const demoData = [
        {
            date: new Date(now.getFullYear(), now.getMonth(), 5).toISOString().split('T')[0],
            amount: 2500,
            source: 'Nike Brand Deal',
            category: 'Brand Deal'
        },
        {
            date: new Date(now.getFullYear(), now.getMonth(), 12).toISOString().split('T')[0],
            amount: 1200,
            source: 'Amazon Affiliate',
            category: 'Affiliate'
        },
        {
            date: new Date(now.getFullYear(), now.getMonth(), 18).toISOString().split('T')[0],
            amount: 800,
            source: 'UGC Video - Beauty Brand',
            category: 'UGC'
        },
        {
            date: new Date(now.getFullYear(), now.getMonth(), 22).toISOString().split('T')[0],
            amount: 3500,
            source: 'Podcast Sponsorship',
            category: 'Sponsorship'
        },
        {
            date: new Date(now.getFullYear(), now.getMonth(), 28).toISOString().split('T')[0],
            amount: 500,
            source: '1-on-1 Coaching Session',
            category: 'Coaching'
        }
    ];

    for (const income of demoData) {
        await createIncome(income);
    }

    alert('Demo data loaded successfully!');
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make delete function global so it can be called from HTML
window.handleDelete = async (id) => {
    if (confirm('Delete this income entry?')) {
        await deleteIncome(id);
    }
};

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        showDashboard();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        incomes = [];
        showAuth();
    }
});
