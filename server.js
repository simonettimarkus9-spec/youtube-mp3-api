import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import youtubedl from "youtube-dl-exec";
import ffmpegPath from "ffmpeg-static";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 10000;

// CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

// Directory temporanea
const TEMP_DIR = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 🔑 Gestione cookies YouTube
const COOKIES_PATH = "/tmp/cookies.txt";
if (process.env.YT_COOKIES) {
  try {
    fs.writeFileSync(COOKIES_PATH, process.env.YT_COOKIES);
    console.log("🍪 File cookies scritto in", COOKIES_PATH);
  } catch (err) {
    console.error("❌ Errore scrittura cookies:", err.message);
  }
} else {
  console.warn("⚠️ Nessun YT_COOKIES trovato, i video con restrizioni non funzioneranno.");
}

// Pulizia file temporanei
function cleanupTempFile(filePath) {
  setTimeout(() => {
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`❌ Errore rimozione file: ${err.message}`);
        else console.log(`🧹 File temporaneo rimosso: ${filePath}`);
      });
    }
  }, 30000);
}

// Download con comando diretto
async function downloadAudioDirect(url, outputPath) {
  console.log(`🎬 Tentativo download diretto: ${url} -> ${outputPath}`);
  try {
    const ytdlPath = '/opt/render/project/src/node_modules/youtube-dl-exec/bin/yt-dlp';

    // 🔑 Aggiunta cookies se presenti
    const cookiesOption = fs.existsSync(COOKIES_PATH) ? ` --cookies ${COOKIES_PATH}` : "";
    const command = `"${ytdlPath}" "${url}" -o "${outputPath}" -f bestaudio${cookiesOption}`;

    console.log(`📋 Comando: ${command}`);
    const { stdout, stderr } = await execAsync(command, { timeout: 60000 });

    console.log(`📤 Stdout:`, stdout);
    if (stderr) console.log(`📤 Stderr:`, stderr);

    if (!fs.existsSync(outputPath)) throw new Error(`File non creato: ${outputPath}`);
    const stats = fs.statSync(outputPath);
    if (stats.size === 0) throw new Error(`File vuoto: ${outputPath}`);

    console.log(`✅ Download diretto completato: ${outputPath} (${stats.size} bytes)`);
    return outputPath;
  } catch (error) {
    console.error("❌ Errore download diretto:", error);
    return null;
  }
}

// Download con youtube-dl-exec
async function downloadAudio(url, outputPath) {
  console.log(`🎬 Avvio download: ${url} -> ${outputPath}`);
  try {
    const options = {
      output: outputPath,
      format: 'bestaudio'
    };

    // 🔑 Passa cookies anche qui
    if (fs.existsSync(COOKIES_PATH)) {
      options.cookies = COOKIES_PATH;
    }

    console.log(`📋 Opzioni download:`, JSON.stringify(options, null, 2));
    await youtubedl(url, options);

    if (!fs.existsSync(outputPath)) throw new Error(`File non trovato: ${outputPath}`);
    const stats = fs.statSync(outputPath);
    if (stats.size === 0) throw new Error(`File vuoto: ${outputPath}`);

    console.log(`✅ Download completato: ${outputPath} (${stats.size} bytes)`);
    return outputPath;
  } catch (error) {
    console.error("❌ Errore download completo:", error);
    console.error("❌ Stderr:", error.stderr);
    console.error("❌ Stdout:", error.stdout);

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    console.log("🔄 Tentativo fallback con comando diretto...");
    return await downloadAudioDirect(url, outputPath);
  }
}

// GET /mp3
app.get("/mp3", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL mancante" });

  const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!youtubeRegex.test(url)) return res.status(400).json({ error: "URL YouTube non valido" });

  const fileName = `output_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.m4a`;
  const outputPath = path.join(TEMP_DIR, fileName);

  try {
    console.log(`📥 Richiesta GET per: ${url}`);
    const file = await downloadAudio(url, outputPath);

    if (!file) {
      return res.status(500).json({ 
        error: "Download fallito", 
        details: "Impossibile scaricare l'audio dal video" 
      });
    }

    res.set({
      'Content-Type': 'audio/mp4',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition'
    });

    res.download(file, fileName, (err) => {
      if (err) {
        console.error("❌ Errore invio file:", err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: "Errore invio file" });
        }
      }
      cleanupTempFile(file);
    });
  } catch (error) {
    console.error("❌ Errore endpoint GET:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Errore interno del server", details: error.message });
    }
  }
});

// POST /download (uguale a GET)
app.post("/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL mancante nel body" });

  const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!youtubeRegex.test(url)) return res.status(400).json({ error: "URL YouTube non valido" });

  const fileName = `output_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.m4a`;
  const outputPath = path.join(TEMP_DIR, fileName);

  try {
    console.log(`📥 Richiesta POST per: ${url}`);
    const file = await downloadAudio(url, outputPath);

    if (!file) {
      return res.status(500).json({ 
        error: "Download fallito", 
        details: "Impossibile scaricare l'audio dal video" 
      });
    }

    res.set({
      'Content-Type': 'audio/mp4',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition'
    });

    res.download(file, fileName, (err) => {
      if (err) {
        console.error("❌ Errore invio file:", err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: "Errore invio file" });
        }
      }
      cleanupTempFile(file);
    });
  } catch (error) {
    console.error("❌ Errore endpoint POST:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Errore interno del server", details: error.message });
    }
  }
});

// Health check
app.get("/", async (req, res) => {
  let ytdlVersion = "unknown";
  try {
    const result = await youtubedl("", { version: true }).catch(() => "error");
    ytdlVersion = result || "error";
  } catch (e) {
    ytdlVersion = `error: ${e.message}`;
  }

  res.json({
    status: "OK",
    service: "YouTube MP3 API",
    version: "1.0.0",
    endpoints: {
      "GET /mp3?url=VIDEO_URL": "Scarica audio da YouTube",
      "POST /download": "Scarica audio (body: {url: 'VIDEO_URL'})"
    },
    environment: {
      node_env: process.env.NODE_ENV,
      temp_dir: TEMP_DIR,
      ffmpeg_available: ffmpegPath && fs.existsSync(ffmpegPath),
      ffmpeg_path: ffmpegPath,
      ytdl_version: ytdlVersion,
      cookies_loaded: fs.existsSync(COOKIES_PATH)
    },
    timestamp: new Date().toISOString()
  });
});

// Errori globali
app.use((err, req, res, next) => {
  console.error("❌ Errore non gestito:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Errore interno del server", message: err.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ 
    error: "Endpoint non trovato",
    available_endpoints: ["/", "/mp3", "/download"]
  });
});

app.listen(port, () => {
  console.log(`🌍 Server attivo su porta ${port}`);
  console.log(`📂 Temp directory: ${TEMP_DIR}`);
  console.log(`🌍 CORS abilitato`);
  console.log(`🔊 FFmpeg disponibile: ${ffmpegPath && fs.existsSync(ffmpegPath)}`);
  console.log(`🔊 FFmpeg path: ${ffmpegPath}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
