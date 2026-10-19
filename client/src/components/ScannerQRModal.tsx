import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone, Wifi, Copy, Check, Shield, Key, RefreshCw, Unplug, Edit2 } from 'lucide-react';
import { api } from '../services/api';
import { NetworkInfo } from '../types';
import { TerminalSessionInfo, regenerateTerminalKey, updateTerminalName } from '../services/socket';

interface ScannerQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  isScannerConnected: boolean;
  terminalSession: TerminalSessionInfo;
  onSessionUpdated: (session: TerminalSessionInfo) => void;
  onDisconnectScanner: () => void;
}

export const ScannerQRModal: React.FC<ScannerQRModalProps> = ({
  isOpen,
  onClose,
  isScannerConnected,
  terminalSession,
  onSessionUpdated,
  onDisconnectScanner,
}) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [counterNameInput, setCounterNameInput] = useState(terminalSession.terminalName);

  useEffect(() => {
    if (isOpen) {
      setCounterNameInput(terminalSession.terminalName);
      setLoading(true);
      api.getScannerInfo()
        .then((info) => {
          if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            info.scannerUrl = `${window.location.origin}/scanner`;
          }
          setNetworkInfo(info);
        })
        .catch((err) => {
          console.error('Failed to load scanner network info:', err);
          setNetworkInfo({
            lanIp: window.location.hostname,
            serverPort: window.location.port ? parseInt(window.location.port, 10) : 443,
            clientPort: window.location.port ? parseInt(window.location.port, 10) : 443,
            scannerUrl: `${window.location.origin}/scanner`,
            qrDataUrl: '',
          });
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, terminalSession.terminalName]);

  if (!isOpen) return null;

  const baseScannerUrl = networkInfo?.scannerUrl || `${window.location.origin}/scanner`;
  const pairedScannerUrl = `${baseScannerUrl}?session=${terminalSession.sessionId}&key=${terminalSession.authKey}&name=${encodeURIComponent(terminalSession.terminalName)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(pairedScannerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCounterName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterNameInput.trim()) return;
    const updated = updateTerminalName(counterNameInput.trim());
    onSessionUpdated(updated);
    setIsEditingName(false);
  };

  const handleRegenerateKey = () => {
    if (confirm('Regenerate security key? Any currently paired phone will be disconnected.')) {
      onDisconnectScanner();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Shield size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Secure Scanner Pairing</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Encrypted terminal channel for multi-display counters
              </p>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: 'center' }}>
          {/* Display Counter Name Bar */}
          <div style={{
            background: 'var(--bg-input)',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            border: '1px solid var(--border-subtle)',
          }}>
            {isEditingName ? (
              <form onSubmit={handleSaveCounterName} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <input
                  type="text"
                  value={counterNameInput}
                  onChange={(e) => setCounterNameInput(e.target.value)}
                  placeholder="e.g. Counter 1, Counter 2"
                  style={{ flex: 1, padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                  autoFocus
                />
                <button type="submit" className="btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                  Save
                </button>
              </form>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    This Display:
                  </span>
                  <strong style={{ color: '#38bdf8', fontSize: '0.9rem' }}>{terminalSession.terminalName}</strong>
                </div>
                <button
                  onClick={() => setIsEditingName(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                  }}
                  title="Rename Counter"
                >
                  <Edit2 size={13} />
                  <span>Rename</span>
                </button>
              </>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '2rem 0', color: 'var(--text-muted)' }}>Generating Secure QR Code...</div>
          ) : (
            <div>
              {/* QR Code Container */}
              <div style={{
                display: 'inline-block',
                padding: '16px',
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                marginBottom: '1rem',
              }}>
                <QRCodeSVG
                  value={pairedScannerUrl}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Status and Auth Key Badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
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
                  {isScannerConnected ? 'Phone Scanner Paired' : 'Waiting for phone scan...'}
                </div>

                <div style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  <Key size={12} />
                  <span>PIN: {terminalSession.authKey}</span>
                </div>
              </div>

              {/* Connected Phone Disconnect Button OR Regenerate Key */}
              {isScannerConnected ? (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={onDisconnectScanner}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <Unplug size={15} />
                    <span>Disconnect Phone Scanner</span>
                  </button>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Revokes access and generates a fresh Auth Key for this counter.
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={handleRegenerateKey}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Regenerate Key</span>
                  </button>
                </div>
              )}

              {/* Direct Pairing Link Box */}
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
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '300px',
                }}>
                  {pairedScannerUrl}
                </span>
                <button
                  onClick={handleCopy}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copied ? 'var(--success)' : '#60a5fa',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.4rem',
                    fontWeight: 600,
                  }}
                  title="Copy Pairing Link"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Multi-Counter Explanation */}
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
                  <Shield size={14} color="#60a5fa" />
                  <span>Multi-Display Isolation Active:</span>
                </div>
                Scans from this phone will <strong>only add products to {terminalSession.terminalName}</strong>. Other displays (e.g. Counter 2) will never receive these scans.
              </div>
            </div>
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

