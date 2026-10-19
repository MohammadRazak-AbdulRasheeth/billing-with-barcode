import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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
  ShieldAlert,
  RefreshCw,
  Flashlight,
  FlashlightOff,
  ShoppingCart,
  Delete,
  CornerDownLeft,
} from 'lucide-react';
import { socket, joinPosSession } from '../services/socket';
import { playBeepSuccess, playBeepError, triggerHaptic } from '../utils/audio';

export const MobileScannerPage: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const [lastScanned, setLastScanned] = useState<{
    code: string;
    productName?: string;
    price?: number;
    stock?: number;
    success: boolean;
    timestamp: string;
  } | null>(null);

  // Live cart state synced from laptop
  const [cartSummary, setCartSummary] = useState<{ count: number; total: number }>({
    count: 0,
    total: 0,
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const [isSecure, setIsSecure] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [maxZoom, setMaxZoom] = useState<number>(3);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  useEffect(() => {
    // Check if browser context is secure
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setIsSecure(false);
    }

    joinPosSession();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    // Listen for live laptop cart updates
    const handleCartSummary = (data: { count: number; total: number }) => {
      setCartSummary({ count: data.count, total: data.total });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('cart-summary-updated', handleCartSummary);

    // Auto-attempt start
    startCamera();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('cart-summary-updated', handleCartSummary);
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Camera API is disabled by the browser on plain HTTP. Please open using HTTPS (https://' +
            window.location.host +
            window.location.pathname +
            ')'
        );
        return;
      }

      stopCamera();

      // Request high-definition 1080p video feed for crystal-clear long-distance barcode lines
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setCameraActive(true);
      setIsScanning(true);
      setIsPaused(false);

      // Check hardware capabilities (Torch & Hardware Optical/Digital Zoom)
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = (track as any).getCapabilities?.();
        if (capabilities) {
          if (capabilities.torch) setTorchSupported(true);
          if (capabilities.zoom) {
            setZoomSupported(true);
            setMaxZoom(Math.min(capabilities.zoom.max || 3, 4));
          }
        }
      } catch {
        // Capabilities not supported
      }

      // Launch barcode decoding loop
      startDecodingLoop();
    } catch (err: any) {
      console.error('Camera start error:', err);
      setCameraActive(false);
      setCameraError(
        err.message ||
          'Camera permission was not granted. Tap below to enable camera access in your mobile browser.'
      );
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsScanning(false);
  };

  const togglePause = () => {
    if (isPaused) {
      if (videoRef.current) videoRef.current.play();
      setIsPaused(false);
      startDecodingLoop();
    } else {
      if (videoRef.current) videoRef.current.pause();
      setIsPaused(true);
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    }
  };

  const toggleTorch = async () => {
    try {
      if (mediaStreamRef.current) {
        const track = mediaStreamRef.current.getVideoTracks()[0];
        const newStatus = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: newStatus }],
        });
        setIsTorchOn(newStatus);
      }
    } catch (e) {
      console.warn('Flashlight error:', e);
    }
  };

  const applyZoom = async (newZoom: number) => {
    setZoomLevel(newZoom);
    try {
      if (mediaStreamRef.current) {
        const track = mediaStreamRef.current.getVideoTracks()[0];
        await (track as any).applyConstraints({
          advanced: [{ zoom: newZoom }],
        });
      }
    } catch (e) {
      console.warn('Hardware zoom constraint error:', e);
    }
  };

  // High-performance barcode detection engine
  const startDecodingLoop = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    // Check if native BarcodeDetector API is available (iOS 17+ / Chrome Android)
    const hasNativeBarcodeDetector = 'BarcodeDetector' in window;
    let nativeDetector: any = null;

    if (hasNativeBarcodeDetector) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'code_128', 'upc_a', 'upc_e', 'ean_8', 'code_39', 'qr_code'],
        });
      } catch (e) {
        console.warn('Native BarcodeDetector init failed, using fallback:', e);
      }
    }

    // Off-screen canvas for fallback decoding
    const offscreenCanvas = document.createElement('canvas');
    const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    let fallbackScanner: Html5Qrcode | null = null;

    scanIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || isPaused) return;

      const video = videoRef.current;

      // 1. FASTEST PATH: Native Hardware BarcodeDetector (<5ms)
      if (nativeDetector) {
        try {
          const barcodes = await nativeDetector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            if (raw) {
              handleBarcodeDetected(raw);
              return;
            }
          }
        } catch {
          // fall through to fallback
        }
      }

      // 2. FALLBACK PATH: Html5Qrcode / ZXing scan
      try {
        if (!fallbackScanner) {
          fallbackScanner = new Html5Qrcode('qr-reader-hidden-canvas', { verbose: false });
        }
        offscreenCanvas.width = video.videoWidth || 640;
        offscreenCanvas.height = video.videoHeight || 480;
        if (ctx) {
          ctx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
          offscreenCanvas.toBlob(async (blob) => {
            if (blob && fallbackScanner) {
              try {
                const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
                const res = await fallbackScanner.scanFile(file, false);
                if (res) handleBarcodeDetected(res);
              } catch {
                // ignore unrecognised frame
              }
            }
          }, 'image/jpeg', 0.8);
        }
      } catch {
        // ignore frame decoding errors
      }
    }, 80); // ~12-15 checks per second with zero lag
  };

  // Debounced scan handler
  const handleBarcodeDetected = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    const now = Date.now();
    if (code === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 900) {
      return;
    }

    lastScannedCodeRef.current = code;
    lastScannedTimeRef.current = now;

    // Transmit to Laptop Billing Cart over LAN WebSocket (<15ms)
    socket.emit('scan-barcode', { barcode: code }, (response: any) => {
      const isSuccess = response && response.success;
      if (isSuccess) {
        if (soundEnabled) playBeepSuccess();
        triggerHaptic('success');
        setLastScanned({
          code,
          productName: response.productName,
          price: response.sellingPrice,
          stock: response.stock,
          success: true,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        if (soundEnabled) playBeepError();
        triggerHaptic('error');
        setLastScanned({
          code,
          productName: 'Product Not Found in Catalog',
          success: false,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    });
  };

  // Keypad Handlers
  const handleKeypadPress = (val: string) => {
    setKeypadInput((prev) => prev + val);
  };

  const handleKeypadDelete = () => {
    setKeypadInput((prev) => prev.slice(0, -1));
  };

  const handleKeypadSubmit = () => {
    if (!keypadInput.trim()) return;
    handleBarcodeDetected(keypadInput.trim());
    setKeypadInput('');
    setShowKeypad(false);
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
        padding: '0.85rem 1rem',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
            }}
          >
            <Smartphone size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
              POS Wireless Scanner
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: isConnected ? '#34d399' : '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'currentColor',
                  boxShadow: isConnected ? '0 0 8px #34d399' : 'none',
                }}
              />
              {isConnected ? 'Synced with Laptop Cart (<15ms)' : 'Connecting to Laptop...'}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {torchSupported && (
            <button
              onClick={toggleTorch}
              style={{
                background: isTorchOn ? '#f59e0b' : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                padding: '0.45rem',
                borderRadius: '8px',
              }}
              title={isTorchOn ? 'Turn Off Flashlight' : 'Turn On Flashlight'}
            >
              {isTorchOn ? <FlashlightOff size={17} /> : <Flashlight size={17} />}
            </button>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              padding: '0.45rem',
              borderRadius: '8px',
            }}
            title={soundEnabled ? 'Mute Sound' : 'Unmute'}
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>

          <button
            onClick={togglePause}
            style={{
              background: isPaused ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              padding: '0.45rem',
              borderRadius: '8px',
            }}
            title={isPaused ? 'Resume Camera' : 'Pause Camera'}
          >
            {isPaused ? <Play size={17} /> : <Pause size={17} />}
          </button>
        </div>
      </div>

      {/* Live Synced Laptop Cart Status Strip */}
      <div
        style={{
          background: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '0.5rem 0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.85rem',
          fontSize: '0.8rem',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#94a3b8' }}>
          <ShoppingCart size={15} color="#38bdf8" />
          <span>Active Cart on Counter:</span>
        </span>
        <strong style={{ color: '#38bdf8', fontSize: '0.9rem' }}>
          {cartSummary.count} {cartSummary.count === 1 ? 'item' : 'items'} • ₹{cartSummary.total.toFixed(2)}
        </strong>
      </div>

      {/* Insecure Context Warning (if accessed over plain http) */}
      {!isSecure && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '10px',
            padding: '0.65rem 0.85rem',
            marginBottom: '0.85rem',
            fontSize: '0.75rem',
            color: '#fbbf24',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <div>
            Mobile browsers require <strong>HTTPS</strong> for camera permissions.{' '}
            <a
              href={`https://${window.location.host}${window.location.pathname}`}
              style={{ color: '#38bdf8', textDecoration: 'underline' }}
            >
              Switch to HTTPS here
            </a>
          </div>
        </div>
      )}

      {/* Futuristic Viewfinder Container */}
      <div
        style={{
          position: 'relative',
          borderRadius: '20px',
          overflow: 'hidden',
          backgroundColor: '#000000',
          border: isLastScannedSuccess()
            ? '2px solid #10b981'
            : lastScanned && !lastScanned.success
            ? '2px solid #ef4444'
            : '1px solid rgba(255, 255, 255, 0.12)',
          transition: 'border-color 0.3s',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.85)',
          minHeight: '320px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Modern Targeting Reticle (Center Focus Box) */}
        {cameraActive && !isPaused && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              maxWidth: '300px',
              height: '140px',
              pointerEvents: 'none',
              zIndex: 20,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
              borderRadius: '12px',
            }}
          >
            {/* Reticle Corner Brackets */}
            <div className="scanner-corner scanner-corner-tl" />
            <div className="scanner-corner scanner-corner-tr" />
            <div className="scanner-corner scanner-corner-bl" />
            <div className="scanner-corner scanner-corner-br" />

            {/* Animated Laser Sweep inside the scan box */}
            <div className="scanner-laser-line" />
          </div>
        )}

        {/* Quick Zoom Pill Selector (1x / 2x / 3x) for Long Distance Scanning */}
        {cameraActive && !isPaused && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '9999px',
              padding: '3px 6px',
              display: 'flex',
              gap: '4px',
              zIndex: 30,
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
            }}
          >
            {[1, 2, 3].map((z) => (
              <button
                key={z}
                onClick={(e) => {
                  e.stopPropagation();
                  applyZoom(z);
                }}
                style={{
                  background: zoomLevel === z ? '#2563eb' : 'transparent',
                  color: zoomLevel === z ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '3px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {z}x
              </button>
            ))}
          </div>
        )}

        {/* Native HTML5 Video Camera Feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="scanner-video-feed"
          style={{
            display: cameraActive ? 'block' : 'none',
            transform: zoomLevel > 1 ? `scale(${zoomLevel})` : 'none',
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-out',
          }}
        />

        {/* Hidden auxiliary canvas for fallback background decoding */}
        <div id="qr-reader-hidden-canvas" style={{ display: 'none' }} />

        {/* Prompt to start camera (iOS / First time) */}
        {!cameraActive && !cameraError && (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(37, 99, 235, 0.2)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <Camera size={26} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              Camera Scanner Ready
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1.25rem', maxWidth: '280px', margin: '0 auto 1.25rem' }}>
              Tap below to start wireless barcode scanning on your phone.
            </p>
            <button
              className="btn-primary"
              onClick={startCamera}
              style={{ padding: '0.75rem 1.6rem', fontSize: '0.9rem', fontWeight: 700 }}
            >
              <Camera size={18} />
              Start Scanner
            </button>
          </div>
        )}

        {/* Paused Overlay */}
        {isPaused && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
            }}
          >
            <Pause size={38} color="#fbbf24" style={{ marginBottom: '0.5rem' }} />
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

        {/* Camera Error Message */}
        {cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.96)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              textAlign: 'center',
              zIndex: 30,
            }}
          >
            <AlertCircle size={36} color="#ef4444" style={{ marginBottom: '0.75rem' }} />
            <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: '0.4rem' }}>
              Camera Permission Required
            </div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '1rem' }}>
              {cameraError}
            </div>
            <button className="btn-primary" onClick={startCamera}>
              <RefreshCw size={15} />
              Retry Permission
            </button>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.45)', margin: '0.5rem 0' }}>
        Align product barcode in the glowing box. Scans instantaneously.
      </div>

      {/* Last Scanned Item Bottom Card */}
      {lastScanned && (
        <div
          style={{
            marginTop: '0.4rem',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            background: lastScanned.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${lastScanned.success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {lastScanned.success ? (
              <CheckCircle2 size={24} color="#34d399" />
            ) : (
              <AlertCircle size={24} color="#f87171" />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                {lastScanned.productName}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'var(--font-mono)' }}>
                {lastScanned.code} • {lastScanned.timestamp}
              </div>
              {lastScanned.stock !== undefined && (
                <div style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 600, marginTop: '2px' }}>
                  ✓ Added to Cart (+1) • {lastScanned.stock} in stock
                </div>
              )}
            </div>
          </div>

          {lastScanned.price !== undefined && (
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#38bdf8' }}>
              ₹{Number(lastScanned.price).toFixed(2)}
            </div>
          )}
        </div>
      )}

      {/* Manual Keypad Modal / Drawer */}
      <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
        {!showKeypad ? (
          <button
            onClick={() => setShowKeypad(true)}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#cbd5e1',
              padding: '0.65rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Keyboard size={16} />
            Enter Barcode via Keypad
          </button>
        ) : (
          <div
            style={{
              background: '#111827',
              border: '1px solid #1f293d',
              borderRadius: '16px',
              padding: '1rem',
              boxShadow: '0 -8px 25px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Keypad Display */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#0b0f19',
                border: '1px solid #1f293d',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                marginBottom: '0.75rem',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: keypadInput ? '#38bdf8' : '#64748b',
                  letterSpacing: '2px',
                }}
              >
                {keypadInput || 'Enter digits...'}
              </span>
              <button
                onClick={handleKeypadDelete}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  padding: '4px',
                }}
              >
                <Delete size={20} />
              </button>
            </div>

            {/* Keypad Buttons (3x4 Grid) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.45rem',
                marginBottom: '0.75rem',
              }}
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((btn) => (
                <button
                  key={btn}
                  onClick={() => {
                    if (btn === 'C') setKeypadInput('');
                    else if (btn === 'OK') handleKeypadSubmit();
                    else handleKeypadPress(btn);
                  }}
                  style={{
                    background: btn === 'OK' ? '#2563eb' : btn === 'C' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.07)',
                    color: btn === 'C' ? '#fca5a5' : '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '0.75rem 0',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {btn}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowKeypad(false)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.8rem',
                padding: '0.3rem',
                cursor: 'pointer',
              }}
            >
              Close Keypad & Return to Camera
            </button>
          </div>
        )}
      </div>
    </div>
  );

  function isLastScannedSuccess() {
    return lastScanned && lastScanned.success;
  }
};
