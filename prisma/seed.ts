import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial shop settings...');

  const settings = [
    { key: 'SHOP_NAME', value: 'FreshMart Retail & Groceries' },
    { key: 'SHOP_ADDRESS', value: 'Shop No. 12, Main Bazaar Road, City Center' },
    { key: 'SHOP_PHONE', value: '+91 98765 43210' },
    { key: 'SHOP_GST', value: '33ABCDE1234F1Z5' },
    { key: 'CURRENCY', value: '₹' },
    { key: 'RECEIPT_FOOTER', value: 'Thank you for your visit! Goods once sold cannot be returned without receipt.' },
    { key: 'INVOICE_PREFIX', value: 'INV' },
    { key: 'TAX_ENABLED', value: 'true' },
    { key: 'PRINTER_WIDTH', value: '80mm' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  console.log('Seeding sample retail products with barcodes...');

  const sampleProducts = [
    {
      sku: 'PRD-001',
      barcode: '8901030381023',
      name: 'Organic Green Tea (250g)',
      category: 'Beverages',
      costPrice: 120.0,
      sellingPrice: 180.0,
      taxRate: 5.0,
      stockQuantity: 45,
      lowStockThreshold: 10,
    },
    {
      sku: 'PRD-002',
      barcode: '8901234567890',
      name: 'Whole Wheat Sandwich Bread (400g)',
      category: 'Bakery',
      costPrice: 32.0,
      sellingPrice: 48.0,
      taxRate: 0.0,
      stockQuantity: 28,
      lowStockThreshold: 8,
    },
    {
      sku: 'PRD-003',
      barcode: '8902001002003',
      name: 'Belgian Dark Chocolate (100g)',
      category: 'Confectionery',
      costPrice: 65.0,
      sellingPrice: 110.0,
      taxRate: 18.0,
      stockQuantity: 35,
      lowStockThreshold: 5,
    },
    {
      sku: 'PRD-004',
      barcode: '8903333444455',
      name: 'Unsweetened Almond Milk (1L)',
      category: 'Dairy & Alternates',
      costPrice: 180.0,
      sellingPrice: 250.0,
      taxRate: 5.0,
      stockQuantity: 20,
      lowStockThreshold: 5,
    },
    {
      sku: 'PRD-005',
      barcode: '8905555666677',
      name: 'Natural Olive Oil Bar Soap (125g)',
      category: 'Personal Care',
      costPrice: 42.0,
      sellingPrice: 75.0,
      taxRate: 18.0,
      stockQuantity: 50,
      lowStockThreshold: 10,
    },
    {
      sku: 'PRD-006',
      barcode: '8909999888811',
      name: 'Sparkling Mineral Water (750ml)',
      category: 'Beverages',
      costPrice: 35.0,
      sellingPrice: 60.0,
      taxRate: 12.0,
      stockQuantity: 4, // Intentionally low to test low stock alert
      lowStockThreshold: 10,
    },
  ];

  for (const p of sampleProducts) {
    const existing = await prisma.product.findUnique({ where: { barcode: p.barcode } });
    if (!existing) {
      const created = await prisma.product.create({ data: p });
      await prisma.inventoryLog.create({
        data: {
          productId: created.id,
          changeQuantity: p.stockQuantity,
          reason: 'RESTOCK',
          referenceId: 'INITIAL_SEED',
        },
      });
    }
  }

  console.log('Database seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
