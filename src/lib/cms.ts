/**
 * The site's view of LibrePublish, on top of @librepublish/astro.
 *
 * Content arrives through the integration's loaders (src/content.config.ts),
 * so these are reads from Astro's content store, not requests: pages by
 * path, entries by collection, globals by slug, and every asset the content
 * references, by id. Forms come from the delivery API (`getForm`).
 */
import { type CmsAsset, type CmsEntry, type CmsGlobal, type CmsPage, linkHref } from "@librepublish/astro/client";
import { type CmsForm, getForm as getCmsForm } from "@librepublish/astro/forms";
import { runtimeConnection } from "@librepublish/astro/runtime/env";
import { getCollection, getEntry as getStoredEntry } from "astro:content";
import type {
	AnnouncementGlobal,
	FooterGlobal,
	Link,
	NavGlobal,
	PortfolioFields,
	ServicesFields,
	SiteSettingsGlobal,
	TestimonialsFields,
} from "librepublish:types";

export type Service = CmsEntry<ServicesFields>;
export type CaseStudy = CmsEntry<PortfolioFields>;
export type Testimonial = CmsEntry<TestimonialsFields>;

// ── Records ──────────────────────────────────────────────────────────────────

/** Every published page. */
export async function listPages(): Promise<CmsPage[]> {
	return (await getCollection("pages")).map((page) => page.data as unknown as CmsPage);
}

/**
 * A collection's published entries, by their `order` field (lowest first).
 * A collection the site is built around must not come back empty: an expired
 * token or a CMS outage should fail the build, not ship a site without it.
 */
async function ordered<T extends CmsEntry>(collection: "services" | "portfolio" | "testimonials"): Promise<T[]> {
	const entries = (await getCollection(collection)).map((entry) => entry.data as unknown as T);
	if (entries.length === 0) {
		throw new Error(`CMS returned no ${collection}; refusing to build. Check CMS_BASE_URL/CMS_API_TOKEN and the CMS.`);
	}
	const order = (entry: T) => Number((entry.frontmatter as { order?: number | null }).order ?? Infinity);
	return entries.sort((a, b) => order(a) - order(b));
}

export const listServices = () => ordered<Service>("services");
export const listCaseStudies = () => ordered<CaseStudy>("portfolio");
export const listTestimonials = () => ordered<Testimonial>("testimonials");

async function getGlobal<TData>(slug: string): Promise<TData> {
	const global = await getStoredEntry("globals", slug);
	if (!global) throw new Error(`CMS: no global "${slug}"`);
	return (global.data as unknown as CmsGlobal<TData>).data;
}

export const getSiteSettings = () => getGlobal<SiteSettingsGlobal>("site_settings");
export const getNav = () => getGlobal<NavGlobal>("nav");
export const getFooter = () => getGlobal<FooterGlobal>("footer");
export const getAnnouncement = () => getGlobal<AnnouncementGlobal>("announcement");

/** The CMS this build reads (CMS_BASE_URL), as the integration resolved it. */
function cmsBaseUrl(): string {
	return runtimeConnection().url.replace(/\/+$/, "");
}

// ── Forms ────────────────────────────────────────────────────────────────────

/**
 * A published form, from the CMS's Forms plugin: fields, where it posts,
 * honeypot, captcha. The browser posts straight to the CMS, which checks the
 * honeypot, its rate limit, Turnstile (when Settings › Forms has keys) and
 * the form's own field rules. `action` is pointed at the CMS this build
 * reads: the CMS writes it on its own idea of its address (APP_HOST), which
 * needn't be one a browser can reach.
 */
const formPromises: Record<string, Promise<CmsForm>> = {};
export function getForm(slug: string): Promise<CmsForm> {
	formPromises[slug] ??= getCmsForm(slug).then((form) => {
		const action = new URL(form.action);
		return { ...form, action: `${cmsBaseUrl()}${action.pathname}${action.search}` };
	});
	return formPromises[slug];
}

// ── Assets ───────────────────────────────────────────────────────────────────

const ACTIVE_STORAGE = "/rails/active_storage/";

/**
 * Where the browser loads a CMS image from. Built pages link `/media/*`, and
 * integrations/cms-media.mjs downloads each linked image into the build at
 * that path, so the deployed site serves its own copies. `astro dev` links
 * the CMS directly.
 *
 * Only the path of the CMS's URL is used: the host in it is whatever the CMS
 * believes its address is (APP_HOST), which needn't be one a browser or the
 * build can reach.
 */
export function assetUrl(url: string): string {
	let path: string;
	try {
		path = new URL(url, "https://cms.invalid").pathname;
	} catch {
		return url;
	}
	if (!path.startsWith(ACTIVE_STORAGE)) return url;
	if (import.meta.env.DEV) return `${cmsBaseUrl()}${path}`;
	// Cloudflare serves a file whose name has "=" (base64 padding in the signed
	// ids) at its %3D form and redirects the bare one, so link that form.
	return `/media/${path.slice(ACTIVE_STORAGE.length).replaceAll("=", "%3D")}`;
}

let assetsPromise: Promise<Map<string, CmsAsset>> | undefined;
function storedAssets(): Promise<Map<string, CmsAsset>> {
	assetsPromise ??= getCollection("assets").then(
		(assets) => new Map(assets.map((asset) => [asset.id, asset.data as unknown as CmsAsset])),
	);
	return assetsPromise;
}

/** The asset's renditions by width, narrowest first: [[640, url], …]. */
function renditions(asset: CmsAsset): [number, string][] {
	return Object.entries(asset.variants ?? {})
		.map(([name, url]) => [Number(name.replace(/^w/, "")), url] as [number, string])
		.filter(([width]) => Number.isFinite(width) && (!asset.width || width <= asset.width))
		.sort(([a], [b]) => a - b);
}

/**
 * The largest rendition, or the original when there are none (an SVG, or an
 * image smaller than the narrowest rendition). Photos are uploaded straight
 * off a phone, several megabytes each; the site never links the original of
 * one that has renditions.
 */
function bestUrl(asset: CmsAsset): string {
	return renditions(asset).at(-1)?.[1] ?? asset.original;
}

export interface ResolvedImage {
	src: string;
	srcset?: string;
	alt: string;
	width?: number;
	height?: number;
	/** The focal point set in the media library, as a CSS object-position. */
	position?: string;
}

/**
 * An image field (an asset id) as `<img>` attributes: the CMS's renditions as
 * a srcset, its size and alt text. Null for a missing id or a deleted asset,
 * so a gone image costs one missing picture, not the build.
 */
export async function resolveImage(id: string | number | null | undefined): Promise<ResolvedImage | null> {
	if (id === null || id === undefined || id === "") return null;
	const asset = (await storedAssets()).get(String(id));
	if (!asset) return null;
	const list = renditions(asset);
	const src = assetUrl(bestUrl(asset));
	// The size of the image `src` is, so the browser can hold the layout.
	const [width, height] =
		asset.width && asset.height && list.length
			? [list.at(-1)![0], Math.round((list.at(-1)![0] / asset.width) * asset.height)]
			: [asset.width ?? undefined, asset.height ?? undefined];
	return {
		src,
		srcset: list.length > 1 ? list.map(([w, url]) => `${assetUrl(url)} ${w}w`).join(", ") : undefined,
		alt: asset.alt ?? "",
		width,
		height,
		position:
			asset.focal_x != null && asset.focal_y != null
				? `${Math.round(asset.focal_x * 100)}% ${Math.round(asset.focal_y * 100)}%`
				: undefined,
	};
}

/**
 * Every asset by id for `<Seo>` from @librepublish/astro: absolute URLs (its
 * og:image must be), and the largest rendition as `original`, so a sharing
 * image is a reasonable size.
 */
export async function seoAssets(): Promise<Record<string, CmsAsset>> {
	const absolute = (url: string) => {
		const u = assetUrl(url);
		return u.startsWith("/") ? new URL(u, import.meta.env.SITE).href : u;
	};
	return Object.fromEntries(
		[...(await storedAssets())].map(([id, asset]) => {
			const best = renditions(asset).at(-1);
			const scale = best && asset.width && asset.height ? best[0] / asset.width : 1;
			return [
				id,
				{
					...asset,
					original: absolute(bestUrl(asset)),
					url: absolute(bestUrl(asset)),
					width: best ? best[0] : asset.width,
					height: best && asset.height ? Math.round(asset.height * scale) : asset.height,
				},
			];
		}),
	);
}

// ── Links and text ───────────────────────────────────────────────────────────

/**
 * A CMS link field as an href (the integration's `linkHref`). A page link to
 * "home" is "/", an entry link is /<collection>/<slug>, and a URL is used as
 * written, so "#contact" jumps to the contact form on the same page.
 */
export function href(link: Link | null | undefined): string | undefined {
	return linkHref(link) ?? undefined;
}

/** The path a page or entry is served at, from its `url` ("/" for home). */
export function recordHref(record: { url: string }): string {
	return new URL(record.url, "https://site.invalid").pathname.replace(/\/$/, "") || "/";
}

/** A `text` field (HTML from the rich-text editor, or plain text) as plain text. */
export function plainText(html: string | null | undefined): string {
	return (html ?? "")
		.replace(/<\/p>\s*<p>/g, " ")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

/** A `text` field as HTML: plain text written over the API becomes one paragraph. */
export function richText(value: string | null | undefined): string {
	const text = (value ?? "").trim();
	if (!text) return "";
	if (/^<[a-z]/i.test(text)) return text;
	return `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`;
}
