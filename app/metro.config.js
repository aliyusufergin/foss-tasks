// Metro in an npm workspace. Two defaults break once the app stops being the
// repo root, and both fail at bundle time — CI never builds the bundle, so a
// mistake here is only ever caught on a device (docs/agents/verification.md).
//
// 1. Metro watches only the project directory, so edits to packages/domain
//    would be invisible and its files unresolvable. watchFolders adds the root.
// 2. npm hoists dependencies to the root node_modules, so most of the graph
//    (react-native, expo, uuid, …) no longer lives under app/node_modules.
//    Both candidate roots must be searched, app's first so any locally-nested
//    copy still wins.
//
// @foss-tasks/domain is consumed as a symlink into packages/domain, resolved via
// its `main` field to compiled JS in dist/ — never its TypeScript source, which
// carries .js extensions Metro will not map (ADR-0008 §11).
//
// CAVEAT: as of T04a-0 no *value* import of @foss-tasks/domain reaches the
// bundle — app/src imports only its types, which are erased. Resolution of the
// symlinked package was proved on a device with a temporary probe import, but
// nothing standing re-proves it. The first real value import (#5's Add button)
// is where a regression here would surface. Until then, after touching this file
// or the workspace layout, bundle explicitly rather than trusting a green CI:
//
//   curl -s -o /dev/null -w '%{http_code}\n' \
//     'http://localhost:8081/app/index.bundle?platform=android&dev=true&minify=false'
//
// Note the /app/ prefix: watchFolders moves Metro's server root to the repo root.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
