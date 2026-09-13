"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { VoiceIntent, VoiceJob } from "@/types";
import { toast } from "sonner";

type Phase = "idle" | "listening" | "parsing" | "confirm" | "creating" | "running" | "done" | "failed";

const STAGE_LABELS: Record<string, string> = {
  checking: "Checking AI planner",
  browsing: "Opening website",
  "search-input": "Finding the search box",
  searching: "Testing a search",
  extracting: "Extracting sample results",
  verified: "Verifying data",
  saving: "Saving workflow & creating API",
  done: "Complete",
};

export default function VoicePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [intent, setIntent] = useState<VoiceIntent | null>(null);
  const [job, setJob] = useState<VoiceJob | null>(null);
  const [error, setError] = useState("");
  const [micSupported, setMicSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    const w = window as any;
    const supported = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
    setMicSupported(supported);
    return () => {
      stopPolling();
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, [stopPolling]);

  const recognitionRetriesRef = useRef(0);

  const startRecognizer = () => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setMicSupported(false);
      setError("Voice input isn't supported in this browser. Type your command below instead.");
      return;
    }

    setError("");
    setPhase("listening");

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      transcriptRef.current = text.trim();
      setTranscript(text.trim());
    };

    recognition.onerror = (e: any) => {
      const err = e.error;
      if (err === "aborted") return; // user toggled off / cleanup, not an error
      if ((err === "network" || err === "no-speech") && recognitionRetriesRef.current < 2) {
        recognitionRetriesRef.current++;
        try { recognition.abort(); } catch {}
        setTimeout(startRecognizer, 1200);
        return;
      }
      recognitionRetriesRef.current = 0;
      setPhase("idle");
      setError(
        err === "not-allowed" || err === "service-not-allowed"
          ? "Microphone access was denied. Allow mic access or type your command below."
          : err === "network"
          ? "Voice recognition error: network — Chrome couldn't reach Google's speech service. Check your internet, try again (some browsers like Brave block it), or type your command below."
          : `Voice recognition error: ${err}`
      );
    };

    recognition.onend = () => {
      recognitionRetriesRef.current = 0;
      setPhase("idle");
      const heard = transcriptRef.current;
      if (heard) parseCommand(heard);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const startListening = () => {
    if (phase === "listening") {
      // Toggle off: stop recording and parse whatever was heard
      recognitionRef.current?.stop();
      return;
    }
    recognitionRetriesRef.current = 0;
    setTranscript("");
    startRecognizer();
  };

  const parseCommand = async (text: string) => {
    const cmd = (text || transcript).trim();
    if (!cmd) { toast.error("Say or type a command first"); return; }
    setPhase("parsing");
    setError("");
    try {
      const res = await api.voice.parse(cmd);
      setIntent(res.intent);
      setPhase("confirm");
    } catch (err: any) {
      setPhase("idle");
      setError(err.message || "Could not understand that command");
    }
  };

  const createApi = async () => {
    if (!intent) return;
    setPhase("creating");
    setError("");
    try {
      const res = await api.voice.create(transcript.trim(), intent);
      setJob(res.job);
      setPhase("running");
      startPolling(res.job.id);
    } catch (err: any) {
      setPhase("confirm");
      setError(err.message || "Failed to start API creation");
    }
  };

  const startPolling = (jobId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.voice.job(jobId);
        setJob(res.job);
        if (res.job.status === "SUCCEEDED") {
          stopPolling();
          setPhase("done");
          toast.success("API created!");
        } else if (res.job.status === "FAILED") {
          stopPolling();
          setPhase("failed");
          setError(res.job.error || "API creation failed");
        }
      } catch {
        // keep polling
      }
    }, 2500);
  };

  const reset = () => {
    stopPolling();
    setPhase("idle");
    setTranscript("");
    setIntent(null);
    setJob(null);
    setError("");
  };

  const updateIntent = (patch: Partial<VoiceIntent>) => {
    setIntent((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const logs = Array.isArray(job?.logs) ? job.logs! : [];

  return (
    <div className="animate-fade-in max-w-3xl">
      <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">Create API by Voice</h1>
      <p className="text-[#64748b] text-sm mb-8">
        Say something like &quot;make a search api for walton.com.bd&quot; and Shamsu will figure out the steps itself.
      </p>

      <div className="card-neon p-6 mb-6">
        <div className="flex items-center gap-6">
          <button
            onClick={startListening}
            disabled={phase === "parsing" || phase === "creating" || phase === "running"}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all border ${
              phase === "listening"
                ? "bg-[rgba(255,51,102,0.15)] border-[#ff3366] text-[#ff3366] animate-pulse-neon"
                : "gradient-neon text-[#0a0a0f] hover:opacity-90 disabled:opacity-40"
            }`}
            title={phase === "listening" ? "Stop recording" : "Click and speak your command"}
          >
            {phase === "listening" ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
          <div className="flex-1">
            <div className="text-sm font-medium text-[#e2e8f0] mb-1">
              {phase === "listening" ? "Listening... click the mic again to stop" : "Press the mic and describe the API you want"}
            </div>
            {!micSupported && (
              <p className="text-xs text-[#ffaa00] mb-2">Voice input unsupported in this browser — type below instead.</p>
            )}
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={phase === "creating" || phase === "running"}
              rows={2}
              placeholder={micSupported ? "e.g. make a search api for walton.com.bd" : "Type your command here"}
              className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] focus:outline-none focus:border-[#00d4ff] transition-all resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => parseCommand(transcript)}
            disabled={!transcript.trim() || phase === "parsing" || phase === "creating" || phase === "running"}
            className="px-5 py-2.5 rounded-lg gradient-neon text-[#0a0a0f] font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-40"
          >
            {phase === "parsing" ? "Understanding..." : "Parse Command"}
          </button>
          {(phase === "confirm" || phase === "failed" || phase === "done") && (
            <button onClick={reset} className="text-sm text-[#64748b] hover:text-[#00d4ff] transition-colors">
              ← Start over
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg border border-[rgba(255,51,102,0.3)] bg-[rgba(255,51,102,0.08)] text-[#ff3366] text-sm">
            {error}
          </div>
        )}
      </div>

      {intent && phase === "confirm" && (
        <div className="card-neon p-6 mb-6 border-[rgba(0,255,136,0.3)] glow-green">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#00ff88]">I understood: create this API?</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-[rgba(0,255,136,0.1)] text-[#00ff88]">Confirm</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#64748b] uppercase tracking-wide mb-1">API name</label>
              <input
                value={intent.apiName}
                onChange={(e) => updateIntent({ apiName: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] text-sm focus:outline-none focus:border-[#00d4ff]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#64748b] uppercase tracking-wide mb-1">Target site</label>
              <input
                value={intent.targetUrl}
                onChange={(e) => updateIntent({ targetUrl: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#00d4ff] text-sm focus:outline-none focus:border-[#00d4ff]"
              />
            </div>
          </div>

          <div className="space-y-4 mb-5">
            {intent.variables.length > 0 && (
              <div>
                <div className="text-xs text-[#64748b] uppercase tracking-wide mb-1">Variable</div>
                <div className="flex gap-3">
                  {intent.variables.map((v, i) => (
                    <div key={i} className="flex-1 flex gap-2">
                      <input
                        value={v.name}
                        onChange={(e) => {
                          const vars = [...intent.variables];
                          vars[i] = { ...v, name: e.target.value };
                          updateIntent({ variables: vars });
                        }}
                        className="flex-1 px-3 py-2 bg-[#0a0a0f] border border-[rgba(124,58,237,0.3)] rounded-lg text-[#7c3aed] text-sm focus:outline-none"
                        placeholder="variable name"
                      />
                      <input
                        value={v.example}
                        onChange={(e) => {
                          const vars = [...intent.variables];
                          vars[i] = { ...v, example: e.target.value };
                          updateIntent({ variables: vars });
                        }}
                        className="flex-1 px-3 py-2 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] text-sm focus:outline-none"
                        placeholder="test value"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {intent.extractionTargets.length > 0 && (
              <div>
                <div className="text-xs text-[#64748b] uppercase tracking-wide mb-1">Extracts</div>
                <div className="flex flex-wrap gap-2">
                  {intent.extractionTargets.map((t, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-lg bg-[rgba(0,212,255,0.08)] border border-[rgba(0,212,255,0.15)] text-[#00d4ff] text-sm">
                      {t.name} <span className="text-[#64748b]">· {t.kind}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-[#64748b] mb-4">
            {intent.description} A browser will open and run the flow once — it usually takes a minute or two.
          </p>

          <button
            onClick={createApi}
            className="px-6 py-3 rounded-lg gradient-neon text-[#0a0a0f] font-bold text-sm hover:opacity-90 transition-all"
          >
            ✓ Create API
          </button>
        </div>
      )}

      {(phase === "creating" || phase === "running") && job && (
        <div className="card-neon p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full border-2 border-[#00d4ff] border-t-transparent animate-spin"></div>
            <div>
              <h2 className="text-lg font-semibold text-[#e2e8f0]">Building your API</h2>
              <p className="text-sm text-[#64748b]">{STAGE_LABELS[job.stage] || job.stage}...</p>
            </div>
          </div>
          <div className="space-y-2">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#00d4ff] shrink-0"></span>
                <span className="text-[#e2e8f0]">{log.message}</span>
                <span className="ml-auto text-xs text-[#64748b] shrink-0">
                  {new Date(log.at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && job && (
        <div className="card-neon p-6 border-[rgba(0,255,136,0.3)] glow-green">
          <h2 className="text-lg font-semibold text-[#00ff88] mb-2">API created!</h2>
          {job.sampleJson && (
            <div className="mb-4 p-4 rounded-lg bg-[rgba(0,255,136,0.05)] border border-[rgba(0,255,136,0.15)]">
              <p className="text-sm text-[#e2e8f0] mb-2">Verified sample: <span className="text-[#00ff88] font-semibold">{job.sampleJson.totalResults} result(s)</span></p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(job.sampleJson).filter(([k]) => k !== "totalResults").map(([k, v]: any) => (
                  <span key={k} className="text-xs px-2 py-1 rounded bg-[rgba(0,212,255,0.08)] text-[#00d4ff]">
                    {k}: {v.count} found
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            {job.apiId && (
              <button
                onClick={() => router.push(`/dashboard/apis/${job.apiId}`)}
                className="px-6 py-3 rounded-lg gradient-neon text-[#0a0a0f] font-bold text-sm hover:opacity-90 transition-all"
              >
                View & Execute API →
              </button>
            )}
            <button onClick={reset} className="px-6 py-3 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#94a3b8] text-sm hover:border-[rgba(0,212,255,0.3)] transition-all">
              Create another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
