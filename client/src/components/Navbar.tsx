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
      <div className="brand-section">
        <div className="brand-logo-icon">
          <Barcode size={22} />
        </div>
        <div className="brand-text">
          <h1>{shopName}</h1>
          <span>Smart POS & Mobile Scanner</span>
        </div>
      </div>

      <nav className="nav-tabs">
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

      <div className="header-actions">
        <div className={`status-badge ${isScannerConnected ? '' : 'offline'}`}>
          <span className="status-dot" />
          <Smartphone size={14} />
          <span>{isScannerConnected ? 'Mobile Scanner Online' : 'Scanner Offline'}</span>
        </div>

        <button className="btn-pair-scanner" onClick={onOpenScannerQR}>
          <QrCode size={15} />
          <span>Pair Phone</span>
        </button>
      </div>
    </header>
  );
};
