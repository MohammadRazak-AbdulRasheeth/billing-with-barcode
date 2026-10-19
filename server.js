// Production server entry point for Hostinger Cloud/VPS Application
// Registers TypeScript execution on-the-fly and starts the Express + Socket.IO server
require('tsx/cjs');
require('./server/src/index.ts');
