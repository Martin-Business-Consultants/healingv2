# Healing v2

A modern wellness platform built with Astro and React.

## Overview

Healing v2 is a comprehensive wellness and healing platform featuring a modern static site architecture with dynamic capabilities. This version represents a significant upgrade with enhanced performance and user experience.

## Features

- **Static Site Generation**: Fast, SEO-friendly pages with Astro
- **Dynamic Components**: Interactive UI with React and Svelte
- **Content Management**: Headless CMS integration with Keystatic
- **Email Integration**: MJML-based email templates with Postmark
- **Forms**: Cloudflare Turnstile for spam protection
- **Responsive Design**: Tailwind CSS for mobile-first design

## Tech Stack

- **Framework**: Astro 4.x
- **UI Libraries**: React 18, Svelte 5
- **Styling**: Tailwind CSS 3.x
- **Content**: Keystatic CMS
- **Email**: MJML, Postmark
- **Deployment**: Netlify
- **Type Safety**: TypeScript

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Setup environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm format` - Format code with Prettier
- `pnpm lint` - Run ESLint

### Content Management

Content is managed through Keystatic CMS. Access the admin panel at `/keystatic` during development.

## Deployment

Built for deployment on Netlify with static site generation.

```bash
pnpm build
```

## License

Proprietary - Martin Business Consultants
