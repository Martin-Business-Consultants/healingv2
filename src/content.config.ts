// Everything the site shows comes from LibrePublish through the
// @librepublish/astro loaders. Between them they read GET /api/v1/content
// once per build — live content only, and after the first build only what
// changed — so these collections are the site's whole view of the CMS.
//
// Ids: a page's path ("home", "about"), an entry's slug, a global's slug,
// an asset's id. Read them through src/lib/cms.ts.
import { cmsAssets, cmsEntries, cmsGlobals, cmsPages } from "@librepublish/astro/loaders";
import { defineCollection } from "astro:content";

export const collections = {
	pages: defineCollection({ loader: cmsPages() }),
	globals: defineCollection({ loader: cmsGlobals() }),
	assets: defineCollection({ loader: cmsAssets() }),
	services: defineCollection({ loader: cmsEntries("services") }),
	portfolio: defineCollection({ loader: cmsEntries("portfolio") }),
	testimonials: defineCollection({ loader: cmsEntries("testimonials") }),
};
