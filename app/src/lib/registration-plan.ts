import { useAccountId } from '../state/store';
import { registrationKey, registrationDayKey } from './registration-scope';
import { useMemo } from 'react';
import { useDeviceLibrary } from './device-library';
import { EMPTY_REGISTRATION, readRegistration } from './portal-storage';
import type { CatalogCourse } from './registration';
import { EMPTY_REGISTRATION_DAY, readRegistrationDay } from './registration-day';

/** The registration workspace's own key (`components/RegistrationPortal.tsx`). */
export { REGISTRATION_KEY, registrationKey } from './registration-scope';

/**
 * The registration cart and the registration-day plan, for screens other than
 * the registration workspace — Today, and the Action Center's readiness
 * actions. Both are the same owner-scoped stores the workspace writes, read through
 * the same validators; `useDeviceLibrary` keeps every reader in step.
 */
export function useRegistrationPlan(owner?: string | null) {
  const current = useAccountId();
  const accountId = owner === undefined ? current : owner;
  const registration = useDeviceLibrary(registrationKey(accountId), readRegistration, EMPTY_REGISTRATION);
  const day = useDeviceLibrary(registrationDayKey(accountId), readRegistrationDay, EMPTY_REGISTRATION_DAY);
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
