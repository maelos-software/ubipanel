import { UniFiClient } from "./collector/lib/unifi.js";
import "dotenv/config";

const config = {
  url: process.env.UNIFI_URL || "https://192.168.8.1",
  username: process.env.UNIFI_USER || "unpoller",
  password: process.env.UNIFI_PASS,
  site: process.env.UNIFI_SITE || "default",
  logLevel: "debug",
};

const unifi = new UniFiClient(config);

async function probe() {
  await unifi.login();

  const endpoints = [
    `/proxy/network/v2/api/site/${unifi.site}/traffic/applications`,
    `/proxy/network/v2/api/site/${unifi.site}/traffic/categories`,
    `/proxy/network/api/s/${unifi.site}/stat/dpi`,
    `/proxy/network/api/s/${unifi.site}/stat/stadpi`,
    `/api/s/${unifi.site}/stat/dpi`,
    `/api/s/${unifi.site}/stat/stadpi`,
    `/proxy/network/api/v2/dpi/apps`,
    `/proxy/network/api/v2/dpi/categories`,
  ];

  for (const path of endpoints) {
    console.log(`Probing ${path}...`);
    try {
      const res = await unifi.request(path);
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        const keys = Object.keys(data);
        console.log(`Success! Keys: ${keys.join(", ")}`);
        if (data.applications) console.log(`Found ${data.applications.length} applications`);
        if (data.categories) console.log(`Found ${data.categories.length} categories`);
        // Log a sample
        const sample = data.applications?.[0] || data.categories?.[0] || data;
        console.log("Sample:", JSON.stringify(sample).substring(0, 200));
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
    console.log("---");
  }
}

probe().catch(console.error);
