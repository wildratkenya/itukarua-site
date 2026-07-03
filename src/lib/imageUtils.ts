export function compressImage(file: File, maxWidth = 800, maxSizeKB = 200, aspectRatio?: { w: number; h: number }): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let sw = img.width;
      let sh = img.height;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      if (aspectRatio) {
        const targetRatio = aspectRatio.w / aspectRatio.h;
        const sourceRatio = sw / sh;
        let sx = 0, sy = 0, cw = sw, ch = sh;
        if (sourceRatio > targetRatio) {
          cw = Math.round(sh * targetRatio);
          sx = Math.round((sw - cw) / 2);
        } else {
          ch = Math.round(sw / targetRatio);
          sy = Math.round((sh - ch) / 2);
        }
        let dw = maxWidth;
        let dh = Math.round(dw / targetRatio);
        canvas.width = dw;
        canvas.height = dh;
        ctx.drawImage(img, sx, sy, cw, ch, 0, 0, dw, dh);
      } else {
        let w = sw;
        let h = sh;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
      }

      let quality = 0.75;
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= maxSizeKB * 1024 || quality <= 0.3) {
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
            resolve(compressed);
          } else {
            quality -= 0.05;
            tryCompress();
          }
        }, 'image/jpeg', quality);
      };
      tryCompress();
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
