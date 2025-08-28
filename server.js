const express = require("express");
const cors = require("cors");
const youtubedl = require("youtube-dl-exec");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

const app = express();

// CORS completo
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Funzione per pulire i file temporanei
function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🧹 File temporaneo rimosso: ${filePath}`);
    }
  } catch (error) {
    console.warn(`⚠️ Errore rimozione file: ${error.message}`);
  }
}

// Endpoint POST per download
app.post("/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  // ✅ Percorso corretto per Render
  const output = path.join(__dirname, "temp", `output_${Date.now()}.mp3`);
  
  // ✅ Crea directory temp se non esiste
  const tempDir = path.dirname(output);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  console.log(`📥 Download request: ${url}`);
  console.log(`📁 Output path: ${output}`);

  try {
    // ✅ Download con youtube-dl
    await youtubedl(url, {
      extractAudio: true,
      audioFormat: "mp3",
      output: output,
      ffmpegLocation: ffmpegPath,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true
    });

    // ✅ Verifica che il file sia stato creato
    if (!fs.existsSync(output)) {
      throw new Error("File output non creato");
    }

    const stats = fs.statSync(output);
    if (stats.size === 0) {
      throw new Error("File output vuoto");
    }

    console.log(`✅ File creato: ${output} (${stats.size} bytes)`);

    // ✅ Download del file
    res.download(output, "track.mp3", (err) => {
      if (err) {
        console.error("❌ Download error:", err);
      }
      // ✅ Pulisci il file temporaneo
      cleanupTempFile(output);
    });

  } catch (err) {
    console.error("❌ Download failed:", err);
    
    // ✅ Pulisci il file temporaneo in caso di errore
    cleanupTempFile(output);
    
    res.status(500).json({ 
      error: "Download failed", 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ Endpoint GET per compatibilità
app.get("/mp3", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL parameter" });

  // ✅ Percorso corretto per Render
  const output = path.join(__dirname, "temp", `output_${Date.now()}.mp3`);
  
  // ✅ Crea directory temp se non esiste
  const tempDir = path.dirname(output);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  console.log(`�� GET request: ${url}`);
  console.log(`📁 Output path: ${output}`);

  try {
    // ✅ Download con youtube-dl
    await youtubedl(url, {
      extractAudio: true,
      audioFormat: "mp3",
      output: output,
      ffmpegLocation: ffmpegPath,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true
    });

    // ✅ Verifica che il file sia stato creato
    if (!fs.existsSync(output)) {
      throw new Error("File output non creato");
    }

    const stats = fs.statSync(output);
    if (stats.size === 0) {
      throw new Error("File output vuoto");
    }

    console.log(`✅ File creato: ${output} (${stats.size} bytes)`);

    // ✅ Download del file
    res.download(output, "track.mp3", (err) => {
      if (err) {
        console.error("❌ Download error:", err);
      }
      // ✅ Pulisci il file temporaneo
      cleanupTempFile(output);
    });

  } catch (err) {
    console.error("❌ Download failed:", err);
    
    // ✅ Pulisci il file temporaneo in caso di errore
    cleanupTempFile(output);
    
    res.status(500).json({ 
      error: "Download failed", 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint per info video
app.post("/info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true
    });

    res.json({
      success: true,
      title: info.title,
      duration: info.duration,
      thumbnail: info.thumbnail,
      uploader: info.uploader
    });
  } catch (err) {
    console.error("❌ Info failed:", err);
    res.status(500).json({ error: "Failed to get video info" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "YouTube MP3 API",
    endpoints: ["/download", "/mp3", "/info"],
    timestamp: new Date().toISOString()
  });
});

// CORS preflight
app.options('*', cors());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`�� Temp directory: ${path.join(__dirname, "temp")}`);
  console.log(`🌍 CORS enabled for all origins`);
});