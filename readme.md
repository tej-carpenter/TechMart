# TechMart

Secure e-commerce website with Multi-Factor Authentication.

## Project

TechMart is a small electronics e-commerce application developed for a Cyber Security laboratory project.

The primary security feature is TOTP-based Multi-Factor Authentication.

## Features

- User registration
- Secure password hashing
- Login authentication
- TOTP-based MFA
- Authenticator app QR enrollment
- Manual MFA setup key
- MFA verification during login
- MFA enable/disable
- Account security status
- Security and privacy settings
- Password change
- Product catalogue
- Shopping cart
- Checkout
- SQLite database
- Authentication rate limiting
- Security headers
- Secure HTTP-only session cookie

## Technology

- Node.js
- Express
- SQLite
- better-sqlite3
- bcryptjs
- otplib
- QRCode
- cookie-session
- Helmet
- express-rate-limit

All technologies are free and open source.

## Requirements

Node.js 20 or later.

## Installation

Open a terminal inside the project directory.

Install dependencies:

npm install

## Environment configuration

Copy:

.env.example

to:

.env

Example:

PORT=3000
SESSION_SECRET=replace-with-a-long-random-secret
NODE_ENV=development

## Run

Start the server:

npm start

Open:

http://localhost:3000

## Development mode

Use:

npm run dev

## MFA demonstration

### Step 1

Create an account.

### Step 2

Login using the email and password.

Because MFA is not enabled, the user goes directly into the store.

The navbar displays:

Account not secured

### Step 3

Open:

Account → Security & Privacy

### Step 4

Select:

Set up authenticator app

A QR code will be generated.

Scan it using an authenticator application.

### Step 5

Enter the current 6-digit code.

After successful verification, MFA becomes enabled.

The navbar changes to:

Account secured

### Step 6

Logout.

### Step 7

Login again.

Enter the correct email and password.

The application now requests the authenticator code.

### Step 8

Enter an incorrect code.

The login is rejected.

### Step 9

Enter the current correct authenticator code.

Login succeeds.

## MFA architecture

The login process is:

User
↓
Email + Password
↓
Server validates password
↓
Is MFA enabled?
↓
YES
↓
TOTP verification
↓
Correct code?
↓
YES
↓
Authenticated session

The application does not treat the TOTP code as a replacement for the password.

Both authentication factors are required.

## TOTP

TOTP stands for Time-Based One-Time Password.

The authenticator application generates a changing six-digit code based on:

- A shared secret
- The current time

The server independently calculates/verifies the expected code.

The application does not store the generated six-digit codes.

## Password security

Passwords are hashed using bcrypt.

Plaintext passwords are never stored in the database.

## Database

SQLite is used for local development.

Tables:

users
products
orders
order_items
login_attempts
privacy_settings

## Security status

The navbar displays:

Account secured

when MFA is enabled.

Otherwise:

Account not secured

The status is generated from the authenticated user's account state.

## Important limitation

This application is designed as a local educational project.

It should not be deployed to a production environment without additional security review and production-grade infrastructure.

For a production system, additional protections would be appropriate, including:

- Persistent server-side session storage
- CSRF protection
- Strong production secrets
- HTTPS
- Secure secret management
- Account recovery controls
- Backup/recovery MFA mechanisms
- More extensive authorization controls
- Monitoring and logging
- Production database configuration
- Secure deployment configuration