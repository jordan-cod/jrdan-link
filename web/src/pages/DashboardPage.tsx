import { useNavigate, useSearch } from '@tanstack/react-router';
import { type StatsSearch, StatsView } from '../components/StatsView';

export function DashboardPage() {
	const search = useSearch({ from: '/app/' });
	const navigate = useNavigate({ from: '/' });

	return (
		<div className="grid gap-6">
			<header>
				<h1 className="text-[1.75rem] font-semibold tracking-tight">Dashboard</h1>
				<p className="mt-1 text-mute">De onde vêm os cliques nos seus links.</p>
			</header>
			<StatsView
				search={search}
				onSearch={(patch: Partial<StatsSearch>) =>
					navigate({ search: (prev) => ({ ...prev, ...patch }), resetScroll: false, replace: true })
				}
			/>
		</div>
	);
}
