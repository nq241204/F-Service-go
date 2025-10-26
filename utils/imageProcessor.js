// utils/imageProcessor.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Kích thước ảnh cho từng loại
const imageSizes = {
    thumbnail: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 800, height: 800 }
};

/**
 * Xử lý và tối ưu ảnh upload
 * @param {string} filepath Đường dẫn file ảnh gốc
 * @returns {Promise<Object>} Object chứa các đường dẫn ảnh đã xử lý
 */
async function processImage(filepath) {
    const filename = path.basename(filepath, path.extname(filepath));
    const directory = path.dirname(filepath);
    const outputPaths = {};

    try {
        // Đọc metadata của ảnh
        const metadata = await sharp(filepath).metadata();
        
        // Xử lý ảnh theo từng kích thước
        for (const [size, dimensions] of Object.entries(imageSizes)) {
            const outputFilename = `${filename}-${size}${path.extname(filepath)}`;
            const outputPath = path.join(directory, outputFilename);
            
            await sharp(filepath)
                .resize(dimensions.width, dimensions.height, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 80 })
                .toFile(outputPath);
            
            outputPaths[size] = outputPath.replace('public', '');
        }

        // Xóa file gốc sau khi đã xử lý
        await fs.unlink(filepath);

        return outputPaths;
    } catch (error) {
        console.error('Lỗi xử lý ảnh:', error);
        throw new Error('Có lỗi xảy ra khi xử lý ảnh');
    }
}

module.exports = {
    processImage
};