# AGENTS.md

This file provides guidance for AI coding agents working in this repository.

## Project Overview

IMD Weather App — a Node.js web application that displays weather data from the India Meteorological Department (IMD) API. The project is in early stages with plans for:
- HTML/JS weather display
- Automated daily weather email reports
- Future native Android/iOS apps

## Project Structure

```
IMD_Weather_App/
├── server.js          # Express server entry point
├── package.json       # Dependencies and scripts
└── assets/
    ├── js/            # Client-side JavaScript
    ├── views/         # HTML templates
    └── css/           # Stylesheets
```

## Build / Run / Test Commands

```bash
# Install dependencies
npm install

# Start server
npm start

# Start with auto-reload during development
npm run dev

# Run all tests
npm test

# Run a single test file
npm test -- path/to/test/file.test.js

# Run tests matching a name pattern
npm test -- -t "test name pattern"
```

## Code Style Guidelines

### Language & Runtime
- **Node.js** with **Express.js** framework
- Use **CommonJS** modules (`require`/`module.exports`)
- Target Node.js LTS version

### Naming
- Files: `camelCase.js` (e.g., `weatherService.js`, `apiClient.js`)
- Functions/variables: `camelCase` (e.g., `fetchForecast`, `currentTemperature`)
- Classes: `PascalCase` (e.g., `WeatherService`, `ApiError`)
- Constants: `UPPER_SNAKE_CASE` for true constants (e.g., `BASE_URL`, `MAX_RETRIES`)
- Environment variables: `UPPER_SNAKE_CASE` (e.g., `API_KEY`, `PORT`)

### Imports
- Require built-in Node.js modules first (`path`, `fs`, `http`)
- Then third-party packages (`express`, `axios`)
- Then local modules
- Alphabetize within each group
- Destructure when importing multiple items: `const { get, post } = require('axios')`

### Architecture
- Separate concerns: routes, controllers, services, utils
- Keep `server.js` minimal — delegate logic to modules in `assets/`
- Use middleware for cross-cutting concerns (logging, error handling, auth)
- Pass configuration via environment variables, not hardcoded values

### Formatting
- 4-space indentation
- Single quotes for strings
- Semicolons required
- Opening braces on the same line
- Add blank lines between logical sections
- Keep functions short (< 30 lines preferred)
- Limit line length to ~100 characters
- Trailing commas in multiline objects/arrays

### Async/Await
- Use `async/await` over callbacks or raw Promises
- Wrap async route handlers in try/catch or use an async error wrapper
- Always handle Promise rejections — never leave them unhandled

### Error Handling
- Create custom error classes extending `Error` for domain errors
- Use Express error-handling middleware as the central error handler
- Never silently swallow errors — log and propagate
- Return appropriate HTTP status codes (400, 404, 500, etc.)
- For API errors, return JSON: `{ error: "message", details: ... }`

### HTTP & API Calls
- Use `node-fetch` or `axios` for external API requests
- Store base URLs and API keys in environment variables (`.env` file, excluded from git)
- Always set timeouts on external requests
- Handle network errors gracefully with user-friendly messages

### Client-Side JavaScript (`assets/js/`)
- Use modern ES6+ syntax (arrow functions, template literals, destructuring)
- Keep DOM manipulation in dedicated functions
- Avoid global variables — use modules or IIFEs if needed
- Fetch data with `fetch()` API and handle errors

### HTML (`assets/views/`)
- Use semantic HTML5 elements (`<header>`, `<main>`, `<section>`)
- Link CSS: `/css/style.css`
- Link JS: `/js/app.js`
- Keep markup clean and accessible

### CSS (`assets/css/`)
- Use a single `style.css` or split into logical files
- Prefer class selectors over ID selectors
- Use kebab-case for class names (e.g., `weather-card`, `forecast-list`)
- Mobile-first responsive design

### Security
- Never commit `.env` files or API keys
- Validate and sanitize all user input
- Use `helmet` middleware for HTTP security headers
- Avoid `eval()` and untrusted script injection

### Git Conventions
- Commit messages: imperative mood, concise first line (< 50 chars), body if needed
- Branch names: `feature/<desc>`, `fix/<desc>`, `chore/<desc>`
- Do not commit `node_modules/`, `.env`, or build artifacts
