# Contributing to Netlist2SVG

Thank you for your interest in contributing to Netlist2SVG! This document provides instructions for developers looking to contribute code, fix bugs, or manage releases.

## Development Setup

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/ajsb85/netlist2svg
    cd netlist2svg
    ```
2.  **Install dependencies:**
    ```sh
    npm install
    ```
3.  **Build the project:**
    ```sh
    npm run build
    ```
4.  **Run tests:**
    ```sh
    npm test
    ```

## NPM Publishing (Maintainers Only)

Netlist2SVG uses **NPM Trusted Publishing** via OpenID Connect (OIDC). This allows GitHub Actions to publish directly to NPM without long-lived tokens, improving security and providing cryptographic provenance.

> **Security Note:** This project follows the "Maximum Security" posture. Traditional NPM tokens are disallowed, and publishing is only permitted via the authorized GitHub Actions workflow using short-lived OIDC identities.

### Release Process

The project is configured to publish automatically whenever a new version tag is pushed:

1.  **Bump Version:** Update the version in `package.json`.
2.  **Verify locally:** Run `npm test` and `npm run build`.
3.  **Push Tag:**
    ```sh
    git tag v1.x.x
    git push origin main
    git push origin v1.x.x
    ```
4.  **OIDC Authentication:** The `Publish Package` workflow will automatically request a temporary token from NPM and publish with **Provenance**.

### Supply Chain Security

We use [Socket Security](https://socket.dev) to audit our dependencies for malware, typo-squatting, and suspicious updates. All PRs are automatically scanned to prevent supply chain attacks.

### Dependency Graph

Below is a visualization of the project's internal module dependencies:

![Dependency Graph](./docs/dependencies.svg)

## Code Style

- Use **Single Quotes** for strings.
- Ensure all TypeScript types are correctly defined.
- Run `npm run lint` before committing.
