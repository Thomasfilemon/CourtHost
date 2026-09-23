
begin;
create temporary table courthost_test_results(name text);
create function pg_temp.assert_ok(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; insert into courthost_test_results values(label); end $$;
create function pg_temp.rejects(stmt text,label text) returns void language plpgsql as $$
declare rejected boolean:=false;
begin begin execute stmt; exception when others then rejected:=true; end;
perform pg_temp.assert_ok(rejected,label); end $$;
do $$
declare u uuid:=gen_random_uuid(); ids uuid[]:='{}'; r jsonb; s uuid; s2 uuid; m uuid; m2 uuid; sp uuid; i int; lo int; hi int; before_count bigint;
begin
 insert into auth.users(id,email) values(u,'courthost-extra-test@example.invalid');
 insert into public.profiles(id,full_name) values(u,'Extra rollback test');
 perform set_config('request.jwt.claim.sub',u::text,true);
 for i in 1..12 loop
  r:=public.courthost_command('create_player',jsonb_build_object('name','Extra '||i,'skill',1+(i%10)));
  ids:=array_append(ids,(r->>'id')::uuid);
 end loop;
 for i in 4..12 loop
  r:=public.courthost_command('create_session',jsonb_build_object('name','Doubles '||i,'start_time',now(),'duration_minutes',360,
   'game_mode','doubles','matchmaking_mode',case when i%2=0 then 'random' else 'skill_based' end,'player_ids',to_jsonb(ids[1:i])));
  s:=(r->>'id')::uuid;
  perform public.courthost_command('generate_batch',jsonb_build_object('session_id',s));
  set constraints all immediate;set constraints all deferred;
  perform pg_temp.assert_ok((select count(distinct mp.session_player_id)=i from public.match_players mp join public.matches mm on mm.id=mp.match_id where mm.session_id=s),'doubles coverage '||i);
  perform public.courthost_command('generate_batch',jsonb_build_object('session_id',s,'allow_overtime',true));
  select min(n),max(n) into lo,hi from(select count(mp.id) n from public.session_players spp left join public.match_players mp on mp.session_player_id=spp.id where spp.session_id=s group by spp.id) x;
  perform pg_temp.assert_ok(hi-lo<=1,'doubles repeated-batch fairness '||i);
  -- All skill matches select the minimum team difference among the three partitions of chosen players.
  if i%2=1 then
   perform pg_temp.assert_ok(not exists(
    select 1 from public.matches mm
    cross join lateral (select array_agg(spp.skill_rating order by mp.team,mp.session_player_id) a from public.match_players mp join public.session_players spp on spp.id=mp.session_player_id where mp.match_id=mm.id) x
    where mm.session_id=s and abs(a[1]+a[2]-a[3]-a[4])>least(abs(a[1]+a[3]-a[2]-a[4]),abs(a[1]+a[4]-a[2]-a[3]))
   ),'skill doubles best partition '||i);
  end if;
 end loop;
 select id into m from public.matches where session_id=s order by match_number limit 1;
 perform pg_temp.rejects(format('delete from public.match_players where id=(select id from public.match_players where match_id=%L limit 1); set constraints all immediate',m),'database rejects incorrect team size');
 r:=public.courthost_command('create_session',jsonb_build_object('name','Other session','start_time',now(),'duration_minutes',120,
   'game_mode','singles','matchmaking_mode','random','player_ids',to_jsonb(ids[1:2])));
 s2:=(r->>'id')::uuid;
 select id into sp from public.session_players where session_id=s2 limit 1;
 perform pg_temp.rejects(format('insert into public.match_players(match_id,session_player_id,team) values(%L,%L,1);set constraints all immediate',m,sp),'database rejects cross-session participant');
 perform public.courthost_command('generate_batch',jsonb_build_object('session_id',s2));
 select id into m2 from public.matches where session_id=s2 order by match_number limit 1;
 perform public.courthost_command('start_match',jsonb_build_object('match_id',m));
 perform pg_temp.rejects(format('select public.courthost_command(''start_match'',%L::jsonb)',jsonb_build_object('match_id',m2)::text),'venue prevents concurrent active sessions');
 perform pg_temp.rejects(format('select public.courthost_command(''end_session'',%L::jsonb)',jsonb_build_object('session_id',s)::text),'ending cannot silently cancel playing result');
 perform public.courthost_command('cancel_match',jsonb_build_object('match_id',m,'reason','injury'));
 perform public.courthost_command('end_session',jsonb_build_object('session_id',s));
 perform pg_temp.rejects(format('update public.matches set team1_score=1 where id=%L',m),'history trigger protects privileged writes');
 perform pg_temp.assert_ok((select count(*)>0 from realtime.messages where event='session_changed' and payload - 'id'='{"refresh":true}'::jsonb),'database emits sanitized realtime signals');

 -- Rebuildable draft and membership operations.
 perform public.courthost_command('reset_schedule',jsonb_build_object('session_id',s2));
 perform public.courthost_command('remove_player',jsonb_build_object('session_id',s2,'player_id',ids[2]));
 perform public.courthost_command('add_player',jsonb_build_object('session_id',s2,'player_id',ids[3]));
 perform public.courthost_command('edit_session',jsonb_build_object('session_id',s2,'duration_minutes',1));
 perform pg_temp.rejects(format('select public.courthost_command(''generate_batch'',%L::jsonb)',jsonb_build_object('session_id',s2)::text),'duration warning requires explicit override');
 perform public.courthost_command('generate_batch',jsonb_build_object('session_id',s2,'allow_overtime',true));
 perform public.courthost_command('cancel_session',jsonb_build_object('session_id',s2));
 perform pg_temp.assert_ok((select status='cancelled' from public.sessions where id=s2),'unplayed session cancellation works');
end $$;
set constraints all immediate;
select count(*) passed_checks,jsonb_agg(name) checks from courthost_test_results;
rollback;

