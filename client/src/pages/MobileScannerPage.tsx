import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Keyboard,
  Zap,
} from 'lucide-react';
import { socket, joinPosSession } from '../services/socket';
import { playBeepSuccess, playBeepError, triggerHaptic } from '../utils/audio';

export const MobileScannerPage: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastScanned, setLastScanned] = useState<{
    code: string;
    productName?: string;
    price?: number;
    success: boolean;
    timestamp: string;
  } | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  useEffect(() => {
    // Join POS session
    joinPosSession();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    startCamera();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.0,
      };

      await scanner.start(
        { facingMode: 'environment' }, // Back camera
        config,
        (decodedText) => handleBarcodeDetected(decodedText),
        () => {} // Ignore scan frame misses
      );

      setIsScanning(true);
      setIsPaused(false);
    } catch (err: any) {
      console.error('Camera start error:', err);
      setCameraError(
        err.message || 'Camera permission denied or camera not accessible. Ensure HTTPS or localhost is used.'
      );
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Camera stop error:', e);
      }
    }
    setIsScanning(false);
  };

  const togglePause = () => {
    if (scannerRef.current) {
      if (isPaused) {
        scannerRef.current.resume();
        setIsPaused(false);
      } else {
        scannerRef.current.pause(true);
        setIsPaused(true);
      }
    }
  };

  // Debounced barcode handler (Prevents duplicate accidental multi-reads within 800ms for same code)
  const handleBarcodeDetected = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    const now = Date.now();
    if (code === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 900) {
      return; // Skip duplicate rapid scan
    }

    lastScannedCodeRef.current = code;
    lastScannedTimeRef.current = now;

    // Transmit to Laptop Billing Screen via WebSocket (<15ms)
    socket.emit('scan-barcode', { barcode: code }, (response: any) => {
      const isSuccess = response && response.success;
      if (isSuccess) {
        if (soundEnabled) playBeepSuccess();
        triggerHaptic('success');
        setLastScanned({
          code,
          productName: response.productName,
          price: response.sellingPrice,
          success: true,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        if (soundEnabled) playBeepError();
        triggerHaptic('error');
        setLastScanned({
          code,
          productName: 'Product Not In Catalog',
          success: false,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeDetected(manualCode.trim());
    setManualCode('');
    setShowManualInput(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#030712',
        color: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
        padding: '1rem',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      {/* Mobile Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Smartphone size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>POS Mobile Scanner</div>
            <div style={{ fontSize: '0.7rem', color: isConnected ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
              {isConnected ? 'Connected to Laptop Cart' : 'Connecting to Laptop...'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              padding: '0.45rem',
              borderRadius: '8px',
            }}
            title={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={togglePause}
            style={{
              background: isPaused ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              padding: '0.45rem',
              borderRadius: '8px',
            }}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </div>
      </div>

      {/* Camera Viewport Container */}
      <div
        style={{
          position: 'relative',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#000',
          border: isLastScannedSuccess()
            ? '2px solid #10b981'
            : lastScanned && !lastScanned.success
            ? '2px solid #ef4444'
            : '2px solid #1f293d',
          transition: 'border-color 0.3s',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div id="qr-reader" style={{ width: '100%', minHeight: '300px' }} />

        {isPaused && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <Pause size={40} color="#fbbf24" style={{ marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: 600 }}>Scanner Paused</div>
            <button
              className="btn-primary"
              onClick={togglePause}
              style={{ marginTop: '0.75rem', padding: '0.5rem 1rem' }}
            >
              Tap to Resume
            </button>
          </div>
        )}

        {cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={40} color="#ef4444" style={{ marginBottom: '0.75rem' }} />
            <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: '0.5rem' }}>
              Camera Permission Required
            </div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '1rem' }}>
              {cameraError}
            </div>
            <button className="btn-secondary" onClick={startCamera}>
              Retry Camera
            </button>
          </div>
        )}
      </div>

      {/* Target Aiming Guide Info */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.5)',
          margin: '0.6rem 0',
        }}
      >
        Align barcode inside the central box. Scans automatically.
      </div>

      {/* Last Scan Feedback Banner */}
      {lastScanned && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            background: lastScanned.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${lastScanned.success ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'fadeIn 0.2s ease-in',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {lastScanned.success ? (
              <CheckCircle2 size={24} color="#34d399" />
            ) : (
              <AlertCircle size={24} color="#f87171" />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                {lastScanned.productName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'var(--font-mono)' }}>
                {lastScanned.code} • {lastScanned.timestamp}
              </div>
            </div>
          </div>

          {lastScanned.price !== undefined && (
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#38bdf8' }}>
              ₹{Number(lastScanned.price).toFixed(2)}
            </div>
          )}
        </div>
      )}

      {/* Manual Input Fallback */}
      <div style={{ marginTop: 'auto', paddingTop: '1.25rem' }}>
        {!showManualInput ? (
          <button
            onClick={() => setShowManualInput(true)}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              padding: '0.65rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
            }}
          >
            <Keyboard size={16} />
            Type Barcode Manually
          </button>
        ) : (
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Enter barcode digits..."
              autoFocus
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1rem' }}>
              Send
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowManualInput(false)}
              style={{ padding: '0.6rem 0.8rem' }}
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );

  function isLastScannedSuccess() {
    return lastScanned && lastScanned.success;
  }
};
