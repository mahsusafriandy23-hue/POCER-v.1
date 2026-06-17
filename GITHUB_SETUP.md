# Push voucher-platform to GitHub

This folder is already a git repo with a first commit (branch `main`). You only need to create
an empty GitHub repo and push.

## Step 1 — Create an EMPTY repo on GitHub
Go to https://github.com/new and:
- Name: `voucher-platform` (or anything)
- Visibility: **Private** (recommended)
- **Do NOT** add a README, .gitignore, or license (keep it empty — we already have them)
- Click *Create repository*

Copy the repo URL, e.g. `https://github.com/<you>/voucher-platform.git`.

## Step 2 — Point this repo at GitHub and push
On the machine that has this code (your laptop after extracting the tarball):

```bash
cd voucher-platform
git remote add origin https://github.com/<you>/voucher-platform.git
git branch -M main
git push -u origin main
```

If prompted, authenticate:
- HTTPS: use a **Personal Access Token** as the password
  (GitHub → Settings → Developer settings → Tokens, scope `repo`), or
- install the GitHub CLI and run `gh auth login` first.

## Alternative — GitHub CLI one-liner (if you have `gh`)
```bash
cd voucher-platform
gh auth login                      # once
gh repo create voucher-platform --private --source=. --remote=origin --push
```

## Already set
- `.gitignore` excludes `node_modules/`, `dist/`, `.env`, logs — secrets won't be committed.
- First commit is made; `git log --oneline` shows it.

## After pushing — clone elsewhere
```bash
git clone https://github.com/<you>/voucher-platform.git
cd voucher-platform && npm install
cp .env.example .env   # set DATABASE_URL
npx prisma db push && npm run db:seed && npm run start:dev
```

> Tip: keep `.env` out of git (it already is). Set real secrets via your host/orchestrator env,
> never commit them.
