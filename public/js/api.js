// API Client for Team Creative Archive

class ArchiveAPI {
    constructor() {
        this.baseURL = window.location.origin + '/api';
        this.token = localStorage.getItem('authToken');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { Authorization: `Bearer ${this.token}` }),
                ...options.headers,
            },
            ...options,
        };

        // Don't set Content-Type for FormData
        if (options.body instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        let lastError;
        const maxRetries = 2;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, config);
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || `HTTP error! status: ${response.status}`);
                }
                
                return response.json();
            } catch (error) {
                lastError = error;
                
                // Only retry on network errors, not on auth/validation errors
                if (attempt < maxRetries && (
                    error.name === 'TypeError' || // Network error
                    error.message.includes('fetch') ||
                    error.message.includes('Failed to fetch')
                )) {
                    console.log(`API request retry ${attempt + 1}/${maxRetries + 1} for ${endpoint}`);
                    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
                    continue;
                }
                
                // Don't retry on auth/validation errors
                break;
            }
        }
        
        console.error('API Request Error:', lastError);
        throw lastError;
    }

    // ====================================
    // AUTH METHODS
    // ====================================

    async login(email, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        
        this.token = response.token;
        localStorage.setItem('authToken', this.token);
        return response;
    }

    async register(username, email, password) {
        const response = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password }),
        });
        
        this.token = response.token;
        localStorage.setItem('authToken', this.token);
        return response;
    }

        // ====================================
    // SIMPLIFIED AUTH METHODS
    // ====================================

    async simpleLogin(username, password) {
        const response = await this.request('/auth/simple-login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        
        this.token = response.token;
        localStorage.setItem('authToken', this.token);
        return response;
    }

    logout() {
        this.token = null;
        localStorage.removeItem('authToken');
}

    // ====================================
    // COLLECTIONS METHODS
    // ====================================

    async getCollections() {
        return this.request('/collections');
    }

    async createCollection(data) {
        return this.request('/collections', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // ====================================
    // ARCHIVE ITEMS METHODS
    // ====================================

    async getItems(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/items?${query}`);
    }

    async createItem(formData) {
        return this.request('/items', {
            method: 'POST',
            body: formData,
        });
    }

    async updateItem(itemId, formData) {
        return this.request(`/items/${itemId}`, {
            method: 'PUT',
            body: formData,
        });
    }

    async deleteItem(itemId) {
        return this.request(`/items/${itemId}`, {
            method: 'DELETE',
        });
    }

    // ====================================
    // EXPORT METHODS
    // ====================================

    async exportData() {
        const response = await fetch(`${this.baseURL}/export`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Export failed');
        }

        // Get filename from Content-Disposition header or create default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'team-archive-export.json';
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }

        const blob = await response.blob();
        return { blob, filename };
    }

    // ====================================
    // HEALTH CHECK
    // ====================================

    async healthCheck() {
        try {
            const response = await fetch(`${window.location.origin}/health`);
            return response.json();
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }
}

// Create global API instance
window.api = new ArchiveAPI();