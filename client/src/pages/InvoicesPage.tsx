import React, { useState, useEffect } from 'react';
import { Search, Printer, Eye, Calendar, FileText, ArrowLeft, X } from 'lucide-react';
import { Invoice } from '../types';
import { api } from '../services/api';

interface InvoicesPageProps {
  onReprintInvoice: (invoice: Invoice) => void;
  currency?: string;
}

export const InvoicesPage: React.FC<InvoicesPageProps> = ({ onReprintInvoice, currency = '₹' }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadInvoices();
  }, [search]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await api.getInvoices({ search: search.trim() || undefined });
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (inv: Invoice) => {
    onReprintInvoice(inv);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div>
      {/* Header Search & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by invoice number or payment method..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        <button className="btn-secondary" onClick={loadInvoices}>
          Refresh History
        </button>
      </div>

      {/* Invoices List Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Invoice Number</th>
                <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                <th style={{ padding: '0.75rem 1rem' }}>Payment Method</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Total Items</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Bill</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No completed sales found.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const dateStr = new Date(inv.createdAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const totalItems = inv.items?.reduce((a, b) => a + b.quantity, 0) || 0;

                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#38bdf8' }}>{inv.invoiceNumber}</span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        {dateStr}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: inv.paymentMethod === 'UPI' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: inv.paymentMethod === 'UPI' ? '#60a5fa' : '#34d399',
                        }}>
                          {inv.paymentMethod}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {totalItems} items
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, fontSize: '0.95rem' }}>
                        {currency} {Number(inv.totalAmount).toFixed(2)}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => setSelectedInvoice(inv)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            title="View items"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>

                          <button
                            className="btn-primary"
                            onClick={() => handlePrint(inv)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            title="Reprint Receipt (Does not duplicate sale)"
                          >
                            <Printer size={13} />
                            <span>Reprint</span>
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

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Invoice Details</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {selectedInvoice.invoiceNumber}
                </span>
              </div>
              <button className="btn-close-modal" onClick={() => setSelectedInvoice(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem', marginBottom: '1rem', background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '8px' }}>
                <div>Date: <strong>{new Date(selectedInvoice.createdAt).toLocaleString()}</strong></div>
                <div>Payment Method: <strong>{selectedInvoice.paymentMethod}</strong></div>
              </div>

              <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.4rem 0' }}>Item</th>
                      <th style={{ padding: '0.4rem 0', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '0.4rem 0', textAlign: 'right' }}>Price</th>
                      <th style={{ padding: '0.4rem 0', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items?.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '0.5rem 0' }}>{item.productName}</td>
                        <td style={{ padding: '0.5rem 0', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>{currency}{Number(item.unitPrice).toFixed(2)}</td>
                        <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600 }}>{currency}{Number(item.lineTotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Subtotal:</span>
                  <span>{currency} {Number(selectedInvoice.subtotal).toFixed(2)}</span>
                </div>
                {Number(selectedInvoice.discountAmount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Discount:</span>
                    <span>-{currency} {Number(selectedInvoice.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(selectedInvoice.taxAmount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>GST / Taxes:</span>
                    <span>+{currency} {Number(selectedInvoice.taxAmount).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.35rem' }}>
                  <span>Total Amount:</span>
                  <span>{currency} {Number(selectedInvoice.totalAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedInvoice(null)}>
                Close
              </button>
              <button className="btn-primary" onClick={() => handlePrint(selectedInvoice)}>
                <Printer size={16} />
                Reprint Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
