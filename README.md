# Healing Earth Design

The website for Healing Earth Design, Sarah Martin's plant-forward garden and landscape design
practice: https://healingearthdesignbysarah.com

An Astro 7 site that renders content from a [LibrePublish](https://github.com/Martin-Business-Consultants/cmsv2)
CMS through [`@librepublish/astro`](https://github.com/Martin-Business-Consultants/libre-cms-astro),
built as static files and served by a Cloudflare Worker.

**Read [AGENTS.md](AGENTS.md) before changing the site.** It explains how the site and the CMS fit
together, and the Site health checks the site is held to.

## Where things live

| In the CMS | In this repo |
|---|---|
| Every page and its sections (blocks), with SEO | Layouts, components and styles |
| Services, Case studies and Testimonials collections | How each block type and entry is drawn |
| Site settings, navigation, footer, announcement banner | Routes (`src/pages`) |
| Photos, with alt text (media library) | Build and deploy config |
| The contact form, its fields and its emails' words | The emails' design (`src/pages/emails`) |
| Redirects, business details, brand brief | |

Nothing an editor would expect to change is written into the code. To change copy, a photo, a
service or a case study, edit it in the CMS and publish: the site rebuilds.

- **Pages** are built from blocks. `src/components/blocks/BlockRenderer.astro` maps each CMS block
  type to its component. A new block type needs a component registered there.
- **Services** (`/services/<slug>`) and **case studies** (`/portfolio/<slug>`) have their own
  templates, fed by their collections.
- **The contact form** posts straight to the CMS, which stores the submission, checks it for spam,
  and sends the notification and confirmation emails. The emails are designed in
  `src/pages/emails/[form]/[kind].astro`; each build sends that design to the CMS.
- **Images** come from the CMS media library and are downloaded into the build
  (`integrations/cms-media.mjs`), so the deployed site serves its own copies under `/media`.

## Develop

```sh
pnpm install
cp .env.example .env   # then add the site's read-only service token (cms service-tokens)
pnpm dev               # http://localhost:4321
pnpm build             # static site in dist/
```

The build needs `CMS_BASE_URL` and `CMS_API_TOKEN` (a token on the CMS's **Production site** role).
It fails rather than ship a site with missing content.

## Deploy

```sh
pnpm run deploy        # astro build && wrangler deploy
```

For automatic rebuilds when content is published, connect this repo under Cloudflare Workers ›
Builds (build `pnpm run build`, deploy `npx wrangler deploy`, with `CMS_BASE_URL` and
`CMS_API_TOKEN` set), then give the CMS its deploy hook:
`cms patch /deploy '{"deploy":{"url":"…"}}'`.

## License

Proprietary - Martin Business Consultants
