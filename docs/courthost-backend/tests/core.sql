
begin;
create temporary table courthost_test_results(name text);
grant all on courthost_test_results to authenticated,anon;
create function pg_temp.assert_ok(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; insert into courthost_test_results values(label); end $$;
create function pg_temp.rejects(stmt text,label text) returns void language plpgsql as $$
declare rejected boolean:=false;
begin
 begin execute stmt; exception when others then rejected:=true; end;
 perform pg_temp.assert_ok(rejected,label);
end $$;
do $$
declare u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); players uuid[]:='{}'; r jsonb; sid uuid; sid2 uuid; mid uuid; nextmid uuid; token text; i int; cnt int; lo int; hi int; spid uuid; original jsonb;
begin
 insert into auth.users(id,email) values(u,'courthost-rollback-test@example.invalid');
 insert into public.profiles(id,full_name) values(u,'Rollback test host');
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 for i in 1..12 loop
  r:=public.courthost_command('create_player',jsonb_build_object('name','Test '||i,'skill',1+(i%10)));
  players:=array_append(players,(r->>'id')::uuid);
 end loop;
 perform pg_temp.rejects($q$select public.courthost_command('create_player','{"name":"bad","skill":11}')$q$,'skill range enforced');
 perform pg_temp.rejects($q$insert into public.players(name) values('bypass')$q$,'direct host writes blocked');

 r:=public.courthost_command('create_session',jsonb_build_object('name','Doubles test','start_time',now(),'duration_minutes',120,
 'game_mode','doubles','matchmaking_mode','skill_based','player_ids',to_jsonb(players[1:7])));
 sid:=(r->>'id')::uuid;token:=r->>'public_code';
 perform pg_temp.rejects(format('select public.get_public_session(%L)',token),'draft cannot be shared');
 perform public.courthost_command('generate_batch',jsonb_build_object('session_id',sid));
 execute 'set constraints all immediate';
 execute 'set constraints all deferred';
 select count(*) into cnt from public.matches where session_id=sid;
 perform pg_temp.assert_ok(cnt=2,'seven doubles players get two-match first batch');
 select min(n),max(n) into lo,hi from(select count(mp.id) n from public.session_players sp left join public.match_players mp on mp.session_player_id=sp.id where sp.session_id=sid group by sp.id) x;
 perform pg_temp.assert_ok(lo=1 and hi=2,'initial batch covers everyone fairly');
 perform pg_temp.rejects(format('select public.courthost_command(''add_player'',%L::jsonb)',jsonb_build_object('session_id',sid,'player_id',players[8])::text),'scheduled roster locked');

 select id into mid from public.matches where session_id=sid order by match_number limit 1;
 select id into nextmid from public.matches where session_id=sid order by match_number desc limit 1;
 perform pg_temp.rejects(format('select public.courthost_command(''start_match'',%L::jsonb)',jsonb_build_object('match_id',nextmid)::text),'cannot skip earliest match');
 perform public.courthost_command('start_match',jsonb_build_object('match_id',mid));
 perform pg_temp.rejects(format('select public.courthost_command(''start_match'',%L::jsonb)',jsonb_build_object('match_id',nextmid)::text),'one playing match');
 perform public.courthost_command('save_score',jsonb_build_object('match_id',mid,'team1_score',1,'team2_score',1));
 perform pg_temp.assert_ok((select status='in_progress' from public.matches where id=mid),'saving live score does not finish');
 perform pg_temp.rejects(format('select public.courthost_command(''finish_match'',%L::jsonb)',jsonb_build_object('match_id',mid)::text),'partial score cannot finish');
 perform pg_temp.rejects(format('select public.courthost_command(''save_score'',%L::jsonb)',jsonb_build_object('match_id',mid,'team1_score',3,'team2_score',2)::text),'sum above four rejected');
 perform public.courthost_command('finish_match',jsonb_build_object('match_id',mid,'team1_score',3,'team2_score',1));
 perform pg_temp.assert_ok((select status='scheduled' from public.matches where id=nextmid),'next match does not auto-start');
 perform pg_temp.assert_ok((select sum(points)=8 and count(*)=4 from public.session_leaderboards where session_id=sid),'doubles points credited fully');
 perform public.courthost_command('correct_result',jsonb_build_object('match_id',mid,'team1_score',2,'team2_score',2));
 perform pg_temp.assert_ok((select bool_and(draws=1 and points=2 and ranking=1) from public.session_leaderboards where session_id=sid),'draw correction and shared rank');

 -- Test public role through actual SQL permissions.
 execute 'set local role anon';
 r:=public.get_public_session(token);
 perform pg_temp.assert_ok(jsonb_array_length(r->'leaderboard')=4,'anonymous token read works');
 perform pg_temp.assert_ok(not ((r->'session') ? 'host_id'),'public payload excludes host identity');
 perform pg_temp.rejects('select * from public.sessions','anonymous table reads blocked');
 perform pg_temp.rejects($q$select public.get_public_session(repeat('0',64))$q$,'invalid token rejected');
 perform pg_temp.rejects($q$select public.courthost_command('create_player','{"name":"intruder"}')$q$,'anonymous mutations blocked');
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform pg_temp.assert_ok((select count(*)=0 from public.sessions),'other user cannot read session');
 perform pg_temp.rejects(format('select public.courthost_command(''end_session'',%L::jsonb)',jsonb_build_object('session_id',sid)::text),'unprovisioned user cannot mutate');
 perform set_config('request.jwt.claim.sub',u::text,true);

 perform public.courthost_command('archive_player',jsonb_build_object('player_id',players[1]));
 r:=public.get_public_session(token);
 perform pg_temp.assert_ok(jsonb_array_length(r->'players')=7,'archiving preserves public participants');
 perform public.courthost_command('update_player',jsonb_build_object('player_id',players[1],'name','Renamed'));
 perform pg_temp.assert_ok((select name_snapshot='Test 1' from public.session_players where session_id=sid and player_id=players[1]),'name snapshot remains stable');

 select mp.session_player_id into spid from public.match_players mp where match_id=nextmid limit 1;
 perform public.courthost_command('withdraw_player',jsonb_build_object('session_id',sid,'session_player_id',spid));
 perform pg_temp.assert_ok((select status='cancelled' from public.matches where id=nextmid),'withdrawal cancels affected future match');
 perform pg_temp.assert_ok((select count(*)=4 from public.session_leaderboards where session_id=sid),'withdrawal preserves completed results');
 perform public.courthost_command('generate_batch',jsonb_build_object('session_id',sid,'allow_overtime',true));
 perform pg_temp.assert_ok(not exists(select 1 from public.matches mm join public.match_players mp on mp.match_id=mm.id where mm.session_id=sid and mm.status='scheduled' and mp.session_player_id=spid),'regenerated future matches exclude withdrawn player');

 perform public.courthost_command('end_session',jsonb_build_object('session_id',sid));
 original:=(public.get_public_session(token))->'leaderboard';
 perform pg_temp.assert_ok((select status='completed' and final_leaderboard is not null from public.sessions where id=sid),'session completion freezes leaderboard');
 perform pg_temp.rejects(format('select public.courthost_command(''correct_result'',%L::jsonb)',jsonb_build_object('match_id',mid,'team1_score',4,'team2_score',0)::text),'completed session correction rejected');
 perform public.courthost_command('revoke_share',jsonb_build_object('session_id',sid));
 perform pg_temp.rejects(format('select public.get_public_session(%L)',token),'revoked token rejected');
 r:=public.courthost_command('rotate_share',jsonb_build_object('session_id',sid));
 perform pg_temp.assert_ok((public.get_public_session(r->>'public_code'))->'leaderboard'=original,'rotated link preserves frozen result');
 perform public.courthost_command('delete_session',jsonb_build_object('session_id',sid));
 perform pg_temp.rejects(format('select public.get_public_session(%L)',r->>'public_code'),'deleted session not public');

 perform public.courthost_command('update_player',jsonb_build_object('player_id',players[1],'is_active',true));
 -- Batch generation for singles and doubles, even/odd roster sizes.
 for i in 2..12 loop
  r:=public.courthost_command('create_session',jsonb_build_object('name','Singles '||i,'start_time',now(),'duration_minutes',360,
   'game_mode','singles','matchmaking_mode',case when i%2=0 then 'random' else 'skill_based' end,'player_ids',to_jsonb(players[1:i])));
  -- Reactivate player 1 before these creation calls (done below outside this section).
  sid2:=(r->>'id')::uuid;
  perform public.courthost_command('generate_batch',jsonb_build_object('session_id',sid2));
  execute 'set constraints all immediate';execute 'set constraints all deferred';
  perform pg_temp.assert_ok((select count(distinct mp.session_player_id)=i from public.match_players mp join public.matches mm on mm.id=mp.match_id where mm.session_id=sid2),'singles coverage '||i);
  perform public.courthost_command('generate_batch',jsonb_build_object('session_id',sid2,'allow_overtime',true));
  select min(n),max(n) into lo,hi from(select count(mp.id) n from public.session_players sp left join public.match_players mp on mp.session_player_id=sp.id where sp.session_id=sid2 group by sp.id) x;
  perform pg_temp.assert_ok(hi-lo<=1,'singles repeated-batch fairness '||i);
 end loop;
 execute 'reset role';
end $$;
set constraints all immediate;
select count(*) passed_checks, jsonb_agg(name) checks from courthost_test_results;
rollback;

