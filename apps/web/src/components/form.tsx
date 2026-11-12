"use client";

export const inputClass =
  "w-full h-12 rounded-xl border border-line bg-bg px-4 text-[15px] outline-none focus:border-fg transition-colors placeholder:text-subtle aria-[invalid=true]:border-up";

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        {label}
        {required ? <span className="text-accent">*</span> : <span className="text-xs font-normal text-subtle">선택</span>}
      </span>
      <div className="mt-2">{children}</div>
      {error ? (
        <span className="mt-1.5 block text-xs text-up">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-subtle">{hint}</span>
      )}
    </label>
  );
}

export function SubmitDone({ title, desc, children }: { title: string; desc: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line px-6 py-14 text-center">
      <div className="mx-auto size-14 rounded-full bg-fg text-bg grid place-items-center text-2xl">✓</div>
      <p className="mt-5 text-xl font-extrabold">{title}</p>
      <p className="mt-2 text-sm text-muted leading-relaxed">{desc}</p>
      {children && <div className="mt-8 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

export const primaryBtn =
  "h-12 px-8 rounded-full bg-fg text-bg font-bold hover:bg-accent transition-colors disabled:bg-surface disabled:text-subtle";
export const secondaryBtn =
  "h-12 px-8 rounded-full border border-line font-semibold hover:border-fg transition-colors grid place-items-center";

/** 데모(읽기 전용) 모드 안내 */
export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">
      <b className="mr-1.5 text-fg">데모 모드</b>
      {children}
    </p>
  );
}
