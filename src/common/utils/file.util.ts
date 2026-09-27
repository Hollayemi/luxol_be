export const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB — matches UI text

export const ALLOWED_AVATAR_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
];

export function assertAvatar(file: {
  mimetype: string;
  size: number;
}): void {
  if (!ALLOWED_AVATAR_MIME.includes(file.mimetype)) {
    throw new Error("Only PNG, JPG or GIF images are allowed");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Image must be 4MB or smaller");
  }
}