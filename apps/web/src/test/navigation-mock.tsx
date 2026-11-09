import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { vi } from 'vitest';

/** Remplace la navigation next-intl (qui dépend du routeur Next.js) dans les tests de composants. */
export const routerMock = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };

export const navigationMock = {
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => routerMock,
  usePathname: () => '/',
  redirect: vi.fn(),
  getPathname: vi.fn(),
};
