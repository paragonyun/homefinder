import { describe, expect, it } from "vitest";
import {
  FIELD_NOTE_PHOTO_BUCKET,
  buildFieldNotePhotoStoragePath,
  validateFieldNotePhotoFiles,
} from "./field-note-photos";

const baseImage = {
  name: "Visit Photo.JPG",
  type: "image/jpeg",
  size: 1024,
};

describe("field note photo helpers", () => {
  it("uses a private field note photo bucket", () => {
    expect(FIELD_NOTE_PHOTO_BUCKET).toBe("field-note-photos");
  });

  it("builds deterministic user and note scoped storage paths", () => {
    expect(
      buildFieldNotePhotoStoragePath({
        userId: "user-1",
        fieldNoteId: "note-1",
        fileName: "Visit Photo.JPG",
        mimeType: "image/jpeg",
        index: 2,
        uploadedAt: new Date("2026-06-21T10:20:30.000Z"),
      }),
    ).toBe("user-1/note-1/20260621T102030000Z-02-visit-photo.jpg");
  });

  it("accepts up to six supported image files", () => {
    const result = validateFieldNotePhotoFiles(
      Array.from({ length: 6 }, (_, index) => ({
        ...baseImage,
        name: `photo-${index}.webp`,
        type: "image/webp",
      })),
    );

    expect(result).toEqual({ ok: true, value: expect.any(Array) });
  });

  it("rejects unsupported files and excessive uploads", () => {
    expect(
      validateFieldNotePhotoFiles([
        { name: "memo.pdf", type: "application/pdf", size: 1024 },
      ]),
    ).toEqual({
      ok: false,
      error: "사진은 JPG, PNG, WEBP, HEIC 형식만 업로드할 수 있습니다.",
    });

    expect(
      validateFieldNotePhotoFiles(
        Array.from({ length: 7 }, (_, index) => ({
          ...baseImage,
          name: `photo-${index}.jpg`,
        })),
      ),
    ).toEqual({
      ok: false,
      error: "임장 사진은 한 번에 최대 6장까지 업로드할 수 있습니다.",
    });
  });
});
