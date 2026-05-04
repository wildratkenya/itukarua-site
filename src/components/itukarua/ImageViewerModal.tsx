import React from 'react';
import { X } from 'lucide-react';

interface ImageViewerModalProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ images, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrentIndex(i => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setCurrentIndex(i => (i + 1) % images.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white p-2">
        <X className="w-8 h-8" />
      </button>
      
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i - 1 + images.length) % images.length); }} className="absolute left-4 text-white/80 hover:text-white p-2">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i + 1) % images.length); }} className="absolute right-4 text-white/80 hover:text-white p-2">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}
      
      <img 
        src={images[currentIndex]} 
        alt="" 
        className="max-w-[90vw] max-h-[90vh] object-contain"
        onClick={e => e.stopPropagation()}
        draggable={false}
      />
      
      {images.length > 1 && (
        <div className="absolute bottom-4 flex gap-2">
          {images.map((_, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }} className={`w-3 h-3 rounded-full ${i === currentIndex ? 'bg-white' : 'bg-white/40'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageViewerModal;