# Public SDK Repair Status

Status: complete

## Product Decision

Prepare `markov-pax` as a Bun-first, standard ESM, public SDK at version `0.1.0`.
Use the MIT license with `Pax` as the copyright holder. Make the package
release-ready, but do not publish it.

## Readiness

| Gate | Status | Notes |
| --- | --- | --- |
| Product goal | ready | The user approved the public SDK repair plan. |
| Runtime contract | ready | Bun 1.3.14 development and standard ESM output. |
| Release boundary | ready | Release-ready only. No publish, tag, push, or commit. |
| Research boundary | ready | Keep conjectures as bounded notes, not SDK promises. |
| Correctness and fitting | complete | Integer-safe bounded enumeration and `MarkovChain.fit` are verified. |
| Public package | complete | ESM, declarations, pack contents, and clean consumer use pass locally. |
| Documentation | complete | API, status, evidence, research, license, contribution, security, and benchmark documents pass the link check. |
| Release enforcement | complete | The local release gate passes and GitHub CI has the same steps. |

## Next Action

Commit and push only after user approval. Then verify the hosted GitHub CI run before publication.
