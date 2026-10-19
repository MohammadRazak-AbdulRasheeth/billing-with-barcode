import React from 'react';
import {
  ShoppingCart,
  Package,
  FileText,
  Barcode,
  BarChart3,
  Settings as SettingsIcon,
  Smartphone,
  QrCode,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isScannerConnected: boolean;
  onOpenScannerQR: () => void;
  shopName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isScannerConnected,
  onOpenScannerQR,
  shopName = 'POS Billing',
}) => {
  const tabs = [
    { id: 'billing', label: 'POS Billing', icon: ShoppingCart },
    { id: 'products', label: 'Products & Stock', icon: Package },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'barcodes', label: 'Barcode Generator', icon: Barcode },
    { id: 'reports', label: 'Reports & Profit', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <header className="header-nav">
      <div className="header-top-bar">
        <div className="brand-section">
          <div className="brand-logo-icon">
            <Barcode size={22} />
          </div>
          <div className="brand-text">
            <h1>{shopName}</h1>
            <span>Smart POS & Mobile Scanner</span>
          </div>
        </div>

        <div className="header-actions">
          <div className={`status-badge ${isScannerConnected ? '' : 'offline'}`} title={isScannerConnected ? 'Mobile scanner connected' : 'Mobile scanner disconnected'}>
            <span className="status-dot" />
            <Smartphone size={14} />
            <span className="status-text">{isScannerConnected ? 'Scanner Online' : 'Offline'}</span>
          </div>

          <button className="btn-pair-scanner" onClick={onOpenScannerQR} title="Pair mobile phone camera scanner">
            <QrCode size={15} />
            <span className="pair-btn-text">Pair Phone</span>
          </button>
        </div>
      </div>

      <nav className="nav-tabs" aria-label="Main Navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
