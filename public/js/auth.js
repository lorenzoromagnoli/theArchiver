// Authentication Management - Complete Working Version

let currentUser = null;

// ====================================
// AUTH UI MANAGEMENT
// ====================================

function showAuth() {
    console.log('🔐 Showing auth screen');
    const authOverlay = document.getElementById('auth-overlay');
    const appContainer = document.getElementById('app-container');
    
    if (authOverlay) {
        authOverlay.style.display = 'flex';
        authOverlay.classList.remove('hidden');
        console.log('✅ Auth overlay shown');
    } else {
        console.error('❌ Auth overlay not found');
    }
    
    if (appContainer) {
        appContainer.style.display = 'none';
        appContainer.classList.add('hidden');
        console.log('✅ App container hidden');
    } else {
        console.error('❌ App container not found');
    }
}

function showApp() {
    console.log('📱 Showing app');
    const authOverlay = document.getElementById('auth-overlay');
    const appContainer = document.getElementById('app-container');
    
    if (authOverlay) {
        authOverlay.style.display = 'none';
        authOverlay.classList.add('hidden');
        console.log('✅ Auth overlay hidden');
    } else {
        console.error('❌ Auth overlay not found');
    }
    
    if (appContainer) {
        appContainer.style.display = 'flex';
        appContainer.classList.remove('hidden');
        console.log('✅ App container shown');
    } else {
        console.error('❌ App container not found');
    }
    
    // Force a repaint to ensure the transition happens
    if (appContainer) {
        appContainer.offsetHeight; // Trigger reflow
    }
}

function showAuthError(message) {
    console.log('❌ Auth error:', message);
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.innerHTML = `<div class="error">${message}</div>`;
        
        // Auto-clear error after 5 seconds
        setTimeout(() => {
            clearAuthError();
        }, 5000);
    }
}

function clearAuthError() {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.innerHTML = '';
    }
}

// ====================================
// SIMPLIFIED AUTH FORM HANDLING
// ====================================

async function handleAuth(event) {
    console.log('🔐 handleAuth called');
    event.preventDefault();
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (!usernameInput || !passwordInput) {
        console.error('❌ Username or password input not found');
        showAuthError('Form elements not found. Please refresh the page.');
        return;
    }
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    console.log('📝 Form data:', { username: username, passwordLength: password.length });
    
    // Basic validation
    if (!username || !password) {
        showAuthError('Please enter both username and password');
        return;
    }
    
    const submitBtn = document.getElementById('auth-submit');
    if (!submitBtn) {
        console.error('❌ Submit button not found');
        return;
    }
    
    const originalText = submitBtn.textContent;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing In...';
    clearAuthError(); // Clear any previous errors
    
    try {
        console.log('📡 Attempting login...');
        
        // Check if API is available
        if (!window.api) {
            throw new Error('API not available');
        }
        
        // Try simple login first
        let response;
        try {
            if (typeof window.api.simpleLogin === 'function') {
                console.log('🔑 Using simpleLogin method');
                response = await window.api.simpleLogin(username, password);
            } else {
                console.log('🔑 Using fallback login method');
                // Fallback to regular login with username as email
                response = await window.api.login(username, password);
            }
        } catch (apiError) {
            console.log('🔄 First login attempt failed, trying email login');
            // Try treating username as email
            response = await window.api.login(username, password);
        }
        
        console.log('✅ Login successful:', response);
        
        // Store user data
        currentUser = response.user;
        
        // Show success message
        if (typeof showNotification === 'function') {
            showNotification('Welcome back, ' + currentUser.username + '!');
        }
        
        console.log('🎯 Starting UI transition...');
        
        // Small delay to show success state
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Show loading state during transition
        showLoadingState();
        
        // Hide auth and show app
        showApp();
        updateUserInfo();
        
        console.log('📊 Loading initial data...');
        
        // Load initial data with error handling
        try {
            if (typeof loadInitialDataSequential === 'function') {
                await loadInitialDataSequential();
            } else if (typeof loadInitialData === 'function') {
                await loadInitialData();
            } else {
                console.warn('⚠️ No data loading function found');
            }
        } catch (dataError) {
            console.error('❌ Error loading initial data:', dataError);
            // Continue anyway, don't block the UI
        }
        
        // Hide loading state
        hideLoadingState();
        
        console.log('🎉 Login sequence complete!');
        
    } catch (error) {
        console.error('❌ Authentication error:', error);
        
        // Show user-friendly error messages
        let errorMessage = 'Login failed. Please try again.';
        
        if (error.message.includes('Invalid credentials') || 
            error.message.includes('not found') ||
            error.message.includes('401') ||
            error.message.includes('400')) {
            errorMessage = 'Invalid username or password. Please try again.';
        } else if (error.message.includes('network') || 
                   error.message.includes('fetch')) {
            errorMessage = 'Network error. Please check your connection.';
        } else if (error.message.includes('API not available')) {
            errorMessage = 'System not ready. Please refresh the page.';
        }
        
        showAuthError(errorMessage);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ====================================
// USER MANAGEMENT
// ====================================

function updateUserInfo() {
    console.log('👤 Updating user info:', currentUser);
    if (currentUser) {
        const userNameEl = document.getElementById('user-name');
        const userRoleEl = document.getElementById('user-role');
        const userAvatarEl = document.getElementById('user-avatar');
        
        if (userNameEl) userNameEl.textContent = currentUser.username;
        if (userRoleEl) userRoleEl.textContent = currentUser.role || 'Member';
        if (userAvatarEl) userAvatarEl.textContent = currentUser.username.charAt(0).toUpperCase();
    }
}

function logout() {
    console.log('👋 Logging out');
    // Clear API token
    if (window.api && typeof window.api.logout === 'function') {
        window.api.logout();
    }
    
    // Clear user data
    currentUser = null;
    
    // Clear application state
    clearApplicationState();
    
    // Show auth screen
    showAuth();
    
    if (typeof showNotification === 'function') {
        showNotification('Logged out successfully');
    }
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
    if (window.currentCollection) {
        window.currentCollection = 'all';
    }
    
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
    console.log('🔍 Checking auto-login');
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        console.log('🔐 No token found, showing auth');
        showAuth();
        return false;
    }
    
    try {
        console.log('🔑 Token found, validating...');
        
        // Show loading state
        showLoadingState();
        
        // Wait for API to be ready
        let attempts = 0;
        while ((!window.api || typeof window.api.getCollections !== 'function') && attempts < 10) {
            console.log('⏳ Waiting for API to be ready...');
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (!window.api || typeof window.api.getCollections !== 'function') {
            throw new Error('API not ready after waiting');
        }
        
        // Test token validity
        const collections = await window.api.getCollections();
        console.log('✅ Token valid, collections loaded:', collections.length);
        
        // If successful, we're logged in
        currentUser = { 
            username: 'User', 
            role: 'Member' 
        };
        
        // Show app and update UI
        showApp();
        updateUserInfo();
        
        // Load initial data
        try {
            if (typeof loadInitialDataSequential === 'function') {
                await loadInitialDataSequential();
            } else if (typeof loadInitialData === 'function') {
                await loadInitialData();
            }
        } catch (dataError) {
            console.error('❌ Error loading data during auto-login:', dataError);
            // Continue anyway
        }
        
        hideLoadingState();
        return true;
        
    } catch (error) {
        console.log('❌ Token validation failed:', error);
        
        // Clear invalid token
        localStorage.removeItem('authToken');
        if (window.api) {
            window.api.token = null;
        }
        
        hideLoadingState();
        showAuth();
        return false;
    }
}

// ====================================
// LOADING STATES
// ====================================

function showLoadingState() {
    console.log('⏳ Showing loading state');
    let loadingOverlay = document.getElementById('loading-overlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            backdrop-filter: blur(5px);
        `;
        loadingOverlay.innerHTML = `
            <div style="text-align: center; color: #2c3e50;">
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
        `;
        document.body.appendChild(loadingOverlay);
        
        // Add spin animation if not exists
        if (!document.getElementById('spin-animation-style')) {
            const style = document.createElement('style');
            style.id = 'spin-animation-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    loadingOverlay.style.display = 'flex';
}

function hideLoadingState() {
    console.log('✅ Hiding loading state');
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// ====================================
// DEMO HELPER
// ====================================

function fillDemoCredentials() {
    console.log('🎯 Filling demo credentials');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (usernameInput && passwordInput) {
        usernameInput.value = 'demo';
        passwordInput.value = 'demo123';
        if (typeof showNotification === 'function') {
            showNotification('Demo credentials filled! Click Sign In to continue.');
        }
    } else {
        console.error('❌ Could not find username/password inputs');
    }
}

// ====================================
// DEBUG HELPERS - Remove in production
// ====================================

function debugUIStates() {
    const authOverlay = document.getElementById('auth-overlay');
    const appContainer = document.getElementById('app-container');
    
    console.log('🔍 UI Debug States:');
    console.log('  Auth Overlay:', {
        exists: !!authOverlay,
        display: authOverlay?.style.display,
        classes: authOverlay?.classList.toString(),
        visible: authOverlay ? !authOverlay.classList.contains('hidden') : false
    });
    console.log('  App Container:', {
        exists: !!appContainer,
        display: appContainer?.style.display,
        classes: appContainer?.classList.toString(),
        visible: appContainer ? !appContainer.classList.contains('hidden') : false
    });
}

function forceShowApp() {
    console.log('🔧 Force showing app...');
    const authOverlay = document.getElementById('auth-overlay');
    const appContainer = document.getElementById('app-container');
    
    if (authOverlay) {
        authOverlay.style.display = 'none';
        authOverlay.classList.add('hidden');
    }
    
    if (appContainer) {
        appContainer.style.display = 'flex';
        appContainer.classList.remove('hidden');
    }
    
    debugUIStates();
}

function forceShowAuth() {
    console.log('🔧 Force showing auth...');
    const authOverlay = document.getElementById('auth-overlay');
    const appContainer = document.getElementById('app-container');
    
    if (authOverlay) {
        authOverlay.style.display = 'flex';
        authOverlay.classList.remove('hidden');
    }
    
    if (appContainer) {
        appContainer.style.display = 'none';
        appContainer.classList.add('hidden');
    }
    
    debugUIStates();
}

// Add debug state indicator
function addDebugIndicator() {
    if (document.getElementById('debug-indicator')) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'debug-indicator';
    indicator.className = 'debug-state';
    indicator.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 11px;
        z-index: 10000;
        font-family: monospace;
        cursor: pointer;
    `;
    indicator.innerHTML = 'Auth Debug';
    indicator.onclick = debugUIStates;
    document.body.appendChild(indicator);
    
    // Update indicator every second
    setInterval(() => {
        const authVisible = !document.getElementById('auth-overlay')?.classList.contains('hidden');
        const appVisible = !document.getElementById('app-container')?.classList.contains('hidden');
        
        indicator.innerHTML = `Auth: ${authVisible ? 'ON' : 'OFF'} | App: ${appVisible ? 'ON' : 'OFF'}`;
        indicator.style.background = authVisible ? 'rgba(220, 53, 69, 0.8)' : 'rgba(40, 167, 69, 0.8)';
    }, 1000);
}

// ====================================
// INITIALIZATION AND EVENT SETUP
// ====================================

function initializeAuth() {
    console.log('🚀 Initializing authentication system...');
    
    // Add debug indicator
    addDebugIndicator();
    
    // Initial UI state check
    setTimeout(() => {
        debugUIStates();
    }, 1000);
    
    // Find the auth form
    const authForm = document.getElementById('auth-form');
    if (!authForm) {
        console.error('❌ Auth form not found');
        return;
    }
    
    // Remove any existing event listeners
    authForm.onsubmit = null;
    
    // Add event listener
    authForm.addEventListener('submit', handleAuth);
    console.log('✅ Auth form event listener attached');
    
    // Also add click event to submit button as backup
    const submitBtn = document.getElementById('auth-submit');
    if (submitBtn) {
        submitBtn.addEventListener('click', function(event) {
            if (event.target.form) {
                handleAuth(event);
            }
        });
        console.log('✅ Submit button event listener attached');
    }
    
    // Focus username input
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.focus();
    }
    
    // Add enter key listeners to inputs
    ['username', 'password'].forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAuth(event);
                }
            });
        }
    });
    
    console.log('✅ Authentication system initialized');
}

// ====================================
// DOCUMENT READY
// ====================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded - Setting up auth system...');
    
    // Wait a bit for all scripts to load
    setTimeout(() => {
        initializeAuth();
        
        // Check for existing session
        setTimeout(() => {
            console.log('🔍 Checking existing session...');
            checkAutoLogin().then(() => {
                debugUIStates();
            });
        }, 500);
    }, 100);
});

// ====================================
// GLOBAL EXPORTS
// ====================================

// Make functions available globally
window.logout = logout;
window.showAuth = showAuth;
window.showApp = showApp;
window.fillDemoCredentials = fillDemoCredentials;
window.handleAuth = handleAuth;
window.debugUIStates = debugUIStates;
window.forceShowApp = forceShowApp;
window.forceShowAuth = forceShowAuth;

console.log('📜 Complete auth.js loaded successfully');