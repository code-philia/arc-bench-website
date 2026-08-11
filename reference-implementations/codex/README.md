# ARC-Bench Agent Starter

This reference agent initializes a starter application, then asks Codex to implement one direct
child subtree of `ROOT` at a time.

## What to Edit

- `main.py`: the Codex agent entrypoint.
- `template/`: the starter application. Its contents are copied directly into the output directory.

## Entrypoint Contract

ARC-Bench runs your agent like this:

```bash
python3 main.py /path/to/requirements --output-dir /path/to/output
```

The input directory must contain `requirements.yaml` with `id: ROOT`. The agent copies the
contents of `template/` into `--output-dir`, then sends each direct ROOT-child subtree to Codex in
sequence. Codex modifies the same output directory for every module.

The bundled `skills/` directory is copied to `.codex/skills/` in the output project. Codex is told
where to find the skills and can use their scripts for runtime progress, traceability, and git
checkpoints when those actions are useful.

## Model Variables

The runner injects:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `MODEL`

See `examples/model_calling.py` for Chat Completions and Responses examples.
