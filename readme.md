# TechMart — MFA E-commerce Lab

A free local e-commerce demonstration website for a cybersecurity lab.

## Features

- Home page
- Product browsing and category filters
- Client-side shopping cart
- Registration
- Login
- Password hashing with bcrypt
- TOTP MFA using authenticator apps
- QR-code MFA setup
- MFA verification during login
- Security & Privacy settings
- Navbar status: "Account secured" / "Account not secured"
- SQLite local database
- No paid APIs or services
- Responsive CSS

## Requirements

- Node.js 22 LTS
- npm
- GitHub Codespaces, VS Code, or another local Node environment

## Run in GitHub Codespaces

```bash
nvm install 22
nvm use 22
node -v
```

Then:

```bash
rm -rf node_modules
npm install
```

If npm shows:

```text
npm warn install-scripts ... better-sqlite3 ... not yet covered by allowScripts
```

run:

```bash
npm install-scripts approve better-sqlite3
npm rebuild better-sqlite3
```

If the command above is not available in your npm version, rebuild from source:

```bash
sudo apt-get update
sudo apt-get install -y build-essential python3
npm rebuild better-sqlite3 --build-from-source
```

Start the site:

```bash
npm start
```

For development:

```bash
npm run dev
```

Codespaces will show a forwarded port. Open port 3000.

## Important

Do not run `npm audit fix` before the project is working. It can change dependency versions and is unnecessary for fixing a CSS/static-file problem.

## MFA test procedure

1. Open Register.
2. Create an account.
3. Log in normally.
4. Open Security & Privacy.
5. Under Multi-factor authentication, click Set up MFA.
6. Scan the QR code with Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app.
7. Enter the six-digit code.
8. MFA becomes enabled.
9. The navbar changes to "Account secured".
10. Log out.
11. Log in again with the same password.
12. The site asks for the authenticator code.
13. Enter the current six-digit TOTP code.
14. Login completes.

## Database

The SQLite database is created automatically at:

```text
data/techmart.db
```

The `data` directory is created automatically by the server.

## Lab note

This project is designed as a local educational demonstration. It uses a local SQLite database and an Express session store intended for a lab environment, not production deployment.
