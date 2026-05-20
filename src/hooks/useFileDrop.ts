import { useCallback, useRef, useState } from 'react';

interface Options {
  onFiles: (files: File[]) => void;
  accept?: (file: File) => boolean;
}

export function useFileDrop({ onFiles, accept }: Options) {
  const [isDragging, setIsDragging] = useState(false);
  const counterRef = useRef(0);
  // Nach `drop` ignorieren wir nachträgliche `dragleave`-Events der gleichen Drag-Sequenz.
  // Safari/Chrome senden für Kind-Elemente Events in unsicherer Reihenfolge — ohne diese
  // Sperre bekommt der Counter Werte < 0 und das Overlay verschwindet vorzeitig beim
  // nächsten echten Drag.
  const ignoreLeavesRef = useRef(false);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    ignoreLeavesRef.current = false;
    counterRef.current = Math.max(0, counterRef.current) + 1;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (ignoreLeavesRef.current) return;
    counterRef.current = Math.max(0, counterRef.current - 1);
    if (counterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      counterRef.current = 0;
      ignoreLeavesRef.current = true;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      const filtered = accept ? files.filter(accept) : files;
      if (filtered.length > 0) onFiles(filtered);
    },
    [onFiles, accept],
  );

  return {
    isDragging,
    dragHandlers: { onDragEnter, onDragLeave, onDragOver, onDrop },
  };
}
