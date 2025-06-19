// Archive Core - Main data loading and rendering functionality

let allItems = [];
let currentCollection = 'all';
let selectedFiles = [];
let isDataLoading = false;
let dataLoadPromise = null;

// Make functions globally available
window.showItemDetails = showItemDetails;
window.closeItemDetails = closeItemDetails;
window.deleteItem = deleteItem;
window.selectCollection = selectCollection;
window.showAddItemModal = showAddItemModal;
window.closeModal = closeModal;
window.handleSearch = handleSearch;
window.clearSearch = clearSearch;
window.exportData = exportData;

// ====================================
// DATA LOADING
// ====================================

async function loadInitialData() {
    if (isDataLoading) {
        console.log('⏳ Data already loading, waiting for completion...');
        return dataLoadPromise;
    }
    
    isDataLoading = true;
    dataLoadPromise = loadInitialDataSequential();
    
    try {
        await dataLoadPromise;
    } catch (error) {
        console.error('Failed to load initial data:', error);
        showNotification('Failed to load data. Please refresh the page.', 'error');
    } finally {
        isDataLoading = false;
        dataLoadPromise = null;
    }
}

async function loadInitialDataSequential() {
    try {
        console.log('📊 Starting initial data load...');
        
        await waitForElement('archive-grid');
        await waitForElement('search-input');
        console.log('✅ DOM elements ready');
        
        await loadCollections();
        console.log('✅ Collections loaded');
        
        await delay(200);
        await loadArchiveItems();
        console.log('✅ Archive items loaded');
        
        await delay(100);
        updateCollectionCounts();
        console.log('✅ Collection counts updated');
        
        console.log('🎉 Initial data loading complete');
        
    } catch (error) {
        console.error('❌ Failed to load initial data:', error);
        throw error;
    }
}

async function loadArchiveItems() {
    try {
        console.log('🔄 Loading archive items...');
        
        const grid = document.getElementById('archive-grid');
        if (!grid) {
            throw new Error('Archive grid not found');
        }
        
        // Show loading state
        grid.innerHTML = `
            <div class="empty-state">
                <div style="width: 40px; height: 40px; border: 3px solid #e9ecef; border-top: 3px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                <h3>Loading items...</h3>
                <p>Please wait while we fetch your archive</p>
            </div>
        `;
        
        const params = {};
        if (currentCollection !== 'all') {
            params.collection = currentCollection;
        }
        
        const searchQuery = document.getElementById('search-input')?.value.trim();
        if (searchQuery) {
            params.search = searchQuery;
        }
        
        console.log('📡 Making API request with params:', params);
        
        // Retry logic for API calls
        let response;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                response = await window.api.getItems(params);
                console.log('✅ API response received:', response);
                break;
            } catch (error) {
                retryCount++;
                console.warn(`⚠️  API call failed (attempt ${retryCount}/${maxRetries}):`, error);
                if (retryCount >= maxRetries) {
                    throw error;
                }
                await delay(500 * retryCount);
            }
        }
        
        // Validate response and sort chronologically
        if (!response || !Array.isArray(response.items)) {
            console.warn('⚠️  Invalid API response:', response);
            allItems = [];
        } else {
            allItems = response.items.sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateB - dateA; // Newest first
            });
            
            console.log(`📊 Loaded and sorted ${allItems.length} items chronologically`);
        }
        
        await delay(50);
        renderItems();
        
    } catch (error) {
        console.error('❌ Failed to load items:', error);
        showNotification('Failed to load archive items', 'error');
        
        allItems = [];
        const grid = document.getElementById('archive-grid');
        if (grid) {
            renderItems();
        }
    }
}

async function loadCollections() {
    try {
        console.log('🔄 Loading collections...');
        const collections = await window.api.getCollections();
        console.log(`📁 Loaded ${collections.length} collections`);
        return collections;
    } catch (error) {
        console.error('Failed to load collections:', error);
        return [];
    }
}

// ====================================
// COLLECTION MANAGEMENT
// ====================================

async function selectCollection(collectionId) {
    console.log('🎯 selectCollection called with:', collectionId);
    currentCollection = collectionId;
    
    // Update active state
    document.querySelectorAll('.collection-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-collection="${collectionId}"]`).classList.add('active');
    
    // Update header
    const collectionNames = {
        'all': 'All Items',
        'inspiration': 'Inspiration',
        'design': 'Design',
        'research': 'Research',
        'resources': 'Resources'
    };
    document.getElementById('current-collection').textContent = collectionNames[collectionId];
    
    // Clear search and reload
    document.getElementById('search-input').value = '';
    console.log(`📁 Switching to collection: ${collectionNames[collectionId]}`);
    await loadArchiveItems();
}

function updateCollectionCounts() {
    const counts = {
        all: allItems.length,
        inspiration: allItems.filter(item => item.collection_name === 'Inspiration').length,
        design: allItems.filter(item => item.collection_name === 'Design').length,
        research: allItems.filter(item => item.collection_name === 'Research').length,
        resources: allItems.filter(item => item.collection_name === 'Resources').length
    };
    
    Object.keys(counts).forEach(collection => {
        const countEl = document.getElementById(`count-${collection}`);
        if (countEl) {
            countEl.textContent = counts[collection];
        }
    });
}

// ====================================
// ITEM RENDERING
// ====================================

function renderItems() {
    const grid = document.getElementById('archive-grid');
    
    if (!grid) {
        console.error('❌ Archive grid not found during render');
        return;
    }
    
    console.log(`🎨 Rendering ${allItems.length} items`);
    
    const searchQuery = document.getElementById('search-input')?.value.toLowerCase().trim();
    let filteredItems = [...allItems];
    
    // Apply search filter
    if (searchQuery) {
        filteredItems = filteredItems.filter(item => 
            item.title.toLowerCase().includes(searchQuery) ||
            (item.description && item.description.toLowerCase().includes(searchQuery)) ||
            (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
        );
        console.log(`🔍 Filtered to ${filteredItems.length} items for search: "${searchQuery}"`);
        
        // Re-sort filtered items to maintain chronological order
        filteredItems.sort((a, b) => {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return dateB - dateA;
        });
    }
    
    if (filteredItems.length === 0) {
        const emptyMessage = searchQuery ? 'No items found' : 'No items yet';
        const emptyDescription = searchQuery ? 'Try different search terms' : 'Start building your team archive!';
        
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>${emptyMessage}</h3>
                <p>${emptyDescription}</p>
                ${!searchQuery ? '<button class="btn-primary" onclick="window.showAddItemModal()" style="margin-top: 15px;">+ Add Your First Item</button>' : ''}
            </div>
        `;
        console.log('📭 Rendered empty state');
        return;
    }

    try {
        const itemsHTML = filteredItems.map((item, index) => {
            try {
                return createItemHTML(item);
            } catch (error) {
                console.error(`❌ Error creating HTML for item ${index}:`, error, item);
                return `<div class="archive-item" style="background: #fee; padding: 20px; text-align: center;">
                    <div style="color: #c33;">Error loading item: ${escapeHtml(item.title || 'Unknown')}</div>
                </div>`;
            }
        }).join('');
        
        grid.innerHTML = itemsHTML;
        console.log(`✅ Successfully rendered ${filteredItems.length} items in chronological order`);
        
        // Set up click event listeners after rendering
        setupItemClickListeners();
        
        // Trigger a custom event to indicate rendering is complete
        window.dispatchEvent(new CustomEvent('itemsRendered', { 
            detail: { count: filteredItems.length } 
        }));
        
    } catch (error) {
        console.error('❌ Critical error rendering items:', error);
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Error loading items</h3>
                <p>There was a problem displaying your archive items.</p>
                <button class="btn-primary" onclick="window.location.reload()" style="margin-top: 15px;">Refresh Page</button>
                <div style="margin-top: 10px; font-size: 12px; color: #666;">Error: ${error.message}</div>
            </div>
        `;
    }
}

function createItemHTML(item) {
    if (!item || !item.id) {
        console.warn('⚠️  Invalid item data:', item);
        return '';
    }
    
    const timeAgo = formatTimeAgo(new Date(item.created_at || Date.now()));
    const collectionIcons = {
        'Inspiration': '✨',
        'Design': '🎨', 
        'Research': '🔍',
        'Resources': '📎'
    };
    
    const hasFiles = item.files && Array.isArray(item.files) && item.files.length > 0;
    const firstFile = hasFiles ? item.files[0] : null;
    const collectionName = item.collection_name || 'Unknown';
    const authorName = item.author_username || 'Unknown';
    
    // Ensure tags is always an array
    const tags = Array.isArray(item.tags) ? item.tags : 
                 (typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()) : []);
    
    return `
        <div class="archive-item" data-id="${item.id}">
            <div class="item-header">
                ${hasFiles && firstFile && firstFile.mimetype && firstFile.mimetype.startsWith('image/') ? 
                    `<img src="/uploads/${firstFile.filename}" 
                          alt="${escapeHtml(item.title)}" 
                          loading="lazy"
                          onload="this.style.opacity='1'"
                          onerror="this.style.display='none'; this.parentNode.querySelector('.fallback-icon').style.display='flex'"
                          style="opacity: 0; transition: opacity 0.3s ease;">
                     <div class="fallback-icon" style="display: none; font-size: 3rem; width: 100%; height: 100%; align-items: center; justify-content: center; background: linear-gradient(45deg, #667eea, #764ba2); color: white;">${collectionIcons[collectionName] || '📄'}</div>` :
                    `<div style="font-size: 3rem">${collectionIcons[collectionName] || '📄'}</div>`
                }
                <div class="item-overlay">
                    <div class="overlay-text">Click to view details</div>
                </div>
            </div>
            <div class="item-content">
                <div class="item-title">${escapeHtml(item.title || 'Untitled')}</div>
                <div class="item-description">${escapeHtml(item.description || '')}</div>
                ${tags.length > 0 ? `
                    <div class="item-tags">
                        ${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="item-meta">
                    <div>
                        <div>By ${escapeHtml(authorName)}</div>
                        <div>${timeAgo}</div>
                    </div>
                    <div class="item-actions">
                        ${item.url ? `<button class="action-btn" onclick="window.open('${escapeHtml(item.url)}', '_blank')" title="Open Link">🔗</button>` : ''}
                        <button class="action-btn" onclick="window.showItemDetails(${item.id})" title="View & Edit">✏️ Edit</button>
                        <button class="action-btn" onclick="window.deleteItem(${item.id})" title="Delete">🗑️</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ====================================
// EVENT LISTENERS SETUP
// ====================================

function setupItemClickListeners() {
    console.log('🔗 Setting up click listeners...');
    
    document.querySelectorAll('.archive-item').forEach(item => {
        const itemId = item.dataset.id;
        
        item.removeEventListener('click', handleItemClick);
        item.addEventListener('click', handleItemClick);
        
        const actionBtns = item.querySelectorAll('.action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('🛑 Action button clicked, stopping propagation');
            });
        });
    });
    
    console.log(`✅ Set up listeners for ${document.querySelectorAll('.archive-item').length} items`);
}

function handleItemClick(event) {
    const itemId = event.currentTarget.dataset.id;
    console.log('🖱️ Item clicked! ID:', itemId);
    
    if (itemId) {
        showItemDetails(parseInt(itemId));
    } else {
        console.error('❌ No item ID found');
    }
}

// ====================================
// SEARCH FUNCTIONALITY
// ====================================

function handleSearch() {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
        renderItems();
    }, 300);
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    renderItems();
}

// ====================================
// ITEM CRUD OPERATIONS
// ====================================

async function handleAddItem(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    
    try {
        const formData = new FormData();
        formData.append('title', document.getElementById('item-title').value.trim());
        formData.append('description', document.getElementById('item-description').value.trim());
        formData.append('collection', document.getElementById('item-collection').value);
        formData.append('tags', document.getElementById('item-tags').value.trim());
        formData.append('url', document.getElementById('item-url').value.trim());
        
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });
        
        const newItem = await window.api.createItem(formData);
        
        // Insert new item at the beginning (newest first)
        allItems.unshift(newItem);
        
        // Re-sort to ensure chronological order is maintained
        allItems.sort((a, b) => {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return dateB - dateA;
        });
        
        console.log(`➕ Added new item "${newItem.title}" at the top`);
        
        renderItems();
        updateCollectionCounts();
        
        closeModal('add-item-modal');
        showNotification(`Added "${newItem.title}" to your archive!`);
        
    } catch (error) {
        console.error('Failed to add item:', error);
        showNotification('Failed to add item. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function deleteItem(itemId) {
    const item = allItems.find(item => item.id === itemId);
    if (!item) return;
    
    if (!confirm(`Are you sure you want to delete "${item.title}"?`)) {
        return;
    }
    
    try {
        await window.api.deleteItem(itemId);
        
        allItems = allItems.filter(item => item.id !== itemId);
        
        renderItems();
        updateCollectionCounts();
        showNotification(`Deleted "${item.title}"`);
        
        // Close modal if it's open for this item
        const modal = document.getElementById('item-details-modal');
        if (modal && modal.dataset.itemId == itemId) {
            closeItemDetails();
        }
        
    } catch (error) {
        console.error('Failed to delete item:', error);
        showNotification('Failed to delete item. Please try again.', 'error');
    }
}

// ====================================
// EXPORT FUNCTIONALITY
// ====================================

async function exportData() {
    try {
        const { blob, filename } = await window.api.exportData();
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Archive exported successfully!');
        
    } catch (error) {
        console.error('Export failed:', error);
        showNotification('Failed to export archive. Please try again.', 'error');
    }
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 7) {
        return date.toLocaleDateString();
    } else if (days > 0) {
        return `${days}d ago`;
    } else if (hours > 0) {
        return `${hours}h ago`;
    } else if (minutes > 0) {
        return `${minutes}m ago`;
    } else {
        return 'Just now';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

function waitForElement(elementId, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        function check() {
            const element = document.getElementById(elementId);
            if (element) {
                console.log(`✅ Element '${elementId}' found`);
                resolve(element);
                return;
            }
            
            if (Date.now() - startTime > timeout) {
                console.error(`❌ Timeout waiting for element '${elementId}'`);
                reject(new Error(`Timeout waiting for element: ${elementId}`));
                return;
            }
            
            setTimeout(check, 50);
        }
        
        check();
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}