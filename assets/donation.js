/**
 * Donation component.
 * Static-friendly: no external QR/image service is loaded.
 */

(function() {
  const CONFIG = {
    revolutLink: "https://revolut.me/anghel7h2q",
    title: "Susține proiectul",
    message: "Dacă materialele te-au ajutat la pregătire, poți susține discret proiectul.",
    buttonText: "Donează prin Revolut"
  };

  function createDonationHTML() {
    return `
      <div class="donation-section">
        <h3>${CONFIG.title}</h3>
        <p>${CONFIG.message}</p>
        <div class="donation-content">
          <a href="${CONFIG.revolutLink}" target="_blank" rel="noopener noreferrer" class="revolut-button">
            ${CONFIG.buttonText}
          </a>
        </div>
      </div>
    `;
  }

  window.insertDonation = function(targetId) {
    const target = document.getElementById(targetId);
    if (target) {
      target.innerHTML = createDonationHTML();
    }
  };

  window.getDonationHTML = function() {
    return createDonationHTML();
  };

  document.addEventListener("DOMContentLoaded", function() {
    const placeholder = document.getElementById("donation");
    if (placeholder) {
      placeholder.innerHTML = createDonationHTML();
    }
  });
})();
