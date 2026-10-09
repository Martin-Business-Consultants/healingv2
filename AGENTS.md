<!-- librepublish:cms-agent -->
# Working with the localhost CMS

This directory is wired to a LibrePublish CMS at https://healing-at-the-well-cms-production-d115cc.192-34-60-169.sslip.io. Content
lives in the CMS; the public site is an Astro app in its own GitHub repo. You
read and write content with the `cms` CLI, and you change the site itself the
normal way — clone, branch, PR.

Everything the CMS's own admin UI can do to content, structure and site
operations is reachable from `cms`. If you find yourself asking a human to go
click something, check `cms commands --json` first — it's probably there.

Two flags first, because they change how much of the rest you need to read:

- **`--agent`** wraps every answer as `{status, summary, data, breadcrumbs}`.
  The breadcrumbs are the next commands to run, already filled in with the ids
  and paths just returned — so the surface teaches itself as you use it.
- **`cms commands --json`** is the entire command set, with flags and traps, in
  one call. Cheaper than learning it one usage error at a time.

## Site repo

The repo is recorded in the CMS, not in this file — ask the CMS for it:

```sh
cms get /settings/github     # → data.frontend_github_repo, e.g. "acme/acme-site"
```

Do that before any task that touches the site itself (templates, layout,
styling, build config, anything that isn't content), then:

```sh
gh repo clone <frontend_github_repo> && cd <repo>
```

The site is the frontend of this headless CMS: it fetches content as JSON and
renders it. Its own `AGENTS.md` (written there by the CMS's Astro integration,
and at https://healing-at-the-well-cms-production-d115cc.192-34-60-169.sslip.io/frontend/AGENTS.md) explains how — the JSON shapes, blocks,
forms and rebuilds. Read it before changing templates.

**If `frontend_github_repo` comes back blank, ask the user which Astro repo
this CMS publishes and write it back to the CMS** so no later session — yours
or another agent's — has to ask again:

```sh
cms patch /settings/github '{"setting":{"data":{"frontend_github_repo":"owner/name"}}}'
```

Store it as `owner/name`, not a URL. The `token` under that same key reads back
masked (`***abcd`) — that's deliberate, and it doesn't affect the repo field.

## The CMS

```sh
cms doctor      # can this machine work, and what's stopping it
cms whoami      # who this token acts as, and what it's allowed to do
cms manifest    # the shape of this CMS: collections, frontmatter schemas,
                # block types + their JSON schemas, globals, forms, brand, counts
cms commands    # everything else (add --json for the machine-readable form)
```

Start with `cms manifest`. It answers most structural questions in one call —
which collections exist, what fields their entries carry, which blocks a page
may be composed from — so you don't have to guess a schema and get a 422.

### Write in the workspace's voice

`cms brand` returns the brand brief the owners wrote: voice, audience, facts
that have to stay accurate, and house style rules. **Read it before you write
any copy.** It's the difference between prose that sounds like the site and
prose that has to be rewritten. If it's empty, ask the user for a sentence on
voice and audience rather than inventing one.

### Reading

```sh
cms pages                       # every page (add --status published, --locale en)
cms page about/team             # one page, blocks and assets expanded
cms collections
cms entries posts --status published
cms entry posts my-first-post
cms globals                     # nav, footer, …
cms search "pricing"
cms refs Page 12                # what links to this record
```

### Writing

```sh
cms post  /pages '{"page":{"slug":"pricing","title":"Pricing","status":"draft","locale":"en"}}'
cms patch /pages/pricing '{"page":{"title":"Plans & pricing"}}'
cms patch /collections/posts/entries/my-first-post - < entry.json

cms publish pricing about/team  # flip pages to published
cms unpublish pricing
cms entry-status posts published my-first-post
```

### Undo

Deletes go to the trash, not the void:

```sh
cms delete /pages/pricing       # → trash
cms trash                       # what's recoverable
cms restore page 12
cms purge page 12               # permanent, no undo
```

### Structure

Schemas are editable too — field definitions for a page, a collection's
entries, or a global:

```sh
cms schema collection posts < fields.json
cms seed-blocks                 # starter-pack block types, empty sites only
```

### Shipping and operations

```sh
cms deploy                      # hook config + whether the last build worked
cms deploy now                  # trigger a rebuild
cms redirects all               # every rule, with hit counts
cms redirect add /old /new 301
cms submissions                 # form inbox across every form (Forms plugin)
cms quotes --status new         # quote requests (Commerce plugin)
cms audit --actor alice           # who changed what
cms webhooks
cms backup > backup.tar.gz
```

Anything the curated commands don't cover is reachable with
`cms get|post|patch|delete <path>` — it's the same API the site build uses.

### Selling by quotation

Needs the **Commerce** plugin installed and switched on; without it these
commands answer 404. A site that sells by quote rather than by cart posts its "Request a quote"
button to `POST /api/quote_requests` (unauthenticated, CORS like forms) with
the customer's details and the items as the visitor saw them. Those land in
the **quote inbox**; an **invoice** is what the shop sends back.

```sh
cms quotes --status new                 # the inbox
cms quote 12                            # items, message, staff notes, invoices so far
cms quote-status 12 quoted --notes "called, wants freight to Ohio"
cms invoice-create --from-quote 12      # a draft: customer + one line per item, at the listed price
cms patch /invoices/3 '{"invoice":{"line_items":[…],"shipping_cents":45000,"payment_link":"https://buy.stripe.com/…"}}'
cms invoice-send 3                      # emails the customer the hosted page and the payment link
cms invoice-paid 3                      # the quote behind it becomes won
```

The CMS never moves money: `payment_link` is whatever the shop's processor
issued. Sending needs `invoices:send`, which the Agent role does not hold —
draft the invoice, set the link, and leave the send to a person.
`cms get /settings/commerce` holds who is notified, the invoice prefix and
the business details printed on invoices.

### Writes to live content need the publish capability

If your token's role doesn't hold the publish capability for what you're
editing (`pages:publish`, `entries:publish`, `globals:publish`), a write that
changes something **already live** — a published page or entry, or any global —
is refused with **403**, and so is a write that would publish or schedule a
draft. Nothing is saved, and nothing is queued for review.

Drafts are unaffected: writes to an unpublished record that leave it a draft
apply immediately. When the work is done but only a publish is blocked, leave
it as a draft and tell the user it's ready for someone who can publish it.

### With the Approvals plugin on, writes wait for a person

When the install runs the Approvals plugin, every page, entry or global you
create, change or delete answers **202** with `"status": "pending_approval"`
instead of the record: nothing has changed yet. A person compares it with
what's live in Approvals, may edit it, and approves it (which puts it live) or
rejects it. Tell the user the change is waiting, with the `approval.path`.
Follow it up with `cms get /approvals/<id>` (`state`: pending, approved,
rejected). The bulk endpoints answer **409** meanwhile: change records one at
a time.

## Service tokens

A service token is a credential for a machine — the published site, a build
pipeline, an agent — rather than for a person. It belongs to the workspace and
carries the role named on it, so nothing that happens to a human account takes
production down.

```sh
cms service-tokens                          # every token, and the roles available
cms service-token create --name PRODUCTION --role "Production site"
cms service-token reveal 3                  # show the secret again
cms service-token rotate 3                  # new secret; the old one dies at once
cms service-token revoke 3
```

The published Astro site holds a **read-only** token on the **Production site**
role, stored in its environment as `CMS_API_TOKEN` (what `@librepublish/astro`
reads). That is not the token you
are using: agents run on `USER_AGENT_TOKEN`, which sits on the **Agent** role and
can write drafts but not publish or change live content. Don't reach for one when the task calls for the other.

Only `create`, `reveal` and `rotate` return a secret, and only once each. Print
it for the person who asked; never write one into this file, into the site repo,
or into a commit. Issuing one needs `settings:write`, the same capability the
admin UI asks for.

## Credentials

Credentials live in `~/.config/cms/<profile>.env` (mode 600) as `CMS_URL` and
`USER_AGENT_TOKEN`, or in the environment if you'd rather pass them
per-command. The token authenticates you as a **user**, with exactly that
user's role — the same permissions they have in the web UI.

One machine can hold several identities — a person and a service account, or
two sites. `cms profiles` lists them; `--profile <name>` or `CMS_PROFILE`
picks one. With a single profile configured, it is used automatically.

Never write the token into this file, into the site repo, or into a commit. If
it leaks, or a call comes back `401`, reconnect in a browser — nothing is
pasted anywhere:

```sh
cms login --url https://healing-at-the-well-cms-production-d115cc.192-34-60-169.sslip.io
```

## Rules

- **A 403 means the role doesn't grant it**, not that the API is broken. Say so
  and stop; don't hunt for a way around it. If the work is finished but you
  can't publish it, leave it as a draft and say which one is ready, so it's
  waiting on a human rather than lost.
- **Draft first.** Create pages and entries with `"status":"draft"` unless the
  user asked for them published — publishing is visible to the world and
  triggers a site rebuild.
- **The CMS is the source of truth for content**, the repo is the source of
  truth for templates and layout. Don't hard-code copy into the Astro repo that
  belongs in a collection, and don't reshape a collection to work around a
  template you could change instead.
- **Verify before you call it done.** For site changes that means the repo's own
  checks (`npm run build` at minimum) and a PR — not just a green diff. For
  content changes, re-read what you wrote (`cms page <path>`) and confirm it
  looks the way you intended. If you triggered a deploy, `cms deploy` tells you
  whether it actually succeeded — check, don't assume.
- **A slug change orphans inbound links.** Add the redirect in the same breath:
  `cms redirect add /old-path /new-path 301`.
- Report what you actually did: what you changed in the CMS, what you changed in
  the repo, and anything you couldn't verify.

<!-- librepublish:cms -->
# This site is the frontend of a headless CMS

The content of this site — its pages, collections, navigation, footer, forms,
redirects — lives in the localhost CMS at https://healing-at-the-well-cms-production-d115cc.192-34-60-169.sslip.io. The CMS never
renders HTML for visitors. It stores content and serves it as JSON; **this
repo reads that JSON and renders it**, through the `@librepublish/astro`
integration. Keep that split:

- **Content changes happen in the CMS**, not here. Don't hardcode copy, nav
  items, prices, contact details or anything else an editor would expect to
  change. If a template needs text, it reads it from a global or a field.
- **Structure and presentation happen here**: layouts, components, styling,
  routing, build config.

This section of AGENTS.md is written by the integration (`cms()` in
`astro.config`) on every `astro dev` and `astro build`, between its markers.
Edit outside them; inside, your changes are replaced.

## The integration

| Package | What it gives the site |
|---|---|
| `@librepublish/astro` | The `cms()` integration; content loaders (`/loaders`); live loaders and `cacheHint` (`/live`); a typed client, `linkHref`, `routeParam` and the types (`/client`); forms — `getForm`/`getForms` and the form email helpers (`/forms`); quotes — `commerceEnabled` (`/commerce`); `<Blocks>`, `<Image>`, `<Seo>`, `<Form>`, `<QuoteRequest>` (`/components/*.astro`). Forms and Media, the CMS's default plugins, are part of it, and Commerce for a site that sells by quote. Source: github.com/Martin-Business-Consultants/libre-cms-astro. |

Env: `CMS_BASE_URL` (the CMS's origin) and `CMS_API_TOKEN` (the site's
read-only *service token*, Settings › Service tokens). Never commit either.
A site rendered on demand also needs `CMS_WEBHOOK_SECRET` (Settings ›
Deploy), and, to purge Cloudflare's cache, `CLOUDFLARE_ZONE_ID` and
`CLOUDFLARE_API_TOKEN`.

## Content: the loaders

Read content through content collections, in `src/content.config.ts`:

```ts
import { defineCollection } from "astro:content";
import { cmsPages, cmsEntries, cmsGlobals, cmsAssets } from "@librepublish/astro/loaders";

export const collections = {
  pages: defineCollection({ loader: cmsPages() }),
  posts: defineCollection({ loader: cmsEntries("posts") }),   // one per collection the site shows
  globals: defineCollection({ loader: cmsGlobals() }),
  assets: defineCollection({ loader: cmsAssets() }),
};
```

They read the CMS's delivery API (`GET https://healing-at-the-well-cms-production-d115cc.192-34-60-169.sslip.io/api/v1/content`), and
only what changed since the last build. Ids: a page's path, an entry's slug,
a global's slug, an asset's id. Only published content ever reaches the site.

The content model is typed: `import type { Block, Collections, Globals } from
"librepublish:types"` — generated from the CMS's schema on every build. Read
the generated `.astro/integrations/librepublish/cms.d.ts` before writing a
component for CMS data; don't guess a field name.

## Pages, entries, globals

**A page** has `path`, `title`, `locale`, `url`, `blocks`, `frontmatter` (its
own fields), `seo`, `category`, `tags` and `translations`. **An entry** has the
same plus `collection` and `body_markdown`. **A global** has `slug`, `name` and
`data` (navigation, footer, contact details).

**`url` is where a record is served.** Route by it, never by `path`: the home
page's `url` is `/`, an entry's is `/<collection>/<slug>`, and anything in a
locale other than the default is under that locale's prefix (`/fr/…`).

```astro
---
// src/pages/[...path].astro
import { getCollection } from "astro:content";
import { routeParam } from "@librepublish/astro/client";
export async function getStaticPaths() {
  return (await getCollection("pages")).map(({ data }) => ({
    // routeParam (@librepublish/astro/client): the url as a [...path] param,
    // and an absolute SEO canonical back to the path it's served at.
    params: { path: routeParam(data, { site: import.meta.env.SITE }) },
    props: { page: data },
  }));
}
---
```

## Rendering

- **Blocks** — `<Blocks blocks={page.blocks} components={{ hero: Hero, text: Text }} assets={assets} />`.
  Each component gets the block's data as props, plus `block` and `assets`.
  A type without a component is skipped (editors can add a block type before
  the site has one); add a component for every type the CMS uses.
- **Images** — `<Image asset={assets[id]} sizes="…" />`: served from the CMS,
  with its renditions as a srcset, its size and alt text. Asset fields hold an
  id; look it up in the `assets` collection.
- **SEO** — `<Seo record={page} assets={assets} siteName="…" />` in `<head>`:
  title, description, canonical, robots, Open Graph and Twitter cards, hreflang
  links to its translations, JSON-LD.
- **Links** — link fields are `{ kind: "url" | "page" | "entry", value }`;
  `linkHref(link)` from `@librepublish/astro/client` makes the href.
- **Field values** — `text` fields are HTML (`set:html`), `markdown` fields
  Markdown, and an entry's `body_markdown` is HTML when written in the
  rich-text editor (a Markdown renderer passes HTML through).

## What the integration does for the site

- `/sitemap.xml` (every URL, with lastmod and hreflang) and `/robots.txt`.
- `_redirects` for Cloudflare, from the CMS's redirect rules.
- The site's URL (`site`), its locales (Astro i18n, the default unprefixed)
  and the CMS's images as remote images, from the CMS.
- **Static or on demand.** Builds are static by default: fetch in
  `getStaticPaths` and frontmatter, not in the browser; publishing in the CMS
  rebuilds the site. With the Cloudflare adapter —
  `cloudflare({ prerenderEnvironment: "node" })` — pages can render on demand
  (`export const prerender = false`), reading through `Astro.locals.cms` or
  the live loaders (`@librepublish/astro/live`); the integration adds
  `/_cms/webhook`, where the CMS sends signed cache purges, and tags each
  response with what it read. Each build tells the CMS which way the site
  renders.

## Forms and quotes

- **Forms** (the Forms plugin, on by default) — `<Form slug="contact" />`
  (`@librepublish/astro/components/Form.astro`) renders a
  form's fields, a honeypot and Cloudflare Turnstile (when the CMS has it set
  up), and the browser posts straight to the CMS. Never proxy submissions
  through the site.
- **Form emails** — a route at `src/pages/emails/[form]/[kind].astro`
  (helpers from `@librepublish/astro/forms`: `emailTemplatePaths`,
  `digestMeta`, `answersRow`) gives each form's emails the site's design;
  `cms()` sends the templates here after each build, and the CMS sends the
  emails.
- **Quotes** (with the Commerce plugin) — `<QuoteRequest items={[…]} />` on
  a product page posts a quote request straight to the CMS.

## Site health

The CMS checks the site against Site health (Docs › Site health): the
business's details, the pages a site needs (contact, privacy, terms…), meta
descriptions, a sharing image, structured data, alt text, spam protection on
forms. **Build the site so every one of those checks passes** — the
checklist below is the current state, and `astro build` warns about each
that fails. Where a check needs content (a privacy page, a meta
description), the content goes in the CMS; where it needs the site (a
contact page that shows the address and a form, `<Seo>` in every layout),
it goes here.

## Changing the CMS itself

Content, fields, collections, block types and settings are changed in the CMS
(its admin, or the `cms` CLI: `curl -fsSL https://healing-at-the-well-cms-production-d115cc.192-34-60-169.sslip.io/agent/install.sh | sh`),
not from this repo. The only things this repo writes to the CMS are what its
build produced: form email templates and a build report.

## Site health: what this site is held to

The CMS checks these against the site as it is (Docs › Site health). Build so every one passes;
`astro build` warns about any that fail.

### Business details
- [x] **The business name is set** — Settings › General › Business name: search results, emails and structured data use it.
- [ ] **The full address is set** — Settings › General › Address, City, State and Zip, as the business is listed elsewhere.
- [ ] **The phone number is set** — Settings › General › Phone.
- [ ] **One phone number, everywhere** — No other phone number appears in the site's pages or globals. _(yours to judge)_
- [x] **The contact email is set** — Settings › General › Email: the address visitors write to.
- [ ] **Google Business Profile matches** — The name, address and phone on Google (and Apple, Bing, Yelp) should be exactly these. The CMS can't see them; check them yourself. _(yours to judge)_

### Forms and spam
- [ ] **Forms are protected from spam** — Settings › Forms › Spam protection: Cloudflare Turnstile (recommended) or reCAPTCHA, with its site key and secret. The hidden _hp field alone stops only simple bots.
- [x] **Every live form tells someone** — Each published form's notification email is on, with recipients.
- [ ] **Form emails come from the site's own domain** — Settings › Forms › From address: an address on the site's domain gets delivered; a default may land in spam.

### Search
- [x] **Published pages have meta descriptions** — Every published page has one.
- [x] **The home page has a sharing image** — The home page's SEO › Social image: what links to the site show in messages and social posts.
- [x] **The home page says what the business is** — The home page's SEO › Structured data: a schema type (LocalBusiness, or a more exact one) or JSON-LD with the name, address and phone.
- [x] **No published page is hidden from search by mistake** — None is set to noindex.
- [x] **The sitemap lists the site** — The site builds sitemap.xml from the CMS's sitemap; published pages and entries are in it unless hidden.
- [ ] **Old addresses redirect** — After a redesign or a move, every old URL should redirect (Tools › Redirects), or its links and rankings are lost. _(yours to judge)_

### Pages a site needs
- [x] **A published home page** — A page at the path home: the site serves it at /.
- [x] **A contact page** — A published page visitors find the address, phone and a form on.
- [x] **A privacy policy** — Required wherever a form collects details or tracking runs (GDPR, CCPA, Google Ads).
- [ ] **Terms of service** — Expected by anyone who sells, books or takes quotes online.
- [ ] **An accessibility statement** — Recommended in the US and required for public bodies in the EU: what the site does for accessibility and whom to contact. _(yours to judge)_

### Content
- [x] **Images the site uses have alt text** — Every image in use has alt text.
<!-- /librepublish:cms -->
