import React, { useState, useEffect } from 'react';
import {
  Save,
  Store,
  Printer,
  Database,
  Download,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { SettingsMap } from '../types';
import { api } from '../services/api';

interface SettingsPageProps {
  settings: SettingsMap;
  onSettingsUpdated: (newSettings: SettingsMap) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSettingsUpdated }) => {
  const [formData, setFormData] = useState<SettingsMap>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const updated = await api.updateSettings(formData);
      onSettingsUpdated(updated);
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const [products, invoices] = await Promise.all([
        api.getProducts(),
        api.getInvoices(),
      ]);
      const backupData = {
        exportedAt: new Date().toISOString(),
        settings: formData,
        products,
        invoices,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate backup file');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <form onSubmit={handleSave}>
        {/* Shop Info Card */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Store size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Shop Details & Receipt Header</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Information printed at the top of customer receipts
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Shop Name *
              </label>
              <input
                type="text"
                required
                value={formData.SHOP_NAME || ''}
                onChange={(e) => handleChange('SHOP_NAME', e.target.value)}
                placeholder="e.g. FreshMart Supermarket"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Store Address
              </label>
              <input
                type="text"
                value={formData.SHOP_ADDRESS || ''}
                onChange={(e) => handleChange('SHOP_ADDRESS', e.target.value)}
                placeholder="e.g. 123 Commercial Main Road, City"
              />
            </div>

            <div className="form-grid-2">
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  value={formData.SHOP_PHONE || ''}
                  onChange={(e) => handleChange('SHOP_PHONE', e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  GSTIN / Tax Registration No.
                </label>
                <input
                  type="text"
                  value={formData.SHOP_GST || ''}
                  onChange={(e) => handleChange('SHOP_GST', e.target.value)}
                  placeholder="33ABCDE1234F1Z5"
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={formData.CURRENCY || '₹'}
                  onChange={(e) => handleChange('CURRENCY', e.target.value)}
                  placeholder="₹"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Invoice Number Prefix
                </label>
                <input
                  type="text"
                  value={formData.INVOICE_PREFIX || 'INV'}
                  onChange={(e) => handleChange('INVOICE_PREFIX', e.target.value)}
                  placeholder="INV"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Printer & Receipt Layout Card */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Printer size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Thermal Printer Configuration</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Set paper roll width and receipt footer text
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Thermal Printer Paper Width
              </label>
              <select
                value={formData.PRINTER_WIDTH || '80mm'}
                onChange={(e) => handleChange('PRINTER_WIDTH', e.target.value)}
              >
                <option value="80mm">80 mm Standard Thermal Roll (Recommended)</option>
                <option value="58mm">58 mm Compact Thermal Roll</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Receipt Footer Greeting Note
              </label>
              <textarea
                rows={2}
                value={formData.RECEIPT_FOOTER || ''}
                onChange={(e) => handleChange('RECEIPT_FOOTER', e.target.value)}
                placeholder="Thank you for shopping with us! Goods once sold cannot be returned."
              />
            </div>
          </div>
        </div>

        {/* Database & Hostinger Integration Guide */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.2)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Database size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>MySQL Database & Hostinger Cloud</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  Centralized cloud storage for products and invoices
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadBackup}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem' }}
            >
              <Download size={14} />
              <span>Export JSON Backup</span>
            </button>
          </div>

          <div style={{
            background: 'var(--bg-input)',
            borderRadius: '8px',
            padding: '0.85rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            border: '1px solid var(--border-subtle)',
          }}>
            <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.3rem' }}>
              Connecting to Hostinger MySQL:
            </strong>
            1. In your <strong>Hostinger hPanel</strong>, go to <strong>Databases → Remote MySQL</strong>.<br />
            2. Add <code>%</code> (wildcard) under Allowed IP to permit laptop connections.<br />
            3. Open <code>.env</code> in this project and paste your Hostinger MySQL connection string:<br />
            <code style={{ background: '#000', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
              DATABASE_URL="mysql://username:password@remote-host:3306/db_name"
            </code>
          </div>
        </div>

        {/* Save Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
          {successMsg ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontWeight: 600, fontSize: '0.85rem' }}>
              <Check size={16} />
              <span>Settings saved successfully!</span>
            </div>
          ) : <div />}

          <button type="submit" className="btn-primary" disabled={isSaving} style={{ padding: '0.75rem 1.8rem', fontSize: '0.95rem' }}>
            <Save size={18} />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
