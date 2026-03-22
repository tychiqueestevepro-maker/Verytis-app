-- Migration: Supprime les contraintes de scope et de type devenues obsolètes
-- On libère les valeurs possibles pour s'adapter aux différents providers (OAuth scopes, etc.)

do $$ 
begin
    -- Suppression de la contrainte de scope
    if exists (select 1 from pg_constraint where conname = 'user_connections_scope_check') then
        alter table public.user_connections drop constraint user_connections_scope_check;
    end if;

    -- Suppression de la contrainte de connection_type si elle existe
    if exists (select 1 from pg_constraint where conname = 'user_connections_connection_type_check') then
        alter table public.user_connections drop constraint user_connections_connection_type_check;
    end if;
end $$;
