const AXES = ["introspection", "hope", "intensity", "tenderness", "darkness", "freedom"];
const CANONICAL_THEMES = ["self", "relation", "past", "future", "darkness", "freedom", "meaning"];
const QUESTION_THEME_MAP = {
  self: ["self"],
  control: ["self", "meaning"],
  relation: ["relation"],
  past: ["past"],
  future: ["future"],
  loss: ["past", "darkness"],
  meaning: ["meaning"],
  fear: ["freedom", "darkness"],
  freedom: ["freedom"],
  stability: ["meaning", "self"]
};

const EDITORIAL_CANON = {
  future: ["pushkin-esli-zhizn-tebya-obmanet", "fet-ya-prishel-k-tebe"],
  relation: ["pushkin-ya-vas-lyubil", "tsvetaeva-mne-nravitsya"],
  freedom: ["lermontov-parus", "mayakovsky-a-vy-mogli-by"],
  darkness: ["blok-noch-ulica-fonar-apteka", "lermontov-i-skuchno-i-grustno"],
  meaning: ["derzhavin-reka-vremen", "mandelshtam-bessonnitsa-gomer"],
  self: ["tyutchev-silentium", "khodasevich-pered-zerkalom"],
  past: ["esenin-ne-zhaleyu", "pushkin-na-holmah-gruzii"]
};

const QUESTION_POOL = [
  {
    id: "q-self-accept",
    theme: "self",
    text: "Насколько вы можете отнестись к себе бережно, даже когда трудно?",
    vector: { introspection: 0.9, tenderness: 0.6, darkness: -0.3 }
  },
  {
    id: "q-control",
    theme: "control",
    text: "Насколько вам сейчас важно, чтобы все было предсказуемо?",
    vector: { freedom: -0.8, intensity: 0.4, darkness: 0.2 }
  },
  {
    id: "q-trust",
    theme: "relation",
    text: "Насколько вам легко опираться на близких, когда непросто?",
    vector: { tenderness: 0.9, hope: 0.4, introspection: 0.2 }
  },
  {
    id: "q-past",
    theme: "past",
    text: "Насколько мысли о прошлом забирают ваше внимание сегодня?",
    vector: { darkness: 0.9, introspection: 0.6, hope: -0.5 }
  },
  {
    id: "q-energy",
    theme: "future",
    text: "Насколько у вас есть внутренний ресурс действовать шаг за шагом?",
    vector: { intensity: 0.9, hope: 0.5, darkness: -0.4 }
  },
  {
    id: "q-lonely",
    theme: "loss",
    text: "Насколько вы сейчас чувствуете эмоциональную изоляцию от других?",
    vector: { darkness: 0.9, introspection: 0.5, tenderness: -0.3 }
  },
  {
    id: "q-meaning",
    theme: "meaning",
    text: "Насколько вы понимаете, что для вас сейчас действительно важно?",
    vector: { introspection: 0.8, hope: 0.4, darkness: -0.2 }
  },
  {
    id: "q-risk",
    theme: "fear",
    text: "Насколько вы готовы к небольшим изменениям при неопределенности?",
    vector: { freedom: 0.8, intensity: 0.6, darkness: -0.2 }
  },
  {
    id: "q-grief",
    theme: "loss",
    text: "Насколько недавняя боль или разочарование остаются внутри незавершенными?",
    vector: { introspection: 0.7, darkness: 0.6, hope: -0.3 }
  },
  {
    id: "q-softness",
    theme: "relation",
    text: "Насколько вам сейчас нужны поддержка, мягкость и восстановление?",
    vector: { tenderness: 0.9, hope: 0.3, intensity: -0.2 }
  },
  {
    id: "q-rebel",
    theme: "freedom",
    text: "Насколько вам хочется выйти за рамки привычных ролей и сценариев?",
    vector: { freedom: 0.9, intensity: 0.6, darkness: 0.1 }
  },
  {
    id: "q-calm",
    theme: "stability",
    text: "Насколько вам сейчас важны тишина, ритм и устойчивый темп?",
    vector: { intensity: -0.6, tenderness: 0.2, introspection: 0.4 }
  },
  {
    id: "q-hope",
    theme: "future",
    text: "Насколько вы чувствуете, что в ближайшем будущем возможны улучшения?",
    vector: { hope: 1.0, darkness: -0.6, tenderness: 0.2 }
  },
  {
    id: "q-expression",
    theme: "self",
    text: "Насколько вам важно открыто проговорить то, что накопилось?",
    vector: { intensity: 0.8, freedom: 0.5, introspection: -0.2 }
  }
];

const BUILTIN_POEMS = [
  {
    id: "pushkin-ya-vas-lyubil",
    title: "Я вас любил",
    author: "Александр Пушкин",
    year: "1829",
    tags: ["relation"],
    avoid: [],
    v: [0.55, 0.4, 0.2, 0.95, 0.25, 0.2],
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
    id: "pushkin-esli-zhizn-tebya-obmanet",
    title: "Если жизнь тебя обманет",
    author: "Александр Пушкин",
    year: "1825",
    tags: ["self", "future"],
    avoid: [],
    v: [0.6, 0.9, 0.25, 0.5, 0.2, 0.45],
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
    tags: ["relation", "past"],
    avoid: [],
    v: [0.7, 0.5, 0.3, 0.9, 0.35, 0.2],
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
    id: "pushkin-k-chaadaevu",
    title: "К Чаадаеву",
    author: "Александр Пушкин",
    year: "1818",
    tags: ["future"],
    avoid: ["patriot"],
    v: [0.3, 0.85, 0.8, 0.25, 0.2, 0.8],
    text: `Любви, надежды, тихой славы
Недолго нежил нас обман,
Исчезли юные забавы,
Как сон, как утренний туман;

Но в нас горит еще желанье,
Под гнетом власти роковой
Нетерпеливою душой
Отчизны внемлем призыванье.

Пока свободою горим,
Пока сердца для чести живы,
Мой друг, отчизне посвятим
Души прекрасные порывы!`
  },
  {
    id: "pushkin-vo-glubine-sibirskih-rud",
    title: "Во глубине сибирских руд",
    author: "Александр Пушкин",
    year: "1827",
    tags: ["hope"],
    avoid: [],
    v: [0.45, 0.8, 0.55, 0.35, 0.3, 0.7],
    text: `Во глубине сибирских руд
Храните гордое терпенье,
Не пропадет ваш скорбный труд
И дум высокое стремленье.

Несчастью верная сестра,
Надежда в мрачном подземелье
Разбудит бодрость и веселье,
Придет желанная пора.`
  },
  {
    id: "lermontov-parus",
    title: "Парус",
    author: "Михаил Лермонтов",
    year: "1832",
    tags: ["freedom"],
    avoid: [],
    v: [0.45, 0.35, 0.9, 0.15, 0.55, 0.95],
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
    id: "lermontov-i-skuchno-i-grustno",
    title: "И скучно и грустно",
    author: "Михаил Лермонтов",
    year: "1840",
    tags: ["self"],
    avoid: ["darkness"],
    v: [0.85, 0.1, 0.25, 0.2, 0.9, 0.25],
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
    tags: ["relation", "past"],
    avoid: [],
    v: [0.75, 0.25, 0.4, 0.8, 0.45, 0.2],
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
    id: "lermontov-angel",
    title: "Ангел",
    author: "Михаил Лермонтов",
    year: "1831",
    tags: ["tenderness"],
    avoid: [],
    v: [0.55, 0.7, 0.2, 0.95, 0.2, 0.3],
    text: `По небу полуночи ангел летел,
И тихую песню он пел;
И месяц, и звезды, и тучи толпой
Внимали той песне святой.

Он пел о блаженстве безгрешных духов
Под кущами райских садов;
О Боге великом он пел, и хвала
Его непритворна была.

Он душу младую в объятиях нес
Для мира печали и слез;
И звук его песни в душе молодой
Остался - без слов, но живой.`
  },
  {
    id: "baratynsky-muza",
    title: "Муза",
    author: "Евгений Баратынский",
    year: "1829",
    tags: ["self", "meaning"],
    avoid: [],
    v: [0.9, 0.35, 0.2, 0.3, 0.35, 0.25],
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
    id: "baratynsky-razuverenie",
    title: "Разуверение",
    author: "Евгений Баратынский",
    year: "1821",
    tags: ["past", "relation"],
    avoid: ["darkness"],
    v: [0.75, 0.2, 0.25, 0.65, 0.7, 0.15],
    text: `Не искушай меня без нужды
Возвратом нежности твоей:
Разочарованному чужды
Все обольщенья прежних дней!

Уж я не верю увереньям,
Уж я не верую в любовь
И не могу предаться вновь
Раз изменившим сновиденьям!`
  },
  {
    id: "derzhavin-reka-vremen",
    title: "Река времен",
    author: "Гавриил Державин",
    year: "1816",
    tags: ["meaning"],
    avoid: [],
    v: [0.75, 0.15, 0.25, 0.1, 0.8, 0.2],
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
    tags: ["relation"],
    avoid: [],
    v: [0.6, 0.45, 0.3, 0.9, 0.25, 0.3],
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
    id: "batyushkov-mechta",
    title: "Мечта",
    author: "Константин Батюшков",
    year: "1817",
    tags: ["future"],
    avoid: [],
    v: [0.5, 0.65, 0.35, 0.55, 0.25, 0.45],
    text: `Мечта - души волшебный гений,
Друг тихих дней и долгих дум;
Она, как факел вдохновений,
Зажжет остывший, бедный ум.

В ее обмане благодатном
Я сердцем к небу восхожу,
И в мире суетном, превратном
Иных гармоний нахожу.`
  },
  {
    id: "tyutchev-umom-rossiyu",
    title: "Умом Россию не понять",
    author: "Федор Тютчев",
    year: "1866",
    tags: ["meaning"],
    avoid: ["patriot"],
    v: [0.45, 0.5, 0.2, 0.15, 0.3, 0.3],
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
    tags: ["meaning", "relation"],
    avoid: [],
    v: [0.7, 0.5, 0.2, 0.45, 0.25, 0.25],
    text: `Нам не дано предугадать,
Как слово наше отзовется,
И нам сочувствие дается,
Как нам дается благодать.`
  },
  {
    id: "tyutchev-silentium",
    title: "Silentium!",
    author: "Федор Тютчев",
    year: "1830",
    tags: ["self", "meaning"],
    avoid: [],
    v: [0.95, 0.25, 0.15, 0.2, 0.45, 0.2],
    text: `Молчи, скрывайся и таи
И чувства и мечты свои -
Пускай в душевной глубине
Встают и заходят оне
Безмолвно, как звезды в ночи, -
Любуйся ими - и молчи.

Как сердцу высказать себя?
Другому как понять тебя?
Поймет ли он, чем ты живешь?
Мысль изреченная есть ложь.
Взрывая, возмутишь ключи, -
Питайся ими - и молчи.`
  },
  {
    id: "tyutchev-ya-vstretil-vas",
    title: "Я встретил вас - и все былое",
    author: "Федор Тютчев",
    year: "1870",
    tags: ["relation", "past"],
    avoid: [],
    v: [0.65, 0.55, 0.35, 0.85, 0.3, 0.25],
    text: `Я встретил вас - и все былое
В отжившем сердце ожило;
Я вспомнил время золотое -
И сердцу стало так тепло...

Как поздней осени порою
Бывают дни, бывает час,
Когда повеет вдруг весною
И что-то встрепенется в нас, -

Так, весь обвеян дуновеньем
Тех лет душевной полноты,
С давно забытым упоеньем
Смотрю на милые черты...`
  },
  {
    id: "fet-shepot",
    title: "Шепот, робкое дыханье",
    author: "Афанасий Фет",
    year: "1850",
    tags: ["relation"],
    avoid: [],
    v: [0.35, 0.55, 0.25, 0.95, 0.15, 0.2],
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
    tags: ["future", "relation"],
    avoid: [],
    v: [0.35, 0.9, 0.55, 0.8, 0.1, 0.5],
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
И тебе служить готова.`
  },
  {
    id: "fet-ehto-utro-radost",
    title: "Это утро, радость эта",
    author: "Афанасий Фет",
    year: "1881",
    tags: ["future"],
    avoid: [],
    v: [0.3, 0.85, 0.5, 0.65, 0.05, 0.4],
    text: `Это утро, радость эта,
Эта мощь и дня и света,
Этот синий свод,
Этот крик и вереницы,
Эти стаи, эти птицы,
Этот говор вод,

Эти ивы и березы,
Эти капли - эти слезы,
Этот пух - не лист,
Эти горы, эти долы,
Эти мошки, эти пчелы,
Этот зык и свист...`
  },
  {
    id: "blok-noch-ulica-fonar-apteka",
    title: "Ночь, улица, фонарь, аптека",
    author: "Александр Блок",
    year: "1912",
    tags: ["darkness"],
    avoid: ["darkness"],
    v: [0.7, 0.05, 0.2, 0.1, 0.95, 0.15],
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
    id: "blok-veter-prines-izdaleka",
    title: "Ветер принес издалека",
    author: "Александр Блок",
    year: "1901",
    tags: ["hope"],
    avoid: [],
    v: [0.5, 0.75, 0.35, 0.6, 0.25, 0.4],
    text: `Ветер принес издалека
Песни весенней намек,
Где-то светло и глубоко
Неба открылся клочок.

В этой бездонной лазури,
В сумерках близкой весны
Плакали зимние бури,
Реяли звездные сны.`
  },
  {
    id: "bryusov-yunomu-poetu",
    title: "Юному поэту",
    author: "Валерий Брюсов",
    year: "1896",
    tags: ["self", "meaning"],
    avoid: [],
    v: [0.65, 0.35, 0.7, 0.15, 0.3, 0.55],
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
    id: "bryusov-rabota",
    title: "Труд",
    author: "Валерий Брюсов",
    year: "1901",
    tags: ["future"],
    avoid: [],
    v: [0.45, 0.55, 0.8, 0.15, 0.25, 0.5],
    text: `Работа! Работа!
От нее не уйдешь.
К победе, к высотам
Иначе не придешь.

Пусть день за днем сурово
Стучит твой молоток,
Из камня немого
Родится голос строк.`
  },
  {
    id: "mayakovsky-a-vy-mogli-by",
    title: "А вы могли бы?",
    author: "Владимир Маяковский",
    year: "1913",
    tags: ["freedom"],
    avoid: [],
    v: [0.35, 0.45, 0.95, 0.2, 0.3, 0.95],
    text: `Я сразу смазал карту будня,
плеснувши краску из стакана;
я показал на блюде студня
косые скулы океана.

На чешуе жестяной рыбы
прочел я зовы новых губ.
А вы
ноктюрн сыграть
могли бы
на флейте водосточных труб?`
  },
  {
    id: "khlebnikov-zaklyatie-smehom",
    title: "Заклятие смехом",
    author: "Велимир Хлебников",
    year: "1908",
    tags: ["freedom"],
    avoid: [],
    v: [0.2, 0.55, 0.9, 0.35, 0.15, 1.0],
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
    tags: ["relation", "future"],
    avoid: [],
    v: [0.5, 0.55, 0.35, 0.7, 0.35, 0.45],
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
Когда на закате он прячется в мраморный грот.`
  },
  {
    id: "khodasevich-pered-zerkalom",
    title: "Перед зеркалом",
    author: "Владислав Ходасевич",
    year: "1922",
    tags: ["self", "darkness"],
    avoid: ["darkness"],
    v: [0.95, 0.1, 0.35, 0.15, 0.85, 0.25],
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
    tags: ["past"],
    avoid: [],
    v: [0.7, 0.45, 0.35, 0.55, 0.45, 0.35],
    text: `Не жалею, не зову, не плачу,
Все пройдет, как с белых яблонь дым.
Увяданья золотом охваченный,
Я не буду больше молодым.

Ты теперь не так уж будешь биться,
Сердце, тронутое холодком,
И страна березового ситца
Не заманит шляться босиком.

Я теперь скупее стал в желаньях,
Жизнь моя? иль ты приснилась мне?
Словно я весенней гулкой ранью
Проскакал на розовом коне.`
  },
  {
    id: "esenin-otgovorila-roscha-zolotaya",
    title: "Отговорила роща золотая",
    author: "Сергей Есенин",
    year: "1924",
    tags: ["past", "darkness"],
    avoid: ["darkness"],
    v: [0.75, 0.3, 0.3, 0.45, 0.65, 0.2],
    text: `Отговорила роща золотая
Березовым, веселым языком,
И журавли, печально пролетая,
Уж не жалеют больше ни о ком.

Кого жалеть? Ведь каждый в мире странник -
Пройдет, зайдет и вновь оставит дом.
О всех ушедших грезит конопляник
С широким месяцем над голубым прудом.`
  },
  {
    id: "tsvetaeva-mne-nravitsya",
    title: "Мне нравится, что вы больны не мной",
    author: "Марина Цветаева",
    year: "1915",
    tags: ["relation", "boundaries"],
    avoid: [],
    v: [0.7, 0.55, 0.35, 0.75, 0.2, 0.6],
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
Гореть за то, что я не вас целую.`
  },
  {
    id: "mandelshtam-bessonnitsa-gomer",
    title: "Бессонница. Гомер. Тугие паруса",
    author: "Осип Мандельштам",
    year: "1915",
    tags: ["meaning"],
    avoid: [],
    v: [0.85, 0.35, 0.3, 0.35, 0.45, 0.3],
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

  { id: "akhmatova-1911-szhala-ruki", title: "Сжала руки под темной вуалью", author: "Анна Ахматова", year: "1911", tags: ["relation"], avoid: [], v: [0.7, 0.25, 0.4, 0.7, 0.4, 0.2], restricted: true },
  { id: "pasternak-1912-fevral", title: "Февраль. Достать чернил и плакать", author: "Борис Пастернак", year: "1912", tags: ["future"], avoid: [], v: [0.6, 0.55, 0.7, 0.4, 0.35, 0.6], restricted: true },
  { id: "zabolotsky-1955-nekrasivaya-devochka", title: "Некрасивая девочка", author: "Николай Заболоцкий", year: "1955", tags: ["self"], avoid: [], v: [0.75, 0.55, 0.25, 0.65, 0.25, 0.35], restricted: true },
  { id: "prigov-1980-alfavity", title: "Азбуки (из цикла)", author: "Дмитрий Пригов", year: "1980-е", tags: ["meaning"], avoid: [], v: [0.55, 0.3, 0.55, 0.2, 0.25, 0.8], restricted: true },
  { id: "brodsky-1970-ne-vyhodi-iz-komnaty", title: "Не выходи из комнаты", author: "Иосиф Бродский", year: "1970", tags: ["darkness"], avoid: ["darkness"], v: [0.8, 0.15, 0.45, 0.2, 0.75, 0.35], restricted: true }
];

const FEEDBACK_KEY = "psyche_feedback_v2";
const GEN_COUNT_KEY = "psyche_generation_count_v1";

const form = document.getElementById("quiz-form");
const questionsNode = document.getElementById("questions");
const resultNode = document.getElementById("result");
const poemTitleNode = document.getElementById("poem-title");
const poemMetaNode = document.getElementById("poem-meta");
const poemNode = document.getElementById("poem");
const feedbackMsgNode = document.getElementById("feedback-msg");
const genCountNode = document.getElementById("gen-count");
const reloadBtn = document.getElementById("reload-btn");
const submitBtn = document.getElementById("submit-btn");
const progressTextNode = document.getElementById("progress-text");
const progressFillNode = document.getElementById("progress-fill");
const progressTrackNode = document.querySelector(".progress-track");
const catalogStateNode = document.getElementById("catalog-state");
const quizMsgNode = document.getElementById("quiz-msg");
const fitPointsNode = document.getElementById("fit-points");

let activeQuestions = [];
let poemCatalog = [...BUILTIN_POEMS];
let currentPoem = null;
let lastRanked = [];
let currentRankIndex = 0;
let lastAnswers = null;

function shuffled(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clampRange(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseScaleValue(raw) {
  if (raw === null || raw === undefined || raw === "") return NaN;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 5) return NaN;
  return value;
}

function lineCount(text) {
  return String(text || "")
    .split("\n")
    .filter((line) => line.trim().length > 0).length;
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function cosine(a, b) {
  const denominator = norm(a) * norm(b);
  if (!denominator) return 0;
  return dot(a, b) / denominator;
}

function scoreToSignal(score) {
  return (score - 3) / 2;
}

function buildUserVector(answers) {
  const base = AXES.reduce((acc, axis) => {
    acc[axis] = 0;
    return acc;
  }, {});

  answers.forEach(({ question, score }) => {
    const signal = scoreToSignal(score);
    Object.entries(question.vector).forEach(([axis, weight]) => {
      base[axis] += signal * weight;
    });
  });

  return AXES.map((axis) => base[axis]);
}

function getFeedbackState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "{}");
    return {
      poem: parsed.poem || {},
      author: parsed.author || {}
    };
  } catch {
    return { poem: {}, author: {} };
  }
}

function saveFeedbackState(state) {
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(state));
}

function getGenerationCount() {
  const raw = Number(localStorage.getItem(GEN_COUNT_KEY));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

function renderGenerationCount() {
  genCountNode.textContent = String(getGenerationCount());
}

function incrementGenerationCount() {
  const next = getGenerationCount() + 1;
  localStorage.setItem(GEN_COUNT_KEY, String(next));
  genCountNode.textContent = String(next);
}

function availablePoems() {
  return poemCatalog.filter((poem) => typeof poem.text === "string" && lineCount(poem.text) <= 20);
}

function profileThemes(answers) {
  const totals = {};

  CANONICAL_THEMES.forEach((theme) => {
    totals[theme] = 0;
  });

  answers.forEach(({ question, score }) => {
    const mapped = QUESTION_THEME_MAP[question.theme] || [question.theme];
    mapped.forEach((theme) => {
      if (!Object.prototype.hasOwnProperty.call(totals, theme)) totals[theme] = 0;
      totals[theme] += score;
    });
  });

  return Object.entries(totals)
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);
}

function editorialBoostForPoem(poemId, topThemes) {
  let score = 0;
  topThemes.forEach((theme) => {
    const canonIds = EDITORIAL_CANON[theme] || [];
    if (canonIds.includes(poemId)) score += 0.11;
  });
  return Math.min(0.22, score);
}

function rankPoems(answers) {
  const userVector = buildUserVector(answers);
  const topThemes = profileThemes(answers);
  const feedback = getFeedbackState();

  const ranked = availablePoems()
    .map((poem) => {
      const similarity = cosine(userVector, poem.v || AXES.map(() => 0));
      let themeBoost = 0;
      topThemes.forEach((theme) => {
        if ((poem.tags || []).includes(theme)) themeBoost += 0.15;
      });

      const poemFeedback = clampRange(feedback.poem[poem.id] || 0, -3, 3);
      const authorFeedback = clampRange(feedback.author[poem.author] || 0, -2, 2);
      const feedbackBoost = poemFeedback * 0.14 + authorFeedback * 0.06;
      const editorialBoost = editorialBoostForPoem(poem.id, topThemes);
      const score = similarity + themeBoost + feedbackBoost + editorialBoost;

      return {
        poem,
        score,
        similarity,
        themeBoost,
        feedbackBoost,
        editorialBoost
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.poem.id.localeCompare(b.poem.id, "ru");
    });

  return ranked;
}

function showPoem(poem) {
  currentPoem = poem;
  poemTitleNode.textContent = poem.title;
  poemMetaNode.textContent = `${poem.author}, ${poem.year || "без даты"}`;
  renderFitPoints(poem, lastAnswers);
  poemNode.textContent = poem.text;
  resultNode.classList.remove("hidden");
}

function showFeedbackMessage(text) {
  feedbackMsgNode.textContent = text;
}

function themeLabel(theme) {
  const labels = {
    self: "внутренний фокус",
    relation: "отношения",
    past: "прошлое",
    future: "будущее",
    darkness: "сложные чувства",
    freedom: "свобода",
    meaning: "смысл"
  };
  return labels[theme] || "настроение";
}

function axisLabel(axis) {
  const labels = {
    introspection: "рефлексия",
    hope: "надежда",
    intensity: "энергия",
    tenderness: "мягкость",
    darkness: "глубина",
    freedom: "свобода"
  };
  return labels[axis] || "баланс";
}

function dominantAxis(userVector) {
  let bestAxis = AXES[0];
  let bestValue = Number.NEGATIVE_INFINITY;

  AXES.forEach((axis, index) => {
    const value = Math.abs(userVector[index] || 0);
    if (value > bestValue) {
      bestValue = value;
      bestAxis = axis;
    }
  });
  return bestAxis;
}

function isEditorialPoem(poemId) {
  return Object.values(EDITORIAL_CANON).some((ids) => ids.includes(poemId));
}

function renderFitPoints(poem, answers) {
  if (!fitPointsNode) return;

  const fallback = [
    "Ваш текущий эмоциональный запрос совпал с тоном текста.",
    "Стих поддерживает нужный вам сейчас внутренний ритм.",
    "Образность и настроение помогают точнее прожить состояние."
  ];

  if (!Array.isArray(answers) || !answers.length) {
    fitPointsNode.innerHTML = fallback.map((line) => `<li>${line}</li>`).join("");
    return;
  }

  const topTheme = profileThemes(answers)[0] || "meaning";
  const axis = dominantAxis(buildUserVector(answers));
  const poemTheme = (poem.tags || []).find((tag) => CANONICAL_THEMES.includes(tag)) || "meaning";

  const points = [
    `Ваш фокус сейчас: ${themeLabel(topTheme)}.`,
    `Главный эмоциональный вектор: ${axisLabel(axis)}.`,
    `Тема стихотворения откликается: ${themeLabel(poemTheme)}.`
  ];

  if (isEditorialPoem(poem.id)) {
    points[2] = "Это эталонный текст для близкого эмоционального состояния.";
  }

  fitPointsNode.innerHTML = points.map((line) => `<li>${line}</li>`).join("");
}

function showQuizMessage(text) {
  quizMsgNode.textContent = text;
}

function showCatalogState(mode, text = "") {
  catalogStateNode.className = `catalog-state ${mode}`;
  catalogStateNode.classList.remove("hidden");

  if (mode === "loading") {
    catalogStateNode.innerHTML = `
      <div class="state-title" aria-hidden="true"></div>
      <div class="state-line" aria-hidden="true"></div>
      <div class="state-line short" aria-hidden="true"></div>
    `;
    return;
  }

  catalogStateNode.textContent = text;
}

function hideCatalogState() {
  catalogStateNode.className = "catalog-state hidden";
  catalogStateNode.textContent = "";
}

function isQuestionAnswered(index) {
  const selected = form.querySelector(`input[name="q_${index}"]:checked`);
  return Boolean(selected);
}

function updateProgress() {
  const total = Math.max(1, activeQuestions.length);
  const answered = activeQuestions.reduce((count, _, index) => count + (isQuestionAnswered(index) ? 1 : 0), 0);
  const ratio = (answered / total) * 100;
  progressTextNode.textContent = `${answered}/${total}`;
  progressFillNode.style.width = `${ratio}%`;
  progressTrackNode.setAttribute("aria-valuenow", String(answered));
  progressTrackNode.setAttribute("aria-valuemax", String(total));
}

function pickQuestions() {
  activeQuestions = shuffled(QUESTION_POOL).slice(0, 7);
}

function renderQuestions() {
  questionsNode.innerHTML = "";

  activeQuestions.forEach((question, index) => {
    const wrapper = document.createElement("section");
    wrapper.className = "question";
    wrapper.dataset.index = String(index);

    const fieldset = document.createElement("fieldset");
    fieldset.className = "scale";
    const hintId = `q_hint_${index}`;
    fieldset.setAttribute("aria-describedby", hintId);
    fieldset.setAttribute("role", "group");

    const legend = document.createElement("legend");
    legend.className = "question-legend";
    legend.textContent = `${index + 1}. ${question.text}`;
    fieldset.appendChild(legend);

    const row = document.createElement("div");
    row.className = "scale-options";
    for (let value = 1; value <= 5; value += 1) {
      const label = document.createElement("label");
      label.className = "scale-option";
      label.dataset.value = String(value);
      const input = document.createElement("input");
      const visual = document.createElement("span");

      input.type = "radio";
      input.name = `q_${index}`;
      input.value = String(value);
      input.required = true;
      input.setAttribute("aria-label", `Оценка ${value} из 5`);
      visual.textContent = String(value);

      label.appendChild(input);
      label.appendChild(visual);
      row.appendChild(label);
    }

    const hint = document.createElement("div");
    hint.className = "scale-hint";
    hint.id = hintId;
    hint.innerHTML = "<span>Совсем не про меня</span><span>Очень про меня</span>";

    fieldset.appendChild(row);
    fieldset.appendChild(hint);
    wrapper.appendChild(fieldset);
    questionsNode.appendChild(wrapper);
  });
}

function refreshQuestions() {
  pickQuestions();
  renderQuestions();
  submitBtn.disabled = false;
  updateProgress();
  resultNode.classList.add("hidden");
  poemTitleNode.textContent = "POEM.TXT";
  poemMetaNode.textContent = "";
  if (fitPointsNode) fitPointsNode.innerHTML = "";
  poemNode.textContent = "";
  showFeedbackMessage("");
  showQuizMessage("");
  currentPoem = null;
  lastRanked = [];
  currentRankIndex = 0;
  lastAnswers = null;
}

function applyFeedback(kind) {
  if (!currentPoem) return;

  const map = {
    bad: -1,
    good: 1
  };

  const delta = map[kind] || 0;
  const state = getFeedbackState();

  state.poem[currentPoem.id] = clampRange((state.poem[currentPoem.id] || 0) + delta, -3, 3);
  state.author[currentPoem.author] = clampRange((state.author[currentPoem.author] || 0) + delta * 0.5, -2, 2);

  saveFeedbackState(state);

  if (kind === "good") {
    showFeedbackMessage("Спасибо за обратную связь.");
    return;
  }

  if (kind === "bad") {
    incrementGenerationCount();

    if (currentRankIndex + 1 < lastRanked.length) {
      currentRankIndex += 1;
      showPoem(lastRanked[currentRankIndex].poem);
      showFeedbackMessage("Показал следующий вариант.");
      return;
    }

    if (lastAnswers) {
      const reranked = rankPoems(lastAnswers).filter((item) => item.poem.id !== currentPoem.id);
      if (reranked.length) {
        lastRanked = reranked;
        currentRankIndex = 0;
        showPoem(lastRanked[0].poem);
        showFeedbackMessage("Показал другой вариант.");
        return;
      }
    }

    showFeedbackMessage("Больше вариантов сейчас нет. Нажмите «Сменить вопросы».");
  }
}

async function loadLocalCatalog() {
  try {
    const response = await fetch("poems.local.json", { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 404) return { status: "ready", added: 0 };
      return { status: "error", message: "Не удалось загрузить локальный каталог стихов." };
    }

    const external = await response.json();
    if (!Array.isArray(external)) {
      return { status: "error", message: "Файл каталога имеет неверный формат." };
    }

    const seenIds = new Set(poemCatalog.map((poem) => poem.id));
    const seenTextKeys = new Set(
      poemCatalog
        .filter((poem) => typeof poem.text === "string")
        .map((poem) => poem.text.toLowerCase().replace(/\s+/g, " ").trim())
    );

    const normalized = external
      .map((poem) => {
        if (!poem || typeof poem !== "object") return null;
        if (typeof poem.id !== "string" || !poem.id.trim()) return null;
        if (typeof poem.title !== "string" || !poem.title.trim()) return null;
        if (typeof poem.author !== "string" || !poem.author.trim()) return null;
        if (typeof poem.text !== "string" || lineCount(poem.text) < 4 || lineCount(poem.text) > 20) return null;
        if (!Array.isArray(poem.v) || poem.v.length !== AXES.length) return null;
        if (!poem.v.every((x) => Number.isFinite(Number(x)))) return null;

        const tags = Array.isArray(poem.tags)
          ? poem.tags.filter((tag) => typeof tag === "string" && CANONICAL_THEMES.includes(tag))
          : [];

        return {
          id: poem.id.trim(),
          title: poem.title.trim(),
          author: poem.author.trim(),
          year: typeof poem.year === "string" ? poem.year.trim() : "",
          tags,
          v: poem.v.map((x) => Number(x)),
          text: poem.text.trim(),
          source: typeof poem.source === "string" ? poem.source : ""
        };
      })
      .filter((poem) => {
        if (!poem) return false;
        if (seenIds.has(poem.id)) return false;

        const textKey = poem.text.toLowerCase().replace(/\s+/g, " ").trim();
        if (!textKey || seenTextKeys.has(textKey)) return false;

        seenIds.add(poem.id);
        seenTextKeys.add(textKey);
        return true;
      });

    poemCatalog = [...poemCatalog, ...normalized];
    return { status: "ready", added: normalized.length };
  } catch {
    return { status: "error", message: "Ошибка сети при загрузке каталога." };
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const answers = activeQuestions.map((question, index) => ({
    question,
    score: parseScaleValue(formData.get(`q_${index}`))
  }));

  if (answers.some((item) => Number.isNaN(item.score))) {
    showQuizMessage("Ответьте на все вопросы по шкале от 1 до 5.");
    return;
  }

  showQuizMessage("");
  lastAnswers = answers;
  const ranked = rankPoems(answers);
  if (!ranked.length) {
    poemTitleNode.textContent = "Нет совпадений";
    poemMetaNode.textContent = "Добавьте стихи в poems.local.json";
    if (fitPointsNode) fitPointsNode.innerHTML = "";
    poemNode.textContent = "";
    showFeedbackMessage("");
    resultNode.classList.remove("hidden");
    return;
  }

  lastRanked = ranked;
  currentRankIndex = 0;
  showPoem(lastRanked[0].poem);
  showFeedbackMessage("");
  incrementGenerationCount();
  resultNode.scrollIntoView({ behavior: "smooth", block: "start" });
});

questionsNode.addEventListener("change", () => {
  updateProgress();
  showQuizMessage("");
});

reloadBtn.addEventListener("click", refreshQuestions);

document.querySelectorAll("[data-feedback]").forEach((button) => {
  button.addEventListener("click", () => {
    applyFeedback(button.getAttribute("data-feedback"));
  });
});

async function init() {
  showCatalogState("loading");
  const loadState = await loadLocalCatalog();

  if (loadState?.status === "error") {
    showCatalogState("error", loadState.message);
  } else if (!availablePoems().length) {
    showCatalogState("empty", "Каталог пуст. Добавьте стихи в poems.local.json.");
  } else {
    hideCatalogState();
  }

  renderGenerationCount();
  refreshQuestions();
}

init();
