# Contributing to Mission Forge

Thanks for helping improve Mission Forge. The goal is to make space-mission trade-offs easier to understand without overstating the fidelity of the model.

## Before opening a pull request

- Explain the learning or engineering problem the change solves.
- State units and assumptions for every new model parameter.
- Cite a credible technical or educational reference when introducing a physical relationship.
- Label game-balancing values as assumptions rather than flight data.
- Add or update tests for changes to mission calculations or validation.
- Keep UI rendering separate from core calculations where practical.
- Update the README if the model, workflow, limitations or setup instructions change.

## Local checks

```bash
npm test
npm run build
```

## Scope

Mission Forge is an educational simulation. Contributions must not describe its estimates as flight-qualified analysis, official NASA data, certified launch capability or real mission probability.
