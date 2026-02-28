const AXES = ["introspection", "hope", "intensity", "tenderness", "darkness", "freedom"];

const QUESTION_POOL = [
  {
    id: "q-self-accept",
    theme: "self",
    text: "Насколько вы сегодня принимаете себя без условий?",
    vector: { introspection: 0.9, tenderness: 0.6, darkness: -0.3 }
  },
  {
    id: "q-control",
    theme: "control",
    text: "Насколько вам важно держать все под контролем прямо сейчас?",
    vector: { freedom: -0.8, intensity: 0.4, darkness: 0.2 }
  },
  {
    id: "q-trust",
    theme: "relation",
    text: "Насколько вы готовы довериться близкому человеку?",
    vector: { tenderness: 0.9, hope: 0.4, introspection: 0.2 }
  },
  {
    id: "q-past",
    theme: "past",
    text: "Насколько прошлое мешает вам двигаться дальше?",
    vector: { darkness: 0.9, introspection: 0.6, hope: -0.5 }
  },
  {
    id: "q-energy",
    theme: "future",
    text: "Насколько у вас сейчас есть внутренняя энергия действовать?",
    vector: { intensity: 0.9, hope: 0.5, darkness: -0.4 }
  },
  {
    id: "q-lonely",
    theme: "loss",
    text: "Насколько сильно вы чувствуете одиночество сегодня?",
    vector: { darkness: 0.9, introspection: 0.5, tenderness: -0.3 }
  },
  {
    id: "q-meaning",
    theme: "meaning",
    text: "Насколько вам ясен смысл того, что происходит с вами?",
    vector: { introspection: 0.8, hope: 0.4, darkness: -0.2 }
  },
  {
    id: "q-risk",
    theme: "fear",
    text: "Насколько вы готовы рискнуть ради нового этапа?",
    vector: { freedom: 0.8, intensity: 0.6, darkness: -0.2 }
  },
  {
    id: "q-grief",
    theme: "loss",
    text: "Насколько вы прожили недавнюю утрату или разочарование?",
    vector: { introspection: 0.7, darkness: 0.6, hope: -0.3 }
  },
  {
    id: "q-softness",
    theme: "relation",
    text: "Насколько вам нужна сейчас мягкость и тепло?",
    vector: { tenderness: 0.9, hope: 0.3, intensity: -0.2 }
  },
  {
    id: "q-rebel",
    theme: "freedom",
    text: "Насколько вы хотите нарушить привычный порядок?",
    vector: { freedom: 0.9, intensity: 0.6, darkness: 0.1 }
  },
  {
    id: "q-calm",
    theme: "stability",
    text: "Насколько вам важны сегодня тишина и устойчивость?",
    vector: { intensity: -0.6, tenderness: 0.2, introspection: 0.4 }
  },
  {
    id: "q-hope",
    theme: "future",
    text: "Насколько вы верите, что завтра может быть светлее?",
    vector: { hope: 1.0, darkness: -0.6, tenderness: 0.2 }
  },
  {
    id: "q-expression",
    theme: "self",
    text: "Насколько вам хочется высказаться прямо и громко?",
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

const form = document.getElementById("quiz-form");
const questionsNode = document.getElementById("questions");
const resultNode = document.getElementById("result");
const poemTitleNode = document.getElementById("poem-title");
const poemMetaNode = document.getElementById("poem-meta");
const poemNode = document.getElementById("poem");
const top3Node = document.getElementById("top3");
const reloadBtn = document.getElementById("reload-btn");

let activeQuestions = [];
let poemCatalog = [...BUILTIN_POEMS];
let lastTop = [];
let currentPoem = null;

function shuffled(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp15(value) {
  return Math.max(1, Math.min(5, Number(value)));
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

function getExcludeSet() {
  const checked = [...form.querySelectorAll('input[name="exclude"]:checked')];
  return new Set(checked.map((node) => node.value));
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

function availablePoems() {
  return poemCatalog.filter((poem) => typeof poem.text === "string" && lineCount(poem.text) <= 20);
}

function fitReason(poem, scorePack) {
  const bits = [];
  if (scorePack.similarity > 0.55) bits.push("близкий эмоциональный профиль");
  if (scorePack.themeBoost > 0) bits.push("совпадение по темам ответов");
  if (scorePack.feedbackBoost > 0.1) bits.push("учтен ваш прошлый фидбек");
  if (!bits.length) bits.push("нейтральное совпадение");
  return bits.join(", ");
}

function profileThemes(answers) {
  const totals = {};
  answers.forEach(({ question, score }) => {
    totals[question.theme] = (totals[question.theme] || 0) + score;
  });

  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);
}

function rankPoems(answers) {
  const userVector = buildUserVector(answers);
  const topThemes = profileThemes(answers);
  const exclude = getExcludeSet();
  const feedback = getFeedbackState();

  const ranked = availablePoems()
    .filter((poem) => {
      if (!poem.avoid) return true;
      return !poem.avoid.some((tag) => exclude.has(tag));
    })
    .map((poem) => {
      const similarity = cosine(userVector, poem.v || AXES.map(() => 0));
      let themeBoost = 0;
      topThemes.forEach((theme) => {
        if ((poem.tags || []).includes(theme)) themeBoost += 0.15;
      });

      const feedbackBoost = (feedback.poem[poem.id] || 0) * 0.18 + (feedback.author[poem.author] || 0) * 0.08;
      const score = similarity + themeBoost + feedbackBoost;

      return {
        poem,
        score,
        similarity,
        themeBoost,
        feedbackBoost
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
  poemNode.textContent = poem.text;
  resultNode.classList.remove("hidden");
}

function renderTop3(ranked) {
  top3Node.innerHTML = "";

  lastTop = ranked.slice(0, 3);

  lastTop.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = `${item.poem.title} - ${item.poem.author} (${fitReason(item.poem, item)})`;

    if (index > 0) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Открыть";
      button.addEventListener("click", () => showPoem(item.poem));
      li.appendChild(button);
    }

    top3Node.appendChild(li);
  });
}

function pickQuestions() {
  activeQuestions = shuffled(QUESTION_POOL).slice(0, 7);
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
    for (let value = 1; value <= 5; value += 1) {
      const cell = document.createElement("td");
      const label = document.createElement("label");
      const input = document.createElement("input");

      input.type = "radio";
      input.name = `q_${index}`;
      input.value = String(value);
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

function refreshQuestions() {
  pickQuestions();
  renderQuestions();
  resultNode.classList.add("hidden");
  poemTitleNode.textContent = "POEM.TXT";
  poemMetaNode.textContent = "";
  poemNode.textContent = "";
  top3Node.innerHTML = "";
  lastTop = [];
  currentPoem = null;
}

function applyFeedback(kind) {
  if (!currentPoem) return;

  const map = {
    bad: -1,
    ok: 0.35,
    great: 1
  };

  const delta = map[kind] || 0;
  const state = getFeedbackState();

  state.poem[currentPoem.id] = (state.poem[currentPoem.id] || 0) + delta;
  state.author[currentPoem.author] = (state.author[currentPoem.author] || 0) + delta * 0.5;

  saveFeedbackState(state);
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
    // Optional file.
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const answers = activeQuestions.map((question, index) => ({
    question,
    score: clamp15(formData.get(`q_${index}`))
  }));

  if (answers.some((item) => Number.isNaN(item.score))) return;

  const ranked = rankPoems(answers);
  if (!ranked.length) {
    poemTitleNode.textContent = "Нет совпадений";
    poemMetaNode.textContent = "Снимите часть фильтров или добавьте стихи в poems.local.json";
    poemNode.textContent = "";
    resultNode.classList.remove("hidden");
    return;
  }

  showPoem(ranked[0].poem);
  renderTop3(ranked);
  resultNode.scrollIntoView({ behavior: "smooth", block: "start" });
});

reloadBtn.addEventListener("click", refreshQuestions);

document.querySelectorAll("[data-feedback]").forEach((button) => {
  button.addEventListener("click", () => {
    applyFeedback(button.getAttribute("data-feedback"));
  });
});

async function init() {
  await loadLocalCatalog();
  refreshQuestions();
}

init();
