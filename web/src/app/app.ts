import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  protected readonly email = this.auth.email;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly signedIn = computed(() => !!this.auth.session());
  protected readonly theme = this.themeService.theme;

  protected signOut(): void {
    this.auth.signOut();
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
