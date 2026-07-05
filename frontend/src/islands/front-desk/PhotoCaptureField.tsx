import { useCallback, useRef, useState } from 'react';
import { Camera, RotateCcw, Check, X, Upload, Loader2 } from 'lucide-react';
import { Button } from '@components/ui/button';

interface PhotoCaptureFieldProps {
  /** Called with the captured JPEG blob; should upload and resolve with the stored URL */
  onCapture: (blob: Blob) => Promise<string>;
  /** Pre-existing photo URL to display as preview */
  currentPhotoUrl?: string;
  disabled?: boolean;
}

type CaptureState = 'idle' | 'streaming' | 'preview' | 'uploading' | 'done' | 'error';

export function PhotoCaptureField({
  onCapture,
  currentPhotoUrl,
  disabled = false,
}: PhotoCaptureFieldProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(currentPhotoUrl ?? null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    setCaptureState('streaming');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      stopStream();
      setErrorMessage(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access and try again.'
          : 'Could not access camera.',
      );
      setCaptureState('error');
    }
  }, [stopStream]);

  const snapPhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCapturedUrl(URL.createObjectURL(blob));
        stopStream();
        setCaptureState('preview');
      },
      'image/jpeg',
      0.88,
    );
  }, [stopStream]);

  const retake = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
    setCaptureState('idle');
  }, [capturedUrl]);

  const savePhoto = useCallback(async () => {
    if (!capturedBlob) return;
    setCaptureState('uploading');
    setErrorMessage(null);
    try {
      const url = await onCapture(capturedBlob);
      setSavedUrl(url);
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      setCapturedUrl(null);
      setCapturedBlob(null);
      setCaptureState('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save photo');
      setCaptureState('error');
    }
  }, [capturedBlob, capturedUrl, onCapture]);

  const dismiss = useCallback(() => {
    stopStream();
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
    setErrorMessage(null);
    setCaptureState('idle');
  }, [capturedUrl, stopStream]);

  return (
    <div className="nc-photo-capture-field">
      {/* Current / saved photo */}
      {savedUrl && captureState === 'idle' && (
        <div className="nc-photo-capture-current mb-2">
          <img
            src={savedUrl}
            alt="Patient photo"
            className="nc-photo-capture-img"
          />
        </div>
      )}

      {/* Camera stream */}
      {captureState === 'streaming' && (
        <div className="nc-photo-capture-viewport mb-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            className="nc-photo-capture-video"
            playsInline
            muted
            aria-label="Camera preview"
          />
          <div className="nc-photo-capture-actions">
            <Button size="sm" onClick={snapPhoto} disabled={disabled}>
              <Camera className="h-4 w-4" />
              Snap photo
            </Button>
            <Button size="sm" variant="outline" onClick={dismiss}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Snapshot preview */}
      {captureState === 'preview' && capturedUrl && (
        <div className="nc-photo-capture-viewport mb-2">
          <img
            src={capturedUrl}
            alt="Captured preview"
            className="nc-photo-capture-video"
          />
          <div className="nc-photo-capture-actions">
            <Button size="sm" onClick={() => void savePhoto()} disabled={disabled}>
              <Check className="h-4 w-4" />
              Use this photo
            </Button>
            <Button size="sm" variant="outline" onClick={retake}>
              <RotateCcw className="h-4 w-4" />
              Retake
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {captureState === 'uploading' && (
        <div className="nc-photo-capture-status text-sm text-(--oe-nc-text-muted) flex items-center gap-2 mb-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving photo…
        </div>
      )}

      {captureState === 'done' && savedUrl && (
        <div className="nc-photo-capture-current mb-2">
          <img src={savedUrl} alt="Patient photo" className="nc-photo-capture-img" />
          <p className="text-xs text-emerald-700 mt-1">
            <Check className="h-3 w-3 inline mr-1" />
            Photo saved
          </p>
        </div>
      )}

      {errorMessage && (
        <p className="text-xs text-red-600 mb-2">{errorMessage}</p>
      )}

      {/* Trigger buttons — idle or error */}
      {(captureState === 'idle' || captureState === 'done' || captureState === 'error') && (
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => void startCamera()}
          >
            <Camera className="h-3.5 w-3.5" />
            {savedUrl ? 'Retake photo' : 'Take photo'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            asChild
          >
            <label className="cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              Upload file
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = URL.createObjectURL(file);
                  setCapturedUrl(url);
                  setCapturedBlob(file);
                  setCaptureState('preview');
                }}
              />
            </label>
          </Button>
        </div>
      )}

      {/* Hidden canvas used for snapping */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
