const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Uploads klasörü yoksa otomatik oluştur
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Yüklenen dosyaların disk klasörüne kaydedilmesi
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Dosya adının çakışmaması için zaman damgası ekliyoruz
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use(express.static('public'));

// Tahta ekranı için dinamik QR Kod oluşturan endpoint
app.get('/api/qr', async (req, res) => {
  const host = req.headers.host;
  const uploadUrl = `http://${host}/upload.html`;
  try {
    const qrImage = await QRCode.toDataURL(uploadUrl);
    res.json({ qrImage, uploadUrl });
  } catch (err) {
    res.status(500).json({ error: 'QR Kod üretilemedi.' });
  }
});

// Mobil cihazdan gelen dosyaları karşılayan endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('Dosya seçilmedi.');
  
  const fileData = {
    url: `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    type: req.file.mimetype
  };

  // Bağlı tüm akıllı tahta ekranlarına "yeni dosya geldi" sinyali fırlat
  io.emit('new-file', fileData);
  res.json({ success: true, file: fileData });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu aktif! Port: ${PORT}`);
});