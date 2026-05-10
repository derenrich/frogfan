import React, { useEffect, useRef, useState } from 'react';
import styles from './LabelCanvas.module.css';

interface Point {
  x: number;
  y: number;
}

interface ZoomPanState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface LabelCanvasProps {
  imageUrl: string;
  points: { [labelName: string]: Point };
  currentLabel: string | null;
  onPointPlaced: (label: string, point: Point) => void;
  zoomPanState: ZoomPanState;
  onZoomPanChange: (state: ZoomPanState) => void;
  labelColors?: { [labelName: string]: string };
}

export default function LabelCanvas({
  imageUrl,
  points,
  currentLabel,
  onPointPlaced,
  zoomPanState,
  onZoomPanChange,
  labelColors = {}
}: LabelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Drag state
  const isDragging = useRef(false);
  const downStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  // Load image
  useEffect(() => {
    let active = true;
    const abortController = new AbortController();

    fetch(imageUrl, { signal: abortController.signal })
      .then(res => res.blob())
      .then(blob => {
        if (!active) return;
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;
        img.onload = () => {
          if (active) setImage(img);
          URL.revokeObjectURL(objectUrl);
        };
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load image:', err);
        }
      });

    return () => {
      active = false;
      abortController.abort();
    };
  }, [imageUrl]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image) return;

    // Handle responsive sizing
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate base scale to fit image into canvas nicely if zoom scale is 1
    const fitScale = Math.min(canvas.width / image.width, canvas.height / image.height);
    const finalScale = fitScale * zoomPanState.scale;
    
    // Draw Image
    ctx.save();
    ctx.translate(zoomPanState.offsetX + canvas.width / 2, zoomPanState.offsetY + canvas.height / 2);
    ctx.scale(finalScale, finalScale);
    // Center the image origin
    ctx.translate(-image.width / 2, -image.height / 2);
    ctx.drawImage(image, 0, 0);

    // Draw Points
    Object.entries(points).forEach(([label, pt]) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4 / finalScale, 0, 2 * Math.PI);
      ctx.fillStyle = labelColors[label] || '#ff0000';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / finalScale;
      ctx.stroke();

      // Draw label text
      ctx.fillStyle = '#ffffff';
      ctx.font = `${14 / finalScale}px Arial`;
      ctx.fillText(label, pt.x + 8 / finalScale, pt.y + 4 / finalScale);
    });

    ctx.restore();
  }, [image, points, zoomPanState, labelColors]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    downStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { x: zoomPanState.offsetX, y: zoomPanState.offsetY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    
    const dx = e.clientX - downStart.current.x;
    const dy = e.clientY - downStart.current.y;
    
    onZoomPanChange({
      ...zoomPanState,
      offsetX: panStart.current.x + dx,
      offsetY: panStart.current.y + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);

    const dist = Math.hypot(e.clientX - downStart.current.x, e.clientY - downStart.current.y);

    if (dist < 5 && currentLabel && image && canvasRef.current) {
      // It was a click, translate click to image coordinates
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const fitScale = Math.min(canvas.width / image.width, canvas.height / image.height);
      const finalScale = fitScale * zoomPanState.scale;

      // Reverse the transformations to find the image coordinates
      // translate(offsetX + width/2, offsetY + height/2)
      // scale(finalScale)
      // translate(-width/2, -height/2)
      
      let imgX = clickX - (zoomPanState.offsetX + canvas.width / 2);
      imgX = imgX / finalScale;
      imgX = imgX + image.width / 2;

      let imgY = clickY - (zoomPanState.offsetY + canvas.height / 2);
      imgY = imgY / finalScale;
      imgY = imgY + image.height / 2;

      if (imgX >= 0 && imgX <= image.width && imgY >= 0 && imgY <= image.height) {
        onPointPlaced(currentLabel, { x: imgX, y: imgY });
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newScale = zoomPanState.scale;
    if (e.deltaY < 0) newScale *= zoomFactor;
    else newScale /= zoomFactor;
    
    // Limits
    newScale = Math.max(0.1, Math.min(newScale, 50));
    
    if (newScale === zoomPanState.scale) return;
    
    // Zoom towards cursor
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      
      const dx = clickX - cx;
      const dy = clickY - cy;
      
      const scaleRatio = newScale / zoomPanState.scale;
      
      const newOffsetX = dx - (dx - zoomPanState.offsetX) * scaleRatio;
      const newOffsetY = dy - (dy - zoomPanState.offsetY) * scaleRatio;
      
      onZoomPanChange({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
    } else {
      onZoomPanChange({ ...zoomPanState, scale: newScale });
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {!image && <div className={styles.loading}>Loading Frame...</div>}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
