# Web test runner

> This project is experimental.

A test runner for the modern web.

## Project goals

- Run tests in a real browser
- View/debug tests in the browser
- Run tests headless from terminal
- Support for test isolation
- Based on es-modules, no global variables
- Single tests can be run standalone without requiring special commands (for example copy them to an online code editor)
- Can use any assertion library
- Configure browser environment (viewport, network etc.) from tests
- Support for multiple browsers

## Usage

The project has not been published yet.

## Running the project locally

This project is built with es modules, in the browser and in node. It has only been tested with node v14.

`npm run start` runs the tests standalone
`npm run test` does a single test run
`npm run test:watch` runs tests in watch mode, reloading on changes

## Technologies

- [es-dev-server](https://www.npmjs.com/package/es-dev-server)
- [puppeteer](https://www.npmjs.com/package/puppeteer)
