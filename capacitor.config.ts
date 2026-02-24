import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.b3098a950e2c4b02b4619fc1132bfe7e",
  appName: "LoveWorld Music Karaoke",
  webDir: "dist",
  server: {
    // For development hot-reload; remove or comment out for production builds
    url: "https://b3098a95-0e2c-4b02-b461-9fc1132bfe7e.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    allowMixedContent: true,
    // Keep all app domain + auth redirect links internal to the WebView
    allowNavigation: [
      "loveworldmusickaraoke.lovable.app",
      "loveworldmusickaraoke.com",
      "*.loveworldmusickaraoke.com",
      "kingschat.com",
      "*.kingschat.com",
      "accounts.kingschat.com",
      "qphlczkvepcxzgqagsmx.supabase.co",
    ],
  },
  ios: {
    allowNavigation: [
      "loveworldmusickaraoke.lovable.app",
      "loveworldmusickaraoke.com",
      "*.loveworldmusickaraoke.com",
      "kingschat.com",
      "*.kingschat.com",
      "accounts.kingschat.com",
      "qphlczkvepcxzgqagsmx.supabase.co",
    ],
  },
};

export default config;
