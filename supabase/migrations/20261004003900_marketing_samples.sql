-- Sample marketing data to click through: assets, a content pipeline,
-- social posts around this month, three campaigns with opens and clicks,
-- waitlist signups from several sources, and a few moodboard links.
-- Everything is listed in sample_records, so Settings → "Remove sample data"
-- clears it. Brand strategies are left blank for the content strategist.

do $$
declare
  today date := (now() at time zone 'America/Costa_Rica')::date;
  matteo uuid := (select id from public.team_members where name = 'Matteo Nunziata' limit 1);
  shannon uuid := (select id from public.team_members where name = 'Shannon Garratt' limit 1);
  mora uuid := (select id from public.team_members where name = 'Mora Dorignac' limit 1);
  a_breakfast uuid; a_lunch uuid; a_muay uuid; a_padel uuid; a_pickle uuid; a_strength uuid;
  a_founder uuid; a_women uuid; a_movement uuid; a_copy1 uuid; a_copy2 uuid; a_copy3 uuid;
  it uuid; p uuid; c1 uuid; c2 uuid; c3 uuid; cid uuid;
  i int; n int;
  first_names text[] := array['Lucía','Mateo','Sofía','Daniel','Valentina','Noah','Camila','Liam','Isabella','Lucas',
    'Emma','Thiago','Olivia','Gabriel','Mía','Samuel','Chloe','Andrés','Ava','Julián','Hannah','Tomás','Nora','Felipe','Lea'];
  last_names text[] := array['Rojas','Keller','Moreau','Fischer','Vargas','Brennan','Solís','Haas','Lindqvist','Duarte',
    'Ortega','Weiss','Navarro','Becker','Castro','Dubois','Romero','Jensen','Silva','Meyer','Ramos','Kowalski','Arias','Novak','Leroy'];
  sources text[] := array['instagram','instagram','instagram','facebook','google','newsletter','referral','instagram','tiktok',''];
  brands text[] := array['membership','membership','membership','membership','farm','arkadia','courts','membership'];
begin
  -- Assets ------------------------------------------------------------------
  insert into public.marketing_assets (title, kind, path, brands, tags, created_by) values
    ('Breakfast at La Cocineta', 'photo', '/classes/breakfast.jpg', '{farm,ark}', '{food,breakfast,farm-to-table}', matteo) returning id into a_breakfast;
  insert into public.marketing_assets (title, kind, path, brands, tags, created_by) values
    ('Lunch plate, served', 'photo', '/classes/lunch.jpg', '{farm,ark}', '{food,lunch,people}', matteo) returning id into a_lunch;
  insert into public.marketing_assets (title, kind, path, brands, tags, created_by) values
    ('Muay Thai with Jordan', 'photo', '/classes/muay-thai.jpg', '{ark,membership}', '{classes,training}', matteo) returning id into a_muay;
  insert into public.marketing_assets (title, kind, path, brands, tags, created_by) values
    ('Padel court, morning', 'photo', '/classes/padel.jpg', '{courts}', '{padel,court}', matteo) returning id into a_padel;
  insert into public.marketing_assets (title, kind, path, brands, tags, created_by) values
    ('Pickleball paddle and net', 'photo', '/classes/pickleball.jpg', '{courts}', '{pickleball,court}', matteo) returning id into a_pickle;
  insert into public.marketing_assets (title, kind, path, brands, tags, created_by) values
    ('Strength class on the deck', 'photo', '/classes/strength.jpg', '{ark,membership}', '{classes,training,deck}', matteo) returning id into a_strength;
  insert into public.marketing_assets (title, kind, path, brands, tags, created_by) values
    ('Founder Circle', 'photo', '/classes/founder-circle.jpg', '{membership,ark}', '{community,circle}', matteo) returning id into a_founder;
  insert into public.marketing_assets (title, kind, path, brands, tags, created_by) values
    ('Women Circle on the deck', 'photo', '/classes/women-circle.jpg', '{membership}', '{community,circle}', matteo) returning id into a_women;
  insert into public.marketing_assets (title, kind, path, brands, tags, created_by) values
    ('Movement class', 'photo', '/classes/movement.jpg', '{ark}', '{classes,movement}', matteo) returning id into a_movement;
  insert into public.marketing_assets (title, kind, body, brands, tags, created_by) values
    ('Farm shop drop caption', 'copy', E'This week from the farm: mangoes, rambután, three kinds of basil and the first passion fruit of the season.\n\nShop opens Saturday at 8. Members get it first.', '{farm}', '{caption,farm-shop}', shannon) returning id into a_copy1;
  insert into public.marketing_assets (title, kind, body, brands, tags, created_by) values
    ('Membership one-liner', 'copy', 'A members club for people who want to live well and build things, on a farm by the sea in Santa Teresa.', '{membership,ark}', '{tagline,bio}', shannon) returning id into a_copy2;
  insert into public.marketing_assets (title, kind, body, brands, tags, created_by) values
    ('Arkadia open morning invite', 'copy', E'Come and see a morning at Arkadia. Meet the guides, walk the garden classroom, and ask anything.\n\nSaturday, 9 to 11. Families welcome.', '{arkadia}', '{invite,school}', shannon) returning id into a_copy3;
  insert into public.sample_records (table_name, record_id)
    select 'marketing_assets', id::text from public.marketing_assets
    where id in (a_breakfast, a_lunch, a_muay, a_padel, a_pickle, a_strength, a_founder, a_women, a_movement, a_copy1, a_copy2, a_copy3);

  -- Content pipeline ----------------------------------------------------------
  for i in 1..16 loop
    insert into public.content_items (title, brief, brands, stage, assignee_id, due_date, published_at, created_by)
    values (
      (array['Harvest of the week: mangoes','Reel: a morning on the padel court','Arkadia open morning invite',
             'Member story: Jonas building on lot 12','Farm shop launch carousel','Pickleball league sign-ups',
             'Breakfast at La Cocineta, short video','Founder Circle recap','Women Circle: what it is, in members'' words',
             'Courts at golden hour photo set','Arkadia guide profile: the garden classroom','Volunteer day highlights',
             'October newsletter: what''s new','Muay Thai with Jordan teaser','Rainy season on the farm','Waitlist explainer: how membership works'])[i],
      (array['Weekly harvest post. Shot list: the crates, hands, one recipe card.',
             '15 seconds, no talking. Sunrise, first serve, rally, wide shot.',
             'Invite local families to the open morning. Warm, practical, with the date and time up top.',
             'Long caption with a portrait. Why they chose The ARK, what they''re building.',
             'Five slides: what''s in the shop, when it opens, members first, how to order.',
             'Explain the league format and how to join. Link to court booking.',
             'Behind the scenes in the kitchen, then the plate.',
             'Three quotes from the circle and one photo. No names without permission.',
             'Short interviews with two members. Keep it gentle.',
             'Photo set for the courts brand. Wide, detail, people.',
             'Profile of one guide and the outdoor classroom.',
             'Photos and a few lines from Saturday''s volunteer day.',
             'Monthly email: farm, courts, events coming up, member news.',
             'Short clip for the class schedule. Energy, not hype.',
             'What grows in the rain and what we do differently.',
             'Answer the five questions we get most about joining.'])[i],
      string_to_array((array['farm','courts','arkadia','membership,ark','farm','courts','farm,ark','membership',
             'membership','courts','arkadia','farm','ark,membership','ark','farm','membership'])[i], ','),
      (array['published','published','approved','review','production','idea','published','published','review',
             'production','idea','published','production','approved','idea','review'])[i],
      (array[shannon, mora, shannon, matteo, shannon, mora, shannon, matteo, shannon, mora, null, shannon, matteo, mora, null, shannon])[i],
      today + (array[-20,-12,4,2,6,14,-30,-8,3,-2,21,-15,9,5,null,1])[i],
      case when (array['published','published','approved','review','production','idea','published','published','review',
             'production','idea','published','production','approved','idea','review'])[i] = 'published'
           then (today + (array[-19,-11,0,0,0,0,-28,-6,0,0,0,-14,0,0,0,0])[i])::timestamp at time zone 'America/Costa_Rica' + interval '10 hours'
      end,
      matteo
    ) returning id into it;
    insert into public.sample_records values ('content_items', it::text);
    -- Make a few look stuck.
    if i in (4, 10, 13, 16) then
      update public.content_items set stage_changed_at = now() - interval '9 days' where id = it;
    end if;
    -- Attach assets and leave a comment on some.
    if i = 1 then insert into public.content_item_assets values (it, a_breakfast), (it, a_copy1); end if;
    if i = 2 then insert into public.content_item_assets values (it, a_padel); end if;
    if i = 3 then insert into public.content_item_assets values (it, a_copy3); end if;
    if i = 5 then insert into public.content_item_assets values (it, a_copy1), (it, a_lunch); end if;
    if i = 8 then insert into public.content_item_assets values (it, a_founder); end if;
    if i = 10 then insert into public.content_item_assets values (it, a_padel), (it, a_pickle); end if;
    if i in (4, 9, 16) then
      insert into public.content_comments (item_id, author_id, body) values
        (it, matteo, 'Looks good. Can we get one more photo with people in it?'),
        (it, shannon, 'Yes, booking it for Thursday morning.');
    end if;
  end loop;

  -- Social posts: published last month and this month, planned ahead ----------
  for i in 0..23 loop
    insert into public.social_posts (caption, brands, channels, scheduled_at, status, published_at, link,
                                     reach, likes, comments, shares, saves, created_by)
    values (
      (array['Harvest of the week: mangoes, rambután and the first passion fruit.',
             'Sunrise on the padel court. Booking opens two weeks ahead for members.',
             'Breakfast at La Cocineta, every morning from 7.',
             'What a Founder Circle feels like, in three quotes.',
             'Arkadia open morning this Saturday. Families welcome.',
             'Pickleball league starts next week. Sign-ups in the link.',
             'Strength class on the deck, Tuesdays and Thursdays.',
             'The farm shop opens Saturday at 8. Members first.'])[(i % 8) + 1],
      string_to_array((array['farm','courts','farm,ark','membership','arkadia','courts','ark','farm'])[(i % 8) + 1], ','),
      string_to_array((array['instagram','instagram,facebook','instagram','instagram,linkedin',
             'facebook,whatsapp','instagram,tiktok','instagram','whatsapp,instagram'])[(i % 8) + 1], ','),
      ((today + (i * 3 - 36)) + time '08:30' + ((i % 3) * interval '3 hours')) at time zone 'America/Costa_Rica',
      case when i * 3 - 36 < 0 then 'published' when i % 3 = 0 then 'draft' else 'ready' end,
      case when i * 3 - 36 < 0 then ((today + (i * 3 - 36)) + time '09:00') at time zone 'America/Costa_Rica' end,
      case when i % 4 = 0 then 'https://theark.world/join?utm_source=instagram&utm_medium=social&utm_campaign=sample-post' end,
      case when i * 3 - 36 < 0 then 600 + (i * 137) % 1900 end,
      case when i * 3 - 36 < 0 then 40 + (i * 53) % 260 end,
      case when i * 3 - 36 < 0 then 3 + (i * 7) % 30 end,
      case when i * 3 - 36 < 0 then 1 + (i * 5) % 18 end,
      case when i * 3 - 36 < 0 then 2 + (i * 11) % 40 end,
      shannon
    ) returning id into p;
    insert into public.sample_records values ('social_posts', p::text);
    insert into public.social_post_assets (post_id, asset_id)
    values (p, (array[a_breakfast, a_padel, a_breakfast, a_founder, a_copy3, a_pickle, a_strength, a_lunch])[(i % 8) + 1])
    on conflict do nothing;
  end loop;

  -- Waitlist signups from several sources ----------------------------------------
  for i in 1..25 loop
    insert into public.contacts (name, email, source, waitlist_at, lead_brand, utm_source, utm_medium, utm_campaign, show_in_directory)
    values (
      first_names[i] || ' ' || last_names[i],
      lower(translate(first_names[i], 'áéíóúñ', 'aeioun')) || '.' || lower(translate(last_names[i], 'áéíóúñ', 'aeioun')) || '@example.com',
      coalesce(nullif(sources[(i % 10) + 1], ''), 'Waitlist'),
      ((today - ((i * 37) % 85)) + time '11:00') at time zone 'America/Costa_Rica',
      brands[(i % 8) + 1],
      nullif(sources[(i % 10) + 1], ''),
      case sources[(i % 10) + 1] when 'instagram' then 'social' when 'facebook' then 'social' when 'tiktok' then 'social'
        when 'google' then 'cpc' when 'newsletter' then 'email' when 'referral' then 'referral' end,
      case when sources[(i % 10) + 1] in ('instagram','facebook','tiktok') then (array['harvest-reel','padel-sunrise','founder-circle'])[(i % 3) + 1]
           when sources[(i % 10) + 1] = 'newsletter' then 'october-newsletter' end,
      false
    ) returning id into cid;
    insert into public.sample_records values ('contacts', cid::text);
    insert into public.contact_stages (contact_id, pipeline, stage)
    values (cid, 'memberships', case when i % 6 = 0 then 'applied' when i % 7 = 0 then 'invited' else 'waitlist' end)
    on conflict do nothing;
  end loop;

  -- Campaigns ------------------------------------------------------------------------
  insert into public.email_campaigns (name, brands, list_key, subject, body, status, sent_at, created_by) values
    ('September waitlist update', '{membership}', 'waitlist', 'A note from The ARK',
     E'Hi {{first_name}},\n\nA quick note from Santa Teresa. The rains are here, the farm is green, and the courts are busy before breakfast.\n\n[[See what''s on|https://theark.world]]\n\nThe ARK team',
     'sent', ((today - 26) + time '09:00') at time zone 'America/Costa_Rica', shannon)
    returning id into c1;
  insert into public.email_campaigns (name, brands, list_key, subject, body, status, sent_at, created_by) values
    ('Farm shop opening', '{farm}', 'members', 'The farm shop opens Saturday',
     E'Hi {{first_name}},\n\nThe farm shop opens this Saturday at 8. Members get first pick.\n\n- Mangoes and rambután\n- Three kinds of basil\n- Eggs from the hens\n\n[[Order ahead|https://theark.world/shop]]',
     'sent', ((today - 9) + time '07:30') at time zone 'America/Costa_Rica', shannon)
    returning id into c2;
  insert into public.email_campaigns (name, brands, list_key, subject, body, status, scheduled_at, created_by) values
    ('Pickleball league', '{courts}', 'members', 'A pickleball league, starting next week',
     E'Hi {{first_name}},\n\nWe''re starting a friendly pickleball league on Tuesday evenings. All levels, partners matched for you.\n\n[[Sign up|https://theark.world/portal/courts]]',
     'scheduled', ((today + 3) + time '08:00') at time zone 'America/Costa_Rica', shannon)
    returning id into c3;
  insert into public.sample_records values ('email_campaigns', c1::text), ('email_campaigns', c2::text), ('email_campaigns', c3::text);

  -- Sends with what happened to them (example.com addresses, never emailed).
  for i in 1..140 loop
    insert into public.email_sends (campaign_id, email, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, unsubscribed_at)
    values (
      c1, 'sample' || i || '@example.com', 'sent',
      ((today - 26) + time '09:00') at time zone 'America/Costa_Rica',
      case when i % 40 <> 0 then ((today - 26) + time '09:01') at time zone 'America/Costa_Rica' end,
      case when i % 100 < 52 then ((today - 26) + time '12:00') at time zone 'America/Costa_Rica' end,
      case when i % 100 < 11 then ((today - 26) + time '12:05') at time zone 'America/Costa_Rica' end,
      case when i % 40 = 0 then ((today - 26) + time '09:01') at time zone 'America/Costa_Rica' end,
      case when i % 70 = 0 then ((today - 25) + time '10:00') at time zone 'America/Costa_Rica' end
    ) returning id into p;
    insert into public.sample_records values ('email_sends', p::text);
  end loop;
  for i in 1..64 loop
    insert into public.email_sends (campaign_id, email, status, sent_at, delivered_at, opened_at, clicked_at)
    values (
      c2, 'member' || i || '@example.com', 'sent',
      ((today - 9) + time '07:30') at time zone 'America/Costa_Rica',
      ((today - 9) + time '07:31') at time zone 'America/Costa_Rica',
      case when i % 10 < 7 then ((today - 9) + time '08:15') at time zone 'America/Costa_Rica' end,
      case when i % 10 < 3 then ((today - 9) + time '08:20') at time zone 'America/Costa_Rica' end
    ) returning id into p;
    insert into public.sample_records values ('email_sends', p::text);
  end loop;

  -- Moodboard links -------------------------------------------------------------------
  insert into public.brand_refs (brand, url, caption, created_by) values
    ('farm', 'https://www.instagram.com/explore/tags/regenerativefarming/', 'Close-up harvest shots, natural light, no filters', matteo)
    returning id into p;
  insert into public.sample_records values ('brand_refs', p::text);
  insert into public.brand_refs (brand, url, caption, created_by) values
    ('courts', 'https://www.instagram.com/explore/tags/padel/', 'Early morning, long shadows, people mid-rally', matteo)
    returning id into p;
  insert into public.sample_records values ('brand_refs', p::text);
end $$;

-- Sample campaigns never send (one is scheduled, and its list has real members).
create or replace function public.is_sample(p_table text, p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.sample_records where table_name = p_table and record_id = p_id::text); $$;
revoke all on function public.is_sample(text, uuid) from public, anon;
grant execute on function public.is_sample(text, uuid) to authenticated, service_role;
