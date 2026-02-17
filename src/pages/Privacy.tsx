import AppLayout from "@/components/layout/AppLayout";

const Privacy = () => (
  <AppLayout>
    <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-2xl">
      <h1 className="text-2xl font-serif font-bold text-foreground mb-6">Privacy Policy</h1>
      <div className="prose prose-sm text-muted-foreground space-y-4">
        <p>Last updated: February 2026</p>
        <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
        <p>We collect information you provide directly to us, including your name, email address, and KingsChat handle when you create an account. We also collect usage data such as songs played, favorites, and game progress to improve your experience.</p>
        <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
        <p>We use the information we collect to provide, maintain, and improve our services, including personalizing your music experience, tracking your listening history, and enabling social features.</p>
        <h2 className="text-lg font-semibold text-foreground">3. Data Security</h2>
        <p>We implement appropriate security measures to protect your personal information. Your data is stored securely and access is restricted to authorized personnel only.</p>
        <h2 className="text-lg font-semibold text-foreground">4. Contact Us</h2>
        <p>If you have questions about this Privacy Policy, please contact us through the Feedback section of the app.</p>
      </div>
    </div>
    <div className="h-8" />
  </AppLayout>
);

export default Privacy;
