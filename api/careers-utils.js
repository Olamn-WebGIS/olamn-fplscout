const fs = require('fs');
const path = require('path');

const CAREER_DEADLINE = new Date('2026-08-01T23:59:59.999Z');
const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024;
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
    return { valid: false, message: 'Video must be 25MB or smaller.' };
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

function getCareerStatusCopy(status) {
  const statusLabel = makeStatusLabel(status);
  switch (statusLabel) {
    case 'Approved':
      return {
        headline: 'Application Approved',
        body: 'Congratulations. We are pleased to inform you that your application has been approved for the next stage of our selection process.',
        footer: 'Please use the secure upload link below to submit your test video for the final review round.',
        subject: 'Your FPL Scout application has been approved',
      };
    case 'Declined':
      return {
        headline: 'Application Update',
        body: 'Thank you for applying to FPL Scout. After careful consideration, we have decided not to move forward with your application at this time.',
        footer: 'We appreciate the time and effort you invested and wish you every success with your future projects.',
        subject: 'Update on your FPL Scout application',
      };
    case 'Under Review':
      return {
        headline: 'Application Under Review',
        body: 'Your application is currently under review by our selection team. We are assessing your submission and will notify you as soon as a decision is reached.',
        footer: 'There is no additional action required from you at this time.',
        subject: 'Your FPL Scout application is under review',
      };
    case 'Successful':
      return {
        headline: 'Application Successful',
        body: 'Congratulations — your application has been successful. We are excited to welcome you further into the FPL Scout process.',
        footer: 'A member of our team will contact you shortly with the next steps.',
        subject: 'Congratulations — your FPL Scout application was successful',
      };
    case 'Pending':
    default:
      return {
        headline: 'Application Received',
        body: 'Thank you for submitting your application to FPL Scout. Your submission has been received and is currently pending review.',
        footer: 'You can track your application status using the link below.',
        subject: 'We received your FPL Scout application',
      };
  }
}

function buildCareerStatusEmail({ name, status, uploadLink, trackLink }) {
  const statusLabel = makeStatusLabel(status);
  const copy = getCareerStatusCopy(statusLabel);
  const displayName = String(name || 'there').trim() || 'there';
  const subject = copy.subject || `FPL Scout Careers Update – ${statusLabel}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0f172a,#111827);padding:24px 28px;border-radius:12px 12px 0 0;">
        <h2 style="margin:0;color:#00c853;font-size:24px;">FPL Scout</h2>
        <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;letter-spacing:0.4px;text-transform:uppercase;">Weekly football analysis for smart FPL managers</p>
      </div>
      <div style="padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;background:#ffffff;">
        <h3 style="margin-top:0;color:#0f172a;">${copy.headline}</h3>
        <p style="margin:0 0 12px;color:#334155;">Hi ${displayName},</p>
        <p style="margin:0 0 12px;color:#334155;">${copy.body}</p>
        <p style="margin:0 0 12px;color:#334155;">${copy.footer}</p>
        ${trackLink && statusLabel === 'Pending' ? `<p style="margin:0 0 12px;color:#334155;">Track your application status here: <a href="${trackLink}" style="color:#00c853;">${trackLink}</a></p>` : ''}
        ${uploadLink && statusLabel === 'Approved' ? `<p style="margin:0 0 12px;color:#334155;">Secure upload link: <a href="${uploadLink}" style="color:#00c853;">${uploadLink}</a></p>` : ''}
        <div style="margin-top:18px;padding-top:12px;border-top:1px solid #e2e8f0;color:#64748b;">
          <p style="margin:0 0 6px;">Kind regards,</p>
          <p style="margin:0;font-weight:600;color:#0f172a;">The FPL Scout Team</p>
        </div>
      </div>
    </div>
  `;
  return { subject, html };
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
  buildCareerStatusEmail,
  createTempFilePath,
  saveUploadToTemp,
  removeTempFile,
};
