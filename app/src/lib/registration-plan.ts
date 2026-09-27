import { useMemo } from 'react';
import { useDeviceLibrary } from './device-library';
import { EMPTY_REGISTRATION, readRegistration } from './portal-storage';
import type { CatalogCourse } from './registration';
import { EMPTY_REGISTRATION_DAY, REGISTRATION_DAY_KEY, readRegistrationDay } from './registration-day';

/** The registration workspace's own key (`components/RegistrationPortal.tsx`). */
export const REGISTRATION_KEY = 'semester.registration.v1';

/**
 * The registration cart and the registration-day plan, for screens other than
 * the registration workspace — Today, and the Action Center's readiness
 * actions. Both are the same device stores the workspace writes, read through
 * the same validators; `useDeviceLibrary` keeps every reader in step.
 */
export function useRegistrationPlan() {
  const registration = useDeviceLibrary(REGISTRATION_KEY, readRegistration, EMPTY_REGISTRATION);
  const day = useDeviceLibrary(REGISTRATION_DAY_KEY, readRegistrationDay, EMPTY_REGISTRATION_DAY);
  const catalog: CatalogCourse[] = useMemo(() => registration.value.catalog?.courses ?? [], [registration.value.catalog]);
  const cart = useMemo(() => {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    return registration.value.cart.map((id) => byId.get(id)).filter((c): c is CatalogCourse => !!c);
  }, [catalog, registration.value.cart]);
  return {
    data: day.value,
    update: day.update,
    catalog,
    cart,
    institution: registration.value.catalog?.institution ?? null,
    importedAt: registration.value.catalog?.importedAt ?? null,
  };
}
