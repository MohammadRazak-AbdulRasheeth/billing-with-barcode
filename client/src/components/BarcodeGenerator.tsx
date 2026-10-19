import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';
import {
  Printer,
  RefreshCw,
  Tag,
  Check,
  Eye,
  Sliders,
  FileSpreadsheet,
} from 'lucide-react';
import { Product } from '../types';
import { api } from '../services/api';

interface BarcodeGeneratorProps {
  products: Product[];
  currency?: string;
  shopName?: string;
  selectedProductId?: number | null;
}

type SheetFormat = 'thermal_50x30' | 'thermal_38x25' | 'a4_24' | 'a4_40' | 'a4_65';

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  products,
  currency = '₹',
  shopName = 'FRESHMART',
  selectedProductId,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customBarcode, setCustomBarcode] = useState('');
  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'EAN13'>('CODE128');

  // Label configuration options
  const [sheetFormat, setSheetFormat] = useState<SheetFormat>('a4_24');
  const [labelCount, setLabelCount] = useState<number>(24);
  const [showShopName, setShowShopName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);

  // Active print flag
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (selectedProductId && products.length > 0) {
      const found = products.find((p) => p.id === selectedProductId);
      if (found) {
        handleSelectProduct(found);
      }
    }
  }, [products, selectedProductId]);

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setCustomBarcode(p.barcode);
    setProductTitle(p.name);
    setProductPrice(String(p.sellingPrice));

    // Auto-detect EAN-13 vs Code 128
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

  // Helper: check if string is valid EAN-13 with matching modulo-10 checksum
  const isValidEAN13 = (code: string) => {
    if (!/^\d{13}$/.test(code)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    return check === parseInt(code[12], 10);
  };

  // Generate high-resolution barcode image data URL
  const barcodeImageDataUrl = useMemo(() => {
    if (!customBarcode || !customBarcode.trim()) return '';
    const cleanCode = customBarcode.trim();

    // Determine actual format to use
    let targetFormat: string = barcodeFormat;
    if (barcodeFormat === 'EAN13' && !isValidEAN13(cleanCode)) {
      // If user selected EAN13 but checksum is invalid, fall back to CODE128 so barcode always renders!
      targetFormat = 'CODE128';
    }

    try {
      const canvas = document.createElement('canvas');
      const isCompact = sheetFormat === 'a4_65' || sheetFormat === 'thermal_38x25';
      JsBarcode(canvas, cleanCode, {
        format: targetFormat,
        width: isCompact ? 1.5 : 2,
        height: isCompact ? 36 : 50,
        displayValue: showBarcodeText,
        fontSize: isCompact ? 10 : 13,
        font: 'monospace',
        textMargin: 3,
        margin: 4,
        background: '#ffffff',
        lineColor: '#000000',
      });
      return canvas.toDataURL('image/png');
    } catch (e) {
      // Secondary fallback to universal CODE128
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, cleanCode, {
          format: 'CODE128',
          width: 2,
          height: 48,
          displayValue: showBarcodeText,
          background: '#ffffff',
          lineColor: '#000000',
        });
        return canvas.toDataURL('image/png');
      } catch (fallbackErr) {
        console.warn('Barcode rendering error:', fallbackErr);
        return '';
      }
    }
  }, [customBarcode, barcodeFormat, showBarcodeText, sheetFormat]);

  // When sheet format changes, update recommended label count preset
  const handleFormatChange = (fmt: SheetFormat) => {
    setSheetFormat(fmt);
    if (fmt === 'a4_24') setLabelCount(24);
    else if (fmt === 'a4_40') setLabelCount(40);
    else if (fmt === 'a4_65') setLabelCount(65);
    else if (fmt === 'thermal_50x30' || fmt === 'thermal_38x25') setLabelCount(10);
  };

  // Print Barcode Stickers via print-portal
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
      }, 1000);
    }, 150);
  };

  // Grid column styles for preview & print
  const getGridColumns = (fmt: SheetFormat) => {
    switch (fmt) {
      case 'thermal_50x30':
      case 'thermal_38x25':
        return '1fr';
      case 'a4_24':
        return 'repeat(3, 1fr)';
      case 'a4_40':
        return 'repeat(4, 1fr)';
      case 'a4_65':
        return 'repeat(5, 1fr)';
      default:
        return 'repeat(3, 1fr)';
    }
  };

  const portalRoot = typeof document !== 'undefined' ? document.getElementById('print-portal') : null;

  return (
    <div>
      {/* Top Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Left: Sticker Settings Form */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Tag size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Barcode Sticker Designer</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Generate Code 128 & EAN-13 adhesive labels
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Select Product */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Select Product to Print
              </label>
              <select
                value={selectedProduct?.id || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setSelectedProduct(null);
                    setCustomBarcode('');
                    setProductTitle('');
                    setProductPrice('');
                    return;
                  }
                  const p = products.find((x) => x.id === parseInt(val, 10));
                  if (p) handleSelectProduct(p);
                }}
              >
                <option value="">-- Select a Product to Print --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.barcode}] — {currency}{Number(p.sellingPrice).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* Barcode & Format */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Barcode Text
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
                    title="Auto-Generate Unique Barcode"
                    style={{ padding: '0 0.75rem' }}
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Format
                </label>
                <select
                  value={barcodeFormat}
                  onChange={(e) => setBarcodeFormat(e.target.value as any)}
                >
                  <option value="CODE128">Code 128 (Universal)</option>
                  <option value="EAN13">EAN-13 (Standard Retail)</option>
                </select>
              </div>
            </div>

            {/* Title & Price */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Label Product Title
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

            {/* Sheet Template & Copy Count */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Sticker Paper / Roll Format
                </label>
                <select
                  value={sheetFormat}
                  onChange={(e) => handleFormatChange(e.target.value as any)}
                >
                  <option value="a4_24">A4 Sheet — 24 Labels (3x8 Grid, 70x37mm)</option>
                  <option value="a4_40">A4 Sheet — 40 Labels (4x10 Grid, 52x30mm)</option>
                  <option value="a4_65">A4 Sheet — 65 Labels (5x13 Grid, 38x21mm)</option>
                  <option value="thermal_50x30">Thermal Label Roll (50x30mm Single)</option>
                  <option value="thermal_38x25">Thermal Label Roll (38x25mm Mini)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Stickers Count
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

            {/* Elements Toggles */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
                Included Sticker Elements:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showShopName}
                    onChange={(e) => setShowShopName(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span>Shop Name</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={(e) => setShowProductName(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span>Product Title</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span>MRP Price</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showBarcodeText}
                    onChange={(e) => setShowBarcodeText(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span>Digits Text</span>
                </label>
              </div>
            </div>

            {/* Print Action */}
            <div style={{ marginTop: '0.5rem' }}>
              <button
                className="btn-primary"
                onClick={handlePrint}
                disabled={!barcodeImageDataUrl}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  opacity: barcodeImageDataUrl ? 1 : 0.6,
                  cursor: barcodeImageDataUrl ? 'pointer' : 'not-allowed',
                }}
              >
                <Printer size={18} />
                {barcodeImageDataUrl ? `Print ${labelCount} Barcode Labels Now` : 'Select a Product to Print'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Single Sticker Preview */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h4
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Live High-Resolution Sticker Preview
          </h4>

          {/* Realistic Adhesive Sticker Card */}
          <div
            style={{
              background: '#ffffff',
              color: '#000000',
              padding: '12px 14px',
              borderRadius: '6px',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.45)',
              textAlign: 'center',
              width: sheetFormat.startsWith('thermal') ? '240px' : '260px',
              border: '1px solid #cbd5e1',
            }}
          >
            {showShopName && (
              <div
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#475569',
                  marginBottom: '2px',
                }}
              >
                {shopName}
              </div>
            )}

            {showProductName && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {productTitle || 'Product Name'}
              </div>
            )}

            {barcodeImageDataUrl ? (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }}>
                <img
                  src={barcodeImageDataUrl}
                  alt="Barcode Preview"
                  style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            ) : (
              <div
                style={{
                  padding: '1.25rem 0.5rem',
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                  fontStyle: 'italic',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '4px',
                  margin: '6px 0',
                }}
              >
                Select a product or enter a barcode to view preview
              </div>
            )}

            {showPrice && (
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  marginTop: '4px',
                }}
              >
                MRP: {currency}{Number(productPrice || 0).toFixed(2)}
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: '1.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              maxWidth: '320px',
              lineHeight: 1.5,
            }}
          >
            Ready for standard A4 sticker paper (laser/inkjet) and direct thermal label printers. Margins are calibrated automatically.
          </div>
        </div>
      </div>

      {/* Real Physical Print Portal Render */}
      {isPrinting &&
        portalRoot &&
        createPortal(
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: getGridColumns(sheetFormat),
              gap: sheetFormat.startsWith('thermal') ? '2mm' : '3mm',
              width: '100%',
              margin: '0 auto',
              padding: '4mm',
              boxSizing: 'border-box',
              backgroundColor: '#ffffff',
            }}
          >
            {Array.from({ length: labelCount }).map((_, i) => (
              <div
                key={i}
                style={{
                  border: '1px dashed #bbb',
                  padding: sheetFormat === 'a4_65' ? '1.5mm' : '2.5mm',
                  textAlign: 'center',
                  fontFamily: 'sans-serif',
                  color: '#000000',
                  backgroundColor: '#ffffff',
                  pageBreakInside: 'avoid',
                  borderRadius: '3px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                {showShopName && (
                  <div
                    style={{
                      fontSize: sheetFormat === 'a4_65' ? '7px' : '8.5px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      color: '#333',
                    }}
                  >
                    {shopName}
                  </div>
                )}

                {showProductName && (
                  <div
                    style={{
                      fontSize: sheetFormat === 'a4_65' ? '8px' : '10px',
                      fontWeight: 'bold',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                      margin: '1px 0',
                    }}
                  >
                    {productTitle}
                  </div>
                )}

                {barcodeImageDataUrl && (
                  <img
                    src={barcodeImageDataUrl}
                    alt="Sticker Barcode"
                    style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '1px 0' }}
                  />
                )}

                {showPrice && (
                  <div
                    style={{
                      fontSize: sheetFormat === 'a4_65' ? '9px' : '11px',
                      fontWeight: 'bold',
                      marginTop: '1px',
                    }}
                  >
                    MRP: {currency}{Number(productPrice || 0).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>,
          portalRoot
        )}
    </div>
  );
};
