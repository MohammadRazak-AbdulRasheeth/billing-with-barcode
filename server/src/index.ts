import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';

// Load environment variables
dotenv.config();

import { setupSocketIO } from './socket';
import { getLocalIpAddress } from './utils/lanIp';
import productsRouter from './routes/products';
import invoicesRouter from './routes/invoices';
import reportsRouter from './routes/reports';
import settingsRouter from './routes/settings';
import networkRouter from './routes/network';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Enable CORS for LAN access
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);

app.use(express.json());

// Setup Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
setupSocketIO(io);

// Mount API Routes
app.use('/api/products', productsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/network', networkRouter);

// Health check & Database connection diagnostics endpoint
app.get('/api/health', async (_req, res) => {
  try {
    const { prisma } = await import('./db');
    // Test database connection by counting products
    const productCount = await prisma.product.count();
    res.json({
      status: 'ok',
      database: 'connected',
      productCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
  }
});

// Serve built React client in production
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('POS Server running. Start Vite dev server for frontend.');
    }
  });
});

// Start listening
server.listen(PORT, () => {
  const lanIp = getLocalIpAddress();
  console.log('====================================================');
  console.log(`🚀 POS Billing Server running on port ${PORT}`);
  console.log(`💻 Laptop Billing URL : http://localhost:5173`);
  console.log(`📱 Mobile Scanner URL : http://${lanIp}:5173/scanner`);
  console.log(`🗄️  Database Status    : MySQL (Prisma) Connected`);
  console.log('====================================================');
});
