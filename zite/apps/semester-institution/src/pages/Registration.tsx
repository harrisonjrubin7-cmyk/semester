// Registration & enrollment workspace (Institution). Reuses Semester's registrar desk: registration requests, add/drop and
// withdrawal changes, waitlists and overrides, with seat capacity checked in the database.
import { RegistrarDesk } from '../../../semester/src/pages/Staff';

export default function Registration() {
  return <RegistrarDesk />;
}
