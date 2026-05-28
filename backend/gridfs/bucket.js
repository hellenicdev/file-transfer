const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = mongoose.mongo;

let bucket = null;

function getBucket() {
  if (!bucket) {
    const db = mongoose.connection.db;
    bucket = new GridFSBucket(db, { bucketName: 'files' });
  }
  return bucket;
}

async function uploadToGridFS(buffer, filename, mimetype) {
  return new Promise((resolve, reject) => {
    const uploadStream = getBucket().openUploadStream(filename, {
      contentType: mimetype,
    });
    uploadStream.end(buffer);
    uploadStream.on('finish', (file) => resolve(file._id));
    uploadStream.on('error', reject);
  });
}

function downloadFromGridFS(fileId) {
  return getBucket().openDownloadStream(new ObjectId(fileId));
}

async function deleteFromGridFS(fileId) {
  await getBucket().delete(new ObjectId(fileId));
}

module.exports = { getBucket, uploadToGridFS, downloadFromGridFS, deleteFromGridFS };
