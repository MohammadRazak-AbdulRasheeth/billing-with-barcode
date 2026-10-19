import React, { useState } from 'react';
import { X, PlusCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { Product } from '../types';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcode: string;
  onProductCreated: (product: Product) => void;
  currency?: string;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  barcode,
  onProductCreated,
  currency = '₹',
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('20');
  const [taxRate, setTaxRate] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sellingPrice) {
      setError('Product name and selling price are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const product = await api.createProduct({
        name: name.trim(),
        barcode: barcode.trim(),
        category: category.trim(),
        sellingPrice: parseFloat(sellingPrice),
        costPrice: parseFloat(costPrice || '0'),
        stockQuantity: parseInt(stockQuantity || '0', 10),
        taxRate: parseFloat(taxRate || '0'),
      });
      onProductCreated(product);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <PlusCircle size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Quick Register Product</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  Scanned barcode is not yet in inventory
                </p>
              </div>
            </div>
            <button type="button" className="btn-close-modal" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {error && (
              <div style={{
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Scanned Barcode
              </label>
              <input
                type="text"
                value={barcode}
                disabled
                style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#38bdf8', fontWeight: 600, fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Product Name *
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Basmati Rice 1kg"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Selling Price ({currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
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
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Grocery"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Starting Stock Qty
                </label>
                <input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save & Add to Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
