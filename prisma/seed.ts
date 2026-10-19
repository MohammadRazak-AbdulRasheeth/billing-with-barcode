import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to generate a mathematically valid GS1 EAN-13 barcode with modulo-10 checksum
function generateEAN13(itemIndex: number): string {
  const padded = String(itemIndex).padStart(4, '0');
  const prefix12 = '89080010' + padded;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(prefix12[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checksum = (10 - (sum % 10)) % 10;
  return prefix12 + checksum;
}

// Complete 135 Crackers Price List from the catalog
const crackerProducts = [
  // SPARKLERS (கம்பி மத்தாப்பு)
  { sno: 1, name: '7 Cm Electric, Colour Sparklers', category: 'Sparklers', unit: '1 Box', rate: 9.00 },
  { sno: 2, name: '10 Cm Electric Sparklers', category: 'Sparklers', unit: '1 Box', rate: 20.00 },
  { sno: 3, name: '10 Cm Colour Sparklers', category: 'Sparklers', unit: '1 Box', rate: 22.00 },
  { sno: 4, name: '10 Cm Red & Green Sparklers', category: 'Sparklers', unit: '1 Box', rate: 25.00 },
  { sno: 5, name: '12 Cm Electric Sparklers', category: 'Sparklers', unit: '1 Box', rate: 35.00 },
  { sno: 6, name: '12 Cm Colour Sparklers', category: 'Sparklers', unit: '1 Box', rate: 35.00 },
  { sno: 7, name: '12 Cm Red & Green Sparklers', category: 'Sparklers', unit: '1 Box', rate: 35.00 },
  { sno: 8, name: '15 Cm Electric Sparklers', category: 'Sparklers', unit: '1 Box', rate: 45.00 },
  { sno: 9, name: '15 Cm Colour Sparklers', category: 'Sparklers', unit: '1 Box', rate: 55.00 },
  { sno: 10, name: '15 Cm Red & Green Sparklers', category: 'Sparklers', unit: '1 Box', rate: 60.00 },
  { sno: 11, name: '30 Cm Electric Sparklers', category: 'Sparklers', unit: '1 Box', rate: 50.00 },
  { sno: 12, name: '30 Cm Colour Sparklers', category: 'Sparklers', unit: '1 Box', rate: 55.00 },
  { sno: 13, name: '30 Cm Red & Green Sparklers', category: 'Sparklers', unit: '1 Box', rate: 55.00 },
  { sno: 14, name: '50 Cm Electric Sparklers', category: 'Sparklers', unit: '1 Box', rate: 190.00 },
  { sno: 15, name: '50 Cm Colour Sparklers', category: 'Sparklers', unit: '1 Box', rate: 225.00 },

  // ONE SOUND CRACKERS (ஒற்றை வெடிகள்)
  { sno: 16, name: '2 3/4 Kuruvi', category: 'One Sound Crackers', unit: '1 Pkt', rate: 9.00 },
  { sno: 17, name: '3 1/2" Lakshmi', category: 'One Sound Crackers', unit: '1 Pkt', rate: 20.00 },
  { sno: 18, name: '4" Dlx. Lakshmi / Harry Parter', category: 'One Sound Crackers', unit: '1 Pkt', rate: 35.00 },
  { sno: 19, name: '4" Gold Lakshmi', category: 'One Sound Crackers', unit: '1 Pkt', rate: 45.00 },
  { sno: 20, name: '2 Sound Crackers', category: 'One Sound Crackers', unit: '1 Pkt', rate: 35.00 },
  { sno: 21, name: '5" Komban', category: 'One Sound Crackers', unit: '1 Pkt', rate: 60.00 },

  // DELUXE CRACKERS (ராட்சச சர வெடிகள்)
  { sno: 22, name: '56 Gaint', category: 'Deluxe Crackers', unit: '1 Pkt', rate: 60.00 },
  { sno: 23, name: '24 Deluxe Crackers', category: 'Deluxe Crackers', unit: '1 Pkt', rate: 55.00 },
  { sno: 24, name: '50 Deluxe Crackers', category: 'Deluxe Crackers', unit: '1 Pkt', rate: 110.00 },
  { sno: 25, name: '100 Deluxe Crackers (3")', category: 'Deluxe Crackers', unit: '1 Pkt', rate: 250.00 },

  // BIJILI CRACKERS (Bijili வெடிகள்)
  { sno: 26, name: 'Colour Red Bijili', category: 'Bijili Crackers', unit: '1 Bag', rate: 45.00 },
  { sno: 27, name: 'Gold Stripped Bijili', category: 'Bijili Crackers', unit: '1 Bag', rate: 50.00 },

  // ROCKETS (NAACHIYAR) (ராக்கெட் வகைகள்)
  { sno: 28, name: 'Mega Bomb Rocket', category: 'Rockets', unit: '1 Box', rate: 80.00 },
  { sno: 29, name: 'Colour Rocket', category: 'Rockets', unit: '1 Box', rate: 90.00 },
  { sno: 30, name: '2 Sound Rocket', category: 'Rockets', unit: '1 Box', rate: 180.00 },
  { sno: 31, name: 'Lunix Rocket', category: 'Rockets', unit: '1 Box', rate: 200.00 },

  // STAR CRACKERS (ஸ்டார் வெடிகள்)
  { sno: 32, name: '100 Stars', category: 'Star Crackers', unit: '1 Box', rate: 55.00 },
  { sno: 33, name: '1000 Silver Stars', category: 'Star Crackers', unit: '1 Box', rate: 150.00 },
  { sno: 34, name: '1000 Stars', category: 'Star Crackers', unit: '1 Box', rate: 350.00 },
  { sno: 35, name: '2000 Silver Stars', category: 'Star Crackers', unit: '1 Box', rate: 500.00 },
  { sno: 36, name: '2000 Stars (Madurai)', category: 'Star Crackers', unit: '1 Box', rate: 1100.00 },
  { sno: 37, name: '5000 Silver Stars', category: 'Star Crackers', unit: '1 Box', rate: 1200.00 },
  { sno: 38, name: '5000 Stars (Madurai)', category: 'Star Crackers', unit: '1 Box', rate: 2500.00 },
  { sno: 39, name: '10000 Silver Stars', category: 'Star Crackers', unit: '1 Box', rate: 2000.00 },
  { sno: 40, name: '10000 Full Stars', category: 'Star Crackers', unit: '1 Box', rate: 3500.00 },

  // FLOWER POTS (NAACHIYAR) (பூச்சட்டி வகைகள்)
  { sno: 41, name: 'Flower Pots Small', category: 'Flower Pots', unit: '1 Box', rate: 70.00 },
  { sno: 42, name: 'Flower Pots Big', category: 'Flower Pots', unit: '1 Box', rate: 80.00 },
  { sno: 43, name: 'Flower Pots Special', category: 'Flower Pots', unit: '1 Box', rate: 120.00 },
  { sno: 44, name: 'Flower Pots Asoka', category: 'Flower Pots', unit: '1 Box', rate: 160.00 },
  { sno: 45, name: 'Flower Pots Deluxe (5 Pcs)', category: 'Flower Pots', unit: '1 Box', rate: 250.00 },
  { sno: 46, name: 'Colour Koti Giant (10 Pcs)', category: 'Flower Pots', unit: '1 Box', rate: 270.00 },
  { sno: 47, name: 'Colour Koti Deluxe UV (10 Pcs)', category: 'Flower Pots', unit: '1 Box', rate: 400.00 },

  // ZAMIN CHAKKARS (NAACHIYAR) (தரைச்சக்கரம்)
  { sno: 48, name: 'Ground Chakkar Big (10 Pcs)', category: 'Zamin Chakkars', unit: '1 Box', rate: 50.00 },
  { sno: 49, name: 'Ground Chakkar Ashoka', category: 'Zamin Chakkars', unit: '1 Box', rate: 90.00 },
  { sno: 50, name: 'Ground Chakkar Special', category: 'Zamin Chakkars', unit: '1 Box', rate: 100.00 },
  { sno: 51, name: 'Ground Chakkar Deluxe', category: 'Zamin Chakkars', unit: '1 Box', rate: 180.00 },
  { sno: 52, name: 'Whistling Wheel (5 Pcs)', category: 'Zamin Chakkars', unit: '1 Box', rate: 200.00 },
  { sno: 53, name: 'Dancing Wheel (5 Pcs)', category: 'Zamin Chakkars', unit: '1 Box', rate: 160.00 },

  // ATOM BOMBS (ஆட்டோபாம்)
  { sno: 54, name: 'Bullet Bomb', category: 'Atom Bombs', unit: '1 Box', rate: 50.00 },
  { sno: 55, name: 'Hydro Bomb Green', category: 'Atom Bombs', unit: '1 Box', rate: 75.00 },
  { sno: 56, name: 'King Bomb Green', category: 'Atom Bombs', unit: '1 Box', rate: 130.00 },
  { sno: 57, name: 'Classic Bomb Green, Mega Flash', category: 'Atom Bombs', unit: '1 Box', rate: 150.00 },
  { sno: 58, name: 'Agni Bomb', category: 'Atom Bombs', unit: '1 Box', rate: 250.00 },
  { sno: 59, name: 'Tiger Bomb', category: 'Atom Bombs', unit: '1 Box', rate: 350.00 },
  { sno: 60, name: '1/4 kg Paper Bomb', category: 'Atom Bombs', unit: '1 Box', rate: 75.00 },
  { sno: 61, name: '1/2 kg Paper Bomb', category: 'Atom Bombs', unit: '1 Box', rate: 150.00 },
  { sno: 62, name: '1 kg Paper Bomb', category: 'Atom Bombs', unit: '1 Box', rate: 300.00 },

  // TWINKLING STAR (திரிச்சோடை)
  { sno: 63, name: '1 1/2" Twinkling Star', category: 'Twinkling Star', unit: '1 Box', rate: 40.00 },
  { sno: 64, name: '4" Twinkling Star', category: 'Twinkling Star', unit: '1 Box', rate: 90.00 },

  // FANCY NOVELTIES (Fancy நாவல்டீஸ்)
  { sno: 65, name: 'Siren (2 Pcs)', category: 'Fancy Novelties', unit: '1 Box', rate: 210.00 },
  { sno: 66, name: 'Ashrafi Big / Tim Tam (5 Pcs)', category: 'Fancy Novelties', unit: '1 Box', rate: 60.00 },
  { sno: 67, name: 'Disco Showers (5 in 1)', category: 'Fancy Novelties', unit: '1 Box', rate: 120.00 },
  { sno: 68, name: 'Chit-Put (Ramba)', category: 'Fancy Novelties', unit: '1 Box', rate: 90.00 },
  { sno: 69, name: 'Flower Bomb (Ganga)', category: 'Fancy Novelties', unit: '1 Box', rate: 150.00 },

  // MEGA COLOUR FOUNTAINS
  { sno: 70, name: 'Colour Pots (5 Pcs)', category: 'Fountains', unit: '1 Box', rate: 260.00 },
  { sno: 71, name: 'Magic Flowers (5 Pcs)', category: 'Fountains', unit: '1 Box', rate: 400.00 },
  { sno: 72, name: 'Tri Colour Fountain (5 Pcs)', category: 'Fountains', unit: '1 Box', rate: 370.00 },
  { sno: 73, name: 'Peacock (R,G & Crackling) (1 Pce)', category: 'Fountains', unit: '1 Box', rate: 210.00 },
  { sno: 74, name: 'Peacock Feather (1 Pce)', category: 'Fountains', unit: '1 Box', rate: 110.00 },
  { sno: 75, name: 'Little Peacock (1 Pce)', category: 'Fountains', unit: '1 Box', rate: 150.00 },
  { sno: 76, name: 'Bada Peacock (1 Pce)', category: 'Fountains', unit: '1 Box', rate: 550.00 },
  { sno: 77, name: 'Emoji Fountain Crackling / Live Show (1 Pce)', category: 'Fountains', unit: '1 Box', rate: 200.00 },

  // KIDS SPECIAL NEW FANCY
  { sno: 78, name: 'Coin / Qui / Flick (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 110.00 },
  { sno: 79, name: 'Helicopter / Drone +9 (5 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 150.00 },
  { sno: 80, name: 'Bambara Spinner (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 150.00 },
  { sno: 81, name: 'Gitar (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 250.00 },
  { sno: 82, name: 'Hanuman Gathai (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 200.00 },
  { sno: 83, name: 'Crorepati (Currency Paper Out) (2 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 250.00 },
  { sno: 84, name: 'Money in the Bank / Sound Marriage (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 80.00 },
  { sno: 85, name: 'Old is Gold (5 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 210.00 },
  { sno: 86, name: 'Lumino Fountain, Luster (5 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 200.00 },
  { sno: 87, name: 'Tin Fountain (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 170.00 },
  { sno: 88, name: '6 Mixing (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 200.00 },
  { sno: 89, name: 'Shinchan (5 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 100.00 },
  { sno: 90, name: 'Lutty Butterfly (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 130.00 },
  { sno: 91, name: '90 Watt (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 135.00 },
  { sno: 92, name: 'Yellow Hearts (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 180.00 },
  { sno: 93, name: 'Mini Bloom (5 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 200.00 },
  { sno: 94, name: 'Sky Short Green (5 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 150.00 },
  { sno: 95, name: 'Hand Short Black Buster (2 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 200.00 },
  { sno: 96, name: 'Ultra Pencil (3 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 100.00 },
  { sno: 97, name: 'Colour Smoke, Multi Colour (5 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 230.00 },
  { sno: 98, name: 'Popcorn Pencil / Water Falls (5 Pcs)', category: 'Kids Special', unit: '1 Box', rate: 230.00 },
  { sno: 99, name: 'Big Fountain Crackling / Big Fountain Shining (1 Pce)', category: 'Kids Special', unit: '1 Box', rate: 300.00 },

  // REPEATING SHOTS (ரிப்பீட்டிங் ஷாட்ஸ்)
  { sno: 100, name: '7 Shots Colour (5 Pcs)', category: 'Repeating Shots', unit: '1 Box', rate: 100.00 },
  { sno: 101, name: '12 Shot Bomb Colour Deluxe', category: 'Repeating Shots', unit: '1 Box', rate: 230.00 },
  { sno: 102, name: '12 Shot Red & Green Deluxe', category: 'Repeating Shots', unit: '1 Box', rate: 210.00 },
  { sno: 103, name: '25 Shot Crackling', category: 'Repeating Shots', unit: '1 Box', rate: 350.00 },
  { sno: 104, name: '30 Shot Colour (Sliver)', category: 'Repeating Shots', unit: '1 Box', rate: 480.00 },
  { sno: 105, name: '30 Shot Colour Speed', category: 'Repeating Shots', unit: '1 Box', rate: 600.00 },
  { sno: 106, name: '60 Shot Colour (Sliver)', category: 'Repeating Shots', unit: '1 Box', rate: 950.00 },
  { sno: 107, name: '60 Shot Colour Speed', category: 'Repeating Shots', unit: '1 Box', rate: 1250.00 },
  { sno: 108, name: '120 Shot Charger Sliver', category: 'Repeating Shots', unit: '1 Box', rate: 1900.00 },
  { sno: 109, name: '120 Shot Charger Speed', category: 'Repeating Shots', unit: '1 Box', rate: 2400.00 },
  { sno: 110, name: '240 Shot Charger Speed', category: 'Repeating Shots', unit: '1 Box', rate: 3850.00 },

  // MULTI COLOUR EFFECT (NAACHIYAR)
  { sno: 111, name: 'Chotta Fancy Items', category: 'Multi Colour Fancy', unit: '1 Box', rate: 50.00 },
  { sno: 112, name: 'Double Effect Fancy 2 1/2"', category: 'Multi Colour Fancy', unit: '1 Box', rate: 96.00 },
  { sno: 113, name: 'Naachiyar Fancy (3" 1/2" Pipe) (5 Verieties)', category: 'Multi Colour Fancy', unit: '1 Box', rate: 375.00 },
  { sno: 114, name: 'Naachiyar 4 Fancy (5 Verieties)', category: 'Multi Colour Fancy', unit: '1 Box', rate: 450.00 },
  { sno: 115, name: '3 Pcs Fancy', category: 'Multi Colour Fancy', unit: '1 Box', rate: 300.00 },
  { sno: 116, name: 'Lara Double Sound (Naachiyar Special)', category: 'Multi Colour Fancy', unit: '1 Box', rate: 550.00 },
  { sno: 117, name: '5" Star City (Naachiyar Special)', category: 'Multi Colour Fancy', unit: '1 Box', rate: 1000.00 },

  // GIFT BOXES (NON DISCOUNT ITEMS)
  { sno: 118, name: 'Robo Box/Silver Box (21 Items)', category: 'Gift Boxes', unit: '1 Box', rate: 600.00 },
  { sno: 119, name: 'Golden Box (25 Items)', category: 'Gift Boxes', unit: '1 Box', rate: 650.00 },
  { sno: 120, name: 'Diamond Box (30 Items)', category: 'Gift Boxes', unit: '1 Box', rate: 800.00 },
  { sno: 121, name: 'Gift Special Box (40 Items)', category: 'Gift Boxes', unit: '1 Box', rate: 1000.00 },
  { sno: 122, name: 'Gift Box (50 Items)', category: 'Gift Boxes', unit: '1 Box', rate: 1500.00 },

  // COLOUR MATCHES (NON DISCOUNT ITEMS)
  { sno: 124, name: 'Mega Deluxe (5 Piece)', category: 'Colour Matches', unit: '1 Box', rate: 65.00 },
  { sno: 125, name: 'Deluxe (10 Piece)', category: 'Colour Matches', unit: '1 Box', rate: 85.00 },
  { sno: 126, name: 'Super Deluxe', category: 'Colour Matches', unit: '1 Box', rate: 100.00 },
  { sno: 127, name: 'Lampo Classic 5 in 1', category: 'Colour Matches', unit: '1 Box', rate: 170.00 },
  { sno: 128, name: 'Max', category: 'Colour Matches', unit: '1 Box', rate: 225.00 },
  { sno: 129, name: 'Mega 5 in 1', category: 'Colour Matches', unit: '1 Box', rate: 250.00 },
  { sno: 132, name: 'Roll Cap', category: 'Roll & Ring Caps', unit: '1 Box', rate: 90.00 },
  { sno: 133, name: 'Ring Cap (5 Packets)', category: 'Roll & Ring Caps', unit: '1 Box', rate: 75.00 },
  { sno: 134, name: 'Gun (10 Varieties)', category: 'Cap Guns', unit: '1 Box', rate: 150.00 },
  { sno: 135, name: 'Ring Gun (5 Varieties)', category: 'Cap Guns', unit: '1 Box', rate: 180.00 },
];

async function main() {
  console.log('Resetting and seeding FreshMart / Naachiyar Crackers Database...');

  // 1. Clean existing tables (Invoice Items, Invoices, Inventory Logs, Products)
  console.log('Deleting old test invoices, logs, and products...');
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.inventoryLog.deleteMany({});
  await prisma.product.deleteMany({});

  // 2. Seed Updated Shop Settings
  console.log('Updating shop settings...');
  const settings = [
    { key: 'SHOP_NAME', value: 'Naachiyar Fire Works - Sri Girish Crackers' },
    { key: 'SHOP_ADDRESS', value: 'Pannimadai, Thadagam Road, Coimbatore - 641 017' },
    { key: 'SHOP_PHONE', value: '+91 98940 65756 / 72007 55752' },
    { key: 'SHOP_GST', value: '33AAACN1234F1Z1' },
    { key: 'CURRENCY', value: '₹' },
    { key: 'RECEIPT_FOOTER', value: 'Happy & Safe Deepavali! Crackers once sold cannot be returned.' },
    { key: 'INVOICE_PREFIX', value: 'CKR' },
    { key: 'TAX_ENABLED', value: 'false' },
    { key: 'PRINTER_WIDTH', value: '80mm' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // 3. Insert All Products from PDF Price List with Guaranteed EAN-13 Barcodes
  console.log(`Inserting ${crackerProducts.length} cracker items from PDF list...`);

  for (const item of crackerProducts) {
    const barcode = generateEAN13(item.sno);
    const sku = `CKR-${String(item.sno).padStart(3, '0')}`;
    const costPrice = Math.round(item.rate * 0.6); // 40% margin estimate

    const created = await prisma.product.create({
      data: {
        sku,
        barcode,
        name: item.name,
        category: item.category,
        costPrice,
        sellingPrice: item.rate,
        taxRate: 0.0,
        stockQuantity: 100, // Stock opening balance of 100 boxes/pkts each
        lowStockThreshold: 15,
      },
    });

    await prisma.inventoryLog.create({
      data: {
        productId: created.id,
        changeQuantity: 100,
        reason: 'RESTOCK',
        referenceId: 'PDF_CATALOG_SEED',
      },
    });
  }

  console.log(`Successfully seeded ${crackerProducts.length} products with valid GS1/EAN-13 barcodes!`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
