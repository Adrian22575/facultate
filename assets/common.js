(function () {
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
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Nu pot încărca ${url}`);
    }
    return response.json();
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

  window.AppUtils = {
    getParam,
    shuffleInPlace,
    fetchJSON,
    normalizeQuestions
  };
})();
