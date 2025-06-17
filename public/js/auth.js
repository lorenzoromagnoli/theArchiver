// Authentication Management

let currentUser = null;
let isLoginMode = true;

// ====================================
// AUTH UI MANAGEMENT
// ====================================

function showAuth() {
    document.getElementById('auth-overlay').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

function showApp() {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    
    const title = document.getElementById('auth-title');
    const submitBtn = document.getElementById('auth-submit');
    const switchText = document.getElementById('auth-switch-text');
    const switchBtn = document.getElementById('auth-switch-btn');
    const usernameGroup = document.getElementById('username-group');
    const usernameInput = document.getElementById('username');

    if (isLoginMode) {
        title.textContent = 'Sign In to Team Archive';
        submitBtn.textContent = 'Sign In';
        switchText.textContent = "Don't have an account?";
        switchBtn.textContent = 'Sign Up';
        usernameGroup.classList.add('hidden');
        // Remove required attribute when hidden
        usernameInput.removeAttribute('required');
    } else {
        title.textContent = 'Join Team Archive';
        submitBtn.textContent = 'Sign Up';
        switchText.textContent = 'Already have an account?';
        switchBtn.textContent = 'Sign In';
        usernameGroup.classList.remove('hidden');
        // Add required attribute when visible
        usernameInput.setAttribute('required', 'required');
    }
    
    // Clear form
    document.getElementById('auth-form').reset();
    clearAuthError();
}

function showAuthError(message) {
    const errorDiv = document.getElementById('auth-error');
    errorDiv.innerHTML = `<div class="error">${message}</div>`;
    
    // Auto-clear error after 5 seconds
    setTimeout(() => {
        clearAuthError();
    }, 5000);
}

function clearAuthError() {
    document.getElementById('auth-error').innerHTML = '';
}

// ====================================
// AUTH FORM HANDLING
// ====================================

async function handleAuth(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value.trim();
    
    // Basic validation
    if (!email || !password) {
        showAuthError('Please fill in all required fields');
        return;
    }
    
    if (!isLoginMode && !username) {
        showAuthError('Username is required for registration');
        return;
    }
    
    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters');
        return;
    }
    
    const submitBtn = document.getElementById('auth-submit');
    const originalText = submitBtn.textContent;
    
    submitBtn.disabled = true;
    submitBtn.textContent = isLoginMode ? 'Signing In...' : 'Creating Account...';
    
    try {
        let response;
        
        if (isLoginMode) {
            response = await window.api.login(email, password);
        } else {
            response = await window.api.register(username, email, password);
        }
        
        // Store user data
        currentUser = response.user;
        
        // Show success and transition to app
        showNotification(isLoginMode ? 'Welcome back!' : 'Account created successfully!');
        
        // Show loading state during transition
        showLoadingState();
        
        showApp();
        updateUserInfo();
        
        // Load initial data with proper sequencing
        await loadInitialDataSequential();
        
        // Hide loading state
        hideLoadingState();
        
    } catch (error) {
        console.error('Authentication error:', error);
        
        // Show user-friendly error messages
        if (error.message.includes('Invalid credentials')) {
            showAuthError('Invalid email or password. Please try again.');
        } else if (error.message.includes('already exists')) {
            showAuthError('An account with this email or username already exists.');
        } else if (error.message.includes('UNIQUE constraint failed')) {
            showAuthError('Username or email already taken. Please choose different ones.');
        } else {
            showAuthError('Authentication failed. Please try again.');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ====================================
// USER MANAGEMENT
// ====================================

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.username;
        document.getElementById('user-role').textContent = currentUser.role;
        document.getElementById('user-avatar').textContent = currentUser.username.charAt(0).toUpperCase();
    }
}

function logout() {
    // Clear API token
    window.api.logout();
    
    // Clear user data
    currentUser = null;
    
    // Clear application state
    clearApplicationState();
    
    // Show auth screen
    showAuth();
    
    showNotification('Logged out successfully');
}

function clearApplicationState() {
    // Clear items array
    if (window.allItems) {
        window.allItems = [];
    }
    
    // Clear search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Reset collection selection
    window.currentCollection = 'all';
    
    // Clear grid
    const grid = document.getElementById('archive-grid');
    if (grid) {
        grid.innerHTML = '';
    }
    
    // Reset collection counts
    const countElements = document.querySelectorAll('[id^="count-"]');
    countElements.forEach(el => {
        el.textContent = '0';
    });
}

// ====================================
// AUTO-LOGIN CHECK
// ====================================

async function checkAutoLogin() {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        showAuth();
        return false;
    }
    
    try {
        // Show loading state
        showLoadingState();
        
        // Test token validity by making a simple API call with retry
        let collections;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                collections = await window.api.getCollections();
                break; // Success, exit retry loop
            } catch (error) {
                retryCount++;
                if (retryCount >= maxRetries) {
                    throw error; // Re-throw if max retries reached
                }
                console.log(`Retry ${retryCount}/${maxRetries} for auth validation...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
        }
        
        // If successful, we're logged in
        currentUser = { 
            username: 'User', 
            role: 'member' 
        };
        
        hideLoadingState();
        showApp();
        updateUserInfo();
        
        // Load initial data with proper sequencing
        await loadInitialDataSequential();
        return true;
        
    } catch (error) {
        console.log('Token validation failed:', error);
        
        // Clear invalid token
        localStorage.removeItem('authToken');
        window.api.token = null;
        
        hideLoadingState();
        showAuth();
        return false;
    }
}

// ====================================
// LOADING STATES
// ====================================

function showLoadingState() {
    // Create or show loading overlay
    let loadingOverlay = document.getElementById('loading-overlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                backdrop-filter: blur(5px);
            ">
                <div style="
                    text-align: center;
                    color: #2c3e50;
                ">
                    <div style="
                        width: 50px;
                        height: 50px;
                        border: 4px solid #e9ecef;
                        border-top: 4px solid #667eea;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    "></div>
                    <div style="font-size: 18px; font-weight: 600;">Loading Archive...</div>
                    <div style="font-size: 14px; color: #6c757d; margin-top: 8px;">Please wait</div>
                </div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
        
        // Add spin animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    loadingOverlay.style.display = 'flex';
}

function hideLoadingState() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// ====================================
// DEMO CREDENTIALS HELPER
// ====================================

function fillDemoCredentials() {
    document.getElementById('email').value = 'demo@team.com';
    document.getElementById('password').value = 'demo123';
    
    showNotification('Demo credentials filled! Click Sign In to continue.', 'info');
}

// Add demo button (optional - you can remove this)
function addDemoButton() {
    const authModal = document.querySelector('.auth-modal');
    const demoBtn = document.createElement('button');
    demoBtn.type = 'button';
    demoBtn.className = 'btn-secondary';
    demoBtn.textContent = 'Use Demo Account';
    demoBtn.style.cssText = 'margin-top: 10px; background: #e9ecef; color: #495057;';
    demoBtn.onclick = fillDemoCredentials;
    
    authModal.insertBefore(demoBtn, authModal.querySelector('.auth-switch'));
}

// ====================================
// DOCUMENT READY
// ====================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded - Initializing auth system...');
    
    // Set up auth form
    document.getElementById('auth-switch-btn').onclick = toggleAuthMode;
    document.getElementById('auth-form').onsubmit = handleAuth;
    
    // Initialize username field properly (start in login mode)
    const usernameInput = document.getElementById('username');
    usernameInput.removeAttribute('required'); // Start without required since we're in login mode
    
    // Add demo button (optional)
    // addDemoButton();
    
    // Wait for all scripts to load before checking auth
    setTimeout(() => {
        console.log('🔍 Checking existing session...');
        checkAutoLogin();
    }, 100);
});