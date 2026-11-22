# Security

Report vulnerabilities through GitHub's private vulnerability reporting on this repository
(Security → Report a vulnerability). Please don't open a public issue for security problems.

The parts that matter most: the local bridge in `plugin/server/server.mjs` (who may send briefs to an
agent) and the element description in `src/elements.js` (what page data ends up in a brief).
