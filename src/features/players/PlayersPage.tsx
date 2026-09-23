import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../../components/Sheet';
import { Toast } from '../../components/Toast';
import { AddPlayersForm } from './AddPlayersForm';
import { PlayerForm } from './PlayerForm';
import { listPlayers, runPlayerCommand } from './players-api';
import { PAGE_SIZE, playerErrorKey } from './player-model';
import type { Player, PlayerCommand, PlayerFilter, PlayerInput } from './player-model';
import './players.css';

type Editor = { kind: 'create' } | { kind: 'edit' | 'archive' | 'restore' | 'delete'; player: Player };
export function PlayersPage({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [params, setParams] = useState({ search: '', filter: 'active' as PlayerFilter, page: 0 });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [notice, setNotice] = useState<{ key: string; count?: number } | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const [batchSaving, setBatchSaving] = useState(false);
  const [errorKey, setErrorKey] = useState('');
  const writeLock = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => setParams(p => p.search === search ? p : { ...p, search, page: 0 }), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ['players', userId, params],
    queryFn: ({ signal }) => listPlayers(params, signal),
    retry: false, networkMode: 'always', gcTime: 0,
  });
  const mutation = useMutation({ mutationFn: runPlayerCommand, retry: false, networkMode: 'always' });
  function open(value: Editor) { setNotice(null); setErrorKey(''); setEditor(value); }
  async function save(command: PlayerCommand) {
    if (writeLock.current) return;
    writeLock.current = true; setErrorKey(''); setNotice(null);
    try {
      await mutation.mutateAsync(command);
      setEditor(null);
      setNotice({ key: command.action === 'create_player' ? 'players.created' : command.action === 'delete_player'
        ? 'players.deleted' : command.action === 'archive_player' ? 'players.archived' : 'players.updated' });
      // Refetch server truth; success never depends on an optimistic local row.
      await cache.invalidateQueries({ queryKey: ['players', userId] });
    } catch (error) { setErrorKey(playerErrorKey(error)); }
    finally { writeLock.current = false; }
  }
  async function savePlayers(values: PlayerInput[]) {
    if (writeLock.current) return 0;
    writeLock.current = true; setBatchSaving(true); setErrorKey(''); setNotice(null);
    let saved = 0;
    try {
      // Each player is an independent host-checked write. Stop on the first failure;
      // never retry automatically because a missing response may have committed.
      for (const data of values) {
        await mutation.mutateAsync({ action: 'create_player', data });
        saved++;
      }
      setEditor(null);
    } catch (error) { setErrorKey(playerErrorKey(error)); }
    finally {
      if (saved > 0) setNotice({ key: 'players.createdCount', count: saved });
      await cache.invalidateQueries({ queryKey: ['players', userId] });
      writeLock.current = false; setBatchSaving(false);
    }
    return saved;
  }
  const busy = mutation.isPending || batchSaving;
  const notification = notice && <Toast onDismiss={dismissNotice}>{t(notice.key, { count: notice.count })}</Toast>;
  const players = query.data?.players ?? [];
  const count = query.data?.count ?? 0;
  const isSearching = search !== params.search;
  return <section className="roster" aria-labelledby="players-title">
    <div className="roster-heading">
      <div><h1 id="players-title">{t('players.title')}</h1><p>{t('players.subtitle')}</p></div>
      <div className="roster-count" aria-label={t('players.countLabel')}>{query.isPending || query.isError ? '—' : count}</div>
    </div>
    {!editor && notification}
    <div className="roster-card">
      <div className="roster-toolbar">
        <div className="roster-search"><img src="/assets/figma/search.svg" width="24" height="24" alt="" />
          <input aria-label={t('players.search')} placeholder={t('players.search')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="roster-primary" onClick={() => open({ kind: 'create' })} disabled={busy}>{t('players.add')}</button>
      </div>
      <div className="roster-filters">
        <label htmlFor="roster-filter">{t('players.show')}</label>
        <div className="roster-filter-select" data-status={params.filter}>
          <span className="filter-dot" aria-hidden="true" />
          <select id="roster-filter" value={params.filter} onChange={e => setParams(p => ({ ...p, filter: e.target.value as PlayerFilter, page: 0 }))}>
            <option value="all">{t('players.all')}</option>
            <option value="active">{t('players.active')}</option>
            <option value="archived">{t('players.archiveFilter')}</option>
          </select>
          <svg className="filter-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <button className="roster-text-button" onClick={() => void query.refetch()} disabled={query.isFetching}>{t('players.refresh')}</button>
      </div>
      <div aria-busy={query.isFetching || isSearching}>
        {query.isPending ? <p role="status" className="roster-state">{t('players.loading')}</p>
          : query.isError ? <div role="alert" className="roster-error"><p>{t('players.loadError')}</p><button className="roster-text-button" onClick={() => void query.refetch()} disabled={query.isFetching}>{t('auth.retry')}</button></div>
          : players.length === 0 ? <div className="roster-empty">
            <img src="/assets/figma/empty.svg" alt="" width="175" height="150" />
            <p>{t(params.search || params.filter !== 'active' || params.page > 0 ? 'players.noResults' : 'players.empty')}</p>
            {!params.search && params.filter === 'active' && params.page === 0 && <button className="roster-primary" onClick={() => open({ kind: 'create' })}>{t('players.addFirst')}</button>}
          </div> : <ul className="player-list">
            {players.map(player => <li key={player.id} className="player-row">
              <div className="player-identity"><span className="skill-badge" aria-label={t('players.skillValue', { value: player.default_skill_rating })}>{player.default_skill_rating}</span>
                <span className="player-name">{player.name}{!player.is_active && <small>{t('players.archiveFilter')}</small>}</span></div>
              <div className="player-actions">
                <button className="player-edit" aria-label={t('players.editNamed', { name: player.name })} onClick={() => open({ kind: 'edit', player })} disabled={busy}>{t('players.edit')}</button>
                <button className={player.is_active ? 'player-archive' : 'player-edit'} aria-label={t(player.is_active ? 'players.archiveNamed' : 'players.restoreNamed', { name: player.name })} onClick={() => open({ kind: player.is_active ? 'archive' : 'restore', player })} disabled={busy}>{t(player.is_active ? 'players.archive' : 'players.restore')}</button>
              </div>
            </li>)}
          </ul>}
      </div>
      {!query.isPending && !query.isError && (count > PAGE_SIZE || params.page > 0) && <div className="roster-pagination">
        <button className="roster-text-button" disabled={params.page === 0 || query.isFetching} onClick={() => setParams(p => ({ ...p, page: p.page - 1 }))}>{t('players.previous')}</button>
        <span>{t('players.page', { page: params.page + 1 })}</span>
        <button className="roster-text-button" disabled={(params.page + 1) * PAGE_SIZE >= count || query.isFetching} onClick={() => setParams(p => ({ ...p, page: p.page + 1 }))}>{t('players.next')}</button>
      </div>}
    </div>
    {editor && <Sheet title={t(`players.${editor.kind}Title`)} onClose={() => setEditor(null)} busy={busy}>
      {notification}
      {editor.kind === 'create' ? <AddPlayersForm busy={busy} errorKey={errorKey} onCancel={() => setEditor(null)} onSave={savePlayers} />
        : editor.kind === 'edit' ? <>
        <PlayerForm player={editor.player} busy={busy} errorKey={errorKey}
          onCancel={() => setEditor(null)} onSave={values => void save({ action: 'update_player', data: { player_id: editor.player.id, ...values } })} />
        {!editor.player.is_active && <div className="delete-option"><button className="roster-danger-text" disabled={busy} onClick={() => open({ kind: 'delete', player: editor.player })}>{t('players.delete')}</button></div>}
      </> : <>
        <div className="sheet-body"><p>{t(`players.${editor.kind}Body`, { name: editor.player.name })}</p>
          {errorKey && <p className="roster-error" role="alert">{t(errorKey)}</p>}
        </div>
        <div className="sheet-actions"><button className="roster-text-button" disabled={busy} onClick={() => setEditor(null)}>{t('players.cancel')}</button>
          <button className={editor.kind === 'delete' ? 'roster-danger' : 'roster-primary'} disabled={busy} onClick={() => void save(editor.kind === 'restore'
            ? { action: 'update_player', data: { player_id: editor.player.id, is_active: true } }
            : { action: editor.kind === 'archive' ? 'archive_player' : 'delete_player', data: { player_id: editor.player.id } })}>{t(busy ? 'players.saving' : `players.${editor.kind}`)}</button></div>
      </>}
    </Sheet>}
  </section>;
}
