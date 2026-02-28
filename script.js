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

const BUILTIN_POEMS = [
  {
    id: "pushkin-ya-vas-lyubil",
    title: "Я вас любил",
    author: "Александр Пушкин",
    year: "1829",
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
    id: "pushkin-esli-zhizn",
    title: "Если жизнь тебя обманет",
    author: "Александр Пушкин",
    year: "1825",
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
    id: "pushkin-na-holmah-gruzii",
    title: "На холмах Грузии лежит ночная мгла",
    author: "Александр Пушкин",
    year: "1829",
    mood: "mid",
    spread: "low",
    tags: ["relation", "past", "future", "trust"],
    text: `На холмах Грузии лежит ночная мгла;
Шумит Арагва предо мною.
Мне грустно и легко; печаль моя светла;
Печаль моя полна тобою,
Тобой, одной тобой... Унынья моего
Ничто не мучит, не тревожит,
И сердце вновь горит и любит - оттого,
Что не любить оно не может.`
  },
  {
    id: "pushkin-chudnoe-mgnovenie",
    title: "Я помню чудное мгновенье",
    author: "Александр Пушкин",
    year: "1825",
    mood: "high",
    spread: "high",
    tags: ["relation", "past", "future", "loss"],
    text: `Я помню чудное мгновенье:
Передо мной явилась ты,
Как мимолетное виденье,
Как гений чистой красоты.

В томленьях грусти безнадежной,
В тревогах шумной суеты,
Звучал мне долго голос нежный
И снились милые черты.

Шли годы. Бурь порыв мятежный
Рассеял прежние мечты,
И я забыл твой голос нежный,
Твои небесные черты.

В глуши, во мраке заточенья
Тянулись тихо дни мои
Без божества, без вдохновенья,
Без слез, без жизни, без любви.

Душе настало пробужденье:
И вот опять явилась ты,
Как мимолетное виденье,
Как гений чистой красоты.`
  },
  {
    id: "lermontov-parus",
    title: "Парус",
    author: "Михаил Лермонтов",
    year: "1832",
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
    id: "lermontov-i-skuchno",
    title: "И скучно и грустно",
    author: "Михаил Лермонтов",
    year: "1840",
    mood: "low",
    spread: "low",
    tags: ["loss", "meaning", "past", "self"],
    text: `И скучно и грустно, и некому руку подать
В минуту душевной невзгоды...
Желанья!.. что пользы напрасно и вечно желать?..
А годы проходят - все лучшие годы!

Любить... но кого же?.. на время - не стоит труда,
А вечно любить невозможно.
В себя ли заглянешь? - там прошлого нет и следа:
И радость, и муки, и все там ничтожно...

Что страсти? - ведь рано иль поздно их сладкий недуг
Исчезнет при слове рассудка;
И жизнь, как посмотришь с холодным вниманьем вокруг,
Такая пустая и глупая шутка...`
  },
  {
    id: "lermontov-net-ne-tebya",
    title: "Нет, не тебя так пылко я люблю",
    author: "Михаил Лермонтов",
    year: "1841",
    mood: "mid",
    spread: "low",
    tags: ["relation", "past", "loss", "trust"],
    text: `Нет, не тебя так пылко я люблю;
Не для меня красы твоей блистанье:
Люблю в тебе я прошлое страданье
И молодость погибшую мою.

Когда порой я на тебя смотрю,
В твои глаза вникая долгим взором:
Таинственным я занят разговором,
Но не с тобой я сердцем говорю.

Я говорю с подругою веселой,
С тобой я говорю, как бы с другой,
С подругой дней моих весенних, золотых.`
  },
  {
    id: "baratynsky-muza",
    title: "Муза",
    author: "Евгений Баратынский",
    year: "1829",
    mood: "mid",
    spread: "low",
    tags: ["meaning", "self", "past"],
    text: `Не ослеплен я музою моею:
Красавицей ее не назовут,
И юноши, узрев ее, за нею
Толпой влюбленной не бегут.

Приманивать изысканным убором,
Игрою глаз, блестящим разговором,
Ни склонности у ней, ни дара нет;
Но поражен бывает мельком свет
Ее лица необщим выраженьем,
Ее речей спокойной простотой;
И он скорее с едким осужденьем,
Чем с похвалою поспешит к ней.`
  },
  {
    id: "derzhavin-reka-vremen",
    title: "Река времен",
    author: "Гавриил Державин",
    year: "1816",
    mood: "low",
    spread: "low",
    tags: ["meaning", "past", "future"],
    text: `Река времен в своем стремленьи
Уносит все дела людей
И топит в пропасти забвенья
Народы, царства и царей.

А если что и остается
Чрез звуки лиры и трубы,
То вечности жерлом пожрется
И общей не уйдет судьбы.`
  },
  {
    id: "batyushkov-moi-genii",
    title: "Мой гений",
    author: "Константин Батюшков",
    year: "1815",
    mood: "high",
    spread: "low",
    tags: ["relation", "trust", "future"],
    text: `О память сердца! Ты сильней
Рассудка памяти печальной,
И часто сладостью своей
Меня в стране пленяешь дальной.

Я помню голос милых слов,
Я помню взор очей прекрасных,
Я помню локоны волос
Небрежно вьющихся и страстных.

И все в душе моей живет,
И все меня к тебе манит;
Мой гений в тишине поет,
И сердце вновь тобой горит.`
  },
  {
    id: "tyutchev-umom-rossiyu",
    title: "Умом Россию не понять",
    author: "Федор Тютчев",
    year: "1866",
    mood: "mid",
    spread: "low",
    tags: ["control", "meaning", "future", "boundaries"],
    text: `Умом Россию не понять,
Аршином общим не измерить:
У ней особенная стать -
В Россию можно только верить.`
  },
  {
    id: "tyutchev-nam-ne-dano",
    title: "Нам не дано предугадать",
    author: "Федор Тютчев",
    year: "1869",
    mood: "mid",
    spread: "low",
    tags: ["meaning", "relation", "future"],
    text: `Нам не дано предугадать,
Как слово наше отзовется,
И нам сочувствие дается,
Как нам дается благодать.`
  },
  {
    id: "fet-shepot",
    title: "Шепот, робкое дыханье",
    author: "Афанасий Фет",
    year: "1850",
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
    id: "fet-ya-prishel-k-tebe",
    title: "Я пришел к тебе с приветом",
    author: "Афанасий Фет",
    year: "1843",
    mood: "high",
    spread: "mid",
    tags: ["future", "relation", "meaning", "trust"],
    text: `Я пришел к тебе с приветом,
Рассказать, что солнце встало,
Что оно горячим светом
По листам затрепетало;

Рассказать, что лес проснулся,
Весь проснулся, веткой каждой,
Каждой птицей встрепенулся
И весенней полон жаждой;

Рассказать, что с той же страстью,
Как вчера, пришел я снова,
Что душа все так же счастью
И тебе служить готова;

Рассказать, что отовсюду
На меня весельем веет,
Что не знаю сам, что буду
Петь, - но только песня зреет.`
  },
  {
    id: "blok-noch-ulica",
    title: "Ночь, улица, фонарь, аптека",
    author: "Александр Блок",
    year: "1912",
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
    id: "bryusov-yunomu-poetu",
    title: "Юному поэту",
    author: "Валерий Брюсов",
    year: "1896",
    mood: "mid",
    spread: "low",
    tags: ["meaning", "self", "boundaries"],
    text: `Юноша бледный со взором горящим,
Ныне даю я тебе три завета:
Первый прими: не живи настоящим,
Только грядущее - область поэта.

Помни второй: никому не сочувствуй,
Сам же себя полюби беспредельно.
Третий храни: поклоняйся искусству,
Только ему, безраздумно, бесцельно.`
  },
  {
    id: "mayakovsky-poslushayte",
    title: "Послушайте!",
    author: "Владимир Маяковский",
    year: "1914",
    mood: "high",
    spread: "high",
    tags: ["meaning", "future", "fear", "self"],
    text: `Послушайте!
Ведь, если звезды зажигают -
значит - это кому-нибудь нужно?
Значит - кто-то хочет, чтобы они были?
Значит - кто-то называет эти плевочки жемчужиной?

И, надрываясь
в метелях полуденной пыли,
врывается к Богу,
боится, что опоздал,
плачет,
целует ему жилистую руку,
просит -
чтоб обязательно была звезда! -
клянется -
не перенесет эту беззвездную муку!

А после
ходит тревожный,
но спокойный наружно.
Говорит кому-то:
"Ведь теперь тебе ничего?
Не страшно?
Да?!"

Послушайте!
Ведь, если звезды
зажигают -
значит - это кому-нибудь нужно?
Значит - это необходимо,
чтобы каждый вечер
над крышами
загоралась хоть одна звезда?!`
  },
  {
    id: "khlebnikov-zaklyatie-smehom",
    title: "Заклятие смехом",
    author: "Велимир Хлебников",
    year: "1908",
    mood: "high",
    spread: "high",
    tags: ["self", "meaning", "future"],
    text: `О, рассмейтесь, смехачи!
О, засмейтесь, смехачи!
Что смеются смехами, что смеянствуют смеяльно,
О, засмейтесь усмеяльно!

О, рассмешищ надсмеяльных - смех усмейных смехачей!
О, иссмейся рассмеяльно, смех надсмейных смехачей!
Смейево, смейево,
Усмей, осмей, смешики, смешики,
Смеюнчики, смеюнчики.`
  },
  {
    id: "gumilev-zhiraf",
    title: "Жираф",
    author: "Николай Гумилев",
    year: "1907",
    mood: "mid",
    spread: "low",
    tags: ["future", "relation", "loss", "meaning"],
    text: `Сегодня, я вижу, особенно грустен твой взгляд,
И руки особенно тонки, колени обняв.
Послушай: далеко, далеко, на озере Чад
Изысканный бродит жираф.

Ему грациозная стройность и нега дана,
И шкуру его украшает волшебный узор,
С которым равняться осмелится только луна,
Дробясь и качаясь на влаге широких озер.

Вдали он подобен цветным парусам корабля,
И бег его плавен, как радостный птичий полет.
Я знаю, что много чудесного видит земля,
Когда на закате он прячется в мраморный грот.

Я знаю веселые сказки таинственных стран
Про черную деву, про страсть молодого вождя,
Но ты слишком долго вдыхала тяжелый туман,
Ты верить не хочешь во что-нибудь, кроме дождя.

И как я тебе расскажу про тропический сад,
Про стройные пальмы, про запах немыслимых трав...
Ты плачешь? Послушай... далеко, на озере Чад
Изысканный бродит жираф.`
  },
  {
    id: "khodasevich-pered-zerkalom",
    title: "Перед зеркалом",
    author: "Владислав Ходасевич",
    year: "1922",
    mood: "low",
    spread: "low",
    tags: ["self", "past", "meaning"],
    text: `Я, я, я. Что за дикое слово!
Неужели вон тот - это я?
Разве мама любила такого,
Желто-серого, полуседого
И всезнающего, как змея?

Разве тот это я, что, изнемогая,
Ковылял по грязи в сапогах,
Что беззубые песни слагая,
Спорил с ветром, судьбу проклиная,
И смеялся в пустых кабаках?

Я ли это? И если не я,
То кто же?`
  },
  {
    id: "esenin-ne-zhaleyu",
    title: "Не жалею, не зову, не плачу",
    author: "Сергей Есенин",
    year: "1921",
    mood: "mid",
    spread: "low",
    tags: ["past", "loss", "self", "future"],
    text: `Не жалею, не зову, не плачу,
Все пройдет, как с белых яблонь дым.
Увяданья золотом охваченный,
Я не буду больше молодым.

Ты теперь не так уж будешь биться,
Сердце, тронутое холодком,
И страна березового ситца
Не заманит шляться босиком.

Дух бродяжий! Ты все реже, реже
Расшевеливаешь пламень уст.
О моя утраченная свежесть,
Буйство глаз и половодье чувств.

Я теперь скупее стал в желаньях,
Жизнь моя? иль ты приснилась мне?
Словно я весенней гулкой ранью
Проскакал на розовом коне.`
  },
  {
    id: "tsvetaeva-mne-nravitsya",
    title: "Мне нравится, что вы больны не мной",
    author: "Марина Цветаева",
    year: "1915",
    mood: "mid",
    spread: "low",
    tags: ["relation", "boundaries", "self", "trust"],
    text: `Мне нравится, что вы больны не мной,
Мне нравится, что я больна не вами,
Что никогда тяжелый шар земной
Не уплывет под нашими ногами.

Мне нравится, что можно быть смешной -
Распущенной - и не играть словами,
И не краснеть удушливой волной,
Слегка соприкоснувшись рукавами.

Мне нравится еще, что вы при мне
Спокойно обнимаете другую,
Не прочите мне в адовом огне
Гореть за то, что я не вас целую.

Что имя нежное мое, мой нежный, не
Упоминаете ни днем, ни ночью - всуе...
Что никогда в церковной тишине
Не пропоют над нами: аллилуйя!`
  },
  {
    id: "mandelshtam-bessonnitsa",
    title: "Бессонница. Гомер. Тугие паруса",
    author: "Осип Мандельштам",
    year: "1915",
    mood: "mid",
    spread: "low",
    tags: ["meaning", "relation", "past"],
    text: `Бессонница. Гомер. Тугие паруса.
Я список кораблей прочел до середины:
Сей длинный выводок, сей поезд журавлиный,
Что над Элладою когда-то поднялся.

Как журавлиный клин в чужие рубежи -
На головах царей божественная пена -
Куда плывете вы? Когда бы не Елена,
Что Троя вам одна, ахейские мужи?

И море, и Гомер - все движется любовью.
Кого же слушать мне? И вот Гомер молчит,
И море черное, витийствуя, шумит
И с тяжким грохотом подходит к изголовью.`
  },
  {
    id: "akhmatova-stuchit-tri-goda",
    title: "Сжала руки под темной вуалью",
    author: "Анна Ахматова",
    year: "1911",
    mood: "mid",
    spread: "low",
    tags: ["relation", "loss"],
    restricted: true
  },
  {
    id: "pasternak-fevral",
    title: "Февраль. Достать чернил и плакать",
    author: "Борис Пастернак",
    year: "1912",
    mood: "high",
    spread: "high",
    tags: ["meaning", "future"],
    restricted: true
  },
  {
    id: "zabolotsky-ne-krasota",
    title: "Некрасивая девочка",
    author: "Николай Заболоцкий",
    year: "1955",
    mood: "mid",
    spread: "low",
    tags: ["self", "trust"],
    restricted: true
  },
  {
    id: "brodsky-ne-vyhodi",
    title: "Не выходи из комнаты",
    author: "Иосиф Бродский",
    year: "1970",
    mood: "low",
    spread: "high",
    tags: ["fear", "boundaries"],
    restricted: true
  },
  {
    id: "prigov-alfavit",
    title: "Азбуки (из цикла)",
    author: "Дмитрий Пригов",
    year: "1980-е",
    mood: "mid",
    spread: "high",
    tags: ["meaning", "boundaries"],
    restricted: true
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
let poemCatalog = [...BUILTIN_POEMS];

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

function lineCount(text) {
  return String(text)
    .split("\n")
    .filter((line) => line.trim().length > 0).length;
}

function availablePoems() {
  return poemCatalog.filter((poem) => typeof poem.text === "string" && lineCount(poem.text) <= 20);
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
  const ranked = availablePoems()
    .map((poem) => ({ poem, score: poemFitScore(poem, profile) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.poem.id.localeCompare(b.poem.id, "ru");
    });

  return ranked[0]?.poem || null;
}

async function loadLocalCatalog() {
  try {
    const response = await fetch("poems.local.json", { cache: "no-store" });
    if (!response.ok) return;

    const external = await response.json();
    if (!Array.isArray(external)) return;

    const normalized = external.filter((poem) => {
      return poem && typeof poem.id === "string" && typeof poem.title === "string" && typeof poem.author === "string";
    });

    poemCatalog = [...poemCatalog, ...normalized];
  } catch {
    // Optional local file; ignore if absent.
  }
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

  if (!poem) {
    poemTitleNode.textContent = "Каталог пуст";
    poemMetaNode.textContent = "Не найдено стихотворений до 20 строк с доступным текстом.";
    poemNode.textContent = "Добавьте записи в poems.local.json";
    resultNode.classList.remove("hidden");
    return;
  }

  poemTitleNode.textContent = poem.title;
  poemMetaNode.textContent = `${poem.author}, ${poem.year || "без даты"}`;
  poemNode.textContent = poem.text;
  resultNode.classList.remove("hidden");
  resultNode.scrollIntoView({ behavior: "smooth", block: "start" });
});

reloadBtn.addEventListener("click", refreshQuestions);

async function init() {
  await loadLocalCatalog();
  refreshQuestions();
}

init();
