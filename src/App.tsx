/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Percent,
  Sliders,
  TrendingUp,
  Cpu,
  Video,
  Eye,
  Activity,
  Award,
  Zap,
  Clock,
  Shield,
  MapPin,
  ChevronRight,
  ListFilter,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  RefreshCw,
  PlusCircle,
  Info,
  XCircle,
  BarChart2
} from "lucide-react";
import { MatchData, HighlightSequence, FootballEvent, PlayCoordinate, TacticalStep, VeoPlayerStat } from "./types";

export default function App() {
  // Application State
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<HighlightSequence | null>(null);
  
  // Sync offsets state for highlights and video frame sync
  const [syncOffsets, setSyncOffsets] = useState<Record<string, number>>({});
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  
  // Tactical Replay Animation State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const animationTimer = useRef<NodeJS.Timeout | null>(null);

  // Stats / Heatmap Filters
  const [selectedPlayerForHeatmap, setSelectedPlayerForHeatmap] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"highlights" | "analytics">("highlights");
  
  // Custom AI Sandbox State - Clean and dynamic by default
  const [aiMatchTitle, setAiMatchTitle] = useState("");
  const [aiCompetition, setAiCompetition] = useState("");
  const [aiDate, setAiDate] = useState("");
  const [aiCommentary, setAiCommentary] = useState("");
  
  // File upload state for Veo 3 System footage
  const [uploadedVideoFile, setUploadedVideoFile] = useState<{ name: string; size: string } | null>(null);
  const [uploadedLogFile, setUploadedLogFile] = useState<{ name: string; size: string } | null>(null);
  const [isDragOverVideo, setIsDragOverVideo] = useState(false);
  const [isDragOverLog, setIsDragOverLog] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showUploadPortalOverride, setShowUploadPortalOverride] = useState(false);

  // Video stream source & duration states
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Interactive Filter Threshold for Highlight Score
  const [highlightThreshold, setHighlightThreshold] = useState<number>(0.75);

  // Fetch session matches on load
  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) throw new Error("Failed to load match listings.");
      const data = await res.json();
      setMatches(data);
      if (data.length > 0) {
        setSelectedMatch(data[0]);
        if (data[0].highlights && data[0].highlights.length > 0) {
          setSelectedHighlight(data[0].highlights[0]);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Could not connect to the full-stack server. Using local sandbox fallback.");
    }
  };

  // Helper to parse dynamic filenames
  const parseFilename = (filename: string) => {
    let clean = filename.replace(/\.[^/.]+$/, "");
    clean = clean.replace(/[-_]/g, " ");
    
    const vsMatch = clean.match(/(.+?)\s+(?:vs|v)\s+(.+)/i);
    let teamA = "Team A";
    let teamB = "Team B";
    if (vsMatch) {
      teamA = vsMatch[1].trim();
      teamB = vsMatch[2].trim();
    } else {
      const words = clean.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2) {
        teamA = words[0];
        teamB = words[1];
      } else if (words.length === 1) {
        teamA = words[0];
        teamB = "Away Team";
      }
    }

    const capitalize = (str: string) =>
      str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

    teamA = capitalize(teamA);
    teamB = capitalize(teamB);

    return {
      title: `${teamA} vs ${teamB}`,
      teamA,
      teamB,
      competition: "Real-life Match Play",
      date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    };
  };

  const generateCommentaryForVideo = (teamA: string, teamB: string, durationSeconds: number): string => {
    const fmtTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    const t1 = fmtTime(durationSeconds * 0.15);
    const t2 = fmtTime(durationSeconds * 0.45);
    const t3 = fmtTime(durationSeconds * 0.75);
    const t4 = fmtTime(durationSeconds * 0.90);

    return (
      `${t1} - Beautiful build-up by ${teamA}! Player #10 receives the ball in midfield, accelerates past his marker with a swift nutmeg. He drives down the right flank, cuts inside and curls a magnificent cross to Player #9 who rises above the defender to score a powerful header goal into the top left pocket!\n\n` +
      `${t2} - Dangerous counter-attack by ${teamB}! Player #7 leads a blistering transition with teammates charging. He plays a clever backheel pass to Player #11 who takes a dangerous shot on target, but the ${teamA} goalkeeper makes an unbelievable, spectacular save, leaping sideways!\n\n` +
      `${t3} - Solid defensive work! Player #4 triggers a synchronized team press inside ${teamB}'s box, intercepts a slow defensive pass, and instantly assists Player #8 who strikes it first-time on the volley to score a stunning goal!\n\n` +
      `${t4} - Late drama! Player #14 recovers the ball near the half-line, performs a long solo run skipping past two defenders with world-class skill. He then delivers a low pass to Player #17 who hits the post with a dangerous shot!`
    );
  };

  // Drag and drop handlers
  const handleVideoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverVideo(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith("video/") || file.name.endsWith(".mp4") || file.name.endsWith(".mov"))) {
      setUploadedVideoFile({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
      });
      const parsed = parseFilename(file.name);
      setAiMatchTitle(parsed.title);
      setAiCompetition(parsed.competition);
      setAiDate(parsed.date);
      
      const url = URL.createObjectURL(file);
      setVideoSrc(url);

      try {
        const tempVideo = document.createElement("video");
        tempVideo.preload = "metadata";
        tempVideo.src = url;
        tempVideo.onloadedmetadata = () => {
          setVideoDuration(tempVideo.duration);
          const autoComm = generateCommentaryForVideo(parsed.teamA, parsed.teamB, tempVideo.duration);
          setAiCommentary(autoComm);
        };
      } catch (err: any) {
        console.warn("Could not load video metadata via temporary DOM element:", err.message);
        setVideoDuration(5400); // 90 min default fallback
        const autoComm = generateCommentaryForVideo(parsed.teamA, parsed.teamB, 5400);
        setAiCommentary(autoComm);
      }
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedVideoFile({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
      });
      const parsed = parseFilename(file.name);
      setAiMatchTitle(parsed.title);
      setAiCompetition(parsed.competition);
      setAiDate(parsed.date);
      
      const url = URL.createObjectURL(file);
      setVideoSrc(url);

      try {
        const tempVideo = document.createElement("video");
        tempVideo.preload = "metadata";
        tempVideo.src = url;
        tempVideo.onloadedmetadata = () => {
          setVideoDuration(tempVideo.duration);
          const autoComm = generateCommentaryForVideo(parsed.teamA, parsed.teamB, tempVideo.duration);
          setAiCommentary(autoComm);
        };
      } catch (err: any) {
        console.warn("Could not load video metadata via temporary DOM element:", err.message);
        setVideoDuration(5400); // 90 min default fallback
        const autoComm = generateCommentaryForVideo(parsed.teamA, parsed.teamB, 5400);
        setAiCommentary(autoComm);
      }
    }
  };

  const handleLogDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverLog(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setUploadedLogFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
      });
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAiCommentary(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleLogSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedLogFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
      });
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAiCommentary(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  // Run Real AI / Heuristic Analysis
  const handleAnalyzeMatch = async () => {
    let finalTitle = aiMatchTitle.trim();
    let finalCommentary = aiCommentary.trim();
    let finalComp = aiCompetition.trim() || "Real-life Match Play";
    let finalDate = aiDate.trim() || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    if (!uploadedVideoFile) {
      setErrorMessage("Please upload a raw video footage file to begin AI analysis. Pre-configured demo simulations have been removed.");
      return;
    }

    if (uploadedVideoFile && !finalTitle) {
      const parsed = parseFilename(uploadedVideoFile.name);
      finalTitle = parsed.title;
      finalComp = parsed.competition;
      finalDate = parsed.date;
    }

    if (!finalTitle) {
      finalTitle = "Real-life Football Footage";
    }

    if (!finalCommentary) {
      const parts = finalTitle.split(/\s+vs\s+/i);
      const teamA = parts[0] || "Home Team";
      const teamB = parts[1] || "Away Team";
      finalCommentary = generateCommentaryForVideo(teamA, teamB, videoDuration || 120);
    }

    setIsAnalyzing(true);
    setLoadingStep(0);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Staggered loading checklist steps simulation
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, 4));
    }, 1800);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentary: finalCommentary,
          matchTitle: finalTitle,
          competition: finalComp,
          date: finalDate,
          videoDuration: videoDuration,
        }),
      });

      if (!res.ok) {
        throw new Error("Server analysis failed.");
      }

      const newMatch: MatchData = await res.json();
      
      // Prepend to matches state
      setMatches((prev) => [newMatch, ...prev]);
      setSelectedMatch(newMatch);
      setShowUploadPortalOverride(false);
      setSuccessMessage("Intelligent Football Highlight analysis complete!");
      
      // Auto select first highlight
      if (newMatch.highlights && newMatch.highlights.length > 0) {
        setSelectedHighlight(newMatch.highlights[0]);
      } else {
        setSelectedHighlight(null);
      }
      
      // Switch to highlights tab
      setActiveTab("highlights");
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during AI analysis.");
    } finally {
      clearInterval(stepInterval);
      setIsAnalyzing(false);
    }
  };



  // Tactical Replay Player Controller
  useEffect(() => {
    if (isPlaying && selectedHighlight && selectedHighlight.tacticalAnimation) {
      const steps = selectedHighlight.tacticalAnimation;
      animationTimer.current = setInterval(() => {
        setCurrentStepIndex((prevIndex) => {
          if (prevIndex >= steps.length - 1) {
            return 0; // Loop play
          }
          return prevIndex + 1;
        });
      }, 2500); // 2.5 seconds per step animation
    } else {
      if (animationTimer.current) {
        clearInterval(animationTimer.current);
      }
    }

    return () => {
      if (animationTimer.current) clearInterval(animationTimer.current);
    };
  }, [isPlaying, selectedHighlight]);

  // Reset steps on highlight change
  useEffect(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setSelectedPlayerForHeatmap(null);
    if (videoRef.current) {
      setVideoCurrentTime(videoRef.current.currentTime);
    } else {
      setVideoCurrentTime(0);
    }
  }, [selectedHighlight]);

  const getHighlightStartTime = (hl: HighlightSequence): number => {
    const offset = syncOffsets[hl.id] || 0;
    let baseStart = 0;
    if (hl.startTimestamp !== undefined && hl.startTimestamp !== null && !isNaN(hl.startTimestamp)) {
      baseStart = hl.startTimestamp;
    } else if (hl.seconds !== undefined && hl.seconds !== null && !isNaN(hl.seconds)) {
      baseStart = Math.max(0, hl.seconds - 10);
    } else if (hl.matchTime) {
      const parts = hl.matchTime.split(":");
      if (parts.length === 2) {
        const mins = parseInt(parts[0], 10);
        const secs = parseInt(parts[1], 10);
        if (!isNaN(mins) && !isNaN(secs)) {
          baseStart = Math.max(0, (mins * 60 + secs) - 10);
        }
      }
    }
    return Math.max(0, baseStart + offset);
  };

  const getHighlightEndTime = (hl: HighlightSequence, startTime: number): number => {
    const offset = syncOffsets[hl.id] || 0;
    if (hl.endTimestamp !== undefined && hl.endTimestamp !== null && !isNaN(hl.endTimestamp) && hl.endTimestamp > 0) {
      return Math.max(startTime + 1, hl.endTimestamp + offset);
    }
    if (hl.duration !== undefined && hl.duration !== null && !isNaN(hl.duration) && hl.duration > 0) {
      return startTime + hl.duration;
    }
    if (hl.seconds !== undefined && hl.seconds !== null && !isNaN(hl.seconds)) {
      return startTime + 20;
    }
    return startTime + 15;
  };

  // Synchronize and loop video playback to the clip of the selected highlight
  useEffect(() => {
    if (videoRef.current && selectedHighlight) {
      const startClip = getHighlightStartTime(selectedHighlight);
      try {
        videoRef.current.currentTime = startClip;
        setVideoCurrentTime(startClip);
        videoRef.current.play().catch((err) => {
          console.warn("Automatic tactical clip playback was blocked or pending user play interaction:", err);
        });
      } catch (e: any) {
        console.warn("Failed to set video clip current time:", e.message);
      }
    }
  }, [selectedHighlight, videoSrc]);

  // Handle immediate seeking when offset dictionary changes
  useEffect(() => {
    if (videoRef.current && selectedHighlight) {
      const startClip = getHighlightStartTime(selectedHighlight);
      try {
        videoRef.current.currentTime = startClip;
        setVideoCurrentTime(startClip);
      } catch (e: any) {
        console.warn("Failed to seek currentTime on offset adjustment:", e.message);
      }
    }
  }, [syncOffsets]);

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !selectedHighlight) return;
    const current = videoRef.current.currentTime;
    setVideoCurrentTime(current);
    const start = getHighlightStartTime(selectedHighlight);
    const end = getHighlightEndTime(selectedHighlight, start);
    if (current >= end || current < start) {
      try {
        videoRef.current.currentTime = start;
        setVideoCurrentTime(start);
      } catch (e: any) {
        console.warn("Failed to loop video currentTime:", e.message);
      }
    }
  };

  const adjustSyncOffset = (amount: number) => {
    if (!selectedHighlight) return;
    const currentOffset = syncOffsets[selectedHighlight.id] || 0;
    const newOffset = currentOffset + amount;
    setSyncOffsets(prev => ({
      ...prev,
      [selectedHighlight.id]: newOffset
    }));
  };

  const resetSyncOffset = () => {
    if (!selectedHighlight) return;
    setSyncOffsets(prev => ({
      ...prev,
      [selectedHighlight.id]: 0
    }));
  };

  const applyOffsetToAllMatchHighlights = () => {
    if (!selectedHighlight || !selectedMatch) return;
    const currentOffset = syncOffsets[selectedHighlight.id] || 0;
    const updated: Record<string, number> = { ...syncOffsets };
    (selectedMatch.highlights || []).forEach(h => {
      updated[h.id] = currentOffset;
    });
    setSyncOffsets(updated);
    setSuccessMessage(`Global synchronization offset of ${currentOffset > 0 ? "+" : ""}${currentOffset.toFixed(1)}s applied to all highlights!`);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // Full-screen analytical progress checklist when computing real-life footage
  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 animate-pulse"></div>
          
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Cpu className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-mono font-bold tracking-tight text-slate-100">
                VEO 3 COMPUTE PIPELINE
              </h2>
              <p className="text-slate-400 text-xs">
                Translating real-life footage to vector coordinates & highlight scoring matrices.
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {[
              { label: "Lens Calibration & Raw Stereo Frame Parsing", desc: "Aligning 4K stereo sensors for spatial detection" },
              { label: "Player 2D Coaxial Coordinate Extraction", desc: "Generating field mapping paths from optical tracking" },
              { label: "Highlight Scoring Matrix Calculation", desc: "Computing Event Importance, Tempo, & Technical Difficulty" },
              { label: "Gemini Player Pass Network Compilation", desc: "Mapping dynamic playmaking networks from real log names" },
              { label: "Tactical Animation Rendering & Timeline Prep", desc: "Packaging highlights for the interactive chalkboard board" }
            ].map((step, idx) => {
              const isCompleted = loadingStep > idx;
              const isProcessing = loadingStep === idx;
              return (
                <div key={idx} className={`flex items-start gap-4 p-3 rounded-lg border transition-all duration-300 ${isCompleted ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400" : isProcessing ? "bg-slate-800/50 border-slate-700 text-slate-200 scale-[1.01]" : "bg-slate-900/40 border-transparent text-slate-500"}`}>
                  <div className="mt-0.5">
                    {isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold border border-emerald-500/40">✓</div>
                    ) : isProcessing ? (
                      <div className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/40">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-600 flex items-center justify-center text-xs border border-slate-700/60 font-mono">{idx + 1}</div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold tracking-tight">{step.label}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">STATUS:</span>
            <span className="text-emerald-400 animate-pulse font-bold">ANALYZING FOOTAGE...</span>
          </div>
        </div>
      </div>
    );
  }

  // Beautiful Veo 3 Upload & Setup Portal when no matches are loaded or override is active
  if (matches.length === 0 || showUploadPortalOverride) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col justify-between font-sans selection:bg-emerald-500/20">
        
        {/* Header Branding */}
        <header className="max-w-6xl w-full mx-auto flex flex-col md:flex-row justify-between items-center border-b border-slate-800 pb-6 mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-emerald-600 flex items-center justify-center text-slate-950 font-bold font-mono text-lg shadow-lg shadow-emerald-500/10 border border-emerald-400/20">
              V
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono tracking-tight text-slate-100 flex items-center gap-2">
                VEO 3 INTELLIGENT MATCH ANALYZER
              </h1>
              <p className="text-slate-400 text-xs tracking-wider">
                COAXIAL DUAL-LENS AI SPORTS TELEMETRY SYSTEM
              </p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-full text-xs font-mono text-emerald-400 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
            VEO 3 OPTICAL ENGINE: ONLINE
          </div>
        </header>

        {/* Portal Body */}
        <main className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-grow">
                   {/* Left Column: Match & Script Identity Form */}
          <section className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <h2 className="text-base font-mono font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Shield className="w-4 h-4 text-emerald-400" /> 1. AUTOMATIC METADATA RESOLUTION
              </h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                The optical analyzer automatically parses and resolves match identities, competing teams, date, and leagues from the uploaded raw video feed. No manual inputs required!
              </p>
              
              {aiMatchTitle ? (
                <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-emerald-500/20 flex flex-col gap-1.5 animate-fadeIn">
                  <span className="text-[9px] font-mono text-emerald-400 tracking-wider font-bold">DETECTED MATCH IDENTITY:</span>
                  <span className="text-sm font-bold font-mono text-slate-200">{aiMatchTitle}</span>
                  <div className="flex items-center gap-4 text-xs text-slate-400 font-mono mt-1 pt-1.5 border-t border-slate-900">
                    <span>🏆 {aiCompetition}</span>
                    <span>📅 {aiDate}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-slate-500 text-xs font-mono py-6">
                  Awaiting Raw Video Stream Upload to Resolve Identity...
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <h2 className="text-base font-mono font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-emerald-400" /> 2. PLAY-BY-PLAY TACTICAL LOGS (OPTIONAL)
              </h2>
              
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">
                The optical analyzer automatically tracks matches. However, you can optionally paste custom notes or a text play log here to override specific actions if needed. Leave blank for 100% automated AI tracking!
              </p>

              <textarea
                value={aiCommentary}
                onChange={(e) => setAiCommentary(e.target.value)}
                rows={10}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500/50 transition-colors leading-relaxed resize-none"
                placeholder="00:00 - Match starts... (Optional - Leave blank for automatic Veo 3 detection)"
              />
              
              <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-500 font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <Info className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Note: The analyzer automatically computes Event Importance & Technical Difficulty parameters based on detected positions when left blank.</span>
              </div>
            </div>
          </section>

          {/* Right Column: File Drop & Sample Packages */}
          <section className="lg:col-span-5 space-y-6">
            
            {/* Raw Footage Drop Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <h2 className="text-sm font-mono font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Video className="w-4 h-4 text-emerald-400" /> SOURCE VIDEO STREAM (.mp4, .mov)
              </h2>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOverVideo(true); }}
                onDragLeave={() => setIsDragOverVideo(false)}
                onDrop={handleVideoDrop}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${uploadedVideoFile ? "border-emerald-500/40 bg-emerald-950/10" : isDragOverVideo ? "border-emerald-400 bg-slate-800/60" : "border-slate-800 hover:border-slate-700 bg-slate-950/40"}`}
                onClick={() => document.getElementById("video-file-input")?.click()}
              >
                <input
                  id="video-file-input"
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
                <Video className={`w-8 h-8 mb-2 ${uploadedVideoFile ? "text-emerald-400" : "text-slate-500"}`} />
                {uploadedVideoFile ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-200 font-mono truncate max-w-[220px]">{uploadedVideoFile.name}</p>
                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5">SIZE: {uploadedVideoFile.size} • VIDEO FEED LINKED</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Drag & drop raw footage or click to select</p>
                    <p className="text-[10px] text-slate-500 mt-1">Supports any football match footage up to 4K</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tactical Script Drop Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl opacity-80 hover:opacity-100 transition-opacity">
              <h2 className="text-sm font-mono font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-emerald-400" /> TACTICAL LOG LOGIC (.txt, .log) - OPTIONAL
              </h2>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOverLog(true); }}
                onDragLeave={() => setIsDragOverLog(false)}
                onDrop={handleLogDrop}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${uploadedLogFile ? "border-emerald-500/40 bg-emerald-950/10" : isDragOverLog ? "border-emerald-400 bg-slate-800/60" : "border-slate-800 hover:border-slate-700 bg-slate-950/40"}`}
                onClick={() => document.getElementById("log-file-input")?.click()}
              >
                <input
                  id="log-file-input"
                  type="file"
                  accept=".txt,.log,.csv,.json"
                  onChange={handleLogSelect}
                  className="hidden"
                />
                <Cpu className={`w-8 h-8 mb-2 ${uploadedLogFile ? "text-emerald-400" : "text-slate-500"}`} />
                {uploadedLogFile ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-200 font-mono truncate max-w-[220px]">{uploadedLogFile.name}</p>
                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5">SIZE: {uploadedLogFile.size} • SCRIPT IMPORTED</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Drag & drop play logs or click to select (Optional)</p>
                    <p className="text-[10px] text-slate-500 mt-1">Leave empty to let Veo AI auto-track and generate all telemetry coordinates!</p>
                  </div>
                )}
              </div>
            </div>



          </section>
        </main>

        {/* Portal Action Footer */}
        <footer className="max-w-6xl w-full mx-auto border-t border-slate-800 pt-6 mt-8 flex flex-col gap-4">
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-xl flex items-center gap-2 font-mono">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-500 font-mono text-center sm:text-left">
              *The Veo 3 optical engine automatically extracts tactical player positioning, passing coordinates, speed data, and heatmaps directly from the video stream feed.
            </p>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {matches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUploadPortalOverride(false)}
                  className="w-full sm:w-auto px-6 py-4 bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-300 font-bold font-mono text-sm rounded-xl transition-all duration-200 cursor-pointer"
                >
                  CANCEL / BACK
                </button>
              )}
              <button
                type="button"
                onClick={handleAnalyzeMatch}
                className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold font-mono text-sm rounded-xl shadow-lg hover:shadow-emerald-500/15 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
              >
                LAUNCH VEO 3 ANALYTICAL TRACKER
              </button>
            </div>
          </div>
        </footer>

      </div>
    );
  }

  // Highlights categorized by score based on dynamic threshold and fixed criteria
  const matchHighlights = selectedMatch.highlights || [];
  
  // Sort highlights descending by score
  const sortedHighlights = [...matchHighlights].sort((a, b) => b.finalScore - a.finalScore);

  // Filter based on selected interactive threshold
  const visibleHighlights = sortedHighlights.filter((h) => h.finalScore >= highlightThreshold);
  const excludedHighlights = sortedHighlights.filter((h) => h.finalScore < highlightThreshold);

  const activeStep: TacticalStep | undefined = selectedHighlight?.tacticalAnimation?.[currentStepIndex];

  // Colors for classifications
  const getClassificationBadge = (classification: string, size: "sm" | "md" = "sm") => {
    const isSm = size === "sm";
    switch (classification) {
      case "Elite":
        return (
          <span className={`inline-flex items-center gap-1 font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md ${isSm ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}`}>
            <Award className="w-3.5 h-3.5" /> ELITE HIGHLIGHT
          </span>
        );
      case "Premium":
        return (
          <span className={`inline-flex items-center gap-1 font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md ${isSm ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}`}>
            <Zap className="w-3.5 h-3.5" /> PREMIUM HIGHLIGHT
          </span>
        );
      case "Standard":
        return (
          <span className={`inline-flex items-center gap-1 font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md ${isSm ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}`}>
            <CheckCircle className="w-3.5 h-3.5" /> STANDARD HIGHLIGHT
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center gap-1 font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700/50 rounded-md ${isSm ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}`}>
            <XCircle className="w-3.5 h-3.5" /> EXCLUDED
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-white">
      
      {/* HEADER SECTION (Top Navigation & Match Stats Bar) */}
      <header className="border-b border-slate-800 bg-slate-900/50 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Main Title & Brand */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center bg-emerald-500 text-black p-1.5 rounded-md shadow-lg shadow-emerald-500/20">
              <Video className="w-5 h-5 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400">
                  Vision Pro AI
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                  AI POWERED
                </span>
              </div>
              <h1 className="text-base font-semibold leading-tight text-white font-sans">
                Match Highlight Engine v3.1
              </h1>
            </div>
          </div>

          {/* Quick Match Selector */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setUploadedVideoFile(null);
                setUploadedLogFile(null);
                setShowUploadPortalOverride(true);
              }}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-3 py-1.5 rounded-lg font-bold font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" /> + Upload Footage
            </button>

            <span className="text-xs font-mono text-slate-400">Match Profile:</span>
            <div className="relative inline-block">
              <select
                className="appearance-none bg-slate-900 text-slate-200 text-xs border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 font-medium cursor-pointer focus:outline-none focus:border-emerald-500 hover:bg-slate-800/80 transition-colors"
                value={selectedMatch.id}
                onChange={(e) => {
                  const found = matches.find((m) => m.id === e.target.value);
                  if (found) {
                    setSelectedMatch(found);
                    if (found.highlights && found.highlights.length > 0) {
                      setSelectedHighlight(found.highlights[0]);
                    } else {
                      setSelectedHighlight(null);
                    }
                  }
                }}
              >
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.teamA.name} {m.teamA.score} - {m.teamB.score} {m.teamB.name} ({m.competition})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

        </div>
      </header>

      {/* QUICK MATCH STATS BANNER */}
      <section className="bg-slate-900/30 border-b border-slate-800/60 py-3.5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 items-center justify-center text-center">
          <div className="col-span-2 lg:col-span-2 flex items-center justify-center gap-4 border-b md:border-b-0 md:border-r border-slate-800 pb-2 md:pb-0">
            <span className="text-lg">{selectedMatch.teamA.logo}</span>
            <div className="text-right">
              <span className="block text-xs text-slate-400 font-mono">Possession</span>
              <span className="text-base font-bold text-slate-100 font-mono">{selectedMatch.stats.possession[0]}% - {selectedMatch.stats.possession[1]}%</span>
            </div>
            <span className="text-lg">{selectedMatch.teamB.logo}</span>
          </div>

          <div className="border-r border-slate-800 hidden md:block">
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Expected Goals (xG)</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">{selectedMatch.stats.xG[0]} <span className="text-slate-600 font-normal">vs</span> {selectedMatch.stats.xG[1]}</span>
          </div>

          <div className="border-r border-slate-800">
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Shots</span>
            <span className="text-sm font-bold text-slate-200 font-mono">{selectedMatch.stats.shots[0]} <span className="text-slate-600 font-normal">vs</span> {selectedMatch.stats.shots[1]}</span>
          </div>

          <div className="border-r border-slate-800 hidden md:block">
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pass Acc.</span>
            <span className="text-sm font-bold text-slate-200 font-mono">{selectedMatch.stats.passCompletion[0]}% <span className="text-slate-600 font-normal">vs</span> {selectedMatch.stats.passCompletion[1]}%</span>
          </div>

          <div className="border-r border-slate-800">
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sprints Run</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {(selectedMatch.playerStats || []).reduce((acc, p) => acc + p.sprints, 0)}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center">
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Date</span>
            <span className="text-xs font-medium text-slate-300 font-mono">{selectedMatch.date}</span>
          </div>
        </div>
      </section>

      {/* MATCH MAIN TIMELINE SLIDER (Full 90-minute scrollbar) */}
      <section className="bg-slate-950 border-b border-slate-800/80 py-4 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" /> Match Interactive Timeline
            </span>
            <span className="text-[10px] font-mono text-slate-500">Click any indicator to inspect action</span>
          </div>
          
          <div className="relative w-full h-8 bg-slate-900 border border-slate-800 rounded-lg flex items-center px-4">
            {/* Timeline track line */}
            <div className="absolute left-4 right-4 h-[1px] bg-slate-800"></div>
            
            {/* Start and end match labels */}
            <span className="absolute left-2 -bottom-4 text-[9px] font-mono text-slate-500">00:00</span>
            <span className="absolute right-2 -bottom-4 text-[9px] font-mono text-slate-500">90:00</span>

            {/* Event Markers mapped to timeline */}
            {sortedHighlights.map((hl) => {
              // Parse timestamp "MM:SS" into percentage of 90 minutes
              const parts = hl.matchTime.split(":");
              const mins = parseInt(parts[0]) || 0;
              const percent = Math.min(100, Math.max(0, (mins / 90) * 100));
              
              const isSelected = selectedHighlight?.id === hl.id;
              const isPassed = hl.finalScore >= highlightThreshold;
              
              // Node color based on score
              let nodeColor = "bg-rose-500 shadow-rose-500/50";
              if (hl.finalScore >= 0.90) {
                nodeColor = "bg-amber-500 shadow-amber-500/50";
              } else if (hl.finalScore >= 0.85) {
                nodeColor = "bg-cyan-400 shadow-cyan-400/50";
              } else if (hl.finalScore >= 0.75) {
                nodeColor = "bg-emerald-400 shadow-emerald-400/50";
              }

              return (
                <button
                  key={hl.id}
                  onClick={() => setSelectedHighlight(hl)}
                  className={`absolute -translate-x-1/2 group z-10 transition-all duration-200`}
                  style={{ left: `calc(${percent}% * 0.92 + 4%)` }}
                >
                  {/* Glowing Node */}
                  <div
                    className={`rounded-full border transition-all ${
                      isSelected 
                        ? "w-4 h-4 ring-2 ring-white border-white scale-125" 
                        : "w-3 h-3 border-slate-900 hover:scale-125"
                    } ${nodeColor} shadow`}
                  ></div>

                  {/* Hover Tooltip */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-slate-200 text-[10px] py-1 px-2.5 rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-mono flex flex-col gap-0.5">
                    <span className="font-bold">{hl.matchTime} - {hl.title}</span>
                    <span className="text-slate-400">Score: <strong className="text-emerald-400">{hl.finalScore.toFixed(2)}</strong> ({hl.classification})</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* MAIN TWO-COLUMN DASHBOARD */}
      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Interactive Replay & Analytics (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* TAB HEADERS */}
          <div className="flex border-b border-slate-800 bg-slate-900/60 p-1 rounded-t-xl gap-1">
            <button
              onClick={() => setActiveTab("highlights")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold font-mono rounded-lg transition-all ${
                activeTab === "highlights"
                  ? "bg-slate-800 text-emerald-400 border border-slate-700/50"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Video className="w-4 h-4" /> Tactical Replay Board
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold font-mono rounded-lg transition-all ${
                activeTab === "analytics"
                  ? "bg-slate-800 text-emerald-400 border border-slate-700/50"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <BarChart2 className="w-4 h-4" /> Veo 3 Camera Analytics
            </button>
          </div>

          {/* TAB CONTENT 1: TACTICAL REPLAY BOARD */}
          {activeTab === "highlights" && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-400" /> VEO 3 TACTICAL REPLAY
                  </h3>
                  <p className="text-[11px] text-slate-400">Interactive 2D vector coordinates mapped in real-time</p>
                </div>
                
                {selectedHighlight && (
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800/80 px-2.5 py-1 rounded-md">
                    <span className="text-[10px] font-mono text-slate-400">Sequence Duration:</span>
                    <strong className="text-emerald-400 text-xs font-mono">{selectedHighlight.duration}s</strong>
                  </div>
                )}
              </div>

              {selectedHighlight ? (
                <>
                  {/* REAL-LIFE FOOTAGE & DESCRIPTION GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* VIDEO PLAYER */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                        <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live Footage Instant Replay
                        </span>
                        <span className="text-[9px] font-mono text-slate-500">Target Time: {selectedHighlight.matchTime}</span>
                      </div>
                      
                      {videoSrc ? (
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-slate-900">
                          <video
                            ref={videoRef}
                            src={videoSrc}
                            controls
                            className="w-full h-full object-contain"
                            onTimeUpdate={handleVideoTimeUpdate}
                          />
                          <div className="absolute top-2 left-2 bg-slate-950/95 border border-slate-800 px-2 py-0.5 rounded text-[8px] font-mono text-amber-400">
                            20s Clip Loop
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-video rounded-lg border border-dashed border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center text-center p-4">
                          <Video className="w-10 h-10 text-slate-700 mb-2 animate-pulse" />
                          <span className="text-xs text-slate-400 font-mono">Footage Offline</span>
                          <p className="text-[9px] text-slate-600 mt-1 max-w-[180px]">Upload mp4 video to loop live highlights side-by-side!</p>
                        </div>
                      )}
                      <span className="text-[9px] text-slate-500 font-mono text-center">
                        Loops clip ({Math.floor(getHighlightStartTime(selectedHighlight))}s - {Math.floor(getHighlightEndTime(selectedHighlight, getHighlightStartTime(selectedHighlight)))}s) to match telemetry.
                      </span>
                    </div>

                    {/* SCENE DESCRIPTION */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                        <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                          Scene Description & Analytics
                        </span>
                        <span className="text-[9px] font-mono bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          Score: {(selectedHighlight.finalScore * 100).toFixed(0)}/100
                        </span>
                      </div>

                      <div className="flex-grow flex flex-col gap-1.5">
                        <h4 className="text-xs font-bold font-mono text-slate-200">{selectedHighlight.title}</h4>
                        <p className="text-[10px] font-mono text-slate-400 leading-relaxed bg-slate-900/30 p-2.5 rounded-lg border border-slate-900/60 overflow-y-auto max-h-[110px]">
                          {selectedHighlight.explanation}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center font-mono text-[9px] pt-1.5 border-t border-slate-900">
                        <div className="bg-slate-900/40 border border-slate-900 p-1.5 rounded">
                          <span className="text-slate-500 block text-[8px] uppercase">Modifiers</span>
                          <strong className="text-emerald-400">+{selectedHighlight.bonuses.length || 0} Criteria</strong>
                        </div>
                        <div className="bg-slate-900/40 border border-slate-900 p-1.5 rounded">
                          <span className="text-slate-500 block text-[8px] uppercase">Tag</span>
                          <strong className="text-amber-400">{selectedHighlight.classification}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FOOTBALL 2D VECTOR PLAYBACK PITCH */}
                  <div className="relative w-full aspect-[100/64] bg-slate-950/90 rounded-lg border border-slate-800 overflow-hidden shadow-inner flex items-center justify-center">
                    
                    {/* Pitch Turf Markings */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                      {/* Center Circle */}
                      <div className="w-24 h-24 rounded-full border border-dashed border-slate-800"></div>
                      {/* Center Line */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-800"></div>
                      
                      {/* Left Penalty Box */}
                      <div className="absolute left-0 top-1/4 bottom-1/4 w-20 border border-slate-800"></div>
                      {/* Left Goal Area */}
                      <div className="absolute left-0 top-[38%] bottom-[38%] w-8 border border-slate-800"></div>
                      {/* Left Goalpost outer frame */}
                      <div className="absolute -left-[3px] top-[43%] bottom-[43%] w-[3px] border border-slate-700"></div>
                      
                      {/* Right Penalty Box */}
                      <div className="absolute right-0 top-1/4 bottom-1/4 w-20 border border-slate-800"></div>
                      {/* Right Goal Area */}
                      <div className="absolute right-0 top-[38%] bottom-[38%] w-8 border border-slate-800"></div>
                      {/* Right Goalpost outer frame */}
                      <div className="absolute -right-[3px] top-[43%] bottom-[43%] w-[3px] border border-slate-700"></div>
                    </div>

                    {/* RENDER CURRENT REPLAY STEP */}
                    {activeStep ? (
                      <>
                        {/* Heatmap overlay if selected */}
                        {selectedPlayerForHeatmap && (
                           <div className="absolute inset-0 pointer-events-none">
                             {/* Render matching player's heat coordinates */}
                             {selectedMatch.playerStats
                               .find((p) => p.name === selectedPlayerForHeatmap)
                               ?.heatmapData.map((pt, i) => (
                                 <div
                                   key={i}
                                   className="absolute rounded-full filter blur-xl animate-pulse"
                                   style={{
                                     left: `${pt.x}%`,
                                     top: `${pt.y}%`,
                                     width: `${pt.weight * 140}px`,
                                     height: `${pt.weight * 140}px`,
                                     transform: "translate(-50%, -50%)",
                                     background: "radial-gradient(circle, rgba(16,185,129,0.45) 0%, rgba(16,185,129,0) 70%)",
                                   }}
                                 ></div>
                               ))}
                           </div>
                        )}

                        {/* Press zones overlay if any */}
                        {selectedMatch.highPressZones.map((zone, idx) => (
                          <div
                            key={idx}
                            className="absolute rounded-full border border-dashed border-slate-800 animate-ping opacity-30"
                            style={{
                              left: `${zone.x}%`,
                              top: `${zone.y}%`,
                              width: `${zone.radius * 2}%`,
                              height: `${zone.radius * 2}%`,
                              transform: "translate(-50%, -50%)",
                              borderColor: zone.team === "A" ? "#3b82f6" : "#ef4444",
                            }}
                          ></div>
                        ))}

                        {/* Tactical Players Layer */}
                        {activeStep.players.map((player) => {
                          const isTeamA = player.team === "A";
                          const themeColor = isTeamA ? selectedMatch.teamA.color : selectedMatch.teamB.color;
                          const initials = player.name.split(" ").map(n => n[0]).join("");
                          
                          return (
                            <div
                              key={player.id}
                              className="absolute transition-all duration-1000 ease-in-out -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                              style={{ left: `${player.x}%`, top: `${player.y}%` }}
                            >
                              {/* Jersey Node */}
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-black text-white shadow-lg border-2 ${
                                  player.action ? "border-emerald-400 ring-4 ring-emerald-500/20 scale-110" : "border-white/50"
                                }`}
                                style={{ backgroundColor: themeColor }}
                              >
                                {initials}
                              </div>
                              {/* Player Name label */}
                              <span className="bg-slate-950/90 text-slate-200 text-[8px] font-mono font-medium px-1 py-0.5 rounded border border-slate-800 mt-1 shadow-md max-w-[80px] truncate">
                                {player.name}
                              </span>
                            </div>
                          );
                        })}

                        {/* Ball Layer */}
                        <div
                          className="absolute w-4 h-4 bg-yellow-400 border border-black rounded-full z-30 transition-all duration-700 ease-in-out -translate-x-1/2 -translate-y-1/2 shadow-lg flex items-center justify-center"
                          style={{ left: `${activeStep.ball.x}%`, top: `${activeStep.ball.y}%` }}
                        >
                          {/* Inner Soccer Swirl */}
                          <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                        </div>

                        {/* Replay action text watermark */}
                        <div className="absolute bottom-4 left-4 right-4 bg-slate-950/95 border border-slate-800 rounded-lg p-2.5 backdrop-blur-sm z-30 flex items-start gap-2.5">
                          <div className="p-1.5 bg-slate-800 rounded text-emerald-400">
                            <Cpu className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono block">Action Analytics Telemetry:</span>
                            <p className="text-xs font-mono text-slate-200 mt-0.5 leading-relaxed">
                              {activeStep.caption}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">Select a highlight to preview play</span>
                    )}

                  </div>

                  {/* VIDEO PLAYER CONTROL BAR */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    
                    {/* Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`p-2 rounded-lg text-slate-950 font-bold transition-all ${
                          isPlaying ? "bg-amber-400 hover:bg-amber-500 text-black" : "bg-emerald-500 hover:bg-emerald-400 text-black"
                        }`}
                        title={isPlaying ? "Pause Tactical Replay" : "Play Tactical Replay"}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => {
                          setIsPlaying(false);
                          setCurrentStepIndex(0);
                        }}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-all"
                        title="Reset Replay"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <div className="h-6 w-[1px] bg-slate-800 mx-1"></div>

                      <span className="text-[10px] font-mono text-slate-400">
                        Scene Progress:
                      </span>
                      
                      {/* Step Bubbles */}
                      <div className="flex gap-1.5">
                        {selectedHighlight.tacticalAnimation?.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setIsPlaying(false);
                              setCurrentStepIndex(idx);
                            }}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
                              currentStepIndex === idx
                                ? "bg-emerald-500 text-slate-950 font-bold"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Timeline Position */}
                    <div className="text-right flex items-center justify-end gap-2 text-[10px] font-mono text-slate-400">
                      <span>Match Timestamp:</span>
                      <strong className="text-slate-200 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-xs">
                        {selectedHighlight.matchTime}
                      </strong>
                    </div>

                  </div>

                  {/* SYNC VERIFICATION DASHBOARD */}
                  {(() => {
                    const hlOffset = syncOffsets[selectedHighlight.id] || 0;
                    const startClip = getHighlightStartTime(selectedHighlight);
                    const endClip = getHighlightEndTime(selectedHighlight, startClip);
                    const activeStepOffset = activeStep?.timeOffset ?? 0;
                    const expectedStepTime = startClip + activeStepOffset;
                    const syncDrift = videoCurrentTime - expectedStepTime;
                    const isOffline = !videoSrc;
                    
                    let driftStatus = "PERFECT SYNC";
                    let driftColor = "text-emerald-400";
                    let driftBg = "bg-emerald-500/10 border-emerald-500/20";
                    let driftDotColor = "bg-emerald-400";
                    
                    if (isOffline) {
                      driftStatus = "FOOTAGE OFFLINE";
                      driftColor = "text-slate-400";
                      driftBg = "bg-slate-900/40 border-slate-800";
                      driftDotColor = "bg-slate-500";
                    } else if (Math.abs(syncDrift) >= 1.5) {
                      driftStatus = "DRIFT DETECTED";
                      driftColor = "text-rose-400";
                      driftBg = "bg-rose-500/10 border-rose-500/20";
                      driftDotColor = "bg-rose-500 animate-pulse";
                    } else if (Math.abs(syncDrift) >= 0.3) {
                      driftStatus = "MINIMAL DRIFT";
                      driftColor = "text-amber-400";
                      driftBg = "bg-amber-500/10 border-amber-500/20";
                      driftDotColor = "bg-amber-400 animate-pulse";
                    }

                    return (
                      <div id="sync-verification-dashboard" className="mt-6 border border-slate-800 bg-slate-950/80 p-5 rounded-xl flex flex-col gap-5 shadow-2xl relative overflow-hidden backdrop-blur-sm">
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-emerald-500/20 via-emerald-400/80 to-emerald-500/20 animate-pulse"></div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
                              <Sliders className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold font-mono text-slate-100 uppercase tracking-wider">
                                Sync Verification Dashboard
                              </h4>
                              <p className="text-[10px] text-slate-400">
                                Calibrate 2D tactical animation nodes against raw video timestamps
                              </p>
                            </div>
                          </div>
                          
                          <div className={`px-2.5 py-1 rounded border text-[9px] font-mono font-bold flex items-center gap-1.5 ${driftBg} ${driftColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${driftDotColor}`}></span>
                            {driftStatus}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-slate-900/40 border border-slate-900 p-3.5 rounded-lg flex flex-col gap-2">
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-900 pb-1.5">
                              <span>📹 Video Playback Timer</span>
                              <span className="text-emerald-400">Live Stream</span>
                            </div>
                            <div className="flex items-baseline gap-2 py-1">
                              <span className="text-2xl font-mono font-bold text-slate-200 tracking-tight">
                                {isOffline ? "--" : `${videoCurrentTime.toFixed(2)}`}
                              </span>
                              <span className="text-xs font-mono text-slate-500">seconds</span>
                            </div>
                            <div className="text-[9px] font-mono text-slate-500 flex flex-col gap-0.5 mt-1">
                              <div className="flex justify-between">
                                <span>Clip Loop Start:</span>
                                <span className="text-slate-300">{startClip.toFixed(1)}s</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Clip Loop End:</span>
                                <span className="text-slate-300">{endClip.toFixed(1)}s</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-900/40 border border-slate-900 p-3.5 rounded-lg flex flex-col gap-2">
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-900 pb-1.5">
                              <span>🎯 Tactical Step Expected Time</span>
                              <span className="text-amber-400">Step {currentStepIndex + 1} of {(selectedHighlight.tacticalAnimation || []).length}</span>
                            </div>
                            <div className="flex items-baseline gap-2 py-1">
                              <span className="text-2xl font-mono font-bold text-slate-200 tracking-tight">
                                {expectedStepTime.toFixed(2)}
                              </span>
                              <span className="text-xs font-mono text-slate-500">seconds</span>
                            </div>
                            <div className="text-[9px] font-mono text-slate-500 flex flex-col gap-0.5 mt-1">
                              <div className="flex justify-between">
                                <span>Current Step Offset:</span>
                                <span className="text-slate-300">+{activeStepOffset.toFixed(1)}s</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Base Highlight Time:</span>
                                <span className="text-slate-300">
                                  {selectedHighlight.seconds !== undefined ? `${(selectedHighlight.seconds - 10).toFixed(1)}s` : `${startClip.toFixed(1)}s`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-900/30 border border-slate-900/60 p-3.5 rounded-lg flex flex-col gap-3">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-slate-400">Real-time Drift Margin:</span>
                            {isOffline ? (
                              <span className="text-slate-500">Unavailable (Footage Offline)</span>
                            ) : (
                              <span className={`font-bold ${driftColor}`}>
                                {syncDrift > 0 ? "+" : ""}{syncDrift.toFixed(2)}s {syncDrift > 0 ? "ahead" : "behind"}
                              </span>
                            )}
                          </div>

                          <div className="relative w-full h-2 bg-slate-950 rounded-full border border-slate-900 overflow-visible flex items-center justify-center">
                            <div className="absolute left-1/2 -translate-x-1/2 w-[2px] h-4 bg-emerald-500/50 z-10" title="Perfect Sync Target"></div>
                            
                            <div className="absolute left-1 w-2 h-2 rounded-full bg-slate-800"></div>
                            <div className="absolute right-1 w-2 h-2 rounded-full bg-slate-800"></div>

                            {!isOffline && (
                              <div 
                                className={`absolute w-3 h-3 rounded-full border-2 border-slate-950 shadow-md -translate-x-1/2 transition-all duration-300 ease-out z-20 ${
                                  Math.abs(syncDrift) < 0.3 ? "bg-emerald-400" : Math.abs(syncDrift) < 1.5 ? "bg-amber-400" : "bg-rose-500"
                                }`}
                                style={{ 
                                  left: `${Math.min(95, Math.max(5, 50 + (syncDrift / 3.0) * 50))}%` 
                                }}
                                title={`Current Drift: ${syncDrift.toFixed(2)}s`}
                              >
                                <div className="absolute -inset-1.5 border border-white/10 rounded-full animate-ping opacity-30"></div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex justify-between text-[8px] font-mono text-slate-500">
                            <span>-3.0s (Behind)</span>
                            <span>0.0s (In Sync)</span>
                            <span>+3.0s (Ahead)</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3.5 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-slate-300">
                              One-Click Manual Offset Adjustment:
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Current Clip Offset: <strong className="text-emerald-400">{hlOffset > 0 ? "+" : ""}{hlOffset.toFixed(1)}s</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            <button
                              onClick={() => adjustSyncOffset(-2.0)}
                              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-all"
                              title="Shifts video 2s backward"
                            >
                              -2.0s
                            </button>
                            <button
                              onClick={() => adjustSyncOffset(-1.0)}
                              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-all"
                              title="Shifts video 1s backward"
                            >
                              -1.0s
                            </button>
                            <button
                              onClick={() => adjustSyncOffset(-0.5)}
                              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-all"
                              title="Shifts video 0.5s backward"
                            >
                              -0.5s
                            </button>
                            <button
                              onClick={() => adjustSyncOffset(-0.1)}
                              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-all"
                              title="Shifts video 0.1s backward"
                            >
                              -0.1s
                            </button>
                            
                            <button
                              onClick={() => adjustSyncOffset(0.1)}
                              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-all"
                              title="Shifts video 0.1s forward"
                            >
                              +0.1s
                            </button>
                            <button
                              onClick={() => adjustSyncOffset(0.5)}
                              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-all"
                              title="Shifts video 0.5s forward"
                            >
                              +0.5s
                            </button>
                            <button
                              onClick={() => adjustSyncOffset(1.0)}
                              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-all"
                              title="Shifts video 1s forward"
                            >
                              +1.0s
                            </button>
                            <button
                              onClick={() => adjustSyncOffset(2.0)}
                              className="px-2 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-all"
                              title="Shifts video 2s forward"
                            >
                              +2.0s
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-900">
                            <button
                              onClick={resetSyncOffset}
                              disabled={hlOffset === 0}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono border transition-all ${
                                hlOffset === 0 
                                  ? "bg-transparent border-slate-900 text-slate-600 cursor-not-allowed" 
                                  : "bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300 hover:text-white"
                              }`}
                            >
                              <RotateCcw className="w-3 h-3" /> Reset Current Clip Offset
                            </button>

                            <button
                              onClick={applyOffsetToAllMatchHighlights}
                              disabled={hlOffset === 0 || (selectedMatch.highlights || []).length <= 1}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono border transition-all ${
                                hlOffset === 0 
                                  ? "bg-transparent border-slate-900 text-slate-600 cursor-not-allowed" 
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400 hover:text-emerald-300"
                              }`}
                              title="Copies current offset to every highlight sequence in the match"
                            >
                              <RefreshCw className="w-3 h-3" /> Apply Globally to Match
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
                  <Video className="w-12 h-12 mb-3 text-slate-700" />
                  <p className="text-xs font-mono">No highlight selected or detected.</p>
                </div>
              )}

            </div>
          )}

          {/* TAB CONTENT 2: VEO 3 CAMERA ANALYTICS */}
          {activeTab === "analytics" && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-6">
              
              <div>
                <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> VEO 3 TEAM & PLAYER TELEMETRY
                </h3>
                <p className="text-[11px] text-slate-400">Interactive squad heatmaps, speed diagnostics, and pass link networks</p>
              </div>

              {/* Grid split: Squad List (Heatmaper) & Tactical Analytics Canvas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Squad Tracker */}
                <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-4 flex flex-col gap-3">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block border-b border-slate-800 pb-1.5">
                    Select Player to Plot Heatmap Overlay
                  </span>

                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[250px] pr-1">
                    {(selectedMatch.playerStats || []).map((player) => (
                      <button
                        key={player.name}
                        onClick={() => {
                          setSelectedPlayerForHeatmap(
                            selectedPlayerForHeatmap === player.name ? null : player.name
                          );
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg text-left transition-all border ${
                          selectedPlayerForHeatmap === player.name
                            ? "bg-slate-800 border-emerald-500 text-emerald-400"
                            : "bg-slate-950 border-transparent hover:border-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono bg-slate-800 text-slate-300 w-5 h-5 rounded-full flex items-center justify-center border border-slate-700">
                            {player.jersey}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-200 block">{player.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{player.position} • {player.team}</span>
                          </div>
                        </div>

                        <div className="text-right text-[10px] font-mono">
                          <span className="text-slate-500 block">Top Speed</span>
                          <strong className="text-slate-200">{player.topSpeed} km/h</strong>
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedPlayerForHeatmap && (
                    <div className="bg-emerald-950/25 border border-emerald-800/40 rounded p-2 text-[10px] font-mono text-slate-300 flex items-start gap-1.5">
                      <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Overlaying <strong>{selectedPlayerForHeatmap}</strong>'s positioning density. Click tab above to switch back to the Replay Board to view!
                      </span>
                    </div>
                  )}
                </div>

                {/* Team Pass Network */}
                <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-4 flex flex-col gap-3">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block border-b border-slate-800 pb-1.5">
                    Interactive Passing Grid Map
                  </span>

                  {/* Minified 2D Pitch displaying Pass Links */}
                  <div className="relative w-full aspect-[100/68] bg-slate-950 rounded border border-slate-800 overflow-hidden">
                    
                    {/* Pass Lines */}
                    {selectedMatch.passNetwork?.links.map((link, idx) => {
                      const fromPlayer = selectedMatch.passNetwork.players.find(p => p.name === link.from);
                      const toPlayer = selectedMatch.passNetwork.players.find(p => p.name === link.to);
                      
                      if (!fromPlayer || !toPlayer) return null;

                      // Calculate midpoint for thickness and label
                      const x1 = fromPlayer.x;
                      const y1 = fromPlayer.y;
                      const x2 = toPlayer.x;
                      const y2 = toPlayer.y;

                      return (
                        <svg key={idx} className="absolute inset-0 w-full h-full pointer-events-none">
                          <line
                            x1={`${x1}%`}
                            y1={`${y1}%`}
                            x2={`${x2}%`}
                            y2={`${y2}%`}
                            stroke="#10b981"
                            strokeWidth={Math.min(4, link.count / 5)}
                            strokeOpacity="0.6"
                          />
                        </svg>
                      );
                    })}

                    {/* Nodes representing pass players */}
                    {selectedMatch.passNetwork?.players.map((node, idx) => (
                      <div
                        key={idx}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
                        style={{ left: `${node.x}%`, top: `${node.y}%` }}
                      >
                        <div className="w-5 h-5 rounded-full bg-black border border-emerald-500 text-[9px] flex items-center justify-center text-white font-mono shadow-md">
                          {node.avatar}
                        </div>
                        <span className="bg-slate-900/90 text-slate-200 text-[7px] font-mono px-1 rounded border border-slate-800 mt-0.5 whitespace-nowrap opacity-80">
                          {node.name.split(" ").pop()}
                        </span>
                      </div>
                    ))}

                  </div>

                  <span className="text-[9px] text-slate-400 font-mono block leading-relaxed text-center">
                    Thickness indicates frequency of passes between coordinates. Glowing nodes pinpoint core spatial hubs.
                  </span>
                </div>

              </div>

              {/* Sprints Speed Tracker Diagnostics Charts */}
              <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-4 flex flex-col gap-4">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block border-b border-slate-800 pb-1.5">
                  Squad Speed & Sprints Tracker Data
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(selectedMatch.playerStats || []).map((player) => {
                    const topSpeedPercentage = Math.min(100, (player.topSpeed / 40) * 100);
                    return (
                      <div key={player.name} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-200 block">{player.name}</span>
                          <span className="text-[9px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                            {player.position}
                          </span>
                        </div>

                        <div className="flex justify-between items-end text-[10px] font-mono text-slate-400 mt-1">
                          <span>Sprints: <strong>{player.sprints}</strong></span>
                          <span>Dist: <strong>{player.distanceCovered} km</strong></span>
                        </div>

                        <div className="flex justify-between items-end text-[10px] font-mono text-slate-400">
                          <span>Passes: <strong className="text-slate-200">{player.successfulPasses ?? 0} ({player.passAccuracy}%)</strong></span>
                          <span>Tackles: <strong className="text-slate-200">{player.tackles ?? 0}</strong></span>
                        </div>

                        {/* Speed Progress Bar */}
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex justify-between text-[8px] font-mono text-slate-500">
                            <span>Top Velocity</span>
                            <span className="text-emerald-400 font-bold">{player.topSpeed} km/h</span>
                          </div>
                          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full" style={{ width: `${topSpeedPercentage}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* AI MATCH ANALYZER SANDBOX DRAWER */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> GEMINI DYNAMIC ANALYZER
                </h3>
                <p className="text-[11px] text-slate-400">Paste custom match text or commentary to compute Highlight scores</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 bg-slate-900/80 p-4 rounded-lg border border-slate-800">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Title */}
                <div className="flex-1">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    Fixture Title (Home vs Away)
                  </label>
                  <input
                    type="text"
                    value={aiMatchTitle}
                    onChange={(e) => setAiMatchTitle(e.target.value)}
                    className="w-full bg-slate-950 text-slate-100 text-xs border border-slate-800 rounded p-2 font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Chelsea vs Liverpool"
                  />
                </div>

              </div>

              {/* Commentary input */}
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Play-by-play Commentary narrative
                </label>
                <textarea
                  value={aiCommentary}
                  onChange={(e) => setAiCommentary(e.target.value)}
                  className="w-full bg-slate-950 text-slate-100 text-xs border border-slate-800 rounded p-3 font-mono focus:outline-none focus:border-emerald-500 h-[150px] leading-relaxed resize-none"
                  placeholder="Paste your match commentary log here..."
                />
              </div>

              {/* Action and notifications */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-slate-800 pt-3.5 mt-2">
                <span className="text-[9px] text-slate-400 font-mono leading-relaxed max-w-[400px]">
                  *The server parses this content using <strong>gemini-3.5-flash</strong>, computes highlight scores, extracts Veo coordinates, and updates the timeline instantly.
                </span>
                
                <button
                  onClick={handleAnalyzeMatch}
                  disabled={isAnalyzing}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-bold font-mono text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> ANALYZING TRANSLATION...
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4" /> COMPUTE HIGHLIGHTS
                    </>
                  )}
                </button>
              </div>

              {/* Feedback messages */}
              {errorMessage && (
                <div className="bg-rose-900/20 border border-rose-500/30 text-rose-300 rounded p-3 text-[11px] font-mono flex items-start gap-2">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <span className="font-bold">Heuristic Safe Fallback Triggered:</span>
                    <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              )}

              {successMessage && (
                <div className="bg-emerald-900/20 border border-emerald-500/30 text-emerald-300 rounded p-3 text-[11px] font-mono flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <span className="font-bold">Analysis Success:</span>
                    <p className="mt-0.5 leading-relaxed">{successMessage}</p>
                  </div>
                </div>
              )}

            </div>

          </div>

        </section>

        {/* RIGHT COLUMN: Highlight Selection & Score Formulas (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* INTERACTIVE SCORE THRESHOLD FILTER */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5">
                <ListFilter className="w-4 h-4 text-emerald-400" /> HIGHLIGHT SELECTION FILTER
              </span>
              <span className="bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded">
                Score &gt;= {highlightThreshold.toFixed(2)}
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
              Adjust the threshold to instantly exclude/include scenes from the highlight reel according to Step 5 rules.
            </p>

            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] font-mono text-slate-500">0.00</span>
              <input
                type="range"
                min="0.00"
                max="1.00"
                step="0.05"
                value={highlightThreshold}
                onChange={(e) => setHighlightThreshold(parseFloat(e.target.value))}
                className="flex-1 accent-emerald-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] font-mono text-slate-500">1.00</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-mono mt-1">
              <div className="bg-slate-950/60 border border-slate-800 p-1.5 rounded">
                <span className="block text-amber-400 font-bold">Elite</span>
                <span>0.90 – 1.00</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 p-1.5 rounded">
                <span className="block text-cyan-400 font-bold">Premium</span>
                <span>0.85 – 0.89</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 p-1.5 rounded">
                <span className="block text-emerald-400 font-bold">Standard</span>
                <span>0.75 – 0.84</span>
              </div>
            </div>
          </div>

          {/* ACTIVE HIGHLIGHT PLAYLISTS & SCENE LISTS */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" /> SELECTED HIGHLIGHT REEL
                </h3>
                <p className="text-[11px] text-slate-400">Scenes exceeding the score threshold, sorted descending</p>
              </div>
              <span className="text-[10px] font-mono bg-slate-800 text-emerald-400 border border-slate-700 px-2 py-0.5 rounded-full">
                {visibleHighlights.length} Clips
              </span>
            </div>

            {/* List of valid Highlights */}
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-1">
              {visibleHighlights.map((hl) => {
                const isSelected = selectedHighlight?.id === hl.id;
                
                return (
                  <button
                    key={hl.id}
                    onClick={() => setSelectedHighlight(hl)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-slate-800 border-emerald-500 ring-1 ring-emerald-500"
                        : "bg-slate-950 border-slate-800 hover:border-slate-700 hover:scale-[1.01]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {hl.matchTime}
                        </span>
                        <h4 className="text-xs font-bold text-slate-100 leading-snug">{hl.title}</h4>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-slate-100 font-mono">
                          {hl.finalScore.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed font-mono">
                      {hl.explanation}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {hl.bonuses.length > 0 && (
                        <span className="text-[8px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 rounded">
                          +{hl.bonuses.length} Bonus Modifiers
                        </span>
                      )}
                      {getClassificationBadge(hl.classification)}
                    </div>
                  </button>
                );
              })}

              {visibleHighlights.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-lg">
                  No match highlights qualify for the active threshold score of {highlightThreshold.toFixed(2)}.
                </div>
              )}
            </div>

            {/* AUDIT ZONE: EXCLUDED SCENES (Exposing the filtered list) */}
            {excludedHighlights.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> Excluded Scenes Audit Checklist
                  </span>
                  <span className="text-[9px] font-mono bg-rose-900/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.2 rounded-full">
                    {excludedHighlights.length} Filtered Out
                  </span>
                </div>
                
                <p className="text-[9px] text-slate-400 leading-relaxed font-mono mb-2">
                  These play sequences failed to exceed the defined threshold of {highlightThreshold.toFixed(2)} and were excluded from the final broadcast reel.
                </p>

                <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                  {excludedHighlights.map((hl) => (
                    <div
                      key={hl.id}
                      onClick={() => setSelectedHighlight(hl)}
                      className="p-2.5 bg-slate-950 border border-rose-950/40 rounded-lg text-left hover:border-rose-900/60 transition-all cursor-pointer"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-slate-400 font-bold">{hl.matchTime} - {hl.title}</span>
                        <strong className="text-rose-400 text-xs font-mono">{hl.finalScore.toFixed(2)}</strong>
                      </div>
                      <p className="text-[9px] text-slate-500 font-mono mt-1 leading-snug line-clamp-1">
                        Reason: Fail criteria of threshold. {hl.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>



        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-6 text-center text-xs font-mono text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span>© 2026 Veo-3 Intelligent Football Highlighter. All telemetry mapped.</span>
          <div className="flex gap-4">
            <span className="text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Powered by Gemini 3.5 Flash
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
