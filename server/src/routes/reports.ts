import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

// GET /api/reports/summary - daily, monthly, profit, tax totals
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { period = 'today' } = req.query; // 'today', 'week', 'month', 'year', 'all'

    const now = new Date();
    const startDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setTime(0); // All time
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      include: {
        items: true,
      },
    });

    let totalRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalCost = 0;

    const paymentBreakdown: Record<string, number> = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      OTHER: 0,
    };

    const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

    for (const inv of invoices) {
      totalRevenue += parseFloat(inv.totalAmount.toString());
      totalTax += parseFloat(inv.taxAmount.toString());
      totalDiscount += parseFloat(inv.discountAmount.toString());

      const method = inv.paymentMethod || 'OTHER';
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + parseFloat(inv.totalAmount.toString());

      for (const item of inv.items) {
        const itemCost = parseFloat(item.costPrice.toString()) * item.quantity;
        totalCost += itemCost;

        const prodKey = item.productName;
        if (!productSalesMap[prodKey]) {
          productSalesMap[prodKey] = { name: prodKey, quantity: 0, revenue: 0 };
        }
        productSalesMap[prodKey].quantity += item.quantity;
        productSalesMap[prodKey].revenue += parseFloat(item.lineTotal.toString());
      }
    }

    const grossProfit = Math.max(0, totalRevenue - totalCost - totalTax); // Revenue without tax minus cost of goods sold

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Count low stock products
    const allProducts = await prisma.product.findMany({ where: { isActive: true } });
    const lowStockCount = allProducts.filter((p) => p.stockQuantity <= p.lowStockThreshold).length;

    res.json({
      period,
      totalInvoices: invoices.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      paymentBreakdown,
      topProducts,
      totalActiveProducts: allProducts.length,
      lowStockCount,
    });
  } catch (error: any) {
    console.error('Error generating summary report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/reports/inventory-audit - stock movement logs
router.get('/inventory-audit', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.inventoryLog.findMany({
      include: {
        product: { select: { name: true, sku: true, barcode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch inventory audit' });
  }
});

// GET /api/reports/export-csv - download CSV for invoices
router.get('/export-csv', async (req: Request, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    let csv = 'Invoice Number,Date,Payment Method,Subtotal,Discount,Tax,Total Amount,Items Summary\n';

    for (const inv of invoices) {
      const itemsSummary = inv.items.map((i) => `${i.productName} (x${i.quantity})`).join('; ');
      const cleanSummary = `"${itemsSummary.replace(/"/g, '""')}"`;
      const dateStr = new Date(inv.createdAt).toISOString();

      csv += `${inv.invoiceNumber},${dateStr},${inv.paymentMethod},${inv.subtotal},${inv.discountAmount},${inv.taxAmount},${inv.totalAmount},${cleanSummary}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.csv`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

export default router;
