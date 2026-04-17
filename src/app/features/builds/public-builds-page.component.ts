import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStoreService } from '../../core/auth/auth-store.service';
import { BUILD_STYLE_OPTIONS, type BuildSortOption, type BuildStyleTag, type CloudBuildSummary } from '../../core/builds/build-sharing.models';
import { CloudBuildRepository } from '../../core/builds/cloud-build.repository';

const STYLE_ICON_PATHS: Record<Exclude<BuildStyleTag, 'hybrid'>, string> = {
  ranged: 'https://runescape.wiki/images/thumb/Ranged-icon.png/21px-Ranged-icon.png?310aa',
  melee: 'https://runescape.wiki/images/thumb/Attack-icon.png/21px-Attack-icon.png?93d2b',
  magic: 'https://runescape.wiki/images/thumb/Magic-icon.png/21px-Magic-icon.png?60d6d',
  necromancy: 'https://runescape.wiki/images/thumb/Necromancy-icon.png/21px-Necromancy-icon.png?f826b',
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
  protected readonly authStore = inject(AuthStoreService);

  protected readonly builds = signal<CloudBuildSummary[]>([]);
  protected readonly search = signal('');
  protected readonly sort = signal<BuildSortOption>('likes');
  protected readonly selectedStyleTags = signal<BuildStyleTag[]>([]);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly styleOptions = BUILD_STYLE_OPTIONS.filter((style) => style.id !== 'hybrid');
  protected readonly activeFilterCount = computed(() => this.selectedStyleTags().length);

  ngOnInit(): void {
    void this.loadBuilds();
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
    this.busy.set(true);
    const result = await this.repository.importBuild(build.id);
    this.busy.set(false);

    if (!result.success) {
      this.error.set(result.message);
      return;
    }

    this.message.set('Public build imported into the local planner.');
    this.error.set(null);
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
