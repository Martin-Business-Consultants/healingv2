// @ts-check
import tailwindcss from "@tailwindcss/vite";
import cms from "@librepublish/astro";
import { defineConfig } from "astro/config";
import icon from "astro-icon";

import cmsMedia from "./integrations/cms-media.mjs";

export default defineConfig({
	site: "https://healingearthdesignbysarah.com",
	// The CMS addresses records without a trailing slash ("/services/x"), and so
	// does every link on the site. Each page is written as a file (about.html),
	// which Cloudflare serves at /about and redirects /about/ to.
	trailingSlash: "never",
	build: { format: "file" },
	integrations: [
		// LibrePublish: content loaders, generated types, /sitemap.xml, /robots.txt
		// and _redirects from the CMS, form email templates, Site health checks
		// and the build report. Reads CMS_BASE_URL and CMS_API_TOKEN (environment or .env).
		cms(),
		// The CMS images the pages link, downloaded into dist/media/.
		cmsMedia(),
		icon({
			// Only the icons the site uses. A service's icon is picked in the CMS
			// from the same list (the Services collection's "icon" field).
			include: {
				tabler: [
					"bulb",
					"alert-triangle",
					"menu-2",
					"x",
					"chevron-down",
					"target",
					"check",
					"clock",
					"map-pin",
					// service icons
					"message",
					"pencil",
					"notebook",
					"shovel",
					"shopping-cart",
					"plant-2",
					"plant",
					"leaf",
					"seedling",
					"flower",
					"trees",
					"sun",
					"droplet",
					"calendar-event",
					"home",
					// social profiles
					"brand-facebook",
					"brand-instagram",
					"brand-youtube",
					"brand-pinterest",
					"brand-tiktok",
					"brand-x",
					"brand-linkedin",
				],
			},
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
