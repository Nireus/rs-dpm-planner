import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

test('renders the project foundation landing page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('img', { name: 'RuneScape Ranged Rotation Planner logo' }),
  ).toBeVisible();
  await expect(primaryNavLink(page, 'Gear')).toBeVisible();
});

test('covers the main happy path from setup through import/export restore', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');

  await test.step('assign core gear', async () => {
    await primaryNavLink(page, 'Gear').click();
    await expect(page.getByRole('heading', { name: 'Gear' })).toBeVisible();

    const search = page.getByPlaceholder('Filter by name or id');

    await search.fill('Bow of the Last Guardian');
    await page.getByTestId('gear-catalog-bolg').click();
    await page.getByRole('button', { name: 'Equip to Weapon' }).click();
    await closeGearDetailIfPresent(page);
    await expect(page.getByTestId('gear-slot-weapon')).toContainText(/Bow of the La/);
  });

  await test.step('activate a persistent buff', async () => {
    await primaryNavLink(page, 'Buffs').click();
    await expect(page.getByRole('heading', { name: 'Buffs' })).toBeVisible();

    await page.getByPlaceholder('Name, id, category, or effect').fill('Rigour');
    await page.getByTestId('buff-option-rigour').click();
    await page.getByRole('button', { name: 'Activate' }).click();
    await closeBuffDetailIfPresent(page);

    await expect(page.getByTestId('active-buff-rigour')).toBeVisible();
  });

  await test.step('place abilities on the planner timeline', async () => {
    await primaryNavLink(page, 'Rotation Planner').click();
    await expect(page.getByRole('heading', { name: 'Rotation Planner' })).toBeVisible();

    await dragToTimelineCell(page, 'ability-palette-piercing-shot', 'timeline-cell-ability-0');
    await dragToTimelineCell(page, 'ability-palette-ranged', 'timeline-cell-ability-3');

    await expect(page.getByTitle(/Piercing Shot/).first()).toBeVisible();
    await expect(page.getByText('No current validation issues')).toBeVisible();
  });

  await test.step('verify results are generated', async () => {
    await primaryNavLink(page, 'Results').click();
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
    await expect(page.getByTestId('results-total-avg')).not.toContainText('0.0');
    await expect(page.getByRole('button', { name: /Piercing Shot/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ranged/ })).toBeVisible();
  });

  let exportedConfig = '';

  await test.step('export the current config', async () => {
    await workspaceNavLink(page, 'Import / Export').click();
    await expect(page.getByRole('heading', { name: 'Import / Export' })).toBeVisible();

    const exportJson = page.getByTestId('export-json');
    await expect(exportJson).not.toHaveValue('');
    exportedConfig = await exportJson.evaluate((element) => (element as HTMLTextAreaElement).value);
    expect(exportedConfig).toContain('"schemaVersion": 2');
    expect(exportedConfig).toContain('"abilityId": "piercing-shot"');
  });

  await test.step('mutate state and restore it through import', async () => {
    await primaryNavLink(page, 'Gear').click();
    await expect(page.getByRole('heading', { name: 'Gear' })).toBeVisible();

    const search = page.getByPlaceholder('Filter by name or id');
    await search.fill('Gloomfire bow');
    await page.getByTestId('gear-catalog-gloomfire-bow').click();
    await page.getByRole('button', { name: 'Equip to Weapon' }).click();
    await closeGearDetailIfPresent(page);
    await expect(page.getByTestId('gear-slot-weapon')).toContainText('Gloomfire bow');

    await workspaceNavLink(page, 'Import / Export').click();
    await expect(page.getByTestId('export-json')).not.toHaveValue(exportedConfig);

    await fillImportJson(page, exportedConfig);
    await page.getByTestId('validate-import-json').click();
    await expect(page.getByTestId('import-status')).toContainText('ready to import');

    await page.getByTestId('apply-import-json').click();
    await expect(page.getByTestId('import-status')).toContainText('imported successfully');
    await expect(page.getByTestId('export-json')).toHaveValue(exportedConfig);
  });
});

test('shows Perfect Equilibrium in results after a BoLG proc rotation', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');

  await test.step('equip Bow of the Last Guardian', async () => {
    await primaryNavLink(page, 'Gear').click();
    await expect(page.getByRole('heading', { name: 'Gear' })).toBeVisible();

    const search = page.getByPlaceholder('Filter by name or id');
    await search.fill('Bow of the Last Guardian');
    await page.getByTestId('gear-catalog-bolg').click();
    await page.getByRole('button', { name: 'Equip to Weapon' }).click();
    await closeGearDetailIfPresent(page);

    await expect(page.getByTestId('gear-slot-weapon')).toContainText(/Bow of the La/);
  });

  await test.step('place enough hits to proc Perfect Equilibrium', async () => {
    await primaryNavLink(page, 'Rotation Planner').click();
    await expect(page.getByRole('heading', { name: 'Rotation Planner' })).toBeVisible();

    await dragToTimelineCell(page, 'ability-palette-piercing-shot', 'timeline-cell-ability-0');
    await dragToTimelineCell(page, 'ability-palette-piercing-shot', 'timeline-cell-ability-6');
    await dragToTimelineCell(page, 'ability-palette-piercing-shot', 'timeline-cell-ability-12');
    await dragToTimelineCell(page, 'ability-palette-piercing-shot', 'timeline-cell-ability-18');

    await expect(page.getByText('No current validation issues')).toBeVisible();
    await expect(page.getByAltText('Perfect Equilibrium trigger').first()).toHaveAttribute(
      'src',
      /perfect-equilibrium-self-status\.png/,
    );
  });

  await test.step('confirm Perfect Equilibrium contributes damage in results', async () => {
    await primaryNavLink(page, 'Results').click();
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
    await expect(page.getByRole('button', { name: /perfect-equilibrium/i })).toBeVisible();
  });
});

function primaryNavLink(page: Page, label: string) {
  return page.getByLabel('Primary').getByRole('link', { name: label, exact: true });
}

function workspaceNavLink(page: Page, label: string) {
  return page.getByLabel('Workspace').getByRole('link', { name: label, exact: true });
}

async function closeGearDetailIfPresent(page: Page): Promise<void> {
  const closeButton = page.getByRole('button', { name: 'Close detail dialog' });
  await closeButton.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
  if (!(await closeButton.isVisible().catch(() => false))) {
    return;
  }

  await closeButton.click({ force: true });
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
}

async function closeBuffDetailIfPresent(page: Page): Promise<void> {
  const closeButton = page.getByRole('button', { name: 'Close buff dialog' });
  if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeButton.click().catch(() => undefined);
  }
}

async function fillImportJson(page: Page, value: string): Promise<void> {
  const input = page.getByTestId('import-json');
  await input.fill(value);

  if ((await input.inputValue()) !== value) {
    await input.evaluate((element, nextValue) => {
      const textarea = element as HTMLTextAreaElement;
      textarea.value = nextValue;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  await expect(input).toHaveValue(value);
}

async function dragToTimelineCell(page: Page, sourceTestId: string, targetTestId: string): Promise<void> {
  const source = page.getByTestId(sourceTestId);
  const target = page.getByTestId(targetTestId);
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());

  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  await source.dispatchEvent('dragstart', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
  await source.dispatchEvent('dragend', { dataTransfer });
}

