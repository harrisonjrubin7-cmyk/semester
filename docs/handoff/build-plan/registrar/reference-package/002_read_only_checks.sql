BEGIN TRANSACTION READ ONLY;
SELECT schemaname,tablename FROM pg_tables WHERE schemaname='registrar_ref';
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='registrar_ref' AND c.relkind='r';
SELECT count(*) AS invalid_grade_links FROM registrar_ref.grade_decisions g
LEFT JOIN registrar_ref.grade_decisions p ON p.institution_id=g.institution_id AND p.id=g.supersedes_id AND p.enrollment_id=g.enrollment_id
WHERE g.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.sequence_number+1<>g.sequence_number);
SELECT s.id,s.capacity,count(e.id) AS enrolled FROM registrar_ref.sections s
LEFT JOIN registrar_ref.enrollments e ON e.institution_id=s.institution_id AND e.section_id=s.id AND e.status='enrolled'
GROUP BY s.institution_id,s.id,s.capacity HAVING count(e.id)>s.capacity;
ROLLBACK;
