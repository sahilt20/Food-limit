import './globals.css';

export const metadata = {
  title: 'FoodLimit — Smart Grocery Nutrition Tracker',
  description: 'Track your grocery shopping, analyze nutritional content with AI, and visualize detailed macro & micronutrient data.',
  keywords: 'food tracker, nutrition, grocery, health, diet, vitamins, minerals',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
