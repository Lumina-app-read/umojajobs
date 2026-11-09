import { APP_NAME } from '@opportinities/shared';

// Page provisoire de la phase 1a. Les textes d'interface traduits arrivent en phase 1d.
export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <h1 className="text-3xl font-semibold tracking-tight text-blue-900">{APP_NAME}</h1>
    </main>
  );
}
