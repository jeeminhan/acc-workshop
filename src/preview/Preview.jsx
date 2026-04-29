import React, { useEffect, useRef, useState } from "react";
import App from "../App.jsx";
import { IOSDevice } from "./IOSFrame.jsx";
import { ChromeWindow } from "./BrowserFrame.jsx";

// Replicates the design canvas from `ACC Workshop.html`. Two live App instances
// are mounted side-by-side and pre-routed to participant / facilitator by
// auto-clicking the matching Landing button right after mount. They share state
// via the storage shim's BroadcastChannel so submitting on the phone updates
// the projector within ~3s (same behavior as the design preview).
function MountedApp({ initialView }) {
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      const buttons = root.querySelectorAll("button");
      for (const b of buttons) {
        const txt = (b.textContent || "").toLowerCase();
        if (initialView === "participant" && txt.includes("participant")) {
          b.click();
          return;
        }
        if (initialView === "facilitator" && txt.includes("facilitator")) {
          b.click();
          return;
        }
      }
    }, 80);
    return () => clearTimeout(t);
  }, [initialView]);
  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <App />
    </div>
  );
}

function ScaledBrowser() {
  const W = 1440;
  const H = 900;
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current) return;
      const avail = wrapRef.current.getBoundingClientRect().width;
      const target = Math.max(360, avail);
      setScale(Math.min(1, target / W));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return (
    <div
      ref={wrapRef}
      className="frame-shadow"
      style={{ borderRadius: 10, overflow: "hidden", background: "#fff" }}
    >
      <div style={{ width: "100%", overflow: "hidden" }}>
        <div
          style={{
            width: W,
            height: H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <ChromeWindow
            tabs={[{ title: "ACC Empathy Workshop · Facilitator" }]}
            url="acc-workshop.app/facilitator"
            width={W}
            height={H}
          >
            <div style={{ width: W, height: H - 84, overflow: "auto" }}>
              <MountedApp initialView="facilitator" />
            </div>
          </ChromeWindow>
        </div>
        <div
          style={{
            width: "100%",
            height: 0,
            paddingBottom: `${((H * scale) / W) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function Preview() {
  return (
    <div style={{ padding: "60px 56px 80px", minHeight: "100vh" }}>
      <div style={{ marginBottom: 36, maxWidth: 1480 }}>
        <div
          style={{
            font: "500 12px/1 Inter, system-ui",
            color: "#0d6e6e",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Hi-fi prototype · 高保真原型
        </div>
        <h1
          className="font-serif-display"
          style={{
            fontSize: 36,
            lineHeight: 1.05,
            fontWeight: 500,
            color: "#2a251f",
            letterSpacing: -0.6,
            margin: 0,
          }}
        >
          ACC Empathy Workshop
        </h1>
        <p
          style={{
            font: "400 15px/1.55 Inter, system-ui",
            color: "#6a5a48",
            maxWidth: 760,
            marginTop: 10,
          }}
        >
          Two synchronised views: participants submit anonymous stickies from
          their phones; the facilitator drives the room from a projected laptop.
          Both frames below are <strong>live and connected</strong> in this
          preview — submitting on the phone updates the projector within ~3
          seconds. In production the same code is backed by{" "}
          <code
            style={{
              background: "#f0e9dc",
              padding: "1px 5px",
              borderRadius: 4,
            }}
          >
            window.storage
          </code>
          .
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 56,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="label" style={{ marginBottom: 10 }}>
            Participant · phone
          </div>
          <div className="frame-shadow" style={{ borderRadius: 48 }}>
            <IOSDevice width={402} height={874}>
              <div
                style={{
                  width: 402,
                  height: 874 - 60 - 34,
                  marginTop: 60,
                  overflow: "auto",
                }}
              >
                <MountedApp initialView="participant" />
              </div>
            </IOSDevice>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 900 }}>
          <div className="label" style={{ marginBottom: 10 }}>
            Facilitator · projected (1440 × 900, scaled to fit)
          </div>
          <ScaledBrowser />
        </div>
      </div>

      <div
        style={{
          marginTop: 56,
          maxWidth: 880,
          font: "400 13px/1.6 Inter, system-ui",
          color: "#6a5a48",
        }}
      >
        <div
          style={{
            font: "500 13px/1.4 Inter, system-ui",
            color: "#2a251f",
            textTransform: "uppercase",
            letterSpacing: ".1em",
            marginBottom: 8,
          }}
        >
          How to demo
        </div>
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          <li>
            On the projector, switch boards via the top tabs — the phone updates
            within 3s.
          </li>
          <li>
            Click <em>QR</em> on the projector to show the join screen,{" "}
            <em>Prompt</em> for the big-text intro, <em>Settings</em> for
            personas / move stickies / clear / print.
          </li>
          <li>Start the workshop timer (clock icon, top right) to see phase pacing.</li>
          <li>
            Toggle <em>Reveal one at a time</em> on the Empathy board to drip
            stickies in instead of flooding.
          </li>
          <li>
            Settings → <em>Print / Export</em> opens a print view (cover + 8
            personas + 4 board pages) — use browser <em>Save as PDF</em>.
          </li>
        </ol>
      </div>
    </div>
  );
}
