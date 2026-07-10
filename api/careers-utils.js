const fs = require('fs');
const path = require('path');

const CAREER_DEADLINE = new Date('2026-08-01T23:59:59.999Z');
const MAX_VIDEO_SIZE_BYTES = 23 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/avi']);
const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi']);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isCareerSubmissionOpen(now = new Date()) {
  return new Date(now) <= CAREER_DEADLINE;
}

function validateCareerVideo(file) {
  if (!file) {
    return { valid: false, message: 'A video upload is required.' };
  }

  const originalName = String(file.originalname || file.name || '');
  const extension = path.extname(originalName).toLowerCase();
  const mimeType = String(file.mimetype || file.type || '').toLowerCase();

  if (!ALLOWED_VIDEO_TYPES.has(mimeType) && !ALLOWED_VIDEO_EXTENSIONS.has(extension)) {
    return { valid: false, message: 'Please upload a valid video file (MP4, MOV, MKV, WebM, or AVI).' };
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return { valid: false, message: 'Video must be 23MB or smaller.' };
  }

  return { valid: true };
}

function makeStatusLabel(status) {
  switch (String(status || '').toLowerCase()) {
    case 'under review':
    case 'review':
      return 'Under Review';
    case 'declined':
      return 'Declined';
    case 'approved':
      return 'Approved';
    case 'successful':
      return 'Successful';
    case 'pending':
    default:
      return 'Pending';
  }
}

function createTempFilePath(originalName) {
  const safeName = String(originalName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
  const stamp = Date.now();
  return path.join(process.cwd(), 'tmp', `${stamp}-${safeName}`);
}

async function saveUploadToTemp(file) {
  const tempPath = createTempFilePath(file.originalname || file.name || 'upload');
  await fs.promises.mkdir(path.dirname(tempPath), { recursive: true });
  await fs.promises.writeFile(tempPath, file.buffer || file.data || '');
  return tempPath;
}

async function removeTempFile(tempPath) {
  if (!tempPath) return;
  try {
    await fs.promises.unlink(tempPath);
  } catch (error) {
    // Ignore cleanup errors.
  }
}

module.exports = {
  CAREER_DEADLINE,
  MAX_VIDEO_SIZE_BYTES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_VIDEO_EXTENSIONS,
  normalizeEmail,
  isCareerSubmissionOpen,
  validateCareerVideo,
  makeStatusLabel,
  createTempFilePath,
  saveUploadToTemp,
  removeTempFile,
};
