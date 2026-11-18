const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 500 * 1024;
const MAX_EDGE = 1440;
const MAX_INPUT_PIXELS = 24_000_000;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error("No pudimos optimizar la imagen. Probá con otra foto."));
  }, "image/webp", quality));
}

export async function optimizeServiceImage(file: File): Promise<Blob> {
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error("Usá una imagen JPG, PNG o WebP.");
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("La imagen original no puede superar 12 MB.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("No pudimos abrir la imagen. Probá con una foto JPG, PNG o WebP.");
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_INPUT_PIXELS) {
      throw new Error("La imagen tiene demasiada resolución. Elegí una foto de hasta 24 megapíxeles.");
    }
    const scale = Math.min(1, MAX_EDGE / bitmap.width, MAX_EDGE / bitmap.height);
    for (const reduction of [1, 0.86, 0.72]) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale * reduction));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale * reduction));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Este navegador no pudo preparar la imagen.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.72, 0.62]) {
        const optimized = await canvasBlob(canvas, quality);
        if (optimized.type === "image/webp" && optimized.size <= MAX_OUTPUT_BYTES) return optimized;
      }
    }
    throw new Error("No pudimos reducir la imagen a 500 KB. Elegí una foto más liviana.");
  } finally {
    bitmap.close();
  }
}
