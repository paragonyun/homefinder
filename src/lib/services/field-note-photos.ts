export const FIELD_NOTE_PHOTO_BUCKET = "field-note-photos";
export const FIELD_NOTE_PHOTO_MAX_FILES = 6;
export const FIELD_NOTE_PHOTO_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const supportedMimeTypeToExtension = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

export type FieldNotePhotoFileInput = {
  name: string;
  size: number;
  type: string;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateFieldNotePhotoFiles<T extends FieldNotePhotoFileInput>(
  files: readonly T[],
): ValidationResult<T[]> {
  if (files.length > FIELD_NOTE_PHOTO_MAX_FILES) {
    return {
      ok: false,
      error: "임장 사진은 한 번에 최대 6장까지 업로드할 수 있습니다.",
    };
  }

  const unsupportedFile = files.find(
    (file) => !supportedMimeTypeToExtension.has(file.type),
  );

  if (unsupportedFile) {
    return {
      ok: false,
      error: "사진은 JPG, PNG, WEBP, HEIC 형식만 업로드할 수 있습니다.",
    };
  }

  const oversizedFile = files.find(
    (file) => file.size > FIELD_NOTE_PHOTO_MAX_FILE_SIZE_BYTES,
  );

  if (oversizedFile) {
    return {
      ok: false,
      error: "사진 한 장은 최대 8MB까지 업로드할 수 있습니다.",
    };
  }

  return { ok: true, value: [...files] };
}

export function buildFieldNotePhotoStoragePath({
  fieldNoteId,
  fileName,
  index,
  mimeType,
  uploadedAt,
  userId,
}: Readonly<{
  fieldNoteId: string;
  fileName: string;
  index: number;
  mimeType: string;
  uploadedAt: Date;
  userId: string;
}>) {
  const timestamp = uploadedAt.toISOString().replace(/[-:.]/g, "");
  const safeName = getSafeBaseFileName(fileName);
  const extension = getPhotoExtension(mimeType, fileName);
  const safeIndex = String(index).padStart(2, "0");

  return [
    cleanPathSegment(userId),
    cleanPathSegment(fieldNoteId),
    `${timestamp}-${safeIndex}-${safeName}.${extension}`,
  ].join("/");
}

function getPhotoExtension(mimeType: string, fileName: string) {
  const mimeExtension = supportedMimeTypeToExtension.get(mimeType);

  if (mimeExtension) {
    return mimeExtension;
  }

  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension || "jpg";
}

function getSafeBaseFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const normalized = withoutExtension
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "photo";
}

function cleanPathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
