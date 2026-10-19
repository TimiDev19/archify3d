-- Supabase's browser MIME detection identifies DXF files as image/vnd.dxf.
-- Allow that detected type in the otherwise-private source drawing bucket.
update storage.buckets
set allowed_mime_types = array(
  select distinct mime_type
  from unnest(coalesce(allowed_mime_types, array[]::text[]) || array['image/vnd.dxf']::text[]) as mime_type
)
where id = 'archify-private';
