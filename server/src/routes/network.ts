import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { getLocalIpAddress } from '../utils/lanIp';

const router = Router();

// GET /api/network/scanner-info - returns LAN IP and Pairing QR Code
router.get('/scanner-info', async (_req: Request, res: Response) => {
  try {
    const lanIp = getLocalIpAddress();
    const port = process.env.PORT || 5000;
    
    // In dev mode, client is usually on 5173, while backend is on 5000.
    // If client is served from express (production), client port is the same as server port.
    // We check origin or default to 5173 for dev
    const clientPort = process.env.CLIENT_PORT || 5173;
    const scannerUrl = `http://${lanIp}:${clientPort}/scanner`;

    const qrDataUrl = await QRCode.toDataURL(scannerUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    res.json({
      lanIp,
      serverPort: port,
      clientPort,
      scannerUrl,
      qrDataUrl,
    });
  } catch (error: any) {
    console.error('Error generating scanner info:', error);
    res.status(500).json({ error: 'Failed to generate scanner info' });
  }
});

export default router;
