import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  RotateCcw,
  Tag,
  AlertTriangle,
  CheckCircle,
  Percent,
} from 'lucide-react';
import { Product, CartItem, Invoice, SettingsMap } from '../types';
import { api } from '../services/api';
import { playBeepSuccess, playBeepError } from '../utils/audio';
import { ThermalReceipt } from '../components/ThermalReceipt';

interface BillingPageProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  settings: SettingsMap;
  onInvoiceCreated: (invoice: Invoice) => void;
  currency?: string;
  isScannerConnected: boolean;
  onOpenScannerQR: () => void;
}

export const BillingPage: React.FC<BillingPageProps> = ({
  cart,
  setCart,
  settings,
  onInvoiceCreated,
  currency = '₹',
  isScannerConnected,
  onOpenScannerQR,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'OTHER'>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleClearCart();
      } else if (e.key === 'F4') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F9' && cart.length > 0 && !showCheckoutModal) {
        e.preventDefault();
        setShowCheckoutModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, showCheckoutModal]);

  // Live product search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await api.getProducts({ search: searchQuery.trim() });
        setSearchResults(results.slice(0, 6));
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddToCart = (product: Product) => {
    playBeepSuccess();
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      } else {
        return [{ product, quantity: 1, discount: 0 }, ...prev];
      }
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleUpdateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleSetExactQuantity = (productId: number, qty: number) => {
    if (isNaN(qty) || qty <= 0) return;
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item))
    );
  };

  const handleUpdateItemDiscount = (productId: number, disc: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, discount: Math.max(0, disc || 0) } : item
      )
    );
  };

  const handleRemoveItem = (productId: number) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Are you sure you want to discard this bill?')) {
      setCart([]);
      setOverallDiscount(0);
    }
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => {
    const unitPrice = parseFloat(item.product.sellingPrice.toString());
    const lineBase = unitPrice * item.quantity - item.discount;
    return acc + Math.max(0, lineBase);
  }, 0);

  const taxTotal = cart.reduce((acc, item) => {
    const unitPrice = parseFloat(item.product.sellingPrice.toString());
    const lineBase = unitPrice * item.quantity - item.discount;
    const taxRate = parseFloat(item.product.taxRate.toString());
    return acc + (Math.max(0, lineBase) * taxRate) / 100;
  }, 0);

  const totalDiscount = overallDiscount;
  const netPayable = Math.max(0, Math.round((subtotal + taxTotal - totalDiscount) * 100) / 100);

  const cashAmountNum = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, cashAmountNum - netPayable);

  const [completedSale, setCompletedSale] = useState<{
    invoice: Invoice;
    cashReceived: number;
    changeDue: number;
  } | null>(null);

  const triggerThermalPrint = () => {
    document.body.classList.add('printing-thermal');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-thermal');
    }, 1500);
  };

  // Complete Checkout
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const cashAmt = parseFloat(cashReceived) || 0;
      const change = Math.max(0, cashAmt - netPayable);

      const payload = {
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          discount: i.discount,
        })),
        discountAmount: overallDiscount,
        paymentMethod,
        notes,
      };

      const completedInvoice = await api.createInvoice(payload);
      playBeepSuccess();
      onInvoiceCreated(completedInvoice);
      setShowCheckoutModal(false);

      // Record completed sale for modal & reprint
      setCompletedSale({
        invoice: completedInvoice,
        cashReceived: cashAmt,
        changeDue: change,
      });

      // Reset active cart
      setCart([]);
      setOverallDiscount(0);
      setCashReceived('');
      setNotes('');

      // Auto-trigger isolated thermal print
      setTimeout(() => {
        triggerThermalPrint();
      }, 350);
    } catch (err: any) {
      playBeepError();
      setErrorMsg(err.message || 'Failed to complete transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pos-billing-layout">
      {/* Left Column: Search & Cart Items */}
      <div>
        {/* Top Action Bar: Search & Quick Barcode */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', position: 'relative' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product name, SKU, or scan barcode... (Press F4)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />

            {/* Live Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 20,
                  overflow: 'hidden',
                }}
              >
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    style={{
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem' }}>
                        <span>Barcode: {p.barcode}</span>
                        <span>Stock: {p.stockQuantity}</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '1rem' }}>
                      {currency}{Number(p.sellingPrice).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn-secondary"
            onClick={handleClearCart}
            disabled={cart.length === 0}
            title="Discard current bill (F2)"
            style={{ padding: '0.6rem 0.9rem' }}
          >
            <RotateCcw size={16} />
            <span>Reset (F2)</span>
          </button>
        </div>

        {/* Cart Items Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(255, 255, 255, 0.02)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Current Bill ({cart.reduce((a, b) => a + b.quantity, 0)} items)
            </span>
            {!isScannerConnected && (
              <span
                onClick={onOpenScannerQR}
                style={{
                  fontSize: '0.75rem',
                  color: '#fbbf24',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <AlertTriangle size={14} /> Connect phone scanner for instant scan
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <div
              style={{
                padding: '4rem 2rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Tag size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                Cart is Empty
              </h3>
              <p style={{ fontSize: '0.85rem', maxWidth: '360px', margin: '0 auto' }}>
                Scan product barcodes using your mobile camera or search products above to start billing.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '0.6rem 1rem' }}>Item Description</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '130px' }}>Quantity</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', width: '100px' }}>Discount</th>
                    <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => {
                    const unitPrice = parseFloat(item.product.sellingPrice.toString());
                    const lineTotal = unitPrice * item.quantity - item.discount;
                    return (
                      <tr
                        key={item.product.id}
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.product.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {item.product.barcode} {Number(item.product.taxRate) > 0 && `(GST ${item.product.taxRate}%)`}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                          {currency}{unitPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                              onClick={() => handleUpdateQuantity(item.product.id, -1)}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-input)',
                                color: 'var(--text-main)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleSetExactQuantity(item.product.id, parseInt(e.target.value, 10))}
                              style={{
                                width: '45px',
                                textAlign: 'center',
                                padding: '0.2rem',
                                height: 26,
                                fontSize: '0.85rem',
                              }}
                            />
                            <button
                              onClick={() => handleUpdateQuantity(item.product.id, 1)}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-input)',
                                color: 'var(--text-main)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.discount || ''}
                            onChange={(e) => handleUpdateItemDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                            style={{ width: '70px', textAlign: 'right', padding: '0.2rem 0.4rem', height: 26 }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                          {currency}{lineTotal.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleRemoveItem(item.product.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-faint)',
                              cursor: 'pointer',
                              padding: '0.2rem',
                            }}
                            title="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Checkout Summary Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
            Bill Summary
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Items Subtotal:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{currency} {subtotal.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>GST / Taxes:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>+{currency} {taxTotal.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Bill Discount:</span>
              <div style={{ width: '100px' }}>
                <input
                  type="number"
                  min="0"
                  value={overallDiscount || ''}
                  onChange={(e) => setOverallDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  style={{ textAlign: 'right', padding: '0.25rem 0.5rem', height: 30 }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--border-subtle)', margin: '0.5rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>Total Payable:</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
                {currency} {netPayable.toFixed(2)}
              </span>
            </div>
          </div>

          <button
            className="btn-primary"
            disabled={cart.length === 0}
            onClick={() => setShowCheckoutModal(true)}
            style={{
              width: '100%',
              marginTop: '1.25rem',
              padding: '0.85rem',
              fontSize: '1rem',
              fontWeight: 700,
            }}
          >
            Pay & Print Bill (F9)
          </button>
        </div>

        {/* Quick Tips / Keyboard Reference */}
        <div
          className="card"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
            Keyboard Shortcuts:
          </div>
          <div><kbd style={{ background: 'var(--bg-input)', padding: '2px 5px', borderRadius: '4px' }}>F2</kbd> - New Bill / Reset</div>
          <div><kbd style={{ background: 'var(--bg-input)', padding: '2px 5px', borderRadius: '4px' }}>F4</kbd> - Focus Product Search</div>
          <div><kbd style={{ background: 'var(--bg-input)', padding: '2px 5px', borderRadius: '4px' }}>F9</kbd> - Complete & Checkout</div>
        </div>
      </div>

      {/* Checkout & Payment Modal */}
      {showCheckoutModal && (
        <div className="modal-overlay" onClick={() => setShowCheckoutModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Payment & Checkout</h3>
              <button className="btn-close-modal" onClick={() => setShowCheckoutModal(false)}>
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {errorMsg && (
                <div style={{
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                }}>
                  {errorMsg}
                </div>
              )}

              <div style={{
                textAlign: 'center',
                padding: '1rem',
                background: 'var(--bg-input)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Amount Payable</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8' }}>
                  {currency} {netPayable.toFixed(2)}
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Select Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {[
                    { id: 'CASH', label: 'Cash', icon: Banknote },
                    { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                    { id: 'CARD', label: 'Card', icon: CreditCard },
                    { id: 'OTHER', label: 'Other', icon: Tag },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.75rem 0.25rem',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                          color: isSelected ? '#ffffff' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        <Icon size={18} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cash Tender Calculation */}
              {paymentMethod === 'CASH' && (
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                        Cash Received ({currency})
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 500"
                        autoFocus
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                        Change Due ({currency})
                      </label>
                      <div style={{
                        padding: '0.6rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-main)',
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: changeDue > 0 ? '#34d399' : 'var(--text-muted)',
                      }}>
                        {currency} {changeDue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* UPI QR Display */}
              {paymentMethod === 'UPI' && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  fontSize: '0.8rem',
                  color: '#93c5fd',
                  textAlign: 'center',
                }}>
                  Ask the customer to scan the shop UPI QR code on the billing counter.
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Invoice Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer Name / Phone / Ref"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCheckoutModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCompleteSale}
                disabled={isSubmitting}
                style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }}
              >
                <Printer size={18} />
                {isSubmitting ? 'Processing...' : 'Complete & Print (Enter)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Checkout Success Receipt Modal */}
      {completedSale && (
        <div className="modal-overlay" onClick={() => setCompletedSale(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div style={{ padding: '2rem 1.5rem 1rem' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
                }}
              >
                <Printer size={28} />
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                Sale Completed!
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {completedSale.invoice.invoiceNumber}
              </p>

              <div
                style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  margin: '1rem 0',
                  padding: '4px',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <ThermalReceipt
                  invoice={completedSale.invoice}
                  settings={settings}
                  cashReceived={completedSale.cashReceived}
                  changeDue={completedSale.changeDue}
                  isPreview={true}
                />
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Receipt sent to 80mm/58mm thermal printer.
              </p>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'center', gap: '0.75rem' }}>
              <button
                className="btn-secondary"
                onClick={triggerThermalPrint}
                style={{ flex: 1 }}
              >
                <Printer size={15} />
                Reprint
              </button>
              <button
                className="btn-primary"
                onClick={() => setCompletedSale(null)}
                style={{ flex: 1.4 }}
                autoFocus
              >
                Next Bill (F2 / Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Checkout Summary Banner */}
      {cart.length > 0 && !showCheckoutModal && !completedSale && (
        <div className="mobile-checkout-bar">
          <div className="mobile-checkout-info">
            <span className="mobile-checkout-count">
              {cart.reduce((a, b) => a + b.quantity, 0)} {cart.reduce((a, b) => a + b.quantity, 0) === 1 ? 'item' : 'items'}
            </span>
            <span className="mobile-checkout-total">
              {currency}{netPayable.toFixed(2)}
            </span>
          </div>
          <button
            className="btn-primary mobile-checkout-btn"
            onClick={() => setShowCheckoutModal(true)}
          >
            <Banknote size={16} />
            <span>Pay (F8)</span>
          </button>
        </div>
      )}
    </div>
  );
};
