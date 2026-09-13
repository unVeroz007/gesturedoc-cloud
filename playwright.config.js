import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./frontend/e2e",
  timeout: 30000,
  expect: { timeout: 20000 },
  use: {
    baseURL: "http://127.0.0.1:8501",
    viewport: { width: 1280, height: 900 },
    permissions: ["camera"],
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python -m streamlit run app_streamlit.py --server.port 8501 --server.address 127.0.0.1 --server.headless true",
    url: "http://127.0.0.1:8501/_stcore/health",
    reuseExistingServer: false,
    timeout: 120000,
    env: { ...process.env, AI_ENABLED: "false" },
  },
});
