import { test, expect } from "./fixtures";

// /auth/callback sends failed sign-ins back with ?error=<code>. The pages show
// a Dutch message and clean the URL (#62 moved this out of an effect).

test("login page shows a callback error and cleans the URL", async ({
  page,
}) => {
  await page.goto("/auth/login?error=oauth-cancelled");
  await expect(
    page.getByText("Google login geannuleerd. Probeer het opnieuw."),
  ).toBeVisible();
  await expect(page).toHaveURL("/auth/login");
});

test("sign-up page shows a callback error and cleans the URL", async ({
  page,
}) => {
  await page.goto("/auth/sign-up?error=auth-code-error");
  await expect(
    page.getByText("Registreren is mislukt. Probeer het opnieuw."),
  ).toBeVisible();
  await expect(page).toHaveURL("/auth/sign-up");
});
