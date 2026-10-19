import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { getLocalIpAddress } from '../utils/lanIp';

const router = Router();

// GET /api/network/scanner-info - returns Dynamic Host URL and Pairing QR Code
router.get('/scanner-info', async (req: Request, res: Response) => {
  try {
    const lanIp = getLocalIpAddress();
    const port = process.env.PORT || 5000;
    
    // Auto-detect if running on a public domain (e.g. Hostinger / custom domain)
    // or on local shop LAN Wi-Fi
    const hostHeader = req.get('host') || '';
    const isPublicDomain = hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1');

    let scannerUrl = '';
    if (isPublicDomain) {
      // Use the live public domain (e.g. https://snow-zebra-536121.hostingersite.com/scanner)
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      scannerUrl = `${protocol}://${hostHeader}/scanner`;
    } else {
      // Local development over Wi-Fi
      const clientPort = process.env.CLIENT_PORT || 5173;
      scannerUrl = `https://${lanIp}:${clientPort}/scanner`;
    }

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
