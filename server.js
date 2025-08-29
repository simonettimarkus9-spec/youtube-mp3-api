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
import { exec } from "child_process";
import { promisify } from "util";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 10000; // Render usa porta 10000

// CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

// Directory temporanea - usa /tmp su Render
const TEMP_DIR = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Funzione per pulire file temporanei
function cleanupTempFile(filePath) {
  setTimeout(() => {
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`❌ Errore rimozione file: ${err.message}`);
        else console.log(`🧹 File temporaneo rimosso: ${filePath}`);
      });
    }
  }, 30000); // Pulisci dopo 30 secondi
}

// Funzione alternativa usando comando diretto
async function downloadAudioDirect(url, outputPath) {
  console.log(`🎬 Tentativo download diretto: ${url} -> ${outputPath}`);
  
  try {
    // Comando shell diretto
    const ytdlPath = '/opt/render/project/src/node_modules/youtube-dl-exec/bin/yt-dlp';
    const command = `"${ytdlPath}" "${url}" -o "${outputPath}" -f bestaudio`;
    
    console.log(`📋 Comando: ${command}`);
    
    const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
    
    console.log(`📤 Stdout:`, stdout);
    if (stderr) console.log(`📤 Stderr:`, stderr);

    // Verifica file
    if (!fs.existsSync(outputPath)) {
      throw new Error(`File non creato: ${outputPath}`);
    }

    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      throw new Error(`File vuoto: ${outputPath}`);
    }

    console.log(`✅ Download diretto completato: ${outputPath} (${stats.size} bytes)`);
    return outputPath;

  } catch (error) {
    console.error("❌ Errore download diretto:", error);
    return null;
  }
}

// Funzione di download ULTRA-semplificata per yt-dlp
async function downloadAudio(url, outputPath) {
  console.log(`🎬 Avvio download: ${url} -> ${outputPath}`);
  
  try {
    // SOLO le opzioni essenziali che esistono sicuramente
    const options = {
      output: outputPath,
      format: 'bestaudio',
    };

    console.log(`📋 Opzioni download:`, JSON.stringify(options, null, 2));

    await youtubedl(url, options);

    // Verifica che il file esista e non sia vuoto
    if (!fs.existsSync(outputPath)) {
      throw new Error(`File non trovato: ${outputPath}`);
    }

    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      throw new Error(`File vuoto: ${outputPath}`);
    }

    console.log(`✅ Download completato: ${outputPath} (${stats.size} bytes)`);
    return outputPath;

  } catch (error) {
    console.error("❌ Errore download completo:", error);
    console.error("❌ Stderr:", error.stderr);
    console.error("❌ Stdout:", error.stdout);
    
    // Pulizia in caso di errore
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    
    // FALLBACK: prova comando diretto
    console.log("🔄 Tentativo fallback con comando diretto...");
    return await downloadAudioDirect(url, outputPath);
  }
}

// GET /mp3?url=...
app.get("/mp3", async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: "URL mancante" });
  }

  // Valida URL YouTube
  const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!youtubeRegex.test(url)) {
    return res.status(400).json({ error: "URL YouTube non valido" });
  }

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

    // Imposta header appropriati
    res.set({
      'Content-Type': 'audio/mp4',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition'
    });

    // Invia file e poi pulisci
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
      res.status(500).json({ 
        error: "Errore interno del server", 
        details: error.message 
      });
    }
  }
});

// POST /download
app.post("/download", async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: "URL mancante nel body" });
  }

  // Valida URL YouTube
  const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
  if (!youtubeRegex.test(url)) {
    return res.status(400).json({ error: "URL YouTube non valido" });
  }

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

    // Imposta header appropriati
    res.set({
      'Content-Type': 'audio/mp4',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition'
    });

    // Invia file e poi pulisci
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
      res.status(500).json({ 
        error: "Errore interno del server", 
        details: error.message 
      });
    }
  }
});

// Health check migliorato con info debug
app.get("/", async (req, res) => {
  // Debug: controlla versione yt-dlp
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
      ytdl_version: ytdlVersion
    },
    timestamp: new Date().toISOString()
  });
});

// Gestione errori globali
app.use((err, req, res, next) => {
  console.error("❌ Errore non gestito:", err);
  if (!res.headersSent) {
    res.status(500).json({ 
      error: "Errore interno del server",
      message: err.message 
    });
  }
});

// 404 handler
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