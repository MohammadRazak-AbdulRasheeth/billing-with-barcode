import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Invoice, SettingsMap } from '../types';

interface ThermalReceiptProps {
  invoice: Invoice;
  settings: SettingsMap;
  cashReceived?: number;
  changeDue?: number;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  invoice,
  settings,
  cashReceived,
  changeDue,
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
          width: is58mm ? 1.2 : 1.6,
          height: 35,
          displayValue: true,
          fontSize: 10,
          font: 'monospace',
          textMargin: 2,
          margin: 4,
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

  return (
    <div
      id="print-thermal-container"
      style={{
        width: is58mm ? '54mm' : '76mm',
        maxWidth: is58mm ? '54mm' : '76mm',
        margin: '0 auto',
        padding: '2mm',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: is58mm ? '10px' : '11.5px',
        lineHeight: 1.25,
        color: '#000000',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Shop Header */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <h2
          style={{
            fontSize: is58mm ? '13px' : '16px',
            fontWeight: 'bold',
            margin: '0 0 2px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          {shopName}
        </h2>
        <div style={{ fontSize: is58mm ? '9px' : '10.5px' }}>{shopAddress}</div>
        <div style={{ fontSize: is58mm ? '9px' : '10.5px' }}>Phone: {shopPhone}</div>
        {shopGst && (
          <div style={{ fontSize: is58mm ? '9px' : '10.5px', fontWeight: 'bold' }}>
            GSTIN: {shopGst}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', margin: '3px 0', letterSpacing: '-1px' }}>
        ------------------------------------------
      </div>

      {/* Meta Information */}
      <div style={{ fontSize: is58mm ? '9.5px' : '11px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Invoice No:</span>
          <strong>{invoice.invoiceNumber}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date & Time:</span>
          <span>{formattedDate}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Payment Mode:</span>
          <strong>{invoice.paymentMethod}</strong>
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '3px 0', letterSpacing: '-1px' }}>
        ------------------------------------------
      </div>

      {/* Line Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: is58mm ? '9.5px' : '11px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ padding: '2px 0', width: '48%' }}>Item</th>
            <th style={{ padding: '2px 0', textAlign: 'center', width: '14%' }}>Qty</th>
            <th style={{ padding: '2px 0', textAlign: 'right', width: '18%' }}>Price</th>
            <th style={{ padding: '2px 0', textAlign: 'right', width: '20%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => (
            <tr key={idx} style={{ verticalAlign: 'top' }}>
              <td style={{ padding: '2px 0', wordBreak: 'break-word' }}>
                {item.productName}
                {item.discount > 0 && (
                  <div style={{ fontSize: '9px', fontStyle: 'italic' }}>
                    (-{currency}{item.discount})
                  </div>
                )}
              </td>
              <td style={{ padding: '2px 0', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '2px 0', textAlign: 'right' }}>{Number(item.unitPrice).toFixed(2)}</td>
              <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold' }}>
                {Number(item.lineTotal).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: 'center', margin: '3px 0', letterSpacing: '-1px' }}>
        ------------------------------------------
      </div>

      {/* Bill Totals Summary */}
      <div style={{ fontSize: is58mm ? '10px' : '11.5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
          <span>Subtotal:</span>
          <span>{currency} {Number(invoice.subtotal).toFixed(2)}</span>
        </div>

        {Number(invoice.discountAmount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
            <span>Special Discount:</span>
            <span>-{currency} {Number(invoice.discountAmount).toFixed(2)}</span>
          </div>
        )}

        {Number(invoice.taxAmount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
            <span>Taxes / GST:</span>
            <span>+{currency} {Number(invoice.taxAmount).toFixed(2)}</span>
          </div>
        )}

        <div style={{ borderTop: '1px solid #000', margin: '4px 0' }} />

        {/* Grand Total */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: is58mm ? '13px' : '15px',
            fontWeight: 'bold',
            padding: '2px 0',
          }}
        >
          <span>GRAND TOTAL:</span>
          <span>{currency} {Number(invoice.totalAmount).toFixed(2)}</span>
        </div>

        {/* Cash Tender & Change (If Cash Payment) */}
        {invoice.paymentMethod === 'CASH' && cashReceived !== undefined && cashReceived > 0 && (
          <div style={{ fontSize: is58mm ? '9.5px' : '11px', marginTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cash Tendered:</span>
              <span>{currency} {Number(cashReceived).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Change Returned:</span>
              <span>{currency} {Number(changeDue || 0).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', margin: '4px 0', letterSpacing: '-1px' }}>
        ------------------------------------------
      </div>

      {/* Invoice Barcode for Returns & Fast Lookups */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0' }}>
        <svg ref={barcodeRef} style={{ maxWidth: '100%', height: '40px' }} />
      </div>

      {/* Footer Notes */}
      <div style={{ textAlign: 'center', fontSize: is58mm ? '8.5px' : '9.5px', marginTop: '4px' }}>
        <div>Total Units Sold: {invoice.items.reduce((acc, i) => acc + i.quantity, 0)}</div>
        <div style={{ marginTop: '4px', fontStyle: 'italic' }}>{footerNote}</div>
        <div style={{ marginTop: '4px', fontSize: '8px' }}>*** Thank You - Visit Again ***</div>
      </div>
    </div>
  );
};
