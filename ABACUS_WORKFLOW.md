# SGI FV - Abacus Workflow Documentation

## 📋 Project Overview

| Property | Value |
|----------|-------|
| **Project Name** | SGI FV - FORMANDO VALORES |
| **Repository** | https://github.com/cirilc01/sgi-fv-prod |
| **Framework** | React 19 + Vite 6 |
| **Language** | TypeScript 5.8 |
| **Package Manager** | npm (package-lock.json) |
| **Backend** | Supabase |
| **Dev Server Port** | 3000 |

---

## 🛠️ Tech Stack Details

### Frontend
- **React**: v19.2.4
- **React Router DOM**: v7.13.0
- **Vite**: v6.2.0
- **TypeScript**: v5.8.2
- **UI Icons**: lucide-react v0.563.0
- **CSS**: Tailwind CSS (via CDN)

### Backend
- **Supabase**: @supabase/supabase-js v2.78.0

---

## 📁 Project Structure

```
/home/ubuntu/project/
├── .env                    # Environment variables (created)
├── .gitignore
├── App.tsx                 # Main React component with routing
├── constants.ts            # App constants and mock data
├── index.html              # HTML entry point
├── index.tsx               # React entry point
├── metadata.json
├── package.json
├── package-lock.json
├── supabase.ts            # Supabase client configuration
├── tsconfig.json
├── types.ts               # TypeScript type definitions
├── vite.config.ts         # Vite configuration
└── pages/
    ├── AdminDashboard.tsx
    ├── Login.tsx
    ├── Register.tsx
    └── UserDashboard.tsx
```

---

## 🔐 Environment Variables

### Required Variables

| Variable | Status | Description |
|----------|--------|-------------|
| `VITE_SUPABASE_URL` | ✅ Set | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ⚠️ **EMPTY** | Supabase anonymous key |
| `GEMINI_API_KEY` | ❌ Not provided | Used in vite.config.ts (optional) |

### Current `.env` File
```env
VITE_SUPABASE_URL=https://ktrrqaqaljdcmxqdcff.supabase.co
VITE_SUPABASE_ANON_KEY=
```

### ⚠️ Known Issue
The `VITE_SUPABASE_ANON_KEY` is empty. The app may use hardcoded credentials in `App.tsx` as a fallback, but this should be properly configured for production.

---

## 🚀 Commands

### Install Dependencies
```bash
cd /home/ubuntu/project
npm install
```

### Run Development Server
```bash
npm run dev
```
- Server runs at: `http://localhost:3000`
- Note: This localhost refers to the Abacus environment, not your local machine.

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

---

## ✅ Current Status

| Item | Status |
|------|--------|
| Repository cloned | ✅ |
| Branch `abacus-dev` created | ✅ |
| Dependencies installed | ✅ |
| Dev server running | ✅ (port 3000) |
| Environment variables | ⚠️ Partial (anon key missing) |

---

## 📝 Git Workflow Checklist

### Before Making Changes
- [ ] Ensure you're on the `abacus-dev` branch
  ```bash
  git branch
  git checkout abacus-dev
  ```
- [ ] Pull latest changes (if remote branch exists)
  ```bash
  git pull origin abacus-dev
  ```

### Making Code Changes
1. **Make your changes** to the relevant files
2. **Test locally** - ensure the dev server runs without errors
   ```bash
   npm run dev
   ```
3. **Build to verify** - ensure no TypeScript errors
   ```bash
   npm run build
   ```

### Committing Changes
1. **Check status**
   ```bash
   git status
   git diff
   ```
2. **Stage changes**
   ```bash
   git add <file1> <file2>
   # Or stage all:
   git add .
   ```
3. **Commit with descriptive message**
   ```bash
   git commit -m "feat: description of changes"
   ```

### Commit Message Guidelines
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Formatting, no code change
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### Pushing to Remote
```bash
git push origin abacus-dev
```
- First push may require: `git push -u origin abacus-dev`

### Creating a Pull Request
1. Go to: https://github.com/cirilc01/sgi-fv-prod
2. Click "Pull requests" → "New pull request"
3. Select:
   - **base**: `main`
   - **compare**: `abacus-dev`
4. Add title and description
5. Click "Create pull request"
6. **Wait for review** before merging

---

## 🔍 Quick Reference

### Check Current Branch
```bash
git branch
```

### View Recent Commits
```bash
git log --oneline -5
```

### Discard Uncommitted Changes
```bash
git checkout -- <file>
# Or discard all:
git checkout -- .
```

### Create New Feature Branch (from abacus-dev)
```bash
git checkout -b feature/my-feature abacus-dev
```

---

## ⚠️ Important Notes

1. **Never commit to `main` directly** - always use feature branches and PRs
2. **Never force push** to main/master branches
3. **The `.env` file is gitignored** - sensitive credentials won't be committed
4. **Test before committing** - run `npm run build` to catch TypeScript errors
5. **Document changes** - update README.md if adding new features

---

## 📅 Document Info

- **Generated**: February 19, 2026
- **Environment**: Abacus.AI
- **Branch**: `abacus-dev`

