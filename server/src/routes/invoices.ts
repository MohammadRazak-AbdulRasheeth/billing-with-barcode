import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

// Helper to generate next sequential invoice number
async function generateInvoiceNumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const datePrefix = `INV-${year}${month}${day}-`;

  const setting = await prisma.setting.findUnique({ where: { key: 'INVOICE_PREFIX' } });
  const prefix = setting?.value ? `${setting.value}-${year}${month}${day}-` : datePrefix;

  // Find the highest invoice today
  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { id: 'desc' },
  });

  let nextSequence = 1;
  if (lastInvoice) {
    const parts = lastInvoice.invoiceNumber.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSequence = lastNum + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

// GET /api/invoices - list invoices with pagination and search
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, startDate, endDate, limit = '50' } = req.query;

    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { invoiceNumber: { contains: search.trim() } },
        { paymentMethod: { contains: search.trim() } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    res.json(invoices);
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/:id - single invoice details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch invoice details' });
  }
});

// POST /api/invoices - complete checkout and record sale
router.post('/', async (req: Request, res: Response) => {
  try {
    const { items, discountAmount = 0, paymentMethod = 'CASH', notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart cannot be empty' });
    }

    // Atomic transaction for invoice creation + inventory reduction + inventory log
    const result = await prisma.$transaction(async (tx) => {
      let calculatedSubtotal = 0;
      let calculatedTaxTotal = 0;

      // Verify stock & calculate totals
      const validatedItems = [];

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new Error(`Product ID ${item.productId} not found`);
        }

        const qty = parseInt(item.quantity, 10);
        if (qty <= 0) {
          throw new Error(`Invalid quantity for ${product.name}`);
        }

        const unitPrice = parseFloat(product.sellingPrice.toString());
        const costPrice = parseFloat(product.costPrice.toString());
        const taxRate = parseFloat(product.taxRate.toString());
        const itemDiscount = parseFloat(item.discount || 0);

        const lineBaseTotal = unitPrice * qty - itemDiscount;
        const lineTax = (lineBaseTotal * taxRate) / 100;
        const lineTotal = lineBaseTotal + lineTax;

        calculatedSubtotal += lineBaseTotal;
        calculatedTaxTotal += lineTax;

        validatedItems.push({
          productId: product.id,
          productName: product.name,
          unitPrice,
          costPrice,
          quantity: qty,
          discount: itemDiscount,
          lineTotal,
        });

        // Deduct stock
        const newStock = product.stockQuantity - qty;
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: newStock },
        });
      }

      const totalDiscount = parseFloat(discountAmount || 0);
      const finalTotal = Math.max(0, calculatedSubtotal + calculatedTaxTotal - totalDiscount);
      const invoiceNumber = await generateInvoiceNumber();

      // Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          subtotal: calculatedSubtotal,
          discountAmount: totalDiscount,
          taxAmount: calculatedTaxTotal,
          totalAmount: Math.round(finalTotal * 100) / 100,
          paymentMethod: paymentMethod.toUpperCase(),
          notes: notes || null,
          items: {
            create: validatedItems,
          },
        },
        include: { items: true },
      });

      // Create stock movement logs
      for (const item of validatedItems) {
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            changeQuantity: -item.quantity,
            reason: 'SALE',
            referenceId: invoice.invoiceNumber,
          },
        });
      }

      return invoice;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    res.status(400).json({ error: error.message || 'Failed to complete sale' });
  }
});

export default router;
