const cloudinary = require('cloudinary').v2;

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Uploads an in-memory buffer (from Multer) to Cloudinary.
 */
async function uploadImageBuffer(buffer, folder = 'lost-and-found/uploads') {
  if (!buffer) {
    throw new Error('No image buffer provided for upload.');
  }

  configureCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) {
          console.error('Cloudinary stream callback error:', error);
          return reject(error);
        }
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary did not return a secure URL.'));
        }
        resolve(result.secure_url);
      }
    );

    uploadStream.on('error', (err) => {
      console.error('Upload stream runtime error:', err);
      reject(err);
    });

    uploadStream.end(buffer);
  });
}

/**
 * Uploads a base64-encoded image string to Cloudinary.
 */
async function uploadBase64Image(base64Data, folder = 'lost-and-found/ai-generated') {
  if (!base64Data) {
    throw new Error('No base64 data provided for upload.');
  }

  configureCloudinary();

  const result = await cloudinary.uploader.upload(
    `data:image/png;base64,${base64Data}`,
    { folder, resource_type: 'image' }
  );

  return result.secure_url;
}

module.exports = { uploadImageBuffer, uploadBase64Image };