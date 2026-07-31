# ARC-Bench TypeScript Agent Starter

Edit `index.ts` and keep it at the zip root. Keep `package.json` at the zip root; ARC-Bench runs `npm install` before your agent starts.

ARC-Bench runs your agent through the locally installed `tsx` binary:

```bash
tsx index.ts /path/to/requirements --output-dir /path/to/output
```

Your agent should read the task requirements, modify the project under `--output-dir`, and exit with code `0` when finished.

The runner injects `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `MODEL`. See `examples/model_calling.ts`.

You may use the JavaScript/TypeScript SDK package `arcbench-agent-runtime-js`, the bundled `skills/`, or both. See `examples/sdk_and_skill_usage.ts`.
