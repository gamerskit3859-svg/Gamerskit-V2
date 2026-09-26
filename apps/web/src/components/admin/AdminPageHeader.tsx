import type { ReactNode } from "react";

/**
 * The standard admin page heading: eyebrow, title, one-line description, and an
 * optional cluster of page-level actions.
 *
 * Shared so the phone treatment only has to be right once — the title steps
 * down a size, the eyebrow is dropped (it says "Admin" on a page reached from
 * the Admin nav, which is not worth a row of a 390px screen), and the actions
 * fall under the title instead of squeezing it.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Page-level buttons. They get their own full-width row on a phone. */
  actions?: ReactNode;
  /** Filters and other controls that sit under the title block. */
  children?: ReactNode;
}) {
  return (
    <header className="mb-4 sm:mb-6">
      <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-fg-soft sm:block">
        Admin
      </span>
      <div className="flex flex-col gap-3 sm:mt-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-xs text-fg-soft sm:text-sm">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
