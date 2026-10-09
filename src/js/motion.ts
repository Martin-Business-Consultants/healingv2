/**
 * * Site motion, built on motion.dev (vanilla API)
 *
 * Components opt in with data attributes:
 *  - data-hero-item   staggered entrance on page load (held invisible by .motion-pending, see BaseHead)
 *  - data-hero-media  slow settle on load, then parallax while the hero scrolls away
 *  - data-reveal      fades up when scrolled into view
 *  - data-reveal-group  same, but staggers its direct children
 *  - data-grow-x      draws in horizontally when scrolled into view
 *  - #mobile-cta      sticky booking bar, shown on small screens between the hero and the contact form
 *
 * Anything already on screen at load is left alone, so the first frame is always complete.
 */
import { animate, inView, press, scroll, stagger } from "motion";

const ease = [0.22, 1, 0.36, 1] as const;

let cleanups: Array<() => void> = [];

function belowFold(el: Element) {
	return el.getBoundingClientRect().top > window.innerHeight * 0.92;
}

function heroEntrance(reduced: boolean) {
	const items = Array.from(document.querySelectorAll<HTMLElement>("[data-hero-item]"));
	const root = document.documentElement;

	if (reduced || items.length === 0) {
		root.classList.remove("motion-pending");
		return;
	}

	// take over from the CSS hold with inline styles before releasing it, so nothing flashes
	items.forEach((el) => (el.style.opacity = "0"));
	root.classList.remove("motion-pending");

	animate(
		items,
		{ opacity: [0, 1], y: [28, 0] },
		{ duration: 0.9, ease, delay: stagger(0.11, { startDelay: 0.1 }) },
	);
}

function heroMedia(reduced: boolean) {
	document.querySelectorAll<HTMLElement>("[data-hero-media]").forEach((media) => {
		if (reduced) return;
		const img = media.querySelector("img");
		if (img) animate(img, { scale: [1.08, 1] }, { duration: 1.8, ease });

		// drift the photo down at a fraction of scroll speed. Driven by page scroll position rather than a
		// target/ViewTimeline, so it sits flush at the top (behind the transparent nav) at scrollY 0.
		const section = media.closest("section") ?? media;
		cleanups.push(
			scroll((_progress: number, info: { y: { current: number } }) => {
				const y = Math.min(info.y.current, section.clientHeight);
				media.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
			}),
		);
	});
}

function reveals(reduced: boolean) {
	if (reduced) return;

	document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
		if (!belowFold(el)) return;
		animate(el, { opacity: 0, y: 24 }, { duration: 0 });
		cleanups.push(
			inView(
				el,
				() => {
					animate(el, { opacity: 1, y: 0 }, { duration: 0.8, ease });
				},
				{ amount: 0.15 },
			),
		);
	});

	document.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((group) => {
		if (!belowFold(group)) return;
		const children = Array.from(group.children) as HTMLElement[];
		animate(children, { opacity: 0, y: 28 }, { duration: 0 });
		cleanups.push(
			inView(
				group,
				() => {
					animate(children, { opacity: 1, y: 0 }, { duration: 0.8, ease, delay: stagger(0.1) });
				},
				{ amount: 0.15 },
			),
		);
	});

	document.querySelectorAll<HTMLElement>("[data-grow-x]").forEach((el) => {
		if (!belowFold(el)) return;
		el.style.transformOrigin = "left center";
		animate(el, { scaleX: 0 }, { duration: 0 });
		cleanups.push(
			inView(el, () => {
				animate(el, { scaleX: 1 }, { duration: 1.4, ease });
			}),
		);
	});
}

function buttonPress(reduced: boolean) {
	if (reduced) return;
	cleanups.push(
		press(".button", (el) => {
			animate(el, { scale: 0.97 }, { type: "spring", stiffness: 600, damping: 30 });
			return () => animate(el, { scale: 1 }, { type: "spring", stiffness: 500, damping: 25 });
		}),
	);
}

function mobileCta(reduced: boolean) {
	const bar = document.getElementById("mobile-cta");
	if (!bar) return;

	const hero = document.querySelector("[data-cta-hide]");
	const contact = document.getElementById("contact");
	let heroVisible = hero ? !belowFold(hero) : false;
	let contactVisible = false;
	let shown = false;

	const update = () => {
		const show = !heroVisible && !contactVisible;
		if (show === shown) return;
		shown = show;
		bar.inert = !show;
		animate(
			bar,
			{ y: show ? "0%" : "120%", opacity: show ? 1 : 0 },
			{ duration: reduced ? 0 : 0.45, ease },
		);
	};

	if (hero) {
		cleanups.push(
			inView(hero, () => {
				heroVisible = true;
				update();
				return () => {
					heroVisible = false;
					update();
				};
			}),
		);
	}
	if (contact) {
		cleanups.push(
			inView(
				contact,
				() => {
					contactVisible = true;
					update();
					return () => {
						contactVisible = false;
						update();
					};
				},
				{ amount: 0.1 },
			),
		);
	}
	update();
}

function init() {
	cleanups.forEach((stop) => stop());
	cleanups = [];

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	heroEntrance(reduced);
	heroMedia(reduced);
	reveals(reduced);
	buttonPress(reduced);
	mobileCta(reduced);
}

// with the ClientRouter, astro:page-load fires on first load and after every navigation
if (document.querySelector('meta[name="astro-view-transitions-enabled"]')) {
	document.addEventListener("astro:page-load", init);
} else {
	init();
}
