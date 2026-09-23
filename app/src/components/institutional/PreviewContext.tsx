import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  INSTITUTIONAL_FIXTURES,
  type InstitutionalFixture,
  type PreviewPerson,
} from '../../data/institutional-preview';
import type { FlightRole, TenantId } from '../../lib/flight-plan';
import { FlightPlanProvider } from './FlightPlanContext';

interface InstitutionalPreviewContextValue {
  fixtures: readonly InstitutionalFixture[];
  institution: InstitutionalFixture;
  person: PreviewPerson;
  selectInstitution: (id: string) => void;
  selectPerson: (id: string) => void;
}

const PreviewContext = createContext<InstitutionalPreviewContextValue | null>(null);

export function InstitutionalPreviewProvider({ children }: { children: ReactNode }) {
  const [institutionId, setInstitutionId] = useState(INSTITUTIONAL_FIXTURES[0].id);
  const [personId, setPersonId] = useState(INSTITUTIONAL_FIXTURES[0].people[0].id);
  const institution =
    INSTITUTIONAL_FIXTURES.find((fixture) => fixture.id === institutionId) ?? INSTITUTIONAL_FIXTURES[0];
  const person = institution.people.find((candidate) => candidate.id === personId) ?? institution.people[0];

  const value = useMemo<InstitutionalPreviewContextValue>(
    () => ({
      fixtures: INSTITUTIONAL_FIXTURES,
      institution,
      person,
      selectInstitution: (id) => {
        const next = INSTITUTIONAL_FIXTURES.find((fixture) => fixture.id === id) ?? INSTITUTIONAL_FIXTURES[0];
        setInstitutionId(next.id);
        setPersonId(next.people[0].id);
      },
      selectPerson: (id) => setPersonId(id),
    }),
    [institution, person],
  );

  return (
    <PreviewContext.Provider value={value}>
      <FlightPlanProvider
        key={`${institution.id}:${person.id}`}
        tenant={institution.id as TenantId}
        role={person.role as FlightRole}
        personId={person.id}
      >
        {children}
      </FlightPlanProvider>
    </PreviewContext.Provider>
  );
}

export function useInstitutionalPreview(): InstitutionalPreviewContextValue {
  const value = useContext(PreviewContext);
  if (!value) throw new Error('Institutional preview context is unavailable');
  return value;
}
