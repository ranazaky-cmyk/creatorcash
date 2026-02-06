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

    // Calculate new features
    calculateForecast();
    calculateHealthScore(taxRate);
}

// ============================================================================
// CASH FLOW FORECAST
// ============================================================================

function calculateForecast() {
    // Group entries by calendar month (YYYY-MM)
    const monthlyMap = {};
    
    incomes.forEach(income => {
        // Parse YYYY-MM-DD as local date (no timezone shift)
        const [year, month, day] = income.date.split('-').map(Number);
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        
        if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = 0;
        }
        monthlyMap[monthKey] += parseFloat(income.amount);
    });
    
    // Get distinct months sorted descending (most recent first)
    const monthKeys = Object.keys(monthlyMap).sort().reverse();
    
    // Debug line: show detected months
    const debugMonths = monthKeys.length > 0 ? monthKeys.join(', ') : 'none';
    
    // Need at least 2 distinct months for meaningful forecast
    if (monthKeys.length < 2) {
        document.getElementById('forecast-amount').textContent = '—';
        document.getElementById('forecast-range').textContent = `Need 2+ months of data (${debugMonths})`;
        return;
    }
    
    // Calculate average from most recent 2-3 months
    const recentMonths = monthKeys.slice(0, Math.min(3, monthKeys.length));
    const recentTotals = recentMonths.map(key => monthlyMap[key]);
    const average = recentTotals.reduce((sum, val) => sum + val, 0) / recentTotals.length;
    
    // Calculate ±15% range
    const lowerBound = average * 0.85;
    const upperBound = average * 1.15;
    
    document.getElementById('forecast-amount').textContent = `$${average.toFixed(2)}`;
    document.getElementById('forecast-range').textContent = `$${lowerBound.toFixed(2)} - $${upperBound.toFixed(2)} • Months: ${debugMonths}`;
}

// ============================================================================
// FINANCIAL HEALTH SCORE
// ============================================================================

function calculateHealthScore(taxRate) {
    if (incomes.length < 3) {
        document.getElementById('health-score').textContent = '—';
        document.getElementById('health-explanation').textContent = 'Need 3+ entries to calculate';
        return;
    }
    
    let score = 0;
    const factors = [];
    
    // 1. Income Consistency (30 points) - lower variance is better
    const monthlyTotals = getMonthlyTotals();
    if (monthlyTotals.length >= 2) {
        const variance = calculateVariance(monthlyTotals);
        const mean = monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 1; // coefficient of variation
        
        const consistencyScore = Math.max(0, Math.min(30, 30 - (cv * 30)));
        score += consistencyScore;
        
        if (consistencyScore >= 20) {
            factors.push('Consistent income');
        } else if (consistencyScore >= 10) {
            factors.push('Moderate variance');
        } else {
            factors.push('High variance');
        }
    }
    
    // 2. Growth Trend (25 points) - positive growth is good
    if (monthlyTotals.length >= 3) {
        const recent = monthlyTotals.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
        const older = monthlyTotals.slice(-2).reduce((a, b) => a + b, 0) / 2;
        
        let growthScore = 0;
        if (older > 0) {
            const growthRate = (recent - older) / older;
            if (growthRate > 0.2) {
                growthScore = 25;
                factors.push('Strong growth');
            } else if (growthRate > 0) {
                growthScore = 15;
                factors.push('Positive trend');
            } else if (growthRate > -0.1) {
                growthScore = 10;
                factors.push('Stable');
            } else {
                growthScore = 5;
                factors.push('Declining');
            }
        }
        score += growthScore;
    }
    
    // 3. Savings Rate (25 points) - tax set-aside percentage
    const savingsScore = Math.min(25, (taxRate * 100));
    score += savingsScore;
    
    if (taxRate >= 0.25) {
        factors.push('Good savings');
    } else if (taxRate >= 0.15) {
        factors.push('Moderate savings');
    } else {
        factors.push('Low savings');
    }
    
    // 4. Revenue Diversification (20 points) - more categories is better
    const categories = new Set(incomes.map(i => i.category));
    const diversificationScore = Math.min(20, categories.size * 5);
    score += diversificationScore;
    
    if (categories.size >= 4) {
        factors.push('Diversified');
    } else if (categories.size >= 2) {
        factors.push('Some diversity');
    } else {
        factors.push('Single source');
    }
    
    // Cap at 100
    score = Math.min(100, Math.round(score));
    
    // Update UI
    document.getElementById('health-score').textContent = score;
    document.getElementById('health-explanation').textContent = factors.join(' • ');
}

function getMonthlyTotals() {
    const now = new Date();
    const monthlyMap = {};
    
    incomes.forEach(income => {
        const date = new Date(income.date);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        
        if (!monthlyMap[key]) {
            monthlyMap[key] = 0;
        }
        monthlyMap[key] += parseFloat(income.amount);
    });
    
    // Sort by date descending and return values
    return Object.keys(monthlyMap)
        .sort((a, b) => b.localeCompare(a))
        .map(key => monthlyMap[key]);
}

function calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
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

// Privacy modal
const privacyLink = document.getElementById("privacyLink");
const privacyModal = document.getElementById("privacyModal");
const closePrivacy = document.getElementById("closePrivacy");

if (privacyLink) {
  privacyLink.addEventListener("click", (e) => {
    e.preventDefault();
    privacyModal.classList.remove("hidden");
  });
}

if (closePrivacy) {
  closePrivacy.addEventListener("click", () => {
    privacyModal.classList.add("hidden");
  });
}

