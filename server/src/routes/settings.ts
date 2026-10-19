import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

// GET /api/settings - get all shop settings as a key-value map
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settingsList = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const item of settingsList) {
      settingsMap[item.key] = item.value;
    }
    res.json(settingsMap);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - update multiple settings
router.put('/', async (req: Request, res: Response) => {
  try {
    const settingsToUpdate = req.body; // e.g. { SHOP_NAME: "My Shop", ... }

    if (!settingsToUpdate || typeof settingsToUpdate !== 'object') {
      return res.status(400).json({ error: 'Invalid settings payload' });
    }

    const updates = Object.entries(settingsToUpdate).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );

    await prisma.$transaction(updates);

    const refreshedList = await prisma.setting.findMany();
    const refreshedMap: Record<string, string> = {};
    for (const item of refreshedList) {
      refreshedMap[item.key] = item.value;
    }

    res.json(refreshedMap);
  } catch (error: any) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
