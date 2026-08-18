# Changelog

All notable changes to this project are recorded in this file.

## 0.1.0 - Unreleased

### Added

- Public ESM package metadata, declarations, and package-consumer checks.
- `MarkovChain.fit` with optional smoothing and an explicit state set.
- Bounded, integer-safe enumeration for trace windows and conductance cuts.
- Implementation-status, contribution, security, and release documents.

### Changed

- Research examples now separate primary-source evidence from SDK support.
- Trace research notes now separate finite implementations from conjectures.

### Fixed

- State-set enumeration no longer uses 32-bit masks.
- Conductance-cut search now rejects work above its explicit candidate budget.
