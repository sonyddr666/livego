/**
 * ScreenCapture — Módulo isolado de captura de tela via getDisplayMedia().
 * Captura frames JPEG e chama onFrame(base64) a cada intervalo.
 */

const MAX_WIDTH = 1024;
const JPEG_QUALITY = 0.6;

export class ScreenCapture {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private _isActive = false;

  /** Called with base64 JPEG data (no prefix) for each captured frame */
  onFrame: ((base64: string) => void) | null = null;

  /** Called when the user stops sharing via native browser UI */
  onEnded: (() => void) | null = null;

  isActive(): boolean {
    return this._isActive;
  }

  /**
   * Start screen capture at the given FPS.
   * Opens the native screen/tab picker dialog.
   * @throws if user denies permission or browser doesn't support getDisplayMedia
   */
  async start(fps: number = 1): Promise<void> {
    if (this._isActive) {
      console.warn('[ScreenCapture] Already active, stopping previous capture first');
      this.stop();
    }

    // Request screen share
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: fps },
        audio: false,
      });
    } catch (err: any) {
      // User denied or browser doesn't support
      console.error('[ScreenCapture] getDisplayMedia failed:', err?.name, err?.message);
      throw err;
    }

    // Listen for user stopping share via native browser "Stop sharing" button
    const track = this.stream.getVideoTracks()[0];
    if (track) {
      track.addEventListener('ended', () => {
        console.log('[ScreenCapture] Track ended (user stopped sharing via browser)');
        this.stop();
        this.onEnded?.();
      });
    }

    // Create offscreen video element
    this.video = document.createElement('video');
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      this.video!.onloadedmetadata = () => {
        this.video!.play().then(resolve).catch(resolve);
      };
    });

    // Calculate dimensions (max width 1024, proportional)
    const videoWidth = this.video.videoWidth || 1920;
    const videoHeight = this.video.videoHeight || 1080;
    const scale = Math.min(1, MAX_WIDTH / videoWidth);
    const canvasWidth = Math.round(videoWidth * scale);
    const canvasHeight = Math.round(videoHeight * scale);

    // Create offscreen canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    this.ctx = this.canvas.getContext('2d');

    this._isActive = true;

    console.log(`[ScreenCapture] Started: ${canvasWidth}x${canvasHeight} @ ${fps}fps`);

    // Start capture interval
    const intervalMs = Math.max(200, Math.round(1000 / fps));
    this.interval = setInterval(() => {
      this.captureFrame();
    }, intervalMs);
  }

  private captureFrame(): void {
    if (!this._isActive || !this.video || !this.canvas || !this.ctx || !this.onFrame) {
      return;
    }

    try {
      // Draw current video frame to canvas
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

      // Convert to JPEG base64
      const dataUrl = this.canvas.toDataURL('image/jpeg', JPEG_QUALITY);

      // Remove the data:image/jpeg;base64, prefix
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        this.onFrame(base64);
      }
    } catch (err) {
      console.error('[ScreenCapture] Frame capture error:', err);
    }
  }

  /**
   * Stop screen capture, clean up all resources.
   */
  stop(): void {
    this._isActive = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }

    this.canvas = null;
    this.ctx = null;

    console.log('[ScreenCapture] Stopped');
  }
}
