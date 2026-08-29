# Neon Lexicon

A small, static, advert-free five-letter guessing game for personal family play.

## Play

Open `index.html` in a browser, or serve this folder with any tiny static server.

## Word Lists

- `answers.txt` is the manually editable answer list.
- `allowed-guesses.txt` is the larger list of valid guesses.
- `words-data.js` is generated from those text files so the game can load quickly as a static page.

If you edit either text file, regenerate `words-data.js` with:

```powershell
node build-words-data.js
```

## Notes

The starter answer list is familiar and clean, but about 2,300 words rather than 5,000. Expanding it is easy: add one five-letter word per line to `answers.txt`, then regenerate.

Profiles, EXP, streaks, levels, and badges are saved in the browser's local storage on the device being used. Wiping a profile from the cog menu resets that profile on that device.
