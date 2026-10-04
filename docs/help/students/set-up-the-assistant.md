# Set up the assistant

> **Type:** help · **Audience:** students · **Owner:** `product` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/help.test.ts`

Use this page to give the app an AI key so it can read a syllabus, make a guide and answer questions; stop reading if you only use features that work without one.

## What you need first

- An API key from `console.anthropic.com`, under API keys. It is billed to you by use, separately from Semester. A claude.ai Pro or Max subscription cannot be linked: Anthropic offers no sign-in for other apps.
- Or the address of a proxy you run. If both are filled in, the proxy wins.

## Steps

1. Open **Settings**, then **Semester Intelligence**. From a screen that says "Needs Claude", choose **Set up the assistant** instead.
2. Under **Where the answers come from**, pick **Claude**.
3. Pick a model chip, such as **Sonnet 5**.
4. Paste your key into the **API key** box, or put the address in **Proxy URL**.
5. Choose **Save on this device**.
6. Open a screen that needed it, such as **Add a course**, and try again.

## What you will see

- "Needs Claude" disappears from the screens that asked for it.
- The key is stored in this browser and sent only to Anthropic, when you ask for something.
- On **Semester Intelligence**, the sections **What it can see** and **What it can do** say what the assistant gets and may do ([Control what the AI sees](control-what-the-ai-sees.md)).

## If it does not work

- The key is rejected: this is usually a key from the wrong account. Check it at `console.anthropic.com`.
- A screen offers to sign in instead of using a key. That route is not covered here. Use your own key.
- Anything running in this browser can read a key stored in it. Do not save a key on a shared computer.
- Everything that does not read documents works without a key.

## Where your data goes

The key never leaves the device except to Anthropic. It is not synced and not in your export or backup. What the assistant sees is described on [Control what the AI sees](control-what-the-ai-sees.md).

<!-- live: Ask Claude -->
<!-- labels: Settings | Semester Intelligence | Set up the assistant | Where the answers come from | Claude | Sonnet 5 | API key | Proxy URL | Save on this device | Add a course | What it can see | What it can do -->
