-- Múltiplas fotos por etapa (Início/Fim) na atividade.
-- Colunas array novas; colunas escalares antigas mantidas para retrocompat.

alter table activities
  add column if not exists start_photo_urls text[] not null default '{}',
  add column if not exists end_photo_urls text[] not null default '{}';

-- Backfill a partir das colunas escalares existentes.
update activities
  set start_photo_urls = array[start_photo_url]
  where start_photo_url is not null
    and (start_photo_urls is null or array_length(start_photo_urls, 1) is null);

update activities
  set end_photo_urls = array[end_photo_url]
  where end_photo_url is not null
    and (end_photo_urls is null or array_length(end_photo_urls, 1) is null);