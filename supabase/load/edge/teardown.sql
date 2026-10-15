-- Removes everything seed.sql made. Rows cascade from auth.users.
delete from auth.users where email like '%@edge-load.example';
