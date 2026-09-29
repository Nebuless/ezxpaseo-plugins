# RPC verification

Checked 2026-09-29.

Sources:

- Paseo plugin reference, cleanup and pending RPC behavior:
  https://paseo.sh/docs/plugins/reference.md#entry-point-and-cleanup
- Paseo plugin reference, logs and host verification:
  https://paseo.sh/docs/plugins/reference.md#debug-backend-output
- Runtime bundling guidance:
  https://paseo.sh/docs/plugins/reference.md#runtime-modules

## Static checks

Run from the suite repository root:

```bash
node .agents/skills/paseo-plugin-authoring/scripts/validate-plugin.mjs /absolute/path/to/plugin
```

Then run inside the plugin:

```bash
npm run typecheck
npm test
```

The validator checks packaging, manifest, imports, and static structure. It cannot prove that the
daemon loaded the bundle or that an RPC crossed the real transport.

## Host checks

```bash
paseo plugin reload <runtime-id>
paseo plugin ls <runtime-id>
paseo plugin logs <runtime-id>
```

Require `running`, then invoke:

1. a valid request and observe the actual host-side result;
2. an over-limit or malformed request and observe schema rejection;
3. a request after reload to prove the active bundle changed.

If output validation fails after a side effect, the side effect is not rolled back. Keep the returned
shape simple and construct it before irreversible work.
