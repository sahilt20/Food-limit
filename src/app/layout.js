import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://food-limit.netlify.app';

export const metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: 'FoodLimit — Smart Grocery Nutrition Tracker',
        template: '%s | FoodLimit',
    },
    description:
        'Track your grocery shopping, analyze nutritional content with AI, and visualize detailed macro & micronutrient data. Free, open-source, privacy-first.',
    keywords: [
        'food tracker', 'nutrition tracker', 'grocery tracker', 'health', 'diet',
        'vitamins', 'minerals', 'meal planner', 'calorie counter', 'AI nutrition',
    ],
    authors: [{ name: 'FoodLimit' }],
    creator: 'FoodLimit',
    manifest: '/manifest.json',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: SITE_URL,
        siteName: 'FoodLimit',
        title: 'FoodLimit — Smart Grocery Nutrition Tracker',
        description:
            'AI-powered grocery & nutrition tracking. Know exactly what you eat.',
        images: [
            {
                url: '/icon-512.png',
                width: 512,
                height: 512,
                alt: 'FoodLimit',
            },
        ],
    },
    twitter: {
        card: 'summary',
        title: 'FoodLimit — Smart Grocery Nutrition Tracker',
        description: 'AI-powered grocery & nutrition tracking. Know exactly what you eat.',
        images: ['/icon-512.png'],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    icons: {
        icon: [
            { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    },
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    // Required for env(safe-area-inset-*) to work on iPhone notch/Dynamic Island
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: dark)',  color: '#0a0a0f' },
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    ],
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>{children}</body>
        </html>
    );
}
