import { test as setup } from '@playwright/test';
import { LoginPage } from '../pages/login';

// eslint-disable-next-line playwright/expect-expect -- setup test saves storageState, no assertions needed
setup('authenticate', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login();

  // The guided tour only appears for some console versions and accounts.
  // Dismiss it when present, and continue when it is absent.
  await page
    .getByTestId('tour-step-footer-secondary')
    .filter({ hasText: 'Skip tour' })
    .click({ timeout: 5_000 })
    .catch(() => undefined);

  await page.context().storageState({ path: 'integration-tests/.auth/user.json' });
});
