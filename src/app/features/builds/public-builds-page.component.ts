import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStoreService } from '../../core/auth/auth-store.service';
import { BUILD_STYLE_OPTIONS, type BuildSortOption, type BuildStyleTag, type CloudBuildSummary } from '../../core/builds/build-sharing.models';
import { CloudBuildRepository } from '../../core/builds/cloud-build.repository';
import { confirmPlannerStateOverwrite } from '../../shared/import-confirmation';

const STYLE_ICON_PATHS: Record<Exclude<BuildStyleTag, 'hybrid'>, string> = {
  ranged: '/icons/wiki/ranged-icon.png',
  melee: '/icons/wiki/attack-icon.png',
  magic: '/icons/wiki/magic-icon.png',
  necromancy: '/icons/wiki/necromancy-icon.png',
};

type SocialLinkKind = 'youtube' | 'twitch' | 'x' | 'discord';

@Component({
  selector: 'app-public-builds-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './public-builds-page.component.html',
  styleUrl: './public-builds-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicBuildsPageComponent implements OnInit {
  private readonly repository = inject(CloudBuildRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly authStore = inject(AuthStoreService);

  protected readonly builds = signal<CloudBuildSummary[]>([]);
  protected readonly shareBuild = signal<CloudBuildSummary | null>(null);
  protected readonly search = signal('');
  protected readonly sort = signal<BuildSortOption>('likes');
  protected readonly selectedStyleTags = signal<BuildStyleTag[]>([]);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly shareMessage = signal<string | null>(null);
  protected readonly styleOptions = BUILD_STYLE_OPTIONS.filter((style) => style.id !== 'hybrid');
  protected readonly activeFilterCount = computed(() => this.selectedStyleTags().length);

  ngOnInit(): void {
    void this.initializePage();
  }

  protected async loadBuilds(): Promise<void> {
    this.busy.set(true);
    const result = await this.repository.listPublicBuilds({
      search: this.search(),
      styleTags: this.selectedStyleTags(),
      sort: this.sort(),
    });
    this.busy.set(false);

    if (!result.success) {
      this.error.set(result.message);
      return;
    }

    this.builds.set(result.data);
    this.error.set(null);
  }

  protected toggleStyleTag(tag: BuildStyleTag): void {
    this.selectedStyleTags.update((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag],
    );
    void this.loadBuilds();
  }

  protected isStyleSelected(tag: BuildStyleTag): boolean {
    return this.selectedStyleTags().includes(tag);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.selectedStyleTags.set([]);
    this.sort.set('likes');
    void this.loadBuilds();
  }

  protected async importBuild(build: CloudBuildSummary): Promise<void> {
    await this.importBuildById(build.id, 'Public build imported into the local planner.');
  }

  protected async toggleVote(build: CloudBuildSummary): Promise<void> {
    this.busy.set(true);
    const result = await this.repository.toggleVote(build.id);
    this.busy.set(false);

    if (!result.success) {
      this.error.set(result.message);
      return;
    }

    await this.loadBuilds();
  }

  protected openShareDialog(build: CloudBuildSummary): void {
    this.shareBuild.set(build);
    this.shareMessage.set(null);
  }

  protected closeShareDialog(): void {
    this.shareBuild.set(null);
    this.shareMessage.set(null);
  }

  protected shareUrl(build: CloudBuildSummary): string {
    const tree = this.router.createUrlTree(['/public-builds', build.id]);
    const serializedPath = this.router.serializeUrl(tree).replace(/^\//, '');
    const baseUrl = typeof document !== 'undefined' ? document.baseURI : window.location.origin;
    return new URL(serializedPath, baseUrl).toString();
  }

  protected async copyShareUrl(build: CloudBuildSummary): Promise<void> {
    const url = this.shareUrl(build);

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        this.shareMessage.set('Share link copied.');
        return;
      } catch {
        this.shareMessage.set('Clipboard access is unavailable here. Select the link and copy it manually.');
        return;
      }
    }

    this.shareMessage.set('Clipboard access is unavailable here. Select the link and copy it manually.');
  }

  protected async handleRowKeydown(event: KeyboardEvent, build: CloudBuildSummary): Promise<void> {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if (isInteractiveElement(event.target)) {
      return;
    }

    event.preventDefault();
    await this.importBuild(build);
  }

  private async initializePage(): Promise<void> {
    const buildId = this.route.snapshot.paramMap.get('buildId');
    if (!buildId) {
      await this.loadBuilds();
      return;
    }

    const imported = await this.importBuildById(buildId, 'Shared build imported into the local planner.');
    if (!imported) {
      await this.loadBuilds();
    }
  }

  private async importBuildById(buildId: string, successMessage: string): Promise<boolean> {
    if (this.busy()) {
      return false;
    }

    if (!confirmPlannerStateOverwrite()) {
      this.message.set('Import cancelled. Your current planner state was not changed.');
      this.error.set(null);
      return false;
    }

    this.busy.set(true);
    const result = await this.repository.importBuild(buildId);
    this.busy.set(false);

    if (!result.success) {
      this.error.set(result.message);
      return false;
    }

    this.message.set(successMessage);
    this.error.set(null);
    await this.router.navigate(['/rotation-planner']);
    return true;
  }

  protected socialLinks(build: CloudBuildSummary): { kind: SocialLinkKind; label: string; url: string }[] {
    const links: { kind: SocialLinkKind; label: string; url: string }[] = [
      { kind: 'youtube', label: 'YouTube', url: build.youtubeUrl ?? '' },
      { kind: 'twitch', label: 'Twitch', url: build.twitchUrl ?? '' },
      { kind: 'x', label: 'X', url: build.xUrl ?? '' },
      { kind: 'discord', label: 'Discord', url: build.discordUrl ?? '' },
    ];

    return links.filter((link) => Boolean(link.url));
  }

  protected styleIconPath(styleTag: BuildStyleTag): string | null {
    return styleTag === 'hybrid' ? null : STYLE_ICON_PATHS[styleTag];
  }

  protected hybridIconPaths(): string[] {
    return [STYLE_ICON_PATHS.ranged, STYLE_ICON_PATHS.melee, STYLE_ICON_PATHS.magic];
  }

  protected formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleDateString() : 'Unknown date';
  }
}

function isInteractiveElement(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('a, button, input, select, textarea'));
}
