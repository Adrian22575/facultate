/**
 * Donation Component - Element reutilizabil pentru donații
 * 
 * Utilizare:
 * 1. Include scriptul în pagină: <script src="assets/donation.js"></script>
 * 2. Adaugă un div gol unde vrei să apară: <div id="donation"></div>
 *    SAU lasă scriptul să-l adauge automat la final
 */

(function() {
  // Configurare - modifică aici datele tale
  const CONFIG = {
    revolutLink: 'https://revolut.me/anghel7h2q',
    title: '☕ Îți place acest proiect?',
    message: 'Dacă materialele te-au ajutat la pregătirea pentru examen, poți susține proiectul cu o mică donație. Orice contribuție este apreciată! Mulțumesc!',
    buttonText: 'Donează prin Revolut',
    qrSize: 100
  };

  // Generează HTML-ul
  function createDonationHTML() {
    return `
      <div class="donation-section">
        <h3>${CONFIG.title}</h3>
        <p>${CONFIG.message}</p>
        <div class="donation-content">
          <img 
            src="https://api.qrserver.com/v1/create-qr-code/?size=${CONFIG.qrSize}x${CONFIG.qrSize}&data=${encodeURIComponent(CONFIG.revolutLink)}" 
            alt="QR Code Revolut"
            width="${CONFIG.qrSize}"
            height="${CONFIG.qrSize}"
            loading="lazy"
          >
          <a href="${CONFIG.revolutLink}" target="_blank" rel="noopener noreferrer" class="revolut-button">
            ${CONFIG.buttonText}
          </a>
        </div>
      </div>
    `;
  }

  // Funcție publică pentru a insera manual
  window.insertDonation = function(targetId) {
    const target = document.getElementById(targetId);
    if (target) {
      target.innerHTML = createDonationHTML();
    }
  };

  // Funcție publică pentru a obține HTML-ul (util pentru inserare dinamică)
  window.getDonationHTML = function() {
    return createDonationHTML();
  };

  // Auto-inserare când DOM-ul e gata
  document.addEventListener('DOMContentLoaded', function() {
    // Caută un element cu id="donation" și inserează acolo
    const placeholder = document.getElementById('donation');
    if (placeholder) {
      placeholder.innerHTML = createDonationHTML();
    }
  });
})();
