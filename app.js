// Google API configuration
const CLIENT_ID = 'YOUR_CLIENT_ID';
const API_KEY = 'YOUR_API_KEY';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'];
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

// App state
let categories = [
    { id: 'all', name: 'All Emails', rules: [] },
    { id: 'work', name: 'Work', rules: [{ type: 'domain', value: ['company.com'] }] },
    { id: 'personal', name: 'Personal', rules: [{ type: 'domain', value: ['gmail.com'] }] },
    { id: 'newsletters', name: 'Newsletters', rules: [{ type: 'subject', value: ['newsletter', 'digest', 'update'] }] }
];

// Add this at the top with other app state
let emailCache = [];

// Initialize the Google API client
function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(() => {
        // Listen for sign-in state changes
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        // Handle the initial sign-in state
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        // Add click handler for the connect button
        document.getElementById('connectGmail').onclick = handleAuthClick;
    }).catch(error => {
        console.error('Error initializing Google API client:', error);
    });
}

// Update UI based on sign-in status
function updateSigninStatus(isSignedIn) {
    const connectButton = document.getElementById('connectGmail');
    if (isSignedIn) {
        connectButton.textContent = 'Disconnect Gmail';
        loadEmails();
    } else {
        connectButton.textContent = 'Connect Gmail';
        clearEmails();
    }
}

// Handle authentication click
function handleAuthClick() {
    if (gapi.auth2.getAuthInstance().isSignedIn.get()) {
        gapi.auth2.getAuthInstance().signOut();
    } else {
        gapi.auth2.getAuthInstance().signIn();
    }
}

// Load emails from Gmail
async function loadEmails() {
    try {
        const response = await gapi.client.gmail.users.messages.list({
            userId: 'me',
            maxResults: 50
        });

        emailCache = []; // Reset cache
        for (const message of response.result.messages) {
            const email = await gapi.client.gmail.users.messages.get({
                userId: 'me',
                id: message.id
            });
            emailCache.push(parseEmail(email.result));
        }

        displayEmails(emailCache);
    } catch (error) {
        console.error('Error loading emails:', error);
    }
}

// Parse email data
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

// Display emails in the UI
function displayEmails(emails) {
    const emailList = document.getElementById('emailList');
    emailList.innerHTML = emails.map(email => `
        <div class="email-item" data-email-id="${email.id}">
            <h6>${email.subject}</h6>
            <div class="text-muted">
                <small>${email.from}</small>
                <small class="ms-2">${new Date(email.date).toLocaleDateString()}</small>
            </div>
            <div class="text-truncate">${email.snippet}</div>
        </div>
    `).join('');
}

// Clear emails from the UI
function clearEmails() {
    document.getElementById('emailList').innerHTML = '';
}

// Categorize an email based on rules
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

// Handle category creation
document.getElementById('saveCategory').addEventListener('click', () => {
    const name = document.getElementById('categoryName').value;
    const senderRule = document.getElementById('senderRule').checked;
    const subjectRule = document.getElementById('subjectRule').checked;

    if (name) {
        const category = {
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name: name,
            rules: []
        };

        // Add rules based on user selection
        if (senderRule) {
            category.rules.push({ type: 'domain', value: [] });
        }
        if (subjectRule) {
            category.rules.push({ type: 'subject', value: [] });
        }

        categories.push(category);
        updateCategoryList();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('newCategoryModal'));
        modal.hide();
    }
});

// Update category list in UI
function updateCategoryList() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = categories.map(category => `
        <a href="#" class="list-group-item list-group-item-action" data-category="${category.id}">
            ${category.name}
        </a>
    `).join('');

    // Add click handlers for category filtering
    categoryList.querySelectorAll('.list-group-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            filterEmailsByCategory(item.dataset.category);
            
            // Update active state
            categoryList.querySelectorAll('.list-group-item').forEach(i => 
                i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

// Filter emails by category
function filterEmailsByCategory(categoryId) {
    const emailItems = document.querySelectorAll('.email-item');
    emailItems.forEach(item => {
        const emailId = item.dataset.emailId;
        const email = emailCache.find(e => e.id === emailId);
        if (categoryId === 'all' || categorizeEmail(email) === categoryId) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// Initialize the application
gapi.load('client:auth2', initClient);
updateCategoryList();
