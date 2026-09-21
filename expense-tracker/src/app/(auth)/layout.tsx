import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-[#0f1724] lg:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(900px 500px at 15% 10%, rgba(42,120,214,0.45), transparent 60%),' +
              'radial-gradient(700px 500px at 85% 85%, rgba(27,175,122,0.35), transparent 60%)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <span className="text-lg font-semibold tracking-tight">Paisa</span>
          <div>
            <p className="max-w-md text-3xl leading-snug font-semibold">
              Every rupee, every account, every goal — in one clean view.
            </p>
            <ul className="mt-8 space-y-3 text-[15px] text-white/70">
              <li>Home and personal spending, split the way you actually think about it.</li>
              <li>Savings, family investments and SIPs tracked per person.</li>
              <li>A FIRE number that updates itself as your money moves.</li>
            </ul>
          </div>
          <p className="text-[13px] text-white/45">Your data lives in your own database.</p>
        </div>
      </aside>
    </main>
  );
}
