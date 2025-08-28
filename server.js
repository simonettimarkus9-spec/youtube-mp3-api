const express = require("express");
const cors = require("cors");
const youtubedl = require("youtube-dl-exec");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

const app = express();

// ✅ CORS completo per tutte le origini
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// ✅ Endpoint esistente (POST)
app.post("/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  const output = path.resolve(__dirname, "output.mp3");

  try {
    await youtubedl(url, {
      extractAudio: true,
      audioFormat: "mp3",
      output: output,
      ffmpegLocation: ffmpegPath
    });

    res.download(output, "track.mp3", (err) => {
      if (err) console.error("Download error:", err);
      fs.unlinkSync(output);
    });
  } catch (err) {
    console.error("Download failed:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

// ✅ NUOVO: Endpoint GET per compatibilità
app.get("/mp3", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL parameter" });

  const output = path.resolve(__dirname, "output.mp3");

  try {
    await youtubedl(url, {
      extractAudio: true,
      audioFormat: "mp3",
      output: output,
      ffmpegLocation: ffmpegPath
    });

    res.download(output, "track.mp3", (err) => {
      if (err) console.error("Download error:", err);
      fs.unlinkSync(output);
    });
  } catch (err) {
    console.error("Download failed:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

// ✅ Endpoint per info video (opzionale)
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
    console.error("Info failed:", err);
    res.status(500).json({ error: "Failed to get video info" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("✅ YouTube MP3 API running!");
});

// ✅ CORS preflight
app.options('*', cors());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));