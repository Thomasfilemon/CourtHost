import { useTranslation } from 'react-i18next';
import type { PublicSession } from './public-session-api';
export function PublicMatchList({ matches, players, playerId }: { matches: PublicSession['matches']; players: PublicSession['players']; playerId: string }) {
  const { t } = useTranslation();
  return <ol className="public-matches">{matches.map(match => <li key={match.id} className={`session-match ${match.status === 'in_progress' ? 'public-playing' : ''} ${match.participants.some(player => player.session_player_id === playerId) ? 'public-my-match' : ''}`}>
    <div className="session-match-top"><strong>{t('sessions.matchNumber', { number: match.number })}</strong><span className={`session-status session-status-${match.status}`}>{t(`sessions.status.${match.status}`)}</span></div>
    <div className="session-teams"><span>{match.participants.filter(p => p.team === 1).map(p => players.find(player => player.id === p.session_player_id)?.name ?? '—').join(' + ')}</span><strong>{match.team1_score ?? '—'} : {match.team2_score ?? '—'}</strong><span>{match.participants.filter(p => p.team === 2).map(p => players.find(player => player.id === p.session_player_id)?.name ?? '—').join(' + ')}</span></div>
  </li>)}</ol>;
}
