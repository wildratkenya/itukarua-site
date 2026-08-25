import React from 'react';
import { X, Monitor, Smartphone, Image, AlertTriangle } from 'lucide-react';

interface AdSpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot?: 'homepage_banner' | 'job_listings_top' | 'profile';
}

const SPECS = {
  homepage_banner: {
    title: 'Homepage Carousel Banner',
    recommended: '1200 × 400 px',
    ratio: '3:1 (wide landscape)',
    minHeight: '600 × 200 px',
    notes: 'Displays in a 5-card grid on desktop, 1 card on mobile. Image is cropped to fill.',
    preview: 'Renders at ~230×280 px per card on desktop, full-width on mobile.',
  },
  job_listings_top: {
    title: 'Job Listings Top Banner',
    recommended: '1200 × 200 px',
    ratio: '6:1 (ultra-wide strip)',
    minHeight: '600 × 100 px',
    notes: 'Fixed 120 px height, full container width.',
    preview: 'Renders at full width × 120 px height.',
  },
  profile: {
    title: 'Profile Photo',
    recommended: '400 × 400 px',
    ratio: '1:1 (square)',
    minHeight: '200 × 200 px',
    notes: 'Displayed as a circle. Upload a square image for best results.',
    preview: 'Renders as 80×80 px circle in cards, 120×120 px on profile.',
  },
};

const AdSpecsModal: React.FC<AdSpecsModalProps> = ({ isOpen, onClose, slot = 'homepage_banner' }) => {
  if (!isOpen) return null;
  const spec = SPECS[slot];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{spec.title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">Upload requirements & recommendations</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                <Monitor className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="font-semibold text-green-900">Recommended: {spec.recommended}</p>
                <p className="text-sm text-green-700 mt-0.5">Aspect ratio: {spec.ratio}</p>
                <p className="text-sm text-green-600 mt-0.5">Minimum: {spec.minHeight}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <p className="font-semibold text-blue-900">How it displays</p>
                <p className="text-sm text-blue-700 mt-0.5">{spec.preview}</p>
                <p className="text-sm text-blue-600 mt-0.5">{spec.notes}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                <Image className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">File Requirements</p>
                <ul className="text-sm text-gray-700 mt-1 space-y-1">
                  <li><span className="font-medium">Formats:</span> PNG, JPG / JPEG</li>
                  <li><span className="font-medium">Max file size:</span> 5 MB per image</li>
                  <li><span className="font-medium">Max images:</span> 3 (10-day), 5 (20-day), 8 (30-day)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <p className="font-semibold text-amber-900">Automatic checks on upload</p>
                <ul className="text-sm text-amber-700 mt-1 space-y-1">
                  <li>Images below minimum dimensions will be rejected</li>
                  <li>Files over 5 MB will be rejected</li>
                  <li>Non-image files (PDF, etc.) will be rejected</li>
                  <li>All images are auto-compressed on save (target: 200 KB)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500 space-y-1">
            <p className="font-medium text-gray-700">Tips for best results:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Use bold text and high contrast for readability at small sizes</li>
              <li>Keep important content centered - edges may be cropped</li>
              <li>Avoid tiny text - it won't be legible on mobile</li>
              <li>Export as JPG for smaller file sizes (PNG for transparency)</li>
            </ul>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100">
          <button onClick={onClose} className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdSpecsModal;

export function validateAdImage(
  file: File,
  slot: 'homepage_banner' | 'job_listings_top' | 'profile'
): Promise<string | null> {
  const limits = {
    homepage_banner: { minW: 600, minH: 200, maxMB: 5 },
    job_listings_top: { minW: 600, minH: 100, maxMB: 5 },
    profile: { minW: 200, minH: 200, maxMB: 5 },
  };
  const l = limits[slot];

  if (!file.type.startsWith('image/')) {
    return Promise.resolve('Only image files (PNG, JPG) are accepted.');
  }
  if (file.size > l.maxMB * 1024 * 1024) {
    return Promise.resolve(file.name + ' exceeds ' + l.maxMB + ' MB limit (' + (file.size / 1024 / 1024).toFixed(1) + ' MB).');
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      if (img.width < l.minW || img.height < l.minH) {
        resolve(file.name + ' is too small (' + img.width + '×' + img.height + '). Minimum: ' + l.minW + '×' + l.minH + ' px.');
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve('Could not read image dimensions. Try a different file.');
    };
    img.src = URL.createObjectURL(file);
  });
}
