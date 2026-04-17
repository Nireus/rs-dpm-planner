import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BUILD_STYLE_OPTIONS, type BuildMetadataInput, type BuildStyleTag, type BuildVisibility, type CloudBuildSummary } from '../../core/builds/build-sharing.models';
import { deriveBuildStyleTagsFromRotation } from '../../core/builds/build-style-tags';
import { CloudBuildRepository } from '../../core/builds/cloud-build.repository';
import { GameDataStoreService } from '../../core/game-data/game-data-store.service';
import { WorkspaceRepositoryService } from '../../core/workspace/workspace-repository.service';
import { AuthStoreService } from '../../core/auth/auth-store.service';

@Component({
  selector: 'app-my-builds-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './my-builds-page.component.html',
  styleUrl: './my-builds-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBuildsPageComponent implements OnInit {
  private readonly repository = inject(CloudBuildRepository);
  private readonly workspaceRepository = inject(WorkspaceRepositoryService);
  private readonly gameDataStore = inject(GameDataStoreService);
  protected readonly authStore = inject(AuthStoreService);

  protected readonly builds = signal<CloudBuildSummary[]>([]);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly visibility = signal<BuildVisibility>('private');
  protected readonly includeProfileSocials = signal(false);
  protected readonly selectedStyleTags = signal<BuildStyleTag[]>([]);
  protected readonly styleOptions = BUILD_STYLE_OPTIONS;
  protected readonly canSave = computed(() => this.authStore.isAuthenticated() && this.title().trim().length > 0);

  ngOnInit(): void {
    this.suggestStyleTags();
    void this.loadBuilds();
  }

  protected async loadBuilds(): Promise<void> {
    if (!this.authStore.isAuthenticated()) {
      return;
    }

    this.busy.set(true);
    const result = await this.repository.listOwnBuilds();
    this.busy.set(false);
    this.applyListResult(result);
  }

  protected suggestStyleTags(): void {
    this.selectedStyleTags.set(this.extractStyleTagsFromCurrentRotation());
  }

  protected async saveCurrentBuild(): Promise<void> {
    const metadata = this.buildMetadata();
    if (!metadata) {
      return;
    }

    this.busy.set(true);
    const result = await this.repository.saveCurrentBuild(metadata, this.visibility());
    this.busy.set(false);

    if (!result.success) {
      this.error.set(result.message);
      return;
    }

    this.message.set('Build saved.');
    this.error.set(null);
    this.resetForm();
    await this.loadBuilds();
  }

  protected async updateBuildFromCurrentWorkspace(build: CloudBuildSummary): Promise<void> {
    this.busy.set(true);
    const result = await this.repository.updateBuildFromCurrentWorkspace(
      build.id,
      {
        title: build.title,
        description: build.description,
        styleTags: this.extractStyleTagsFromCurrentRotation(),
        includeProfileSocials: build.includeProfileSocials,
      },
      build.visibility,
    );
    this.busy.set(false);

    if (!result.success) {
      this.error.set(result.message);
      return;
    }

    this.message.set('Build updated from current workspace.');
    this.error.set(null);
    await this.loadBuilds();
  }

  protected async setVisibility(build: CloudBuildSummary, visibility: BuildVisibility): Promise<void> {
    this.busy.set(true);
    const result = await this.repository.updateBuildMetadata(
      build.id,
      {
        title: build.title,
        description: build.description,
        styleTags: build.styleTags,
        includeProfileSocials: build.includeProfileSocials,
      },
      visibility,
    );
    this.busy.set(false);

    if (!result.success) {
      this.error.set(result.message);
      return;
    }

    this.message.set(visibility === 'public' ? 'Build published.' : 'Build moved to private.');
    this.error.set(null);
    await this.loadBuilds();
  }

  protected async setIncludeProfileSocials(build: CloudBuildSummary, includeProfileSocials: boolean): Promise<void> {
    this.busy.set(true);
    const result = await this.repository.updateBuildMetadata(
      build.id,
      {
        title: build.title,
        description: build.description,
        styleTags: build.styleTags,
        includeProfileSocials,
      },
      build.visibility,
    );
    this.busy.set(false);

    if (!result.success) {
      this.error.set(result.message);
      return;
    }

    this.message.set(includeProfileSocials ? 'Profile socials enabled for this build.' : 'Profile socials hidden for this build.');
    this.error.set(null);
    await this.loadBuilds();
  }

  protected async importBuild(build: CloudBuildSummary): Promise<void> {
    this.busy.set(true);
    const result = await this.repository.importBuild(build.id);
    this.busy.set(false);

    if (!result.success) {
      this.error.set(result.message);
      return;
    }

    this.message.set('Build imported into the local planner.');
    this.error.set(null);
  }

  protected async deleteBuild(build: CloudBuildSummary): Promise<void> {
    this.busy.set(true);
    const result = await this.repository.deleteOwnBuild(build.id);
    this.busy.set(false);

    if (!result.success) {
      this.error.set(result.message);
      return;
    }

    this.message.set('Build deleted.');
    this.error.set(null);
    await this.loadBuilds();
  }

  protected formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleDateString() : 'Not published';
  }

  protected styleIconPath(styleTag: BuildStyleTag): string | null {
    return this.styleOptions.find((style) => style.id === styleTag)?.iconPath ?? null;
  }

  protected hybridIconPaths(): string[] {
    return this.styleOptions.flatMap((style) => (style.id !== 'hybrid' && style.iconPath ? [style.iconPath] : []));
  }

  private buildMetadata(): BuildMetadataInput | null {
    const trimmedTitle = this.title().trim();
    if (!trimmedTitle) {
      this.error.set('Build title is required.');
      return null;
    }

    return {
      title: trimmedTitle,
      description: this.description(),
      styleTags: this.extractStyleTagsFromCurrentRotation(),
      includeProfileSocials: this.includeProfileSocials(),
    };
  }

  private resetForm(): void {
    this.title.set('');
    this.description.set('');
    this.visibility.set('private');
    this.includeProfileSocials.set(false);
    this.suggestStyleTags();
  }

  private extractStyleTagsFromCurrentRotation(): BuildStyleTag[] {
    const document = this.workspaceRepository.readPortableConfigDocument();
    const catalog = this.gameDataStore.snapshot().catalog;
    return catalog ? deriveBuildStyleTagsFromRotation(document.rotationPlan, catalog) : [];
  }

  private applyListResult(result: Awaited<ReturnType<CloudBuildRepository['listOwnBuilds']>>): void {
    if (!result.success) {
      this.error.set(result.message);
      return;
    }

    this.builds.set(result.data);
  }
}
