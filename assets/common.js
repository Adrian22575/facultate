(function () {
  let staticDataPromise = null;

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function shuffleInPlace(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async function fetchJSON(url, options = { cache: "no-store" }) {
    const normalizedUrl = url.replace(/^\.?\//, "");

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Nu pot incarca ${url}`);
      }
      return response.json();
    } catch (error) {
      await loadStaticData();
      const staticData = window.AppData && window.AppData[normalizedUrl];
      if (staticData) {
        return typeof structuredClone === "function"
          ? structuredClone(staticData)
          : JSON.parse(JSON.stringify(staticData));
      }
      throw error;
    }
  }

  function loadStaticData() {
    if (window.AppData) {
      return Promise.resolve();
    }

    if (!staticDataPromise) {
      staticDataPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "data/app-data.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Nu pot incarca data/app-data.js"));
        document.head.appendChild(script);
      });
    }

    return staticDataPromise;
  }

  function normalizeQuestions(raw) {
    const arr = Array.isArray(raw) ? raw : (raw.questions || []);
    return arr
      .map((q, idx) => ({
        id: q.id ?? idx + 1,
        text: q.text ?? q.q ?? "",
        answers: q.answers ?? q.options ?? [],
        correctIndex: q.correctIndex ?? q.correct
      }))
      .filter(
        (q) => q.text && Array.isArray(q.answers) && q.answers.length > 0 && Number.isInteger(q.correctIndex)
      );
  }

  function saveLastSession(subjectId, subjectTitle, mode, url) {
    if (!subjectId || !subjectTitle || !mode || !url) return;

    try {
      localStorage.setItem("lastStudySession", JSON.stringify({
        subjectId,
        subjectTitle,
        mode,
        url,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.warn("Nu pot salva ultima sesiune.", error);
    }
  }

  function getLastSession() {
    try {
      const raw = localStorage.getItem("lastStudySession");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Nu pot citi ultima sesiune.", error);
      return null;
    }
  }

  function clearLastSession() {
    try {
      localStorage.removeItem("lastStudySession");
    } catch (error) {
      console.warn("Nu pot sterge ultima sesiune.", error);
    }
  }

  window.AppUtils = {
    getParam,
    shuffleInPlace,
    fetchJSON,
    normalizeQuestions,
    saveLastSession,
    getLastSession,
    clearLastSession
  };
})();
