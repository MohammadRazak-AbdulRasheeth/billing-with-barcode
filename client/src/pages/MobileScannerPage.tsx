import React, { useEffect, useState, useRef } from 'react';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
} from '@zxing/library';
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
  Unplug,
  Shield,
  Key,
  QrCode,
} from 'lucide-react';
import { socket } from '../services/socket';
import { playBeepSuccess, playBeepError, triggerHaptic } from '../utils/audio';

// Pre-configure high-performance ZXing MultiFormatReader (EAN-13, Code 128, QR, UPC)
const zxingHints = new Map<DecodeHintType, any>();
zxingHints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.CODE_128,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_8,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
]);
zxingHints.set(DecodeHintType.TRY_HARDER, true);

const zxingReader = new MultiFormatReader();
zxingReader.setHints(zxingHints);

interface PairedSession {
  sessionId: string;
  authKey: string;
  terminalName: string;
}

export const MobileScannerPage: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Authentication & Counter Pairing State
  const [pairedSession, setPairedSession] = useState<PairedSession | null>(() => {
    try {
      const raw = sessionStorage.getItem('pos_scanner_paired');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  });
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [showManualPairModal, setShowManualPairModal] = useState(false);
  const [manualSessionInput, setManualSessionInput] = useState('');
  const [manualKeyInput, setManualKeyInput] = useState('');

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
  const [isHardwareZoomActive, setIsHardwareZoomActive] = useState<boolean>(false);
  const [focusIndicator, setFocusIndicator] = useState<{ x: number; y: number; active: boolean } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const autoFocusIntervalRef = useRef<number | null>(null);
  const focusTimeoutRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const zoomLevelRef = useRef<number>(1);
  const isHardwareZoomActiveRef = useRef<boolean>(false);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');
  const pairedSessionRef = useRef<PairedSession | null>(pairedSession);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    isHardwareZoomActiveRef.current = isHardwareZoomActive;
  }, [isHardwareZoomActive]);

  useEffect(() => {
    pairedSessionRef.current = pairedSession;
  }, [pairedSession]);

  useEffect(() => {
    // Check if browser context is secure
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setIsSecure(false);
    }

    // Auto-pair if session & key are present in URL search parameters
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get('session');
    const urlKey = params.get('key');
    const urlName = params.get('name') || 'Billing Counter';

    const connectWithCredentials = (sId: string, aKey: string, tName?: string) => {
      socket.emit(
        'pair-scanner',
        { sessionId: sId, authKey: aKey, scannerName: 'Mobile Scanner' },
        (res: any) => {
          if (res && res.success) {
            const paired: PairedSession = {
              sessionId: sId,
              authKey: aKey,
              terminalName: res.terminalName || tName || 'Counter',
            };
            setPairedSession(paired);
            sessionStorage.setItem('pos_scanner_paired', JSON.stringify(paired));
            setPairingError(null);
            playBeepSuccess();
            triggerHaptic('success');
          } else {
            setPairingError(res?.error || 'Authentication key failed or expired.');
            setPairedSession(null);
            sessionStorage.removeItem('pos_scanner_paired');
          }
        }
      );
    };

    if (urlSession && urlKey) {
      connectWithCredentials(urlSession, urlKey, urlName);
    } else if (pairedSession) {
      connectWithCredentials(pairedSession.sessionId, pairedSession.authKey, pairedSession.terminalName);
    }

    const handleConnect = () => {
      setIsConnected(true);
      if (pairedSessionRef.current) {
        connectWithCredentials(
          pairedSessionRef.current.sessionId,
          pairedSessionRef.current.authKey,
          pairedSessionRef.current.terminalName
        );
      }
    };
    const handleDisconnect = () => setIsConnected(false);

    // Listen for live laptop cart updates
    const handleCartSummary = (data: { count: number; total: number }) => {
      setCartSummary({ count: data.count, total: data.total });
    };

    // When the laptop terminal kicks or disconnects this scanner
    const handleForceDisconnect = (data: { message?: string }) => {
      alert(data?.message || 'Disconnected by Billing Counter.');
      setPairedSession(null);
      sessionStorage.removeItem('pos_scanner_paired');
      window.history.replaceState({}, '', '/scanner');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('cart-summary-updated', handleCartSummary);
    socket.on('force-disconnected', handleForceDisconnect);

    // Auto-attempt camera start
    startCamera();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('cart-summary-updated', handleCartSummary);
      socket.off('force-disconnected', handleForceDisconnect);
      stopCamera();
    };
  }, []);

  const triggerAutoFocus = async () => {
    try {
      if (mediaStreamRef.current) {
        const track = mediaStreamRef.current.getVideoTracks()[0];
        const capabilities = (track as any).getCapabilities?.();
        if (capabilities?.focusMode?.includes('continuous')) {
          await (track as any).applyConstraints({
            advanced: [{ focusMode: 'continuous' }],
          });
        }
      }
    } catch {}
  };

  const handleTapToFocus = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setFocusIndicator({ x, y, active: true });
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = window.setTimeout(() => {
      setFocusIndicator(null);
    }, 900);

    triggerAutoFocus();
    triggerHaptic('success');
  };

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

      // Request continuous autofocus and full-HD 1080p video feed for maximum barcode bar density
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            // @ts-ignore
            advanced: [{ focusMode: 'continuous' }],
          },
        });
      } catch (err) {
        // Fallback for strict mobile browsers that reject width/height/focusMode constraints
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch (err2) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: 'environment' },
          });
        }
      }

      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setCameraActive(true);
      setIsScanning(true);
      setIsPaused(false);

      // Check hardware capabilities (Torch & Hardware Optical/Digital Zoom & Continuous Autofocus)
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = (track as any).getCapabilities?.();
        if (capabilities) {
          if (capabilities.torch) setTorchSupported(true);
          if (capabilities.zoom) {
            setZoomSupported(true);
            setMaxZoom(Math.min(capabilities.zoom.max || 4, 5));
          }
          if (capabilities.focusMode?.includes('continuous')) {
            await (track as any).applyConstraints({
              advanced: [{ focusMode: 'continuous' }],
            });
          }
        }
      } catch {
        // Capabilities not supported
      }

      // Continuous autofocus refresher: periodic every 3.5s to prevent mobile camera focus drift
      if (autoFocusIntervalRef.current) clearInterval(autoFocusIntervalRef.current);
      autoFocusIntervalRef.current = window.setInterval(() => {
        if (!isPaused && cameraActive) {
          triggerAutoFocus();
        }
      }, 3500);

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
    if (autoFocusIntervalRef.current) {
      clearInterval(autoFocusIntervalRef.current);
      autoFocusIntervalRef.current = null;
    }
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
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
    zoomLevelRef.current = newZoom;
    let hwSuccess = false;
    try {
      if (mediaStreamRef.current) {
        const track = mediaStreamRef.current.getVideoTracks()[0];
        const capabilities = (track as any).getCapabilities?.();
        if (capabilities && capabilities.zoom) {
          const minZ = capabilities.zoom.min || 1;
          const maxZ = capabilities.zoom.max || 4;
          const clamped = Math.max(minZ, Math.min(newZoom, maxZ));
          await (track as any).applyConstraints({
            advanced: [{ zoom: clamped }],
          });
          hwSuccess = true;
        }
      }
    } catch (e) {
      console.warn('Hardware zoom constraint error:', e);
    }
    setIsHardwareZoomActive(hwSuccess);
    isHardwareZoomActiveRef.current = hwSuccess;
    triggerAutoFocus();
  };

  // Ultra-fast high-resolution barcode detection engine with dual binarizers and telephoto ROI crop
  const startDecodingLoop = async () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    // 1. Check if native BarcodeDetector is safely supported without throwing format errors
    let nativeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        let supported: string[] = [];
        if (typeof BarcodeDetectorClass.getSupportedFormats === 'function') {
          try {
            supported = await BarcodeDetectorClass.getSupportedFormats();
          } catch {}
        }
        const preferred = ['ean_13', 'code_128', 'upc_a', 'upc_e', 'ean_8', 'code_39', 'qr_code', 'itf'];
        const formats = supported.length > 0 ? preferred.filter((f) => supported.includes(f)) : preferred;
        if (formats.length > 0) {
          nativeDetector = new BarcodeDetectorClass({ formats });
        }
      } catch (e) {
        console.warn('Native BarcodeDetector init bypassed, using ZXing:', e);
      }
    }

    // Reusable off-screen canvas and 2D context for zero-allocation decoding
    const offscreenCanvas = document.createElement('canvas');
    const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    let isDecoding = false;

    scanIntervalRef.current = window.setInterval(async () => {
      if (isDecoding) return;
      if (!videoRef.current || videoRef.current.readyState < 2 || isPaused) return;

      const video = videoRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh || !ctx) return;

      isDecoding = true;
      frameCountRef.current++;

      try {
        const currentZoom = zoomLevelRef.current || 1;
        const isHwZoom = isHardwareZoomActiveRef.current;
        const effectiveZoom = isHwZoom ? 1 : currentZoom;

        // Calculate targeting reticle Region-Of-Interest (ROI) directly from 1080p sensor pixels
        // At higher zoom levels, crop tighter into the unscaled sensor pixels (true telephoto zoom)
        const roiRatioW = vw >= vh ? 0.60 : 0.72;
        const roiRatioH = vw >= vh ? 0.42 : 0.36;

        let cropW = Math.round((vw * roiRatioW) / effectiveZoom);
        let cropH = Math.round((vh * roiRatioH) / effectiveZoom);

        // Clamp safely to video dimensions
        cropW = Math.max(260, Math.min(cropW, vw));
        cropH = Math.max(160, Math.min(cropH, vh));
        const cropX = Math.max(0, Math.round((vw - cropW) / 2));
        const cropY = Math.max(0, Math.round((vh - cropH) / 2));

        // Preserve native sensor resolution without shrinking down
        const targetW = Math.min(cropW, 960);
        const targetH = Math.min(cropH, 600);

        if (offscreenCanvas.width !== targetW || offscreenCanvas.height !== targetH) {
          offscreenCanvas.width = targetW;
          offscreenCanvas.height = targetH;
        }

        // Disable smoothing to prevent blurring single-pixel 1D barcode lines
        ctx.imageSmoothingEnabled = false;

        // Boost contrast and brightness for thermal paper barcode clarity
        try {
          ctx.filter = 'contrast(1.3) brightness(1.05)';
        } catch {}

        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

        let decodedText: string | null = null;

        // -------------------------------------------------------------
        // TIER 1: Native Hardware BarcodeDetector on the High-Res ROI
        // -------------------------------------------------------------
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(offscreenCanvas);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              decodedText = barcodes[0].rawValue;
            }
          } catch {}

          // Fallback to full frame every 3rd frame if zoomed ROI didn't catch an off-center item
          if (!decodedText && frameCountRef.current % 3 === 0) {
            try {
              const fullBarcodes = await nativeDetector.detect(video);
              if (fullBarcodes && fullBarcodes.length > 0 && fullBarcodes[0].rawValue) {
                decodedText = fullBarcodes[0].rawValue;
              }
            } catch {}
          }
        }

        // -------------------------------------------------------------
        // TIER 2: ZXing Dual Binarizer Engine (Hybrid + GlobalHistogram)
        // -------------------------------------------------------------
        if (!decodedText) {
          try {
            const imgData = ctx.getImageData(0, 0, targetW, targetH);
            const lumSource = new RGBLuminanceSource(imgData.data, targetW, targetH);

            // Pass 2A: HybridBinarizer (adaptive local thresholding)
            try {
              const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));
              const result = zxingReader.decode(bitmap);
              decodedText = result.getText();
            } catch {
              // Pass 2B: GlobalHistogramBinarizer (superior for thin 1D thermal barcodes at a distance)
              try {
                const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(lumSource));
                const result = zxingReader.decode(bitmap);
                decodedText = result.getText();
              } catch {
                // Pass 2C: Inverted fallback for glossy reflections or high-contrast glare
                if (frameCountRef.current % 4 === 0) {
                  try {
                    const invSource = lumSource.invert();
                    const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(invSource));
                    const result = zxingReader.decode(bitmap);
                    decodedText = result.getText();
                  } catch {}
                }
              }
            }
          } catch {}
        }

        if (decodedText) {
          handleBarcodeDetected(decodedText);
        }
      } catch (err) {
        // Ignore unrecognised frame
      } finally {
        isDecoding = false;
      }
    }, 85);
  };

  // Debounced scan handler
  const handleBarcodeDetected = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // 1. Check if the scanned code is a Counter Terminal Pairing QR Code!
    if (code.includes('session=') && code.includes('key=')) {
      try {
        const urlStr = code.startsWith('http') ? code : `https://domain.local/${code.replace(/^\/?/, '')}`;
        const parsedUrl = new URL(urlStr);
        const sId = parsedUrl.searchParams.get('session');
        const aKey = parsedUrl.searchParams.get('key');
        const tName = parsedUrl.searchParams.get('name') || 'Billing Counter';

        if (sId && aKey) {
          socket.emit(
            'pair-scanner',
            { sessionId: sId, authKey: aKey, scannerName: 'Mobile Scanner' },
            (res: any) => {
              if (res && res.success) {
                const paired: PairedSession = {
                  sessionId: sId,
                  authKey: aKey,
                  terminalName: res.terminalName || tName,
                };
                setPairedSession(paired);
                sessionStorage.setItem('pos_scanner_paired', JSON.stringify(paired));
                setPairingError(null);
                if (soundEnabled) playBeepSuccess();
                triggerHaptic('success');
              } else {
                setPairingError(res?.error || 'Failed to authenticate pairing key.');
                if (soundEnabled) playBeepError();
              }
            }
          );
          return;
        }
      } catch (err) {
        // Not a URL QR code, proceed to product barcode handling
      }
    }

    // 2. If scanner is not paired to any counter yet, warn user
    if (!pairedSessionRef.current) {
      if (soundEnabled) playBeepError();
      triggerHaptic('error');
      setPairingError('Scanner is not paired! Point camera at your laptop counter QR code to pair.');
      return;
    }

    const now = Date.now();
    if (code === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 900) {
      return;
    }

    lastScannedCodeRef.current = code;
    lastScannedTimeRef.current = now;

    // Transmit to the specifically paired laptop counter over WebSocket (<15ms)
    socket.emit(
      'scan-barcode',
      {
        barcode: code,
        sessionId: pairedSessionRef.current.sessionId,
        authKey: pairedSessionRef.current.authKey,
      },
      (response: any) => {
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
            productName: response?.error || 'Product Not Found in Catalog',
            success: false,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      }
    );
  };

  const handleDisconnectScanner = () => {
    if (pairedSessionRef.current) {
      if (window.confirm(`Disconnect from ${pairedSessionRef.current.terminalName}?`)) {
        socket.emit('unpair-scanner', { sessionId: pairedSessionRef.current.sessionId });
        setPairedSession(null);
        sessionStorage.removeItem('pos_scanner_paired');
        window.history.replaceState({}, '', '/scanner');
      }
    }
  };

  const handleManualPairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSessionInput.trim() || !manualKeyInput.trim()) return;

    socket.emit(
      'pair-scanner',
      {
        sessionId: manualSessionInput.trim(),
        authKey: manualKeyInput.trim().toUpperCase(),
        scannerName: 'Mobile Scanner',
      },
      (res: any) => {
        if (res && res.success) {
          const paired: PairedSession = {
            sessionId: manualSessionInput.trim(),
            authKey: manualKeyInput.trim().toUpperCase(),
            terminalName: res.terminalName || 'Counter',
          };
          setPairedSession(paired);
          sessionStorage.setItem('pos_scanner_paired', JSON.stringify(paired));
          setShowManualPairModal(false);
          setPairingError(null);
          setManualSessionInput('');
          setManualKeyInput('');
          playBeepSuccess();
          triggerHaptic('success');
        } else {
          setPairingError(res?.error || 'Invalid session or auth key.');
        }
      }
    );
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
      {/* Top Header Bar */}
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
              {pairedSession ? pairedSession.terminalName : 'POS Scanner'}
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: pairedSession && isConnected ? '#34d399' : '#f59e0b',
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
                  boxShadow: pairedSession && isConnected ? '0 0 8px #34d399' : 'none',
                }}
              />
              {pairedSession
                ? isConnected
                  ? `Paired & Synced (<15ms)`
                  : 'Reconnecting to counter...'
                : 'Not Paired'}
            </div>
          </div>
        </div>

        {/* Action Controls & Disconnect Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {pairedSession && (
            <button
              onClick={handleDisconnectScanner}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '0.35rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
              }}
              title={`Disconnect from ${pairedSession.terminalName}`}
            >
              <Unplug size={12} />
              <span>Disconnect</span>
            </button>
          )}

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
              {isTorchOn ? <FlashlightOff size={16} /> : <Flashlight size={16} />}
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
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
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
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </div>
      </div>

      {/* Unpaired Warning & Quick Scan Guide */}
      {!pairedSession && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '10px',
            padding: '0.75rem 0.9rem',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} color="#fbbf24" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fbbf24' }}>
                Not Paired to Counter
              </div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                Point camera at laptop QR code to connect
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowManualPairModal(true)}
            style={{
              background: '#1f2937',
              border: '1px solid #374151',
              color: '#93c5fd',
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Enter PIN
          </button>
        </div>
      )}

      {pairingError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px',
            padding: '0.6rem 0.85rem',
            marginBottom: '0.75rem',
            fontSize: '0.75rem',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{pairingError}</span>
          <button
            onClick={() => setPairingError(null)}
            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

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
          <span>{pairedSession ? `Cart on ${pairedSession.terminalName}:` : 'Counter Cart:'}</span>
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

      {/* Futuristic Viewfinder Container with Tap-To-Focus */}
      <div
        onClick={handleTapToFocus}
        style={{
          position: 'relative',
          borderRadius: '20px',
          overflow: 'hidden',
          backgroundColor: '#000000',
          border: (lastScanned && lastScanned.success)
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
          cursor: 'pointer',
        }}
      >
        {/* Animated Tap-To-Focus Indicator Ring */}
        {focusIndicator?.active && (
          <div
            style={{
              position: 'absolute',
              left: focusIndicator.x,
              top: focusIndicator.y,
              transform: 'translate(-50%, -50%)',
              width: '52px',
              height: '52px',
              border: '2px solid #38bdf8',
              borderRadius: '10px',
              boxShadow: '0 0 14px rgba(56, 189, 248, 0.7)',
              pointerEvents: 'none',
              zIndex: 35,
              animation: 'focus-pulse 0.7s ease-out forwards',
            }}
          />
        )}

        {/* Distance Scan Telephoto Badge */}
        {cameraActive && !isPaused && zoomLevel >= 1.5 && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(37, 99, 235, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(96, 165, 250, 0.5)',
              borderRadius: '9999px',
              padding: '3px 12px',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 28,
              pointerEvents: 'none',
              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.5)',
              letterSpacing: '0.02em',
            }}
          >
            <span>🔭 Distance Telephoto ({zoomLevel}x)</span>
          </div>
        )}

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

        {/* Quick Zoom Pill Selector (1x / 1.5x / 2x / 3x) for Long Distance Scanning */}
        {cameraActive && !isPaused && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '9999px',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 30,
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.65)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[1, 1.5, 2, 3].map((z) => (
              <button
                key={z}
                onClick={(e) => {
                  e.stopPropagation();
                  applyZoom(z);
                }}
                style={{
                  background: zoomLevel === z ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : 'transparent',
                  color: zoomLevel === z ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: zoomLevel === z ? '0 0 10px rgba(37, 99, 235, 0.5)' : 'none',
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
            transform: !isHardwareZoomActive && zoomLevel > 1 ? `scale(${zoomLevel})` : 'none',
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-out',
            cursor: 'pointer',
          }}
        />

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

      {/* Manual Counter PIN Pairing Modal */}
      {showManualPairModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowManualPairModal(false)}
        >
          <div
            className="modal-card"
            style={{ maxWidth: '360px', padding: '1.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} color="#60a5fa" />
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Enter Counter PIN</h3>
              </div>
              <button
                onClick={() => setShowManualPairModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualPairSubmit}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                  Counter Session ID (from laptop modal)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. term_abc123"
                  value={manualSessionInput}
                  onChange={(e) => setManualSessionInput(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                  6-Digit Auth PIN (e.g. K9X2P4)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. K9X2P4"
                  value={manualKeyInput}
                  onChange={(e) => setManualKeyInput(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    fontSize: '1.1rem',
                    letterSpacing: '0.15em',
                    fontWeight: 700,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
              >
                Pair to Counter
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
