# Delegated persistent profile ownership

The original CLI and library still delegate their tools to pinned Playwright.
A small ownership guard now composes the public `launchPersistentContext`,
`BrowserContext.close` and `Browser.close` APIs. It prevents cooperating fork
processes from concurrently opening the same canonical persistent directory.
Native tests found that WebKit previously allowed this on all three OSs.

A newly acquired `.playwright-mcp-owner` directory contains only version, owner
Node PID and a random token. Creation is exclusive. Profile aliases share the
same canonical lease. Metadata reads are bounded and reject links, malformed
records and changed ownership. POSIX metadata is private; existing profile roots
must belong to the current user and must not permit group/other writes. The
filesystem root is refused. Existing profile contents are never repaired/deleted.

A normal public persistent-context close acknowledges browser/process cleanup
before releasing the exact owned record. Concurrent context/browser closes share
that first close operation: an early close event does not turn a still-pending
acknowledgement into an uncertain failure. If the acknowledgement fails, repeated
closes keep the original failure and do not replay shutdown or release the lease. Browser close uses that same public
context-close path. Disconnected events alone are insufficient. Failed launch,
failed close, unexpected disconnect, changed metadata or dead owner retain the
lease; a disk PID never authorizes killing or stale deletion. Empty-string public
API launches keep Playwright's unique temporary-directory behavior.

| Code | Meaning |
| --- | --- |
| `profile_in_use` | Another live or conservatively retained local owner holds the directory. |
| `profile_cleanup_unknown` | Cleanup/record identity is uncertain; the lease is retained. The original launch/close error is preserved on the failing call. |
| `profile_unavailable` | The configured directory cannot safely host ownership metadata. |

Use a dedicated private directory outside version control for persistent state.
The metadata ignore rule does not protect cookie databases or other profile data.
Keep the original endpoint's `--isolated` option for ephemeral sessions. Clean
`browser_close` releases a normal lease while the MCP connection remains open.
Do not remove a marker based only on its recorded Node PID: a browser may outlive
an abruptly terminated parent. This guard offers no automatic stale reset. Use a
fresh dedicated profile or preserve the uncertain directory for independent
operator review; managed reset/crash recovery remains acceptance work.

This is an ownership guard, not a full profile manager or OS access-control
boundary. Other applications/older versions can ignore its marker. Same-OS-user
filesystem tampering, Windows private ACL enforcement, encryption, retention,
project profile registration, safe reset and external caller-supplied contexts
remain outside this guard. It does not change original network/code privileges or
the batch/jobs endpoints' ephemeral policy. G07/G09 remain incomplete.

Local evidence: seven ownership/cleanup tests on Node20/22/24; real Chromium and
Firefox profile restore/lock plus library/discovery regression; fresh production
package handshake and persistent-profile smoke. Native c7ae948 passed the strict original profile fixture on Chromium,
Firefox and WebKit across all three OSs. The installed Windows process audit
failed separately; creation-time tracking now passes its installed smoke in the
completed9e1371e run; its unrelated failures remain recorded in the ledger.
