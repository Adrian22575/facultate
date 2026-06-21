"use client";

import { useEffect } from "react";

export default function GlobalApplicationError({ error, reset }) {
  useEffect(() => {
    console.error("global_route_render_failed", error);
  }, [error]);

  return (
    <html lang="ro">
      <body style={{ margin: 0, background: "#f4f8fd", color: "#12213b" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 20,
            fontFamily: '"Avenir Next", "Segoe UI", sans-serif'
          }}
        >
          <section
            role="alert"
            style={{
              width: "min(100%, 540px)",
              boxSizing: "border-box",
              padding: "28px 24px",
              border: "1px solid #d5e2f2",
              borderRadius: 8,
              background: "#fff",
              textAlign: "center",
              boxShadow: "0 20px 54px rgba(20, 50, 100, 0.12)"
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 58,
                height: 58,
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
                border: "1px solid #ead7a8",
                borderRadius: 8,
                background: "#fff7df",
                color: "#925a00",
                fontSize: 20,
                fontWeight: 900
              }}
            >
              5+
            </div>
            <p style={{ margin: "0 0 8px", color: "#1558b7", fontSize: 13, fontWeight: 900 }}>
              Nota 5+
            </p>
            <h1 style={{ margin: "0 0 12px", fontSize: "clamp(1.7rem, 7vw, 2.3rem)", lineHeight: 1.1 }}>
              Aplicatia nu s-a incarcat.
            </h1>
            <p style={{ margin: "0 auto 22px", maxWidth: 430, color: "#5f6f88", lineHeight: 1.6 }}>
              A aparut o problema temporara. Poti reincerca sau reveni la pagina principala.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  flex: "1 1 190px",
                  minHeight: 46,
                  padding: "0 18px",
                  border: "1px solid #1558b7",
                  borderRadius: 8,
                  background: "#1558b7",
                  color: "#fff",
                  font: "inherit",
                  fontWeight: 850,
                  cursor: "pointer"
                }}
              >
                Incearca din nou
              </button>
              <a
                href="/"
                style={{
                  flex: "1 1 190px",
                  minHeight: 44,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 18px",
                  border: "1px solid #bfd0e7",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#123d78",
                  fontWeight: 850,
                  textDecoration: "none"
                }}
              >
                Pagina principala
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
