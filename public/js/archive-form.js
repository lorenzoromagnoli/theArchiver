// Archive Modal - Item details, editing, and file management

// Auto-save variables
let autoSaveTimeout = null;
let isAutoSaving = false;
let hasUnsavedChanges = false;
let modalSelectedFiles = [];

// ====================================
// ENHANCED TAGS SECTION
// ====================================

function populateTagsSection(item) {
    const tagsSection = document.getElementById('details-tags-section');
    const tagsContainer = document.getElementById('details-tags');
    const tags = Array.isArray(item.tags) ? item.tags : 
                 (typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()).filter(t => t) : []);
    
    // Update section header with add button
    const tagsHeader = tagsSection.querySelector('h3');
    tagsHeader.innerHTML = `
        Tags 
        <button class="inline-add-btn" onclick="addNewTag()" title="Add new tags">
            <span>+</span>
        </button>
    `;
    
    // Create tags display with full-width form below header
    tagsContainer.innerHTML = `
        <div class="add-tag-form" id="add-tag-form" style="display: none;">
            <input type="text" 
                   id="new-tag-input" 
                   placeholder="Enter tags separated by commas (e.g., design, inspiration, ui)" 
                   class="full-width-input"
                   onkeypress="handleTagInputKeypress(event)">
            <div class="tag-form-buttons">
                <button onclick="saveNewTags()" class="btn-sm btn-primary">Add Tags</button>
                <button onclick="cancelNewTag()" class="btn-sm btn-secondary">Cancel</button>
            </div>
        </div>
        <div class="tags-display" id="tags-display">
            ${tags.map(tag => createTagElement(tag)).join('')}
        </div>
    `;
    
    tagsSection.style.display = 'block';
}

function populateUrlsSection(item) {
    const urlSection = document.getElementById('details-url-section');
    const urlContainer = document.getElementById('details-url');
    
    // Parse existing URLs (single URL for now)
    const urls = item.url ? [{ url: item.url, label: 'Link' }] : [];
    
    // Update section header with add button
    const urlHeader = urlSection.querySelector('h3');
    urlHeader.innerHTML = `
        External Links 
        <button class="inline-add-btn" onclick="addNewUrl()" title="Add new link">
            <span>+</span>
        </button>
    `;
    
    // Create URLs display
    urlContainer.innerHTML = `
        <div class="urls-display" id="urls-display">
            ${urls.map((urlItem, index) => createUrlElement(urlItem, index)).join('')}
        </div>
        <div class="add-url-form" id="add-url-form" style="display: none;">
            <input type="url" 
                   id="new-url-input" 
                   placeholder="https://example.com" 
                   class="full-width-input"
                   onkeypress="handleUrlInputKeypress(event)">
            <div class="url-form-buttons">
                <button onclick="saveNewUrl()" class="btn-sm btn-primary">Add</button>
                <button onclick="cancelNewUrl()" class="btn-sm btn-secondary">Cancel</button>
            </div>
        </div>
    `;
    
    urlSection.style.display = 'block';
}

function createTagElement(tag) {
    const escapedTag = escapeHtml(tag);
    return `
        <span class="tag-pill" data-tag="${escapedTag}">
            ${escapedTag}
            <button class="tag-remove-btn" onclick="removeTag('${escapedTag}')" title="Remove tag">
                ×
            </button>
        </span>
    `;
}

function createUrlElement(urlItem, index) {
    const escapedUrl = escapeHtml(urlItem.url);
    const escapedLabel = escapeHtml(urlItem.label || 'Link');
    return `
        <div class="url-item" data-url="${escapedUrl}">
            <div class="url-content">
                <span class="url-label">${escapedLabel}</span>
                <span class="url-address">${escapedUrl}</span>
            </div>
            <div class="url-actions">
                <button class="url-action-btn" onclick="openUrl('${escapedUrl}')" title="Open link">
                    ↗️
                </button>
                <button class="url-action-btn delete" onclick="removeUrl('${escapedUrl}')" title="Remove link">
                    ×
                </button>
            </div>
        </div>
    `;
}

// ====================================
// TAG MANAGEMENT FUNCTIONS
// ====================================

function addNewTag() {
    document.getElementById('add-tag-form').style.display = 'block';
    document.getElementById('new-tag-input').focus();
}

function cancelNewTag() {
    document.getElementById('add-tag-form').style.display = 'none';
    document.getElementById('new-tag-input').value = '';
}

function saveNewTags() {
    const input = document.getElementById('new-tag-input');
    const inputValue = input.value.trim();
    
    if (!inputValue) return;
    
    // Split by commas and clean up tags
    const newTags = inputValue
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .filter(tag => tag.length <= 30);
    
    if (newTags.length === 0) {
        showNotification('Please enter at least one valid tag', 'error');
        return;
    }
    
    // Get existing tags
    const existingTags = Array.from(document.querySelectorAll('.tag-pill')).map(el => el.dataset.tag);
    
    // Filter out duplicates
    const duplicateTags = [];
    const uniqueNewTags = newTags.filter(tag => {
        if (existingTags.includes(tag)) {
            duplicateTags.push(tag);
            return false;
        }
        return true;
    });
    
    // Add unique tags to display
    const tagsDisplay = document.getElementById('tags-display');
    uniqueNewTags.forEach(tag => {
        tagsDisplay.insertAdjacentHTML('beforeend', createTagElement(tag));
    });
    
    // Clear form
    cancelNewTag();
    
    // Trigger auto-save
    if (uniqueNewTags.length > 0) {
        onFieldChange(getCurrentItemId());
    }
    
    // Show notification
    if (uniqueNewTags.length > 0 && duplicateTags.length > 0) {
        showNotification(`Added ${uniqueNewTags.length} tag(s). ${duplicateTags.length} duplicate(s) skipped.`, 'warning');
    } else if (uniqueNewTags.length > 0) {
        const tagText = uniqueNewTags.length === 1 ? 'tag' : 'tags';
        showNotification(`Added ${uniqueNewTags.length} ${tagText}: ${uniqueNewTags.join(', ')}`);
    } else if (duplicateTags.length > 0) {
        showNotification('All tags already exist', 'error');
    }
}

function removeTag(tag) {
    const tagElement = document.querySelector(`[data-tag="${tag}"]`);
    if (tagElement) {
        tagElement.remove();
        onFieldChange(getCurrentItemId());
        showNotification(`Removed tag: ${tag}`);
    }
}

function handleTagInputKeypress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        saveNewTags();
    } else if (event.key === 'Escape') {
        cancelNewTag();
    }
    
    // Show tag count preview
    const input = event.target;
    const value = input.value;
    
    if (value.includes(',')) {
        const tagCount = value.split(',').filter(t => t.trim()).length;
        input.title = `Will create ${tagCount} tag(s) when saved`;
    } else {
        input.title = 'Press Enter to save, Escape to cancel';
    }
}

// ====================================
// URL MANAGEMENT FUNCTIONS
// ====================================

function addNewUrl() {
    document.getElementById('add-url-form').style.display = 'block';
    document.getElementById('new-url-input').focus();
}

function cancelNewUrl() {
    document.getElementById('add-url-form').style.display = 'none';
    document.getElementById('new-url-input').value = '';
}

function saveNewUrl() {
    const input = document.getElementById('new-url-input');
    const newUrl = input.value.trim();
    
    if (!newUrl) return;
    
    // URL validation
    try {
        new URL(newUrl);
    } catch (e) {
        showNotification('Please enter a valid URL', 'error');
        return;
    }
    
    // Replace existing URL (for now)
    const urlsDisplay = document.getElementById('urls-display');
    urlsDisplay.innerHTML = createUrlElement({ url: newUrl, label: 'Link' }, 0);
    
    cancelNewUrl();
    onFieldChange(getCurrentItemId());
    showNotification('Link added successfully');
}

function removeUrl(url) {
    const urlElement = document.querySelector(`[data-url="${url}"]`);
    if (urlElement) {
        urlElement.remove();
        onFieldChange(getCurrentItemId());
        showNotification('Link removed');
    }
}

function openUrl(url) {
    window.open(url, '_blank');
}

function handleUrlInputKeypress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        saveNewUrl();
    } else if (event.key === 'Escape') {
        cancelNewUrl();
    }
}

// ====================================
// IMAGE AND FILE MANAGEMENT
// ====================================

function populateItemImages(item) {
    const imagesContainer = document.getElementById('details-images');
    
    if (!imagesContainer) {
        console.error('Images container not found');
        return;
    }
    
    if (!item.files || item.files.length === 0) {
        // Show collection icon as placeholder
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
        // Show first file icon
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
    
    // Show images
    if (imageFiles.length === 1) {
        const image = imageFiles[0];
        imagesContainer.innerHTML = `
            <div class="single-image">
                <div class="image-caption">${escapeHtml(image.original_name)}</div>
                <img src="/uploads/${image.filename}" 
                     alt="${escapeHtml(item.title)}" 
                     loading="lazy"
                     onclick="openImageFullscreen('${image.filename}', '${escapeHtml(item.title)}')"
                     onload="this.style.opacity='1'"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block'"
                     style="opacity: 0; transition: opacity 0.3s ease;">
                <div class="image-error" style="display: none; padding: 40px; text-align: center; color: #6c757d;">
                    📷 Image failed to load
                </div>
            </div>
        `;
    } else {
        // Multiple images gallery
        imagesContainer.innerHTML = `
            <div class="image-gallery">
                <div class="image-caption" id="main-image-caption">${escapeHtml(imageFiles[0].original_name)}</div>
                <div class="main-image">
                    <img id="main-gallery-image" 
                         src="/uploads/${imageFiles[0].filename}" 
                         alt="${escapeHtml(item.title)}"
                         loading="lazy"
                         onload="this.style.opacity='1'"
                         style="opacity: 0; transition: opacity 0.3s ease;"
                         onclick="openImageFullscreen('${imageFiles[0].filename}', '${escapeHtml(item.title)}')">
                </div>
                <div class="image-thumbnails">
                    ${imageFiles.map((image, index) => `
                        <img src="/uploads/${image.filename}" 
                             alt="${escapeHtml(image.original_name)}"
                             class="thumbnail ${index === 0 ? 'active' : ''}"
                             loading="lazy"
                             onload="this.style.opacity='1'"
                             style="opacity: 0; transition: opacity 0.3s ease;"
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
        <div class="file-item" id="file-${file.id}">
            <div class="file-icon">${getFileIconLarge(file.mimetype)}</div>
            <div class="file-info">
                <div class="file-name">${escapeHtml(file.original_name)}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <div class="file-actions">
                <button class="btn btn-secondary btn-sm" onclick="downloadFile('${file.filename}', '${escapeHtml(file.original_name)}')">
                    💾 Download
                </button>
                <button class="btn btn-secondary btn-sm" onclick="deleteFile(${file.id}, ${item.id})" style="color: #dc3545; margin-left: 8px;">
                    🗑️ Delete
                </button>
            </div>
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
    
    const fullscreenDiv = document.createElement('div');
    fullscreenDiv.className = 'fullscreen-image-viewer active';
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

async function deleteFile(fileId, itemId) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }
    
    try {
        await window.api.request(`/files/${fileId}`, {
            method: 'DELETE'
        });
        
        // Remove from DOM
        const fileElement = document.getElementById(`file-${fileId}`);
        if (fileElement) {
            fileElement.remove();
        }
        
        // Update local array
        const itemIndex = allItems.findIndex(item => item.id == itemId);
        if (itemIndex !== -1) {
            allItems[itemIndex].files = allItems[itemIndex].files.filter(f => f.id !== fileId);
            populateItemFiles(allItems[itemIndex]);
        }
        
        renderItems();
        showNotification('File deleted successfully');
        
    } catch (error) {
        console.error('❌ File deletion failed:', error);
        showNotification('Failed to delete file. Please try again.', 'error');
    }
}

// ====================================
// AUTO-SAVE FUNCTIONALITY
// ====================================

function setupInlineEditAutoSave(itemId) {
    console.log('🔧 Setting up auto-save for item:', itemId);
    
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
    }
    
    modalSelectedFiles = [];
    
    const editableElements = ['edit-title', 'edit-description', 'edit-collection'];
    
    editableElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('input', () => {
                onFieldChange(itemId);
            });
            
            element.addEventListener('blur', () => {
                if (hasUnsavedChanges) {
                    saveChangesNow(itemId);
                }
            });
            
            element.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    saveChangesNow(itemId);
                }
                if (e.key === 'Escape') {
                    element.blur();
                }
            });
        }
    });
    
    // File input handler
    const fileInput = document.getElementById('modal-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleModalFileSelection(e, itemId);
        });
    }
    
    updateSaveStatus('ready');
}

function handleModalFileSelection(event, itemId) {
    const files = Array.from(event.target.files);
    modalSelectedFiles = [...modalSelectedFiles, ...files];
    
    console.log('📎 Files selected for upload:', files.length);
    updateModalFilesList();
    
    if (files.length > 0) {
        uploadNewFiles(itemId, files);
    }
}

function updateModalFilesList() {
    const container = document.getElementById('modal-selected-files');
    if (!container) return;
    
    if (modalSelectedFiles.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = modalSelectedFiles.map((file, index) => `
        <div class="selected-file-item" style="display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 6px;">
            <span style="flex: 1; font-size: 13px;">${escapeHtml(file.name)}</span>
            <span style="font-size: 11px; color: #6c757d;">${formatFileSize(file.size)}</span>
            <button type="button" onclick="removeModalFile(${index})" style="background: #dc3545; color: white; border: none; border-radius: 3px; width: 20px; height: 20px; font-size: 11px; cursor: pointer;">×</button>
        </div>
    `).join('');
}

function removeModalFile(index) {
    modalSelectedFiles.splice(index, 1);
    updateModalFilesList();
}

async function uploadNewFiles(itemId, files) {
    if (isAutoSaving) return;
    
    console.log('📤 Uploading new files for item:', itemId);
    isAutoSaving = true;
    updateSaveStatus('saving');
    
    try {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });
        
        const response = await window.api.request(`/items/${itemId}/files`, {
            method: 'POST',
            body: formData
        });
        
        console.log('✅ Files uploaded successfully');
        
        // Update local array
        const itemIndex = allItems.findIndex(item => item.id == itemId);
        if (itemIndex !== -1) {
            const updatedItem = await window.api.request(`/items/${itemId}`);
            allItems[itemIndex] = updatedItem;
        }
        
        // Refresh displays
        const currentItem = allItems.find(item => item.id == itemId);
        if (currentItem) {
            populateItemFiles(currentItem);
            populateItemImages(currentItem);
        }
        
        renderItems();
        updateCollectionCounts();
        
        // Clear uploaded files
        const uploadedFileNames = files.map(f => f.name);
        modalSelectedFiles = modalSelectedFiles.filter(f => !uploadedFileNames.includes(f.name));
        updateModalFilesList();
        
        // Reset file input
        const fileInput = document.getElementById('modal-file-input');
        if (fileInput) {
            fileInput.value = '';
        }
        
        updateSaveStatus('saved');
        showNotification(`Uploaded ${files.length} file(s) successfully!`);
        
    } catch (error) {
        console.error('❌ File upload failed:', error);
        updateSaveStatus('error');
        showNotification('Failed to upload files. Please try again.', 'error');
    } finally {
        isAutoSaving = false;
    }
}

function onFieldChange(itemId) {
    hasUnsavedChanges = true;
    updateSaveStatus('editing');
    
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    
    autoSaveTimeout = setTimeout(() => {
        saveChangesNow(itemId);
    }, 10000);
    
    console.log('📝 Field changed, auto-save scheduled in 10s');
}

function collectCurrentTags() {
    const tagElements = document.querySelectorAll('.tag-pill');
    const tags = Array.from(tagElements).map(el => el.dataset.tag);
    return tags.join(', ');
}

function collectCurrentUrls() {
    const urlElements = document.querySelectorAll('.url-item');
    if (urlElements.length === 0) return '';
    const firstUrlElement = urlElements[0];
    return firstUrlElement ? firstUrlElement.dataset.url : '';
}

async function saveChangesNow(itemId) {
    if (isAutoSaving || !hasUnsavedChanges) {
        return;
    }
    
    console.log('💾 Auto-saving changes for item:', itemId);
    isAutoSaving = true;
    updateSaveStatus('saving');
    
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
    }
    
    try {
        const updatedData = {
            title: document.getElementById('edit-title')?.value?.trim() || '',
            description: document.getElementById('edit-description')?.value?.trim() || '',
            collection: document.getElementById('edit-collection')?.value || '',
            tags: collectCurrentTags(),
            url: collectCurrentUrls()
        };
        
        console.log('📤 Sending update:', updatedData);
        
        const updatedItem = await window.api.request(`/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify(updatedData)
        });
        
        // Update local array
        const index = allItems.findIndex(item => item.id == itemId);
        if (index !== -1) {
            allItems[index] = updatedItem;
        }
        
        renderItems();
        updateCollectionCounts();
        
        // Update timestamp in modal
        const updatedElement = document.getElementById('details-updated');
        const updatedItemElement = document.getElementById('details-updated-item');
        if (updatedElement && updatedItemElement) {
            updatedElement.textContent = new Date().toLocaleString();
            updatedItemElement.style.display = 'block';
        }
        
        hasUnsavedChanges = false;
        updateSaveStatus('saved');
        
        console.log('✅ Auto-save successful');
        
    } catch (error) {
        console.error('❌ Auto-save failed:', error);
        updateSaveStatus('error');
        showNotification('Failed to save changes. Please try again.', 'error');
    } finally {
        isAutoSaving = false;
    }
}

function updateSaveStatus(status) {
    const statusElement = document.getElementById('auto-save-status');
    if (!statusElement) return;
    
    const indicator = statusElement.querySelector('.save-indicator');
    const text = statusElement.querySelector('.save-text');
    
    if (!indicator || !text) return;
    
    switch (status) {
        case 'ready':
            indicator.textContent = '📝';
            text.textContent = 'Ready to edit';
            statusElement.className = 'auto-save-status ready';
            break;
            
        case 'editing':
            indicator.textContent = '✏️';
            text.textContent = 'Editing... (auto-save in 10s)';
            statusElement.className = 'auto-save-status editing';
            break;
            
        case 'saving':
            indicator.textContent = '💾';
            text.textContent = 'Saving changes...';
            statusElement.className = 'auto-save-status saving';
            break;
            
        case 'saved':
            indicator.textContent = '✅';
            text.textContent = 'Changes saved automatically';
            statusElement.className = 'auto-save-status saved';
            
            setTimeout(() => {
                updateSaveStatus('ready');
            }, 3000);
            break;
            
        case 'error':
            indicator.textContent = '❌';
            text.textContent = 'Failed to save changes';
            statusElement.className = 'auto-save-status error';
            
            setTimeout(() => {
                updateSaveStatus('ready');
            }, 5000);
            break;
    }
}

// ====================================
// MODAL MANAGEMENT
// ====================================

function closeItemDetails() {
    if (hasUnsavedChanges) {
        const currentItemId = getCurrentItemId();
        if (currentItemId && confirm('You have unsaved changes. Save before closing?')) {
            saveChangesNow(currentItemId).then(() => {
                closeItemDetailsModal();
            });
            return;
        }
    }
    
    closeItemDetailsModal();
}

function closeItemDetailsModal() {
    const modal = document.getElementById('item-details-modal');
    if (modal) {
        modal.classList.remove('active');
        
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = null;
        }
        hasUnsavedChanges = false;
        isAutoSaving = false;
        
        console.log('🔒 Modal closed, auto-save cleaned up');
    }
}

function getCurrentItemId() {
    const modal = document.getElementById('item-details-modal');
    return modal ? parseInt(modal.dataset.itemId) : null;
}
// ITEM DETAILS MODAL
// ====================================

function showItemDetails(itemId) {
    console.log('🔍 showItemDetails called with ID:', itemId);
    
    const item = allItems.find(item => item.id == itemId);
    if (!item) {
        console.error('❌ Item not found with ID:', itemId);
        showNotification('Item not found', 'error');
        return;
    }
    
    console.log('📖 Opening details for:', item.title);
    
    try {
        let modal = document.getElementById('item-details-modal');
        if (!modal) {
            console.log('🔧 Creating new modal...');
            modal = createItemDetailsModal();
            document.body.appendChild(modal);
        }
        
        populateItemDetailsModal(modal, item);
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
                        
                        <div class="info-section">
                            <h3>Add New Files</h3>
                            <div class="file-upload-section">
                                <div class="file-upload" onclick="document.getElementById('modal-file-input').click()">
                                    <input type="file" id="modal-file-input" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt" style="display: none;">
                                    <div>📁 Click to upload new files</div>
                                    <div style="font-size: 12px; margin-top: 5px; opacity: 0.7;">
                                        Images, videos, documents (max 10MB each)
                                    </div>
                                </div>
                                <div id="modal-selected-files" class="selected-files-preview"></div>
                            </div>
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
    modal.dataset.itemId = item.id;
    
    // Basic info - editable
    document.getElementById('details-title').innerHTML = `
        <input type="text" 
               id="edit-title" 
               value="${escapeHtml(item.title || 'Untitled')}"
               class="inline-edit-input title-input"
               placeholder="Item title">
    `;
    
    document.getElementById('details-description').innerHTML = `
        <textarea id="edit-description" 
                  class="inline-edit-textarea"
                  placeholder="Add a description..."
                  rows="4">${escapeHtml(item.description || '')}</textarea>
    `;
    
    document.getElementById('details-collection').innerHTML = `
        <select id="edit-collection" class="inline-edit-select">
            <option value="Inspiration" ${item.collection_name === 'Inspiration' ? 'selected' : ''}>✨ Inspiration</option>
            <option value="Design" ${item.collection_name === 'Design' ? 'selected' : ''}>🎨 Design</option>
            <option value="Research" ${item.collection_name === 'Research' ? 'selected' : ''}>🔍 Research</option>
            <option value="Resources" ${item.collection_name === 'Resources' ? 'selected' : ''}>📎 Resources</option>
        </select>
    `;
    
    document.getElementById('details-author').textContent = item.author_username || 'Unknown';
    document.getElementById('details-created').textContent = new Date(item.created_at).toLocaleString();
    
    // Updated date
    const updatedItem = document.getElementById('details-updated-item');
    if (item.updated_at && item.updated_at !== item.created_at) {
        document.getElementById('details-updated').textContent = new Date(item.updated_at).toLocaleString();
        updatedItem.style.display = 'block';
    } else {
        updatedItem.style.display = 'none';
    }
    
    // Enhanced Tags and URLs
    populateTagsSection(item);
    populateUrlsSection(item);
    
    // Images and Files
    populateItemImages(item);
    populateItemFiles(item);
    
    // Update footer
    const footer = modal.querySelector('.item-details-footer');
    footer.innerHTML = `
        <div class="auto-save-status" id="auto-save-status">
            <span class="save-indicator">💾</span>
            <span class="save-text">Changes saved automatically</span>
        </div>
        <button class="btn btn-secondary" onclick="deleteItem(${item.id})" style="color: #dc3545;">🗑️ Delete</button>
        <button class="btn btn-primary" onclick="closeItemDetails()">Done</button>
    `;
    
    setupInlineEditAutoSave(item.id);
}

// ====================================
// ENHANCED TAGS SECTION
// ====