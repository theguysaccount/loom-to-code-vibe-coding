# Launch

Machine-driven: no posts, outreach or ads. Distribution runs through the channels below.

## Live
- Site: https://theguysaccount.github.io/loom-to-code-vibe-coding/ (home, demo, 5 docs pages, 3 guides)
- Repo with Claude Code and Cursor marketplace manifests: https://github.com/theguysaccount/loom-to-code-vibe-coding
- Pinned script: https://cdn.jsdelivr.net/gh/theguysaccount/loom-to-code-vibe-coding@v0.1.0/plugin/toolbar/pointbrief.js

## Production deploy and domain
The domain is a key (OPERATIONS.md, key 1): `screenrecordit.com`, four A records and four AAAA records
to GitHub Pages, `CNAME www`, the Pages custom domain, and the `SITE_URL` variable. The "domain rollout"
session does it; nothing here changes DNS.

## Machine distribution (running)
- **Search pages people look for:** "UI feedback for Claude Code", "show a coding agent what to change",
  "React 19 component source from DOM element (_debugSource removed)", "UI feedback template for AI
  coding agents", plus the docs. Each has a title, description, canonical, Open Graph card and JSON-LD.
- **Sitemap and robots.txt** at the project root; the account's host-root robots.txt lists the sitemap
  automatically (rebuilt daily by theguysaccount.github.io).
- **IndexNow** on every deploy.
- **Share loop in the product:** every brief ends with "Captured with Pointbrief (link)", and briefs get
  pasted into issues, PRs and chats. Users can turn it off (`data-footer="off"`).
- **GitHub discovery:** description and topics (claude-code, claude-code-plugin, mcp, vibe-coding,
  ui-feedback, …), a README with install commands, a v0.1.0 release.
- **Agent-readable install:** the plugin README and skills make "install Pointbrief" work from inside an agent.

## Next channels (each needs an account: OPERATIONS.md, key 4)
Anthropic plugin directory, Cursor Marketplace, npm, Google Search Console.
