import React from 'react';
import { Invoice, SettingsMap } from '../types';

interface ThermalReceiptProps {
  invoice: Invoice;
  settings: SettingsMap;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ invoice, settings }) => {
  const shopName = settings.SHOP_NAME || 'FreshMart Supermarket';
  const shopAddress = settings.SHOP_ADDRESS || '123 Commercial Street, City';
  const shopPhone = settings.SHOP_PHONE || '+91 98765 43210';
  const shopGst = settings.SHOP_GST || '';
  const currency = settings.CURRENCY || '₹';
  const footerNote = settings.RECEIPT_FOOTER || 'Thank you for your visit! Please come again.';
  const printerWidth = settings.PRINTER_WIDTH || '80mm';

  const formattedDate = new Date(invoice.createdAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div
      className="print-only-container"
      style={{
        width: printerWidth === '58mm' ? '54mm' : '76mm',
        margin: '0 auto',
        padding: '2mm',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: printerWidth === '58mm' ? '10px' : '12px',
        lineHeight: 1.3,
        color: '#000000',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0', textTransform: 'uppercase' }}>
          {shopName}
        </h2>
        <div style={{ fontSize: '10px', margin: '2px 0' }}>{shopAddress}</div>
        <div style={{ fontSize: '10px', margin: '2px 0' }}>Tel: {shopPhone}</div>
        {shopGst && <div style={{ fontSize: '10px', fontWeight: 'bold' }}>GSTIN: {shopGst}</div>}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {/* Invoice Meta */}
      <div style={{ fontSize: '11px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Invoice:</span>
          <strong>{invoice.invoiceNumber}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date:</span>
          <span>{formattedDate}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Payment:</span>
          <strong>{invoice.paymentMethod}</strong>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ padding: '2px 0', width: '50%' }}>Item</th>
            <th style={{ padding: '2px 0', textAlign: 'center', width: '15%' }}>Qty</th>
            <th style={{ padding: '2px 0', textAlign: 'right', width: '15%' }}>Rate</th>
            <th style={{ padding: '2px 0', textAlign: 'right', width: '20%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => (
            <tr key={idx} style={{ verticalAlign: 'top' }}>
              <td style={{ padding: '3px 0', wordBreak: 'break-word' }}>
                {item.productName}
                {item.discount > 0 && (
                  <div style={{ fontSize: '9px', fontStyle: 'italic' }}>
                    (Disc: -{currency}{item.discount})
                  </div>
                )}
              </td>
              <td style={{ padding: '3px 0', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '3px 0', textAlign: 'right' }}>{Number(item.unitPrice).toFixed(2)}</td>
              <td style={{ padding: '3px 0', textAlign: 'right' }}>{Number(item.lineTotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {/* Totals */}
      <div style={{ fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
          <span>Subtotal:</span>
          <span>{currency} {Number(invoice.subtotal).toFixed(2)}</span>
        </div>

        {Number(invoice.discountAmount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
            <span>Bill Discount:</span>
            <span>-{currency} {Number(invoice.discountAmount).toFixed(2)}</span>
          </div>
        )}

        {Number(invoice.taxAmount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
            <span>GST / Tax:</span>
            <span>+{currency} {Number(invoice.taxAmount).toFixed(2)}</span>
          </div>
        )}

        <div style={{ borderTop: '1px solid #000', margin: '4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
          <span>NET PAYABLE:</span>
          <span>{currency} {Number(invoice.totalAmount).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '10px' }}>
        <div>Total Items: {invoice.items.reduce((acc, i) => acc + i.quantity, 0)}</div>
        <div style={{ marginTop: '6px', fontStyle: 'italic' }}>{footerNote}</div>
        <div style={{ marginTop: '6px', fontSize: '8px' }}>*** System Generated Receipt ***</div>
      </div>
    </div>
  );
};
