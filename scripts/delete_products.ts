import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('HOSTINGER_SERVER_IP_OR_DOMAIN')) {
  dbUrl = dbUrl.replace('HOSTINGER_SERVER_IP_OR_DOMAIN', '127.0.0.1');
}

const prisma = new PrismaClient({
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
});

// Target barcodes specified for deletion
export const DEFAULT_TARGET_BARCODES: string[] = [
  '8908001000017',
  '8908001000451',
  '8908001000659',
  '8908001000697',
  '8908001000710',
  '8908001000819',
  '8908001000826',
  '8908001000840',
  '8908001000857',
  '8908001000864',
  '8908001000871',
  '8908001000888',
  '8908001000895',
  '8908001000901',
  '8908001000918',
  '8908001000925',
  '8908001000932',
  '8908001000949',
  '8908001000956',
  '8908001000963',
  '8908001000987',
];

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');

  // Filter out flags to check if any custom barcodes were supplied via CLI
  const customBarcodes = args.filter((arg) => !arg.startsWith('-'));
  const barcodesToDelete = customBarcodes.length > 0 ? customBarcodes : DEFAULT_TARGET_BARCODES;

  console.log('\n=============================================================');
  console.log('       PRODUCT DELETION SCRIPT BY BARCODE');
  console.log('=============================================================');
  console.log(`Mode:           ${isDryRun ? 'DRY-RUN (Preview only, no changes will be made)' : 'LIVE EXECUTION'}`);
  console.log(`Total barcodes: ${barcodesToDelete.length}`);
  console.log('-------------------------------------------------------------\n');

  // 1. Fetch matching products from the database
  const matchingProducts = await prisma.product.findMany({
    where: {
      barcode: {
        in: barcodesToDelete,
      },
    },
    select: {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      category: true,
      sellingPrice: true,
      stockQuantity: true,
    },
  });

  const foundBarcodes = new Set(matchingProducts.map((p) => p.barcode));
  const missingBarcodes = barcodesToDelete.filter((b) => !foundBarcodes.has(b));

  console.log(`Found ${matchingProducts.length} matching product(s) in the database:\n`);

  if (matchingProducts.length > 0) {
    console.table(
      matchingProducts.map((p, index) => ({
        '#': index + 1,
        ID: p.id,
        Barcode: p.barcode,
        SKU: p.sku,
        Name: p.name,
        Category: p.category ?? 'N/A',
        Price: Number(p.sellingPrice).toFixed(2),
        Stock: p.stockQuantity,
      }))
    );
  } else {
    console.log('No products found matching the given barcodes.');
  }

  if (missingBarcodes.length > 0) {
    console.log(`\nWarning: ${missingBarcodes.length} barcode(s) were NOT found in the database:`);
    console.log(missingBarcodes.join(', '));
  }

  if (matchingProducts.length === 0) {
    console.log('\nNothing to delete. Exiting.');
    return;
  }

  if (isDryRun) {
    console.log('\n[DRY RUN COMPLETE] No records were modified or deleted.');
    console.log('To permanently delete these products, run:');
    console.log('  npm run products:delete');
    console.log('  or: npx tsx scripts/delete_products.ts\n');
    return;
  }

  const productIds = matchingProducts.map((p) => p.id);

  console.log('\nProceeding with deletion...');

  // Safe relational cleanup in a transaction:
  // 1. Delete associated inventory logs
  // 2. Set product_id to NULL in any invoice_items so sales invoice history remains intact
  // 3. Delete the products
  const result = await prisma.$transaction(async (tx) => {
    const deletedLogs = await tx.inventoryLog.deleteMany({
      where: {
        productId: { in: productIds },
      },
    });

    const updatedInvoiceItems = await tx.invoiceItem.updateMany({
      where: {
        productId: { in: productIds },
      },
      data: {
        productId: null,
      },
    });

    const deletedProducts = await tx.product.deleteMany({
      where: {
        id: { in: productIds },
      },
    });

    return {
      deletedProductsCount: deletedProducts.count,
      deletedLogsCount: deletedLogs.count,
      updatedInvoiceItemsCount: updatedInvoiceItems.count,
    };
  });

  console.log('\n=============================================================');
  console.log('                 DELETION SUMMARY');
  console.log('=============================================================');
  console.log(`Products Deleted:       ${result.deletedProductsCount}`);
  console.log(`Inventory Logs Cleared: ${result.deletedLogsCount}`);
  console.log(`Invoice Items Unlinked: ${result.updatedInvoiceItemsCount}`);
  console.log('Status:                 SUCCESSFUL');
  console.log('=============================================================\n');
}

main()
  .catch((err: any) => {
    console.error('\n❌ Error executing deletion script:');
    console.error(err.message || err);
    console.error('\n💡 Troubleshooting Tips:');
    console.error('1. Check the DATABASE_URL in your .env file.');
    console.error('2. If you are using Hostinger Cloud MySQL, ensure your IP is allowed in Hostinger -> Remote MySQL.');
    console.error('3. If you are using MySQL Workbench / phpMyAdmin directly, you can execute: scripts/delete_products.sql');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
