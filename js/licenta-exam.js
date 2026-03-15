const SUBJECTS_FILE = "data/subjects-licenta.json";
const QUESTIONS_PER_TEST = 30;

let allQuestions = [];
let currentQuestions = [];

const summaryEl = document.getElementById("summary");
const loadingEl = document.getElementById("loading");
const quizContainer = document.getElementById("quizContainer");
const resultContainer = document.getElementById("resultContainer");

const startBtn = document.getElementById("startBtn");
const submitBtn = document.getElementById("submitBtn");
const restartBtn = document.getElementById("restartBtn");

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadAllQuestions() {
  try {
    loadingEl.textContent = "Se citesc materiile...";

    const subjectsResponse = await fetch(SUBJECTS_FILE);
    if (!subjectsResponse.ok) {
      throw new Error(`Nu pot citi ${SUBJECTS_FILE}`);
    }

    const subjectsData = await subjectsResponse.json();
    const subjects = subjectsData.subjects || [];

    const loadedSets = await Promise.all(
      subjects.map(async (subject) => {
        const res = await fetch(subject.questionsFile);
        if (!res.ok) {
          throw new Error(`Nu pot citi ${subject.questionsFile}`);
        }

        const data = await res.json();
        const questions = (data.questions || []).map((q) => ({
          ...q,
          subjectId: subject.id,
          subjectTitle: subject.title
        }));

        return questions;
      })
    );

    allQuestions = loadedSets.flat();

    summaryEl.textContent = `Au fost încărcate ${allQuestions.length} întrebări din ${subjects.length} fișiere.`;
    loadingEl.textContent = "Datele au fost încărcate.";
  } catch (error) {
    console.error(error);
    summaryEl.textContent = "A apărut o eroare la încărcarea fișierelor.";
    loadingEl.textContent = error.message;
  }
}

function generateTest() {
  if (!allQuestions.length) return;

  resultContainer.innerHTML = "";
  quizContainer.innerHTML = "";

  currentQuestions = shuffle(allQuestions).slice(0, QUESTIONS_PER_TEST);

  const form = document.createElement("form");
  form.id = "quizForm";

  currentQuestions.forEach((question, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "question";

    const title = document.createElement("div");
    title.className = "question-title";
    title.textContent = `${index + 1}. ${question.text}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Materia: ${question.subjectTitle}`;

    const answers = document.createElement("div");
    answers.className = "answers";

    question.answers.forEach((answer, answerIndex) => {
      const label = document.createElement("label");

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `q_${index}`;
      radio.value = answerIndex;

      label.appendChild(radio);
      label.appendChild(document.createTextNode(answer));
      answers.appendChild(label);
    });

    wrapper.appendChild(title);
    wrapper.appendChild(meta);
    wrapper.appendChild(answers);
    form.appendChild(wrapper);
  });

  quizContainer.appendChild(form);

  submitBtn.classList.remove("hidden");
  restartBtn.classList.remove("hidden");
}

function evaluateTest() {
  let score = 0;
  let html = `<div class="result-box"><h2>Rezultat</h2>`;

  currentQuestions.forEach((question, index) => {
    const selected = document.querySelector(`input[name="q_${index}"]:checked`);
    const selectedIndex = selected ? Number(selected.value) : null;
    const isCorrect = selectedIndex === question.correctIndex;

    if (isCorrect) score++;

    html += `
      <div style="margin-top:16px; padding-top:16px; border-top:1px solid #e5e7eb;">
        <div><strong>${index + 1}. ${question.text}</strong></div>
        <div style="font-size:0.92rem; color:#666; margin:6px 0;">Materia: ${question.subjectTitle}</div>
        <div class="${isCorrect ? "correct" : "wrong"}">
          ${isCorrect ? "Corect" : "Greșit"}
        </div>
        <div>Răspunsul tău: ${
          selectedIndex !== null ? question.answers[selectedIndex] : "Fără răspuns"
        }</div>
        ${
          !isCorrect
            ? `<div>Răspuns corect: <strong>${question.answers[question.correctIndex]}</strong></div>`
            : ""
        }
      </div>
    `;
  });

  html += `<hr style="margin:18px 0;">`;
  html += `<div style="font-size:1.1rem;"><strong>Scor final: ${score} / ${currentQuestions.length}</strong></div>`;
  html += `</div>`;

  resultContainer.innerHTML = html;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

startBtn.addEventListener("click", generateTest);
submitBtn.addEventListener("click", evaluateTest);
restartBtn.addEventListener("click", generateTest);

loadAllQuestions();
