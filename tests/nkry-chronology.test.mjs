import test from "node:test";
import assert from "node:assert/strict";

import {
  parseConcordanceCandidates,
  pickEarliestCandidate,
  computeYearConfidence
} from "../server.mjs";

function makePayload(word, rows) {
  return {
    pagination: { maxAvailablePage: 12 },
    sorting: { currentSorting: "grcreated" },
    groups: [
      {
        docs: rows.map((row, idx) => ({
          info: {
            title: row.title,
            source: { docId: row.docId || `doc-${idx}` },
            docExplainInfo: {
              items: [
                {
                  parsingFields: [
                    { name: "author", value: [{ valString: { v: row.author } }] },
                    { name: "publ_year", value: [{ valString: { v: row.year } }] }
                  ]
                }
              ]
            }
          },
          snippetGroups: [
            {
              snippets: [
                {
                  source: {
                    docSource: { docId: row.docId || `doc-${idx}` },
                    start: Number(row.start ?? idx),
                    end: Number(row.end ?? idx + 1)
                  },
                  sequences: [
                    {
                      words: [
                        { type: "WORD", text: row.quote, displayParams: { hit: Boolean(row.hit) } }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }))
      }
    ]
  };
}

test("control words: chronology picks expected earliest year from candidates", () => {
  const matrix = [
    {
      word: "молоко",
      rows: [
        { author: "A", title: "t1", year: "1886", quote: "молоко", hit: true, docId: "a" },
        { author: "B", title: "t2", year: "1735", quote: "молоко", hit: true, docId: "b" }
      ],
      expectedYear: 1735
    },
    {
      word: "картошка",
      rows: [
        { author: "A", title: "t1", year: "2002", quote: "картошка", hit: true, docId: "a" },
        { author: "B", title: "t2", year: "1850", quote: "картошка", hit: true, docId: "b" }
      ],
      expectedYear: 1850
    },
    {
      word: "самолет",
      rows: [
        { author: "A", title: "t1", year: "1912", quote: "самолет", hit: true, docId: "a" },
        { author: "B", title: "t2", year: "1908", quote: "самолет", hit: true, docId: "b" }
      ],
      expectedYear: 1908
    },
    {
      word: "люк",
      rows: [
        { author: "A", title: "t1", year: "2001", quote: "люк", hit: true, docId: "a" },
        { author: "B", title: "t2", year: "1820", quote: "люк", hit: true, docId: "b" }
      ],
      expectedYear: 1820
    }
  ];

  for (const item of matrix) {
    const parsed = parseConcordanceCandidates(makePayload(item.word, item.rows), item.word, 1);
    const best = pickEarliestCandidate(parsed.candidates);
    assert.ok(best, `best candidate missing for ${item.word}`);
    assert.equal(best.yearNum, item.expectedYear, `unexpected year for ${item.word}`);
  }
});

test("dedup by doc+fragment keeps best duplicate candidate", () => {
  const candidates = [
    {
      quote: "поздний дубль",
      author: "A",
      title: "T",
      year: "2001",
      yearNum: 2001,
      page: 7,
      relevanceScore: 0.8,
      docId: "doc-1",
      snippetStart: 10,
      snippetEnd: 20
    },
    {
      quote: "ранний дубль того же фрагмента",
      author: "A",
      title: "T",
      year: "1810",
      yearNum: 1810,
      page: 12,
      relevanceScore: 1,
      docId: "doc-1",
      snippetStart: 10,
      snippetEnd: 20
    },
    {
      quote: "другой фрагмент",
      author: "B",
      title: "X",
      year: "1820",
      yearNum: 1820,
      page: 2,
      relevanceScore: 1,
      docId: "doc-2",
      snippetStart: 1,
      snippetEnd: 2
    }
  ];

  const best = pickEarliestCandidate(candidates);
  assert.ok(best);
  assert.equal(best.yearNum, 1810);
  assert.equal(best.docId, "doc-1");
});

test("yearConfidence is exposed and bounded", () => {
  const modes = ["lex", "form"];
  const candidates = [
    { yearNum: 1800, relevanceMode: "hit", relevanceScore: 1 },
    { yearNum: 1800, relevanceMode: "hit", relevanceScore: 0.9 },
    { yearNum: 1810, relevanceMode: "stem", relevanceScore: 0.82 }
  ];
  const best = { yearNum: 1800, relevanceMode: "hit", relevanceScore: 1 };
  const confidence = computeYearConfidence(best, candidates, modes);
  assert.ok(confidence >= 0 && confidence <= 1);
  assert.ok(confidence >= 0.7);
});
