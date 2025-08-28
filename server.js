const express = require("express");
const cors = require("cors");
const youtubedl = require("youtube-dl-exec");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

const app = express();

// CORS completo
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Funzione per pulire i file temporanei
function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🧹 File temporaneo rimosso: ${filePath}`);
    }
  } catch (error) {
    console.warn(`⚠️ Errore rimozione file: ${error.message}`);
  }
}

// Funzione per download con yt-dlp (opzioni CORRETTE)
async function downloadAudio(url, outputPath) {
  console.log(` Tentativo download: ${url}`);
  console.log(`📁 Output: ${outputPath}`);
  
  try {
    // ✅ Opzioni yt-dlp CORRETTE (solo quelle che esistono)
    const result = await youtubedl(url, {
      // ✅ Formato audio specifico per yt-dlp
      format: 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
      
      // ✅ Output file
      output: outputPath,
      
      // ✅ FFmpeg path
      ffmpegLocation: ffmpegPath,
      
      // ✅ Opzioni di sicurezza
      noCheckCertificates: true,
      noWarnings: true,
      
      // ✅ Debug e verbose
      verbose: true,
      progress: true
    });
    
    console.log(`✅ Download completato:`, result);
    
    // ✅ Verifica immediata del file
    await new Promise(resolve => setTimeout(resolve, 5000)); // Aspetta 5 secondi
    
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`✅ File verificato: ${outputPath} (${stats.size} bytes)`);
      return true;
    } else {
      console.log(`❌ File non trovato dopo download: ${outputPath}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Download fallito:`, error.message);
    
    // ✅ Prova con opzioni alternative (sintassi yt-dlp)
    try {
      console.log(`🔄 Tentativo con opzioni alternative...`);
      
      const result = await youtubedl(url, {
        // ✅ Opzioni semplificate per yt-dlp
        format: 'bestaudio',
        output: outputPath,
        ffmpegLocation: ffmpegPath,
        
        // ✅ Opzioni base
        noCheckCertificates: true,
        noWarnings: true,
        verbose: true
      });
      
      console.log(`✅ Download alternativo riuscito:`, result);
      
      // ✅ Verifica immediata del file
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`✅ File verificato: ${outputPath} (${stats.size} bytes)`);
        return true;
      } else {
        console.log(`❌ File non trovato dopo download alternativo: ${outputPath}`);
        return false;
      }
      
    } catch (altError) {
      console.error(`❌ Anche il tentativo alternativo fallito:`, altError.message);
      
      // ✅ Prova con opzioni minimali
      try {
        console.log(`🔄 Tentativo con opzioni minimali...`);
        
        const result = await youtubedl(url, {
          format: 'bestaudio',
          output: outputPath,
          ffmpegLocation: ffmpegPath,
          verbose: true
        });
        
        console.log(`✅ Download minimo riuscito:`, result);
        
        // ✅ Verifica immediata del file
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(`✅ File verificato: ${outputPath} (${stats.size} bytes)`);
          return true;
        } else {
          console.log(`❌ File non trovato dopo download minimo: ${outputPath}`);
          return false;
        }
        
      } catch (minError) {
        console.error(`❌ Anche il tentativo minimo fallito:`, minError.message);
        return false;
      }
    }
  }
}

// Endpoint POST per download
app.post("/download", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL" });

  // ✅ Percorso corretto per Render
  const output = path.join(__dirname, "temp", `output_${Date.now()}.mp3`);
  
  // ✅ Crea directory temp se non esiste
  const tempDir = path.dirname(output);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(` Directory temp creata: ${tempDir}`);
  }

  console.log(`📥 Download request: ${url}`);
  console.log(`📁 Output path: ${output}`);

  try {
    // ✅ Prova il download
    const downloadSuccess = await downloadAudio(url, output);
    
    if (!downloadSuccess) {
      throw new Error("Download fallito dopo tutti i tentativi");
    }

    // ✅ Verifica finale del file
    if (!fs.existsSync(output)) {
      throw new Error("File output non trovato dopo download");
    }

    const stats = fs.statSync(output);
    if (stats.size === 0) {
      throw new Error("File output vuoto dopo download");
    }

    console.log(`✅ File finale verificato: ${output} (${stats.size} bytes)`);

    // ✅ Download del file
    res.download(output, "track.mp3", (err) => {
      if (err) {
        console.error("❌ Download error:", err);
      }
      // ✅ Pulisci il file temporaneo
      cleanupTempFile(output);
    });

  } catch (err) {
    console.error("❌ Download failed:", err);
    
    // ✅ Pulisci il file temporaneo in caso di errore
    cleanupTempFile(output);
    
    res.status(500).json({ 
      error: "Download failed", 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ Endpoint GET per compatibilità
app.get("/mp3", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing YouTube URL parameter" });

  // ✅ Percorso corretto per Render
  const output = path.join(__dirname, "temp", `output_${Date.now()}.mp3`);
  
  // ✅ Crea directory temp se non esiste
  const tempDir = path.dirname(output);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(` Directory temp creata: ${tempDir}`);
  }

  console.log(` Get request: ${url}`);
  console.log(`📁 Output path: ${output}`);

  try {
    // ✅ Prova il download
    const downloadSuccess = await downloadAudio(url, output);
    
    if (!downloadSuccess) {
      throw new Error("Download fallito dopo tutti i tentativi");
    }

    // ✅ Verifica finale del file
    if (!fs.existsSync(output)) {
      throw new Error("File output non trovato dopo download");
    }

    const stats = fs.statSync(output);
    if (stats.size === 0) {
      throw new Error("File output vuoto dopo download");
    }

    console.log(`✅ File finale verificato: ${output} (${stats.size} bytes)`);

    // ✅ Download del file
    res.download(output, "track.mp3", (err) => {
      if (err) {
        console.error("❌ Download error:", err);
      }
      // ✅ Pulisci il file temporaneo
      cleanupTempFile(output);
    });

  } catch (err) {
    console.error("❌ Download failed:", err);
    
    // ✅ Pulisci il file temporaneo in caso di errore
    cleanupTempFile(output);
    
    res.status(500).json({ 
      error: "Download failed", 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint per info video
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
    console.error("❌ Info failed:", err);
    res.status(500).json({ error: "Failed to get video info" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "YouTube MP3 API",
    endpoints: ["/download", "/mp3", "/info"],
    timestamp: new Date().toISOString()
  });
});

// CORS preflight
app.options('*', cors());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(` Temp directory: ${path.join(__dirname, "temp")}`);
  console.log(`🌍 CORS enabled for all origins`);
  console.log(` FFmpeg path: ${ffmpegPath}`);
  console.log(`📦 Using yt-dlp (not youtube-dl)`);
  console.log(` Debug mode: ON`);
  console.log(`🎵 Audio format: MP3 via FFmpeg`);
  console.log(`⏱️ Timeout: 5 seconds for conversion`);
});