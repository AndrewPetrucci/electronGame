# Electron Game

A game project built with [Electron](https://www.electronjs.org/).

## Setup

```bash
cd electronGame
npm install
```

## Run

```bash
npm start
```

## Project structure

- `main.js` – Main process (window, app lifecycle)
- `preload.js` – Preload script (bridge to renderer)
- `index.html` – App UI
- `styles.css` – Styles
- `renderer.js` – Renderer process script

Develop your game logic in `renderer.js` and add canvas or DOM-based gameplay as needed.
