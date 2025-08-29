import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import youtubedl from "youtube-dl-exec";
import ffmpegPath from "ffmpeg-static";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// CORS
app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

// Directory temporanea
const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Funzione per pulire file temporanei
function cleanupTempFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, () => {});
    console.log(`🧹 File temporaneo rimosso: ${filePath}`);
  }
}

// Funzione di download ottimizzata
async function downloadAudio(url, outputPath) {
  console.log(`🎬 Avvio download: ${url} -> ${outputPath}`);

  try {
    await youtubedl(url, {
      output: outputPath,
      ffmpegLocation: ffmpegPath,
      format: "bestaudio",
      postprocessorArgs: ["-vn", "-acodec", "copy"], // copia audio senza riconversione
      noCheckCertificates: true,
      preferFreeFormats: true,
      addMetadata: true,
      verbose: true
    });

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error("File non creato o vuoto");
    }

    console.log(`✅ Download completato: ${outputPath}`);
    return outputPath;
  } catch (err) {
    console.error("❌ Errore download:", err.message);
    return null;
  }
}

// GET /mp3?url=...&format=m4a
app.get("/mp3", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL mancante" });

  const fileName = `output_${Date.now()}.m4a`;
  const outputPath = path.join(TEMP_DIR, fileName);

  const file = await downloadAudio(url, outputPath);
  if (!file) return res.status(500).json({ error: "Download fallito" });

  res.download(file, fileName, (err) => {
    if (err) console.error("❌ Errore invio file:", err.message);
    cleanupTempFile(file);
  });
});

// POST /download { "url": "..." }
app.post("/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL mancante" });

  const fileName = `output_${Date.now()}.m4a`;
  const outputPath = path.join(TEMP_DIR, fileName);

  const file = await downloadAudio(url, outputPath);
  if (!file) return res.status(500).json({ error: "Download fallito" });

  res.download(file, fileName, (err) => {
    if (err) console.error("❌ Errore invio file:", err.message);
    cleanupTempFile(file);
  });
});

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "YouTube MP3 API",
    endpoints: ["/download", "/mp3"],
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`🌍 Server attivo su http://localhost:${port}`);
  console.log(`📂 Temp directory: ${TEMP_DIR}`);
  console.log(`🌍 CORS abilitato`);
  console.log(`🔊 FFmpeg path: ${ffmpegPath}`);
});
