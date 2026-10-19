import { Product, Invoice, ReportSummary, NetworkInfo, SettingsMap, InventoryLog } from '../types';

const API_BASE = '/api';

export const api = {
  // Products
  async getProducts(params?: { search?: string; category?: string; lowStock?: boolean }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category) query.append('category', params.category);
    if (params?.lowStock) query.append('lowStock', 'true');
    const res = await fetch(`${API_BASE}/products?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async getProductByBarcode(barcode: string): Promise<Product> {
    const res = await fetch(`${API_BASE}/products/barcode/${encodeURIComponent(barcode)}`);
    if (!res.ok) throw new Error('Product not found');
    return res.json();
  },

  async generateBarcode(): Promise<{ barcode: string }> {
    const res = await fetch(`${API_BASE}/products/generate-barcode`);
    if (!res.ok) throw new Error('Failed to generate barcode');
    return res.json();
  },

  async createProduct(data: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create product');
    return result;
  },

  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update product');
    return result;
  },

  async adjustStock(id: number, changeQuantity: number, reason: string, notes?: string): Promise<{ product: Product; log: InventoryLog }> {
    const res = await fetch(`${API_BASE}/products/${id}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeQuantity, reason, notes }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to adjust stock');
    return result;
  },

  // Invoices
  async getInvoices(params?: { search?: string; startDate?: string; endDate?: string }): Promise<Invoice[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const res = await fetch(`${API_BASE}/invoices?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch invoices');
    return res.json();
  },

  async getInvoiceById(id: number): Promise<Invoice> {
    const res = await fetch(`${API_BASE}/invoices/${id}`);
    if (!res.ok) throw new Error('Failed to fetch invoice');
    return res.json();
  },

  async createInvoice(payload: {
    items: Array<{ productId: number; quantity: number; discount?: number }>;
    discountAmount?: number;
    paymentMethod: string;
    notes?: string;
  }): Promise<Invoice> {
    const res = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to complete sale');
    return result;
  },

  // Reports
  async getReportSummary(period: string = 'today'): Promise<ReportSummary> {
    const res = await fetch(`${API_BASE}/reports/summary?period=${period}`);
    if (!res.ok) throw new Error('Failed to fetch report summary');
    return res.json();
  },

  async getInventoryAudit(): Promise<InventoryLog[]> {
    const res = await fetch(`${API_BASE}/reports/inventory-audit`);
    if (!res.ok) throw new Error('Failed to fetch inventory audit');
    return res.json();
  },

  getExportCsvUrl(): string {
    return `${API_BASE}/reports/export-csv`;
  },

  // Settings
  async getSettings(): Promise<SettingsMap> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(settings: SettingsMap): Promise<SettingsMap> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  // Network / Scanner Info
  async getScannerInfo(): Promise<NetworkInfo> {
    const res = await fetch(`${API_BASE}/network/scanner-info`);
    if (!res.ok) throw new Error('Failed to fetch network scanner info');
    return res.json();
  },
};
