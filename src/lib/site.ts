/**
 * The CMS's Settings › General, as the delivery API serves it (/api/v1/site):
 * the business's name, description, URL and contact details. Read once per
 * build.
 */
import { runtimeClient } from "@librepublish/astro/runtime/env";

type Site = { name: string; description: string; url: string; contact: Record<string, string> };

let sitePromise: Promise<Site> | undefined;
export function getSite(): Promise<Site> {
	sitePromise ??= runtimeClient()
		.site()
		.then((answer: { data: Site }) => answer.data);
	return sitePromise;
}

export const siteName = async () => (await getSite()).name || "Healing Earth Design";
