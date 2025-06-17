// Signal script for triggering live reload
const WebSocket = require('ws');

console.log('🔄 Frontend files changed, signaling reload...');

// Connect to the live reload WebSocket
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
    // Send reload signal
    ws.send('reload');
    console.log('✅ Reload signal sent');
    
    // Close connection
    setTimeout(() => {
        ws.close();
        process.exit(0);
    }, 100);
});

ws.on('error', (error) => {
    console.log('⚠️  Could not connect to live reload server');
    process.exit(1);
});