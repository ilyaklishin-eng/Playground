const QUESTION_POOL = [
  { theme: "self", text: "Насколько вы сегодня принимаете себя без условий?" },
  { theme: "self", text: "Насколько вы добры к себе, когда ошибаетесь?" },
  { theme: "control", text: "Насколько вам важно все держать под контролем прямо сейчас?" },
  { theme: "control", text: "Насколько легко вам отпустить то, что уже не зависит от вас?" },
  { theme: "trust", text: "Насколько вы доверяете людям рядом с вами?" },
  { theme: "trust", text: "Насколько вам страшно показать свою уязвимость?" },
  { theme: "past", text: "Насколько сильно прошлое влияет на ваши решения сегодня?" },
  { theme: "past", text: "Насколько часто вы возвращаетесь к старым обидам?" },
  { theme: "body", text: "Насколько вы слышите сигналы своего тела в течение дня?" },
  { theme: "body", text: "Насколько ваше тело сейчас напряжено?" },
  { theme: "fear", text: "Насколько вас останавливает страх быть отвергнутым?" },
  { theme: "fear", text: "Насколько вы готовы идти в неизвестность, даже если тревожно?" },
  { theme: "anger", text: "Насколько честно вы признаете собственный гнев?" },
  { theme: "anger", text: "Насколько легко вам выражать недовольство без вины?" },
  { theme: "loss", text: "Насколько вы прожили то, что утратили?" },
  { theme: "loss", text: "Насколько вы разрешаете себе скорбеть о несбывшемся?" },
  { theme: "relation", text: "Насколько вам удается оставаться собой в близости?" },
  { theme: "relation", text: "Насколько вы умеете просить о поддержке напрямую?" },
  { theme: "meaning", text: "Насколько вы чувствуете смысл в том, что делаете?" },
  { theme: "meaning", text: "Насколько вы живете в согласии со своими ценностями?" },
  { theme: "future", text: "Насколько вы верите, что впереди может быть лучше?" },
  { theme: "future", text: "Насколько вы готовы дать себе время на изменения?" },
  { theme: "boundaries", text: "Насколько вам комфортно говорить слово \"нет\"?" },
  { theme: "boundaries", text: "Насколько ваши личные границы уважаются окружающими?" }
];

const THEME_WORDS = {
  self: "самопринятие",
  control: "контроль",
  trust: "доверие",
  past: "прошлое",
  body: "тело",
  fear: "страх",
  anger: "гнев",
  loss: "утрата",
  relation: "близость",
  meaning: "смысл",
  future: "будущее",
  boundaries: "границы"
};

const form = document.getElementById("quiz-form");
const questionsNode = document.getElementById("questions");
const resultNode = document.getElementById("result");
const poemNode = document.getElementById("poem");
const reloadBtn = document.getElementById("reload-btn");

let activeQuestions = [];

function shuffled(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickQuestions() {
  activeQuestions = shuffled(QUESTION_POOL).slice(0, 5);
}

function renderQuestions() {
  questionsNode.innerHTML = "";

  activeQuestions.forEach((question, index) => {
    const wrapper = document.createElement("section");
    wrapper.className = "question";

    const p = document.createElement("p");
    p.textContent = `${index + 1}. ${question.text}`;

    const table = document.createElement("table");
    table.className = "scale";

    const head = document.createElement("tr");
    head.innerHTML = "<th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>";
    table.appendChild(head);

    const row = document.createElement("tr");

    for (let score = 1; score <= 5; score += 1) {
      const cell = document.createElement("td");
      const label = document.createElement("label");
      const input = document.createElement("input");

      input.type = "radio";
      input.name = `q_${index}`;
      input.value = String(score);
      input.required = true;

      label.appendChild(input);
      cell.appendChild(label);
      row.appendChild(cell);
    }

    table.appendChild(row);
    wrapper.appendChild(p);
    wrapper.appendChild(table);
    questionsNode.appendChild(wrapper);
  });
}

function wordByLevel(score, low, mid, high) {
  if (score <= 2) return low;
  if (score <= 3.5) return mid;
  return high;
}

function clamp15(value) {
  return Math.max(1, Math.min(5, Number(value)));
}

function dominantThemes(answers) {
  const totals = {};

  answers.forEach((item) => {
    totals[item.theme] = (totals[item.theme] || 0) + item.score;
  });

  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([theme]) => THEME_WORDS[theme] || theme);
}

function buildPoem(answers) {
  const scores = answers.map((a) => a.score);
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const spread = Math.max(...scores) - Math.min(...scores);
  const [focusA, focusB] = dominantThemes(answers);

  const sky = wordByLevel(avg, "тусклый", "ровный", "светлый");
  const pulse = wordByLevel(avg, "медленный", "живой", "смелый");
  const depth = wordByLevel(avg, "тихая", "густая", "глубокая");
  const balance = spread >= 3 ? "контрастами" : "ритмом";

  return [
    `Надо мной сегодня ${sky} вечерний свет,`,
    `и пульс внутри - ${pulse}, без лишних масок.`,
    `Я говорю с собой о теме \"${focusA}\",`,
    `и рядом дышит тема \"${focusB}\".`,
    `Душа заполнена ${balance}, но не страхом,`,
    `в ней ${depth} тишина становится ответом.`,
    `Мой внутренний балл: ${avg.toFixed(1)} из 5.`
  ].join("\n");
}

function refreshQuestions() {
  pickQuestions();
  renderQuestions();
  resultNode.classList.add("hidden");
  poemNode.textContent = "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);

  const answers = activeQuestions.map((question, index) => {
    const raw = formData.get(`q_${index}`);
    return {
      theme: question.theme,
      score: clamp15(raw)
    };
  });

  if (answers.some((item) => Number.isNaN(item.score))) {
    return;
  }

  poemNode.textContent = buildPoem(answers);
  resultNode.classList.remove("hidden");
});

reloadBtn.addEventListener("click", refreshQuestions);

refreshQuestions();
