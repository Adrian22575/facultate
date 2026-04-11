const SUBJECTS_FILE = "data/subjects.json";
const QUESTIONS_PER_TEST = 60;
const EXAM_DURATION_MINUTES = 60;

let allQuestions = [];
let currentQuestions = [];
let examSubmitted = false;
let timerInterval = null;
let remainingSeconds = EXAM_DURATION_MINUTES * 60;

const summaryEl = document.getElementById("summary");
const loadingEl = document.getElementById("loading");
const quizContainer = document.getElementById("quizContainer");
const resultContainer = document.getElementById("resultContainer");

const startBtn = document.getElementById("startBtn");
const submitBtn = document.getElementById("submitBtn");
const restartBtn = document.getElementById("restartBtn");

function ensureExamInfoBar() {
  let examInfo = document.getElementById("examInfo");
  if (!examInfo) {
    examInfo = document.createElement("div");
    examInfo.id = "examInfo";
    examInfo.className = "result-box";
    examInfo.style.marginTop = "16px";
    examInfo.style.marginBottom = "20px";

    const container = document.querySelector(".container");
    const loading = document.getElementById("loading");
    container.insertBefore(examInfo, loading.nextSibling);
  }
  return examInfo;
}

function hideExamInfoBar() {
  const examInfo = document.getElementById("examInfo");
  if (examInfo) {
    examInfo.innerHTML = "";
    examInfo.style.display = "none";
  }
}

function showExamInfoBar(html) {
  const examInfo = ensureExamInfoBar();
  examInfo.innerHTML = html;
  examInfo.style.display = "block";
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function countAnsweredQuestions() {
  let answered = 0;
  currentQuestions.forEach((_, index) => {
    const selected = document.querySelector(`input[name="q_${index}"]:checked`);
    if (selected) answered++;
  });
  return answered;
}

function updateExamInfo() {
  const answered = countAnsweredQuestions();
  const unanswered = currentQuestions.length - answered;

  showExamInfoBar(`
    <div class="exam-info-row">
      <div>
        <div class="exam-info-title">Simulare examen licență</div>
        <div class="exam-info-meta">
          Întrebări: <strong>${currentQuestions.length}</strong> |
          Răspunse: <strong>${answered}</strong> |
          Nerăspunse: <strong>${unanswered}</strong>
        </div>
      </div>
      <div class="exam-timer">
        Timp rămas: ${formatTime(remainingSeconds)}
      </div>
    </div>
  `);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  stopTimer();
  updateExamInfo();

  timerInterval = setInterval(() => {
    remainingSeconds--;

    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      updateExamInfo();
      stopTimer();
      submitExam(true);
      return;
    }

    updateExamInfo();
  }, 1000);
}

async function loadAllQuestions() {
  try {
    loadingEl.textContent = "Se citesc materiile...";

    const subjectsData = await AppUtils.fetchJSON(SUBJECTS_FILE);
    const subjects = (subjectsData.subjects || []).filter(
      (subject) => subject.questionsFile
    );

    const loadedSets = await Promise.all(
      subjects.map(async (subject) => {
        const data = await AppUtils.fetchJSON(subject.questionsFile);
        const questions = (data.questions || []).map((q) => ({
          ...q,
          subjectId: subject.id,
          subjectTitle: subject.title
        }));

        return questions;
      })
    );

    allQuestions = loadedSets.flat();

    summaryEl.textContent = `Au fost încărcate ${allQuestions.length} întrebări din ${subjects.length} materii.`;
    loadingEl.textContent = "Datele au fost încărcate. Poți începe simularea.";
  } catch (error) {
    console.error(error);
    summaryEl.textContent = "A apărut o eroare la încărcarea fișierelor.";
    loadingEl.textContent = error.message;
  }
}

function generateTest() {
  if (!allQuestions.length) return;

  examSubmitted = false;
  remainingSeconds = EXAM_DURATION_MINUTES * 60;
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
      radio.addEventListener("change", updateExamInfo);

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
  startBtn.classList.add("hidden");

  startTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function disableInputs() {
  const inputs = document.querySelectorAll('#quizForm input[type="radio"]');
  inputs.forEach((input) => {
    input.disabled = true;
  });
}

function buildStatsBySubject() {
  const stats = {};

  currentQuestions.forEach((question, index) => {
    const key = question.subjectTitle;
    if (!stats[key]) {
      stats[key] = {
        total: 0,
        correct: 0
      };
    }

    stats[key].total += 1;

    const selected = document.querySelector(`input[name="q_${index}"]:checked`);
    const selectedIndex = selected ? Number(selected.value) : null;
    const isCorrect = selectedIndex === question.correctIndex;

    if (isCorrect) {
      stats[key].correct += 1;
    }
  });

  return stats;
}

function buildStatsHtml() {
  const stats = buildStatsBySubject();
  const rows = Object.entries(stats)
    .sort((a, b) => a[0].localeCompare(b[0], "ro"))
    .map(([subject, values]) => {
      const percent = Math.round((values.correct / values.total) * 100);
      return `
        <tr>
          <td>${subject}</td>
          <td class="table-center">${values.correct} / ${values.total}</td>
          <td class="table-center">${percent}%</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="stats-block">
      <h3>Statistici pe materii</h3>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Materia</th>
              <th class="table-center">Scor</th>
              <th class="table-center">Procent</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function submitExam(autoSubmit = false) {
  if (examSubmitted || !currentQuestions.length) return;

  examSubmitted = true;
  stopTimer();
  disableInputs();

  const answered = countAnsweredQuestions();
  let score = 0;

  currentQuestions.forEach((question, index) => {
    const selected = document.querySelector(`input[name="q_${index}"]:checked`);
    const selectedIndex = selected ? Number(selected.value) : null;
    const isCorrect = selectedIndex === question.correctIndex;
    if (isCorrect) score++;
  });

  const percentage = Math.round((score / currentQuestions.length) * 100);

  let html = `
    <div class="result-box">
      <h2>Rezultat final</h2>
      ${
        autoSubmit
          ? `<p class="timeout-note">Timpul a expirat. Examenul a fost trimis automat.</p>`
          : ""
      }
      <p><strong>Întrebări totale:</strong> ${currentQuestions.length}</p>
      <p><strong>Întrebări completate:</strong> ${answered}</p>
      <p><strong>Scor:</strong> ${score} / ${currentQuestions.length}</p>
      <p><strong>Procent:</strong> ${percentage}%</p>
      ${buildStatsHtml()}
      <hr class="result-divider">
      <h3>Corectare detaliată</h3>
  `;

  currentQuestions.forEach((question, index) => {
    const selected = document.querySelector(`input[name="q_${index}"]:checked`);
    const selectedIndex = selected ? Number(selected.value) : null;
    const isCorrect = selectedIndex === question.correctIndex;

    html += `
      <div class="result-detail">
        <div><strong>${index + 1}. ${question.text}</strong></div>
        <div class="result-meta">Materia: ${question.subjectTitle}</div>
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

  html += `</div>`;

  resultContainer.innerHTML = html;
  submitBtn.classList.add("hidden");

  showExamInfoBar(`
    <div class="exam-info-row">
      <div>
        <div class="exam-info-title">Examen finalizat</div>
        <div class="exam-info-meta">
          Scor: <strong>${score} / ${currentQuestions.length}</strong> |
          Procent: <strong>${percentage}%</strong>
        </div>
      </div>
      <div class="exam-timer">
        Timp rămas: ${formatTime(remainingSeconds)}
      </div>
    </div>
  `);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

startBtn.addEventListener("click", generateTest);
submitBtn.addEventListener("click", () => submitExam(false));
restartBtn.addEventListener("click", generateTest);

hideExamInfoBar();
loadAllQuestions();
