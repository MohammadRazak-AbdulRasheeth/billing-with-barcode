import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Download,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  Package,
  Layers,
} from 'lucide-react';
import { ReportSummary, InventoryLog } from '../types';
import { api } from '../services/api';

interface ReportsPageProps {
  currency?: string;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ currency = '₹' }) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('today');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [period]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const [sumData, logsData] = await Promise.all([
        api.getReportSummary(period),
        api.getInventoryAudit(),
      ]);
      setSummary(sumData);
      setAuditLogs(logsData);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    window.open(api.getExportCsvUrl(), '_blank');
  };

  return (
    <div>
      {/* Top Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'year', label: 'This Year' },
            { id: 'all', label: 'All Time' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as any)}
              className={`nav-tab-btn ${period === p.id ? 'active' : ''}`}
              style={{ padding: '0.4rem 0.85rem' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button className="btn-secondary" onClick={handleExportCsv}>
          <Download size={16} />
          <span>Export Sales CSV</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Calculating sales reports & profit margins...
        </div>
      ) : summary ? (
        <div>
          {/* Key Metric KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Revenue
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.35rem 0' }}>
                {currency} {Number(summary.totalRevenue).toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                From <strong>{summary.totalInvoices}</strong> completed sales
              </div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Gross Estimated Profit
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', margin: '0.35rem 0' }}>
                {currency} {Number(summary.grossProfit).toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Revenue minus Purchase Costs & GST
              </div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                GST / Taxes Collected
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24', margin: '0.35rem 0' }}>
                {currency} {Number(summary.totalTax).toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Total bill discounts: -{currency}{Number(summary.totalDiscount).toFixed(2)}
              </div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Inventory Status
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#c084fc', margin: '0.35rem 0' }}>
                {summary.totalActiveProducts} Products
              </div>
              <div style={{ fontSize: '0.75rem', color: summary.lowStockCount > 0 ? '#f87171' : 'var(--text-muted)' }}>
                {summary.lowStockCount > 0 ? `⚠️ ${summary.lowStockCount} items below threshold` : 'All items in stock'}
              </div>
            </div>
          </div>

          {/* Breakdown Row: Payment Modes & Top Products */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {/* Payment Modes */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                Payment Tender Breakdown
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { id: 'CASH', label: 'Cash Tender', icon: Banknote, color: '#34d399' },
                  { id: 'UPI', label: 'UPI / QR Payments', icon: QrCode, color: '#60a5fa' },
                  { id: 'CARD', label: 'Card Transactions', icon: CreditCard, color: '#c084fc' },
                  { id: 'OTHER', label: 'Other Methods', icon: DollarSign, color: '#fbbf24' },
                ].map((m) => {
                  const amt = summary.paymentBreakdown[m.id] || 0;
                  const pct = summary.totalRevenue > 0 ? Math.round((amt / summary.totalRevenue) * 100) : 0;
                  const Icon = m.icon;
                  return (
                    <div key={m.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                          <Icon size={15} color={m.color} />
                          {m.label} ({pct}%)
                        </span>
                        <strong style={{ color: 'var(--text-main)' }}>{currency} {Number(amt).toFixed(2)}</strong>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: m.color, borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Selling Products */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                Top Selling Products ({period})
              </h3>
              {summary.topProducts.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
                  No product sales in this period.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {summary.topProducts.slice(0, 5).map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                        padding: '0.4rem 0',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                          {idx + 1}
                        </span>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: '#38bdf8' }}>{currency} {p.revenue.toFixed(2)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.quantity} units sold</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stock Movement Audit Log */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, fontSize: '0.9rem' }}>
              Recent Inventory Audit Trail (Last 100 movements)
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem 1rem' }}>Timestamp</th>
                    <th style={{ padding: '0.6rem 1rem' }}>Product</th>
                    <th style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>Change Qty</th>
                    <th style={{ padding: '0.6rem 1rem' }}>Reason</th>
                    <th style={{ padding: '0.6rem 1rem' }}>Reference / Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>
                        {log.product?.name || `Product ID #${log.productId}`}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center', fontWeight: 700, color: log.changeQuantity > 0 ? '#34d399' : '#f87171' }}>
                        {log.changeQuantity > 0 ? `+${log.changeQuantity}` : log.changeQuantity}
                      </td>
                      <td style={{ padding: '0.6rem 1rem' }}>
                        <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                          {log.reason}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {log.referenceId || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
