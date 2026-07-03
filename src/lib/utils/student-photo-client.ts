import type { StudentPhotoUploadPayload } from '@/lib/api/students';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const ORIGINAL_MAX_EDGE = 1600;
const THUMBNAIL_MAX_EDGE = 180;

export async function prepareStudentPhotoPayload(file: File): Promise<StudentPhotoUploadPayload> {
  validateStudentPhotoFile(file);
  const image = await loadImage(file);
  const outputMimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

  return {
    original_data_url: resizeImageToDataUrl(image, {
      maxEdge: ORIGINAL_MAX_EDGE,
      mimeType: outputMimeType,
      quality: 0.86,
    }),
    thumbnail_data_url: resizeImageToDataUrl(image, {
      maxEdge: THUMBNAIL_MAX_EDGE,
      mimeType: outputMimeType,
      quality: 0.78,
    }),
  };
}

export function validateStudentPhotoFile(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('JPG, PNG, WebP 이미지 파일만 등록할 수 있습니다.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('사진 용량은 8MB 이하로 선택해주세요.');
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('사진을 불러오지 못했습니다. 다른 파일을 선택해주세요.'));
    };
    image.src = objectUrl;
  });
}

function resizeImageToDataUrl(
  image: HTMLImageElement,
  options: { maxEdge: number; mimeType: string; quality: number }
) {
  const scale = Math.min(1, options.maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('사진을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL(options.mimeType, options.quality);
}
