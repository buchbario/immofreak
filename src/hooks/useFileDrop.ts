import { useCallback, useRef, useState } from 'react';

interface Options {
  onFiles: (files: File[]) => void;
  accept?: (file: File) => boolean;
}

export function useFileDrop({ onFiles, accept }: Options) {
  const [isDragging, setIsDragging] = useState(false);
  const counterRef = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    counterRef.current++;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    counterRef.current--;
    if (counterRef.current <= 0) {
      counterRef.current = 0;
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
