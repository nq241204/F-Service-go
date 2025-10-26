const QRCode = require('qrcode');

exports.generate = async (text) => {
  return await QRCode.toDataURL(text);
};