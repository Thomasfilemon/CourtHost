
-- CourtHost repair of the inspected existing schema. Not a fresh-project baseline.
create schema if not exists courthost_private;
revoke all on schema courthost_private from public, anon, authenticated;
grant usage on schema courthost_private to authenticated, anon;

drop function public.generate_next_match(uuid);
drop function public.submit_score(uuid,integer,integer);
drop function public.add_player_to_session(uuid,uuid);
drop function public.matchups_broadcast_trigger();

alter table public.sessions
 add column estimated_match_minutes integer not null default 20 check(estimated_match_minutes > 0),
 add column started_at timestamptz,
 add column completed_at timestamptz,
 add column deleted_at timestamptz,
 add column share_revoked_at timestamptz,
 add column realtime_token text not null default encode(extensions.gen_random_bytes(32),'hex'),
 add column final_leaderboard jsonb;
alter table public.sessions drop constraint sessions_duration_minutes_check;
alter table public.sessions add constraint sessions_duration_positive check(duration_minutes > 0);
alter table public.sessions drop constraint sessions_status_check;
alter table public.sessions add constraint sessions_status_check check(status in ('draft','scheduled','active','completed','cancelled'));
alter table public.sessions alter column public_code set default encode(extensions.gen_random_bytes(32),'hex');
alter table public.session_players add column name_snapshot text;
update public.session_players sp set name_snapshot=p.name from public.players p where p.id=sp.player_id;
alter table public.session_players alter column name_snapshot set not null;
alter table public.session_players add constraint session_player_name_nonempty check(length(btrim(name_snapshot)) between 1 and 100);
alter table public.players add constraint player_name_nonempty check(length(btrim(name)) between 1 and 100);
alter table public.sessions add constraint session_name_nonempty check(length(btrim(name)) between 1 and 120);
alter table public.matches add column cancellation_reason text;
alter table public.matches add constraint match_four_point_range check(
 (team1_score is null or team1_score between 0 and 4) and
 (team2_score is null or team2_score between 0 and 4) and
 (team1_score is null or team2_score is null or team1_score+team2_score<=4));
alter table public.matches add constraint match_completed_four_points check(
 status <> 'completed' or (team1_score is not null and team2_score is not null and team1_score+team2_score=4 and started_at is not null));
alter table public.matches add constraint match_single_court check(court_number is null or court_number=1);
create unique index courthost_one_active_session on public.sessions ((true)) where status='active' and deleted_at is null;
create unique index courthost_one_playing_match on public.matches ((true)) where status='in_progress';
create unique index courthost_single_host on public.profiles ((true));
create index courthost_history on public.sessions(host_id,start_time desc) where deleted_at is null;

-- Rebuild explicit client grants and policies for the seven known application tables.
do $$
declare r record; t text;
begin
 for r in select tablename,policyname from pg_policies where schemaname='public'
 and tablename in ('profiles','players','sessions','session_players','matches','match_players','matchmaking_runs')
 loop execute format('drop policy %I on public.%I',r.policyname,r.tablename); end loop;
 foreach t in array array['profiles','players','sessions','session_players','matches','match_players','matchmaking_runs']
 loop
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
revoke all on public.session_leaderboards from public,anon,authenticated;
grant select on public.session_leaderboards to authenticated;
create policy host_profile_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy host_roster_read on public.players for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid())));
create policy host_session_read on public.sessions for select to authenticated using(host_id=(select auth.uid()) and deleted_at is null);
create policy host_membership_read on public.session_players for select to authenticated using(exists(select 1 from public.sessions s where s.id=session_id and s.host_id=(select auth.uid()) and s.deleted_at is null));
create policy host_match_read on public.matches for select to authenticated using(exists(select 1 from public.sessions s where s.id=session_id and s.host_id=(select auth.uid()) and s.deleted_at is null));
create policy host_participant_read on public.match_players for select to authenticated using(exists(select 1 from public.matches m join public.sessions s on s.id=m.session_id where m.id=match_id and s.host_id=(select auth.uid()) and s.deleted_at is null));
create policy host_run_read on public.matchmaking_runs for select to authenticated using(exists(select 1 from public.sessions s where s.id=session_id and s.host_id=(select auth.uid()) and s.deleted_at is null));

-- Guard historical data, even for writes made through a privileged function.
create function courthost_private.guard_history() returns trigger language plpgsql set search_path='' as $$
declare sid uuid; st text;
begin
 if tg_table_name='sessions' then
  if tg_op='UPDATE' and old.status in ('completed','cancelled') and
   (to_jsonb(new)-array['deleted_at','share_revoked_at','public_code','realtime_token']) is distinct from
   (to_jsonb(old)-array['deleted_at','share_revoked_at','public_code','realtime_token'])
   then raise exception 'Session is read-only'; end if;
  if tg_op='DELETE' and old.status in ('completed','cancelled') then raise exception 'Use soft deletion'; end if;
 else
  if tg_table_name='match_players' then
   select session_id into sid from public.matches where id=case when tg_op='DELETE' then old.match_id else new.match_id end;
  else
   sid:=case when tg_op='DELETE' then old.session_id else new.session_id end;
  end if;
  select status into st from public.sessions where id=sid for update;
  if st in ('completed','cancelled') then raise exception 'Session is read-only'; end if;
  if tg_op='UPDATE' then
   if tg_table_name='match_players' then
    if old.match_id<>new.match_id or old.session_player_id<>new.session_player_id then raise exception 'Participant identity is immutable'; end if;
   elsif old.session_id<>new.session_id then raise exception 'Session identity is immutable'; end if;
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger guard_session before update or delete on public.sessions for each row execute function courthost_private.guard_history();
create trigger guard_membership before insert or update or delete on public.session_players for each row execute function courthost_private.guard_history();
create trigger guard_match before insert or update or delete on public.matches for each row execute function courthost_private.guard_history();
create trigger guard_participant before insert or update or delete on public.match_players for each row execute function courthost_private.guard_history();

-- Deferred team-size and same-session checks allow an entire match to be inserted atomically.
create function courthost_private.validate_match() returns trigger language plpgsql set search_path='' as $$
declare mid uuid; sid uuid; mode text; expected integer; n1 integer; n2 integer;
begin
 if tg_table_name='matches' then mid:=case when tg_op='DELETE' then old.id else new.id end;
 else mid:=case when tg_op='DELETE' then old.match_id else new.match_id end; end if;
 select m.session_id,s.game_mode into sid,mode from public.matches m join public.sessions s on s.id=m.session_id where m.id=mid;
 if not found then return null; end if;
 expected:=case when mode='singles' then 1 else 2 end;
 if exists(select 1 from public.match_players mp join public.session_players sp on sp.id=mp.session_player_id where mp.match_id=mid and sp.session_id<>sid)
 then raise exception 'Participants must belong to match session'; end if;
 select count(*) filter(where team=1),count(*) filter(where team=2) into n1,n2 from public.match_players where match_id=mid;
 if n1<>expected or n2<>expected then raise exception 'Invalid team size'; end if;
 return null;
end $$;
create constraint trigger valid_match after insert or update on public.matches deferrable initially deferred for each row execute function courthost_private.validate_match();
create constraint trigger valid_participants after insert or update or delete on public.match_players deferrable initially deferred for each row execute function courthost_private.validate_match();

-- Preserve existing view columns while adding deterministic tie-break ordering.
create or replace view public.session_leaderboards with(security_invoker=true) as
with stats as (
 select sp.session_id,sp.id session_player_id,sp.player_id,sp.name_snapshot player_name,sp.skill_rating,m.id match_id,mp.team,
 case when mp.team=1 then m.team1_score else m.team2_score end pf,
 case when mp.team=1 then m.team2_score else m.team1_score end pa
 from public.match_players mp join public.matches m on m.id=mp.match_id
 join public.session_players sp on sp.id=mp.session_player_id and sp.session_id=m.session_id
 where m.status='completed'
), agg as (
 select session_id,session_player_id,player_id,player_name,skill_rating,count(*) matches_played,
 count(*) filter(where pf>pa) wins,count(*) filter(where pf<pa) losses,count(*) filter(where pf=pa) draws,
 sum(pf) games_won,sum(pa) games_lost
 from stats group by session_id,session_player_id,player_id,player_name,skill_rating
), ties as (
 select *,count(*) over(partition by session_id,games_won,wins,(games_won-games_lost)) tie_count from agg
), ranked as (
 select a.*,case when tie_count=2 then coalesce((
 select sum(x.pf) from stats x join stats y on x.match_id=y.match_id and x.team<>y.team
 join ties b on b.session_player_id=y.session_player_id
 where x.session_player_id=a.session_player_id and b.session_id=a.session_id
 and b.games_won=a.games_won and b.wins=a.wins and b.games_won-b.games_lost=a.games_won-a.games_lost
 ),0) else 0 end h2h from ties a
)
select session_id,session_player_id,player_id,player_name,skill_rating,matches_played,wins,losses,draws,
 games_won,games_lost,games_won points,games_won-games_lost game_difference,
 rank() over(partition by session_id order by games_won desc,wins desc,(games_won-games_lost) desc,h2h desc) ranking
from ranked;

create function courthost_private.leaderboard(sid uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(l) order by ranking,player_name,session_player_id),'[]'::jsonb)
 from public.session_leaderboards l where session_id=sid
$$;

-- All client writes enter this dispatcher. Auth and ownership are verified before any mutation.
create function courthost_private.command(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); sid uuid; mid uuid; pid uuid; s public.sessions; m public.matches;
 sp public.session_players; pl public.players; result jsonb; ids uuid[]; chosen uuid[]; skills integer[];
 covered uuid[]:='{}'; needed integer; n integer; i integer; j integer; k integer; num integer; batch integer;
 score1 integer; score2 integer; pairing integer; diff integer; best_diff integer; repeats integer; best_repeats integer;
 t1 uuid[]; t2 uuid[]; best1 uuid[]; best2 uuid[]; mode text; ack boolean;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and role in ('host','admin'))
 then raise exception 'Host authentication required' using errcode='42501'; end if;
 if p_action in ('create_player','update_player','archive_player','delete_player') then
  if p_action='create_player' then
   insert into public.players(name,default_skill_rating) values(btrim(p_data->>'name'),coalesce((p_data->>'skill')::int,5)) returning * into pl;
  else
   select * into pl from public.players where id=(p_data->>'player_id')::uuid for update;
   if not found then raise exception 'Player not found'; end if;
   if p_action='update_player' then
    update public.players set name=coalesce(btrim(p_data->>'name'),name),
     default_skill_rating=coalesce((p_data->>'skill')::int,default_skill_rating),
     is_active=coalesce((p_data->>'is_active')::boolean,is_active) where id=pl.id returning * into pl;
   elsif p_action='archive_player' then
    update public.players set is_active=false where id=pl.id returning * into pl;
   else
    if exists(select 1 from public.session_players where player_id=pl.id) then raise exception 'Referenced player must be archived'; end if;
    delete from public.players where id=pl.id;
   end if;
  end if;
  return to_jsonb(pl);
 end if;
 if p_action='create_session' then
  insert into public.sessions(host_id,name,start_time,duration_minutes,estimated_match_minutes,game_mode,matchmaking_mode)
  values(uid,btrim(p_data->>'name'),(p_data->>'start_time')::timestamptz,(p_data->>'duration_minutes')::int,
   coalesce((p_data->>'estimated_match_minutes')::int,20),p_data->>'game_mode',p_data->>'matchmaking_mode')
  returning * into s;
  for pid in select value::uuid from jsonb_array_elements_text(coalesce(p_data->'player_ids','[]'::jsonb))
  loop
   select * into pl from public.players where id=pid and is_active;
   if not found then raise exception 'Selected player not found or archived'; end if;
   insert into public.session_players(session_id,player_id,skill_rating,name_snapshot) values(s.id,pl.id,pl.default_skill_rating,pl.name);
  end loop;
  return to_jsonb(s);
 end if;

 sid:=(p_data->>'session_id')::uuid;
 mid:=(p_data->>'match_id')::uuid;
 if mid is not null then select session_id into sid from public.matches where id=mid; end if;
 select * into s from public.sessions where id=sid and host_id=uid and deleted_at is null for update;
 if not found then raise exception 'Session not found or not owned' using errcode='42501'; end if;

 if p_action in ('revoke_share','rotate_share','delete_session') then
  if p_action='delete_session' then
   if s.status not in ('completed','cancelled') then raise exception 'End or cancel the session before deleting'; end if;
   update public.sessions set deleted_at=now(),share_revoked_at=now(),realtime_token=encode(extensions.gen_random_bytes(32),'hex') where id=sid returning * into s;
  elsif p_action='revoke_share' then
   update public.sessions set share_revoked_at=now(),realtime_token=encode(extensions.gen_random_bytes(32),'hex') where id=sid returning * into s;
  else
   update public.sessions set public_code=encode(extensions.gen_random_bytes(32),'hex'),share_revoked_at=null,
    realtime_token=encode(extensions.gen_random_bytes(32),'hex') where id=sid returning * into s;
  end if;
  return to_jsonb(s);
 end if;
 if s.status in ('completed','cancelled') then raise exception 'Session is read-only'; end if;

 if p_action='edit_session' then
  if s.status<>'draft' then raise exception 'Return the schedule to draft before editing setup'; end if;
  update public.sessions set name=coalesce(btrim(p_data->>'name'),name),
   start_time=coalesce((p_data->>'start_time')::timestamptz,start_time),
   duration_minutes=coalesce((p_data->>'duration_minutes')::int,duration_minutes),
   estimated_match_minutes=coalesce((p_data->>'estimated_match_minutes')::int,estimated_match_minutes),
   game_mode=coalesce(p_data->>'game_mode',game_mode),matchmaking_mode=coalesce(p_data->>'matchmaking_mode',matchmaking_mode)
   where id=sid returning * into s;
  return to_jsonb(s);
 elsif p_action in ('add_player','remove_player') then
  if s.status<>'draft' then raise exception 'Roster is locked after schedule generation'; end if;
  pid:=(p_data->>'player_id')::uuid;
  if p_action='remove_player' then
   delete from public.session_players where session_id=sid and player_id=pid;
   return jsonb_build_object('removed',pid);
  end if;
  select * into pl from public.players where id=pid and is_active;
  if not found then raise exception 'Player not found or archived'; end if;
  insert into public.session_players(session_id,player_id,skill_rating,name_snapshot)
  values(sid,pid,pl.default_skill_rating,pl.name) returning * into sp;
  return to_jsonb(sp);
 elsif p_action='reset_schedule' then
  if s.status not in ('draft','scheduled') then raise exception 'Cannot reset a started session'; end if;
  delete from public.matches where session_id=sid;
  update public.sessions set status='draft' where id=sid;
  return jsonb_build_object('status','draft');
 elsif p_action='generate_batch' then
  -- Greedy fair selection; bounded candidate search avoids combinations over the entire roster.
  needed:=case when s.game_mode='singles' then 2 else 4 end;
  select array_agg(id order by id) into ids from public.session_players where session_id=sid and not is_retired;
  n:=coalesce(array_length(ids,1),0);
  if n<needed then raise exception 'Not enough available players'; end if;
  num:=ceil(n::numeric/needed)::int;
  if ((select count(*) from public.matches where session_id=sid and status<>'cancelled')+num)::bigint*s.estimated_match_minutes>s.duration_minutes
   and not coalesce((p_data->>'allow_overtime')::boolean,false)
   then raise exception 'Estimated duration exceeded; confirm allow_overtime'; end if;
  select coalesce(max(round_number),0)+1 into batch from public.matches where session_id=sid;
  -- Each batch covers every available player. Within appearance ties, uncovered players come first.
  while exists(select 1 from unnest(ids) x where not x=any(covered)) loop
   select array_agg(q.id order by q.appearances,q.covered,q.tie) into chosen
   from (
    select x.id,count(m.id) appearances,case when x.id=any(covered) then 1 else 0 end covered,random() tie
    from public.session_players x
    left join public.match_players mp on mp.session_player_id=x.id
    left join public.matches m on m.id=mp.match_id and m.status<>'cancelled'
    where x.id=any(ids)
    group by x.id order by appearances,covered,tie limit needed
   ) q;
   -- Singles skill mode: choose the closest equally fair opponent to the first selected player.
   if needed=2 and s.matchmaking_mode='skill_based' then
    select x.id into pid from public.session_players x
    left join public.match_players mp on mp.session_player_id=x.id
    left join public.matches mm on mm.id=mp.match_id and mm.status<>'cancelled'
    where x.id=any(ids) and x.id<>chosen[1]
    group by x.id,x.skill_rating
    order by count(mm.id),case when x.id=any(covered) then 1 else 0 end,
     abs(x.skill_rating-(select skill_rating from public.session_players where id=chosen[1])),random() limit 1;
    chosen[2]:=pid;
   end if;
   best_diff:=2147483647; best_repeats:=2147483647;
   if needed=2 then best1:=array[chosen[1]];best2:=array[chosen[2]];
   else
    for pairing in 2..4 loop
     t1:=array[chosen[1],chosen[pairing]];
     select array_agg(x order by x) into t2 from unnest(chosen) x where not x=any(t1);
     select abs(sum(case when id=any(t1) then skill_rating else -skill_rating end)) into diff from public.session_players where id=any(chosen);
     if s.matchmaking_mode='random' then diff:=0; end if;
     select count(*) into repeats from public.match_players a join public.match_players b on a.match_id=b.match_id and a.team=b.team and a.id<b.id
     join public.matches mm on mm.id=a.match_id
     where mm.session_id=sid and mm.status<>'cancelled' and
      ((a.session_player_id=any(t1) and b.session_player_id=any(t1)) or (a.session_player_id=any(t2) and b.session_player_id=any(t2)));
     if diff<best_diff or (diff=best_diff and repeats<best_repeats) or (diff=best_diff and repeats=best_repeats and random()<0.5)
     then best_diff:=diff;best_repeats:=repeats;best1:=t1;best2:=t2; end if;
    end loop;
   end if;
   select coalesce(max(match_number),0)+1 into num from public.matches where session_id=sid;
   insert into public.matches(session_id,match_number,round_number,court_number) values(sid,num,batch,1) returning id into mid;
   insert into public.match_players(match_id,session_player_id,team) select mid,x,1 from unnest(best1) x union all select mid,x,2 from unnest(best2) x;
   insert into public.matchmaking_runs(session_id,match_id,algorithm,players_considered,skill_difference)
    select sid,mid,s.matchmaking_mode,n,abs(sum(case when id=any(best1) then skill_rating else -skill_rating end))
    from public.session_players where id=any(chosen);
   covered:=array(select distinct x from unnest(covered||chosen) x);
  end loop;
  if s.status='draft' then update public.sessions set status='scheduled' where id=sid; end if;
  return jsonb_build_object('generation_batch',batch,'matches',(
   select jsonb_agg(to_jsonb(mm) order by match_number) from public.matches mm where session_id=sid and round_number=batch));
 elsif p_action='withdraw_player' then
  if s.status<>'active' then raise exception 'Withdrawal requires active session'; end if;
  pid:=(p_data->>'session_player_id')::uuid;
  if exists(select 1 from public.match_players mp join public.matches mm on mm.id=mp.match_id where mp.session_player_id=pid and mm.status='in_progress')
  then raise exception 'Finish or explicitly cancel the playing match first'; end if;
  update public.session_players set is_retired=true where id=pid and session_id=sid returning * into sp;
  if not found then raise exception 'Session player not found'; end if;
  update public.matches set status='cancelled',cancellation_reason='player_withdrawn'
   where session_id=sid and status='scheduled' and id in(select match_id from public.match_players where session_player_id=pid);
  return to_jsonb(sp);
 elsif p_action in ('end_session','cancel_session') then
  if exists(select 1 from public.matches where session_id=sid and status='in_progress') then raise exception 'Finish or explicitly cancel playing match first'; end if;
  if p_action='end_session' and s.status<>'active' then raise exception 'Only active sessions can end'; end if;
  if p_action='cancel_session' and exists(select 1 from public.matches where session_id=sid and status='completed')
   then raise exception 'Completed results exist; use end_session'; end if;
  update public.matches set status='cancelled',cancellation_reason='session_ended' where session_id=sid and status='scheduled';
  result:=courthost_private.leaderboard(sid);
  update public.sessions set status=case when p_action='end_session' then 'completed' else 'cancelled' end,
   completed_at=now(),final_leaderboard=result where id=sid returning * into s;
  return to_jsonb(s);
 end if;

 if mid is null then raise exception 'Unknown action or missing match_id'; end if;
 select * into m from public.matches where id=mid and session_id=sid for update;
 if not found then raise exception 'Match not found'; end if;
 if p_action='start_match' then
  if s.status not in ('scheduled','active') or m.status<>'scheduled' then raise exception 'Match cannot start'; end if;
  if exists(select 1 from public.matches where session_id=sid and status='scheduled' and match_number<m.match_number)
   then raise exception 'Start the earliest upcoming match'; end if;
  if exists(select 1 from public.match_players mp join public.session_players x on x.id=mp.session_player_id where mp.match_id=mid and x.is_retired)
   then raise exception 'Match contains withdrawn player'; end if;
  update public.sessions set status='active',started_at=coalesce(started_at,now()) where id=sid;
  update public.matches set status='in_progress',started_at=now(),team1_score=0,team2_score=0 where id=mid returning * into m;
 elsif p_action in ('save_score','finish_match','correct_result') then
  if s.status<>'active' then raise exception 'Session must be active'; end if;
  if p_action='correct_result' then
   if m.status<>'completed' then raise exception 'Correction requires completed match'; end if;
  elsif m.status<>'in_progress' then raise exception 'Match must be playing'; end if;
  score1:=(p_data->>'team1_score')::integer; score2:=(p_data->>'team2_score')::integer;
  if p_action='finish_match' then score1:=coalesce(score1,m.team1_score);score2:=coalesce(score2,m.team2_score); end if;
  if score1 is null or score2 is null or score1 not between 0 and 4 or score2 not between 0 and 4 or score1+score2>4
   then raise exception 'Invalid score'; end if;
  if p_action<>'save_score' and score1+score2<>4 then raise exception 'Final scores must total four'; end if;
  update public.matches set team1_score=score1,team2_score=score2,
   status=case when p_action='save_score' then 'in_progress' else 'completed' end,
   finished_at=case when p_action='save_score' then null else coalesce(finished_at,now()) end
   where id=mid returning * into m;
 elsif p_action='cancel_match' then
  if m.status not in ('scheduled','in_progress') then raise exception 'Only uncompleted matches may be cancelled'; end if;
  update public.matches set status='cancelled',cancellation_reason=coalesce(nullif(btrim(p_data->>'reason'),''),'host_cancelled') where id=mid returning * into m;
 else raise exception 'Unknown action: %',p_action;
 end if;
 return to_jsonb(m);
end $$;
revoke all on function courthost_private.command(text,jsonb) from public,anon,authenticated;
grant execute on function courthost_private.command(text,jsonb) to authenticated;
create function public.courthost_command(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$
 select courthost_private.command(p_action,p_data)
$$;
revoke all on function public.courthost_command(text,jsonb) from public,anon;
grant execute on function public.courthost_command(text,jsonb) to authenticated;

-- Token reads intentionally authorize the supplied bearer token instead of an Auth user.
-- Plain token storage is restricted to the host to support copying the same link later.
create function courthost_private.public_session(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.sessions;
begin
 if p_token is null or length(p_token)<>64 then raise exception 'Session unavailable' using errcode='42501'; end if;
 select * into s from public.sessions where public_code=p_token and share_revoked_at is null and deleted_at is null and status<>'draft';
 if not found then raise exception 'Session unavailable' using errcode='42501'; end if;
 return jsonb_build_object(
 'session',jsonb_build_object('name',s.name,'start_time',s.start_time,'duration_minutes',s.duration_minutes,
 'estimated_match_minutes',s.estimated_match_minutes,'game_mode',s.game_mode,'status',s.status,'started_at',s.started_at,'completed_at',s.completed_at),
 'realtime_topic','courthost:'||s.realtime_token,
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',sp.id,'name',sp.name_snapshot,'is_retired',sp.is_retired) order by sp.name_snapshot,sp.id) from public.session_players sp where session_id=s.id),'[]'::jsonb),
 'matches',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'number',m.match_number,'status',m.status,
 'team1_score',m.team1_score,'team2_score',m.team2_score,'started_at',m.started_at,'finished_at',m.finished_at,
 'participants',(select jsonb_agg(jsonb_build_object('session_player_id',mp.session_player_id,'team',mp.team) order by mp.team,mp.session_player_id) from public.match_players mp where match_id=m.id)) order by m.match_number)
 from public.matches m where session_id=s.id),'[]'::jsonb),
 'leaderboard',(select coalesce(jsonb_agg(x - array['player_id','session_id','skill_rating']),'[]'::jsonb)
 from jsonb_array_elements(coalesce(s.final_leaderboard,courthost_private.leaderboard(s.id))) x));
end $$;
revoke all on function courthost_private.public_session(text) from public;
grant execute on function courthost_private.public_session(text) to anon,authenticated;
create function public.get_public_session(p_token text) returns jsonb
language sql security invoker set search_path='' as $$select courthost_private.public_session(p_token)$$;
revoke all on function public.get_public_session(text) from public;
grant execute on function public.get_public_session(text) to anon,authenticated;

-- Only invalidation signals are broadcast. Clients always refetch via token RPC.
-- Public-channel client messages are untrusted and must never be treated as scores.
create function courthost_private.notify_session() returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid; topic text; previous_topic text;
begin
 if tg_table_name='sessions' then
  sid:=case when tg_op='DELETE' then old.id else new.id end;
  if tg_op='UPDATE' then previous_topic:=old.realtime_token; end if;
 elsif tg_table_name='match_players' then
  select session_id into sid from public.matches where id=case when tg_op='DELETE' then old.match_id else new.match_id end;
 else sid:=case when tg_op='DELETE' then old.session_id else new.session_id end;
 end if;
 select realtime_token into topic from public.sessions where id=sid and deleted_at is null and share_revoked_at is null;
 if previous_topic is not null and previous_topic is distinct from topic then
  perform realtime.send('{"refresh":true}'::jsonb,'session_changed','courthost:'||previous_topic,false);
 end if;
 if topic is not null then perform realtime.send('{"refresh":true}'::jsonb,'session_changed','courthost:'||topic,false); end if;
 return null;
end $$;
create trigger notify_session after insert or update or delete on public.sessions for each row execute function courthost_private.notify_session();
create trigger notify_match after insert or update or delete on public.matches for each row execute function courthost_private.notify_session();
create trigger notify_membership after insert or update or delete on public.session_players for each row execute function courthost_private.notify_session();
create trigger notify_participant after insert or update or delete on public.match_players for each row execute function courthost_private.notify_session();
revoke all on function courthost_private.guard_history(),courthost_private.validate_match(),courthost_private.leaderboard(uuid),courthost_private.notify_session() from public,anon,authenticated;
