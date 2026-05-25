import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#060a0f",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 100px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow blobs */}
        <div
          style={{
            position: "absolute",
            top: -100,
            left: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(253,53,110,0.25) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 48 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: "#fd356e",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={26} height={26} viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span style={{ fontSize: 32, fontWeight: 600, color: "white", letterSpacing: "-0.5px" }}>
            SEOBrief
          </span>
          <div
            style={{
              marginLeft: 4,
              padding: "4px 12px",
              borderRadius: 999,
              border: "1px solid rgba(253,53,110,0.4)",
              background: "rgba(253,53,110,0.1)",
              fontSize: 14,
              fontWeight: 500,
              color: "#fd356e",
            }}
          >
            Beta
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            color: "white",
            lineHeight: 1.1,
            letterSpacing: "-1.5px",
            marginBottom: 24,
            maxWidth: 780,
          }}
        >
          SEO-анализ и готовый
          <br />
          <span style={{ color: "#fd356e" }}>контент за минуту</span>
        </div>

        {/* Subtext */}
        <div
          style={{
            fontSize: 22,
            color: "rgba(255,255,255,0.5)",
            fontWeight: 300,
            maxWidth: 680,
            lineHeight: 1.5,
          }}
        >
          Вставь URL — получи разбор конкурентов, gap-ключи и готовые тексты для сайта
        </div>

        {/* Stats pills */}
        <div style={{ display: "flex", gap: 16, marginTop: 48 }}>
          {[
            "Анализ конкурентов",
            "Gap-ключи",
            "Готовый title, H1, FAQ",
            "Powered by Claude AI",
          ].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 20px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                fontSize: 15,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
