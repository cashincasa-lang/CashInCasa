-- Configuração do bucket privado usado pelas fotos de capa dos cards.
-- Este arquivo apenas prepara a configuração; não foi executado no projeto Supabase.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-covers',
  'item-covers',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create schema if not exists cashincasa_private;
revoke all on schema cashincasa_private from public;
grant usage on schema cashincasa_private to authenticated;

create or replace function cashincasa_private.can_read_item_cover(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.items as i
    where i.thumbnail = 'storage:item-covers/' || p_name
      and (
        i.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.folders as f
          where f.id = i.folder_id
            and (to_jsonb(f)->>'owner_id') = (select auth.uid())::text
        )
        or exists (
          select 1
          from public.folder_shares as fs
          where fs.folder_id = i.folder_id
            and fs.user_id = (select auth.uid())
        )
      )
      and (
        split_part(p_name, '/', 1) = i.owner_id::text
        or exists (
          select 1
          from public.folders as f
          where f.id = i.folder_id
            and (to_jsonb(f)->>'owner_id') = split_part(p_name, '/', 1)
        )
        or exists (
          select 1
          from public.folder_shares as fs
          where fs.folder_id = i.folder_id
            and fs.user_id::text = split_part(p_name, '/', 1)
        )
      )
  );
$$;

revoke all on function cashincasa_private.can_read_item_cover(text) from public;
grant execute on function cashincasa_private.can_read_item_cover(text) to authenticated;

drop policy if exists "item covers readable by item owner or folder member" on storage.objects;
create policy "item covers readable by item owner or folder member"
on storage.objects for select to authenticated
using (
  bucket_id = 'item-covers'
  and cashincasa_private.can_read_item_cover(name)
);

drop policy if exists "users upload their own item covers" on storage.objects;
create policy "users upload their own item covers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'item-covers'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "users update their own item covers" on storage.objects;
create policy "users update their own item covers"
on storage.objects for update to authenticated
using (
  bucket_id = 'item-covers'
  and split_part(name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'item-covers'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "users delete their own item covers" on storage.objects;
create policy "users delete their own item covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'item-covers'
  and split_part(name, '/', 1) = (select auth.uid())::text
);
