import { expect, test } from "@playwright/test";

test("app loads and manual health flow works without camera", async ({ page }) => {
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page).toHaveTitle(/GestureDoc/);
  await expect(page.getByRole("heading", { name: "GestureDoc" })).toBeVisible();
  await expect(page.getByText("GestureDoc adalah media edukasi", { exact: false })).toBeVisible();

  const camera = page.frameLocator("iframe").first();
  await expect(camera.getByRole("button", { name: "Mulai kamera" })).toBeEnabled();
  await expect(camera.getByText("Kamera belum dimulai")).toBeVisible();

  await page.getByText("Pilihan manual jika kamera tidak tersedia", { exact: true }).click();
  await page.getByTestId("stSelectbox").click();
  await page.getByText("Kepala", { exact: true }).click();
  await page.getByRole("button", { name: "Tampilkan informasi" }).click();
  await expect(page.getByText("Area dipilih:", { exact: false })).toBeVisible();
  await expect(page.getByText("📚 Informasi dasar", { exact: true })).toBeVisible();
  expect(errors.filter(message => !message.includes("favicon"))).toEqual([]);
});

test("mobile layout keeps manual controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText("Pilihan manual jika kamera tidak tersedia", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Tampilkan informasi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset pilihan" })).toBeVisible();
});

test("Stop cancels model startup without reviving the camera", async ({ page }) => {
  test.setTimeout(45000);
  await page.route("**/*.task", async route => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await route.continue();
  });
  await page.goto("/");
  const camera = page.frameLocator("iframe").first();
  await camera.getByRole("button", { name: "Mulai kamera" }).click();
  await expect(camera.getByText("Memuat model visi…")).toBeVisible();
  await camera.getByRole("button", { name: "Stop kamera" }).click();
  await expect(camera.getByText("Kamera berhenti")).toBeVisible();
  await page.waitForTimeout(4000);
  await expect(camera.getByText("Kamera berhenti")).toBeVisible();
  await expect(camera.locator("#camera-stage")).toBeHidden();
});

test("camera models support repeated Start and Stop without a stale stream", async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("console", message => {
    const text = message.text();
    const isMediaPipeInfo = text.startsWith("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
    if (message.type() === "error" && !isMediaPipeInfo) errors.push(text);
  });
  await page.goto("/");
  const camera = page.frameLocator("iframe").first();
  await camera.getByRole("button", { name: "Mulai kamera" }).click();
  await expect.poll(
    () => camera.locator("#camera-status").textContent(),
    { timeout: 90000 },
  ).toMatch(/Kamera aktif|Model visi gagal dimuat/);
  const cameraStatus = await camera.locator("#camera-status").textContent();
  if (cameraStatus !== "Kamera aktif") {
    throw new Error(`Camera startup failed: ${cameraStatus}; console=${JSON.stringify(errors)}`);
  }
  await expect(camera.locator("#camera-canvas")).toBeVisible();
  await camera.getByRole("button", { name: "Stop kamera" }).click();
  await expect(camera.getByText("Kamera berhenti")).toBeVisible();
  await expect(camera.locator("#camera-stage")).toBeHidden();

  await camera.getByRole("button", { name: "Mulai kamera" }).click();
  await expect.poll(
    () => camera.locator("#camera-status").textContent(),
    { timeout: 90000 },
  ).toBe("Kamera aktif");
  await camera.getByRole("button", { name: "Stop kamera" }).click();
  await expect(camera.getByText("Kamera berhenti")).toBeVisible();
  await expect(camera.locator("#camera-stage")).toBeHidden();
  expect(errors).toEqual([]);
});
