const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');

const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

// Magic-byte signatures so a renamed script can't pose as an image.
const SIGNATURES = [
  (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, // jpeg
  (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), // png
  (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP', // webp
  (b) => b.slice(0, 3).toString() === 'GIF', // gif
  (b) => b.slice(4, 8).toString() === 'ftyp', // avif
];

function createUploader() {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  const storage = multer.diskStorage({
    destination: config.UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
  });
  return multer({
    storage,
    limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 13 },
    fileFilter: (req, file, cb) => {
      if (ALLOWED[file.mimetype]) return cb(null, true);
      const err = new Error(`"${file.originalname}" is not a supported image (use JPG, PNG, WEBP, GIF or AVIF).`);
      err.status = 400;
      cb(err);
    },
  });
}

/** Verify each stored file really is an image; delete and reject otherwise. */
function verifyImages(files) {
  for (const f of files) {
    const fd = fs.openSync(f.path, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    if (!SIGNATURES.some((check) => check(buf))) {
      files.forEach((x) => removeFile(x.path));
      const err = new Error(`"${f.originalname}" does not look like a valid image file.`);
      err.status = 400;
      throw err;
    }
  }
}

const publicPath = (file) => `/uploads/${file.filename}`;

/** Delete an uploaded file given its public path. Seed/static images are never touched. */
function removeUpload(publicUrl) {
  if (!publicUrl || !publicUrl.startsWith('/uploads/')) return;
  removeFile(path.join(config.UPLOAD_DIR, path.basename(publicUrl)));
}

function removeFile(p) {
  fs.rm(p, { force: true }, () => {});
}

module.exports = { createUploader, verifyImages, publicPath, removeUpload };
