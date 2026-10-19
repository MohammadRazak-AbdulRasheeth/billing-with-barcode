import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, RefreshCw, Layers, Sparkles, Tag } from 'lucide-react';
import { Product } from '../types';
import { api } from '../services/api';

interface BarcodeGeneratorProps {
  products: Product[];
  currency?: string;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({ products, currency = '₹' }) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0] || null);
  const [customBarcode, setCustomBarcode] = useState('');
  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'EAN13'>('CODE128');
  const [labelCount, setLabelCount] = useState<number>(24);
  const [labelsPerPage, setLabelsPerPage] = useState<'single' | 'sheet24' | 'sheet40'>('sheet24');

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (products.length > 0 && !selectedProduct) {
      handleSelectProduct(products[0]);
    }
  }, [products]);

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setCustomBarcode(p.barcode);
    setProductTitle(p.name);
    setProductPrice(String(p.sellingPrice));
    
    // Auto-detect format
    if (p.barcode.length === 13 && /^\d+$/.test(p.barcode)) {
      setBarcodeFormat('EAN13');
    } else {
      setBarcodeFormat('CODE128');
    }
  };

  const handleGenerateNewCode = async () => {
    try {
      const { barcode } = await api.generateBarcode();
      setCustomBarcode(barcode);
      setBarcodeFormat('EAN13');
    } catch {
      const random = 'INT' + Math.floor(10000000 + Math.random() * 90000000);
      setCustomBarcode(random);
      setBarcodeFormat('CODE128');
    }
  };

  // Render preview barcode
  useEffect(() => {
    if (svgRef.current && customBarcode) {
      try {
        JsBarcode(svgRef.current, customBarcode, {
          format: barcodeFormat,
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          font: 'monospace',
          textMargin: 4,
          margin: 10,
        });
      } catch (e) {
        console.warn('Barcode render warning:', e);
      }
    }
  }, [customBarcode, barcodeFormat]);

  const handlePrintLabels = () => {
    window.print();
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Controls Card */}
        <div className="card">
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
              <Tag size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Barcode Label Designer</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Generate Code 128 & EAN-13 sticker sheets
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Select Existing Product (or customize below)
              </label>
              <select
                value={selectedProduct?.id || ''}
                onChange={(e) => {
                  const p = products.find((x) => x.id === parseInt(e.target.value, 10));
                  if (p) handleSelectProduct(p);
                }}
              >
                <option value="">-- Manual Custom Entry --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.barcode}] - {currency}{p.sellingPrice}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Barcode Text / Value
                </label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <input
                    type="text"
                    value={customBarcode}
                    onChange={(e) => setCustomBarcode(e.target.value)}
                    placeholder="e.g. 8901030381023"
                  />
                  <button
                    className="btn-secondary"
                    onClick={handleGenerateNewCode}
                    title="Auto-Generate New Barcode"
                    style={{ padding: '0 0.75rem' }}
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Barcode Symbology
                </label>
                <select
                  value={barcodeFormat}
                  onChange={(e) => setBarcodeFormat(e.target.value as any)}
                >
                  <option value="CODE128">Code 128 (Alphanumeric / Internal)</option>
                  <option value="EAN13">EAN-13 (Standard Retail 13-digit)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Product Label Header Title
                </label>
                <input
                  type="text"
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  placeholder="e.g. Organic Green Tea"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Selling Price ({currency})
                </label>
                <input
                  type="number"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Label Print Layout
                </label>
                <select
                  value={labelsPerPage}
                  onChange={(e) => setLabelsPerPage(e.target.value as any)}
                >
                  <option value="sheet24">A4 Sheet - 24 Labels (3 x 8 Grid)</option>
                  <option value="sheet40">A4 Sheet - 40 Labels (4 x 10 Grid)</option>
                  <option value="single">Single Label Roll Printer (50x30mm)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Number of Copies to Print
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={labelCount}
                  onChange={(e) => setLabelCount(Math.max(1, parseInt(e.target.value || '1', 10)))}
                />
              </div>
            </div>

            <div style={{ marginTop: '0.5rem' }}>
              <button className="btn-primary" onClick={handlePrintLabels} style={{ width: '100%', padding: '0.75rem' }}>
                <Printer size={18} />
                Print {labelCount} Barcode Labels
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Single Sticker Live Preview
          </h4>

          <div style={{
            background: '#ffffff',
            color: '#000000',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
            textAlign: 'center',
            width: '260px',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              fontFamily: 'sans-serif',
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {productTitle || 'Product Name'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
              <svg ref={svgRef} style={{ maxWidth: '100%', height: '70px' }} />
            </div>

            <div style={{
              fontSize: '13px',
              fontWeight: '800',
              fontFamily: 'sans-serif',
              marginTop: '4px',
            }}>
              MRP: {currency}{Number(productPrice || 0).toFixed(2)}
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Works with standard desktop printers (A4 adhesive sheets) and dedicated thermal label printers.
          </div>
        </div>
      </div>

      {/* Hidden Print Container for Labels */}
      <div className="barcode-labels-print-container" style={{ display: 'none' }}>
        <style>{`
          @media print {
            .barcode-labels-print-container {
              display: grid !important;
              grid-template-columns: ${labelsPerPage === 'single' ? '1fr' : labelsPerPage === 'sheet40' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)'};
              gap: 4mm;
              padding: 5mm;
              background: #ffffff;
            }
            .barcode-label-item {
              border: 1px dashed #ccc;
              padding: 2mm;
              text-align: center;
              font-family: sans-serif;
              color: #000;
              page-break-inside: avoid;
            }
          }
        `}</style>
        {Array.from({ length: labelCount }).map((_, i) => (
          <div key={i} className="barcode-label-item">
            <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{productTitle}</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>MRP: {currency}{productPrice}</div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace' }}>{customBarcode}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
