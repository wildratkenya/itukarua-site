export function compressImage(file: File, maxWidth = 800, maxSizeKB = 200, timeoutMs = 15000): Promise<File> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (f: File) => { if (!done) { done = true; resolve(f); } };
    const timer = setTimeout(() => finish(file), timeoutMs);

    if (!file.type.startsWith('image/')) {
      clearTimeout(timer);
      finish(file);
      return;
    }
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { finish(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      let quality = 0.75;
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) { finish(file); return; }
          if (blob.size <= maxSizeKB * 1024 || quality <= 0.3) {
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
            finish(compressed);
          } else {
            quality -= 0.05;
            tryCompress();
          }
        }, 'image/jpeg', quality);
      };
      tryCompress();
    };
    img.onerror = () => { clearTimeout(timer); finish(file); };
    img.src = URL.createObjectURL(file);
  });
}
