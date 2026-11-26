import { Download, Smartphone } from 'lucide-react';
import release from '../../public/downloads/android-release.json';

export function AndroidDownload({ compact = false, iconOnly = false }: { compact?: boolean; iconOnly?: boolean }) {
  if (compact || iconOnly) return <a
    href={release.path} download={release.filename} type="application/vnd.android.package-archive"
    aria-label="Download August for Android"
    className={iconOnly
      ? 'rounded-xl border border-border p-2.5 text-accent transition-colors hover:bg-accent/5'
      : 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent/5'}>
    <Download size={16} aria-hidden="true" />
    {!iconOnly && <span>Get the Android app</span>}
  </a>;

  return <section aria-label="August for Android" className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><Smartphone size={21} aria-hidden="true" /></span>
      <div>
        <h2 className="font-serif text-xl text-foreground">Take August with you.</h2>
        <p className="mt-1 text-xs leading-5 text-muted">Your journal, reflections, and connected moments. Now on Android.</p>
      </div>
    </div>
    <a href={release.path} download={release.filename} type="application/vnd.android.package-archive"
      className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/15">
      <Download size={17} aria-hidden="true" /> Download for Android
    </a>
    <p className="mt-3 text-center text-[11px] leading-5 text-muted">Preview v{release.version} · Android {release.minimumAndroid}+ · {(release.bytes / 1e6).toFixed(1)} MB</p>
    <p className="mt-1 text-center text-[11px] leading-5 text-muted">Download the APK on your phone, then open it to install August Dev.</p>
  </section>;
}
