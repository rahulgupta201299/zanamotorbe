const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');

// Configure S3 Client
const s3Client = new S3Client({
    region: config.AWS_REGION,
    credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    }
});

/**
 * Generic utility to upload a file to S3 and return the CDN URL
 * @param {Object} file - The file object from multer (req.file)
 * @param {string} folder - Optional folder path in S3 (e.g., 'blogs')
 * @returns {Promise<string>} - The CDN URL of the uploaded image
 */
const uploadToS3 = async (file, folder = 'uploads') => {
    try {
        if (!file) {
            throw new Error('No file provided');
        }

        // Generate a unique filename
        const fileExtension = path.extname(file.originalname);
        const fileName = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
        const key = `${folder}/${fileName}`;

        const uploadParams = {
            Bucket: config.S3_BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        const cdnUrl = config.CDN_URL;
        if (!cdnUrl) {
            throw new Error('CDN_URL is not defined in environment variables');
        }

        return `${cdnUrl.replace(/\/$/, '')}/${key}`;
    } catch (error) {
        console.error('S3 Upload Error:', error);
        throw new Error('Failed to upload image to S3');
    }
};

/**
 * Generic utility to delete a file from S3 using its CDN URL
 * @param {string} fileUrl - The full CDN URL of the file
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (fileUrl) => {
    try {
        if (!fileUrl) return;

        const cdnUrl = config.CDN_URL;
        if (!cdnUrl) return;

        // Extract the key from the URL by removing the CDN base URL
        const cdnBase = cdnUrl.replace(/\/$/, '') + '/';
        if (!fileUrl.startsWith(cdnBase)) {
            // Not an S3/CDN URL or doesn't match our config, skip deletion
            return;
        }

        const key = fileUrl.replace(cdnBase, '');

        const deleteParams = {
            Bucket: config.S3_BUCKET_NAME,
            Key: key,
        };

        await s3Client.send(new DeleteObjectCommand(deleteParams));
    } catch (error) {
        console.error('S3 Delete Error:', error);
        // We generally don't want to throw an error if deletion fails, 
        // to avoid blocking the main API response
    }
};

module.exports = { uploadToS3, deleteFromS3 };
