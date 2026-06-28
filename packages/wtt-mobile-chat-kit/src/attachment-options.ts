export function mobileImagePickerOptions() {
  return {
    mediaTypes: ['images' as const],
    quality: 0.8,
    allowsEditing: true,
  };
}

export function mobileCameraPickerOptions() {
  return {
    mediaTypes: ['images' as const],
    quality: 0.8,
    allowsEditing: true,
  };
}

export const MOBILE_ATTACHMENT_DOCUMENT_TYPES = [
  'image/*',
  'audio/*',
  'video/*',
  'application/pdf',
  'text/*',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
] as const;
