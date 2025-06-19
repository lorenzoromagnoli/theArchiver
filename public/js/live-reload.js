// COMPLETE REPLACEMENT for public/js/live-reload.js
// Enhanced debug version with extensive logging

(function() {
    console.log('🔄 Live reload script starting...');
    
    // Only enable in development
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.log('🔄 Live reload disabled - not localhost');
        return;
    }
    
    console.log('🔄 Live reload enabled for development');

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    let reconnectTimeout;
    let ws = null;
    let isConnected = false;

    function connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/live-reload`;
        
        console.log('🔄 Attempting to connect to:', wsUrl);
        
        try {
            ws = new WebSocket(wsUrl);
            console.log('🔄 WebSocket created, waiting for connection...');
        } catch (error) {
            console.error('🔄 Failed to create WebSocket:', error);
            scheduleReconnect();
            return;
        }

        ws.onopen = function(event) {
            console.log('✅ Live reload connected successfully!', event);
            isConnected = true;
            reconnectAttempts = 0;
            updateIndicator('connected');
            
            // Send a test message
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('client-connected');
            }
            
            // Clear any pending reconnect
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
        };

        ws.onmessage = function(event) {
            console.log('📨 Live reload message received:', event.data);
            
            if (event.data === 'reload') {
                console.log('🔄 RELOAD SIGNAL RECEIVED - refreshing page...');
                showReloadNotification();
                
                // Add a small delay to ensure the server has processed changes
                setTimeout(() => {
                    console.log('🔄 Executing page reload now...');
                    window.location.reload();
                }, 200);
            } else if (event.data === 'connected') {
                console.log('✅ Server confirmed connection');
            } else {
                console.log('📨 Unknown message:', event.data);
            }
        };

        ws.onclose = function(event) {
            console.log('❌ Live reload disconnected. Code:', event.code, 'Reason:', event.reason, 'Clean:', event.wasClean);
            isConnected = false;
            updateIndicator('disconnected');
            
            // Only attempt to reconnect if it wasn't a deliberate close
            if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
                scheduleReconnect();
            }
        };

        ws.onerror = function(error) {
            console.error('❌ Live reload WebSocket error:', error);
            isConnected = false;
            updateIndicator('error');
        };

        // Handle page unload
        window.addEventListener('beforeunload', function() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log('🔄 Page unloading, closing WebSocket');
                ws.close(1000, 'Page unloading');
            }
        });

        return ws;
    }

    function scheduleReconnect() {
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 5000);
            
            console.log(`🔄 Scheduling reconnect in ${delay/1000}s (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            updateIndicator('reconnecting', `Reconnecting in ${Math.ceil(delay/1000)}s...`);
            
            reconnectTimeout = setTimeout(() => {
                console.log(`🔄 Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts}`);
                connect();
            }, delay);
        } else {
            console.log('❌ Live reload: Max reconnection attempts reached');
            updateIndicator('failed');
        }
    }

    function showReloadNotification() {
        console.log('🔄 Showing reload notification');
        
        // Remove any existing notification
        const existing = document.getElementById('reload-notification');
        if (existing) {
            existing.remove();
        }
        
        // Create reload notification
        const notification = document.createElement('div');
        notification.id = 'reload-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.innerHTML = '🔄 Reloading page...';
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
    }

    function updateIndicator(status, message) {
        let indicator = document.getElementById('live-reload-indicator');
        if (!indicator) {
            console.log('⚠️ Indicator not found, will create it');
            return;
        }
        
        const statusConfig = {
            connected: { color: '#28a745', text: '🔄 Live', title: 'Live reload connected and working' },
            disconnected: { color: '#ffc107', text: '🔄 Off', title: 'Live reload disconnected' },
            reconnecting: { color: '#17a2b8', text: '🔄 ...', title: message || 'Reconnecting...' },
            error: { color: '#dc3545', text: '🔄 Err', title: 'Live reload error - check console' },
            failed: { color: '#6c757d', text: '🔄 X', title: 'Live reload failed after multiple attempts' }
        };
        
        const config = statusConfig[status] || statusConfig.disconnected;
        indicator.innerHTML = config.text;
        indicator.title = config.title;
        indicator.style.background = config.color;
        
        console.log(`🔄 Updated indicator to: ${status} (${config.text})`);
    }

    // Visual indicator for live reload
    function addLiveReloadIndicator() {
        if (document.getElementById('live-reload-indicator')) {
            console.log('🔄 Indicator already exists');
            return;
        }
        
        console.log('🔄 Creating live reload indicator');
        
        const indicator = document.createElement('div');
        indicator.id = 'live-reload-indicator';
        indicator.innerHTML = '🔄 Init';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #6c757d;
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            font-family: monospace;
            cursor: pointer;
            transition: all 0.3s ease;
            opacity: 0.9;
            user-select: none;
            border: 1px solid rgba(255,255,255,0.2);
        `;
        indicator.title = 'Live reload status - click for manual reload';
        
        indicator.addEventListener('click', () => {
            console.log('🔄 Indicator clicked');
            if (isConnected) {
                console.log('🔄 Manual reload triggered');
                window.location.reload();
            } else {
                console.log('🔄 Manual reconnect triggered');
                reconnectAttempts = 0;
                connect();
            }
        });
        
        indicator.addEventListener('mouseenter', () => {
            indicator.style.opacity = '1';
            indicator.style.transform = 'scale(1.05)';
        });
        
        indicator.addEventListener('mouseleave', () => {
            indicator.style.opacity = '0.9';
            indicator.style.transform = 'scale(1)';
        });
        
        document.body.appendChild(indicator);
        console.log('✅ Live reload indicator added to page');
        
        // Show indicator prominently for 5 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.style.opacity = '0.6';
            }
        }, 5000);
    }

    // Test function to trigger manual reload from console
    window.testLiveReload = function() {
        console.log('🧪 Testing live reload manually...');
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Simulate receiving a reload message
            ws.onmessage({ data: 'reload' });
        } else {
            console.log('❌ WebSocket not connected');
        }
    };

    // Initialize when DOM is ready
    function initialize() {
        console.log('🔄 Initializing live reload...');
        addLiveReloadIndicator();
        
        // Small delay to let the server start up
        setTimeout(() => {
            console.log('🔄 Starting connection attempt...');
            connect();
        }, 1000);
    }

    // Start connection when page loads
    if (document.readyState === 'loading') {
        console.log('🔄 DOM still loading, waiting...');
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        console.log('🔄 DOM already loaded, initializing now');
        initialize();
    }

    // Export for debugging
    window.liveReload = {
        connect,
        isConnected: () => isConnected,
        reconnect: () => {
            console.log('🔄 Manual reconnect requested');
            reconnectAttempts = 0;
            connect();
        },
        getStatus: () => ({
            connected: isConnected,
            attempts: reconnectAttempts,
            wsState: ws ? ws.readyState : 'no websocket'
        })
    };

    console.log('✅ Live reload script setup complete');
    console.log('💡 Debug commands:');
    console.log('   - window.testLiveReload() // Test reload manually');
    console.log('   - window.liveReload.getStatus() // Check connection status');
    console.log('   - window.liveReload.reconnect() // Force reconnect');

})();