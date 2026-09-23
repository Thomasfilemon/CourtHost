create or replace function courthost_private.command(p_action text,p_data jsonb) returns jsonb
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
   select array_agg(q.id order by q.appearances,q.covered_priority,q.tie) into chosen
   from (
    select x.id,count(mm0.id) appearances,case when x.id=any(covered) then 1 else 0 end covered_priority,random() tie
    from public.session_players x
    left join public.match_players mp on mp.session_player_id=x.id
    left join public.matches mm0 on mm0.id=mp.match_id and mm0.status<>'cancelled'
    where x.id=any(ids)
    group by x.id order by appearances,covered_priority,tie limit needed
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
