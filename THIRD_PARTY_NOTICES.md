# Attribution and dependency boundaries

Original implementation, format, tests, examples and documentation were created
independently with AI assistance. They use the [MIT license](LICENSE). No source
from another profiler, private repository, employer or customer was incorporated.
The dominator/reachability techniques are established algorithms; inspiration
and comparison sources are recorded in [related work](docs/related-work.md).

No third-party source or binary is vendored. These separately provided components
retain their own licenses; this project's MIT license does not relicense them:

| Component | Role | License/source |
| --- | --- | --- |
| Node.js | Runtime and built-in file/test APIs | [Node license and bundled notices](https://github.com/nodejs/node/blob/main/LICENSE) (MIT and separately listed component terms) |
| TypeScript 6.0.3 | Pinned development-only static compiler; no runtime dependency | [Apache-2.0 license](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt), [third-party notices](https://github.com/microsoft/TypeScript/blob/main/ThirdPartyNoticeText.txt) |
| actions/checkout v7.0.1 | Configured CI checkout, pinned at `3d3c42e5aac5ba805825da76410c181273ba90b1` | [MIT license](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/LICENSE) |
| actions/setup-node v7.1.0 | Configured CI runtime setup, pinned at `949feb2413d6458794dcd2491c4babbbce0c15c1` | [MIT license](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/LICENSE) |

The package lock records the compiler's version, registry URL and integrity.
The initial published commit passed the configured CI; the README records that
run. No external review service, telemetry, hosted API or asset is required by
the program.
