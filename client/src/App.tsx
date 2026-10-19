import React, { useState, useEffect } from 'react';
import { socket, joinPosSession } from './services/socket';
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
  const [isScannerConnected, setIsScannerConnected] = useState(socket.connected);
  const [showQRModal, setShowQRModal] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<Invoice | null>(null);

  // Initialize POS Terminal
  useEffect(() => {
    joinPosSession();
    loadInitialData();

    // Socket.IO event listeners
    const handleConnect = () => setIsScannerConnected(true);
    const handleDisconnect = () => setIsScannerConnected(false);
    const handlePeerJoined = () => setIsScannerConnected(true);

    // Live barcode scanned from mobile camera
    const handleBarcodeReceived = (data: {
      found: boolean;
      barcode: string;
      product?: Product;
      timestamp: string;
    }) => {
      console.log('[POS Terminal] Barcode received from phone:', data);

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
    socket.on('peer-joined', handlePeerJoined);
    socket.on('barcode-received', handleBarcodeReceived);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('peer-joined', handlePeerJoined);
      socket.off('barcode-received', handleBarcodeReceived);
    };
  }, []);

  // Sync live cart total and item count to mobile phone scanner
  useEffect(() => {
    if (!isMobileScannerRoute) {
      const totalCount = cart.reduce((a, b) => a + b.quantity, 0);
      const totalAmount = cart.reduce((acc, item) => {
        const p = parseFloat(item.product.sellingPrice.toString());
        return acc + Math.max(0, p * item.quantity - item.discount);
      }, 0);
      socket.emit('update-cart-summary', { count: totalCount, total: totalAmount });
    }
  }, [cart, isMobileScannerRoute]);

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
