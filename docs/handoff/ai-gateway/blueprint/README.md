# Semester AI gateway blueprint

This package contains an interactive static specification and a Node reference implementation. It is not production code or a live AI service.

Run reference tests: `node --test gateway.test.mjs`.

The code intentionally permits only two approved public catalog topics and a mock provider. It rejects free text, attachments, student record fields, unknown sources, live providers without approval, tools and raw provider prose. Replace its dependency adapters only after reconciling the existing repository authorization/policy system; do not add a parallel role/RLS schema.

Deploy only the static index.html as a protected reference site. Do not configure real model credentials, Supabase credentials, or a function endpoint on this preview. Production gateway deployment requires a separate approved implementation plan, adapters, migration review, red-team evidence and institutional authority.
