export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  category: string | null;
  costPrice: number | string;
  sellingPrice: number | string;
  taxRate: number | string;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // fixed discount per item
}

export interface InvoiceItem {
  id?: number;
  invoiceId?: number;
  productId?: number | null;
  productName: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  subtotal: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'OTHER' | string;
  notes?: string | null;
  createdAt: string;
  items: InvoiceItem[];
}

export interface InventoryLog {
  id: number;
  productId: number;
  changeQuantity: number;
  reason: 'SALE' | 'RESTOCK' | 'DAMAGE' | 'CORRECTION' | string;
  referenceId?: string | null;
  createdAt: string;
  product?: {
    name: string;
    sku: string;
    barcode: string;
  };
}

export interface ReportSummary {
  period: string;
  totalInvoices: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  totalCost: number;
  grossProfit: number;
  paymentBreakdown: Record<string, number>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  totalActiveProducts: number;
  lowStockCount: number;
}

export interface NetworkInfo {
  lanIp: string;
  serverPort: number;
  clientPort: number;
  scannerUrl: string;
  qrDataUrl: string;
}

export type SettingsMap = Record<string, string>;
