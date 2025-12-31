# Shop Chat Agent - Complete Fix Plan

## Executive Summary

This plan addresses all issues identified in the end-to-end status report to bring the Shopify Chat Agent to production-ready state.

---

## Issue 1: Missing Google API Key

**Status:** CRITICAL - Requires manual action
**File:** `.env`
**Current State:**
```env
AI_PROVIDER=gemini
AI_MODEL=gemini-2.0-flash-exp
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY  # ← Placeholder
```

**Fix Required:**
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create or copy an existing API key
3. Update `.env`:
```env
GOOGLE_API_KEY=AIza...your-real-key
```

**Why This Matters:**
The app is configured to use Gemini (`AI_PROVIDER=gemini`) but will fail all AI requests without a valid key.

---

## Issue 2: Health Check Logic Bug

**Status:** BUG
**File:** `app/routes/health.jsx`
**Lines:** 25-35

**Current (Broken):**
```javascript
const requiredEnvVars = ["SHOPIFY_API_KEY", "CLAUDE_API_KEY"];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
```

**Problem:** Hardcoded to check for `CLAUDE_API_KEY` even when using Gemini.

**Proposed Fix:**
```javascript
// Determine which AI key to check based on provider
const aiProvider = process.env.AI_PROVIDER || 'gemini';
const aiKeyVar = aiProvider === 'claude' ? 'CLAUDE_API_KEY' : 'GOOGLE_API_KEY';
const requiredEnvVars = ["SHOPIFY_API_KEY", aiKeyVar];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
```

**Additional Fixes for This File:**
- Add `/* eslint-disable no-undef */` for `process` (Node.js global)
- Remove unused `request` parameter or add eslint-disable

---

## Issue 3: Lint Errors (13 Total)

### 3.1 `app/routes/health.jsx` (3 errors)

| Line | Error | Fix |
|------|-------|-----|
| 7 | `request` unused | Change to `{ /* request */ }` or remove |
| 11 | `process` not defined | Add `/* global process */` at top |
| 26 | `process` not defined | Same as above |

**Proposed Code:**
```javascript
/* global process */

export async function loader() {  // Remove unused request
  // ... rest of code
}
```

### 3.2 `app/routes/app.jsx` (1 error)

| Line | Error | Fix |
|------|-------|-----|
| 9 | `process` not defined | Add `/* global process */` at top |

**Proposed Code:**
```javascript
/* global process */

import { Outlet, useLoaderData, useRouteError } from "react-router";
// ... rest of file
```

### 3.3 `app/routes/auth.callback.jsx` (2 errors)

| Line | Error | Fix |
|------|-------|-----|
| 93 | `process` not defined | Add `/* global process */` at top |
| 99 | `process` not defined | Same as above |

**Proposed Code:**
```javascript
/* global process */

import { getCodeVerifier, storeCustomerToken, getCustomerAccountUrls } from "../db.server";
// ... rest of file
```

### 3.4 `app/routes/chat.jsx` (2 errors)

| Line | Error | Fix |
|------|-------|-----|
| 117 | `rateLimit` defined but never used | Remove from parameter destructuring |
| 200 | Unnecessary try/catch wrapper | Remove wrapper or add error handling |

**Current (Line 117):**
```javascript
async function handleChatRequest(request, rateLimit) {
```

**Fix:**
```javascript
async function handleChatRequest(request) {
```

**Current (Lines 200-203):**
```javascript
try {
  // ... MCP connection code
} catch (error) {
  throw error;  // Useless catch - just rethrows
}
```

**Fix:** Remove the try/catch wrapper entirely since it just rethrows.

### 3.5 `app/services/validation.server.js` (1 error)

| Line | Error | Fix |
|------|-------|-----|
| 50 | Control chars in regex | Add `// eslint-disable-next-line no-control-regex` |

**This is intentional** - the regex removes control characters for security.

**Proposed Code:**
```javascript
// eslint-disable-next-line no-control-regex
const sanitized = trimmed
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  .trim();
```

### 3.6 `extensions/chat-bubble/assets/chat.js` (4 errors)

| Line | Error | Fix |
|------|-------|-----|
| 15 | `sanitizeHtml` unused | Remove function or use it |
| 428 | Unnecessary escape `\.` | Change `\.` to `.` in regex |
| 525 | Constant condition `while(true)` | Add `// eslint-disable-next-line no-constant-condition` |
| 618 | Lexical declaration in case block | Wrap `case` body in braces `{}` |

**Fix for sanitizeHtml (Line 15):**
The function is defined but never called. Options:
1. Remove it (it's duplicated in the server anyway)
2. Use it for user message display

**Recommended:** Remove it - security sanitization should happen server-side.

**Fix for Line 428:**
```javascript
// Before
const unorderedMatch = line.match(/^\s*([-*])\s+(.*)/);

// After (no change needed - the regex is correct, but useless escape warning is for a different pattern)
```

Actually, looking at line 428:
```javascript
const orderedMatch = line.match(/^\s*(\d+)[\.)]\s+(.*)/);
//                                       ^^ This \. is unnecessary
```

**Fix:**
```javascript
const orderedMatch = line.match(/^\s*(\d+)[.)]\s+(.*)/);
```

**Fix for Line 525:**
```javascript
// eslint-disable-next-line no-constant-condition
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  // ...
}
```

**Fix for Line 618:**
```javascript
case 'new_message': {
  ShopAIChat.Formatting.formatMessageContent(currentMessageElement);
  // ... rest of case code
  break;
}
```

---

## Issue 4: URL Configuration Mismatch

**Current State:**

| Location | Setting | Value |
|----------|---------|-------|
| `.env` | `REDIRECT_URL` | `https://localhost:3458/auth/callback` |
| `shopify.app.toml` | `application_url` | `https://shop-chat-agent.com` |
| `shopify.app.toml` | `redirect_urls` | `https://shop-chat-agent.com/api/auth` |

**Problem:** The redirect URLs don't match between development (.env) and production (shopify.app.toml).

**Analysis:**
- `.env` is for **local development** - localhost is correct
- `shopify.app.toml` is for **production** - should use real domain
- The paths also differ: `/auth/callback` vs `/api/auth`

**Recommended Fix:**

For **development**, keep `.env` as-is (localhost).

For **production**, update `shopify.app.toml` to match the actual callback route:
```toml
[auth]
redirect_urls = [ "https://shop-chat-agent.com/auth/callback" ]

[customer_authentication]
redirect_uris = [
  "https://shop-chat-agent.com/auth/callback"
]
```

**Note:** The actual route is `app/routes/auth.callback.jsx` which maps to `/auth/callback`, not `/api/auth`.

---

## Issue 5: Uncommitted Changes

**Files Modified:**
- `.gitignore`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `vercel.json`

**Untracked Directories:**
- `.claude/` - Project management files
- `api/` - Vercel serverless functions
- `ccpm/` - Unknown purpose

**Recommended Action:**
1. Review changes with `git diff`
2. Stage relevant changes: `git add -A`
3. Commit: `git commit -m "feat: Add Gemini AI support and configuration improvements"`
4. Consider adding `.claude/` to `.gitignore` if it contains local-only files

---

## Implementation Order

### Step 1: Fix Lint Errors (Quick Wins)
1. Add `/* global process */` to 3 files
2. Remove unused variables/parameters
3. Add eslint-disable comments where intentional
4. Fix regex escaping and case block declarations

### Step 2: Fix Health Check Logic
1. Make it AI-provider aware
2. Test with both providers

### Step 3: URL Configuration
1. Update `shopify.app.toml` redirect URLs
2. Ensure consistency with actual routes

### Step 4: Add Google API Key
1. User provides real key
2. Update `.env`
3. Verify with health check

### Step 5: Verify & Commit
1. Run `npm run lint` - should pass
2. Run `npm run build` - should succeed
3. Test health endpoint
4. Commit all changes

---

## Verification Commands

```bash
# Check lint
npm run lint

# Build the app
npm run build

# Test health endpoint (after starting server)
curl http://localhost:3000/health | jq

# Verify Shopify CLI config
npx shopify app config show
```

---

## Shopify-Specific Verification

### Theme Extension
The `chat-bubble` extension is properly configured:
- Type: `theme`
- Has required assets: `chat.js`, `chat.css`
- Has Liquid block: `chat-interface.liquid`
- Has localization: `en.default.json`

### Access Scopes
Current scopes in `shopify.app.toml`:
```
customer_read_customers
customer_read_orders
customer_read_store_credit_account_transactions
customer_read_store_credit_accounts
unauthenticated_read_product_listings
```

These are appropriate for a customer-facing chat application.

### Webhook Version
Using `2025-04` which is current and stable.

---

## Risk Assessment

| Fix | Risk | Mitigation |
|-----|------|------------|
| Lint fixes | Low | No logic changes |
| Health check fix | Low | Only affects monitoring |
| URL sync | Medium | Test auth flow after change |
| API key | Low | Just configuration |

---

## Estimated Time

| Task | Time |
|------|------|
| Lint fixes | 10 min |
| Health check | 5 min |
| URL config | 5 min |
| API key setup | 5 min |
| Testing | 15 min |
| **Total** | **~40 min** |

---

## Ready to Implement?

Confirm to proceed with implementation. I'll make all code changes and verify with lint/build.
