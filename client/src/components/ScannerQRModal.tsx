import React, { useEffect, useState } from 'react';
import { X, Smartphone, Wifi, Copy, Check, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { NetworkInfo } from '../types';

interface ScannerQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  isScannerConnected: boolean;
}

export const ScannerQRModal: React.FC<ScannerQRModalProps> = ({ isOpen, onClose, isScannerConnected }) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.getScannerInfo()
        .then((info) => setNetworkInfo(info))
        .catch((err) => console.error('Failed to load scanner network info:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (networkInfo?.scannerUrl) {
      navigator.clipboard.writeText(networkInfo.scannerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Smartphone size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Wireless Mobile Scanner</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Pair any smartphone camera as a barcode scanner
              </p>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: 'center' }}>
          {loading ? (
            <div style={{ padding: '2rem 0', color: 'var(--text-muted)' }}>Generating QR Code...</div>
          ) : networkInfo ? (
            <div>
              <div style={{
                display: 'inline-block',
                padding: '12px',
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                marginBottom: '1rem',
              }}>
                <img
                  src={networkInfo.qrDataUrl}
                  alt="Scanner Pairing QR Code"
                  style={{ width: '210px', height: '210px', display: 'block' }}
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}>
                <div style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: isScannerConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: isScannerConnected ? '#34d399' : '#fbbf24',
                  border: isScannerConnected ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'currentColor',
                  }} />
                  {isScannerConnected ? 'Mobile Phone Connected' : 'Waiting for phone to scan QR...'}
                </div>
              </div>

              <div style={{
                background: 'var(--bg-input)',
                borderRadius: '8px',
                padding: '0.6rem 0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1rem',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--text-main)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {networkInfo.scannerUrl}
                </span>
                <button
                  onClick={handleCopy}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copied ? 'var(--success)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.4rem',
                  }}
                  title="Copy Link"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div style={{
                textAlign: 'left',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                padding: '0.75rem 0.9rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  <Wifi size={14} color="#60a5fa" />
                  <span>Wi-Fi Instructions:</span>
                </div>
                1. Make sure your phone and laptop are connected to the <strong>same Wi-Fi router</strong> or <strong>phone hotspot</strong>.<br />
                2. Scan this QR code with your iPhone or Android camera to open the scanner.
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--danger)' }}>Failed to load local network address.</div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
