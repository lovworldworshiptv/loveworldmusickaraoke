import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.b3098a950e2c4b02b4619fc1132bfe7e",
  appName: "LoveWorld Music Karaoke",
  webDir: "dist",

  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },

  android: {
    allowMixedContent: true,
    allowNavigation: [
      "loveworldmusickaraoke.com",
      "*.loveworldmusickaraoke.com",
      "accounts.kingsch.at",
      "*.kingsch.at",
      "qphlczkvepcxzgqagsmx.supabase.co"
    ],
  },

  ios: {
    allowNavigation: [
      "loveworldmusickaraoke.com",
      "*.loveworldmusickaraoke.com",
      "accounts.kingsch.at",
      "*.kingsch.at",
      "qphlczkvepcxzgqagsmx.supabase.co"
    ],
  },
};

export default config;
