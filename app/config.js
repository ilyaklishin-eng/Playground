export const AXES = ["introspection", "hope", "intensity", "tenderness", "darkness", "freedom"];

export const CANONICAL_THEMES = ["self", "relation", "past", "future", "darkness", "freedom", "meaning"];

export const QUESTION_THEME_MAP = {
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

export const EDITORIAL_CANON = {
  future: ["required-александр-пушкин-если-жизнь-тебя-обманет"],
  relation: ["required-александр-пушкин-я-вас-любил"],
  freedom: ["required-михаил-лермонтов-парус"],
  darkness: ["required-александр-блок-ночь-улица-фонарь-аптека"],
  meaning: ["required-гавриил-державин-река-времен-в-своем-стремленьи"],
  self: ["required-федор-тютчев-silentium"],
  past: ["required-сергей-есенин-не-жалею-не-зову-не-плачу"]
};

export const QUESTIONS_PER_SESSION = 8;

export const QUESTION_POOL = [
  {
    id: "q-self-accept",
    theme: "self",
    text: "Насколько вы можете отнестись к себе бережно, даже когда трудно?",
    vector: { introspection: 0.9, tenderness: 0.6, darkness: -0.3 }
  },
  {
    id: "q-self-boundaries",
    theme: "self",
    text: "Насколько у вас получается защищать свои границы без чувства вины?",
    vector: { freedom: 0.7, introspection: 0.5, darkness: -0.2 }
  },
  {
    id: "q-self-expression",
    theme: "self",
    text: "Насколько вам важно сейчас честно выразить накопившиеся чувства?",
    vector: { intensity: 0.8, freedom: 0.5, introspection: -0.2 }
  },
  {
    id: "q-self-fatigue",
    theme: "self",
    text: "Насколько вы чувствуете эмоциональное истощение от постоянного самоконтроля?",
    vector: { darkness: 0.6, introspection: 0.7, hope: -0.3 }
  },

  {
    id: "q-control-predictability",
    theme: "control",
    text: "Насколько вам сейчас важно, чтобы все было предсказуемо?",
    vector: { freedom: -0.8, intensity: 0.4, darkness: 0.2 }
  },
  {
    id: "q-control-overload",
    theme: "control",
    text: "Насколько тяжело вам отпускать то, на что вы не можете повлиять?",
    vector: { introspection: 0.5, darkness: 0.5, freedom: -0.6 }
  },
  {
    id: "q-control-order",
    theme: "control",
    text: "Насколько порядок и структура помогают вам держаться в ресурсе?",
    vector: { intensity: 0.2, hope: 0.3, freedom: -0.5 }
  },

  {
    id: "q-relation-trust",
    theme: "relation",
    text: "Насколько вам легко опираться на близких, когда непросто?",
    vector: { tenderness: 0.9, hope: 0.4, introspection: 0.2 }
  },
  {
    id: "q-relation-nearness",
    theme: "relation",
    text: "Насколько вам сейчас не хватает теплого человеческого контакта?",
    vector: { tenderness: 0.8, darkness: 0.4, hope: -0.2 }
  },
  {
    id: "q-relation-vulnerability",
    theme: "relation",
    text: "Насколько безопасно для вас говорить о своей уязвимости?",
    vector: { tenderness: 0.7, introspection: 0.4, darkness: -0.2 }
  },
  {
    id: "q-relation-conflict",
    theme: "relation",
    text: "Насколько конфликты с важными людьми все еще эмоционально задевают вас?",
    vector: { intensity: 0.5, darkness: 0.6, tenderness: -0.2 }
  },

  {
    id: "q-past-rumination",
    theme: "past",
    text: "Насколько мысли о прошлом забирают ваше внимание сегодня?",
    vector: { darkness: 0.9, introspection: 0.6, hope: -0.5 }
  },
  {
    id: "q-past-regret",
    theme: "past",
    text: "Насколько вы часто возвращаетесь к решениям, о которых жалеете?",
    vector: { introspection: 0.7, darkness: 0.6, hope: -0.4 }
  },
  {
    id: "q-past-memory-warmth",
    theme: "past",
    text: "Насколько воспоминания сейчас скорее поддерживают вас, чем ранят?",
    vector: { hope: 0.5, tenderness: 0.4, darkness: -0.4 }
  },
  {
    id: "q-past-completion",
    theme: "past",
    text: "Насколько вы ощущаете завершенность важного этапа жизни?",
    vector: { hope: 0.6, introspection: 0.4, darkness: -0.5 }
  },

  {
    id: "q-future-energy",
    theme: "future",
    text: "Насколько у вас есть внутренний ресурс действовать шаг за шагом?",
    vector: { intensity: 0.9, hope: 0.5, darkness: -0.4 }
  },
  {
    id: "q-future-hope",
    theme: "future",
    text: "Насколько вы чувствуете, что в ближайшем будущем возможны улучшения?",
    vector: { hope: 1.0, darkness: -0.6, tenderness: 0.2 }
  },
  {
    id: "q-future-direction",
    theme: "future",
    text: "Насколько у вас сейчас есть ясность, куда вы хотите двигаться дальше?",
    vector: { hope: 0.8, introspection: 0.4, intensity: 0.2 }
  },
  {
    id: "q-future-initiation",
    theme: "future",
    text: "Насколько вам трудно начать важное дело, даже понимая его ценность?",
    vector: { intensity: -0.5, darkness: 0.4, hope: -0.3 }
  },

  {
    id: "q-loss-isolation",
    theme: "loss",
    text: "Насколько вы сейчас чувствуете эмоциональную изоляцию от других?",
    vector: { darkness: 0.9, introspection: 0.5, tenderness: -0.3 }
  },
  {
    id: "q-loss-unfinished",
    theme: "loss",
    text: "Насколько недавняя боль или разочарование остаются внутри незавершенными?",
    vector: { introspection: 0.7, darkness: 0.6, hope: -0.3 }
  },
  {
    id: "q-loss-acceptance",
    theme: "loss",
    text: "Насколько вы уже приняли то, что невозможно вернуть?",
    vector: { introspection: 0.6, hope: 0.4, darkness: -0.5 }
  },

  {
    id: "q-meaning-core",
    theme: "meaning",
    text: "Насколько вы понимаете, что для вас сейчас действительно важно?",
    vector: { introspection: 0.8, hope: 0.4, darkness: -0.2 }
  },
  {
    id: "q-meaning-value",
    theme: "meaning",
    text: "Насколько ваши ежедневные действия совпадают с вашими ценностями?",
    vector: { introspection: 0.7, hope: 0.5, intensity: 0.2 }
  },
  {
    id: "q-meaning-emptiness",
    theme: "meaning",
    text: "Насколько часто вы ощущаете внутреннюю пустоту без ясной причины?",
    vector: { darkness: 0.7, introspection: 0.6, hope: -0.4 }
  },
  {
    id: "q-meaning-belief",
    theme: "meaning",
    text: "Насколько у вас есть внутреннее ощущение, что этот этап имеет смысл?",
    vector: { hope: 0.7, introspection: 0.5, darkness: -0.4 }
  },

  {
    id: "q-fear-change",
    theme: "fear",
    text: "Насколько вы готовы к небольшим изменениям при неопределенности?",
    vector: { freedom: 0.8, intensity: 0.6, darkness: -0.2 }
  },
  {
    id: "q-fear-catastrophe",
    theme: "fear",
    text: "Насколько часто вы ожидаете худший сценарий, даже без явных причин?",
    vector: { darkness: 0.8, intensity: 0.4, hope: -0.5 }
  },
  {
    id: "q-fear-body",
    theme: "fear",
    text: "Насколько телесная тревога мешает вам сосредоточиться на важном?",
    vector: { intensity: 0.6, darkness: 0.7, tenderness: -0.2 }
  },

  {
    id: "q-freedom-choice",
    theme: "freedom",
    text: "Насколько вам хочется выйти за рамки привычных ролей и сценариев?",
    vector: { freedom: 0.9, intensity: 0.6, darkness: 0.1 }
  },
  {
    id: "q-freedom-autonomy",
    theme: "freedom",
    text: "Насколько у вас есть право выбирать собственный темп и путь?",
    vector: { freedom: 0.8, hope: 0.4, darkness: -0.3 }
  },
  {
    id: "q-freedom-pressure",
    theme: "freedom",
    text: "Насколько вы чувствуете давление чужих ожиданий в своих решениях?",
    vector: { freedom: -0.8, darkness: 0.5, introspection: 0.4 }
  },

  {
    id: "q-stability-rhythm",
    theme: "stability",
    text: "Насколько вам сейчас важны тишина, ритм и устойчивый темп?",
    vector: { intensity: -0.6, tenderness: 0.2, introspection: 0.4 }
  },
  {
    id: "q-stability-sleep",
    theme: "stability",
    text: "Насколько ваш сон и базовый режим поддерживают вашу устойчивость?",
    vector: { intensity: -0.4, hope: 0.3, darkness: -0.2 }
  },
  {
    id: "q-stability-overwhelm",
    theme: "stability",
    text: "Насколько легко вы перегружаетесь даже от обычных задач?",
    vector: { intensity: 0.5, darkness: 0.5, hope: -0.3 }
  }
];

export const LIKERT_LABELS = {
  1: { short: "Совсем нет", icon: "◼" },
  2: { short: "Слабо", icon: "◧" },
  3: { short: "Средне", icon: "◩" },
  4: { short: "Скорее да", icon: "◨" },
  5: { short: "Очень", icon: "●" }
};
