-- 1. size and growth: run daily, keep the results (a table you can chart)
select n.nspname, c.relname, c.reltuples::bigint as est_rows,
       pg_total_relation_size(c.oid) as total_bytes, pg_relation_size(c.oid) as heap_bytes,
       pg_total_relation_size(c.oid) - pg_relation_size(c.oid) as index_and_toast_bytes
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname in ('public','private') and c.relkind = 'r'
 order by total_bytes desc limit 25;

-- 2. THE key input: bytes per student in the blob tables (percentiles, not the mean)
select percentile_cont(array[0.5, 0.9, 0.99]) within group (order by bytes) as p50_p90_p99_bytes_per_student
  from (select user_id, sum(pg_column_size(t.*)) as bytes
          from (select user_id, data from public.notes union all select user_id, data from public.tasks
                union all select user_id, data from public.courses union all select user_id, data from public.sittings
                union all select user_id, data from public.appointments union all select user_id, data from public.state) t
         group by user_id) per_user;

-- 3. indexes that cost writes and serve no reads (needs production statistics; meaningless on a fresh database)
select s.schemaname, s.relname, s.indexrelname, s.idx_scan, pg_relation_size(s.indexrelid) as bytes
  from pg_stat_user_indexes s join pg_index i on i.indexrelid = s.indexrelid
 where s.idx_scan = 0 and not i.indisunique and not i.indisprimary and s.schemaname in ('public','private')
 order by bytes desc limit 25;

-- 4. dead tuples and last autovacuum on the hot tables
select relname, n_live_tup, n_dead_tup, round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) as dead_pct, last_autovacuum
  from pg_stat_user_tables where schemaname in ('public','private') order by n_dead_tup desc limit 15;

-- 5. TOAST share of a blob table (how much of `data` is out of line)
select c.relname, pg_size_pretty(pg_relation_size(c.oid)) heap, pg_size_pretty(pg_relation_size(c.reltoastrelid)) toast
  from pg_class c where c.relname in ('notes','tasks','courses','state') and c.relnamespace = 'public'::regnamespace and c.reltoastrelid <> 0;
