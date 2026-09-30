import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fruta2.gerenciador",
  appName: "Fruta²",
  webDir: "public",
  server: {
    url: "https://frutaaoquadrado.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    useLegacyBridge: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
