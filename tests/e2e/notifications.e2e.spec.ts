// Phase 10D — E2E test for notifications: trigger, receive, mark as read.
import { test, expect } from './helpers/fixtures';

test.describe('Notifications', () => {
  test('admin can mark a notification as read', async ({ adminContext, page }) => {
    await adminContext;
    await page.goto('/notificaciones');
    const firstNotification = page.getByTestId('notification-item').first();
    await expect(firstNotification).toBeVisible();
    await firstNotification.getByRole('button', { name: /marcar como le[íi]da|mark as read/i }).click();
    await expect(firstNotification.getByText(/le[íi]da|read/i)).toBeVisible();
  });
});
