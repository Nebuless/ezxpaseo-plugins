# Release checklist

- [ ] Version, package name, manifest ID and Paseo range reviewed.
- [ ] Typecheck, tests and live plugin behavior passed.
- [ ] npm dry-run contains every imported module and asset.
- [ ] No credentials, unnecessary fixture data or machine-local paths shipped.
- [ ] Runtime dependencies separate from host devDependencies.
- [ ] Generated output included; npm lifecycle suppression accounted for.
- [ ] Git preparation uses direct argv and lockfile under plugin root.
- [ ] Daemon registry/PATH/platform prerequisites documented.
- [ ] Publish/push/install explicitly authorized if requested.
- [ ] Exact released artifact tested and observed revision recorded.
