import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

// Helper to generate a unique random EAN-13 or Code-128 barcode
function generateInternalBarcode(): string {
  // 12-digit number + 1 check digit for valid EAN-13
  const prefix = '200'; // 200-299 is reserved for in-store internal use in GS1 standard
  const random = Math.floor(100000000 + Math.random() * 900000000).toString();
  const raw12 = (prefix + random).substring(0, 12);
  
  // Calculate EAN-13 checksum
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(raw12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return `${raw12}${checksum}`;
}

// GET /api/products - list all products with filtering & search
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, category, lowStock, activeOnly } = req.query;

    const where: any = {};

    if (activeOnly !== 'false') {
      where.isActive = true;
    }

    if (category && typeof category === 'string' && category !== 'All') {
      where.category = category;
    }

    if (search && typeof search === 'string') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { sku: { contains: q } },
        { barcode: { contains: q } },
        { category: { contains: q } },
      ];
    }

    let products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    if (lowStock === 'true') {
      products = products.filter((p) => p.stockQuantity <= p.lowStockThreshold);
    }

    res.json(products);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/generate-barcode - generate next internal barcode
router.get('/generate-barcode', async (_req: Request, res: Response) => {
  try {
    let barcode = '';
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 10) {
      barcode = generateInternalBarcode();
      const found = await prisma.product.findUnique({ where: { barcode } });
      if (!found) exists = false;
      attempts++;
    }

    res.json({ barcode });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate barcode' });
  }
});

// GET /api/products/barcode/:code - fast lookup by barcode
router.get('/barcode/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code.trim();
    const product = await prisma.product.findUnique({
      where: { barcode: code },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found', barcode: code });
    }

    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to look up barcode' });
  }
});

// POST /api/products - create new product
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      sku,
      barcode,
      category,
      costPrice,
      sellingPrice,
      taxRate,
      stockQuantity,
      lowStockThreshold,
    } = req.body;

    if (!name || !sellingPrice) {
      return res.status(400).json({ error: 'Name and selling price are required' });
    }

    const finalBarcode = barcode ? barcode.trim() : generateInternalBarcode();
    const finalSku = sku ? sku.trim() : `SKU-${Date.now().toString().slice(-6)}`;

    // Check duplicate barcode
    const existingBarcode = await prisma.product.findUnique({ where: { barcode: finalBarcode } });
    if (existingBarcode) {
      return res.status(400).json({ error: `Barcode "${finalBarcode}" is already assigned to ${existingBarcode.name}` });
    }

    // Check duplicate SKU
    const existingSku = await prisma.product.findUnique({ where: { sku: finalSku } });
    if (existingSku) {
      return res.status(400).json({ error: `SKU "${finalSku}" is already assigned to ${existingSku.name}` });
    }

    const stock = parseInt(stockQuantity || 0, 10);

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        sku: finalSku,
        barcode: finalBarcode,
        category: category?.trim() || 'General',
        costPrice: parseFloat(costPrice || 0),
        sellingPrice: parseFloat(sellingPrice),
        taxRate: parseFloat(taxRate || 0),
        stockQuantity: stock,
        lowStockThreshold: parseInt(lowStockThreshold || 5, 10),
      },
    });

    if (stock > 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: product.id,
          changeQuantity: stock,
          reason: 'RESTOCK',
          referenceId: 'INITIAL_STOCK',
        },
      });
    }

    res.status(201).json(product);
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message || 'Failed to create product' });
  }
});

// PUT /api/products/:id - update product
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      name,
      sku,
      barcode,
      category,
      costPrice,
      sellingPrice,
      taxRate,
      lowStockThreshold,
      isActive,
    } = req.body;

    // Check uniqueness if barcode or sku changed
    if (barcode) {
      const existing = await prisma.product.findFirst({
        where: { barcode: barcode.trim(), NOT: { id } },
      });
      if (existing) {
        return res.status(400).json({ error: `Barcode is already in use by ${existing.name}` });
      }
    }

    if (sku) {
      const existing = await prisma.product.findFirst({
        where: { sku: sku.trim(), NOT: { id } },
      });
      if (existing) {
        return res.status(400).json({ error: `SKU is already in use by ${existing.name}` });
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(sku && { sku: sku.trim() }),
        ...(barcode && { barcode: barcode.trim() }),
        ...(category && { category: category.trim() }),
        ...(costPrice !== undefined && { costPrice: parseFloat(costPrice) }),
        ...(sellingPrice !== undefined && { sellingPrice: parseFloat(sellingPrice) }),
        ...(taxRate !== undefined && { taxRate: parseFloat(taxRate) }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold: parseInt(lowStockThreshold, 10) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// POST /api/products/:id/stock - manual stock adjustment
router.post('/:id/stock', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { changeQuantity, reason, notes } = req.body;

    const qty = parseInt(changeQuantity, 10);
    if (isNaN(qty) || qty === 0) {
      return res.status(400).json({ error: 'Valid non-zero change quantity required' });
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const newStock = product.stockQuantity + qty;
    if (newStock < 0) {
      return res.status(400).json({ error: `Cannot reduce stock below 0. Current stock is ${product.stockQuantity}` });
    }

    const [updatedProduct, log] = await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { stockQuantity: newStock },
      }),
      prisma.inventoryLog.create({
        data: {
          productId: id,
          changeQuantity: qty,
          reason: reason || (qty > 0 ? 'RESTOCK' : 'CORRECTION'),
          referenceId: notes || 'MANUAL_ADJUSTMENT',
        },
      }),
    ]);

    res.json({ product: updatedProduct, log });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

export default router;
