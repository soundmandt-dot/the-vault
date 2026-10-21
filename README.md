# THE VAULT

A no-coddle CBT mirror that runs entirely on your device. You type what's
actually going on; it reflects it back, names the distortion, and offers a
reframe. Blunt, like a peer — not a therapist, not a wellness app.

**Nothing you type is stored. Nothing leaves the device. There is no server,
no account, no analytics.** Close the tab and it's like you were never here.
That is not a feature. That is the whole point.

## What this is not

- Not therapy, not diagnosis, not treatment.
- Not a crisis service. If you are in imminent danger, call your local
  emergency number. The Vault is a mirror, not a lifeline — it says so
  itself, in the app, at exactly the moments it matters.

## Why it exists

Mental healthcare is out of reach for a lot of people — money, waitlists,
geography, pride, fear. This is for them: the paycheck-to-paycheck, the
people who would never book an appointment, a scared kid in a bad house at
2 a.m. A sounding board that's never on hold, never judges, and never
phones anyone. Open it like a game. Leave whenever. It keeps nothing.

## How it works

- One HTML file plus a `lib/` folder. No build step, no framework.
- Two on-device engines, picked automatically:
  - **GPU (WebGPU):** Llama 3.2 1B via WebLLM.
  - **CPU fallback:** Llama 3.2 1B via Transformers.js / ONNX — the same
    mind as the GPU engine, just slower. (An earlier 0.5B fallback model
    answered everything with a refusal and was removed 2026-10-21; Llama
    is the floor on every device.)
- First load downloads the model once (~800 MB GPU / ~1.1 GB CPU — use
  Wi-Fi). After that, the model is cached on the device.
- The library files load locally first, with a pinned CDN fallback.
- Conversation memory is five exchanges, held in RAM only, trimmed as it
  grows. The red **PURGE** button wipes the session instantly and keeps
  the model loaded. Nothing is written to disk, ever, by design.
- **TAKE FIVE** offers a paced breathing exercise and a body scan, voiced
  or silent, available before the model even loads.

## The safety design (read this before "fixing" it)

The crisis detection is **narrow on purpose**. It intercepts only
imminent, active danger — a plan for tonight, pills taken, bleeding that
won't stop, or a voice commanding self-harm. Suicidal *ideation* ("I want
to die," "I can't go on") deliberately does **not** trigger the intercept;
it gets a serious-mode reflection plus a box of real human phone numbers
(988, 211, Crisis Text Line, findahelpline). Rationale: a wide net that
slams a form letter on every dark thought trains people to never open the
app again — and the people this is for have nowhere else to take it.
Matching is clause-based and negation-aware: "I don't want to kill myself"
does not fire; "I'm not okay and I'm going to kill myself tonight" does.
This doctrine is the product. PRs that widen the net will be declined with
a link to this section.

## Run it

- **Hosted:** open the GitHub Pages URL for this repo on any modern
  browser. (On iPhone, the hosted URL is required — iOS won't run
  JavaScript from a local file. WebGPU needs iOS 26+; older iPhones get
  the CPU engine automatically.)
- **Self-host:** serve this folder with any static file server
  (`python3 -m http.server` works) over https or localhost. Opening the
  file directly works, but the browser can't keep the model cached for
  next time.
- **Offline, honestly:** the *model* works offline once downloaded. The
  *page* is not yet cached for offline revisits — a service worker is an
  open task below.

## Contributing — doors are open

This project is meant to outlive its author. Help wanted, in rough order:

1. **Translations.** The big one, and harder than it looks. The safety
   matchers are English phrase lists with English negation grammar baked
   in — translating the word lists literally will both miss real cases
   and false-fire on denials. A translation means rebuilding the phrase
   lists from how distressed people actually write in that language,
   adding a test battery for them, and localizing the crisis numbers
   (they're jurisdiction-specific, not language-specific). Spanish is
   the natural first language. If you speak it and you get this
   paragraph, you're who we're waiting for.
2. **Service worker** so the page itself survives offline, completing
   the offline promise.
3. **Matcher test batteries** — more cases: other keyboards, other
   phrasings, more denial shapes. Break the net in a test before life
   does.
4. **Accessibility and small-screen polish.**

Small, tested PRs. Keep the doctrine. Keep it one file.

## License

GPL v3 — see [LICENSE](LICENSE). Use it, fork it, translate it, improve
it. What you build on it stays open under the same terms. That's the
deal, and it's permanent.
