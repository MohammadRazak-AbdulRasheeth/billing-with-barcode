import React, { useState, useEffect } from 'react';
import {
  socket,
  getTerminalSession,
  saveTerminalSession,
  registerTerminalOnServer,
  generateAuthKey,
  TerminalSessionInfo,
} from './services/socket';
import { api } from './services/api';
import { Product, CartItem, Invoice, SettingsMap } from './types';
import { Navbar } from './components/Navbar';
import { ScannerQRModal } from './components/ScannerQRModal';
import { ThermalReceipt } from './components/ThermalReceipt';
import { QuickAddModal } from './components/QuickAddModal';
import { BarcodeGenerator } from './components/BarcodeGenerator';
import { BillingPage } from './pages/BillingPage';
import { ProductsPage } from './pages/ProductsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { MobileScannerPage } from './pages/MobileScannerPage';
import { playBeepSuccess, playBeepError } from './utils/audio';

export const App: React.FC = () => {
  // Check if current URL is mobile scanner route (/scanner)
  const isMobileScannerRoute =
    window.location.pathname === '/scanner' || window.location.search.includes('route=scanner');

  if (isMobileScannerRoute) {
    return <MobileScannerPage />;
  }

  // Laptop POS Terminal State
  const [activeTab, setActiveTab] = useState<'billing' | 'products' | 'invoices' | 'barcodes' | 'reports' | 'settings'>('billing');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [terminalSession, setTerminalSession] = useState<TerminalSessionInfo>(getTerminalSession());
  const [isScannerConnected, setIsScannerConnected] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<Invoice | null>(null);
  const [selectedBarcodeProductId, setSelectedBarcodeProductId] = useState<number | null>(null);

  // Initialize POS Terminal & Register Counter Session
  useEffect(() => {
    registerTerminalOnServer(terminalSession, (res) => {
      if (res && res.isPaired) {
        setIsScannerConnected(true);
      }
    });

    loadInitialData();

    // Socket.IO event listeners
    const handleConnect = () => {
      registerTerminalOnServer(terminalSession, (res) => {
        if (res && res.isPaired) setIsScannerConnected(true);
      });
    };
    const handleDisconnect = () => setIsScannerConnected(false);

    // Live scanner paired/unpaired exclusively for this counter
    const handleScannerPaired = (data: any) => {
      console.log(`[POS Terminal ${terminalSession.terminalName}] Phone paired:`, data);
      setIsScannerConnected(true);
      playBeepSuccess();
    };

    const handleScannerUnpaired = () => {
      console.log(`[POS Terminal ${terminalSession.terminalName}] Phone disconnected`);
      setIsScannerConnected(false);
    };

    // Live barcode scanned from mobile camera
    const handleBarcodeReceived = (data: {
      found: boolean;
      barcode: string;
      product?: Product;
      timestamp: string;
    }) => {
      console.log(`[POS Terminal ${terminalSession.terminalName}] Barcode received:`, data);

      if (data.found && data.product) {
        playBeepSuccess();
        // Add or increment item in cart
        setCart((prev) => {
          const existing = prev.find((i) => i.product.id === data.product!.id);
          if (existing) {
            return prev.map((i) =>
              i.product.id === data.product!.id ? { ...i, quantity: i.quantity + 1 } : i
            );
          } else {
            return [{ product: data.product!, quantity: 1, discount: 0 }, ...prev];
          }
        });
      } else {
        // Unknown barcode scanned
        playBeepError();
        setUnknownBarcode(data.barcode);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('scanner-paired', handleScannerPaired);
    socket.on('scanner-unpaired', handleScannerUnpaired);
    socket.on('barcode-received', handleBarcodeReceived);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('scanner-paired', handleScannerPaired);
      socket.off('scanner-unpaired', handleScannerUnpaired);
      socket.off('barcode-received', handleBarcodeReceived);
    };
  }, [terminalSession]);

  // Sync live cart total and item count to mobile phone scanner
  useEffect(() => {
    if (!isMobileScannerRoute) {
      const totalCount = cart.reduce((a, b) => a + b.quantity, 0);
      const totalAmount = cart.reduce((acc, item) => {
        const p = parseFloat(item.product.sellingPrice.toString());
        return acc + Math.max(0, p * item.quantity - item.discount);
      }, 0);
      socket.emit('update-cart-summary', {
        count: totalCount,
        total: totalAmount,
        sessionId: terminalSession.sessionId,
      });
    }
  }, [cart, isMobileScannerRoute, terminalSession.sessionId]);

  const loadInitialData = async () => {
    try {
      const [prodsData, settingsData] = await Promise.all([
        api.getProducts(),
        api.getSettings(),
      ]);
      setProducts(prodsData);
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const handleProductCreated = (newProd: Product) => {
    setProducts((prev) => [newProd, ...prev]);
    // Automatically add newly registered product to active cart
    setCart((prev) => [{ product: newProd, quantity: 1, discount: 0 }, ...prev]);
    setUnknownBarcode(null);
    playBeepSuccess();
  };

  const currency = settings.CURRENCY || '₹';

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(t) => setActiveTab(t as any)}
        isScannerConnected={isScannerConnected}
        onOpenScannerQR={() => setShowQRModal(true)}
        shopName={settings.SHOP_NAME}
        terminalName={terminalSession.terminalName}
      />

      {/* Main Tab Views */}
      <main className="main-content">
        {activeTab === 'billing' && (
          <BillingPage
            cart={cart}
            setCart={setCart}
            settings={settings}
            onInvoiceCreated={(inv) => {
              setLastCompletedInvoice(inv);
              loadInitialData(); // Refresh product stock levels
            }}
            currency={currency}
            isScannerConnected={isScannerConnected}
            onOpenScannerQR={() => setShowQRModal(true)}
          />
        )}

        {activeTab === 'products' && (
          <ProductsPage
            products={products}
            refreshProducts={loadInitialData}
            currency={currency}
            onPrintBarcode={(productId) => {
              setSelectedBarcodeProductId(productId);
              setActiveTab('barcodes');
            }}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesPage
            onReprintInvoice={(inv) => setLastCompletedInvoice(inv)}
            currency={currency}
          />
        )}

        {activeTab === 'barcodes' && (
          <BarcodeGenerator
            products={products}
            currency={currency}
            shopName={settings.SHOP_NAME || 'FRESHMART'}
            selectedProductId={selectedBarcodeProductId}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsPage
            currency={currency}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPage
            settings={settings}
            onSettingsUpdated={(newSettings) => setSettings(newSettings)}
          />
        )}
      </main>

      {/* Wireless Mobile Scanner Pairing QR Modal */}
      <ScannerQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        isScannerConnected={isScannerConnected}
        terminalSession={terminalSession}
        onSessionUpdated={(updated) => {
          setTerminalSession(updated);
          registerTerminalOnServer(updated);
        }}
        onDisconnectScanner={() => {
          const newAuth = generateAuthKey();
          socket.emit(
            'terminal-kick-scanner',
            {
              sessionId: terminalSession.sessionId,
              authKey: terminalSession.authKey,
              newAuthKey: newAuth,
            },
            () => {
              const updated = { ...terminalSession, authKey: newAuth };
              saveTerminalSession(updated);
              setTerminalSession(updated);
              setIsScannerConnected(false);
            }
          );
        }}
      />

      {/* Quick Add Product Modal for Unknown Barcodes */}
      <QuickAddModal
        isOpen={Boolean(unknownBarcode)}
        onClose={() => setUnknownBarcode(null)}
        barcode={unknownBarcode || ''}
        onProductCreated={handleProductCreated}
        currency={currency}
      />

      {/* Printable Thermal Receipt Container (Invoked via window.print()) */}
      {lastCompletedInvoice && (
        <ThermalReceipt invoice={lastCompletedInvoice} settings={settings} />
      )}
    </div>
  );
};

export default App;
