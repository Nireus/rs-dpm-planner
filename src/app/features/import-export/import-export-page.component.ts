import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PortableConfigExchangeService } from '../../core/import-export/portable-config-exchange.service';

@Component({
  selector: 'app-import-export-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './import-export-page.component.html',
  styleUrl: './import-export-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportExportPageComponent {
  private readonly exchangeService = inject(PortableConfigExchangeService);

  protected readonly importText = signal('');
  protected readonly exportRevision = signal(0);
  protected readonly importMessage = signal<string | null>(null);
  protected readonly importSuccess = signal(false);
  protected readonly importErrors = signal<string[]>([]);
  protected readonly exportText = computed(() => {
    this.exportRevision();
    return this.exchangeService.readFormattedPortableConfigDocument();
  });

  protected copyExportJson(): void {
    const exportText = this.exportText();

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(exportText);
      this.importSuccess.set(true);
      this.importMessage.set('Export JSON copied to clipboard.');
      this.importErrors.set([]);
      return;
    }

    this.importSuccess.set(true);
    this.importMessage.set('Clipboard access is unavailable here, but the export JSON is ready to copy.');
    this.importErrors.set([]);
  }

  protected downloadExportJson(): void {
    const blob = new Blob([this.exportText()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rs-dpm-planner-config.v1.json';
    link.click();
    URL.revokeObjectURL(url);

    this.importSuccess.set(true);
    this.importMessage.set('Portable config downloaded.');
    this.importErrors.set([]);
  }

  protected validateImportText(): void {
    const result = this.exchangeService.parsePortableConfigText(this.importText());

    if (result.success) {
      this.importText.set(result.documentText);
      this.importSuccess.set(true);
      this.importMessage.set('Portable config is valid and ready to import.');
      this.importErrors.set([]);
      return;
    }

    this.importSuccess.set(false);
    this.importMessage.set(result.message);
    this.importErrors.set(result.errors.map((error) => `${error.path}: ${error.message}`));
  }

  protected importConfig(): void {
    const result = this.exchangeService.applyPortableConfigText(this.importText());

    if (result.success) {
      this.importText.set(result.documentText);
      this.exportRevision.update((value) => value + 1);
      this.importSuccess.set(true);
      this.importMessage.set('Portable config imported successfully.');
      this.importErrors.set([]);
      return;
    }

    this.importSuccess.set(false);
    this.importMessage.set(result.message);
    this.importErrors.set(result.errors.map((error) => `${error.path}: ${error.message}`));
  }

  protected clearImportText(): void {
    this.importText.set('');
    this.importSuccess.set(false);
    this.importMessage.set(null);
    this.importErrors.set([]);
  }

  protected async loadImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    this.importText.set(await file.text());
    this.importSuccess.set(false);
    this.importMessage.set(`Loaded ${file.name}. Validate or import when ready.`);
    this.importErrors.set([]);
    input.value = '';
  }
}
