// Product photo helpers: shrink before upload (saves data on weak connections) and report upload progress.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export interface PreparedImage {
  uri: string;
  contentType: string;
  sizeBytes: number;
}

async function sizeOf(uri: string): Promise<number> {
  try {
    const blob = await (await fetch(uri)).blob();
    return blob.size || 0;
  } catch {
    return 0;
  }
}

/** Resizes to at most `maxWidth` px wide and re-encodes as JPEG. Falls back to the original file if anything fails. */
export async function prepareImage(
  asset: { uri: string; width?: number; mimeType?: string | null; fileSize?: number | null },
  maxWidth = 1280,
  quality = 0.7
): Promise<PreparedImage> {
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (asset.width && asset.width > maxWidth) ctx.resize({ width: maxWidth }); // never upscale
    const rendered = await ctx.renderAsync();
    const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    return { uri: out.uri, contentType: "image/jpeg", sizeBytes: await sizeOf(out.uri) };
  } catch (e) {
    console.warn("[images] compression failed, uploading the original", e);
    return { uri: asset.uri, contentType: asset.mimeType || "image/jpeg", sizeBytes: asset.fileSize ?? 0 };
  }
}

/** POSTs a FormData body and reports 0–100 progress (fetch can't do this). */
export function uploadFormWithProgress(url: string, form: FormData, onProgress?: (pct: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.onload = () => {
      let json: any = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* not json */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(json);
      else reject(new Error(json?.error?.message || "Photo upload failed."));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading the photo."));
    xhr.ontimeout = () => reject(new Error("The photo upload timed out."));
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e: any) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.send(form);
  });
}