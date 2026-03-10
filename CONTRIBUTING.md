# Contributing to VoiceLab

Thank you for your interest in contributing to VoiceLab! This document provides guidelines to help you get started.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/VoiceLab.git
   cd VoiceLab
   ```
3. **Set up** the development environment (see [README.md](README.md#installation))
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Guidelines

### Code Style

- **TypeScript/React**: Follow the existing patterns in the codebase. Use functional components with hooks.
- **Python**: Follow PEP 8. Use type hints where possible.
- **Commits**: Write clear, concise commit messages. Use imperative mood ("Add feature" not "Added feature").

### Project Structure

- **Frontend changes** go in `src/renderer/src/`
- **Backend changes** go in `python/app/`
- **New API endpoints** should be added as routers in `python/app/routers/`
- **New TTS engines** should extend `BaseTTSEngine` in `python/app/services/`

### Adding a New TTS Model

1. Create a new engine class extending `BaseTTSEngine` in `python/app/services/`
2. Register the model in `MODELS` dict in `python/app/services/model_manager.py`
3. Add the engine factory case in `ModelManager._get_or_create_engine()`
4. Add download logic in `ModelManager._download_model()`
5. Add frontend model info in `src/renderer/src/lib/constants.ts`

## Pull Requests

1. Make sure your code builds without errors (`npm run build`)
2. Test your changes locally with `npm run dev`
3. Keep PRs focused — one feature or fix per PR
4. Update documentation if your changes affect the user experience or API
5. Fill in the PR template with a clear description

## Reporting Issues

When filing an issue, please include:

- Your operating system and version
- Node.js and Python versions
- Steps to reproduce the problem
- Expected vs actual behavior
- Relevant error messages or logs

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
