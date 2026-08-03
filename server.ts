/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { exec, spawn } from "child_process";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { MatchData, HighlightSequence, FootballEvent, PlayCoordinate, TacticalStep, ProcessingJob, ExtractedFrame } from "./src/types";

dotenv.config();

// ES module path resolution helpers
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const FRAMES_DIR = path.join(UPLOADS_DIR, "frames");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const PORT = 3000;

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });

app.use("/uploads", express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2000 * 1024 * 1024 }, // 2GB
});

// In-memory storage for jobs and session matches
let analyzedMatches: MatchData[] = [];
const processingJobs: Record<string, ProcessingJob> = {};

// Helper: Format seconds to MM:SS
function formatTimeStr(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Helper: Get video duration via FFmpeg / ffprobe
function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve) => {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    exec(cmd, (err, stdout) => {
      if (!err && stdout && !isNaN(parseFloat(stdout.trim()))) {
        return resolve(Math.round(parseFloat(stdout.trim())));
      }
      // Fallback: parse duration from ffmpeg -i
      exec(`ffmpeg -i "${videoPath}"`, (ffmpegErr, ffmpegStdout, stderr) => {
        const output = (stderr || "") + (ffmpegStdout || "");
        const match = output.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        if (match) {
          const hours = parseInt(match[1], 10);
          const mins = parseInt(match[2], 10);
          const secs = parseFloat(match[3]);
          const totalSecs = Math.round(hours * 3600 + mins * 60 + secs);
          return resolve(totalSecs > 0 ? totalSecs : 120);
        }
        resolve(120); // Default fallback 2 mins if duration unknown
      });
    });
  });
}

// FFmpeg Frame Extraction Engine
function extractVideoFrames(jobId: string, videoPath: string, intervalSecs: number = 1.0): Promise<{ frames: ExtractedFrame[], duration: number }> {
  return new Promise(async (resolve, reject) => {
    const jobFramesDir = path.join(FRAMES_DIR, jobId);
    if (!fs.existsSync(jobFramesDir)) {
      fs.mkdirSync(jobFramesDir, { recursive: true });
    }

    const duration = await getVideoDuration(videoPath);
    console.log(`[Job ${jobId}] Target video duration: ${duration}s. Extracting frames every ${intervalSecs}s...`);

    if (processingJobs[jobId]) {
      processingJobs[jobId].videoDuration = duration;
      processingJobs[jobId].status = "extracting_frames";
      processingJobs[jobId].progress = 20;
      processingJobs[jobId].currentStep = `FFmpeg extracting high-resolution frames (1 frame every ${intervalSecs}s) for duration ${duration}s...`;
    }

    const outputPattern = path.join(jobFramesDir, "frame_%04d.jpg");
    // FFmpeg command to extract JPEGs at interval
    const fpsValue = 1 / Math.max(0.2, intervalSecs);
    const ffmpegArgs = [
      "-y",
      "-i", videoPath,
      "-vf", `fps=${fpsValue},scale=640:-1`,
      "-q:v", "3",
      outputPattern
    ];

    const ffmpegProc = spawn("ffmpeg", ffmpegArgs);

    let checkInterval = setInterval(() => {
      fs.readdir(jobFramesDir, (err, files) => {
        if (!err && files && processingJobs[jobId]) {
          const count = files.filter(f => f.endsWith(".jpg")).length;
          processingJobs[jobId].extractedFramesCount = count;
          const estimatedTotal = Math.max(1, Math.ceil(duration / intervalSecs));
          const frameProgress = Math.min(50, Math.floor((count / estimatedTotal) * 50));
          processingJobs[jobId].progress = 20 + frameProgress;
          processingJobs[jobId].currentStep = `FFmpeg frame extraction in progress... (${count} frames generated)`;
        }
      });
    }, 800);

    ffmpegProc.on("close", (code) => {
      clearInterval(checkInterval);
      
      fs.readdir(jobFramesDir, (err, files) => {
        if (err || !files) {
          console.warn(`[Job ${jobId}] Frame directory read error:`, err);
        }

        const jpgFiles = (files || []).filter(f => f.endsWith(".jpg")).sort();
        const extractedFrames: ExtractedFrame[] = jpgFiles.map((fname, idx) => {
          const timestamp = Math.round(idx * intervalSecs);
          return {
            id: `frame_${idx + 1}`,
            filename: fname,
            url: `/uploads/frames/${jobId}/${fname}`,
            timestamp,
            timeStr: formatTimeStr(timestamp)
          };
        });

        console.log(`[Job ${jobId}] FFmpeg extracted ${extractedFrames.length} total frames.`);
        
        if (processingJobs[jobId]) {
          processingJobs[jobId].extractedFrames = extractedFrames;
          processingJobs[jobId].extractedFramesCount = extractedFrames.length;
          processingJobs[jobId].progress = 70;
          processingJobs[jobId].currentStep = `Frame extraction complete (${extractedFrames.length} frames). Running AI multimodal pipeline...`;
        }

        resolve({ frames: extractedFrames, duration });
      });
    });

    ffmpegProc.on("error", (err) => {
      clearInterval(checkInterval);
      console.error(`[Job ${jobId}] FFmpeg process error:`, err);
      // Even if FFmpeg errors out on specific codecs, attempt to resolve with whatever frames were extracted or generate synthetic fallback frames
      fs.readdir(jobFramesDir, (rErr, files) => {
        const jpgFiles = (files || []).filter(f => f.endsWith(".jpg")).sort();
        const extractedFrames: ExtractedFrame[] = jpgFiles.map((fname, idx) => {
          const timestamp = Math.round(idx * intervalSecs);
          return {
            id: `frame_${idx + 1}`,
            filename: fname,
            url: `/uploads/frames/${jobId}/${fname}`,
            timestamp,
            timeStr: formatTimeStr(timestamp)
          };
        });
        resolve({ frames: extractedFrames, duration: duration || 120 });
      });
    });
  });
}

// Background asynchronous processing queue worker
async function processVideoJob(
  jobId: string,
  videoPath: string,
  logText: string,
  matchTitle: string,
  competition: string,
  date: string,
  frameInterval: number = 1.0
) {
  try {
    const { frames, duration } = await extractVideoFrames(jobId, videoPath, frameInterval);

    if (processingJobs[jobId]) {
      processingJobs[jobId].status = "analyzing_ai";
      processingJobs[jobId].progress = 75;
      processingJobs[jobId].currentStep = "Analyzing video frames & commentary logs with Gemini AI...";
    }

    // Sample key frames for Gemini multimodal analysis
    const sampleSize = Math.min(20, frames.length);
    const step = Math.max(1, Math.floor(frames.length / sampleSize));
    const sampledFrames = [];
    for (let i = 0; i < frames.length && sampledFrames.length < sampleSize; i += step) {
      sampledFrames.push(frames[i]);
    }

    // Read sampled frame images as base64 for Gemini
    const imageParts = [];
    const jobFramesDir = path.join(FRAMES_DIR, jobId);
    for (const frame of sampledFrames) {
      const fPath = path.join(jobFramesDir, frame.filename);
      if (fs.existsSync(fPath)) {
        try {
          const base64Buf = fs.readFileSync(fPath).toString("base64");
          imageParts.push({ text: `Frame at ${frame.timestamp}s (${frame.timeStr}) on the video timeline:` });
          imageParts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Buf
            }
          });
        } catch (e) {
          console.warn("Could not read frame file for Gemini payload:", e);
        }
      }
    }

    let matchData: MatchData;
    const finalTitle = matchTitle || "Real Football Match";
    const supplementaryLog = (logText || "").trim();

    try {
      const ai = getGeminiClient();
      const promptText = `
You are the world's most sophisticated Intelligent Football Highlight Detection System, operating like a high-end Veo 3 camera system.
You are provided with actual extracted video frame snapshots from a football match recording along with match event logs / commentary text.

Match Title: ${finalTitle}
Competition: ${competition || "Veo 3 Amateur League"}
Match Duration: ${duration} seconds (${Math.floor(duration/60)} minutes)

Commentary/Log Text:
---
${supplementaryLog}
---

Your task is to analyze these video frames and commentary text to produce a complete, highly structured MatchData JSON object following these guidelines:
1. Only report what is directly visible in the labeled frames; events between sampled frames may be missing — never guess them.
2. All timestamps must be derived from the labeled frame timestamps.
3. Identify players ONLY by jersey numbers actually visible ("Player #10", or "Player #? (kit color, position)" if unreadable — never assign an unseen number).
4. Assign teams by visible kit colors (hex in the team color field).
5. Count per-player and match stats from the frames only. Metrics not measurable from sampled frames (topSpeed, distanceCovered, sprints) must be 0 — never estimated.
6. Score per team = goals actually visible, else 0.
7. Tactical animations and heatmaps only for sequences genuinely visible in the frames, otherwise omit them.
8. If no meaningful football action is visible, return empty highlights and playerStats arrays — an honest empty result is correct.

Respond ONLY with a valid JSON object matching the standard MatchData schema.
`;

      const contents = [{ text: promptText }, ...imageParts];
      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents,
            config: {
              responseMimeType: "application/json",
            },
          });
          break; // success
        } catch (error: any) {
          console.warn(`[Job ${jobId}] Gemini API call failed (${retries} retries left). Error:`, error.message);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3s before retry
        }
      }

      const parsedData = JSON.parse(response.text.trim());
      parsedData.id = "job-match-" + jobId;
      parsedData.videoUrl = processingJobs[jobId]?.videoUrl;
      parsedData.extractedFrames = frames;
      
      if (!parsedData.teamA) {
        parsedData.teamA = { name: "Home Team", logo: "🏠", score: 0, color: "#cbd5e1" };
      }
      if (!parsedData.teamB) {
        parsedData.teamB = { name: "Away Team", logo: "✈️", score: 0, color: "#94a3b8" };
      }
      if (!parsedData.stats) {
        parsedData.stats = {
          possession: [50, 50],
          xG: [0, 0],
          shots: [0, 0],
          saves: [0, 0],
          passCompletion: [0, 0],
          tackles: [0, 0],
          sprintDistance: [0, 0]
        };
      }
      if (!parsedData.highlights) parsedData.highlights = [];
      if (!parsedData.playerStats) parsedData.playerStats = [];
      if (!parsedData.passNetwork) parsedData.passNetwork = { players: [], links: [] };
      if (!parsedData.highPressZones) parsedData.highPressZones = [];
      
      // Ensure timestamps fit within duration and remove fabricated ones
      if (parsedData.highlights && Array.isArray(parsedData.highlights)) {
        parsedData.highlights = parsedData.highlights
          .filter((hl: any) => (hl.startTimestamp ?? hl.seconds ?? hl.events?.[0]?.seconds) !== undefined)
          .map((hl: any) => {
            let secs = hl.startTimestamp ?? hl.seconds ?? hl.events?.[0]?.seconds;
            secs = Math.max(0, Math.min(duration, secs));
            const hlDuration = hl.duration || 15;
            const endSecs = Math.min(duration, secs + hlDuration);
            return {
              ...hl,
              startTimestamp: secs,
              endTimestamp: endSecs,
              seconds: secs,
              matchTime: formatTimeStr(secs)
            };
          });
      }

      matchData = parsedData;

    } catch (geminiError: any) {
      console.warn(`[Job ${jobId}] Gemini API call failed. Error:`, geminiError.message);
      throw new Error("AI analysis failed: " + geminiError.message + " No simulated data was generated");
    }

    // Unshift into global session matches
    analyzedMatches.unshift(matchData);

    if (processingJobs[jobId]) {
      processingJobs[jobId].matchData = matchData;
      processingJobs[jobId].status = "completed";
      processingJobs[jobId].progress = 100;
      processingJobs[jobId].currentStep = "AI Analysis complete! All highlights, player stats & frame snapshots generated.";
    }

  } catch (err: any) {
    console.error(`[Job ${jobId}] Processing error:`, err);
    if (processingJobs[jobId]) {
      processingJobs[jobId].status = "failed";
      processingJobs[jobId].error = err.message || "An unexpected error occurred during server video processing.";
      processingJobs[jobId].currentStep = "Processing failed: " + (err.message || "Unknown error");
    }
  }
}

// REST API Endpoints

// 1. Get session matches
app.get("/api/matches", (req, res) => {
  res.json(analyzedMatches);
});

const uploadMiddleware = upload.fields([{ name: "video", maxCount: 1 }, { name: "log", maxCount: 1 }]);

// 2. Upload video file endpoint
app.post("/api/upload", (req, res) => {
  uploadMiddleware(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: "Multer error: " + err.message });
    } else if (err) {
      return res.status(500).json({ error: "Unknown upload error: " + err.message });
    }

    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const videoFile = files?.["video"]?.[0];
      const logFile = files?.["log"]?.[0];

      if (!videoFile) {
        return res.status(400).json({ error: "No raw video file was provided in the upload payload." });
      }

      const matchTitle = req.body.matchTitle || "";
      const competition = req.body.competition || "Real-life Match Play";
      const date = req.body.date || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const frameInterval = parseFloat(req.body.frameInterval) || 1.0;

      let logText = req.body.commentary || "";
      if (logFile && fs.existsSync(logFile.path)) {
        try {
          logText = fs.readFileSync(logFile.path, "utf-8");
        } catch (e) {
          console.warn("Could not read uploaded log file:", e);
        }
      }

      const jobId = "job_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      processingJobs[jobId] = {
        jobId,
        status: "uploading",
        progress: 10,
        currentStep: "Video file received by server. Initializing FFmpeg frame extraction queue...",
        videoFileName: videoFile.filename,
        videoUrl: `/uploads/${videoFile.filename}`,
        videoSizeMb: Number((videoFile.size / (1024 * 1024)).toFixed(1)),
      };

      // Trigger asynchronous background processing pipeline
      processVideoJob(jobId, videoFile.path, logText, matchTitle, competition, date, frameInterval);

      res.json({
        jobId,
        status: "processing",
        message: "Server background video processing job initiated successfully.",
        job: processingJobs[jobId]
      });

    } catch (err: any) {
      console.error("Upload route error:", err);
      res.status(500).json({ error: err.message || "Failed to process video upload." });
    }
  });
});

// 3. Job status endpoint
app.get("/api/jobs/:jobId", (req, res) => {
  const job = processingJobs[req.params.jobId];
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }
  res.json(job);
});

// 4. Job frames list endpoint
app.get("/api/jobs/:jobId/frames", (req, res) => {
  const job = processingJobs[req.params.jobId];
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }
  res.json({
    jobId: job.jobId,
    extractedFramesCount: job.extractedFramesCount || 0,
    frames: job.extractedFrames || []
  });
});

// Lazy initialization of Gemini
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it via the Settings panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }


  return aiClient;
}

// Configure development Vite server or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server loaded.");
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static server loaded from dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
