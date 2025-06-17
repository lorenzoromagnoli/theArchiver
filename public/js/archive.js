// Archive Management

let allItems = [];
let currentCollection = 'all';
let selectedFiles = [];
let isDataLoading = false;
let dataLoadPromise = null;

// Make functions globally available
window.showItemDetails = showItemDetails;
window.closeItemDetails = closeItemDetails;
window.editItem = editItem;
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
    // Prevent multiple simultaneous loads
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
        
        // Wait for DOM to be fully ready
        await waitForElement('archive-grid');
        await waitForElement('search-input');
        
        console.log('✅ DOM elements ready');
        
        // Load collections first (they're static and fast)
        await loadCollections();
        console.log('✅ Collections loaded');
        
        // Small delay to ensure everything is settled
        await delay(200);
        
        // Then load archive items
        await loadArchiveItems();
        console.log('✅ Archive items loaded');
        
        // Update counts after everything is loaded
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
        
        // Ensure we have a fresh state
        const grid = document.getElementById('archive-grid');
        if (!grid) {
            throw new Error('Archive grid not found');
        }
        
        // Show loading state in grid
        grid.innerHTML = `
            <div class="empty-state">
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid #e9ecef;
                    border-top: 3px solid #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 15px;
                "></div>
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
        
        // Add retry logic for API calls
        let response;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                response = await window.api.getItems(params);
                console.log('✅ API response received:', response);
                break; // Success, exit retry loop
            } catch (error) {
                retryCount++;
                console.warn(`⚠️  API call failed (attempt ${retryCount}/${maxRetries}):`, error);
                if (retryCount >= maxRetries) {
                    throw error; // Re-throw if max retries reached
                }
                await delay(500 * retryCount); // Exponential backoff
            }
        }
        
        // Validate response
        if (!response || !Array.isArray(response.items)) {
            console.warn('⚠️  Invalid API response:', response);
            allItems = [];
        } else {
            // ✨ SORT ITEMS CHRONOLOGICALLY (newest first)
            allItems = response.items.sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateB - dateA; // Newest first (descending order)
            });
            
            console.log(`📊 Loaded and sorted ${allItems.length} items chronologically`);
            
            // Log first few items to verify sorting
            if (allItems.length > 0) {
                console.log('🕒 First 3 items by date:');
                allItems.slice(0, 3).forEach((item, index) => {
                    console.log(`  ${index + 1}. ${item.title} - ${new Date(item.created_at).toLocaleString()}`);
                });
            }
        }
        
        // Ensure we still have the grid element
        const currentGrid = document.getElementById('archive-grid');
        if (!currentGrid) {
            console.error('❌ Archive grid disappeared during loading');
            return;
        }
        
        // Render with a small delay to ensure DOM stability
        await delay(50);
        renderItems();
        
    } catch (error) {
        console.error('❌ Failed to load items:', error);
        showNotification('Failed to load archive items', 'error');
        
        // Set empty array as fallback and render
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
        
        // Collections are predefined in this simple version
        // Could render dynamic collections here if needed
        return collections;
    } catch (error) {
        console.error('Failed to load collections:', error);
        // Continue anyway since collections are predefined in HTML
        return [];
    }
}

// ====================================
// COLLECTION MANAGEMENT
// ====================================

async function selectCollection(collectionId) {
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
    
    // Clear search and reload with chronological sorting
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
    
    // Safety check - ensure grid exists
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
        
        // ✨ RE-SORT FILTERED ITEMS to maintain chronological order
        filteredItems.sort((a, b) => {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return dateB - dateA; // Newest first
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
        
        // Log the order for verification
        if (filteredItems.length > 0) {
            console.log('📅 Items rendered in order (newest first):');
            filteredItems.slice(0, 3).forEach((item, index) => {
                const date = new Date(item.created_at).toLocaleString();
                console.log(`  ${index + 1}. ${item.title} - ${date}`);
            });
        }
        
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

// ====================================
// EVENT LISTENERS SETUP
// ====================================

function setupItemClickListeners() {
    console.log('🔗 Setting up click listeners...');
    
    // Add event listeners to all archive items
    document.querySelectorAll('.archive-item').forEach(item => {
        const itemId = item.dataset.id;
        
        // Remove any existing listeners
        item.removeEventListener('click', handleItemClick);
        
        // Add click listener
        item.addEventListener('click', handleItemClick);
        
        // Prevent action buttons from triggering item click
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

function createItemHTML(item) {
    // Validate item data
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
                    `<img src="/uploads/${firstFile.filename}" alt="${escapeHtml(item.title)}" onerror="this.style.display='none'; this.parentNode.innerHTML='<div style=\\"font-size: 3rem\\">${collectionIcons[collectionName] || '📄'}</div>'">` :
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
                        <button class="action-btn" onclick="window.showItemDetails(${item.id})" title="View Details">👁️ View</button>
                        <button class="action-btn" onclick="window.editItem(${item.id})" title="Edit">✏️</button>
                        <button class="action-btn" onclick="window.deleteItem(${item.id})" title="Delete">🗑️</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ====================================
// ITEM DETAILS MODAL
// ====================================

function showItemDetails(itemId) {
    console.log('🔍 showItemDetails called with ID:', itemId);
    
    const item = allItems.find(item => item.id == itemId); // Use == for type flexibility
    if (!item) {
        console.error('❌ Item not found with ID:', itemId);
        console.log('Available items:', allItems.map(i => ({id: i.id, title: i.title})));
        showNotification('Item not found', 'error');
        return;
    }
    
    console.log('📖 Opening details for:', item.title);
    
    try {
        // Create or get the details modal
        let modal = document.getElementById('item-details-modal');
        if (!modal) {
            console.log('🔧 Creating new modal...');
            modal = createItemDetailsModal();
            document.body.appendChild(modal);
        }
        
        // Populate modal with item data
        populateItemDetailsModal(modal, item);
        
        // Show modal
        modal.classList.add('active');
        console.log('✅ Modal opened successfully');
        
        // Add escape key listener
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeItemDetails();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
    } catch (error) {
        console.error('❌ Error opening item details:', error);
        showNotification('Failed to open item details', 'error');
    }
}

function createItemDetailsModal() {
    console.log('🏗️ Creating item details modal...');
    
    const modal = document.createElement('div');
    modal.className = 'modal item-details-modal';
    modal.id = 'item-details-modal';
    
    modal.innerHTML = `
        <div class="modal-content item-details-content">
            <div class="item-details-header">
                <h2 id="details-title">Item Details</h2>
                <button class="close-details-btn" onclick="closeItemDetails()" title="Close">×</button>
            </div>
            
            <div class="item-details-body">
                <div class="item-details-main">
                    <div class="item-images" id="details-images">
                        <!-- Images will be populated here -->
                    </div>
                    
                    <div class="item-info">
                        <div class="info-section">
                            <h3>Description</h3>
                            <p id="details-description" class="description-text">Loading...</p>
                        </div>
                        
                        <div class="info-section" id="details-tags-section" style="display: none;">
                            <h3>Tags</h3>
                            <div id="details-tags" class="tags-container"></div>
                        </div>
                        
                        <div class="info-section" id="details-url-section" style="display: none;">
                            <h3>External Link</h3>
                            <a id="details-url" href="#" target="_blank" class="external-link"></a>
                        </div>
                        
                        <div class="info-section">
                            <h3>Details</h3>
                            <div class="details-grid">
                                <div class="detail-item">
                                    <strong>Collection:</strong>
                                    <span id="details-collection">-</span>
                                </div>
                                <div class="detail-item">
                                    <strong>Created by:</strong>
                                    <span id="details-author">-</span>
                                </div>
                                <div class="detail-item">
                                    <strong>Created:</strong>
                                    <span id="details-created">-</span>
                                </div>
                                <div class="detail-item" id="details-updated-item" style="display: none;">
                                    <strong>Updated:</strong>
                                    <span id="details-updated">-</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="info-section" id="details-files-section" style="display: none;">
                            <h3>Attached Files</h3>
                            <div id="details-files" class="files-container"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="item-details-footer" id="details-footer">
                <button class="btn btn-secondary" onclick="closeItemDetails()">Close</button>
            </div>
        </div>
    `;
    
    // Add click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeItemDetails();
        }
    });
    
    console.log('✅ Modal created successfully');
    return modal;
}

function populateItemDetailsModal(modal, item) {
    // Store current item ID for actions
    modal.dataset.itemId = item.id;
    
    // Basic info
    document.getElementById('details-title').textContent = item.title || 'Untitled';
    document.getElementById('details-description').textContent = item.description || 'No description provided.';
    document.getElementById('details-collection').textContent = item.collection_name || 'Unknown';
    document.getElementById('details-author').textContent = item.author_username || 'Unknown';
    document.getElementById('details-created').textContent = new Date(item.created_at).toLocaleString();
    
    // Updated date (only show if different from created)
    const updatedItem = document.getElementById('details-updated-item');
    if (item.updated_at && item.updated_at !== item.created_at) {
        document.getElementById('details-updated').textContent = new Date(item.updated_at).toLocaleString();
        updatedItem.style.display = 'block';
    } else {
        updatedItem.style.display = 'none';
    }
    
    // Tags
    const tagsSection = document.getElementById('details-tags-section');
    const tagsContainer = document.getElementById('details-tags');
    const tags = Array.isArray(item.tags) ? item.tags : 
                 (typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()) : []);
    
    if (tags.length > 0) {
        tagsContainer.innerHTML = tags.map(tag => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('');
        tagsSection.style.display = 'block';
    } else {
        tagsSection.style.display = 'none';
    }
    
    // URL
    const urlSection = document.getElementById('details-url-section');
    const urlLink = document.getElementById('details-url');
    if (item.url) {
        urlLink.href = item.url;
        urlLink.textContent = item.url;
        urlSection.style.display = 'block';
    } else {
        urlSection.style.display = 'none';
    }
    
    // Images
    populateItemImages(item);
    
    // Files
    populateItemFiles(item);
    
    // Update footer buttons
    const footer = modal.querySelector('.item-details-footer');
    footer.innerHTML = `
        <button class="btn btn-secondary" onclick="editItem(${item.id})">✏️ Edit</button>
        <button class="btn btn-secondary" onclick="deleteItem(${item.id})" style="color: #dc3545;">🗑️ Delete</button>
        ${item.url ? `<button class="btn btn-secondary" onclick="window.open('${escapeHtml(item.url)}', '_blank')">🔗 Open Link</button>` : ''}
        <button class="btn btn-primary" onclick="closeItemDetails()">Close</button>
    `;
}

function populateItemImages(item) {
    const imagesContainer = document.getElementById('details-images');
    
    if (!imagesContainer) {
        console.error('Images container not found');
        return;
    }
    
    if (!item.files || item.files.length === 0) {
        // Show collection icon as large placeholder
        const collectionIcons = {
            'Inspiration': '✨',
            'Design': '🎨', 
            'Research': '🔍',
            'Resources': '📎'
        };
        
        imagesContainer.innerHTML = `
            <div class="large-placeholder">
                <div class="placeholder-icon">${collectionIcons[item.collection_name] || '📄'}</div>
                <div class="placeholder-text">${item.collection_name || 'Item'}</div>
            </div>
        `;
        return;
    }
    
    const imageFiles = item.files.filter(file => 
        file.mimetype && file.mimetype.startsWith('image/')
    );
    
    if (imageFiles.length === 0) {
        // Show first file icon or collection icon
        const firstFile = item.files[0];
        const fileIcon = getFileIconLarge(firstFile.mimetype);
        
        imagesContainer.innerHTML = `
            <div class="large-placeholder">
                <div class="placeholder-icon">${fileIcon}</div>
                <div class="placeholder-text">${escapeHtml(firstFile.original_name)}</div>
                <button class="btn btn-secondary" onclick="downloadFile('${firstFile.filename}', '${escapeHtml(firstFile.original_name)}')" style="margin-top: 15px;">
                    💾 Download
                </button>
            </div>
        `;
        return;
    }
    
    // Show images in a gallery
    if (imageFiles.length === 1) {
        // Single large image
        const image = imageFiles[0];
        imagesContainer.innerHTML = `
            <div class="single-image">
                <img src="/uploads/${image.filename}" 
                     alt="${escapeHtml(item.title)}" 
                     onclick="openImageFullscreen('${image.filename}', '${escapeHtml(item.title)}')"
                     onerror="this.parentNode.innerHTML='<div class=\\"image-error\\">Failed to load image</div>'">
                <div class="image-caption">${escapeHtml(image.original_name)}</div>
            </div>
        `;
    } else {
        // Multiple images gallery
        imagesContainer.innerHTML = `
            <div class="image-gallery">
                <div class="main-image">
                    <img id="main-gallery-image" 
                         src="/uploads/${imageFiles[0].filename}" 
                         alt="${escapeHtml(item.title)}"
                         onclick="openImageFullscreen('${imageFiles[0].filename}', '${escapeHtml(item.title)}')">
                    <div class="image-caption" id="main-image-caption">${escapeHtml(imageFiles[0].original_name)}</div>
                </div>
                <div class="image-thumbnails">
                    ${imageFiles.map((image, index) => `
                        <img src="/uploads/${image.filename}" 
                             alt="${escapeHtml(image.original_name)}"
                             class="thumbnail ${index === 0 ? 'active' : ''}"
                             onclick="switchGalleryImage('${image.filename}', '${escapeHtml(image.original_name)}', this)">
                    `).join('')}
                </div>
            </div>
        `;
    }
}

function populateItemFiles(item) {
    const filesSection = document.getElementById('details-files-section');
    const filesContainer = document.getElementById('details-files');
    
    if (!item.files || item.files.length === 0) {
        filesSection.style.display = 'none';
        return;
    }
    
    const nonImageFiles = item.files.filter(file => 
        !file.mimetype || !file.mimetype.startsWith('image/')
    );
    
    if (nonImageFiles.length === 0) {
        filesSection.style.display = 'none';
        return;
    }
    
    filesContainer.innerHTML = nonImageFiles.map(file => `
        <div class="file-item">
            <div class="file-icon">${getFileIconLarge(file.mimetype)}</div>
            <div class="file-info">
                <div class="file-name">${escapeHtml(file.original_name)}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="downloadFile('${file.filename}', '${escapeHtml(file.original_name)}')">
                💾 Download
            </button>
        </div>
    `).join('');
    
    filesSection.style.display = 'block';
}

// ====================================
// IMAGE GALLERY FUNCTIONS
// ====================================

function switchGalleryImage(filename, originalName, thumbnail) {
    try {
        const mainImage = document.getElementById('main-gallery-image');
        const mainCaption = document.getElementById('main-image-caption');
        
        if (!mainImage || !mainCaption) {
            console.error('Gallery elements not found');
            return;
        }
        
        mainImage.src = `/uploads/${filename}`;
        mainImage.onclick = () => openImageFullscreen(filename, originalName);
        mainCaption.textContent = originalName;
        
        // Update thumbnail active state
        document.querySelectorAll('.thumbnail').forEach(thumb => {
            thumb.classList.remove('active');
        });
        thumbnail.classList.add('active');
        
        console.log('🖼️ Switched gallery image:', originalName);
    } catch (error) {
        console.error('❌ Error switching gallery image:', error);
    }
}

function openImageFullscreen(filename, title) {
    console.log('🖼️ Opening fullscreen image:', filename);
    
    // Create fullscreen image viewer
    const fullscreenDiv = document.createElement('div');
    fullscreenDiv.className = 'fullscreen-image-viewer';
    fullscreenDiv.innerHTML = `
        <div class="fullscreen-overlay" onclick="closeFullscreenImage()">
            <img src="/uploads/${filename}" alt="${escapeHtml(title)}" onclick="event.stopPropagation()">
            <div class="fullscreen-controls">
                <button onclick="closeFullscreenImage()">× Close</button>
                <button onclick="downloadFile('${filename}', '${escapeHtml(title)}')">💾 Download</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(fullscreenDiv);
    
    // Add escape key listener
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeFullscreenImage();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

function closeFullscreenImage() {
    const viewer = document.querySelector('.fullscreen-image-viewer');
    if (viewer) {
        document.body.removeChild(viewer);
    }
}

// ====================================
// MODAL MANAGEMENT
// ====================================

function closeItemDetails() {
    const modal = document.getElementById('item-details-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function getCurrentItemId() {
    const modal = document.getElementById('item-details-modal');
    return modal ? parseInt(modal.dataset.itemId) : null;
}

// ====================================
// FILE MANAGEMENT
// ====================================

function getFileIconLarge(mimetype) {
    if (!mimetype) return '📄';
    
    const iconMap = {
        'application/pdf': '📄',
        'application/msword': '📝',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
        'text/plain': '📄',
        'video/mp4': '🎥',
        'video/quicktime': '🎥',
        'video/x-msvideo': '🎥',
        'application/zip': '📦',
        'application/x-zip-compressed': '📦',
    };
    
    return iconMap[mimetype] || '📎';
}

function downloadFile(filename, originalName) {
    try {
        const link = document.createElement('a');
        link.href = `/uploads/${filename}`;
        link.download = originalName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(`Downloading ${originalName}...`);
        console.log('💾 Download started:', originalName);
    } catch (error) {
        console.error('❌ Download failed:', error);
        showNotification('Download failed. Please try again.', 'error');
    }
}

function createItemHTML(item) {
    const timeAgo = formatTimeAgo(new Date(item.created_at));
    const collectionIcons = {
        'Inspiration': '✨',
        'Design': '🎨', 
        'Research': '🔍',
        'Resources': '📎'
    };
    
    const hasFiles = item.files && item.files.length > 0;
    const firstFile = hasFiles ? item.files[0] : null;
    
    return `
        <div class="archive-item" data-id="${item.id}">
            <div class="item-header">
                ${hasFiles && firstFile.mimetype.startsWith('image/') ? 
                    `<img src="/uploads/${firstFile.filename}" alt="${item.title}" onerror="this.style.display='none'; this.parentNode.innerHTML='<div style=\\"font-size: 3rem\\">${collectionIcons[item.collection_name] || '📄'}</div>'">` :
                    `<div style="font-size: 3rem">${collectionIcons[item.collection_name] || '📄'}</div>`
                }
            </div>
            <div class="item-content">
                <div class="item-title">${escapeHtml(item.title)}</div>
                <div class="item-description">${escapeHtml(item.description || '')}</div>
                ${item.tags && item.tags.length > 0 ? `
                    <div class="item-tags">
                        ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="item-meta">
                    <div>
                        <div>By ${escapeHtml(item.author_username || 'Unknown')}</div>
                        <div>${timeAgo}</div>
                    </div>
                    <div class="item-actions">
                        ${item.url ? `<button class="action-btn" onclick="window.open('${escapeHtml(item.url)}', '_blank')" title="Open Link">🔗</button>` : ''}
                        ${hasFiles ? `<button class="action-btn" onclick="viewFiles(${item.id})" title="View Files">📎 ${item.files.length}</button>` : ''}
                        <button class="action-btn" onclick="editItem(${item.id})" title="Edit">✏️</button>
                        <button class="action-btn" onclick="deleteItem(${item.id})" title="Delete">🗑️</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ====================================
// SEARCH FUNCTIONALITY
// ====================================

function handleSearch() {
    // Simple debounce
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
// ITEM FORM MANAGEMENT
// ====================================

function showAddItemModal() {
    const modal = document.getElementById('add-item-modal');
    modal.classList.add('active');
    
    // Reset form
    document.getElementById('add-item-form').reset();
    document.getElementById('selected-files').innerHTML = '';
    selectedFiles = [];
    
    // Reset form submit handler
    document.getElementById('add-item-form').onsubmit = handleAddItem;
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ====================================
// FILE MANAGEMENT
// ====================================

function handleFileSelection(event) {
    const files = Array.from(event.target.files);
    selectedFiles = files;
    updateFilesList();
}

function updateFilesList() {
    const container = document.getElementById('selected-files');
    
    if (selectedFiles.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = selectedFiles.map((file, index) => `
        <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 6px;">
            <span style="flex: 1; font-size: 13px;">${escapeHtml(file.name)}</span>
            <span style="font-size: 11px; color: #6c757d;">${formatFileSize(file.size)}</span>
            <button type="button" onclick="removeFile(${index})" style="background: #dc3545; color: white; border: none; border-radius: 3px; width: 20px; height: 20px; font-size: 11px; cursor: pointer;">×</button>
        </div>
    `).join('');
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    
    // Update file input
    const fileInput = document.getElementById('item-files');
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;
    
    updateFilesList();
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
        
        // Add files
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });
        
        const newItem = await window.api.createItem(formData);
        
        // ✨ INSERT NEW ITEM AT THE BEGINNING (newest first)
        allItems.unshift(newItem);
        
        // Re-sort to ensure chronological order is maintained
        allItems.sort((a, b) => {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return dateB - dateA; // Newest first
        });
        
        console.log(`➕ Added new item "${newItem.title}" at the top`);
        
        renderItems();
        updateCollectionCounts();
        
        // Close modal and show success
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

async function editItem(itemId) {
    const item = allItems.find(item => item.id === itemId);
    if (!item) return;
    
    // Pre-fill form with existing data
    document.getElementById('item-title').value = item.title;
    document.getElementById('item-description').value = item.description || '';
    document.getElementById('item-collection').value = item.collection_name;
    document.getElementById('item-tags').value = item.tags ? item.tags.join(', ') : '';
    document.getElementById('item-url').value = item.url || '';
    
    // Clear files (editing files not implemented in this simple version)
    document.getElementById('item-files').value = '';
    selectedFiles = [];
    updateFilesList();
    
    // Show modal
    showAddItemModal();
    
    // Change form behavior to update
    document.getElementById('add-item-form').onsubmit = async function(event) {
        event.preventDefault();
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
        
        try {
            // Note: This is a simplified update - in a real app you'd handle file updates
            const formData = new FormData();
            formData.append('title', document.getElementById('item-title').value.trim());
            formData.append('description', document.getElementById('item-description').value.trim());
            formData.append('collection', document.getElementById('item-collection').value);
            formData.append('tags', document.getElementById('item-tags').value.trim());
            formData.append('url', document.getElementById('item-url').value.trim());
            
            // For simplicity, we'll use a JSON request for updates
            const updateData = {
                title: document.getElementById('item-title').value.trim(),
                description: document.getElementById('item-description').value.trim(),
                collection: document.getElementById('item-collection').value,
                tags: document.getElementById('item-tags').value.trim(),
                url: document.getElementById('item-url').value.trim()
            };
            
            const updatedItem = await window.api.request(`/items/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            // Update local array
            const index = allItems.findIndex(item => item.id === itemId);
            if (index !== -1) {
                allItems[index] = updatedItem;
            }
            
            renderItems();
            updateCollectionCounts();
            closeModal('add-item-modal');
            showNotification(`Updated "${updatedItem.title}"!`);
            
        } catch (error) {
            console.error('Failed to update item:', error);
            showNotification('Failed to update item. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    };
}

async function deleteItem(itemId) {
    const item = allItems.find(item => item.id === itemId);
    if (!item) return;
    
    if (!confirm(`Are you sure you want to delete "${item.title}"?`)) {
        return;
    }
    
    try {
        await window.api.deleteItem(itemId);
        
        // Remove from local array
        allItems = allItems.filter(item => item.id !== itemId);
        
        renderItems();
        updateCollectionCounts();
        showNotification(`Deleted "${item.title}"`);
        
    } catch (error) {
        console.error('Failed to delete item:', error);
        showNotification('Failed to delete item. Please try again.', 'error');
    }
}

function viewFiles(itemId) {
    const item = allItems.find(item => item.id === itemId);
    if (!item || !item.files || item.files.length === 0) return;
    
    // Simple file viewer - just open first file
    const firstFile = item.files[0];
    window.open(`/uploads/${firstFile.filename}`, '_blank');
}

// ====================================
// EXPORT FUNCTIONALITY
// ====================================

async function exportData() {
    try {
        const { blob, filename } = await window.api.exportData();
        
        // Create download link
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

// Helper function to wait for DOM elements
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

// Helper function for delays
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ====================================
// EVENT LISTENERS
// ====================================

document.addEventListener('DOMContentLoaded', function() {
    // File input change handler
    const fileInput = document.getElementById('item-files');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }
    
    // Close modals when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
});