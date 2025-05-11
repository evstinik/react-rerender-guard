# React Rerender Guard

[![npm version](https://img.shields.io/npm/v/react-rerender-guard.svg)](https://www.npmjs.com/package/react-rerender-guard)
[![npm downloads](https://img.shields.io/npm/dm/react-rerender-guard.svg)](https://www.npmjs.com/package/react-rerender-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Performance tool that warns about many re-renders in short time.

![React Rerender Guard Demo](https://raw.githubusercontent.com/evstinik/react-rerender-guard/main/docs/preview.webp)

## Features

- Tracking re-renders of all component instances in the tree together.
- Detecting re-render reason much like in React Dev Tools.
- Includes changed hook index

## Installation

```bash
# npm
npm install react-rerender-guard

# pnpm
pnpm add react-rerender-guard

# yarn
yarn add react-rerender-guard
```

## Quick Start

Wrap target component you want to track with `warnManyRerenders`:

```jsx
warnManyRerenders(CounterBase, {
  threshold: 3,
  timeWindow: 3000
})
```

Parameters:

- `treshold` - how many times component should render in given time window to display a warn message
- `timeWindow` - tracking time window

## Requirements

### Peer Dependencies

- React: `^18.0.0 || ^19.0.0`
- React DOM: `^18.0.0 || ^19.0.0`
- React Dev Tools installed in the browser

## Development

Check explanation on how it works here: [./docs/how-it-works.md](./docs/how-it-works.md)

```bash
# Install dependencies
pnpm install

# Start development server with example app
pnpm dev

# Build the library
pnpm build

# Run tests
pnpm test
```

### How to get new version of react-debug-tools

1. Clone official react repository.
2. Build it.
3. Go to `packages/react-debug-tools`
4. `npm pack`

## License

[MIT](LICENSE)
