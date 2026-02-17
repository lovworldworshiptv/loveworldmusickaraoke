import AppLayout from "@/components/layout/AppLayout";

const Terms = () => (
  <AppLayout>
    <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-2xl">
      <h1 className="text-2xl font-serif font-bold text-foreground mb-6">Terms of Use</h1>
      <div className="prose prose-sm text-muted-foreground space-y-4">
        <p>Last updated: February 2026</p>
        <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
        <p>By accessing and using Loveworld Music Karaoke & Study+, you agree to be bound by these Terms of Use. If you do not agree, please do not use the service.</p>
        <h2 className="text-lg font-semibold text-foreground">2. Use of Service</h2>
        <p>You may use the service for personal, non-commercial purposes only. You agree not to reproduce, distribute, or create derivative works from any content provided through the service without permission.</p>
        <h2 className="text-lg font-semibold text-foreground">3. User Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
        <h2 className="text-lg font-semibold text-foreground">4. Content</h2>
        <p>All music, lyrics, articles, and other content provided through the service are the property of their respective owners. Unauthorized use is prohibited.</p>
        <h2 className="text-lg font-semibold text-foreground">5. Modifications</h2>
        <p>We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
      </div>
    </div>
    <div className="h-8" />
  </AppLayout>
);

export default Terms;
