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

type SheetFormat =
  | 'thermal_25x10_quad'
  | 'thermal_25x10_quad_gap'
  | 'thermal_35x22_triple'
  | 'thermal_35x22_triple_compact'
  | 'thermal_35x22_dual'
  | 'thermal_35x22'
  | 'thermal_50x30'
  | 'thermal_38x25'
  | 'a4_24'
  | 'a4_40'
  | 'a4_65';

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  products,
  currency = '₹',
  shopName = 'FRESHMART',
  selectedProductId,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customBarcode, setCustomBarcode] = useState('');
  const [productTitle, setProductTitle] = useState('');
  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'EAN13'>('CODE128');

  // Label configuration options - defaults to TVS LP 46 DLITE (3 Columns per row: 35x22mm 3-Across)
  const [sheetFormat, setSheetFormat] = useState<SheetFormat>('thermal_35x22_triple');
  const [labelCount, setLabelCount] = useState<number>(30);
  // Left and right margin for each sticker (default 2mm)
  const [stickerMarginX, setStickerMarginX] = useState<number>(2);
  // Barcode height on sticker in mm (default 16.5mm, range 10-19mm)
  const [barcodeHeightMm, setBarcodeHeightMm] = useState<number>(16.5);
  // Left alignment offset for printer roll (default 0mm)
  const [rollLeftOffset, setRollLeftOffset] = useState<number>(0);
  const [showProductName, setShowProductName] = useState(true);
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

  // Generate high-resolution razor-sharp vector SVG barcode (zero blur on screen and thermal print)
  const barcodeImageDataUrl = useMemo(() => {
    if (!customBarcode || !customBarcode.trim()) return '';
    const cleanCode = customBarcode.trim();

    // Determine actual format to use
    let targetFormat: string = barcodeFormat;
    if (barcodeFormat === 'EAN13' && !isValidEAN13(cleanCode)) {
      // If user selected EAN13 but checksum is invalid, fall back to CODE128 so barcode always renders!
      targetFormat = 'CODE128';
    }

    const is25x10 = sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap';

    // Calculate barcode bar height dynamically based on user-chosen barcodeHeightMm
    // Calculate standard barcode bar height in dots for 203 DPI thermal printing
    const calculatedBarHeight = is25x10
      ? Math.max(28, Math.min(48, Math.round(barcodeHeightMm * 4.5)))
      : Math.max(35, Math.min(80, Math.round(barcodeHeightMm * 4)));

    const barcodeQuietZone = is25x10 ? 12 : 8;
    const barcodeFontSize = is25x10 ? 8 : 14;
    const barcodeTextMargin = is25x10 ? 1 : 2;
    const barcodeModuleWidth = is25x10 ? 1 : 2;

    try {
      const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svgNode, cleanCode, {
        format: targetFormat,
        width: barcodeModuleWidth,
        height: calculatedBarHeight,
        displayValue: showBarcodeText,
        fontSize: barcodeFontSize,
        fontOptions: 'bold',
        font: 'monospace',
        textMargin: barcodeTextMargin,
        margin: barcodeQuietZone, // Standard quiet zone (white space margins) mandatory for scanner recognition
        background: '#ffffff',
        lineColor: '#000000',
      });
      svgNode.setAttribute('shape-rendering', 'crispEdges');
      const xml = new XMLSerializer().serializeToString(svgNode);
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    } catch (e) {
      // Secondary fallback to universal CODE128 vector SVG
      try {
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(svgNode, cleanCode, {
          format: 'CODE128',
          width: barcodeModuleWidth,
          height: calculatedBarHeight,
          displayValue: showBarcodeText,
          fontSize: barcodeFontSize,
          fontOptions: 'bold',
          font: 'monospace',
          textMargin: barcodeTextMargin,
          margin: barcodeQuietZone,
          background: '#ffffff',
          lineColor: '#000000',
        });
        svgNode.setAttribute('shape-rendering', 'crispEdges');
        const xml = new XMLSerializer().serializeToString(svgNode);
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
      } catch (fallbackErr) {
        console.warn('Barcode rendering error:', fallbackErr);
        return '';
      }
    }
  }, [customBarcode, barcodeFormat, showBarcodeText, barcodeHeightMm, sheetFormat]);

  // When sheet format changes, update recommended label count preset
  const handleFormatChange = (fmt: SheetFormat) => {
    setSheetFormat(fmt);
    if (fmt === 'thermal_25x10_quad' || fmt === 'thermal_25x10_quad_gap') {
      setLabelCount(40);
      setBarcodeHeightMm(7.5);
      setStickerMarginX(1);
    } else if (fmt === 'thermal_35x22_triple' || fmt === 'thermal_35x22_triple_compact') {
      setLabelCount(30);
      setBarcodeHeightMm(16.5);
      setStickerMarginX(2);
    } else if (fmt === 'thermal_35x22_dual') {
      setLabelCount(20);
      setBarcodeHeightMm(16.5);
      setStickerMarginX(2);
    } else if (fmt === 'thermal_35x22') {
      setLabelCount(10);
      setBarcodeHeightMm(16.5);
      setStickerMarginX(2);
    } else if (fmt === 'a4_24') setLabelCount(24);
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
      case 'thermal_35x22':
      case 'thermal_50x30':
      case 'thermal_38x25':
        return '1fr';
      case 'thermal_35x22_dual':
        return 'repeat(2, 35mm)';
      case 'thermal_35x22_triple':
      case 'thermal_35x22_triple_compact':
        return 'repeat(3, 35mm)';
      case 'thermal_25x10_quad':
      case 'thermal_25x10_quad_gap':
        return 'repeat(4, 25mm)';
      case 'a4_24':
        return 'repeat(3, 1fr)';
      case 'a4_40':
        return 'repeat(4, 1fr)';
      case 'a4_65':
        return 'repeat(5, 1fr)';
      default:
        return '1fr';
    }
  };

  const portalRoot = typeof document !== 'undefined' ? document.getElementById('print-portal') : null;

  return (
    <div>
      {/* Top Banner */}
      <div className="barcode-generator-layout">
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
                Calibrated for TVS LP 46 DLITE (35×22mm Thermal) & Sticker Sheets
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

            {/* Title */}
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
                  <option value="thermal_25x10_quad">Thermal Roll — 100x10 mm (4 Columns: 25x10 mm × 4 Stickers per Row) ★ 25x10mm 4-Up</option>
                  <option value="thermal_25x10_quad_gap">Thermal Roll — 104x10 mm (4 Columns: 25x10 mm with 1mm Gap / 4-Up)</option>
                  <option value="thermal_35x22_triple">TVS LP 46 DLITE — 105x22 mm (3 Columns: 35x22 mm × 3 Stickers per Row) ★ Default</option>
                  <option value="thermal_35x22_triple_compact">TVS LP 46 DLITE — 108x22 mm (3 Columns: 35x22 mm × 3 Compact Roll)</option>
                  <option value="thermal_35x22_dual">TVS LP 46 DLITE — 35x22 mm (2 Columns / 2-Across)</option>
                  <option value="thermal_35x22">TVS LP 46 DLITE — 35x22 mm (1 Column / Single Roll)</option>
                  <option value="thermal_50x30">Thermal Roll — 50x30 mm (Single)</option>
                  <option value="thermal_38x25">Thermal Roll — 38x25 mm (Mini)</option>
                  <option value="a4_65">A4 Sheet — 65 Labels (5x13 Grid, 38x21mm)</option>
                  <option value="a4_40">A4 Sheet — 40 Labels (4x10 Grid, 52x30mm)</option>
                  <option value="a4_24">A4 Sheet — 24 Labels (3x8 Grid, 70x37mm)</option>
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

            {/* Margin & Size Calibration Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Barcode Height
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input
                    type="number"
                    min={sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap' ? "4" : "10"}
                    max={sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap' ? "9.5" : "19"}
                    step="0.5"
                    value={barcodeHeightMm}
                    onChange={(e) => {
                      const isSmall = sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap';
                      const minH = isSmall ? 4 : 10;
                      const maxH = isSmall ? 9.5 : 19;
                      const defH = isSmall ? 7 : 16.5;
                      setBarcodeHeightMm(Math.max(minH, Math.min(maxH, parseFloat(e.target.value) || defH)));
                    }}
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mm</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Left & Right Margin
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input
                    type="number"
                    min="0"
                    max="8"
                    step="0.5"
                    value={stickerMarginX}
                    onChange={(e) => setStickerMarginX(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mm</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Roll Left Offset
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    step="0.5"
                    value={rollLeftOffset}
                    onChange={(e) => setRollLeftOffset(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mm</span>
                </div>
              </div>
            </div>

            {/* Elements Toggles */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
                Included Sticker Elements:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: (sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap') ? '270px' : sheetFormat.includes('35x22') ? '280px' : '300px',
              marginBottom: '0.85rem',
            }}
          >
            <h4
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Sticker Preview
            </h4>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
              }}
            >
              {sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap'
                ? '1 Row 4 Columns (25×10mm)'
                : sheetFormat === 'thermal_35x22_triple'
                ? '1 Row 3 Columns (35×22mm)'
                : sheetFormat === 'thermal_35x22_dual'
                ? '2 Columns (35×22mm)'
                : sheetFormat === 'thermal_35x22'
                ? '1 Column (35×22mm)'
                : sheetFormat.replace('thermal_', '').replace('a4_', 'A4 ')}
            </span>
          </div>

          {/* Realistic Adhesive Sticker Card */}
          <div
            style={{
              background: '#ffffff',
              color: '#000000',
              padding: (sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap')
                ? '8px 14px'
                : sheetFormat.includes('35x22')
                ? '10px 14px'
                : '12px 14px',
              borderRadius: '6px',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.45)',
              textAlign: 'center',
              width: (sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap')
                ? '260px'
                : sheetFormat.includes('35x22')
                ? '270px'
                : sheetFormat.startsWith('thermal')
                ? '270px'
                : '280px',
              minHeight: (sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap')
                ? '104px'
                : sheetFormat.includes('35x22')
                ? '145px'
                : 'auto',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            {showProductName && (
              <div
                style={{
                  fontSize: (sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap') ? '9.5px' : '11px',
                  fontWeight: 700,
                  marginBottom: (sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap') ? '3px' : '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {productTitle || 'Product Name'}
              </div>
            )}

            {barcodeImageDataUrl ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '4px 0', width: '100%' }}>
                <img
                  src={barcodeImageDataUrl}
                  alt="Barcode Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: (sheetFormat === 'thermal_25x10_quad' || sheetFormat === 'thermal_25x10_quad_gap') ? '68px' : '90px',
                    height: 'auto',
                    width: 'auto',
                    display: 'block',
                    imageRendering: 'pixelated',
                  }}
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
          </div>

          {/* Scannable Indicator */}
          {barcodeImageDataUrl && (
            <div
              style={{
                marginTop: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '4px 10px',
                borderRadius: '9999px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <Check size={12} />
              <span>Preview Scannable (Point phone camera or scanner gun)</span>
            </div>
          )}

          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.75rem',
              borderRadius: '6px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textAlign: 'left',
              maxWidth: '320px',
              lineHeight: 1.5,
            }}
          >
            <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: '4px' }}>
              🖨️ {sheetFormat.includes('25x10') ? '25×10mm 4-Up Print Calibration:' : 'TVS LP 46 DLITE Print Calibration:'}
            </div>
            • <strong>Printer</strong>: {sheetFormat.includes('25x10') ? 'Thermal Barcode Printer (203 DPI)' : 'TVS LP 46 Dlite (203 DPI)'}<br />
            • <strong>Roll Layout</strong>: {sheetFormat === 'thermal_25x10_quad' ? '1 Row with 4 Stickers (100×10mm Roll, 4 × 25×10mm Stickers)' : sheetFormat === 'thermal_25x10_quad_gap' ? '1 Row with 4 Stickers (104×10mm Roll with 1mm Gap)' : '1 Row with 3 Stickers (105×22mm Roll, 3 × 35×22mm Stickers)'}<br />
            • <strong>Barcode Height</strong>: {barcodeHeightMm}mm<br />
            • <strong>Sticker Margins</strong>: {stickerMarginX}mm Left & Right per sticker<br />
            • <strong>Driver Paper Size</strong>: {sheetFormat === 'thermal_25x10_quad' ? '100×10mm (or 4-Up 25×10 on 100mm Width)' : sheetFormat === 'thermal_25x10_quad_gap' ? '104×10mm (or 4-Up 25×10 on 104mm Width)' : '105×22mm (or 3-Up 35×22 on 105mm Width)'}<br />
            • <strong>Margins</strong>: None (0mm)<br />
            • <strong>Scale</strong>: 100% (Default)<br />
            • <strong>Headers & Footers</strong>: Off
          </div>
        </div>
      </div>

      {/* Real Physical Print Portal Render - Calibrated for TVS LP 46 DLITE & 25x10mm 4-Up Rolls */}
      {isPrinting &&
        portalRoot &&
        createPortal(
          <>
            <style>{`
              @page {
                size: ${
                  sheetFormat === 'thermal_25x10_quad'
                    ? '100mm 10mm'
                    : sheetFormat === 'thermal_25x10_quad_gap'
                    ? '104mm 10mm'
                    : sheetFormat === 'thermal_35x22_triple'
                    ? '105mm 22mm'
                    : sheetFormat === 'thermal_35x22_triple_compact'
                    ? '108mm 22mm'
                    : sheetFormat === 'thermal_35x22_dual'
                    ? '72mm 22mm'
                    : sheetFormat === 'thermal_35x22'
                    ? '35mm 22mm'
                    : sheetFormat === 'thermal_50x30'
                    ? '50mm 30mm'
                    : sheetFormat === 'thermal_38x25'
                    ? '38mm 25mm'
                    : 'A4 portrait'
                } !important;
                margin: 0mm !important;
              }
              @media print {
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #print-portal {
                  display: block !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                }
                .tvs-barcode-img {
                  image-rendering: -webkit-optimize-contrast !important;
                  image-rendering: crisp-edges !important;
                  image-rendering: pixelated !important;
                }
              }
            `}</style>

            {sheetFormat === 'thermal_25x10_quad' ? (
              // 1-Row 4-Columns (4-Across): 100mm width x 10mm height roll (4 x 25x10mm stickers per row)
              <div
                style={{
                  width: '100mm',
                  margin: '0 auto',
                  padding: '0',
                  paddingLeft: `${rollLeftOffset}mm`,
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                }}
              >
                {Array.from({ length: Math.ceil(labelCount / 4) }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '25mm 25mm 25mm 25mm',
                      width: '100mm',
                      height: '10mm',
                      minHeight: '10mm',
                      maxHeight: '10mm',
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {[0, 1, 2, 3].map((colIndex) => {
                      const itemIdx = rowIndex * 4 + colIndex;
                      if (itemIdx >= labelCount) {
                        return <div key={colIndex} style={{ width: '25mm', height: '10mm' }} />;
                      }
                      return (
                        <div
                          key={colIndex}
                          style={{
                            width: '25mm',
                            height: '10mm',
                            minHeight: '10mm',
                            maxHeight: '10mm',
                            padding: `0.1mm ${stickerMarginX}mm`,
                            textAlign: 'center',
                            fontFamily: 'Arial, sans-serif',
                            color: '#000000',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                          }}
                        >
                          {showProductName && (
                            <div
                              style={{
                                fontSize: '6px',
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: `calc(25mm - ${stickerMarginX * 2}mm)`,
                                margin: '0 0 0.15mm 0',
                                color: '#000000',
                                lineHeight: 1.0,
                              }}
                            >
                              {productTitle}
                            </div>
                          )}

                          {barcodeImageDataUrl && (
                            <img
                              src={barcodeImageDataUrl}
                              alt="Barcode"
                              className="tvs-barcode-img"
                              style={{
                                maxWidth: `calc(25mm - ${stickerMarginX * 2}mm)`,
                                maxHeight: `${showProductName ? Math.min(barcodeHeightMm, 7.8) : barcodeHeightMm}mm`,
                                height: 'auto',
                                width: 'auto',
                                display: 'block',
                                margin: '0 auto',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : sheetFormat === 'thermal_25x10_quad_gap' ? (
              // 1-Row 4-Columns with 1mm Gap: 104mm width x 10mm height roll
              <div
                style={{
                  width: '104mm',
                  margin: '0 auto',
                  padding: '0',
                  paddingLeft: `${rollLeftOffset}mm`,
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                }}
              >
                {Array.from({ length: Math.ceil(labelCount / 4) }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '25mm 25mm 25mm 25mm',
                      columnGap: '1mm',
                      width: '104mm',
                      height: '10mm',
                      minHeight: '10mm',
                      maxHeight: '10mm',
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {[0, 1, 2, 3].map((colIndex) => {
                      const itemIdx = rowIndex * 4 + colIndex;
                      if (itemIdx >= labelCount) {
                        return <div key={colIndex} style={{ width: '25mm', height: '10mm' }} />;
                      }
                      return (
                        <div
                          key={colIndex}
                          style={{
                            width: '25mm',
                            height: '10mm',
                            minHeight: '10mm',
                            maxHeight: '10mm',
                            padding: `0.1mm ${stickerMarginX}mm`,
                            textAlign: 'center',
                            fontFamily: 'Arial, sans-serif',
                            color: '#000000',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                          }}
                        >
                          {showProductName && (
                            <div
                              style={{
                                fontSize: '6px',
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: `calc(25mm - ${stickerMarginX * 2}mm)`,
                                margin: '0 0 0.15mm 0',
                                color: '#000000',
                                lineHeight: 1.0,
                              }}
                            >
                              {productTitle}
                            </div>
                          )}

                          {barcodeImageDataUrl && (
                            <img
                              src={barcodeImageDataUrl}
                              alt="Barcode"
                              className="tvs-barcode-img"
                              style={{
                                maxWidth: `calc(25mm - ${stickerMarginX * 2}mm)`,
                                maxHeight: `${showProductName ? Math.min(barcodeHeightMm, 7.8) : barcodeHeightMm}mm`,
                                height: 'auto',
                                width: 'auto',
                                display: 'block',
                                margin: '0 auto',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : sheetFormat === 'thermal_35x22_triple' ? (
              // TVS LP 46 DLITE 1-Row 3-Stickers Mode: 105mm width x 22mm height roll (3 x 35x22mm stickers)
              <div
                style={{
                  width: '105mm',
                  margin: '0 auto',
                  padding: '0',
                  paddingLeft: `${rollLeftOffset}mm`,
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                }}
              >
                {Array.from({ length: Math.ceil(labelCount / 3) }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '35mm 35mm 35mm',
                      width: '105mm',
                      height: '22mm',
                      minHeight: '22mm',
                      maxHeight: '22mm',
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {[0, 1, 2].map((colIndex) => {
                      const itemIdx = rowIndex * 3 + colIndex;
                      if (itemIdx >= labelCount) {
                        return <div key={colIndex} style={{ width: '35mm', height: '22mm' }} />;
                      }
                      return (
                        <div
                          key={colIndex}
                          style={{
                            width: '35mm',
                            height: '22mm',
                            minHeight: '22mm',
                            maxHeight: '22mm',
                            padding: `0.4mm ${stickerMarginX}mm`,
                            textAlign: 'center',
                            fontFamily: 'Arial, sans-serif',
                            color: '#000000',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                          }}
                        >
                          {showProductName && (
                            <div
                              style={{
                                fontSize: '8.5px',
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: `calc(35mm - ${stickerMarginX * 2}mm)`,
                                margin: '0 0 0.2mm 0',
                                color: '#000000',
                                lineHeight: 1.1,
                              }}
                            >
                              {productTitle}
                            </div>
                          )}

                          {barcodeImageDataUrl && (
                            <img
                              src={barcodeImageDataUrl}
                              alt="Barcode"
                              className="tvs-barcode-img"
                              style={{
                                maxWidth: `calc(35mm - ${stickerMarginX * 2}mm)`,
                                maxHeight: `${barcodeHeightMm}mm`,
                                height: 'auto',
                                width: 'auto',
                                display: 'block',
                                margin: '0 auto',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : sheetFormat === 'thermal_35x22_triple_compact' ? (
              // TVS LP 46 DLITE 1-Row 3-Columns Compact Mode: 35mm + 1.5mm gap + 35mm + 1.5mm gap + 35mm = 108mm width, 22mm height
              <div
                style={{
                  width: '108mm',
                  margin: '0 auto',
                  padding: '0',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                }}
              >
                {Array.from({ length: Math.ceil(labelCount / 3) }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '35mm 35mm 35mm',
                      columnGap: '1.5mm',
                      width: '108mm',
                      height: '22mm',
                      minHeight: '22mm',
                      maxHeight: '22mm',
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {[0, 1, 2].map((colIndex) => {
                      const itemIdx = rowIndex * 3 + colIndex;
                      if (itemIdx >= labelCount) {
                        return <div key={colIndex} style={{ width: '35mm', height: '22mm' }} />;
                      }
                      return (
                        <div
                          key={colIndex}
                          style={{
                            width: '35mm',
                            height: '22mm',
                            minHeight: '22mm',
                            maxHeight: '22mm',
                            padding: `0.4mm ${stickerMarginX}mm`,
                            textAlign: 'center',
                            fontFamily: 'Arial, sans-serif',
                            color: '#000000',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                          }}
                        >
                          {showProductName && (
                            <div
                              style={{
                                fontSize: '8.5px',
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: `calc(35mm - ${stickerMarginX * 2}mm)`,
                                margin: '0 0 0.2mm 0',
                                color: '#000000',
                                lineHeight: 1.1,
                              }}
                            >
                              {productTitle}
                            </div>
                          )}

                          {barcodeImageDataUrl && (
                            <img
                              src={barcodeImageDataUrl}
                              alt="Barcode"
                              className="tvs-barcode-img"
                              style={{
                                maxWidth: `calc(35mm - ${stickerMarginX * 2}mm)`,
                                maxHeight: `${barcodeHeightMm}mm`,
                                height: 'auto',
                                width: 'auto',
                                display: 'block',
                                margin: '0 auto',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : sheetFormat === 'thermal_35x22_dual' ? (
              // TVS LP 46 DLITE 2-Across Mode: 35mm + 2mm gap + 35mm = 72mm width per row, 22mm height
              <div
                style={{
                  width: '72mm',
                  margin: '0 auto',
                  padding: '0',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                }}
              >
                {Array.from({ length: Math.ceil(labelCount / 2) }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '35mm 35mm',
                      columnGap: '2mm',
                      width: '72mm',
                      height: '22mm',
                      minHeight: '22mm',
                      maxHeight: '22mm',
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {[0, 1].map((colIndex) => {
                      const itemIdx = rowIndex * 2 + colIndex;
                      if (itemIdx >= labelCount) {
                        return <div key={colIndex} style={{ width: '35mm', height: '22mm' }} />;
                      }
                      return (
                        <div
                          key={colIndex}
                          style={{
                            width: '35mm',
                            height: '22mm',
                            minHeight: '22mm',
                            maxHeight: '22mm',
                            padding: `0.4mm ${stickerMarginX}mm`,
                            textAlign: 'center',
                            fontFamily: 'Arial, sans-serif',
                            color: '#000000',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                          }}
                        >
                          {showProductName && (
                            <div
                              style={{
                                fontSize: '8.5px',
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: `calc(35mm - ${stickerMarginX * 2}mm)`,
                                margin: '0 0 0.2mm 0',
                                color: '#000000',
                                lineHeight: 1.1,
                              }}
                            >
                              {productTitle}
                            </div>
                          )}

                          {barcodeImageDataUrl && (
                            <img
                              src={barcodeImageDataUrl}
                              alt="Barcode"
                              className="tvs-barcode-img"
                              style={{
                                maxWidth: `calc(35mm - ${stickerMarginX * 2}mm)`,
                                maxHeight: `${barcodeHeightMm}mm`,
                                height: 'auto',
                                width: 'auto',
                                display: 'block',
                                margin: '0 auto',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : sheetFormat === 'thermal_35x22' ? (
              // TVS LP 46 DLITE Single 1-Up Roll Mode: 35mm width x 22mm height per label
              <div
                style={{
                  width: '35mm',
                  margin: '0 auto',
                  padding: '0',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                }}
              >
                {Array.from({ length: labelCount }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: '35mm',
                      height: '22mm',
                      minHeight: '22mm',
                      maxHeight: '22mm',
                      padding: `0.4mm ${stickerMarginX}mm`,
                      textAlign: 'center',
                      fontFamily: 'Arial, sans-serif',
                      color: '#000000',
                      backgroundColor: '#ffffff',
                      pageBreakAfter: 'always',
                      breakAfter: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      margin: '0 auto',
                    }}
                  >
                    {showProductName && (
                      <div
                        style={{
                          fontSize: '8.5px',
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: `calc(35mm - ${stickerMarginX * 2}mm)`,
                          margin: '0 0 0.2mm 0',
                          color: '#000000',
                          lineHeight: 1.1,
                        }}
                      >
                        {productTitle}
                      </div>
                    )}

                    {barcodeImageDataUrl && (
                      <img
                        src={barcodeImageDataUrl}
                        alt="Barcode"
                        className="tvs-barcode-img"
                        style={{
                          maxWidth: `calc(35mm - ${stickerMarginX * 2}mm)`,
                          maxHeight: `${barcodeHeightMm}mm`,
                          height: 'auto',
                          width: 'auto',
                          display: 'block',
                          margin: '0 auto',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // Standard A4 Sheet & Other Roll Formats
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: getGridColumns(sheetFormat),
                  gap: '3mm',
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
                        className="tvs-barcode-img"
                        style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '1px 0' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </>,
          portalRoot
        )}
    </div>
  );
};
