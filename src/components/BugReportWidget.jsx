import { useEffect, useRef, useState } from "react";
import { usePostHog } from "@posthog/react";
import { track, trackException } from "../analytics/track";

/**
 * Bug report widget — screen + voice recording.
 *
 * Drop-in usage — render once near the root of the app (e.g. in App.jsx or
 * your root layout) so it shows on every page:
 *
 *   <BugReportWidget domain="opsflow" submitUrl="/bug-reports/submit/" />
 *
 * Props:
 *   domain      required — which app this is (e.g. "opsflow", "phala")
 *   submitUrl   optional — defaults to "/bug-reports/submit/"
 *   maxSeconds  optional — auto-stop after this many seconds (default 300)
 *
 * Assumes the user is already logged into the same Django session the API
 * lives on (cookies sent via credentials: "same-origin"). If your API is on
 * a different origin than the Vite app, change credentials to "include" and
 * make sure CORS + SameSite cookie settings allow it.
 */
export default function BugReportWidget({
  domain,
  submitUrl = "/bug-reports/submit/",
  maxSeconds = 300,
}) {
  const posthog = usePostHog();
  const [phase, setPhase] = useState("idle"); // idle | recording | reviewing | sending
  const [toast, setToast] = useState("");
  const [note, setNote] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const screenStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const blobRef = useRef(null);
  const timerRef = useRef(null);
  const videoRef = useRef(null);

  const supported =
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getDisplayMedia;

  useEffect(() => {
    return () => {
      cleanupStreams();
      clearTimeout(timerRef.current);
    };
     
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (phase === "reviewing" && videoRef.current && blobRef.current) {
      videoRef.current.src = URL.createObjectURL(blobRef.current);
    }
  }, [phase]);

  if (!supported) return null; // unsupported browser — stay out of the way

  function getCookie(name) {
    const match = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return match ? decodeURIComponent(match.pop()) : "";
  }

  function pickMimeType() {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    return candidates.find((c) => window.MediaRecorder?.isTypeSupported(c)) || "video/webm";
  }

  function cleanupStreams() {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    micStreamRef.current = null;
  }

  async function startRecording() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      screenStreamRef.current = screenStream;
      micStreamRef.current = micStream;

      const combined = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...micStream.getAudioTracks(),
      ]);

      chunksRef.current = [];
      const recorder = new MediaRecorder(combined, { mimeType: pickMimeType() });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: pickMimeType() });
        setPhase("reviewing");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();

      screenStream.getVideoTracks()[0].addEventListener("ended", stopRecording);

      setPhase("recording");
      timerRef.current = setTimeout(() => {
        setToast(`Recording stopped automatically after ${Math.round(maxSeconds / 60)} min.`);
        stopRecording();
      }, maxSeconds * 1000);
    } catch (err) {
      if (err?.name === "NotAllowedError") {
        setToast("We need screen & microphone permission to record a bug report.");
      } else {
        setToast("Couldn't start recording. Please try again.");
      }
      cleanupStreams();
    }
  }

  function stopRecording() {
    clearTimeout(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupStreams();
  }

  function discard() {
    blobRef.current = null;
    setNote("");
    setPhase("idle");
  }

  async function submit() {
    setPhase("sending");
    const formData = new FormData();
    formData.append("domain", domain);
    formData.append("page_url", window.location.href);
    formData.append("description", note.trim());
    formData.append("browser_info", navigator.userAgent);
    formData.append("recording", blobRef.current, "recording.webm");

    // This app authenticates with a DRF token in localStorage (same key
    // client.js uses), not a Django session — send it if present. Falls
    // back to the original cookie/CSRF approach for other apps using
    // this same widget that don't set this key.
    const token = window.localStorage.getItem("ca_token");
    const headers = token ? { Authorization: `Token ${token}` } : { "X-CSRFToken": getCookie("csrftoken") };

    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: formData,
      });
      if (!res.ok) throw new Error("submit failed");
      track(posthog, "bug_report_submitted", {
        report_domain: domain,
        note_provided: Boolean(note.trim()),
        recording_size_bytes: blobRef.current?.size,
      });
      blobRef.current = null;
      setNote("");
      setPhase("idle");
      setToast("Thanks — we've got it.");
    } catch (error) {
      trackException(posthog, error);
      track(posthog, "bug_report_submit_failed", { report_domain: domain });
      setPhase("reviewing");
      setToast("Couldn't send that. Check your connection and try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={phase === "recording" ? stopRecording : startRecording}
        disabled={phase === "reviewing" || phase === "sending"}
        style={styles.button(phase === "recording")}
      >
        {phase === "recording" ? (
          <>
            <span style={styles.dot} /> Stop recording
          </>
        ) : (
          "🐞 Report a bug"
        )}
      </button>

      {(phase === "reviewing" || phase === "sending") && (
        <div style={styles.panel}>
          <h4 style={styles.heading}>Review your recording</h4>
          <p style={styles.hint}>Add a quick note if it&apos;s useful, then send it.</p>
          <video ref={videoRef} controls style={styles.video} />
          <textarea
            rows={2}
            maxLength={500}
            placeholder="What went wrong? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={styles.textarea}
            disabled={phase === "sending"}
          />
          <div style={styles.actions}>
            <button
              type="button"
              onClick={discard}
              disabled={phase === "sending"}
              style={styles.actionButton(false)}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={phase === "sending"}
              style={styles.actionButton(true)}
            >
              {phase === "sending" ? "Sending…" : "Send report"}
            </button>
          </div>
        </div>
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </>
  );
}

const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const styles = {
  button: (recording) => ({
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 2147483000,
    font: `500 13px/1 ${fontStack}`,
    padding: "10px 16px",
    borderRadius: 20,
    border: `1px solid ${recording ? "#f3b4ae" : "#dcdcdc"}`,
    background: recording ? "#fdecea" : "#fff",
    color: recording ? "#b3261e" : "#1c1c1c",
    boxShadow: "0 1px 4px rgba(0,0,0,.12)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#b3261e",
  },
  panel: {
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 2147483000,
    width: 320,
    maxWidth: "calc(100vw - 40px)",
    background: "#fff",
    border: "1px solid #e2e2e2",
    borderRadius: 12,
    boxShadow: "0 4px 20px rgba(0,0,0,.15)",
    font: `13px/1.5 ${fontStack}`,
    color: "#1c1c1c",
    overflow: "hidden",
  },
  heading: { margin: 0, padding: "14px 16px 0", fontSize: 14, fontWeight: 600 },
  hint: { margin: "4px 16px 12px", color: "#6b6b6b", fontSize: 12 },
  video: { width: "100%", display: "block", background: "#000", maxHeight: 180 },
  textarea: {
    width: "calc(100% - 32px)",
    margin: "12px 16px 0",
    padding: "8px 10px",
    border: "1px solid #dcdcdc",
    borderRadius: 8,
    font: "inherit",
    resize: "none",
    boxSizing: "border-box",
  },
  actions: { display: "flex", gap: 8, padding: "14px 16px" },
  actionButton: (primary) => ({
    flex: 1,
    padding: "8px 0",
    borderRadius: 8,
    border: `1px solid ${primary ? "#1c1c1c" : "#dcdcdc"}`,
    background: primary ? "#1c1c1c" : "#fff",
    color: primary ? "#fff" : "#1c1c1c",
    font: "inherit",
    fontWeight: 500,
    cursor: "pointer",
  }),
  toast: {
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 2147483000,
    background: "#1c1c1c",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 8,
    font: `13px ${fontStack}`,
    boxShadow: "0 2px 8px rgba(0,0,0,.2)",
  },
};
