-- Base de datos del sitio de la escuela.
-- Ya está aplicada en el proyecto "escuela-6014". Se puede volver a ejecutar sin problema
-- (Supabase > SQL Editor > New query > pegar > Run), por ejemplo en un proyecto nuevo.

-- 1) Contenido del sitio: comunicados, proyectos, calendario, etc.
create table if not exists public.contenido (
  coleccion text    not null,
  id        text    not null,
  orden     integer not null default 0,
  data      jsonb   not null default '{}'::jsonb,
  primary key (coleccion, id)
);

-- 2) Docentes habilitados para editar. Solo se modifica desde el SQL Editor, nunca desde la página.
create table if not exists public.docentes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre  text
);

alter table public.contenido enable row level security;
alter table public.docentes  enable row level security;

grant select on public.contenido to anon, authenticated;
grant insert, update, delete on public.contenido to authenticated;
grant select on public.docentes to authenticated;

-- 3) Quién puede qué: el contenido lo lee cualquiera y lo modifican solo los docentes.
drop policy if exists contenido_lectura_publica on public.contenido;
create policy contenido_lectura_publica on public.contenido
  for select to anon, authenticated using (true);

drop policy if exists contenido_alta_docentes on public.contenido;
create policy contenido_alta_docentes on public.contenido
  for insert to authenticated
  with check (exists (select 1 from public.docentes d where d.user_id = (select auth.uid())));

drop policy if exists contenido_edicion_docentes on public.contenido;
create policy contenido_edicion_docentes on public.contenido
  for update to authenticated
  using      (exists (select 1 from public.docentes d where d.user_id = (select auth.uid())))
  with check (exists (select 1 from public.docentes d where d.user_id = (select auth.uid())));

drop policy if exists contenido_baja_docentes on public.contenido;
create policy contenido_baja_docentes on public.contenido
  for delete to authenticated
  using (exists (select 1 from public.docentes d where d.user_id = (select auth.uid())));

-- Cada persona solo puede ver su propia fila de "docentes" (así la página sabe si es docente).
drop policy if exists docentes_ver_la_propia on public.docentes;
create policy docentes_ver_la_propia on public.docentes
  for select to authenticated using (user_id = (select auth.uid()));

-- 4) Fotos de los proyectos: se ven públicas, las suben y borran solo los docentes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

drop policy if exists fotos_subir_docentes on storage.objects;
create policy fotos_subir_docentes on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and exists (select 1 from public.docentes d where d.user_id = (select auth.uid())));

drop policy if exists fotos_cambiar_docentes on storage.objects;
create policy fotos_cambiar_docentes on storage.objects
  for update to authenticated
  using      (bucket_id = 'fotos' and exists (select 1 from public.docentes d where d.user_id = (select auth.uid())))
  with check (bucket_id = 'fotos' and exists (select 1 from public.docentes d where d.user_id = (select auth.uid())));

drop policy if exists fotos_borrar_docentes on storage.objects;
create policy fotos_borrar_docentes on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and exists (select 1 from public.docentes d where d.user_id = (select auth.uid())));

-- ----------------------------------------------------------------------
-- DAR DE ALTA A UN DOCENTE (después de crear su usuario en Authentication > Users):
--   insert into public.docentes (user_id, nombre)
--   select id, 'Nombre y apellido' from auth.users where email = 'docente@correo.com';
--
-- DAR DE BAJA A UN DOCENTE:
--   delete from public.docentes where user_id = (select id from auth.users where email = 'docente@correo.com');
-- ----------------------------------------------------------------------