"use client";

import { useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";

const CONFIRMATION = "STERGE CONTUL";

export function AccountDangerZone({ isAdmin = false }) {
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteAccount() {
    if (isAdmin || confirmation !== CONFIRMATION || isDeleting) return;

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Contul nu a putut fi sters.");
      }

      window.location.assign("/");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Contul nu a putut fi sters.");
      setIsDeleting(false);
    }
  }

  return (
    <section className="account-danger-zone" aria-labelledby="account-danger-title">
      <details>
        <summary>
          <span aria-hidden="true"><ShieldAlert size={20} strokeWidth={2.1} /></span>
          <span>
            <strong id="account-danger-title">Datele si contul meu</strong>
            <small>Optiuni pentru stergerea definitiva a contului.</small>
          </span>
        </summary>

        <div className="account-danger-content">
          {isAdmin ? (
            <p>Conturile administrator sunt protejate si nu pot fi sterse din propriul cont.</p>
          ) : (
            <>
              <p>
                Stergerea elimina contul, progresul, materialele private si fisierele incarcate. Continutul
                publicat pentru comunitate poate ramane anonim atunci cand este necesar pentru ceilalti utilizatori.
              </p>
              <label>
                Pentru confirmare, scrie <strong>{CONFIRMATION}</strong>
                <input
                  type="text"
                  value={confirmation}
                  autoComplete="off"
                  disabled={isDeleting}
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    setError("");
                  }}
                />
              </label>
              {error ? <div className="error-state" role="alert">{error}</div> : null}
              <button
                type="button"
                className="account-delete-button"
                disabled={confirmation !== CONFIRMATION || isDeleting}
                onClick={deleteAccount}
              >
                <Trash2 aria-hidden="true" size={18} strokeWidth={2.1} />
                {isDeleting ? "Stergem contul..." : "Sterge definitiv contul"}
              </button>
            </>
          )}
        </div>
      </details>
    </section>
  );
}
