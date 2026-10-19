import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';
import { Invoice, SettingsMap } from '../types';

interface ThermalReceiptProps {
  invoice: Invoice;
  settings: SettingsMap;
  cashReceived?: number;
  changeDue?: number;
  isPreview?: boolean; // If true, renders inline on screen; if false, renders in #print-portal
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  invoice,
  settings,
  cashReceived,
  changeDue,
  isPreview = false,
}) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  const shopName = settings.SHOP_NAME || 'FRESHMART SUPERMARKET';
  const shopAddress = settings.SHOP_ADDRESS || '123 Commercial Main Road, City';
  const shopPhone = settings.SHOP_PHONE || '+91 98765 43210';
  const shopGst = settings.SHOP_GST || '';
  const currency = settings.CURRENCY || '₹';
  const footerNote = settings.RECEIPT_FOOTER || 'Thank you for shopping with us! Please visit again.';
  const printerWidth = settings.PRINTER_WIDTH || '80mm';

  const is58mm = printerWidth === '58mm';

  useEffect(() => {
    if (barcodeRef.current && invoice.invoiceNumber) {
      try {
        JsBarcode(barcodeRef.current, invoice.invoiceNumber, {
          format: 'CODE128',
          width: is58mm ? 1.3 : 1.7,
          height: 38,
          displayValue: true,
          fontSize: 10,
          font: 'monospace',
          textMargin: 2,
          margin: 4,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (err) {
        console.warn('Receipt barcode render error:', err);
      }
    }
  }, [invoice.invoiceNumber, is58mm]);

  const formattedDate = new Date(invoice.createdAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const receiptContent = (
    <div
      style={{
        width: is58mm ? '54mm' : '76mm',
        maxWidth: is58mm ? '54mm' : '76mm',
        margin: '0 auto',
        padding: '3mm 2mm',
        fontFamily: "'JetBrains Mono', 'Courier New', Courier, monospace",
        fontSize: is58mm ? '10px' : '11.5px',
        lineHeight: 1.3,
        color: '#000000',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
      }}
    >
      {/* Shop Header */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <h2
          style={{
            fontSize: is58mm ? '14px' : '17px',
            fontWeight: 800,
            margin: '0 0 2px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: '#000000',
          }}
        >
          {shopName}
        </h2>
        <div style={{ fontSize: is58mm ? '9px' : '10.5px', color: '#111' }}>{shopAddress}</div>
        <div style={{ fontSize: is58mm ? '9px' : '10.5px', color: '#111' }}>Tel: {shopPhone}</div>
        {shopGst && (
          <div
            style={{
              fontSize: is58mm ? '9px' : '10px',
              fontWeight: 700,
              display: 'inline-block',
              border: '1px solid #000',
              padding: '1px 5px',
              marginTop: '2px',
              borderRadius: '2px',
            }}
          >
            GSTIN: {shopGst}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', margin: '3px 0', fontSize: '10px', color: '#000' }}>
        ========================================
      </div>

      {/* Meta Information */}
      <div style={{ fontSize: is58mm ? '9.5px' : '11px', marginBottom: '3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Invoice No:</span>
          <strong>{invoice.invoiceNumber}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date & Time:</span>
          <span>{formattedDate}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Payment Tender:</span>
          <strong>{invoice.paymentMethod}</strong>
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '3px 0', fontSize: '10px', color: '#000' }}>
        ----------------------------------------
      </div>

      {/* Line Items Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: is58mm ? '9.5px' : '11px',
          color: '#000',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ padding: '3px 0', width: '48%', fontWeight: 700 }}>ITEM</th>
            <th style={{ padding: '3px 0', textAlign: 'center', width: '14%', fontWeight: 700 }}>QTY</th>
            <th style={{ padding: '3px 0', textAlign: 'right', width: '18%', fontWeight: 700 }}>RATE</th>
            <th style={{ padding: '3px 0', textAlign: 'right', width: '20%', fontWeight: 700 }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => (
            <tr key={idx} style={{ verticalAlign: 'top', borderBottom: '0.5px dashed #ccc' }}>
              <td style={{ padding: '3px 0', wordBreak: 'break-word' }}>
                <span style={{ fontWeight: 600 }}>{item.productName}</span>
                {item.discount > 0 && (
                  <div style={{ fontSize: '9px', fontStyle: 'italic', color: '#333' }}>
                    (Disc: -{currency}{item.discount})
                  </div>
                )}
              </td>
              <td style={{ padding: '3px 0', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '3px 0', textAlign: 'right' }}>{Number(item.unitPrice).toFixed(2)}</td>
              <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 700 }}>
                {Number(item.lineTotal).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: 'center', margin: '3px 0', fontSize: '10px', color: '#000' }}>
        ----------------------------------------
      </div>

      {/* Summary Totals */}
      <div style={{ fontSize: is58mm ? '10px' : '11.5px', color: '#000' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
          <span>Subtotal:</span>
          <span>{currency} {Number(invoice.subtotal).toFixed(2)}</span>
        </div>

        {Number(invoice.discountAmount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
            <span>Discount Applied:</span>
            <span>-{currency} {Number(invoice.discountAmount).toFixed(2)}</span>
          </div>
        )}

        {Number(invoice.taxAmount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
            <span>Taxes / GST:</span>
            <span>+{currency} {Number(invoice.taxAmount).toFixed(2)}</span>
          </div>
        )}

        <div style={{ borderTop: '1.5px solid #000', margin: '4px 0' }} />

        {/* Large Net Payable */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: is58mm ? '13px' : '16px',
            fontWeight: 800,
            padding: '2px 0',
          }}
        >
          <span>NET PAYABLE:</span>
          <span>{currency} {Number(invoice.totalAmount).toFixed(2)}</span>
        </div>

        <div style={{ borderTop: '1.5px solid #000', margin: '4px 0' }} />

        {/* Cash Tender Breakdown */}
        {invoice.paymentMethod === 'CASH' && cashReceived !== undefined && cashReceived > 0 && (
          <div style={{ fontSize: is58mm ? '9.5px' : '11px', marginTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cash Received:</span>
              <span>{currency} {Number(cashReceived).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Change Returned:</span>
              <span>{currency} {Number(changeDue || 0).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', margin: '4px 0', fontSize: '10px', color: '#000' }}>
        ========================================
      </div>

      {/* Invoice Barcode */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0' }}>
        <svg ref={barcodeRef} style={{ maxWidth: '100%', height: '42px' }} />
      </div>

      {/* Footer Notices */}
      <div style={{ textAlign: 'center', fontSize: is58mm ? '8.5px' : '9.5px', marginTop: '4px', color: '#111' }}>
        <div>Total Items Sold: {invoice.items.reduce((acc, i) => acc + i.quantity, 0)}</div>
        <div style={{ marginTop: '3px', fontStyle: 'italic', fontWeight: 600 }}>{footerNote}</div>
        <div style={{ marginTop: '2px', fontSize: '8px' }}>Goods once sold cannot be returned without bill.</div>
        <div style={{ marginTop: '4px', fontSize: '8px', color: '#555' }}>
          *** THANK YOU - VISIT AGAIN ***
        </div>
      </div>
    </div>
  );

  // If used for on-screen preview
  if (isPreview) {
    return <div className="paper-receipt-card">{receiptContent}</div>;
  }

  // If used for real physical printing, render into dedicated #print-portal container
  const portalRoot = document.getElementById('print-portal');
  if (portalRoot) {
    return createPortal(receiptContent, portalRoot);
  }

  return null;
};
