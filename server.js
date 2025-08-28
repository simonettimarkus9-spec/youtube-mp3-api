import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import youtubedl from "youtube-dl-exec";
import ffmpegPath from "ffmpeg-static";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 Pulizia file temporanei
function cleanupTempFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🧹 File eliminato: ${filePath}`);
    } catch (err) {
      console.error("Errore eliminando file:", err);
    }
  }
}

// 🔹 Funzione download con retry
async function downloadAudio(url, output) {
  console.log(`🎵 Download: ${url} -> ${output}`);
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await youtubedl(url, {
        output,
        extractAudio: true,
        audioFormat: "mp3",
        audioQuality: 0,
        ffmpegLocation: ffmpegPath,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
      });
      return true;
    } catch (err) {
      console.error(`❌ Tentativo ${attempt} fallito:`, err.message);
      if (attempt === maxAttempts) return false;
    }
  }
}

// 🔹 POST /mp3
app.post("/mp3", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  const output = path.join(__dirname, "temp", `output_${Date.now()}.mp3`);
  fs.mkdirSync(path.dirname(output), { recursive: true });

  try {
    const ok = await downloadAudio(url, output);
    if (!ok || !fs.existsSync(output)) throw new Error("Download fallito");
    const stats = fs.statSync(output);
    if (stats.size === 0) throw new Error("File vuoto");

    res.download(output, "track.mp3", (err) => {
      if (err) console.error("Errore invio:", err);
      cleanupTempFile(output);
    });
  } catch (err) {
    cleanupTempFile(output);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 GET /mp3
app.get("/mp3", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  const output = path.join(__dirname, "temp", `output_${Date.now()}.mp3`);
  fs.mkdirSync(path.dirname(output), { recursive: true });

  try {
    const ok = await downloadAudio(url, output);
    if (!ok || !fs.existsSync(output)) throw new Error("Download fallito");
    const stats = fs.statSync(output);
    if (stats.size === 0) throw new Error("File vuoto");

    res.download(output, "track.mp3", (err) => {
      if (err) console.error("Errore invio:", err);
      cleanupTempFile(output);
    });
  } catch (err) {
    cleanupTempFile(output);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Healthcheck
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "YouTube MP3 API",
    endpoints: ["/mp3 (GET)", "/mp3 (POST)"],
    timestamp: new Date().toISOString(),
  });
});

// Avvio
app.listen(PORT, () => {
  console.log(`🚀 Server su http://localhost:${PORT}`);
});
