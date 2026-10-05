-- Round 7: rental homes from theark.world/ark-rentals and the Guesty booking site.
-- Photos are full https:// addresses on the Guesty and Squarespace CDNs (sized to 1600px).
-- Listings start as drafts: these homes are still booked through Guesty.

alter table public.lots drop constraint lots_kind_check;
alter table public.lots add constraint lots_kind_check
  check (kind in ('lot', 'estate', 'fractional', 'rental'));

-- The seven Beehive cabins at The Farm, each its own home (they book separately).
insert into public.lots (code, name, kind, status, home_status, home_name, in_hospitality, hospitality_since,
  listing_title, listing_summary, bedrooms, beds, bathrooms, max_guests, nightly_rate, rate_currency, check_in_time, check_out_time,
  amenities, house_rules, listing_notes, listing_published)
select 'Beehive ' || n, 'Beehive ' || n, 'rental', 'not_for_sale', 'built', 'Beehive ' || n, true, current_date,
  'Beehive ' || n, 'Nature-inspired eco cabins at The Farm, built with sustainable materials and conscious architecture. Each cabin has two twin beds, a private bathroom and an outdoor shower surrounded by tropical vegetation, with solar-powered air conditioning and a small refrigerator.

Guests share La Cocineta, the kitchen and gathering space, stocked with filtered drinking water and a storage basket for each cabin. The padel and pickleball courts, the Shala, the farm and the farm market are all open to guests.', 1, 2, 1, 2, 120, 'USD', '15:00', '11:00',
  array['Air conditioning','Wifi','Workspace','Kitchen','Washer','Parking','Garden','Outdoor shower','Solar power','Family friendly','Club access']::text[], null,
  'Imported from Guesty (https://theark.guestybookings.com/en/properties/' || (array['68d598ad4729af001245602d', '68d598ad4729af0012456039', '68d598ad4729af0012456045', '68d598ad4729af0012456051', '68d598ad4729af001245605d', '68d598ad4729af0012456069', '68d598ad4729af0012456075'])[n] || '). Bookings are taken there for now.', false
from generate_series(1, 7) as n
on conflict (code) do nothing;

insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1780419448', 'p0kzqlxmisiw3gwg2dtn.jpg', 0),
  ('1780419488', 'ecogyj9kbsztktt6y5id.jpg', 1),
  ('1780419381', 'nlelcvdaamzluxaxlkpt.jpg', 2),
  ('1780419708', 'oemufz2dljdtxj5ms7ll.jpg', 3),
  ('1780419556', 'xsp85dl5lhzao9giejrn.jpg', 4),
  ('1780419622', 'ouh1jjmx7icix1krjgjf.jpg', 5),
  ('1781022579', 't49wq4gk7wglvwqrhkpq.jpg', 6),
  ('1781022581', 'bmgkm7maimdq80qzfan5.jpg', 7),
  ('1781022581', 'qh2h1gyzq1cyzxemysrs.jpg', 8),
  ('1781022583', 'ncejij6s144zqsmmvvep.jpg', 9),
  ('1781022584', 'uuijexpommvix8fdvb2f.jpg', 10)
) as v (ver, file, position)
where l.code = 'Beehive 1' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1780420832', 'p22kxey8odvgbrm5hmul.jpg', 0),
  ('1780420925', 'cyatwgnym3vghfdceffo.jpg', 1),
  ('1780420834', 'abq0ccv2gmxcilfmm7bh.jpg', 2),
  ('1780420832', 'yrw3rrmudwik8a6bj4kk.jpg', 3),
  ('1780420820', 'bucq7g0qgba3hot2rilg.jpg', 4),
  ('1780420833', 'yg19b2tghn74l33aw1yu.jpg', 5),
  ('1781033252', 'aho5b8sijrqpqlbcfmkv.jpg', 6),
  ('1781033255', 'fs1g5pwvlq6ymi9aoei9.jpg', 7),
  ('1781033256', 'rzxjmxu3mkw9u7r8khvl.jpg', 8),
  ('1781033258', 'tbmg86yzlwyzutfer8sn.jpg', 9),
  ('1781033258', 'hwnagxmvmzcogvoyrhzx.jpg', 10)
) as v (ver, file, position)
where l.code = 'Beehive 2' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1780421272', 'jcifmai1etsv7byde23q.jpg', 0),
  ('1780421269', 'djbjnffy0txrngzpz0ia.jpg', 1),
  ('1780421273', 'cja6bcsyot3rkrhepopz.jpg', 2),
  ('1780421273', 'oswyzqo1jlnyeeygbkkn.jpg', 3),
  ('1780421263', 'cafs4vn6w8zxa5bov0uh.jpg', 4),
  ('1780421269', 'wkvrzndseypeverjb4pl.jpg', 5),
  ('1781033398', 'eaisyjlu0cgjic9oqn9d.jpg', 6),
  ('1781033399', 'tsvyomjb3fzphl1pbt9w.jpg', 7),
  ('1781033400', 'nhatf06cvhnlarf0vipm.jpg', 8),
  ('1781033402', 'apaczwtgjvpycfou1shx.jpg', 9),
  ('1781033403', 'qto2xj7ns5tqqhkgbyzh.jpg', 10)
) as v (ver, file, position)
where l.code = 'Beehive 3' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1780421547', 'ilyfsn9toczkjutaeu08.jpg', 0),
  ('1780421546', 'cvrqepjnpl1rkxvacoot.jpg', 1),
  ('1780421548', 'rlzcormkxktrndijv91n.jpg', 2),
  ('1780421549', 'zmmcgqkowtr6kfcfyson.jpg', 3),
  ('1780421538', 'pqvl9nxr7qn0kqskbxjb.jpg', 4),
  ('1780421546', 'ae1pczqy8hkrsrkqeses.jpg', 5),
  ('1781033537', 'vjyr2sot0mkvv3twtxwc.jpg', 6),
  ('1781033540', 'gkn1rswqxdhkic83b942.jpg', 7),
  ('1781033540', 'aotae3g780td6gaz6npd.jpg', 8),
  ('1781033543', 'djo35g0yw2u4alxxomwv.jpg', 9),
  ('1781033543', 'rs2je61h4ochdydtisky.jpg', 10)
) as v (ver, file, position)
where l.code = 'Beehive 4' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1780421723', 'vopt6jnprkeuojdfjmjo.jpg', 0),
  ('1780421728', 'v8za1erxfhthjkxqbs7i.jpg', 1),
  ('1780421728', 'j1ex0jwtwscrjh3cwpwy.jpg', 2),
  ('1780421727', 'qces1liakg60xnntcmqo.jpg', 3),
  ('1780421718', 'ny9grx0pylj510ejyt3v.jpg', 4),
  ('1780421725', 'gprxv658ax1oca1pcfjo.jpg', 5),
  ('1781033668', 'eo6fnugggukvzzirgggy.jpg', 6),
  ('1781033669', 'pk1uhhq6yt43ae7d3yhk.jpg', 7),
  ('1781033642', 'beexsevjlfotduirumvs.jpg', 8),
  ('1781033656', 'tnun6v5eebrs3ongqrnx.jpg', 9),
  ('1781033671', 'g7b3ojzj8uykykentcbg.jpg', 10)
) as v (ver, file, position)
where l.code = 'Beehive 5' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1780421845', 'pcwoqhezta2topwlbenv.jpg', 0),
  ('1780421843', 'bdoyitjdsgfqddspxvhm.jpg', 1),
  ('1780421846', 'jsrznm3elsqzl1itsykw.jpg', 2),
  ('1780421843', 'v4n3dqdhx40ib2nfgdol.jpg', 3),
  ('1780421834', 'drvpq2h5uwbg6r4guqm9.jpg', 4),
  ('1780421844', 'jh1alwfekpk6clxdo1hg.jpg', 5),
  ('1781033811', 'kooxz3dazvukfhjw4sfp.jpg', 6),
  ('1781033814', 'ea0r6gugplaia6n2vpy1.jpg', 7),
  ('1781033814', 'obz6riljkb5qcuzevxe1.jpg', 8),
  ('1781033817', 'hbdqscockdiasjt2ndlm.jpg', 9),
  ('1781033816', 'xvxqfbc2vtobmrn1t0bd.jpg', 10)
) as v (ver, file, position)
where l.code = 'Beehive 6' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1780422141', 'fnmyhqkjn6qjwvcxr640.jpg', 0),
  ('1780422138', 'jlhhb9hmathwvtcnmcmf.jpg', 1),
  ('1780422141', 'bog0mhtrwqzzocxwhywj.jpg', 2),
  ('1780422140', 'd9keasmvvncdomzrpn93.jpg', 3),
  ('1780422131', 'tedf3g7dxjqoub4ijcge.jpg', 4),
  ('1780422137', 'mwjre3lnvlncanhxtjvs.jpg', 5),
  ('1781033923', 'yhozz0qg7skr5aoeupgq.jpg', 6),
  ('1781033924', 'oduiwsi3mrix0jp77lwk.jpg', 7),
  ('1781033926', 'xdht53lmus5afwxjszyf.jpg', 8),
  ('1781033927', 'wuxjqyfxkafcjk3aicxk.jpg', 9),
  ('1781033926', 'weustslknxi7td9gmmt8.jpg', 10)
) as v (ver, file, position)
where l.code = 'Beehive 7' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.lots (code, name, kind, status, home_status, home_name, in_hospitality, hospitality_since,
  listing_title, listing_summary, bedrooms, beds, bathrooms, max_guests, nightly_rate, rate_currency, check_in_time, check_out_time,
  amenities, house_rules, listing_notes, listing_published)
values ('Mystic Mountain', 'Mystic Mountain', 'rental', 'not_for_sale', 'built', 'Mystic Mountain', true, current_date,
  'Mystic Mountain', 'Boho-chic ocean view studios with panoramic rooftops. A bedroom, a bathroom and a small kitchen, with sea views, a hammock and a garden. Guests have the run of The ARK: the courts, the Shala, the farm and the farm market.', 1, 1, 1, 2, 150, 'USD', '15:00', '10:00',
  array['Ocean view','Air conditioning','Wifi','Workspace','Kitchen','Parking','Garden','Family friendly','Club access']::text[], 'No pets.
No smoking.
No parties or events.
Children and infants are welcome.', 'Imported from Guesty (https://theark.guestybookings.com/en/properties/68f7ede74c738c00107e6d78). Bookings are taken there for now.', false)
on conflict (code) do nothing;
insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1761078371', 'ahadeoxpujxxtzskcdmf.jpg', 0),
  ('1761078371', 'xddytlfcsgydythxxf3p.jpg', 1),
  ('1761078369', 'zwywffovmz0dxukzrw0o.jpg', 2),
  ('1761078369', 'murmemdmkohxrmfyfi2e.jpg', 3),
  ('1761078371', 'l1fvoxgfhb3osnohir6b.jpg', 4),
  ('1761078370', 'do69yrznjrwchvjmkqpd.jpg', 5),
  ('1761078369', 'j46rx1nlzdklpvxvglok.jpg', 6),
  ('1761078369', 'comlnx7g5fijobmssqv8.jpg', 7),
  ('1761078369', 'werv6t0equcv7hhfuz8k.jpg', 8),
  ('1761078369', 'dh4pzdqfs3ooameixls4.jpg', 9),
  ('1761078371', 'yvb0glz4sgsxfffiiwe5.jpg', 10),
  ('1761078371', 'zylez7eqkmlin1a5njsv.jpg', 11),
  ('1761078372', 'hcyhht39vfhxu0az1gjp.jpg', 12),
  ('1761078372', 'tgzwanjzxp0inmjv1opj.jpg', 13)
) as v (ver, file, position)
where l.code = 'Mystic Mountain' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.lots (code, name, kind, status, home_status, home_name, in_hospitality, hospitality_since,
  listing_title, listing_summary, bedrooms, beds, bathrooms, max_guests, nightly_rate, rate_currency, check_in_time, check_out_time,
  amenities, house_rules, listing_notes, listing_published)
values ('La Sierra', 'La Sierra', 'rental', 'not_for_sale', 'built', 'La Sierra', true, current_date,
  'Luxury House at La Sierra', 'A modern home with clean architectural lines, floor-to-ceiling glass and premium finishes, looking out over the jungle and the Pacific. Two bedrooms, one bathroom, a fully equipped kitchen, laundry, air conditioning and Starlink WiFi. Weekly cleaning is included.

Guests have the whole house, its garden and outdoor areas, and full access to The ARK: the courts, the Shala, the farm and the farm market.', 2, 2, 1, 4, 350, 'USD', '15:00', '11:00',
  array['Ocean view','Air conditioning','Wifi','Workspace','Kitchen','Washer','Parking','Garden','Family friendly','Club access']::text[], 'No pets.
No smoking.
No parties or events.
Children and infants are welcome.', 'Imported from Guesty (https://theark.guestybookings.com/en/properties/685b045a2640be002aa093c4). Bookings are taken there for now.', false)
on conflict (code) do nothing;
insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1766540730', 'iienynp84pdj7nplg6mh.jpg', 0),
  ('1766540745', 'fmpbo7ggiuwbpnnuban5.jpg', 1),
  ('1766540744', 'ukof2nirlxpmhbtlvvwz.jpg', 2),
  ('1766540740', 'sasn1tw4z2i57z78ihge.jpg', 3),
  ('1766540743', 'h3x01uxkx46oec7tlbo0.jpg', 4),
  ('1766540739', 'pjmp47etv9q23ka8irxa.jpg', 5),
  ('1766540745', 'kwul4u0bgywnzs8pgatq.jpg', 6),
  ('1766540745', 'zjraei9t1in0fbjqywcd.jpg', 7),
  ('1766540743', 'kqhydlcxlk9vmiiqfzls.jpg', 8),
  ('1766540734', 'm85cgh9j369mcetl8jxh.jpg', 9),
  ('1766540735', 'dqiutfyqvebcq64k1pjf.jpg', 10),
  ('1766540729', 'o2i5utmhwef3m80ifcpf.jpg', 11),
  ('1766540729', 'pieqtfkjilncvwkjy5ii.jpg', 12),
  ('1766540729', 'hirbhuat8ac6ixu3l3d3.jpg', 13),
  ('1766540738', 'ksblcxwtehd6zyp4wfdk.jpg', 14),
  ('1766540738', 'bw0pveqgfqhqk7t9li8a.jpg', 15),
  ('1766540749', 'r0gl8oomduhgki4repoa.jpg', 16),
  ('1766540734', 'vlz13g5ujfsvmlxdcjr9.jpg', 17),
  ('1766540736', 'sr52gu5ssj7jvodi4vrd.jpg', 18),
  ('1766540734', 'nrfzn0jq5bgutdne1i51.jpg', 19),
  ('1766540748', 'minoob72bombmudsycll.jpg', 20),
  ('1766540729', 'pzyb42hbqyji4la9izmf.jpg', 21),
  ('1766540748', 'obacrcwhoorbrdh46kwe.jpg', 22),
  ('1766540739', 'n8axgdpxhl04vujcvpvg.jpg', 23),
  ('1766540729', 'qsthygz5mt8w7tuogjee.jpg', 24),
  ('1766540749', 'ecb3bubdav2datogbng1.jpg', 25)
) as v (ver, file, position)
where l.code = 'La Sierra' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.lots (code, name, kind, status, home_status, home_name, in_hospitality, hospitality_since,
  listing_title, listing_summary, bedrooms, beds, bathrooms, max_guests, nightly_rate, rate_currency, check_in_time, check_out_time,
  amenities, house_rules, listing_notes, listing_published)
values ('Airstream at La Sierra', 'Airstream at La Sierra', 'rental', 'not_for_sale', 'built', 'Airstream at La Sierra', true, current_date,
  'Luxury Airstream at La Sierra', 'A 31-foot Airstream imported from Texas and fully rebuilt for a new life at The ARK. A king bed, air conditioning, Starlink WiFi, a surf rack and a curated 1970s feel. Inside: a private bedroom with mountain views, a full kitchen, a workspace and a lounge. Outside: a private patio and garden with an outdoor shower.', 1, 1, 0.5, 2, 140, 'USD', '15:00', '11:00',
  array['Air conditioning','Wifi','Workspace','Kitchen','Parking','Garden','Outdoor shower','Family friendly','Club access']::text[], 'No pets.
No smoking.
No parties or events.
Children and infants are welcome.', 'Imported from Guesty (https://theark.guestybookings.com/en/properties/6a2c71950aff430014683727). Bookings are taken there for now.', false)
on conflict (code) do nothing;
insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1781297338', 'acfruq9lp1udjmnv2rtj.jpg', 0),
  ('1781297341', 'nffkwiltjds8zauidnns.jpg', 1),
  ('1781297341', 'k5s2r7udkjs2tsmpelcx.jpg', 2),
  ('1781297341', 'r0y6hzoc75eed6hbmnpo.jpg', 3),
  ('1781297339', 'l9saeawl1ikxyjlsumet.jpg', 4),
  ('1781297338', 'orumfbb4cmczcjnghqkd.jpg', 5),
  ('1781297340', 'l1d8gnfx8v74lofafuim.jpg', 6),
  ('1781297339', 'xzskz3wdkuagbwcmc56n.jpg', 7),
  ('1781297342', 'oeqsoxdnamdyoi2fd8ro.jpg', 8),
  ('1781297340', 'kthzbmwlq7juknj3pody.jpg', 9),
  ('1781297337', 'mrypia1jmv6dahazocd3.jpg', 10),
  ('1781297334', 'iynmun4yikzqajqas0cw.jpg', 11),
  ('1781297337', 'o6cermo9gawqyj4p2bl6.jpg', 12),
  ('1781297332', 'u6mdndvt9f0h63gfwusw.jpg', 13),
  ('1781297339', 'txu6qqjvcxjafbrchsno.jpg', 14),
  ('1781297332', 'flygksahaqb4xkwqsozh.jpg', 15),
  ('1781297336', 'cg4q5fmt6weu5aeqsats.jpg', 16),
  ('1781297335', 'rbyxdhuiwa1qwhokfiho.jpg', 17),
  ('1781297333', 'cbamjw9xqmqxuu5uspya.jpg', 18),
  ('1781297334', 'aae4fj3obo1x82crx65x.jpg', 19),
  ('1781297335', 'c3gnjqqdvqvq4jaqvojv.jpg', 20),
  ('1781297332', 'r2f9n03qcpfcb7obcbo0.jpg', 21)
) as v (ver, file, position)
where l.code = 'Airstream at La Sierra' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.lots (code, name, kind, status, home_status, home_name, in_hospitality, hospitality_since,
  listing_title, listing_summary, bedrooms, beds, bathrooms, max_guests, nightly_rate, rate_currency, check_in_time, check_out_time,
  amenities, house_rules, listing_notes, listing_published)
values ('Casa Lumy', 'Casa Lumy', 'rental', 'not_for_sale', 'built', 'Casa Lumy', true, current_date,
  'Casa Lumy', 'A new jungle hideaway inside The ARK. Three en-suite bedrooms sleep six, each with its own air conditioning, plus a private pool, a garden and glimpses of the ocean through the trees. Fully solar powered, with Starlink WiFi, a workspace and private parking.

The main house has two en-suite bedrooms (a king, and a twin or king); the third en-suite king sits in a separate building for extra privacy. Guests have full access to The ARK: the courts, the Shala, the farm and the farm market.', 3, 4, 3, 6, 350, 'USD', '15:00', '11:00',
  array['Pool','Ocean view','Air conditioning','Wifi','Workspace','Kitchen','Parking','Garden','Solar power','Family friendly','Club access']::text[], 'No pets.
No smoking.
No parties or events.
Children and infants are welcome.', 'Imported from Guesty (https://theark.guestybookings.com/en/properties/6a318a5b86b0d70014a82bbd). Bookings are taken there for now.', false)
on conflict (code) do nothing;
insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1781630867', 'dxe2lhypqhz5vpskpbof.jpg', 0),
  ('1781630870', 'ebfvxk7zg29ojqim4bvn.jpg', 1),
  ('1781630869', 'kkh8n1ioats3dds7cmhp.jpg', 2),
  ('1781630870', 'xuzxrptwakputw4w0wxm.jpg', 3),
  ('1781630867', 'qemmc9oahi1zrcbbiwte.jpg', 4),
  ('1781631142', 'hnh5ypw51y6en2t7kt4d.jpg', 5),
  ('1781631208', 'xft8bcgagozxpfnqywh1.jpg', 6),
  ('1781636838', 'gllqdfx612jauvuvfzql.jpg', 7),
  ('1781636837', 'uhvtevv8fhkwwc7yursl.jpg', 8),
  ('1781630869', 'vmon2u60nv7fypslkymt.jpg', 9),
  ('1781631207', 'oyeul7clm7v37dwxbuuk.jpg', 10),
  ('1781630872', 'ukahdxzyskfpxwsgqrbf.jpg', 11),
  ('1781630866', 'zwrrzf1ny5jgq1n13zjf.jpg', 12),
  ('1781636838', 'iyngm9mvdrye7psx5rem.jpg', 13),
  ('1781630866', 'rbuwfsbzueic20tvvumt.jpg', 14),
  ('1781631208', 'zxjsl1tfnzd5slt005xt.jpg', 15),
  ('1781630866', 'tv7p4hmlt0cq7hixnwyt.jpg', 16),
  ('1781630869', 'zc4njlgq7hs2mgwhzwll.jpg', 17),
  ('1781630869', 'nfbq8iazvfu6xpsixbzx.jpg', 18),
  ('1781630872', 'dx1rqjyj8bvw5ocebizk.jpg', 19),
  ('1781636636', 'tcpt3cqff9efrmsopav4.jpg', 20),
  ('1781636636', 'vb1kt8k7ynbgcqkt1umq.jpg', 21),
  ('1781636650', 'qdsqg9jsgpwtvnysmwjg.jpg', 22),
  ('1781636650', 'zi13knavonxbyk4ruieh.jpg', 23),
  ('1781636636', 'yxdoot2hyksp5baaz9l2.jpg', 24),
  ('1781630866', 'rgjakys0hfpycpgk7lmx.jpg', 25)
) as v (ver, file, position)
where l.code = 'Casa Lumy' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.lots (code, name, kind, status, home_status, home_name, in_hospitality, hospitality_since,
  listing_title, listing_summary, bedrooms, beds, bathrooms, max_guests, nightly_rate, rate_currency, check_in_time, check_out_time,
  amenities, house_rules, listing_notes, listing_published)
values ('Ocean Vista 1', 'Ocean Vista 1', 'rental', 'not_for_sale', 'built', 'Ocean Vista 1', true, current_date,
  'Ocean Vista 1', 'A three-bedroom villa overlooking the ocean.', 3, null, null, null, null, 'USD', '15:00', '11:00',
  array['Ocean view','Club access']::text[], null, 'Imported from theark.world/ark-rentals. Not on the Guesty booking site.', false)
on conflict (code) do nothing;
insert into public.listing_photos (lot_id, path, position)
select l.id, v.path, v.position from public.lots l, (values
  ('https://images.squarespace-cdn.com/content/v1/6244f8003484ae57c87c285d/861baf67-ca04-439e-a528-ec20b9ae4a20/2a19b47a-1f15-434b-9498-7b02b9a6b48a.jpeg?format=1500w', 0)
) as v (path, position)
where l.code = 'Ocean Vista 1' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

insert into public.lots (code, name, kind, status, home_status, home_name, in_hospitality, hospitality_since,
  listing_title, listing_summary, bedrooms, beds, bathrooms, max_guests, nightly_rate, rate_currency, check_in_time, check_out_time,
  amenities, house_rules, listing_notes, listing_published)
values ('Ocean Vista 2', 'Ocean Vista 2', 'rental', 'not_for_sale', 'built', 'Ocean Vista 2', true, current_date,
  'Ocean Vista 2', 'A villa with two bedrooms and two bathrooms, overlooking the ocean.', 2, null, 2, null, null, 'USD', '15:00', '11:00',
  array['Ocean view','Club access']::text[], null, 'Imported from theark.world/ark-rentals. Not on the Guesty booking site.', false)
on conflict (code) do nothing;
insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://assets.guesty.com/image/upload/w_1600,c_limit,q_auto,f_auto/v' || v.ver || '/production/67c5d70540e1ed4a6dae2839/' || v.file, v.position
from public.lots l, (values
  ('1748901701', 'rojfwbybxsxy5ikmuucp.jpg', 0)
) as v (ver, file, position)
where l.code = 'Ocean Vista 2' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);

-- Villa Tanit is the home on Tanit Estate (lot 10).
-- Only fills what's blank, so anything the team already set is kept.
update public.lots set in_hospitality = true, hospitality_since = coalesce(hospitality_since, current_date),
  listing_title = coalesce(listing_title, 'Villa Tanit'),
  listing_summary = coalesce(listing_summary, 'An elegant jungle retreat with modern amenities and lush surroundings.'),
  listing_notes = coalesce(listing_notes, 'Imported from theark.world/ark-rentals. Not on the Guesty booking site.')
where code = '10';
insert into public.listing_photos (lot_id, path, position)
select l.id, 'https://images.squarespace-cdn.com/content/v1/6244f8003484ae57c87c285d/67a6aca5-c195-414b-b371-a73a506693ef/004+Living+room+-+Overview.jpg?format=1500w', 0 from public.lots l
where l.code = '10' and not exists (select 1 from public.listing_photos p where p.lot_id = l.id);
