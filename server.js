import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import youtubedl from "youtube-dl-exec";
import ffmpegPath from "ffmpeg-static";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Funzione di download
async function downloadAudio(url, outputPath, format = "m4a") {
  console.log(`🎬 Avvio download: ${url} -> ${outputPath} (${format})`);

  try {
    await youtubedl(url, {
      output: outputPath,
      extractAudio: true,
      audioFormat: format,
      ffmpegLocation: ffmpegPath,
      noCheckCertificates: true,
      preferFreeFormats: true,
      addMetadata: true,
      verbose: true,
    });

    if (!fs.existsSync(outputPath)) throw new Error("File non creato");
    if (fs.statSync(outputPath).size === 0) throw new Error("File vuoto");

    return outputPath;
  } catch (err) {
    console.error("❌ Errore download:", err.message);
    return null;
  }
}

// GET /mp3?url=...&format=mp3|m4a
app.get("/mp3", async (req, res) => {
  const { url, format = "m4a" } = req.query;
  if (!url) return res.status(400).json({ error: "URL mancante" });

  const fileName = `output_${Date.now()}.${format}`;
  const outputPath = path.join(TEMP_DIR, fileName);

  const file = await downloadAudio(url, outputPath, format);
  if (!file) return res.status(500).json({ error: "Download fallito" });

  res.download(file, fileName, (err) => {
    if (err) console.error("❌ Errore invio file:", err.message);
    fs.unlink(file, () => {}); // elimina dopo l’invio
  });
});

// POST /download { "url": "...", "format": "m4a" }
app.post("/download", async (req, res) => {
  const { url, format = "m4a" } = req.body;
  if (!url) return res.status(400).json({ error: "URL mancante" });

  const fileName = `output_${Date.now()}.${format}`;
  const outputPath = path.join(TEMP_DIR, fileName);

  const file = await downloadAudio(url, outputPath, format);
  if (!file) return res.status(500).json({ error: "Download fallito" });

  res.download(file, fileName, (err) => {
    if (err) console.error("❌ Errore invio file:", err.message);
    fs.unlink(file, () => {});
  });
});

app.listen(port, () => {
  console.log(`🌍 Server attivo su http://localhost:${port}`);
});
