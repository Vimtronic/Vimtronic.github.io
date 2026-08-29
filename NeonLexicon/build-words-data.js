const fs = require("fs");

function readWords(path) {
  return fs.readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((word) => word.trim().toLowerCase())
    .filter((word) => /^[a-z]{5}$/.test(word));
}

function unique(words) {
  return [...new Set(words)];
}

const answers = unique(readWords("answers.txt"));
const guesses = unique([...readWords("allowed-guesses.txt"), ...answers]).sort();

fs.writeFileSync(
  "words-data.js",
  [
    "window.NEON_LEXICON_ANSWERS = ",
    JSON.stringify(answers),
    ";\nwindow.NEON_LEXICON_ALLOWED_GUESSES = ",
    JSON.stringify(guesses),
    ";\n",
  ].join(""),
);

console.log(`Wrote ${answers.length} answers and ${guesses.length} allowed guesses.`);
