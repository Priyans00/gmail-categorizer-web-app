// Configuration and Constants
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'];
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

// Default Categories
const defaultCategories = [
    { id: 'all', name: 'All Emails', rules: [] },
    { id: 'work', name: 'Work', rules: [{ type: 'domain', value: ['company.com'] }] },
    { id: 'personal', name: 'Personal', rules: [{ type: 'domain', value: ['gmail.com'] }] },
    { id: 'newsletters', name: 'Newsletters', rules: [{ type: 'subject', value: ['newsletter', 'digest', 'update'] }] }
];

// State Management
let currentUser = null;
let emails = [];
let categories = [...defaultCategories];

// Email Fetching and Processing
async function fetchEmails() {
    try {
        // Check rate limit before making request
        await rateLimiter.checkLimit();
        
        const response = await fetch('/api/emails', {
            headers: {
                'Authorization': `Bearer ${currentUser.accessToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch emails');
        
        const data = await response.json();
        emails = data.map(parseEmail);
        displayEmails(emails);
        
        // Update the rate limit display after successful request
        updateRateLimitDisplay();
    } catch (error) {
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
            showError(error.message);
        } else {
            console.error('Error fetching emails:', error);
            showError('Failed to fetch emails');
        }
    }
}

function parseEmail(emailData) {
    const headers = emailData.payload.headers;
    return {
        id: emailData.id,
        subject: headers.find(h => h.name === 'Subject')?.value || '(no subject)',
        from: headers.find(h => h.name === 'From')?.value || '',
        date: headers.find(h => h.name === 'Date')?.value || '',
        snippet: emailData.snippet
    };
}

// Category Management
function addCategory(name, rules) {
    const newCategory = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        rules
    };
    categories.push(newCategory);
    updateCategoryList();
    saveCategoriesLocally();
}

function categorizeEmail(email) {
    for (const category of categories) {
        if (category.id === 'all') continue;
        
        for (const rule of category.rules) {
            if (rule.type === 'domain') {
                const fromDomain = email.from.split('@')[1]?.toLowerCase();
                if (rule.value.some(domain => fromDomain?.includes(domain))) {
                    return category.id;
                }
            } else if (rule.type === 'subject') {
                if (rule.value.some(keyword => 
                    email.subject.toLowerCase().includes(keyword.toLowerCase()))) {
                    return category.id;
                }
            }
        }
    }
    return 'all';
}

// UI Management
function updateCategoryList() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = categories.map(category => `
        <div class="category-item" data-category="${category.id}">
            <span>${category.name}</span>
            ${category.id !== 'all' ? '<button class="delete-btn">×</button>' : ''}
        </div>
    `).join('');

    // Add event listeners
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => filterEmailsByCategory(item.dataset.category));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCategory(e.target.parentElement.dataset.category);
        });
    });
}

function displayEmails(emailsToShow) {
    const emailList = document.getElementById('emailList');
    emailList.innerHTML = emailsToShow.map(email => `
        <div class="email-item" data-email-id="${email.id}">
            <h3>${email.subject}</h3>
            <div class="email-meta">
                <span>${email.from}</span>
                <span>${new Date(email.date).toLocaleDateString()}</span>
            </div>
            <p>${email.snippet}</p>
        </div>
    `).join('');
}

function filterEmailsByCategory(categoryId) {
    const filteredEmails = categoryId === 'all' 
        ? emails 
        : emails.filter(email => categorizeEmail(email) === categoryId);
    displayEmails(filteredEmails);

    // Update active category
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.toggle('active', item.dataset.category === categoryId);
    });
}

// Local Storage Management
function saveCategoriesLocally() {
    localStorage.setItem('emailCategories', JSON.stringify(categories));
}

function loadCategoriesFromStorage() {
    const saved = localStorage.getItem('emailCategories');
    if (saved) {
        categories = JSON.parse(saved);
        updateCategoryList();
    }
}

// Error Handling
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

// Event Listeners
document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('categoryModal');
    modal.style.display = 'block';
});

document.getElementById('categoryForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('categoryName').value;
    const rules = [];
    
    if (document.getElementById('senderRule').checked) {
        rules.push({
            type: 'domain',
            value: document.getElementById('senderValue').value.split(',').map(v => v.trim())
        });
    }
    
    if (document.getElementById('subjectRule').checked) {
        rules.push({
            type: 'subject',
            value: document.getElementById('subjectValue').value.split(',').map(v => v.trim())
        });
    }
    
    addCategory(name, rules);
    document.getElementById('categoryModal').style.display = 'none';
    document.getElementById('categoryForm').reset();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCategoriesFromStorage();
    updateCategoryList();
    updateRateLimitDisplay();
    fetchEmails();
});

// CSS Styles (add to your HTML file)
const styles = `
    .category-item {
        padding: 10px;
        margin: 5px 0;
        background: #f5f5f5;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .category-item.active {
        background: #007bff;
        color: white;
    }
    
    .email-item {
        padding: 15px;
        border-bottom: 1px solid #eee;
    }
    
    .email-meta {
        color: #666;
        font-size: 0.9em;
        margin: 5px 0;
    }
    
    .error-message {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        animation: fadeIn 0.3s;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;

// Add these constants at the top of your file
const MAX_DAILY_REQUESTS = 1600;
const STORAGE_KEYS = {
    REQUEST_COUNT: 'emailApp_requestCount',
    REQUEST_DATE: 'emailApp_requestDate'
};

// Add this rate limiting class
class RateLimiter {
    constructor(maxRequests) {
        this.maxRequests = maxRequests;
        this.loadState();
    }

    loadState() {
        const today = new Date().toDateString();
        const savedDate = localStorage.getItem(STORAGE_KEYS.REQUEST_DATE);
        
        // Reset counter if it's a new day
        if (savedDate !== today) {
            this.requestCount = 0;
            this.saveState(today);
        } else {
            this.requestCount = parseInt(localStorage.getItem(STORAGE_KEYS.REQUEST_COUNT)) || 0;
        }
    }

    saveState(date = new Date().toDateString()) {
        localStorage.setItem(STORAGE_KEYS.REQUEST_COUNT, this.requestCount.toString());
        localStorage.setItem(STORAGE_KEYS.REQUEST_DATE, date);
    }

    async checkLimit() {
        this.loadState();
        
        if (this.requestCount >= this.maxRequests) {
            const error = new Error('Daily request limit reached (1600 requests). Please try again tomorrow.');
            error.code = 'RATE_LIMIT_EXCEEDED';
            throw error;
        }
        
        this.requestCount++;
        this.saveState();
        
        return true;
    }

    getRemainingRequests() {
        this.loadState();
        return Math.max(0, this.maxRequests - this.requestCount);
    }
}

// Initialize rate limiter
const rateLimiter = new RateLimiter(MAX_DAILY_REQUESTS);

// Add this function to update the UI with remaining requests
function updateRateLimitDisplay() {
    const remaining = rateLimiter.getRemainingRequests();
    const rateLimitDisplay = document.getElementById('rateLimitDisplay');
    if (rateLimitDisplay) {
        rateLimitDisplay.textContent = `Remaining requests today: ${remaining}`;
        
        // Add warning class if running low on requests
        if (remaining < 100) {
            rateLimitDisplay.classList.add('warning');
        } else {
            rateLimitDisplay.classList.remove('warning');
        }
    }
}

// Add these styles to your existing styles
const additionalStyles = `
    #rateLimitDisplay {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    #rateLimitDisplay.warning {
        background: #fff3cd;
        color: #856404;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.8; }
        100% { opacity: 1; }
    }
`;
