const QUESTION_POOL = [
  { theme: "self", text: "Насколько вы сегодня принимаете себя без условий?" },
  { theme: "self", text: "Насколько вы добры к себе, когда ошибаетесь?" },
  { theme: "control", text: "Насколько вам важно держать все под контролем прямо сейчас?" },
  { theme: "control", text: "Насколько легко вам отпустить то, что уже не зависит от вас?" },
  { theme: "trust", text: "Насколько вы доверяете людям рядом с вами?" },
  { theme: "trust", text: "Насколько вам страшно показать свою уязвимость?" },
  { theme: "past", text: "Насколько сильно прошлое влияет на ваши решения сегодня?" },
  { theme: "past", text: "Насколько часто вы возвращаетесь к старым обидам?" },
  { theme: "fear", text: "Насколько вас останавливает страх быть отвергнутым?" },
  { theme: "fear", text: "Насколько вы готовы идти в неизвестность, даже если тревожно?" },
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

const POEM_POOL = [
  {
    title: "Я вас любил",
    author: "Александр Пушкин",
    year: "1829",
    lines: 8,
    mood: "high",
    spread: "low",
    tags: ["relation", "trust", "self", "past"],
    text: `Я вас любил: любовь еще, быть может,
В душе моей угасла не совсем;
Но пусть она вас больше не тревожит;
Я не хочу печалить вас ничем.
Я вас любил безмолвно, безнадежно,
То робостью, то ревностью томим;
Я вас любил так искренно, так нежно,
Как дай вам Бог любимой быть другим.`
  },
  {
    title: "Если жизнь тебя обманет",
    author: "Александр Пушкин",
    year: "1825",
    lines: 8,
    mood: "mid",
    spread: "low",
    tags: ["future", "self", "meaning", "control"],
    text: `Если жизнь тебя обманет,
Не печалься, не сердись!
В день уныния смирись:
День веселья, верь, настанет.

Сердце в будущем живет;
Настоящее уныло:
Все мгновенно, все пройдет;
Что пройдет, то будет мило.`
  },
  {
    title: "Парус",
    author: "Михаил Лермонтов",
    year: "1832",
    lines: 12,
    mood: "mid",
    spread: "high",
    tags: ["fear", "future", "control", "meaning"],
    text: `Белеет парус одинокой
В тумане моря голубом!..
Что ищет он в стране далекой?
Что кинул он в краю родном?..

Играют волны - ветер свищет,
И мачта гнется и скрипит...
Увы! он счастия не ищет
И не от счастия бежит!

Под ним струя светлей лазури,
Над ним луч солнца золотой...
А он, мятежный, просит бури,
Как будто в бурях есть покой!`
  },
  {
    title: "Выхожу один я на дорогу",
    author: "Михаил Лермонтов",
    year: "1841",
    lines: 20,
    mood: "low",
    spread: "low",
    tags: ["past", "meaning", "loss", "future"],
    text: `Выхожу один я на дорогу;
Сквозь туман кремнистый путь блестит;
Ночь тиха. Пустыня внемлет Богу,
И звезда с звездою говорит.

В небесах торжественно и чудно!
Спит земля в сиянье голубом...
Что же мне так больно и так трудно?
Жду ль чего? жалею ли о чем?

Уж не жду от жизни ничего я,
И не жаль мне прошлого ничуть;
Я ищу свободы и покоя!
Я б хотел забыться и заснуть!

Но не тем холодным сном могилы...
Я б желал навеки так заснуть,
Чтоб в груди дремали жизни силы,
Чтоб дыша вздымалась тихо грудь;

Чтоб всю ночь, весь день мой слух лелея,
Про любовь мне сладкий голос пел,
Надо мной чтоб вечно зеленея
Темный дуб склонялся и шумел.`
  },
  {
    title: "Шепот, робкое дыханье...",
    author: "Афанасий Фет",
    year: "1850",
    lines: 12,
    mood: "high",
    spread: "low",
    tags: ["relation", "trust", "body", "future"],
    text: `Шепот, робкое дыханье,
Трели соловья,
Серебро и колыханье
Сонного ручья,

Свет ночной, ночные тени,
Тени без конца,
Ряд волшебных изменений
Милого лица,

В дымных тучках пурпур розы,
Отблеск янтаря,
И лобзания, и слезы,
И заря, заря!..`
  },
  {
    title: "Ночь, улица, фонарь, аптека",
    author: "Александр Блок",
    year: "1912",
    lines: 8,
    mood: "low",
    spread: "high",
    tags: ["past", "loss", "fear", "meaning"],
    text: `Ночь, улица, фонарь, аптека,
Бессмысленный и тусклый свет.
Живи еще хоть четверть века -
Все будет так. Исхода нет.

Умрешь - начнешь опять сначала
И повторится все, как встарь:
Ночь, ледяная рябь канала,
Аптека, улица, фонарь.`
  },
  {
    title: "Умом Россию не понять",
    author: "Федор Тютчев",
    year: "1866",
    lines: 4,
    mood: "mid",
    spread: "low",
    tags: ["control", "meaning", "future", "boundaries"],
    text: `Умом Россию не понять,
Аршином общим не измерить:
У ней особенная стать -
В Россию можно только верить.`
  }
];

const form = document.getElementById("quiz-form");
const questionsNode = document.getElementById("questions");
const resultNode = document.getElementById("result");
const poemTitleNode = document.getElementById("poem-title");
const poemMetaNode = document.getElementById("poem-meta");
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

function clamp15(value) {
  return Math.max(1, Math.min(5, Number(value)));
}

function profileAnswers(answers) {
  const totals = {};
  const scores = answers.map((item) => item.score);

  answers.forEach((item) => {
    totals[item.theme] = (totals[item.theme] || 0) + item.score;
  });

  const topThemes = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);

  const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const spread = Math.max(...scores) - Math.min(...scores);

  const mood = avg <= 2.2 ? "low" : avg >= 3.8 ? "high" : "mid";
  const spreadLevel = spread >= 3 ? "high" : "low";

  return { topThemes, mood, spreadLevel };
}

function poemFitScore(poem, profile) {
  let score = 0;

  if (poem.mood === profile.mood) score += 3;
  if (poem.spread === profile.spreadLevel) score += 2;

  profile.topThemes.forEach((theme) => {
    if (poem.tags.includes(theme)) score += 2;
  });

  return score;
}

function pickPoem(answers) {
  const profile = profileAnswers(answers);
  let bestScore = -1;
  let best = [];

  POEM_POOL.forEach((poem) => {
    const score = poemFitScore(poem, profile);

    if (score > bestScore) {
      bestScore = score;
      best = [poem];
      return;
    }

    if (score === bestScore) {
      best.push(poem);
    }
  });

  return best[Math.floor(Math.random() * best.length)] || POEM_POOL[0];
}

function refreshQuestions() {
  pickQuestions();
  renderQuestions();
  resultNode.classList.add("hidden");
  poemTitleNode.textContent = "POEM.TXT";
  poemMetaNode.textContent = "";
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

  const poem = pickPoem(answers);

  poemTitleNode.textContent = poem.title;
  poemMetaNode.textContent = `${poem.author}, ${poem.year} | ${poem.lines} строк(и)`;
  poemNode.textContent = poem.text;
  resultNode.classList.remove("hidden");
  resultNode.scrollIntoView({ behavior: "smooth", block: "start" });
});

reloadBtn.addEventListener("click", refreshQuestions);

refreshQuestions();
