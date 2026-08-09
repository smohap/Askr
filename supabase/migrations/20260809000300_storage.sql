-- Storage buckets. Every object is keyed by the id of the row that owns it, so
-- the policies below can authorise on the first path segment.
--
--   request-media/<request_id>/<file>
--   offer-attachments/<offer_id>/<file>
--   provider-documents/<provider_id>/<file>
--   provider-logos/<provider_id>/<file>          (public bucket)
--   chat-attachments/<request_id>/<provider_id>/<file>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('request-media', 'request-media', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('offer-attachments', 'offer-attachments', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('provider-documents', 'provider-documents', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('provider-logos', 'provider-logos', true, 2097152,
   array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('chat-attachments', 'chat-attachments', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------- request media

create policy request_media_read on storage.objects
for select to authenticated
using (
  bucket_id = 'request-media'
  and exists (
    select 1 from public.requests r
    where r.id::text = (storage.foldername(name))[1]
      and (
        r.buyer_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.request_broadcasts b
          where b.request_id = r.id and b.provider_id = public.my_provider_id()
        )
      )
  )
);

create policy request_media_write on storage.objects
for insert to authenticated
with check (
  bucket_id = 'request-media'
  and exists (
    select 1 from public.requests r
    where r.id::text = (storage.foldername(name))[1] and r.buyer_id = auth.uid()
  )
);

create policy request_media_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'request-media'
  and exists (
    select 1 from public.requests r
    where r.id::text = (storage.foldername(name))[1] and r.buyer_id = auth.uid()
  )
);

-- ---------------------------------------------------------------- offer attachments

create policy offer_attachments_read on storage.objects
for select to authenticated
using (
  bucket_id = 'offer-attachments'
  and exists (
    select 1 from public.offers o
    where o.id::text = (storage.foldername(name))[1]
      and (
        o.provider_id = public.my_provider_id()
        or public.is_admin()
        or exists (select 1 from public.requests r where r.id = o.request_id and r.buyer_id = auth.uid())
      )
  )
);

create policy offer_attachments_write on storage.objects
for insert to authenticated
with check (
  bucket_id = 'offer-attachments'
  and exists (
    select 1 from public.offers o
    where o.id::text = (storage.foldername(name))[1] and o.provider_id = public.my_provider_id()
  )
);

-- ---------------------------------------------------------------- provider documents
-- Verification documents are the most sensitive objects in the system: the owning
-- provider and admins, nobody else.

create policy provider_documents_read on storage.objects
for select to authenticated
using (
  bucket_id = 'provider-documents'
  and (
    (storage.foldername(name))[1] = public.my_provider_id()::text
    or public.is_admin()
  )
);

create policy provider_documents_write on storage.objects
for insert to authenticated
with check (
  bucket_id = 'provider-documents'
  and (storage.foldername(name))[1] = public.my_provider_id()::text
);

-- ---------------------------------------------------------------- provider logos

create policy provider_logos_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'provider-logos');

create policy provider_logos_write on storage.objects
for insert to authenticated
with check (
  bucket_id = 'provider-logos'
  and (storage.foldername(name))[1] = public.my_provider_id()::text
);

create policy provider_logos_update on storage.objects
for update to authenticated
using (
  bucket_id = 'provider-logos'
  and (storage.foldername(name))[1] = public.my_provider_id()::text
);

-- ---------------------------------------------------------------- chat attachments

create policy chat_attachments_read on storage.objects
for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and (
    public.is_admin()
    or (storage.foldername(name))[2] = public.my_provider_id()::text
    or exists (
      select 1 from public.requests r
      where r.id::text = (storage.foldername(name))[1] and r.buyer_id = auth.uid()
    )
  )
);

create policy chat_attachments_write on storage.objects
for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (
    (storage.foldername(name))[2] = public.my_provider_id()::text
    or exists (
      select 1 from public.requests r
      where r.id::text = (storage.foldername(name))[1] and r.buyer_id = auth.uid()
    )
  )
);
