const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint principale
app.post("/download", (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  const output = path.resolve(__dirname, "output.mp3");

  // Comando yt-dlp
  const cmd = `yt-dlp -x --audio-format mp3 -o "${output}" "${url}"`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error("yt-dlp error:", stderr);
      return res.status(500).json({ error: "Download failed" });
    }

    // Invia il file come download
    res.download(output, "track.mp3", (err) => {
      if (err) console.error("Download error:", err);
      fs.unlinkSync(output); // elimina file dopo invio
    });
  });
});

app.get("/", (req, res) => {
  res.send("✅ YouTube MP3 API is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
