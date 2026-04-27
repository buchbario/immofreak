import { useState, useRef } from 'react';
import { Plus, Trash2, X, ImageIcon, Upload } from 'lucide-react';
import { useFileDrop } from '../../hooks/useFileDrop';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface Photo {
  id: string;
  name: string;
  dataUrl: string;
}

interface Props {
  photos: Photo[];
  onAdd: (name: string, dataUrl: string) => void;
  onDelete: (id: string) => void;
}

export function PhotoGallery({ photos, onAdd, onDelete }: Props) {
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [deletePhoto, setDeletePhoto] = useState<Photo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFiles = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        onAdd(file.name, reader.result as string);
      };
      reader.onerror = () => {
        console.error(`Foto „${file.name}" konnte nicht gelesen werden`, reader.error);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const { isDragging, dragHandlers } = useFileDrop({
    onFiles: processFiles,
    accept: (file) => file.type.startsWith('image/'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="section-title">{photos.length} Fotos</p>
        <button onClick={() => fileRef.current?.click()} className="btn btn-sm btn-primary">
          <Plus size={14} /> Foto
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>

      <div
        className={`relative dropzone ${photos.length > 0 ? 'dropzone-hint p-3' : ''} ${isDragging ? 'dropzone-active' : ''}`}
        {...dragHandlers}
      >
        {photos.length > 0 && (
          <div className="dropzone-hint-banner">
            <Upload size={12} />
            <span>Weitere Bilder per Drag &amp; Drop hinzufügen</span>
          </div>
        )}

        {photos.length === 0 ? (
          <div className="rounded-[10px] p-8 text-center border border-dashed border-card-line">
            <div className="rounded-[10px] w-16 h-16 flex items-center justify-center mx-auto mb-3 bg-[#4F6BFF]/10">
              <ImageIcon size={24} className="text-[#4F6BFF]" />
            </div>
            <p className="text-sm text-muted-foreground-2">Noch keine Fotos. Klicke auf "Foto" oder ziehe Bilder hierher.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="dropzone-item relative group aspect-square rounded-[10px] overflow-hidden surface">
                <img
                  src={photo.dataUrl}
                  alt={photo.name}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setLightbox(photo)}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <button
                  onClick={(e) => { e.stopPropagation(); setDeletePhoto(photo); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-card text-[#ef4444]"
                >
                  <Trash2 size={14} />
                </button>
                <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {photo.name}
                </p>
              </div>
            ))}
          </div>
        )}

        {isDragging && (
          <div className="dropzone-overlay">
            <Upload size={32} className="text-[#4F6BFF] dropzone-icon" />
            <p className="text-sm font-medium text-foreground mt-2">Bilder hier ablegen</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="modal-backdrop" onClick={() => setLightbox(null)}>
          <div className="modal-overlay" />
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 cursor-pointer z-10" onClick={() => setLightbox(null)}>
            <X size={28} />
          </button>
          <img src={lightbox.dataUrl} alt={lightbox.name} className="relative max-w-full max-h-[90vh] object-contain rounded-[10px]" />
        </div>
      )}

      {deletePhoto && (
        <ConfirmDialog
          open={true}
          onClose={() => setDeletePhoto(null)}
          onConfirm={() => { onDelete(deletePhoto.id); setDeletePhoto(null); }}
          title="Foto löschen"
          message={`Möchtest du "${deletePhoto.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        />
      )}
    </div>
  );
}
