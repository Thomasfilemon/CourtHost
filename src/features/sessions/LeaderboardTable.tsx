import { useTranslation } from 'react-i18next';
export type LeaderboardEntry = { session_player_id: string | null; player_name: string | null; ranking: number | null; matches_played: number | null; wins: number | null; draws: number | null; losses: number | null; points: number | null; game_difference: number | null };
export function LeaderboardTable({ rows }: { rows: LeaderboardEntry[] }) {
  const { t } = useTranslation();
  if (!rows.length) return <p>{t('sessions.historyNoStats')}</p>;
  return <div className="history-table-wrap"><table className="history-table">
    <caption className="sr-only">{t('sessions.historyLeaderboard')}</caption>
    <thead><tr>{['Rank', 'Player', 'Played', 'Wins', 'Draws', 'Losses', 'Points', 'Difference'].map(key => <th scope="col" key={key}>{t(`sessions.history${key}`)}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.session_player_id}><td>{row.ranking ?? '—'}</td><th scope="row">{row.player_name}</th><td>{row.matches_played ?? 0}</td><td>{row.wins ?? 0}</td><td>{row.draws ?? 0}</td><td>{row.losses ?? 0}</td><td><strong>{row.points ?? 0}</strong></td><td>{row.game_difference ?? 0}</td></tr>)}</tbody>
  </table></div>;
}
