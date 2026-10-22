# Private Playwright encoder patch

This private distribution keeps Playwright/core1.64.1 and SDK1.32.1. It prepares
one reviewed change in the core VP9 encoder: `-colorspace smpte170m`, tagging the
existing BT.601 output explicitly. Original tool APIs, browser revisions, flags,
timeouts and workflow permissions otherwise retain their pinned behavior.
This is a fork patch, not an upstream release or permission to publish under
Microsoft's registry identities. Upstream licenses/notices remain included.

The source module is `packages/playwright-core/src/server/videoRecorder.ts` at
Playwright v1.64.1. The corresponding installed `lib/coreBundle.js` hashes are:

- Registry source: `829521b67ed7be90c7d6d6098ff39f2241562d47e4ad7ccab13710924a56001d`.
- Prepared source: `b46a37ecb04912c639ffd32f890269ea33a612dfdcb43f518bac76b85cc0fa9f`.

`npm ci` runs the deterministic prepare script after installing the pinned
registry dependencies. It accepts only the exact original or prepared bytes,
checks the dependency stays inside this checkout's physical node_modules, and
refuses unreviewed versions, shared/link targets and incomplete private output.
It makes one atomic replacement of its own installed source file. A repeated
prepare validates the prepared hash without rewriting it. Receipts use stderr;
`npm pack --json` stdout remains machine-readable.

The tarball uses npm's bundled dependencies for Playwright and core, so both
resolve the same prepared core inside this fork. A production tarball install
with `--omit=dev --ignore-scripts` needs no patch execution. Installed-package
verification checks that module provenance/hash before exercising real endpoints.
Browser downloads remain separate. The combined local dry pack contains297 files,
4,525,569 compressed bytes and20,115,348 unpacked bytes. The earlier unbundled
119-file media checkpoint was434,950/1,376,883 bytes; these are different source
checkpoints, not an isolated size benchmark. This increases the payload to carry
its own runtime pair; it avoids relying on a consumer's shared core installation.

For a source checkout installed with scripts disabled, run `npm run prepare`
explicitly before tests or packaging. On an upstream upgrade, review/rebase the
small source change and establish new exact hashes with full regression evidence;
unknown bytes fail preparation. Preserve any incomplete private output for review
instead of treating a failed preparation as success.

The patch addresses the reproduced matrix-tag color shift. It does not establish
that macOS gray first frames, Windows WebKit media readiness, native deadlines,
historical ownership uncertainty or every video codec works. Those remain
separate acceptance gates and retain their failing evidence.

Docker dependency layers bind the prepare script during both npm installs. The
image verifier resolves core from the actual `/app/cli.js`, checks its hash and
uses only the locally built image. Native image/browser checks remain required.

A caller-supplied BrowserContext or remote Playwright server keeps the host's
encoder implementation. The fork does not modify that host's dependencies. Basic
contextGetter interoperability is tested with a separate unmodified host module;
this patch's fidelity claims concern encoding owned by the prepared runtime.

Pinned upstream playback tests explicitly exclude WebKit/Windows WebM as
“not supported” and mark Windows WebKit audio playback as a known issue (and
“audio does not play at all” in the autoplay test). Its general video test also
notes a Windows Server Media Pack problem on hosted runners. Source:
[capabilities.spec.ts at v1.64.1](https://github.com/microsoft/playwright/blob/v1.64.1/tests/library/capabilities.spec.ts#L69).
This explains the upstream support scope, not the exact mechanism of our WAV
ready0/network2/error0 sample or every Windows host/codec. This fork retains its
strict playback failures; no skip, xfail or assertion/deadline change follows.
Mac WebKit decoded-color fidelity remains a separate failure under investigation.
Exact source blob and scope: evidence/native86-upstream-webkit-media-proof.json.

Metadata-copy diagnostics use an optional external ffmpeg tool, not a product
runtime dependency or fix. CI can install it on macOS within a separate5m step
budget; the existing30m job and all test/action limits remain unchanged. Optional
setup failure is retained without hiding original browser tests. Copies never
replace the original recording or its strict decoded-pixel result. Native86 had
no stock ffmpeg; its empty controls prove no metadata hypothesis. Local gate fix
requires an actual failed result because successful tool replies echo source.
