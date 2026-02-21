# CLI npm Deployment Guide

## Automatic Deployment (GitHub Actions)

When files in the `cli/` directory are changed and pushed to the `main` branch, GitHub Actions automatically attempts npm deployment.

Workflow: `.github/workflows/publish-cli.yml`

### Deployment Conditions (both must be met)

1. **Path filter**: A commit with changes under `cli/` is pushed to `main`
2. **Version change**: The `version` in `cli/package.json` differs from the version already published on npm

### Deployment Steps After CLI Code Changes

```bash
# 1. Modify CLI code (files under the cli/ directory)

# 2. Bump version in cli/package.json (follow semver rules)
#    - patch (0.1.2 → 0.1.3): bug fixes, minor changes
#    - minor (0.1.3 → 0.2.0): new features, backward compatible
#    - major (0.2.0 → 1.0.0): breaking changes

# 3. Commit & push
git add cli/
git commit -m "feat: description of change"
git push
```

### When You Forget to Bump the Version

If you change CLI code without bumping the version, GitHub Actions will trigger but skip with "Skipped — version already published".

In this case:
```bash
# Bump version in cli/package.json and push again
git add cli/package.json
git commit -m "chore: bump CLI version to x.y.z"
git push
```

### Manual Trigger

You can also manually trigger the workflow via `workflow_dispatch` on the GitHub Actions page.

```bash
gh workflow run publish-cli.yml
```

## Hub (Vercel) Deployment

The Hub web app is connected to Vercel and automatically deploys on `main` push.

- Even CLI-only changes trigger a Vercel redeployment when pushed to `main`
- Vercel environment variables are managed in Vercel Dashboard → Settings → Environment Variables
- When adding new environment variables, make sure to configure them in Vercel as well

## Checking Current Deployment Status

```bash
# Check npm published version
npm view agent-factorio version

# Check recent GitHub Actions runs
gh run list --limit 5

# View logs for a specific run
gh run view <run-id> --log
```
