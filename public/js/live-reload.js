// Live Reload Client (Development Only)

(function() {
    // Only enable in development
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout;

    function connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = function() {
            console.log('🔄 Live reload connected');
            reconnectAttempts = 0;
            
            // Clear any pending reconnect
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
        };

        ws.onmessage = function(event) {
            if (event.data === 'reload') {
                console.log('🔄 Live reload triggered - refreshing page...');
                
                // Add a small delay to ensure the server has processed changes
                setTimeout(() => {
                    window.location.reload();
                }, 100);
            }
        };

        ws.onclose = function() {
            console.log('🔄 Live reload disconnected');
            
            // Attempt to reconnect
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
                
                console.log(`🔄 Attempting to reconnect in ${delay/1000}s (${reconnectAttempts}/${maxReconnectAttempts})`);
                
                reconnectTimeout = setTimeout(() => {
                    connect();
                }, delay);
            } else {
                console.log('🔄 Live reload: Max reconnection attempts reached');
            }
        };

        ws.onerror = function(error) {
            console.log('🔄 Live reload connection error');
        };

        return ws;
    }

    // Start connection when page loads
    document.addEventListener('DOMContentLoaded', function() {
        // Small delay to let the server start up
        setTimeout(() => {
            connect();
        }, 1000);
    });

    // Visual indicator for live reload
    function addLiveReloadIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'live-reload-indicator';
        indicator.innerHTML = '🔄';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #28a745;
            color: white;
            padding: 5px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            opacity: 0.7;
            cursor: pointer;
            transition: opacity 0.3s;
        `;
        indicator.title = 'Live reload active';
        
        indicator.addEventListener('click', () => {
            window.location.reload();
        });
        
        document.body.appendChild(indicator);
        
        // Hide after 3 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.style.opacity = '0.3';
            }
        }, 3000);
    }

    // Add indicator when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addLiveReloadIndicator);
    } else {
        addLiveReloadIndicator();
    }

})();