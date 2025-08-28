import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import youtubedl from "youtube-dl-exec";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pulizia file temporanei
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

// Funzione download audio rapido in M4A
async function downloadAudio(url, output) {
  console.log(`🎵 Avvio download: ${url} -> ${output}`);
  try {
    await youtubedl(url, {
      output,
      format: "bestaudio[ext=m4a]/bestaudio",
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      postprocessorArgs: ["-vn"], // niente video, solo audio
    });

    if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
      throw new Error("File output non trovato o vuoto");
    }

    console.log(`✅ Download completato: ${output}`);
    return true;
  } catch (err) {
    console.error("❌ Download fallito:", err.message);
    return false;
  }
}

// POST /download
app.post("/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  const output = path.join(__dirname, "temp", `output_${Date.now()}.m4a`);
  const tempDir = path.dirname(output);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    const success = await downloadAudio(url, output);
    if (!success) throw new Error("Download fallito");

    res.download(output, "track.m4a", (err) => {
      if (err) console.error("❌ Download error:", err);
      cleanupTempFile(output);
    });
  } catch (err) {
    cleanupTempFile(output);
    res.status(500).json({ error: err.message });
  }
});

// GET /mp3
app.get("/mp3", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  const output = path.join(__dirname, "temp", `output_${Date.now()}.m4a`);
  const tempDir = path.dirname(output);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    const success = await downloadAudio(url, output);
    if (!success) throw new Error("Download fallito");

    res.download(output, "track.m4a", (err) => {
      if (err) console.error("❌ Download error:", err);
      cleanupTempFile(output);
    });
  } catch (err) {
    cleanupTempFile(output);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "YouTube Audio API",
    endpoints: ["/download", "/mp3"],
    timestamp: new Date().toISOString()
  });
});

// Avvio server
app.listen(PORT, () => {
  console.log(`🚀 Server avviato su http://localhost:${PORT}`);
  console.log(`📂 Temp directory: ${path.join(__dirname, "temp")}`);
  console.log(`🌍 CORS abilitato`);
});
