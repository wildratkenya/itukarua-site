import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { certificateObjectUrl } from '@/lib/supabase';

interface CertificateViewerProps {
  url: string | null;
  label?: string;
  onClose: () => void;
}

const CertificateViewer: React.FC<CertificateViewerProps> = ({ url, onClose, label }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [url, onClose]);

  if (!url) return null;

  const src = certificateObjectUrl(url);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-4xl h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">{label || 'Certificate'}</h3>
          <div className="flex items-center gap-2">
            <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:text-green-700 font-medium">
              Open in new tab
            </a>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 relative bg-gray-100">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            </div>
          )}
          <iframe
            title={label || 'Certificate'}
            src={src}
            className="w-full h-full"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </div>
  );
};

export default CertificateViewer;