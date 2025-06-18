// Main Application Controller - CSS Removed

// ====================================
// GLOBAL STATE
// ====================================

window.allItems = window.allItems || [];
window.currentCollection = window.currentCollection || 'all';

// ====================================
// NOTIFICATION SYSTEM
// ====================================

function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach(notification => {
        notification.remove();
    });
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 4000);
}

// ====================================
// KEYBOARD SHORTCUTS
// ====================================

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        // Cmd/Ctrl + K for search focus
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
            event.preventDefault();
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
        
        // Cmd/Ctrl + N for new item
        if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
            event.preventDefault();
            showAddItemModal();
        }
        
        // Escape to close modals
        if (event.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                activeModal.classList.remove('active');
            }
        }
    });
}

// ====================================
// DRAG & DROP FILE HANDLING
// ====================================

function setupDragAndDrop() {
    const fileUpload = document.querySelector('.file-upload');
    if (!fileUpload) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileUpload.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        fileUpload.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        fileUpload.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    fileUpload.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight(e) {
        fileUpload.classList.add('dragover');
    }
    
    function unhighlight(e) {
        fileUpload.classList.remove('dragover');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        handleFileSelection({ target: { files } });
    }
}

// ====================================
// AUTO-SAVE FUNCTIONALITY
// ====================================

function setupAutoSave() {
    const form = document.getElementById('add-item-form');
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
        input.addEventListener('input', debounce(saveFormData, 1000));
    });
    
    function saveFormData() {
        const formData = {
            title: document.getElementById('item-title')?.value || '',
            description: document.getElementById('item-description')?.value || '',
            collection: document.getElementById('item-collection')?.value || '',
            tags: document.getElementById('item-tags')?.value || '',
            url: document.getElementById('item-url')?.value || ''
        };
        
        localStorage.setItem('draft_item', JSON.stringify(formData));
    }
    
    function loadFormData() {
        const savedData = localStorage.getItem('draft_item');
        if (!savedData) return;
        
        try {
            const formData = JSON.parse(savedData);
            
            if (formData.title) document.getElementById('item-title').value = formData.title;
            if (formData.description) document.getElementById('item-description').value = formData.description;
            if (formData.collection) document.getElementById('item-collection').value = formData.collection;
            if (formData.tags) document.getElementById('item-tags').value = formData.tags;
            if (formData.url) document.getElementById('item-url').value = formData.url;
            
        } catch (error) {
            console.log('Failed to load draft data:', error);
        }
    }
    
    function clearFormData() {
        localStorage.removeItem('draft_item');
    }
    
    // Load saved data when modal opens
    const originalShowAddItemModal = window.showAddItemModal;
    window.showAddItemModal = function() {
        originalShowAddItemModal();
        setTimeout(loadFormData, 100);
    };
    
    // Clear saved data when form is submitted
    form.addEventListener('submit', clearFormData);
}

// ====================================
// RESPONSIVE BEHAVIOR
// ====================================

function setupResponsiveHandling() {
    function handleResize() {
        const container = document.querySelector('.container');
        const sidebar = document.querySelector('.sidebar');
        
        if (window.innerWidth <= 768) {
            container.style.flexDirection = 'column';
            sidebar.style.width = '100%';
            sidebar.style.height = 'auto';
        } else {
            container.style.flexDirection = 'row';
            sidebar.style.width = '280px';
            sidebar.style.height = 'auto';
        }
    }
    
    window.addEventListener('resize', debounce(handleResize, 250));
    handleResize(); // Initial call
}

// ====================================
// PERFORMANCE MONITORING
// ====================================

function setupPerformanceMonitoring() {
    // Check if API is available before setting up monitoring
    if (!window.api || typeof window.api.request !== 'function') {
        console.warn('API not available yet, skipping performance monitoring setup');
        return;
    }

    // Monitor API response times
    const originalRequest = window.api.request;
    window.api.request = async function(endpoint, options = {}) {
        const startTime = performance.now();
        
        try {
            const result = await originalRequest.call(this, endpoint, options);
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Log slow requests
            if (duration > 2000) {
                console.warn(`Slow API request: ${endpoint} took ${duration.toFixed(2)}ms`);
            }
            
            return result;
        } catch (error) {
            const endTime = performance.now();
            const duration = endTime - startTime;
            console.error(`API request failed: ${endpoint} (${duration.toFixed(2)}ms)`, error);
            throw error;
        }
    };
    
    // Monitor render performance
    let renderCount = 0;
    if (typeof window.renderItems === 'function') {
        const originalRenderItems = window.renderItems;
        window.renderItems = function() {
            const startTime = performance.now();
            renderCount++;
            
            const result = originalRenderItems.call(this);
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            if (duration > 100) {
                console.warn(`Slow render #${renderCount}: ${duration.toFixed(2)}ms`);
            }
            
            return result;
        };
    }
}

// ====================================
// ERROR BOUNDARY
// ====================================

function setupErrorHandling() {
    window.addEventListener('error', function(event) {
        console.error('Uncaught error:', event.error);
        showNotification('An unexpected error occurred. Please refresh the page.', 'error');
    });
    
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        showNotification('A network error occurred. Please check your connection.', 'error');
    });
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ====================================
// HEALTH CHECK
// ====================================

async function performHealthCheck() {
    // Make sure API is available
    if (!window.api || typeof window.api.healthCheck !== 'function') {
        console.log('API not ready for health check, skipping...');
        return;
    }

    try {
        const health = await window.api.healthCheck();
        if (health.status !== 'healthy') {
            showNotification('Server health check failed', 'error');
        } else {
            console.log('✅ Server health check passed');
        }
    } catch (error) {
        console.error('Health check failed:', error);
    }
}

// ====================================
// APPLICATION INITIALIZATION
// ====================================

function initializeApplication() {
    console.log('🚀 Initializing Team Creative Archive...');
    
    // Setup core features first
    setupKeyboardShortcuts();
    setupResponsiveHandling();
    setupErrorHandling();
    
    // Setup features that depend on DOM elements
    setTimeout(() => {
        setupDragAndDrop();
        setupAutoSave();
    }, 100);
    
    // Setup performance monitoring after API is ready
    setTimeout(() => {
        setupPerformanceMonitoring();
    }, 500);
    
    // Perform initial health check
    setTimeout(performHealthCheck, 2000);
    
    // Add helpful console messages for developers
    console.log('🎯 Keyboard shortcuts:');
    console.log('  • Cmd/Ctrl + K: Focus search');
    console.log('  • Cmd/Ctrl + N: New item');
    console.log('  • Escape: Close modals');
    
    console.log('✅ Application initialized successfully!');
}

// ====================================
// DOCUMENT READY
// ====================================

document.addEventListener('DOMContentLoaded', function() {
    initializeApplication();
    
    // Show loading indicator
    console.log('📱 Team Creative Archive is ready!');
});

// ====================================
// SERVICE WORKER (Optional)
// ====================================

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered:', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed:', registrationError);
            });
    }
}

// Uncomment to enable service worker
// registerServiceWorker();