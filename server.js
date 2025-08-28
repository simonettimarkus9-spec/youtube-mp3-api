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

// Funzione per pulire file temporanei
function cleanupTempFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🧹 File temporaneo eliminato: ${filePath}`);
    } catch (err) {
      console.error("Errore eliminando file:", err);
    }
  }
}

// Funzione per scaricare audio con yt-dl-exec 3.x
async function downloadAudio(url, output) {
  console.log(`🎵 Avvio download: ${url} -> ${output}`);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await youtubedl(url, {
        output,
        ffmpegLocation: ffmpegPath,
        format: "bestaudio",
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        postprocessorArgs: ["-vn", "-acodec", "libmp3lame", "-ab", "192k", "-ar", "44100"]
      });

      console.log(`✅ Download completato: ${output}`);
      return true;
    } catch (err) {
      console.error(`❌ Tentativo ${attempt} fallito:`, err.message);
      if (attempt === maxAttempts) {
        console.error("🚨 Tutti i tentativi falliti");
        return false;
      }
    }
  }
}

// POST /download
app.post("/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  const output = path.join(__dirname, "temp", `output_${Date.now()}.mp3`);
  const tempDir = path.dirname(output);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    const success = await downloadAudio(url, output);
    if (!success) throw new Error("Download fallito dopo più tentativi");

    if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
      throw new Error("File output non trovato o vuoto");
    }

    res.download(output, "track.mp3", (err) => {
      if (err) console.error("❌ Download error:", err);
      cleanupTempFile(output);
    });
  } catch (err) {
    console.error("❌ Errore:", err);
    cleanupTempFile(output);
    res.status(500).json({ error: err.message });
  }
});

// GET /mp3
app.get("/mp3", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  const output = path.join(__dirname, "temp", `output_${Date.now()}.mp3`);
  const tempDir = path.dirname(output);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    const success = await downloadAudio(url, output);
    if (!success) throw new Error("Download fallito dopo più tentativi");

    if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
      throw new Error("File output non trovato o vuoto");
    }

    res.download(output, "track.mp3", (err) => {
      if (err) console.error("❌ Download error:", err);
      cleanupTempFile(output);
    });
  } catch (err) {
    console.error("❌ Errore:", err);
    cleanupTempFile(output);
    res.status(500).json({ error: err.message });
  }
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

// Avvio server
app.listen(PORT, () => {
  console.log(`🚀 Server avviato su http://localhost:${PORT}`);
  console.log(`📂 Temp directory: ${path.join(__dirname, "temp")}`);
  console.log(`🌍 CORS enabled`);
  console.log(`🔊 FFmpeg path: ${ffmpegPath}`);
});
