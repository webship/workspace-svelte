---
name: svelte-scenarios
description: Write and fix webship-js scenarios for a SvelteKit app with the Svelte step pack (`@webship-js/svelte-steps`) in the Webship Workspace — the pack's phrases for the app taking a page over, its navigation, its forms and its error pages, how the steps name things (a link or a button by its name, from its start), the two lanes (with JavaScript and without), the traps found on a real app, and three example features that pass. Use when writing a feature for a SvelteKit app, choosing the phrase for a link, a form or an error page, or reading why a Svelte scenario failed.
---

# svelte-scenarios

Scenarios for SvelteKit apps in a Webship Workspace (`~/workspace`), a container-based workspace (DDEV by
default), with webship-js and [`@webship-js/svelte-steps`](https://github.com/webship/svelte-steps). An
app of the Svelte builder (`cmd-svelte-project.sh`) gets the pack with `bash cmd-tools-testing.sh <app>`;
the suite runs in the app's container (`bash cmd-tools-testing.sh <app> --run`).

A page arrives as the server's HTML; the app's start script then takes it over in the browser. Every
step of the pack that acts waits for that first, when the page loads the start script and the browser
runs JavaScript; a page built without client-side code, and every page in a browser without
JavaScript, have nothing to wait for, and the run's log says so.

## The phrases

Check them against the installed pack before you use them
(`grep -hE "^(Given|When|Then)\(" node_modules/@webship-js/svelte-steps/tests/step-definitions/*.steps.js`).

**The app**

```gherkin
Given the app has taken over the page
Then the app should have taken over the page
Then the page should have no client-side code
When I wait for the app to come to rest
```

**Navigation**: a link by its name; how the last navigation ended; what screen readers were told.

```gherkin
When I follow the "Sverdle" link in the app
When I go back in the app
When I point at the "Sverdle" link
Then the last navigation should have stayed in the app
Then the last navigation should have loaded a whole page
Then the navigation should be announced as "Sverdle"
Then the "Sverdle" link should mark the current page
Then I should be at the top of the page for the keyboard
```

**Forms**: a form by the button that sends it; whether the app took it; how it was sent.

```gherkin
When I submit the form with the "enter" button
Then the app should have accepted the form
Then the app should have refused the form
Then the form should have been sent without loading the page
Then the form should have been sent with a page load
```

**Error pages**

```gherkin
Then the page should show the 404 error
Then the page should show the 404 error "Not Found"
```

webship-js's own steps still go to an address (`Given I am on "/sverdle"`), read the page
(`Then I should see "About this app"`), fill in fields and press keys. A button with a label and no text
(an icon) is pressed with `When I press "Increase the counter by one" by attr` (its `aria-label`).

## The traps

- **A name matches from its start.** Exactly, then without regard to case, then by its start (three
  characters or more); never a part in the middle. A link whose text holds an icon's letter reads with it:
  the demo's "How to play" link is named "i How to play". A failure lists the names it found.
- **A click before the app has taken the page over loads a whole page.** The pack's steps wait; a step
  of webship-js (`I click`, `I press`) does not: tag the scenario `@settle-after-steps`, or add `When I
  wait for the app to come to rest` after it.
- **A link the pointer rested on sends no request when it is clicked**: the app fetched the page ahead.
  Never assert a navigation by a request; `Then the last navigation should have stayed in the app` reads
  what happened to the document.
- **A page built without client-side code** (`csr = false`) is taken over only when it is reached inside
  the app; loaded directly it has none, and its links load whole pages.
- **An address the app does not know is a whole page load**, even from a link of a page the app has
  taken over: `Then the page should show the 404 error` reads the status and the first heading.
- **A form refused by the app answers 400** (`fail(400)` in its action), and the browser logs it as an
  error: keep webship-js's error mode at `warn` for a scenario that expects a refusal. A 403 is the
  app's check against cross-site forms: the browser was started with `--disable-web-security`, which the
  testing setup takes out of `playwright.config.ts`.
- **The current link** is marked with `aria-current="page"` on the link or on the item of the list it
  sits in: both count.
- **Two lanes.** `@needs-javascript` for a scenario that holds only with JavaScript, `@no-javascript` for
  one that holds only without it; never `@javascript`, which webship-js reads as "fail on any browser
  error".
- **No fixed waits.** The steps wait on the app's own signals; a Then step waits for what it expects.

## The examples

Three features that pass, each against the app it names:

- [`examples/pages-and-navigation.feature`](examples/pages-and-navigation.feature): the demo of the
  create tool (`bash cmd-svelte-project.sh skapp --install`), its pages and links.
- [`examples/word-game.feature`](examples/word-game.feature): the demo's word game, one form of buttons
  (the same app).
- [`examples/minimal.feature`](examples/minimal.feature): the minimal template
  (`bash cmd-svelte-project.sh skmin --template minimal --install`), one page and the error page.

## The book

For any automated functional testing in this work (a Gherkin feature, a step definition, choosing a
step, a test run and its failures), read the book *Automated Functional Testing Recipes* first.

- **Where.** Use the first that exists: `.claude/automated-functional-testing-recipes/` in the project,
  `~/.claude/automated-functional-testing-recipes/` (installed by webship/webship-js-ai-agent,
  webship/webship-js-skills or webship/ai-agents), or
  https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes
- **How.** Its `README.md` first, then the chapter that matches the task (one file per chapter,
  named by its subject), not the single complete file.
- **Which wins.** The installed webship-js package and the step pack are the source of truth for
  step phrasing. When they differ from the book, follow them and say so.
- **For Svelte.** Start with `ch27-testing-spa.md` (an app that moves between its pages without page
  loads), `ch07-waiting-dynamic-content.md` (why a wait names its signal, never a time),
  `ch15-accessibility-testing.md` (names a person reads, the announcement of a new page) and
  `ch21-when-tests-go-bad.md` (flaky, brittle and slow scenarios).
