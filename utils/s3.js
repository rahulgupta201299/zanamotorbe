const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config/config');
const path = require('path');

const s3Client = new S3Client({
    region: config.AWS_REGION,
    credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY
    }
});

/**
 * Uploads a file to S3
 * @param {Object} file - The file object from multer
 * @param {String} folder - The folder to upload to (e.g., 'blogs', 'products')
 * @returns {Promise<String>} - The CDN URL of the uploaded file
 */
exports.uploadToS3 = async (file, folder) => {
    if (!file) return null;

    // Clean up spaces from the original file name to avoid URL encoding issues
    const fileName = file.originalname.replace(/\s+/g, '-');
    const key = `${folder}/${fileName}`;

    const command = new PutObjectCommand({
        Bucket: config.S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
    });

    await s3Client.send(command);

    if (config.CDN_BASE_URL) {
        return `${config.CDN_BASE_URL}/${key}`;
    }
    return `https://${config.S3_BUCKET_NAME}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;
};

/**
 * Deletes a file from S3 using its CDN URL
 * @param {String} fileUrl - The CDN URL or S3 URL of the file
 */
exports.deleteFromS3 = async (fileUrl) => {
    if (!fileUrl) return;

    try {
        let key;
        
        if (config.CDN_BASE_URL && fileUrl.startsWith(config.CDN_BASE_URL)) {
            key = fileUrl.replace(`${config.CDN_BASE_URL}/`, '');
        } else if (fileUrl.includes('.amazonaws.com/')) {
            key = fileUrl.split('.amazonaws.com/')[1];
        } else {
            // Try to handle domain-agnostic cases (e.g. if CDN changed but path remains)
            // assuming the path format is folder/filename
            try {
                const urlObj = new URL(fileUrl);
                key = urlObj.pathname.substring(1); // remove leading slash
            } catch(e) {
                return;
            }
        }

        const command = new DeleteObjectCommand({
            Bucket: config.S3_BUCKET_NAME,
            Key: key
        });

        await s3Client.send(command);
    } catch (error) {
        console.error(`Error deleting from S3: ${error.message}`);
        // We don't want to fail the main operation if delete fails
    }
};
