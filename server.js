const express = require("express");
const cors = require("cors");
const youtubedl = require("youtube-dl-exec");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

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

app.get("/", (req, res) => {
  res.send("✅ YouTube MP3 API running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
