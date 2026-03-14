import './globals.css';

export const metadata = {
  title: 'FoodLimit — Smart Grocery Nutrition Tracker',
  description: 'Track your grocery shopping, analyze nutritional content with AI, and visualize detailed macro & micronutrient data.',
  keywords: 'food tracker, nutrition, grocery, health, diet, vitamins, minerals',
  manifest: '/manifest.json',
  themeColor: '#0a0a0f',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
