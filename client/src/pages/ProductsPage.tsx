import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Edit2,
  Package,
  Layers,
  ArrowUpDown,
  Barcode,
  Check,
  X,
} from 'lucide-react';
import { Product } from '../types';
import { api } from '../services/api';

interface ProductsPageProps {
  products: Product[];
  refreshProducts: () => void;
  currency?: string;
  onPrintBarcode?: (productId: number) => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  refreshProducts,
  currency = '₹',
  onPrintBarcode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockChange, setStockChange] = useState('');
  const [stockReason, setStockReason] = useState<'RESTOCK' | 'DAMAGE' | 'CORRECTION'>('RESTOCK');
  const [stockNotes, setStockNotes] = useState('');

  // Form fields for Add/Edit Product
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formTaxRate, setFormTaxRate] = useState('0');
  const [formStock, setFormStock] = useState('0');
  const [formThreshold, setFormThreshold] = useState('5');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Categories list
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category || 'General')))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      searchTerm === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesLowStock = !showLowStockOnly || p.stockQuantity <= p.lowStockThreshold;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const handleOpenAdd = async () => {
    setEditingProduct(null);
    setFormName('');
    setFormSku('');
    setFormCategory('General');
    setFormCostPrice('');
    setFormSellingPrice('');
    setFormTaxRate('0');
    setFormStock('20');
    setFormThreshold('5');
    setFormError(null);

    try {
      const { barcode } = await api.generateBarcode();
      setFormBarcode(barcode);
    } catch {
      setFormBarcode('200' + Math.floor(1000000000 + Math.random() * 9000000000));
    }

    setShowProductModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormSku(p.sku);
    setFormBarcode(p.barcode);
    setFormCategory(p.category || 'General');
    setFormCostPrice(String(p.costPrice));
    setFormSellingPrice(String(p.sellingPrice));
    setFormTaxRate(String(p.taxRate));
    setFormStock(String(p.stockQuantity));
    setFormThreshold(String(p.lowStockThreshold));
    setFormError(null);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSellingPrice) {
      setFormError('Product name and selling price are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, {
          name: formName.trim(),
          sku: formSku.trim(),
          barcode: formBarcode.trim(),
          category: formCategory.trim(),
          costPrice: parseFloat(formCostPrice || '0'),
          sellingPrice: parseFloat(formSellingPrice),
          taxRate: parseFloat(formTaxRate || '0'),
          lowStockThreshold: parseInt(formThreshold || '5', 10),
        });
      } else {
        await api.createProduct({
          name: formName.trim(),
          sku: formSku.trim(),
          barcode: formBarcode.trim(),
          category: formCategory.trim(),
          costPrice: parseFloat(formCostPrice || '0'),
          sellingPrice: parseFloat(formSellingPrice),
          taxRate: parseFloat(formTaxRate || '0'),
          stockQuantity: parseInt(formStock || '0', 10),
          lowStockThreshold: parseInt(formThreshold || '5', 10),
        });
      }

      refreshProducts();
      setShowProductModal(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;

    const qty = parseInt(stockChange, 10);
    if (isNaN(qty) || qty === 0) {
      alert('Please enter a valid non-zero adjustment quantity');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.adjustStock(stockProduct.id, qty, stockReason, stockNotes);
      refreshProducts();
      setShowStockModal(false);
      setStockProduct(null);
      setStockChange('');
      setStockNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Top Action Bar */}
      <div className="products-action-bar">
        <div className="products-filter-group">
          <div className="products-search-box">
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search products by name, barcode, or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: '100%' }}
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="products-category-select"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All Categories' : c}
              </option>
            ))}
          </select>

          <button
            className={`btn-secondary products-low-stock-btn ${showLowStockOnly ? 'active' : ''}`}
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            style={{
              padding: '0.55rem 0.9rem',
              background: showLowStockOnly ? 'rgba(245, 158, 11, 0.2)' : undefined,
              borderColor: showLowStockOnly ? '#f59e0b' : undefined,
              color: showLowStockOnly ? '#fbbf24' : undefined,
            }}
          >
            <AlertTriangle size={15} />
            <span>Low Stock</span>
          </button>
        </div>

        <button className="btn-primary products-add-btn" onClick={handleOpenAdd}>
          <Plus size={18} />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Products Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Product Details</th>
                <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Cost Price</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Selling Price</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Available Stock</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.stockQuantity <= p.lowStockThreshold;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.6rem', fontFamily: 'var(--font-mono)' }}>
                          <span>SKU: {p.sku}</span>
                          <span>•</span>
                          <span style={{ color: '#38bdf8' }}>{p.barcode}</span>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                          {p.category || 'General'}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {currency}{Number(p.costPrice).toFixed(2)}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                        {currency}{Number(p.sellingPrice).toFixed(2)}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '999px',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          background: isLow ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isLow ? '#fbbf24' : '#34d399',
                          border: isLow ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                        }}>
                          {isLow && <AlertTriangle size={12} />}
                          {p.stockQuantity} units
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              setStockProduct(p);
                              setStockChange('');
                              setStockReason('RESTOCK');
                              setShowStockModal(true);
                            }}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            title="Adjust Stock (+/-)"
                          >
                            <ArrowUpDown size={13} />
                            <span>Stock</span>
                          </button>

                          <button
                            className="btn-secondary"
                            onClick={() => {
                              if (onPrintBarcode) {
                                onPrintBarcode(p.id);
                              }
                            }}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: 'var(--primary)' }}
                            title="Print Barcode Labels"
                          >
                            <Barcode size={13} />
                            <span>Label</span>
                          </button>

                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenEdit(p)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            title="Edit Product"
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Add/Edit Modal */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <form onSubmit={handleSaveProduct}>
              <div className="modal-header">
                <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                <button type="button" className="btn-close-modal" onClick={() => setShowProductModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {formError && (
                  <div style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#fca5a5',
                    fontSize: '0.8rem',
                  }}>
                    {formError}
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Basmati Rice (1kg)"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="form-grid-2">
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      Barcode (EAN-13 / Code 128) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 8901234567890"
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      Internal SKU Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SKU-1002"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      Selling Price ({currency}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={formSellingPrice}
                      onChange={(e) => setFormSellingPrice(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      Purchase Cost ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formCostPrice}
                      onChange={(e) => setFormCostPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Grocery / Bakery"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      GST / Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formTaxRate}
                      onChange={(e) => setFormTaxRate(e.target.value)}
                    />
                  </div>
                </div>

                {!editingProduct && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      Opening Stock Quantity
                    </label>
                    <input
                      type="number"
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Low-Stock Alert Threshold (Units)
                  </label>
                  <input
                    type="number"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && stockProduct && (
        <div className="modal-overlay" onClick={() => setShowStockModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <form onSubmit={handleAdjustStockSubmit}>
              <div className="modal-header">
                <h3>Stock Adjustment</h3>
                <button type="button" className="btn-close-modal" onClick={() => setShowStockModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600 }}>{stockProduct.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Current Stock: <strong style={{ color: '#fff' }}>{stockProduct.stockQuantity} units</strong>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Adjustment Quantity (+ to add, - to subtract) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. +10 or -2"
                    autoFocus
                    value={stockChange}
                    onChange={(e) => setStockChange(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Reason for Adjustment
                  </label>
                  <select
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value as any)}
                  >
                    <option value="RESTOCK">Supplier Restock (Add)</option>
                    <option value="DAMAGE">Damaged / Expired Goods (Remove)</option>
                    <option value="CORRECTION">Physical Audit Correction</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Audit Reference / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PO-8823 or Physical Count"
                    value={stockNotes}
                    onChange={(e) => setStockNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowStockModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Apply Stock Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
